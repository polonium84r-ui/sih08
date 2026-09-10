/**
 * Requisition Controller
 */

const db = require('../services/db');

class RequisitionController {
  async getRequisitions(req, res, next) {
    try {
      const corridor = req.query.corridor;
      const list = await db.getRequisitions(corridor);

      return res.status(200).json({
        success: true,
        count: list.length,
        requisitions: list
      });
    } catch (err) {
      next(err);
    }
  }

  async getRequisitionById(req, res, next) {
    try {
      const id = req.params.id;
      const item = await db.getRequisitionById(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Requisition ${id} not found.` }
        });
      }
      return res.status(200).json({
        success: true,
        requisition: item
      });
    } catch (err) {
      next(err);
    }
  }

  async createRequisition(req, res, next) {
    try {
      const data = req.body;
      if (!data.department || !data.fromStation || !data.toStation) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Missing required requisition fields.' }
        });
      }

      const newReq = await db.createRequisition(data);

      await db.logAudit(
        'CREATE_REQUISITION',
        data.submittedBy || 'Field Engineer',
        `Submitted ${newReq.id} (${newReq.department}, ${newReq.fromStation}-${newReq.toStation})`
      );

      return res.status(201).json({
        success: true,
        requisition: newReq
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RequisitionController();

