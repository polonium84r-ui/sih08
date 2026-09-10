/**
 * Telemetry Controller
 */

const railRadarService = require('../services/railRadarService');

class TelemetryController {
  getStatus(req, res) {
    const hasKey = !!railRadarService.getApiKey();
    return res.status(200).json({
      success: true,
      apiKeyConfigured: hasKey,
      endpoint: 'https://api.railradar.in/v1',
      defaultCorridor: 'Katpadi Junction (KPD) - Jolarpettai Junction (JTJ)',
      status: hasKey ? 'ONLINE' : 'FALLBACK_MOCK'
    });
  }

  async getTrainsBetween(req, res, next) {
    try {
      const from = (req.query.from || 'KPD').toUpperCase();
      const to = (req.query.to || 'JTJ').toUpperCase();
      const live = req.query.live !== 'false';

      const result = await railRadarService.getTrainsBetweenStations(from, to, { live });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getLiveTrain(req, res, next) {
    try {
      const trainNo = req.params.trainNumber;
      const result = await railRadarService.getLiveTrainStatus(trainNo, {
        date: req.query.date,
        authoritative: req.query.authoritative === 'true',
        haltsOnly: req.query.haltsOnly === 'true'
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getTrainSchedule(req, res, next) {
    try {
      const trainNo = req.params.trainNumber;
      const haltsOnly = req.query.haltsOnly === 'true';
      const result = await railRadarService.getTrainSchedule(trainNo, { haltsOnly });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getTrainRouteGeometry(req, res, next) {
    try {
      const trainNo = req.params.trainNumber;
      const format = req.query.format || 'geojson';
      const stops = req.query.stops !== 'false';
      const result = await railRadarService.getTrainRouteGeometry(trainNo, { format, stops });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TelemetryController();
