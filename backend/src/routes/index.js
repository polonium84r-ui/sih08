/**
 * Main API Router
 * Sets up /api/v1 routes and preserves backward-compatible endpoints.
 */

const express = require('express');
const router = express.Router();

const blockRoutes = require('./blockRoutes');
const corridorRoutes = require('./corridorRoutes');
const telemetryRoutes = require('./telemetryRoutes');
const requisitionRoutes = require('./requisitionRoutes');
const configRoutes = require('./configRoutes');
const auditRoutes = require('./auditRoutes');

const blockController = require('../controllers/blockController');
const telemetryController = require('../controllers/telemetryController');
const { validateBlockEvaluationRequest } = require('../middleware/validator');

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'RailFlow Enterprise API',
    timestamp: new Date().toISOString()
  });
});

// Versioned API v1 Endpoints
router.use('/v1/blocks', blockRoutes);
router.use('/v1/corridors', corridorRoutes);
router.use('/v1/telemetry', telemetryRoutes);
router.use('/v1/requisitions', requisitionRoutes);
router.use('/v1/config', configRoutes);
router.use('/v1/audit', auditRoutes);

// Compatibility aliases for prototype endpoints
router.post('/block-planning/evaluate', validateBlockEvaluationRequest, (req, res, next) => {
  blockController.evaluate(req, res, next);
});

router.get('/telemetry/status', (req, res) => {
  telemetryController.getStatus(req, res);
});

module.exports = router;
