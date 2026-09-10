/**
 * Configuration Controller
 */

const db = require('../services/db');
const rulesEngine = require('../services/rulesEngine');

class ConfigController {
  async getConfig(req, res, next) {
    try {
      const currentConfig = await db.getConfig();
      return res.status(200).json({
        success: true,
        config: currentConfig,
        rules: rulesEngine.listRules()
      });
    } catch (err) {
      next(err);
    }
  }

  async updateConfig(req, res, next) {
    try {
      const updatedConfig = await db.updateConfig(req.body || {});

      return res.status(200).json({
        success: true,
        message: 'Operational configuration updated successfully.',
        config: updatedConfig
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ConfigController();

