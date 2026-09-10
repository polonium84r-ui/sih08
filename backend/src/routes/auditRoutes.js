const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

router.get('/logs', (req, res) => auditController.getLogs(req, res));
router.post('/sanction-memo', (req, res) => auditController.generateSanctionMemo(req, res));

module.exports = router;
