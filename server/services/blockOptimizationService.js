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
   * Generates candidate continuous windows of requested duration within search horizon
   * @param {Object} preferred { startMins, endMins, label }
   * @param {number} durationMin continuous duration in minutes
   * @param {number} searchHorizonMins total search horizon in minutes (default 1440 mins / 24h)
   * @param {number} stepMin search increment in minutes (default 15 mins)
   * @returns {Array} Array of candidate window objects
   */
  generateCandidateWindows(preferred, durationMin, searchHorizonMins = 1440, stepMin = 15) {
    const candidates = [];
    const minDayMins = 360; // 06:00 AM standard operational start
    const maxDayMins = Math.min(searchHorizonMins, 1440) - durationMin;
    const seenStartTimes = new Set();

    // 1. Inside preferred window candidates first
    for (let t = preferred.startMins; t + durationMin <= preferred.endMins; t += stepMin) {
      if (!seenStartTimes.has(t)) {
        seenStartTimes.add(t);
        candidates.push({
          startMins: t,
          endMins: t + durationMin,
          durationMin: durationMin,
          isInsidePreferred: true,
          startFormatted: this.minutesToTime(t),
          endFormatted: this.minutesToTime(t + durationMin)
        });
      }
    }

    // 2. Forward search after preferred window
    for (let t = preferred.endMins; t <= maxDayMins; t += stepMin) {
      if (!seenStartTimes.has(t)) {
        seenStartTimes.add(t);
        const endMins = t + durationMin;
        candidates.push({
          startMins: t,
          endMins: endMins,
          durationMin: durationMin,
          isInsidePreferred: false,
          startFormatted: this.minutesToTime(t),
          endFormatted: this.minutesToTime(endMins)
        });
      }
    }

    // 3. Backward search before preferred window across 24h search horizon
    for (let t = minDayMins; t < preferred.startMins; t += stepMin) {
      if (!seenStartTimes.has(t)) {
        seenStartTimes.add(t);
        const endMins = t + durationMin;
        candidates.push({
          startMins: t,
          endMins: endMins,
          durationMin: durationMin,
          isInsidePreferred: false,
          startFormatted: this.minutesToTime(t),
          endFormatted: this.minutesToTime(endMins)
        });
      }
    }

    return candidates;
  }

  /**
   * Evaluates if a candidate window has zero direct train conflicts and satisfies rules
   * @param {Object} candidate Candidate window object
   * @param {Array} trains Corridor trains list
   * @param {string} trackLine Requested track line
   * @param {string} blockType Requested block type
   * @param {string} activityName Maintenance activity
   * @param {string} machinery Machinery used
   * @param {Object} config Configurable operational parameters
   * @returns {Object} { feasible: boolean, evaluation: Object, conflicts: Array }
   */
  isCandidateFeasible(candidate, trains, trackLine, blockType, activityName = '', machinery = '', config = {}) {
    const evaluation = conflictDetector.evaluateWindowConflicts(
      candidate.startMins,
      candidate.endMins,
      trains,
      trackLine,
      blockType,
      activityName,
      machinery,
      config
    );

    const isFeasible = !evaluation.hasConflict && candidate.durationMin >= 0;

    return {
      feasible: isFeasible,
      evaluation: evaluation,
      conflicts: evaluation.conflictingTrains || []
    };
  }

  /**
   * Scores a candidate window for deterministic ranking according to Section 5:
   * Priority 1: Safety/Feasibility
   * Priority 2: Full continuous duration
   * Priority 3: Inside preferred window (true before false)
   * Priority 4: Minimum deviation/extension from preferred window
   * Priority 5: Minimum train disruption (fewer adjacent trains)
   * Priority 6: Earliest feasible time
   * @param {Object} candidate Candidate window
   * @param {Object} preferred Preferred window range
   * @param {number} requestedDuration Requested duration in minutes
   * @returns {Object} Scored candidate window object
   */
  scoreCandidateWindow(candidate, preferred, requestedDuration) {
    let deviationMins = 0;
    let extensionMins = 0;
    let extensionDetail = '';

    if (candidate.isInsidePreferred) {
      deviationMins = 0;
      extensionMins = 0;
      extensionDetail = 'Within requested preferred window';
    } else {
      if (candidate.endMins > preferred.endMins) {
        extensionMins = candidate.endMins - preferred.endMins;
        deviationMins = extensionMins;

        if (candidate.startMins >= preferred.endMins) {
          const startDiff = candidate.startMins - preferred.endMins;
          extensionDetail = `Starts ${startDiff}m after preferred window; extends until ${candidate.endFormatted} IST (${extensionMins}m beyond ${this.minutesToTime(preferred.endMins)} cutoff)`;
        } else {
          extensionDetail = `Extends ${extensionMins} minutes beyond preferred window (ends at ${candidate.endFormatted} IST instead of ${this.minutesToTime(preferred.endMins)} IST)`;
        }
      } else if (candidate.startMins < preferred.startMins) {
        extensionMins = preferred.startMins - candidate.startMins;
        deviationMins = extensionMins;
        extensionDetail = `Starts ${extensionMins} minutes before preferred window (at ${candidate.startFormatted} IST instead of ${this.minutesToTime(preferred.startMins)} IST)`;
      } else {
        deviationMins = 30;
        extensionDetail = 'Outside requested preferred window boundaries';
      }
    }

    const adjacentTrainCount = candidate.evaluation ? (candidate.evaluation.adjacentTrainCount || 0) : 0;

    return {
      ...candidate,
      deviationMins,
      extensionBeyondPreferredMins: extensionMins,
      extensionDetail,
      adjacentTrainCount
    };
  }

  /**
   * Deterministically ranks feasible candidate windows according to Section 5 priority rules
   * @param {Array} feasibleCandidates Feasible candidates
   * @param {Object} preferred Preferred window
   * @param {number} requestedDuration Requested duration
   * @returns {Array} Ranked candidate list
   */
  rankCandidateWindows(feasibleCandidates, preferred, requestedDuration) {
    const scored = feasibleCandidates.map(c => this.scoreCandidateWindow(c, preferred, requestedDuration));

    scored.sort((a, b) => {
      // 1. Inside preferred window first
      if (a.isInsidePreferred !== b.isInsidePreferred) {
        return a.isInsidePreferred ? -1 : 1;
      }
      // 2. Minimum deviation / distance from preferred window
      if (a.deviationMins !== b.deviationMins) {
        return a.deviationMins - b.deviationMins;
      }
      // 3. Minimum train disruption (fewer adjacent trains)
      if (a.adjacentTrainCount !== b.adjacentTrainCount) {
        return a.adjacentTrainCount - b.adjacentTrainCount;
      }
      // 4. Earliest feasible start time
      return a.startMins - b.startMins;
    });

    return scored;
  }

  /**
   * Selects best candidate from ranked list
   * @param {Array} rankedCandidates Ranked candidate list
   * @returns {Object|null} Top candidate
   */
  selectBestCandidate(rankedCandidates) {
    if (!rankedCandidates || rankedCandidates.length === 0) return null;
    return rankedCandidates[0];
  }

  /**
   * Main Block Recommendation Algorithm & Optimizer
   */
  findOptimalBlock(trainCorridorData, request) {
    const durationMin = parseInt(request.durationMin, 10) || 150;
    const trackLine = request.trackLine || 'UP Main Line';
    const blockType = request.blockType || 'UP Line Block';
    const activityName = request.activityName || request.workDesc || '';
    const machinery = request.machinery || '';
    const preferredWindowStr = request.preferredSlot || 'Midday Traffic Shadow (11:00–14:30)';
    const config = request.config || {
      headwayMinutes: request.headwayMinutes || request.headwayMarginMin,
      cautionSpeedKmH: request.cautionSpeedKmH || request.adjacentLineCautionSpeed
    };

    const preferred = this.parseWindowRange(preferredWindowStr);
    const trains = trainCorridorData.trains || [];

    // STEP 1: Search for candidate continuous windows across 24h evaluation horizon
    const rawCandidates = this.generateCandidateWindows(preferred, durationMin, 1440, 15);

    // STEP 2: Evaluate feasibility for each candidate window
    const feasibleCandidates = [];
    for (const cand of rawCandidates) {
      const feas = this.isCandidateFeasible(cand, trains, trackLine, blockType, activityName, machinery, config);
      if (feas.feasible) {
        feasibleCandidates.push({
          ...cand,
          evaluation: feas.evaluation
        });
      }
    }

    // STEP 3: Evaluate conflicts within the requested preferred window for explainability
    const preferredEvaluation = conflictDetector.evaluateWindowConflicts(
      preferred.startMins,
      preferred.endMins,
      trains,
      trackLine,
      blockType,
      activityName,
      machinery,
      config
    );

    // STEP 4: Rank candidates deterministically
    const rankedCandidates = this.rankCandidateWindows(feasibleCandidates, preferred, durationMin);
    const bestCandidate = this.selectBestCandidate(rankedCandidates);

    // STEP 5: Format conflicting train details for clear explanation
    const conflictDescriptions = preferredEvaluation.conflictingTrains.map((ct) => {
      const pTime = ct.passageTime ? `${ct.passageTime.entryTimeFormatted}–${ct.passageTime.exitTimeFormatted}` : (ct.scheduledDeparture || 'in window');
      const delayInfo = ct.delayMinutes > 0 ? ` (+${ct.delayMinutes}m delay)` : '';
      return `Train #${ct.trainNumber} (${ct.trainName} at ${pTime}${delayInfo})`;
    });

    const conflictSummary = conflictDescriptions.length > 0
      ? conflictDescriptions.join(', ')
      : 'train movements in corridor';

    // Top 2-3 alternatives (excluding the optimal primary candidate)
    const alternativeCandidates = rankedCandidates.slice(1, 4).map((alt, idx) => ({
      rank: idx + 2,
      recommendedBlock: `${alt.startFormatted} – ${alt.endFormatted} IST`,
      startMins: alt.startMins,
      endMins: alt.endMins,
      durationMin: alt.durationMin,
      isInsidePreferred: alt.isInsidePreferred,
      windowType: alt.isInsidePreferred ? 'Preferred Window' : 'Alternative Window',
      extensionBeyondPreferredMins: alt.extensionBeyondPreferredMins,
      extensionDetail: alt.extensionDetail,
      adjacentTrainCount: alt.adjacentTrainCount,
      reason: alt.isInsidePreferred
        ? (trainCorridorData.liveDataAvailable
            ? 'Feasible continuous block identified inside the preferred maintenance window without train disruption.'
            : 'Feasible continuous block identified using available timetable/demo data.')
        : `Alternative feasible window (${alt.extensionDetail}).`
    }));

    // If NO feasible candidate found anywhere in the search horizon:
    if (!bestCandidate) {
      return {
        status: 'NO FEASIBLE BLOCK FOUND',
        authorizationLevel: 'Decision Support Advisory Recommendation (Prototype Simulation — Statutory approval requires Chief Section Controller via COA)',
        requestedWindow: preferred.label,
        requestedDurationMin: durationMin,
        recommendedBlock: '--:-- – --:--',
        selectedCandidate: null,
        scheduledSlot: null,
        startMins: null,
        endMins: null,
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
        conflicts: preferredEvaluation.conflictingTrains,
        isInsidePreferred: false,
        windowType: 'No Feasible Window',
        preferredWindowStatus: 'No feasible block available within preferred window or 24h evaluation horizon.',
        extensionBeyondPreferredMins: 0,
        extensionDetail: 'No feasible slot available in corridor.',
        reason: `No feasible continuous block of ${durationMin} minutes could be found within the 24-hour evaluation horizon due to dense corridor traffic and train conflicts (${conflictSummary}).`,
        alternatives: [],
        adjacentLineRestrictions: 'Adjacent track subject to operational and safety restrictions.',
        powerBlock: preferredEvaluation.powerBlock,
        liveDataAvailable: trainCorridorData.liveDataAvailable,
        liveStatusText: trainCorridorData.liveStatusText,
        timetableStatusText: trainCorridorData.timetableStatusText,
        dataSource: trainCorridorData.dataSource,
        liveUnavailableReason: trainCorridorData.liveUnavailableReason,
        evaluatedTrainCount: trains.length
      };
    }

    // CASE A: Feasible Inside Preferred Window
    if (bestCandidate.isInsidePreferred) {
      return {
        status: 'OPTIMIZED BLOCK SCHEDULE – RECOMMENDED – PENDING CONTROLLER APPROVAL',
        authorizationLevel: 'Decision Support Advisory Recommendation (Prototype Simulation — Statutory approval requires Chief Section Controller via COA)',
        requestedWindow: preferred.label,
        requestedDurationMin: durationMin,
        recommendedBlock: `${bestCandidate.startFormatted} – ${bestCandidate.endFormatted} IST`,
        selectedCandidate: `${bestCandidate.startFormatted} – ${bestCandidate.endFormatted} IST`,
        scheduledSlot: `${bestCandidate.startFormatted} – ${bestCandidate.endFormatted} IST`,
        startMins: bestCandidate.startMins,
        endMins: bestCandidate.endMins,
        durationMin: durationMin,
        trackLine: trackLine,
        blockType: blockType,
        worksiteKmRange: request.worksiteKmRange || `${trainCorridorData.worksiteStartKm} – ${trainCorridorData.worksiteEndKm}`,
        conflictingTrains: [],
        conflicts: [],
        conflictCount: 0,
        isInsidePreferred: true,
        windowType: 'Preferred Window',
        preferredWindowStatus: 'FEASIBLE',
        extensionBeyondPreferredMins: 0,
        extensionDetail: 'Within requested preferred window',
        reason: trainCorridorData.liveDataAvailable
          ? 'Feasible continuous block identified inside the preferred maintenance window without train disruption.'
          : 'Feasible continuous block identified using available timetable/demo data.',
        alternatives: alternativeCandidates,
        adjacentLineRestrictions: bestCandidate.evaluation.adjacentLineRestrictions,
        powerBlock: bestCandidate.evaluation.powerBlock,
        liveDataAvailable: trainCorridorData.liveDataAvailable,
        liveStatusText: trainCorridorData.liveStatusText,
        timetableStatusText: trainCorridorData.timetableStatusText,
        dataSource: trainCorridorData.dataSource,
        liveUnavailableReason: trainCorridorData.liveUnavailableReason,
        evaluatedTrainCount: trains.length
      };
    }

    // CASE B: Not Feasible Inside Preferred Window -> Recommended Alternative Window
    return {
      status: 'OPTIMIZED BLOCK SCHEDULE – RECOMMENDED – PENDING CONTROLLER APPROVAL',
      authorizationLevel: 'Decision Support Advisory Recommendation (Prototype Simulation — Statutory approval requires Chief Section Controller via COA)',
      requestedWindow: preferred.label,
      requestedDurationMin: durationMin,
      recommendedBlock: `${bestCandidate.startFormatted} – ${bestCandidate.endFormatted} IST`,
      selectedCandidate: `${bestCandidate.startFormatted} – ${bestCandidate.endFormatted} IST`,
      scheduledSlot: `${bestCandidate.startFormatted} – ${bestCandidate.endFormatted} IST`,
      startMins: bestCandidate.startMins,
      endMins: bestCandidate.endMins,
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
      conflicts: preferredEvaluation.conflictingTrains,
      isInsidePreferred: false,
      windowType: 'Alternative Window',
      preferredWindowStatus: 'No feasible block available within preferred window.',
      extensionBeyondPreferredMins: bestCandidate.extensionBeyondPreferredMins,
      extensionDetail: bestCandidate.extensionDetail,
      reason: `No feasible block available within preferred window (${preferred.label}) due to train conflict with ${conflictSummary}. Recommended Alternative Window: ${bestCandidate.startFormatted} – ${bestCandidate.endFormatted} IST (${bestCandidate.extensionDetail}).`,
      alternatives: alternativeCandidates,
      adjacentLineRestrictions: bestCandidate.evaluation.adjacentLineRestrictions,
      powerBlock: bestCandidate.evaluation.powerBlock,
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
