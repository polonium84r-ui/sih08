/**
 * RailFlow - Multi-Candidate Window Recommender
 * Generates alternative maintenance slots, evaluates operational trade-offs, and provides explainable reasoning.
 */

class WindowRecommender {
  constructor(corridorData, cascadeSimulator, conflictEngine) {
    this.data = corridorData;
    this.simulator = cascadeSimulator;
    this.conflictEngine = conflictEngine;
  }

  /**
   * Generates and ranks candidate maintenance windows for a target section.
   * @param {string} sectionId - Target corridor section ID
   * @param {number} requiredDurationMin - Duration required for bundled maintenance
   * @returns {Array} Array of evaluated and scored candidate window options.
   */
  generateCandidates(sectionId = "SEC-3", requiredDurationMin = 180) {
    // Define candidate strategy templates
    const rawOptions = [
      {
        id: "CANDIDATE-A",
        label: "Option A (Night Maintenance Window)",
        startTime: "01:30",
        endTime: "04:30",
        strategy: "NIGHT_TRAFFIC_TROUGH",
        pros: ["Zero conflicts with daytime passenger & superfast trains", "Minimal overall passenger delay impact", "Optimal for heavy track tamping & power block"],
        cons: ["Requires high-intensity mobile floodlighting", "Cold working conditions for gangmen"],
        gangSafetyScore: 82,
        bundlingCapacity: "Full (Civil + S&T + TRD Power Block)"
      },
      {
        id: "CANDIDATE-B",
        label: "Option B (Integrated Shadow Block)",
        startTime: "12:15",
        endTime: "14:45",
        strategy: "DAYLIGHT_SHADOW_SLOT",
        pros: ["Leverages natural freight gap between Superfast schedules", "Optimal natural daylight visibility for S&T micro-inspection", "Coordinated single-window closure"],
        cons: ["Minor regulation of 1 passenger train (08442 held by ~18 mins)", "Requires active caution order on adjacent track"],
        gangSafetyScore: 96,
        bundlingCapacity: "Full (Civil + S&T + TRD Power Block)"
      },
      {
        id: "CANDIDATE-C",
        label: "Option C (Late Afternoon Slot)",
        startTime: "15:00",
        endTime: "17:30",
        strategy: "AFTERNOON_WINDOW",
        pros: ["Clear of morning peak office commuters", "Full track equipment readiness"],
        cons: ["Borderline risk of fouling evening express arrivals", "High ambient temperature for rail distress monitoring"],
        gangSafetyScore: 88,
        bundlingCapacity: "Partial (Civil + S&T only; TRD delayed)"
      }
    ];

    const evaluatedCandidates = rawOptions.map(opt => {
      const simResult = this.simulator.simulateCascade({
        sectionId: sectionId,
        startTime: opt.startTime,
        endTime: opt.endTime
      });

      const conflictResult = this.conflictEngine.evaluateBlock({
        sectionId: sectionId,
        track: "UP_MAIN",
        startTime: opt.startTime,
        endTime: opt.endTime,
        requiresPowerBlock: true,
        powerBlockSynchronized: true
      });

      // Composite Scoring Algorithm (0 - 100)
      // High score = best recommendation
      const delayPenalty = Math.min(40, (simResult.totalDelayMin / 60) * 20);
      const priorityPenalty = simResult.priorityConflictsCount * 35;
      const punctualityBonus = (simResult.punctualityScore / 100) * 35;
      const gangBonus = (opt.gangSafetyScore / 100) * 15;
      const bundlingBonus = opt.bundlingCapacity.includes("Full") ? 15 : 5;

      const overallScore = Math.max(10, Math.min(99, Math.round(
        punctualityBonus + gangBonus + bundlingBonus - delayPenalty - priorityPenalty
      )));

      return {
        ...opt,
        simResult: simResult,
        conflictResult: conflictResult,
        totalDelayMin: simResult.totalDelayMin,
        priorityConflicts: simResult.priorityConflictsCount,
        punctualityScore: simResult.punctualityScore,
        affectedTrains: simResult.affectedTrainsCount,
        overallScore: overallScore,
        isRecommended: false // will flag highest below
      };
    });

    // Sort by overall score descending
    evaluatedCandidates.sort((a, b) => b.overallScore - a.overallScore);
    if (evaluatedCandidates.length > 0) {
      evaluatedCandidates[0].isRecommended = true;
    }

    return evaluatedCandidates;
  }
}

if (typeof window !== "undefined") {
  window.WindowRecommender = WindowRecommender;
}
