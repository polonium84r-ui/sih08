const express = require('express');
const router = express.Router();
const requisitionController = require('../controllers/requisitionController');

router.get('/', (req, res) => requisitionController.getRequisitions(req, res));
router.get('/:id', (req, res) => requisitionController.getRequisitionById(req, res));
router.post('/', (req, res) => requisitionController.createRequisition(req, res));

module.exports = router;
