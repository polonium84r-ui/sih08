/**
 * Request Validation Middleware
 */

const trainDataService = require('../services/trainDataService');

function validateLineBlockCompatibility(line, block) {
  if (line === 'UP Main Line') {
    return block === 'UP Line Block';
  }
  if (line === 'DOWN Main Line') {
    return block === 'DOWN Line Block';
  }
  if (line === 'Both UP & DOWN Lines') {
    return block === 'Both Lines Block (Simultaneous)';
  }
  if (line === 'Station Loop / Yard Track') {
    return block === 'Station Loop / Yard Track Block';
  }
  return false;
}

function validateBlockEvaluationRequest(req, res, next) {
  const payload = req.body || {};
  const fromStation = payload.fromStation || 'KPD';
  const toStation = payload.toStation || 'JTJ';
  const trackLine = payload.trackLine || 'UP Main Line';
  const blockType = payload.blockType || 'UP Line Block';
  const worksiteStartKm = payload.worksiteStartKm !== undefined && payload.worksiteStartKm !== null && payload.worksiteStartKm !== '' ? payload.worksiteStartKm : null;
  const worksiteEndKm = payload.worksiteEndKm !== undefined && payload.worksiteEndKm !== null && payload.worksiteEndKm !== '' ? payload.worksiteEndKm : null;
  const worksiteKmRange = payload.worksiteKmRange || (worksiteStartKm !== null && worksiteEndKm !== null ? `KM ${parseFloat(worksiteStartKm).toFixed(2)} – KM ${parseFloat(worksiteEndKm).toFixed(2)}` : 'KM 129.50 – KM 180.00');

  // 1. Line & Block Type compatibility
  if (!validateLineBlockCompatibility(trackLine, blockType)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_LINE_BLOCK_TYPE',
        message: 'Track Line and Block Type are inconsistent.'
      }
    });
  }

  // 2. Worksite KM range boundary check
  const kmValidation = trainDataService.validateWorksiteKmRange(
    fromStation,
    toStation,
    worksiteStartKm !== null ? worksiteStartKm : worksiteKmRange,
    worksiteEndKm
  );

  if (!kmValidation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_WORKSITE_KM',
        message: kmValidation.error || 'Worksite KM range is outside allowable section boundaries.'
      },
      validation: kmValidation
    });
  }

  // Attach sanitized params
  req.validatedBlockRequest = {
    ...payload,
    fromStation,
    toStation,
    trackLine,
    blockType,
    worksiteStartKm: kmValidation.startKm,
    worksiteEndKm: kmValidation.endKm,
    worksiteKmRange: kmValidation.formattedRange || worksiteKmRange,
    kmValidation
  };

  next();
}

module.exports = {
  validateLineBlockCompatibility,
  validateBlockEvaluationRequest
};
