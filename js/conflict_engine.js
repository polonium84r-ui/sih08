/**
 * RailFlow - Conflict Detection Engine
 * Evaluates spatial, temporal, priority, and electrical power interlocks for railway maintenance blocks.
 */

class ConflictEngine {
  constructor(corridorData) {
    this.data = corridorData;
  }

  /**
   * Converts HH:MM string to minutes from 00:00
   */
  timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }

  /**
   * Converts minutes from 00:00 to HH:MM string
   */
  minutesToTime(totalMinutes) {
    const norm = (totalMinutes % 1440 + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = norm % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /**
   * Evaluates conflicts for a proposed block window on a specific section.
   * @param {Object} blockWindow - { sectionId, track, startTime, endTime, requiresPowerBlock }
   * @returns {Object} Evaluation report containing detected conflicts, safety flags, and severity.
   */
  evaluateBlock(blockWindow) {
    const bStart = this.timeToMinutes(blockWindow.startTime);
    const bEnd = this.timeToMinutes(blockWindow.endTime);
    const section = this.data.sections.find(s => s.id === blockWindow.sectionId);
    
    const conflicts = [];
    const affectedTrains = [];
    let priorityConflictCount = 0;
    let totalEstimatedDelay = 0;

    // 1. Evaluate conflicts with scheduled trains
    this.data.trains.forEach(train => {
      // Find train traversal through this section
      // In this corridor: Station order is KUR (km 0) -> BAM (km 166)
      const stFrom = this.data.stations.find(s => s.code === section.from);
      const stTo = this.data.stations.find(s => s.code === section.to);

      const stopFrom = train.stops.find(s => s.station === section.from);
      const stopTo = train.stops.find(s => s.station === section.to);

      let tEnterMin = null;
      let tExitMin = null;

      if (stopFrom && stopTo) {
        tEnterMin = this.timeToMinutes(stopFrom.dep || stopFrom.arr);
        tExitMin = this.timeToMinutes(stopTo.arr || stopTo.dep);
      } else {
        // Interpolate entry and exit times based on first and last stops
        const firstStop = train.stops[0];
        const lastStop = train.stops[train.stops.length - 1];
        const tFirst = this.timeToMinutes(firstStop.dep || firstStop.arr);
        const tLast = this.timeToMinutes(lastStop.arr || lastStop.dep);
        
        const firstKm = this.data.stations.find(s => s.code === firstStop.station).km;
        const lastKm = this.data.stations.find(s => s.code === lastStop.station).km;
        const totalDist = Math.abs(lastKm - firstKm);
        const totalDuration = tLast >= tFirst ? (tLast - tFirst) : (tLast + 1440 - tFirst);

        const distFrom = Math.abs(stFrom.km - firstKm);
        const distTo = Math.abs(stTo.km - firstKm);

        tEnterMin = Math.round(tFirst + (distFrom / totalDist) * totalDuration);
        tExitMin = Math.round(tFirst + (distTo / totalDist) * totalDuration);
      }

      // Check temporal overlap:
      // Train enters section while block is active, or was inside section
      const hasTemporalOverlap = Math.max(bStart, tEnterMin) < Math.min(bEnd, tExitMin);

      if (hasTemporalOverlap) {
        // Train must be regulated at station prior to section entry
        const waitTimeMin = Math.max(0, bEnd - tEnterMin + 5); // 5 min safety clearance margin
        totalEstimatedDelay += waitTimeMin;

        const isPriorityConflict = train.priority <= 2;
        if (isPriorityConflict) {
          priorityConflictCount++;
        }

        affectedTrains.push({
          trainId: train.id,
          trainName: train.name,
          priority: train.priority,
          type: train.type,
          scheduledEntry: this.minutesToTime(tEnterMin),
          scheduledExit: this.minutesToTime(tExitMin),
          regulationDelayMin: waitTimeMin,
          heldAtStation: section.from,
          isPriorityConflict: isPriorityConflict
        });

        conflicts.push({
          type: isPriorityConflict ? "HIGH_PRIORITY_TRAIN" : "PASSENGER_REGULATION",
          severity: isPriorityConflict ? "CRITICAL" : "MEDIUM",
          message: `Train ${train.id} (${train.name}) blocked at ${section.from}. Required hold: ${waitTimeMin} mins.`,
          trainId: train.id
        });
      }
    });

    // 2. Evaluate adjacent line fouling rules & safety distance
    const requiresAdjacentLineCaution = blockWindow.track === "UP_MAIN" && blockWindow.machineryType?.includes("Tamping");
    if (requiresAdjacentLineCaution) {
      conflicts.push({
        type: "ADJACENT_LINE_SAFETY",
        severity: "INFO",
        message: "Heavy tamping machine on UP line requires 30 km/h Caution Order on adjacent DOWN line."
      });
    }

    // 3. Evaluate TRD Electrical Power Block interlock
    if (blockWindow.requiresPowerBlock && !blockWindow.powerBlockSynchronized) {
      conflicts.push({
        type: "OHE_POWER_INTERLOCK",
        severity: "WARNING",
        message: "OHE Power isolation permit required for track machines. Power block must be synchronized."
      });
    }

    return {
      sectionId: blockWindow.sectionId,
      sectionName: `${section.from} - ${section.to}`,
      blockStart: blockWindow.startTime,
      blockEnd: blockWindow.endTime,
      durationMin: bEnd - bStart,
      conflicts: conflicts,
      affectedTrains: affectedTrains,
      priorityConflictCount: priorityConflictCount,
      totalEstimatedDelayMin: totalEstimatedDelay,
      hasCriticalConflict: priorityConflictCount > 0,
      safetyScore: Math.max(10, 100 - (priorityConflictCount * 35) - (totalEstimatedDelay * 0.8))
    };
  }

  /**
   * Bundles multiple department requests into unified coordinated blocks.
   * @param {Array} requests - Array of department maintenance requests
   * @returns {Array} Array of bundled or standalone maintenance windows.
   */
  bundleRequests(requests) {
    // Group requests by section
    const sectionGroups = {};
    requests.forEach(req => {
      if (!sectionGroups[req.section]) {
        sectionGroups[req.section] = [];
      }
      sectionGroups[req.section].push(req);
    });

    const bundles = [];

    Object.keys(sectionGroups).forEach(secId => {
      const group = sectionGroups[secId];
      if (group.length > 1) {
        // Can be coordinated! Calculate envelope time
        let minStart = 1440;
        let maxEnd = 0;
        const depts = new Set();
        const reqIds = [];

        group.forEach(r => {
          const s = this.timeToMinutes(r.requestedWindow.start);
          const e = this.timeToMinutes(r.requestedWindow.end);
          if (s < minStart) minStart = s;
          if (e > maxEnd) maxEnd = e;
          depts.add(r.dept);
          reqIds.push(r.id);
        });

        bundles.push({
          type: "COORDINATED_MEGA_BLOCK",
          sectionId: secId,
          sectionName: group[0].sectionName,
          track: group[0].track,
          participatingDepts: Array.from(depts),
          bundledRequestIds: reqIds,
          optimalStart: this.minutesToTime(minStart),
          optimalEnd: this.minutesToTime(maxEnd),
          durationMin: maxEnd - minStart,
          efficiencyGain: `${group.length} closures unified into 1 coordinated window`
        });
      } else {
        bundles.push({
          type: "SINGLE_DEPARTMENT_BLOCK",
          sectionId: secId,
          sectionName: group[0].sectionName,
          track: group[0].track,
          participatingDepts: [group[0].dept],
          bundledRequestIds: [group[0].id],
          optimalStart: group[0].requestedWindow.start,
          optimalEnd: group[0].requestedWindow.end,
          durationMin: group[0].requiredDurationMin
        });
      }
    });

    return bundles;
  }
}

if (typeof window !== "undefined") {
  window.ConflictEngine = ConflictEngine;
}
