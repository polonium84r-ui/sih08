/**
 * RailFlow - Delay Cascade Simulator
 * Simulates primary and secondary (knock-on) delay propagation through corridor sections and loop lines.
 */

class CascadeSimulator {
  constructor(corridorData) {
    this.data = corridorData;
    this.headwayMarginMin = 12; // Minimum signaling headway between successive trains in block section
  }

  timeToMin(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }

  minToTime(min) {
    const norm = (min % 1440 + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = norm % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /**
   * Runs delay cascade propagation for a given maintenance block window.
   * @param {Object} block - { sectionId, startTime, endTime }
   * @returns {Object} Simulation results including primary delays, cascading domino delays, and total impact.
   */
  simulateCascade(block) {
    const bStart = this.timeToMin(block.startTime);
    const bEnd = this.timeToMin(block.endTime);
    const targetSection = this.data.sections.find(s => s.id === block.sectionId);

    // Deep clone trains array to compute adjusted timetables
    const simulatedTrains = this.data.trains.map(t => ({
      ...t,
      stops: t.stops.map(st => ({ ...st })),
      originalStops: t.stops.map(st => ({ ...st })),
      primaryDelayMin: 0,
      cascadeDelayMin: 0,
      totalDelayMin: 0,
      delayReason: null
    }));

    // Find chronological entry order for trains reaching the blocked section
    const trainEntries = [];
    simulatedTrains.forEach(train => {
      const stopFrom = train.stops.find(s => s.station === targetSection.from);
      const stopTo = train.stops.find(s => s.station === targetSection.to);
      
      let entryTimeMin = 0;
      let exitTimeMin = 0;

      if (stopFrom && stopTo) {
        entryTimeMin = this.timeToMin(stopFrom.dep || stopFrom.arr);
        exitTimeMin = this.timeToMin(stopTo.arr || stopTo.dep);
      } else {
        // Linear interpolation across corridor
        const first = train.stops[0];
        const last = train.stops[train.stops.length - 1];
        const t1 = this.timeToMin(first.dep || first.arr);
        const t2 = this.timeToMin(last.arr || last.dep);
        const st1 = this.data.stations.find(s => s.code === first.station);
        const st2 = this.data.stations.find(s => s.code === last.station);
        const sFrom = this.data.stations.find(s => s.code === targetSection.from);
        const sTo = this.data.stations.find(s => s.code === targetSection.to);

        const fracFrom = Math.abs(sFrom.km - st1.km) / Math.abs(st2.km - st1.km);
        const fracTo = Math.abs(sTo.km - st1.km) / Math.abs(st2.km - st1.km);
        const duration = t2 >= t1 ? (t2 - t1) : (t2 + 1440 - t1);

        entryTimeMin = Math.round(t1 + fracFrom * duration);
        exitTimeMin = Math.round(t1 + fracTo * duration);
      }

      trainEntries.push({
        train: train,
        schedEntry: entryTimeMin,
        schedExit: exitTimeMin,
        origEntry: entryTimeMin,
        origExit: exitTimeMin
      });
    });

    // Sort by scheduled section entry time
    trainEntries.sort((a, b) => a.schedEntry - b.schedEntry);

    const cascadeChain = [];
    let previousSectionClearTime = bEnd; // Initially, section clears when block window ends

    // Simulate propagation
    trainEntries.forEach(item => {
      const tr = item.train;
      const schedEntry = item.schedEntry;
      const nominalSectionTransitTime = Math.max(15, item.schedExit - item.schedEntry);

      // Case 1: Train scheduled during active block -> Primary Delay
      if (schedEntry >= bStart && schedEntry < bEnd) {
        const actualEntry = bEnd + 5; // Enters 5 mins after block clearance
        const primaryDelay = actualEntry - schedEntry;
        tr.primaryDelayMin = primaryDelay;
        tr.totalDelayMin = primaryDelay;
        tr.delayReason = `Primary block regulation at ${targetSection.from} (Block window ${block.startTime} - ${block.endTime})`;

        previousSectionClearTime = actualEntry + nominalSectionTransitTime;

        cascadeChain.push({
          step: cascadeChain.length + 1,
          type: "PRIMARY_BLOCK_HOLD",
          trainId: tr.id,
          trainName: tr.name,
          priority: tr.priority,
          station: targetSection.from,
          scheduledEntry: this.minToTime(schedEntry),
          actualEntry: this.minToTime(actualEntry),
          delayMin: primaryDelay,
          description: `Held at loop until block clearance. Primary delay: +${primaryDelay} min.`
        });
      }
      // Case 2: Train scheduled after block, but prior train is still occupying section/headway -> Knock-on Cascade Delay!
      else if (schedEntry >= bEnd && schedEntry < previousSectionClearTime + this.headwayMarginMin) {
        const actualEntry = previousSectionClearTime + this.headwayMarginMin;
        const cascadeDelay = actualEntry - schedEntry;
        tr.cascadeDelayMin = cascadeDelay;
        tr.totalDelayMin = cascadeDelay;
        tr.delayReason = `Knock-on headway conflict behind preceding train at ${targetSection.from}`;

        previousSectionClearTime = actualEntry + nominalSectionTransitTime;

        cascadeChain.push({
          step: cascadeChain.length + 1,
          type: "CASCADING_KNOCK_ON",
          trainId: tr.id,
          trainName: tr.name,
          priority: tr.priority,
          station: targetSection.from,
          scheduledEntry: this.minToTime(schedEntry),
          actualEntry: this.minToTime(actualEntry),
          delayMin: cascadeDelay,
          description: `Delayed due to section queue / safety headway margin. Cascade delay: +${cascadeDelay} min.`
        });
      } else {
        // Clean passage without delay
        if (schedEntry >= bEnd) {
          previousSectionClearTime = schedEntry + nominalSectionTransitTime;
        }
      }
    });

    // Compute aggregates
    const totalPrimaryDelay = simulatedTrains.reduce((acc, t) => acc + t.primaryDelayMin, 0);
    const totalCascadeDelay = simulatedTrains.reduce((acc, t) => acc + t.cascadeDelayMin, 0);
    const totalDelay = totalPrimaryDelay + totalCascadeDelay;
    const affectedTrainsCount = simulatedTrains.filter(t => t.totalDelayMin > 0).length;
    const priorityConflictsCount = simulatedTrains.filter(t => t.totalDelayMin > 0 && t.priority <= 2).length;

    // Corridor punctuality index (baseline 100%, 1 delay minute across corridor loses ~0.5%)
    const punctualityScore = Math.max(0, Math.min(100, Math.round(100 - (totalDelay * 0.45) - (priorityConflictsCount * 12))));

    // Recovery time: how long after block clearance until corridor runs on timetable
    const corridorRecoveryTime = previousSectionClearTime > bEnd ? this.minToTime(previousSectionClearTime + 20) : block.endTime;

    return {
      blockStart: block.startTime,
      blockEnd: block.endTime,
      durationMin: bEnd - bStart,
      sectionId: block.sectionId,
      totalDelayMin: totalDelay,
      primaryDelayMin: totalPrimaryDelay,
      cascadeDelayMin: totalCascadeDelay,
      affectedTrainsCount: affectedTrainsCount,
      priorityConflictsCount: priorityConflictsCount,
      punctualityScore: punctualityScore,
      corridorRecoveryTime: corridorRecoveryTime,
      cascadeChain: cascadeChain,
      simulatedTrains: simulatedTrains
    };
  }
}

if (typeof window !== "undefined") {
  window.CascadeSimulator = CascadeSimulator;
}
