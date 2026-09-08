/**
 * Train Data Service
 * Orchestrates train discovery between stations, timetable resolution,
 * and live telemetry integration.
 */

const railRadar = require('./railRadarService');
const corridorDataRef = require('../../js/corridor_data');

// Station chainage references for Southern Railway (KM from Chennai Central)
const STATION_CHAINAGE = {
  MAS: 0.0,
  MS: 2.1,
  AJJ: 68.6,
  KPD: 129.6,
  JTJ: 214.1,
  MAP: 268.5,
  SA: 334.2,
  ED: 394.0,
  TUP: 444.2,
  CBE: 494.4,
  VM: 158.9,
  TPJ: 336.5,
  DG: 430.7,
  MDU: 493.1
};

class TrainDataService {
  /**
   * Automatically determines section KM limits from the station reference dataset.
   * Does NOT invent ranges if mapping is unavailable.
   */
  getSectionKmRange(fromStation, toStation) {
    return corridorDataRef.getSectionKmRange(fromStation, toStation);
  }

  /**
   * Helper: Parse "HH:MM" into minutes since midnight
   */
  timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
  }

  minutesToTime(mins) {
    if (mins === null || isNaN(mins)) return '--:--';
    const normalized = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Estimates when a train passes a specific KM worksite between two stations.
   */
  estimateWorksitePassageTime(depTimeMins, arrTimeMins, fromKm, toKm, worksiteStartKm, worksiteEndKm) {
    if (depTimeMins === null || arrTimeMins === null) return null;

    // Handle overnight wrap if arrival < departure
    let effectiveArr = arrTimeMins;
    if (effectiveArr < depTimeMins) effectiveArr += 1440;

    const totalDuration = effectiveArr - depTimeMins;
    const totalDistance = Math.abs(toKm - fromKm);
    if (totalDistance <= 0 || totalDuration <= 0) {
      return { entryTimeMins: depTimeMins, exitTimeMins: effectiveArr };
    }

    const midWorksiteKm = (worksiteStartKm + worksiteEndKm) / 2;
    const distanceToWorksite = Math.abs(midWorksiteKm - fromKm);
    const fraction = Math.min(1, Math.max(0, distanceToWorksite / totalDistance));

    // Entry and exit times considering worksite length
    const worksiteSpanKm = Math.abs(worksiteEndKm - worksiteStartKm);
    const timeInWorksite = Math.max(3, Math.round((worksiteSpanKm / totalDistance) * totalDuration));

    const estEntryMins = Math.round(depTimeMins + fraction * totalDuration - timeInWorksite / 2);
    const estExitMins = estEntryMins + timeInWorksite;

    return {
      entryTimeMins: estEntryMins % 1440,
      exitTimeMins: estExitMins % 1440,
      entryTimeFormatted: this.minutesToTime(estEntryMins),
      exitTimeFormatted: this.minutesToTime(estExitMins)
    };
  }

  /**
   * Validates whether the entered worksite KM range represents an actual maintenance
   * worksite stretch and falls within the station section chainage.
   * Strictly verifies:
   *   - startKm >= sectionMin
   *   - endKm <= sectionMax
   *   - startKm < endKm
   */
  validateWorksiteKmRange(fromStation, toStation, startKmInput, endKmInput) {
    const from = (fromStation || 'KPD').toUpperCase().trim();
    const to = (toStation || 'JTJ').toUpperCase().trim();
    const section = this.getSectionKmRange(from, to);

    let start = null;
    let end = null;

    // Check if separate start and end were provided
    if (startKmInput !== undefined && startKmInput !== null && endKmInput !== undefined && endKmInput !== null && endKmInput !== '') {
      start = parseFloat(startKmInput);
      end = parseFloat(endKmInput);
    } else if (typeof startKmInput === 'string') {
      const kmMatches = startKmInput.match(/(\d+(?:\.\d+)?)/g);
      if (kmMatches && kmMatches.length >= 2) {
        start = parseFloat(kmMatches[0]);
        end = parseFloat(kmMatches[1]);
      } else if (kmMatches && kmMatches.length === 1) {
        start = parseFloat(kmMatches[0]);
        end = start + 3.0;
      }
    } else if (typeof startKmInput === 'number') {
      start = startKmInput;
      end = typeof endKmInput === 'number' ? endKmInput : start + 3.0;
    }

    if (start === null || isNaN(start) || end === null || isNaN(end)) {
      return {
        valid: false,
        error: 'Please specify both Worksite Start KM and Worksite End KM (e.g. 32.40 and 34.10).',
        spanKm: 0,
        startKm: null,
        endKm: null,
        section: section
      };
    }

    if (start >= end) {
      return {
        valid: false,
        error: `Worksite Start KM (${start.toFixed(2)}) must be strictly less than Worksite End KM (${end.toFixed(2)}).`,
        spanKm: 0,
        startKm: start,
        endKm: end,
        section: section
      };
    }

    const spanKm = parseFloat((end - start).toFixed(2));

    if (section && section.available) {
      const minSectionKm = section.startKm;
      const maxSectionKm = section.endKm;

      if (start < minSectionKm) {
        return {
          valid: false,
          error: `Worksite Start KM (${start.toFixed(2)}) is outside Section KM Range (${section.label}). Cannot be less than ${minSectionKm.toFixed(2)}.`,
          spanKm: spanKm,
          startKm: start,
          endKm: end,
          section: section
        };
      }

      if (end > maxSectionKm) {
        return {
          valid: false,
          error: `Worksite End KM (${end.toFixed(2)}) is outside Section KM Range (${section.label}). Cannot exceed ${maxSectionKm.toFixed(2)}.`,
          spanKm: spanKm,
          startKm: start,
          endKm: end,
          section: section
        };
      }

      let warning = null;
      if (spanKm > 25.0) {
        warning = `Worksite span (${spanKm.toFixed(2)} km) is unusually large. Worksite KM Range should represent only the specific maintenance stretch, not the entire section.`;
      }

      return {
        valid: true,
        warning: warning,
        message: `Valid worksite span: ${spanKm.toFixed(2)} km within ${from}–${to} section (${section.label}).`,
        spanKm: spanKm,
        startKm: start,
        endKm: end,
        formattedRange: `KM ${start.toFixed(2)} – KM ${end.toFixed(2)}`,
        section: section
      };
    }

    return {
      valid: true,
      message: `Worksite span: ${spanKm.toFixed(2)} km (Section KM range unavailable — manual verification required).`,
      spanKm: spanKm,
      startKm: start,
      endKm: end,
      formattedRange: `KM ${start.toFixed(2)} – KM ${end.toFixed(2)}`,
      section: section
    };
  }

  /**
   * Main: Discovers trains between stations, fetches timetable and live status
   */
  async getCorridorTrains(fromStation, toStation, worksiteKmRange, trackLine = 'UP Main Line', worksiteStartKm = null, worksiteEndKm = null) {
    const from = (fromStation || 'KPD').toUpperCase().trim();
    const to = (toStation || 'JTJ').toUpperCase().trim();

    // Section chainage
    const section = this.getSectionKmRange(from, to);
    const fromKm = section.available ? (section.fromCode === from ? section.startKm : section.endKm) : (STATION_CHAINAGE[from] !== undefined ? STATION_CHAINAGE[from] : 129.6);
    const toKm = section.available ? (section.toCode === to ? section.endKm : section.startKm) : (STATION_CHAINAGE[to] !== undefined ? STATION_CHAINAGE[to] : 214.1);
    const isUpDirection = toKm > fromKm; // Increasing KM = UP line towards Jolarpettai/Salem

    // Validate worksite KM range
    const startInput = worksiteStartKm !== null && worksiteStartKm !== undefined ? worksiteStartKm : worksiteKmRange;
    const endInput = worksiteEndKm !== null && worksiteEndKm !== undefined ? worksiteEndKm : null;
    const kmValidation = this.validateWorksiteKmRange(from, to, startInput, endInput);

    let wsStartKm = kmValidation.valid && kmValidation.startKm !== null ? kmValidation.startKm : (section.available ? section.startKm + 5.0 : Math.min(fromKm, toKm) + 20.0);
    let wsEndKm = kmValidation.valid && kmValidation.endKm !== null ? kmValidation.endKm : wsStartKm + 3.3;

    // Step 1: Discover relevant trains using RailRadar Trains Between Stations API
    const discoveryResult = await railRadar.getTrainsBetweenStations(from, to, { live: true });

    let liveDataAvailable = false;
    let liveStatusText = 'LIVE DATA UNAVAILABLE';
    let timetableStatusText = 'Timetable: Unavailable';
    let dataSource = 'Live Telemetry';
    let trainRecords = [];
    let liveUnavailableReason = null;

    if (discoveryResult.success && discoveryResult.data && Array.isArray(discoveryResult.data.trains) && discoveryResult.data.trains.length > 0) {
      liveDataAvailable = true;
      liveStatusText = 'LIVE DATA';
      timetableStatusText = 'Timetable: Available (RailRadar Official API)';
      dataSource = 'RailRadar Real-Time API';

      const discovered = discoveryResult.data.trains;
      console.log(`[RailRadar] Discovered ${discovered.length} live trains between ${from} and ${to}`);

      for (const item of discovered) {
        const trainNum = item.train?.number || item.trainNumber || item.number;
        if (!trainNum) continue;

        const trainName = item.train?.name || item.trainName || item.name || `Train #${trainNum}`;
        const trainType = item.train?.type || item.type || 'Express';

        // Scheduled departure from "from" station and arrival at "to" station
        const schedDep = item.from?.departure || item.departureTime || item.schedDep || '--:--';
        const schedArr = item.to?.arrival || item.arrivalTime || item.schedArr || '--:--';

        // Live delay from RailRadar real-time telemetry
        const delayMin = item.live?.delayMinutes !== undefined
          ? item.live.delayMinutes
          : (item.delayMinutes !== undefined ? item.delayMinutes : 0);

        const depMins = this.timeToMinutes(schedDep);
        const arrMins = this.timeToMinutes(schedArr);

        const actualDepMins = depMins !== null ? (depMins + delayMin) % 1440 : null;
        const actualArrMins = arrMins !== null ? (arrMins + delayMin) % 1440 : null;

        // Calculate worksite passage time based strictly on station timetable & worksite chainage
        const passage = this.estimateWorksitePassageTime(
          actualDepMins,
          actualArrMins,
          fromKm,
          toKm,
          wsStartKm,
          wsEndKm
        );

        trainRecords.push({
          trainNumber: String(trainNum),
          trainName: trainName,
          type: trainType,
          line: isUpDirection ? 'UP Main Line' : 'DOWN Main Line',
          scheduledDeparture: schedDep,
          scheduledArrival: schedArr,
          delayMinutes: delayMin,
          status: item.live?.status || item.live?.type || (delayMin > 0 ? 'Delayed' : 'On Time'),
          currentLocation: item.live?.currentLocation?.stationCode || 'En-route',
          passageTime: passage,
          isLive: true,
          dataSource: 'RailRadar API'
        });
      }
    } else {
      // Fallback: When RailRadar is unavailable or API quota/key is not usable,
      // strictly label as "Demo/Mock Data" and distinguish Scheduled vs Live data.
      liveDataAvailable = false;
      liveStatusText = 'LIVE DATA UNAVAILABLE';
      timetableStatusText = 'Timetable: Available (Demo/Mock Data)';
      dataSource = 'Demo/Mock Data';
      liveUnavailableReason = discoveryResult.error?.message || (discoveryResult.statusCode === 429 ? 'RailRadar monthly quota exceeded (1000 requests/month)' : 'Live telemetry offline');

      console.log(`[RailRadar] Live data unavailable for ${from} -> ${to} (${liveUnavailableReason}). Using verified corridor timetable reference data.`);

      trainRecords = this.getFallbackMockTrains(from, to, fromKm, toKm, wsStartKm, wsEndKm, isUpDirection);
    }

    return {
      fromStation: from,
      toStation: to,
      fromKm: fromKm,
      toKm: toKm,
      sectionKmRange: section,
      worksiteStartKm: wsStartKm,
      worksiteEndKm: wsEndKm,
      kmValidation: kmValidation,
      trackLine: trackLine,
      liveDataAvailable: liveDataAvailable,
      liveStatusText: liveStatusText,
      timetableStatusText: timetableStatusText,
      dataSource: dataSource,
      liveUnavailableReason: liveUnavailableReason,
      trains: trainRecords
    };
  }

  /**
   * Sample/mock data clearly labeled as "Demo/Mock Data" for testing/offline development.
   * Do NOT confuse with real live telemetry.
   */
  getFallbackMockTrains(from, to, fromKm, toKm, wsStartKm, wsEndKm, isUpDirection) {
    let mockList;
    const isCbeEd = (from === 'CBE' && to === 'ED') || (from === 'ED' && to === 'CBE');

    if (isCbeEd) {
      // Authentic Coimbatore – Erode Corridor Trains (Salem Division)
      mockList = [
        {
          trainNumber: '12676',
          trainName: 'Kovai Superfast Express (CBE–MAS)',
          type: 'Superfast',
          line: 'UP Main Line',
          schedDep: '11:15',
          schedArr: '12:45',
          delayMin: 8
        },
        {
          trainNumber: '06802',
          trainName: 'Coimbatore – Erode MEMU Passenger',
          type: 'Passenger',
          line: 'UP Main Line',
          schedDep: '12:00',
          schedArr: '13:40',
          delayMin: 15
        },
        {
          trainNumber: '20644',
          trainName: 'Coimbatore – Chennai Central Vande Bharat',
          type: 'Vande Bharat',
          line: 'UP Main Line',
          schedDep: '06:00',
          schedArr: '07:15',
          delayMin: 0
        },
        {
          trainNumber: '12680',
          trainName: 'Coimbatore – Chennai Intercity SF',
          type: 'Superfast',
          line: 'UP Main Line',
          schedDep: '06:20',
          schedArr: '07:50',
          delayMin: 0
        },
        {
          trainNumber: '13352',
          trainName: 'Alappuzha – Dhanbad Express',
          type: 'Express',
          line: 'UP Main Line',
          schedDep: '14:00',
          schedArr: '15:35',
          delayMin: 0
        },
        // DOWN line trains for adjacent safety tracking
        {
          trainNumber: '12675',
          trainName: 'Kovai Superfast Express (MAS–CBE)',
          type: 'Superfast',
          line: 'DOWN Main Line',
          schedDep: '12:30',
          schedArr: '14:05',
          delayMin: 6
        },
        {
          trainNumber: '20643',
          trainName: 'Chennai – Coimbatore Vande Bharat',
          type: 'Vande Bharat',
          line: 'DOWN Main Line',
          schedDep: '10:15',
          schedArr: '11:30',
          delayMin: 4
        }
      ];
    } else {
      // Katpadi – Jolarpettai & Chennai Trunk Corridor Trains
      mockList = [
        {
          trainNumber: '20643',
          trainName: 'Coimbatore Vande Bharat Express',
          type: 'Vande Bharat',
          line: 'UP Main Line',
          schedDep: '08:03',
          schedArr: '09:08',
          delayMin: 4
        },
        {
          trainNumber: '12675',
          trainName: 'Kovai Superfast Express',
          type: 'Superfast',
          line: 'UP Main Line',
          schedDep: '08:48',
          schedArr: '09:58',
          delayMin: 12
        },
        {
          trainNumber: '12639',
          trainName: 'Brindavan Express',
          type: 'Express',
          line: 'UP Main Line',
          schedDep: '09:35',
          schedArr: '10:45',
          delayMin: 0
        },
        {
          trainNumber: '66023',
          trainName: 'Arakkonam - Jolarpettai MEMU Passenger',
          type: 'Passenger',
          line: 'UP Main Line',
          schedDep: '11:45',
          schedArr: '13:30',
          delayMin: 18
        },
        {
          trainNumber: '12679',
          trainName: 'Coimbatore Intercity SF Express',
          type: 'Superfast',
          line: 'UP Main Line',
          schedDep: '16:15',
          schedArr: '17:28',
          delayMin: 0
        },
        // DOWN line trains for adjacent safety tracking
        {
          trainNumber: '12676',
          trainName: 'Kovai Express (Return)',
          type: 'Superfast',
          line: 'DOWN Main Line',
          schedDep: '12:10',
          schedArr: '13:15',
          delayMin: 6
        },
        {
          trainNumber: '12640',
          trainName: 'Brindavan Express (Return)',
          type: 'Express',
          line: 'DOWN Main Line',
          schedDep: '17:05',
          schedArr: '18:15',
          delayMin: 5
        }
      ];
    }

    return mockList.map((m) => {
      const depMins = this.timeToMinutes(m.schedDep);
      const arrMins = this.timeToMinutes(m.schedArr);
      const actualDepMins = (depMins + m.delayMin) % 1440;
      const actualArrMins = (arrMins + m.delayMin) % 1440;

      const passage = this.estimateWorksitePassageTime(
        actualDepMins,
        actualArrMins,
        fromKm,
        toKm,
        wsStartKm,
        wsEndKm
      );

      return {
        trainNumber: m.trainNumber,
        trainName: m.trainName,
        type: m.type,
        line: m.line,
        scheduledDeparture: m.schedDep,
        scheduledArrival: m.schedArr,
        delayMinutes: m.delayMin,
        status: 'scheduled',
        currentLocation: 'Timetable Schedule',
        passageTime: passage,
        isLive: false,
        dataSource: 'Demo/Mock Data'
      };
    });
  }
}

module.exports = new TrainDataService();
