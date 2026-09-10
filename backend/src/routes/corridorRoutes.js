const express = require('express');
const router = express.Router();
const corridorController = require('../controllers/corridorController');

router.get('/stations', (req, res) => corridorController.getStations(req, res));
router.get('/sections', (req, res) => corridorController.getSections(req, res));
router.get('/chainage', (req, res) => corridorController.getChainage(req, res));
router.get('/telemetry', (req, res) => corridorController.getCorridorTelemetry(req, res));

module.exports = router;
