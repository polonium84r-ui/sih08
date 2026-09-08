/**
 * Block Optimization Service
 * Searches for continuous feasible maintenance blocks using train telemetry.
 * Generates official recommendations (Never claims independent authorization).
 */

const conflictDetector = require('./conflictDetectionService');

class BlockOptimizationService {
  timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const clean = timeStr.trim();
    const parts = clean.split(':');
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
   * Parses time range from string like "Midday Traffic Shadow (11:00–14:30)" or "11:00-14:30"
   */
  parseWindowRange(preferredWindowStr) {
    const raw = preferredWindowStr || '11:00–14:30';
    const match = raw.match(/(\d{1,2}:\d{2})\s*[–\-–—]\s*(\d{1,2}:\d{2})/);
    if (match) {
      let start = this.timeToMinutes(match[1]);
      let end = this.timeToMinutes(match[2]);
      if (start !== null && end !== null) {
        if (end < start) end += 1440; // Overnight
        return { startMins: start, endMins: end, label: `${match[1]}–${match[2]}` };
      }
    }
    // Default fallback: 11:00 - 14:30
    return { startMins: 660, endMins: 870, label: '11:00–14:30' };
  }

  /**
   * Main Block Recommendation Algorithm
   */
  findOptimalBlock(trainCorridorData, request) {
    const durationMin = parseInt(request.durationMin, 10) || 150;
    const trackLine = request.trackLine || 'UP Main Line';
    const blockType = request.blockType || 'UP Line Block';
    const activityName = request.activityName || request.workDesc || '';
    const machinery = request.machinery || '';
    const preferredWindowStr = request.preferredSlot || 'Midday Traffic Shadow (11:00–14:30)';

    const preferred = this.parseWindowRange(preferredWindowStr);
    const trains = trainCorridorData.trains || [];

    // STEP 7: Search for a continuous block equal to requested duration inside Preferred Window
    let bestSlot = null;
    const searchStep = 15; // 15-minute increment search

    for (let t = preferred.startMins; t + durationMin <= preferred.endMins; t += searchStep) {
      const slotEnd = t + durationMin;
      const evaluation = conflictDetector.evaluateWindowConflicts(
        t,
        slotEnd,
        trains,
        trackLine,
        blockType,
        activityName,
        machinery
      );

      if (!evaluation.hasConflict) {
        bestSlot = {
          startMins: t,
          endMins: slotEnd,
          evaluation: evaluation,
          isInsidePreferred: true
        };
        break; // Found feasible slot inside preferred window
      }
    }

    // If found inside preferred window:
    if (bestSlot) {
      const startFormatted = this.minutesToTime(bestSlot.startMins);
      const endFormatted = this.minutesToTime(bestSlot.endMins);

      return {
        status: 'RECOMMENDED – PENDING CONTROLLER APPROVAL',
        authorizationLevel: 'Decision Support Advisory Recommendation (Prototype Simulation — Statutory approval requires Chief Section Controller via COA)',
        requestedWindow: preferred.label,
        recommendedBlock: `${startFormatted} – ${endFormatted} IST`,
        startMins: bestSlot.startMins,
        endMins: bestSlot.endMins,
        durationMin: durationMin,
        trackLine: trackLine,
        blockType: blockType,
        worksiteKmRange: request.worksiteKmRange || `${trainCorridorData.worksiteStartKm} – ${trainCorridorData.worksiteEndKm}`,
        conflictingTrains: [],
        conflictCount: 0,
        isInsidePreferred: true,
        windowType: 'Preferred Window',
        preferredWindowStatus: 'FEASIBLE',
        extensionBeyondPreferredMins: 0,
        extensionDetail: 'Within requested preferred window',
        reason: 'Feasible continuous block identified within preferred maintenance window without train disruption.',
        adjacentLineRestrictions: bestSlot.evaluation.adjacentLineRestrictions,
        powerBlock: bestSlot.evaluation.powerBlock,
        liveDataAvailable: trainCorridorData.liveDataAvailable,
        liveStatusText: trainCorridorData.liveStatusText,
        timetableStatusText: trainCorridorData.timetableStatusText,
        dataSource: trainCorridorData.dataSource,
        liveUnavailableReason: trainCorridorData.liveUnavailableReason,
        evaluatedTrainCount: trains.length
      };
    }

    // STEP 9: If NOT feasible inside preferred window, collect conflicts in preferred window
    const preferredEvaluation = conflictDetector.evaluateWindowConflicts(
      preferred.startMins,
      preferred.endMins,
      trains,
      trackLine,
      blockType,
      activityName,
      machinery
    );

    // Search outside preferred window starting from closest to preferred window
    let alternativeSlot = null;
    const maxDayMins = 1440 - durationMin;
    const minDayMins = 360; // 06:00 AM

    // Generate candidate start times sorted by distance to preferred window
    const candidateTimes = [];
    for (let t = minDayMins; t <= maxDayMins; t += searchStep) {
      candidateTimes.push(t);
    }
    candidateTimes.sort((a, b) => {
      const distA = a < preferred.startMins ? (preferred.startMins - a) : Math.max(0, a - preferred.endMins);
      const distB = b < preferred.startMins ? (preferred.startMins - b) : Math.max(0, b - preferred.endMins);
      return distA - distB;
    });

    for (const t of candidateTimes) {
      const slotEnd = t + durationMin;
      const evaluation = conflictDetector.evaluateWindowConflicts(
        t,
        slotEnd,
        trains,
        trackLine,
        blockType,
        activityName,
        machinery
      );

      if (!evaluation.hasConflict) {
        alternativeSlot = {
          startMins: t,
          endMins: slotEnd,
          evaluation: evaluation
        };
        break;
      }
    }

    // If still no slot, fallback to default alternative
    const altStartMins = alternativeSlot ? alternativeSlot.startMins : 900; // 15:00
    const altEndMins = alternativeSlot ? alternativeSlot.endMins : 900 + durationMin;
    const altEval = alternativeSlot
      ? alternativeSlot.evaluation
      : conflictDetector.evaluateWindowConflicts(
          altStartMins,
          altEndMins,
          trains,
          trackLine,
          blockType,
          activityName,
          machinery
        );

    const altStartFormatted = this.minutesToTime(altStartMins);
    const altEndFormatted = this.minutesToTime(altEndMins);

    // Calculate extension beyond preferred window
    let extensionMins = 0;
    let extensionDetail = '';
    if (altEndMins > preferred.endMins) {
      extensionMins = altEndMins - preferred.endMins;
      if (altStartMins >= preferred.endMins) {
        const startDiff = altStartMins - preferred.endMins;
        extensionDetail = `Starts ${startDiff}m after preferred window; extends until ${altEndFormatted} IST (${extensionMins}m beyond ${this.minutesToTime(preferred.endMins)} cutoff)`;
      } else {
        extensionDetail = `Extends ${extensionMins} minutes beyond preferred window (ends at ${altEndFormatted} IST instead of ${this.minutesToTime(preferred.endMins)} IST)`;
      }
    } else if (altStartMins < preferred.startMins) {
      extensionMins = preferred.startMins - altStartMins;
      extensionDetail = `Starts ${extensionMins} minutes before preferred window (at ${altStartFormatted} IST instead of ${this.minutesToTime(preferred.startMins)} IST)`;
    } else {
      extensionDetail = 'Outside requested preferred window boundaries';
    }

    const conflictDescriptions = preferredEvaluation.conflictingTrains.map((ct) => {
      const pTime = ct.passageTime ? `${ct.passageTime.entryTimeFormatted}–${ct.passageTime.exitTimeFormatted}` : 'in window';
      const delayInfo = ct.delayMinutes > 0 ? ` (+${ct.delayMinutes}m delay)` : '';
      return `Train #${ct.trainNumber} (${ct.trainName} at ${pTime}${delayInfo})`;
    });

    const conflictSummary = conflictDescriptions.length > 0
      ? conflictDescriptions.join(', ')
      : 'train movements in corridor';

    return {
      status: 'RECOMMENDED – PENDING CONTROLLER APPROVAL',
      authorizationLevel: 'Decision Support Advisory Recommendation (Prototype Simulation — Statutory approval requires Chief Section Controller via COA)',
      requestedWindow: preferred.label,
      recommendedBlock: `${altStartFormatted} – ${altEndFormatted} IST`,
      startMins: altStartMins,
      endMins: altEndMins,
      durationMin: durationMin,
      trackLine: trackLine,
      blockType: blockType,
      worksiteKmRange: request.worksiteKmRange || `${trainCorridorData.worksiteStartKm} – ${trainCorridorData.worksiteEndKm}`,
      conflictingTrains: preferredEvaluation.conflictingTrains.map((ct) => ({
        trainNumber: ct.trainNumber,
        trainName: ct.trainName,
        scheduledPassage: ct.passageTime ? `${ct.passageTime.entryTimeFormatted} – ${ct.passageTime.exitTimeFormatted}` : ct.scheduledDeparture,
        delayMinutes: ct.delayMinutes,
        status: ct.status,
        type: ct.type
      })),
      conflictCount: preferredEvaluation.conflictingTrains.length,
      isInsidePreferred: false,
      windowType: 'Alternative Window',
      preferredWindowStatus: 'No feasible block available within preferred window.',
      extensionBeyondPreferredMins: extensionMins,
      extensionDetail: extensionDetail,
      reason: `No feasible block available within preferred window (${preferred.label}) due to train conflict with ${conflictSummary}. Recommended Alternative Window: ${altStartFormatted} – ${altEndFormatted} IST (${extensionDetail}).`,
      adjacentLineRestrictions: altEval.adjacentLineRestrictions,
      powerBlock: altEval.powerBlock,
      liveDataAvailable: trainCorridorData.liveDataAvailable,
      liveStatusText: trainCorridorData.liveStatusText,
      timetableStatusText: trainCorridorData.timetableStatusText,
      dataSource: trainCorridorData.dataSource,
      liveUnavailableReason: trainCorridorData.liveUnavailableReason,
      evaluatedTrainCount: trains.length
    };
  }
}

module.exports = new BlockOptimizationService();
