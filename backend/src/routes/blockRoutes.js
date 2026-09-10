const express = require('express');
const router = express.Router();
const blockController = require('../controllers/blockController');
const { validateBlockEvaluationRequest } = require('../middleware/validator');

router.post('/evaluate', validateBlockEvaluationRequest, (req, res, next) => {
  blockController.evaluate(req, res, next);
});

module.exports = router;
