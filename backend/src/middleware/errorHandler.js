/**
 * Centralized Error Handling Middleware
 */

function errorHandler(err, req, res, next) {
  console.error(`[RailFlow Error] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'SERVER_ERROR';
  const errorMessage = err.message || 'An unexpected internal server error occurred.';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
