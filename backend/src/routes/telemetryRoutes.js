const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');

router.get('/status', (req, res) => telemetryController.getStatus(req, res));
router.get('/trains', (req, res, next) => telemetryController.getTrainsBetween(req, res, next));
router.get('/trains/:trainNumber', (req, res, next) => telemetryController.getTrainSchedule(req, res, next));
router.get('/trains/:trainNumber/live', (req, res, next) => telemetryController.getLiveTrain(req, res, next));
router.get('/trains/:trainNumber/route', (req, res, next) => telemetryController.getTrainRouteGeometry(req, res, next));

module.exports = router;
