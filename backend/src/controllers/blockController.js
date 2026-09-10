/**
 * Block Optimization Controller
 */

const trainDataService = require('../services/trainDataService');
const blockOptimizationService = require('../services/blockOptimizationService');
const auditLogService = require('../services/auditLogService');

class BlockController {
  async evaluate(req, res, next) {
    try {
      const payload = req.validatedBlockRequest;

      // 1. Fetch corridor trains (RailRadar live or timetable fallback)
      const corridorData = await trainDataService.getCorridorTrains(
        payload.fromStation,
        payload.toStation,
        payload.worksiteKmRange,
        payload.trackLine,
        payload.worksiteStartKm,
        payload.worksiteEndKm
      );

      // 2. Compute optimal continuous block recommendation
      const result = blockOptimizationService.findOptimalBlock(corridorData, payload);

      // 3. Log decision in audit history and block decisions table
      auditLogService.logAction(
        'EVALUATE_BLOCK',
        payload.submittedBy || 'RailFlow Optimizer',
        `Evaluated block request for ${payload.fromStation}-${payload.toStation} (${payload.trackLine}, ${payload.worksiteKmRange}): ${result.status}`
      );

      const db = require('../services/db');
      await db.logBlockDecision({
        reqId: payload.reqId || payload.id || null,
        department: payload.department || null,
        corridor: `${payload.fromStation} - ${payload.toStation}`,
        requestedWindow: payload.preferredSlot || null,
        durationMin: payload.durationMin || null,
        selectedWindow: result.recommendedBlock || null,
        conflictsConsidered: result.conflictsSummary || result.summary || null,
        status: result.status || 'EVALUATED',
        dataSource: corridorData.dataSource || 'RailFlow Engine'
      });

      return res.status(200).json({
        success: true,
        result: result,
        corridorData: {
          fromStation: corridorData.fromStation,
          toStation: corridorData.toStation,
          fromKm: corridorData.fromKm,
          toKm: corridorData.toKm,
          sectionKmRange: corridorData.sectionKmRange,
          worksiteStartKm: corridorData.worksiteStartKm,
          worksiteEndKm: corridorData.worksiteEndKm,
          kmValidation: corridorData.kmValidation,
          liveDataAvailable: corridorData.liveDataAvailable,
          liveStatusText: corridorData.liveStatusText,
          timetableStatusText: corridorData.timetableStatusText,
          dataSource: corridorData.dataSource,
          liveUnavailableReason: corridorData.liveUnavailableReason,
          trainsCount: corridorData.trains.length,
          trains: corridorData.trains
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BlockController();
