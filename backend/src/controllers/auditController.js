/**
 * Audit & Sanction Memo Controller
 */

const db = require('../services/db');
const auditLogService = require('../services/auditLogService');

class AuditController {
  async getLogs(req, res, next) {
    try {
      const logs = await db.getAuditLogs();
      return res.status(200).json({
        success: true,
        count: logs.length,
        logs
      });
    } catch (err) {
      next(err);
    }
  }

  generateSanctionMemo(req, res) {
    const candidate = req.body.candidate;
    const controllerName = req.body.controllerName;
    const memo = auditLogService.generateSanctionMemo(candidate, controllerName);

    return res.status(200).json({
      success: true,
      memo
    });
  }
}

module.exports = new AuditController();
