const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

router.get('/', (req, res) => configController.getConfig(req, res));
router.post('/', (req, res) => configController.updateConfig(req, res));
router.put('/', (req, res) => configController.updateConfig(req, res));

module.exports = router;
