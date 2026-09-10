/**
 * Corridor & Network Metadata Controller
 */

const db = require('../services/db');
const corridorData = require('../data/corridorData');

class CorridorController {
  async getStations(req, res, next) {
    try {
      const stations = await db.getStations();
      return res.status(200).json({
        success: true,
        stations: stations || []
      });
    } catch (err) {
      next(err);
    }
  }

  async getSections(req, res, next) {
    try {
      const sections = await db.getSections();
      return res.status(200).json({
        success: true,
        sections: sections || []
      });
    } catch (err) {
      next(err);
    }
  }

  getCorridorTelemetry(req, res) {
    const from = (req.query.from || 'KPD').toUpperCase();
    const to = (req.query.to || 'JTJ').toUpperCase();
    const telemetry = corridorData.getCorridorTelemetry ? corridorData.getCorridorTelemetry(from, to) : null;

    return res.status(200).json({
      success: true,
      from,
      to,
      telemetry: telemetry || {
        corridorBadge: `Southern Railway — ${from}–${to}`,
        trainsCount: 0,
        runningTrains: [],
        delayedTrains: [],
        activeConflicts: []
      }
    });
  }

  getChainage(req, res) {
    const from = (req.query.from || 'KPD').toUpperCase();
    const to = (req.query.to || 'JTJ').toUpperCase();
    const sectionKm = corridorData.getSectionKmRange ? corridorData.getSectionKmRange(from, to) : null;

    return res.status(200).json({
      success: true,
      sectionKm
    });
  }
}

module.exports = new CorridorController();
