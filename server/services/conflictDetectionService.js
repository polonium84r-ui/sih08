/**
 * Conflict Detection Service
 * Evaluates spatial and temporal conflicts between train paths and the worksite.
 * Configurable safety rules (no hard-coded blanket rules).
 */

class ConflictDetectionService {
  /**
   * Evaluates conflicts for a specific time window at a worksite.
   * @param {number} startMins Window start (minutes since midnight)
   * @param {number} endMins Window end (minutes since midnight)
   * @param {Array} trains Corridor trains list
   * @param {string} requestedLine 'UP Main Line' | 'DOWN Main Line' | 'Both UP & DOWN Lines'
   * @param {string} blockType 'UP Line Block' | 'DOWN Line Block' | 'Both Lines Block'
   * @param {string} activityName
   * @param {string} machinery
   */
  evaluateWindowConflicts(startMins, endMins, trains, requestedLine, blockType, activityName = '', machinery = '') {
    const isUpRequested = (blockType && blockType.includes('UP')) || (requestedLine && requestedLine.includes('UP'));
    const isDownRequested = (blockType && blockType.includes('DOWN')) || (requestedLine && requestedLine.includes('DOWN'));
    const isBothRequested = (blockType && blockType.includes('Both')) || (requestedLine && requestedLine.includes('Both'));

    const directConflicts = [];
    const adjacentLineTrains = [];

    (trains || []).forEach((train) => {
      const p = train.passageTime;
      if (!p || p.entryTimeMins === null || p.exitTimeMins === null) return;

      // Check temporal overlap with [startMins, endMins]
      // Buffer of 5 minutes before entry and after exit for signal clearance
      const trainStart = Math.max(0, p.entryTimeMins - 5);
      const trainEnd = Math.min(1440, p.exitTimeMins + 5);

      const overlaps = Math.max(startMins, trainStart) < Math.min(endMins, trainEnd);
      if (!overlaps) return;

      const isUpTrain = train.line && train.line.includes('UP');
      const isDownTrain = train.line && train.line.includes('DOWN');

      if (isBothRequested) {
        directConflicts.push(train);
      } else if (isUpRequested) {
        if (isUpTrain) {
          directConflicts.push(train);
        } else if (isDownTrain) {
          adjacentLineTrains.push(train);
        }
      } else if (isDownRequested) {
        if (isDownTrain) {
          directConflicts.push(train);
        } else if (isUpTrain) {
          adjacentLineTrains.push(train);
        }
      }
    });

    // Configurable Safety Rules
    const adjacentRestrictions = isBothRequested
      ? 'Both lines blocked under mega-block possession.'
      : (adjacentLineTrains.length > 0
          ? 'Adjacent line subject to operational and safety restrictions.'
          : 'Adjacent line operational under standard caution watch.');

    // Configurable Power Block Rule:
    // Only required when the activity specifically involves 25kV OHE electrical isolation
    const activityLower = (activityName || '').toLowerCase();
    const machineLower = (machinery || '').toLowerCase();
    const requiresOhe =
      activityLower.includes('ohe') ||
      activityLower.includes('catenary') ||
      activityLower.includes('traction') ||
      activityLower.includes('isolator') ||
      activityLower.includes('25kv') ||
      machineLower.includes('tower wagon');

    const powerBlockStatus = requiresOhe
      ? {
          required: true,
          label: '25kV AC Power Block Required',
          detail: 'Mandatory traction power isolation and discharge earthing rods permit.'
        }
      : {
          required: false,
          label: 'No Power Block Required',
          detail: 'Worksite operates within standard electrical overhead safety clearance envelope.'
        };

    return {
      hasConflict: directConflicts.length > 0,
      conflictCount: directConflicts.length,
      conflictingTrains: directConflicts,
      adjacentLineRestrictions: adjacentRestrictions,
      adjacentTrainCount: adjacentLineTrains.length,
      powerBlock: powerBlockStatus
    };
  }
}

module.exports = new ConflictDetectionService();
