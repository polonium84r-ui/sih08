/**
 * RailFlow Enterprise Backend Server
 * Node.js + Express REST API Server
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes');
const requestLogger = require('./middleware/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// 1. Enable CORS with configurable origins
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (config.corsOrigins.indexOf(origin) !== -1 || config.corsOrigins.includes('*') || config.nodeEnv === 'development') {
      return callback(null, true);
    }
    return callback(new Error('CORS origin blocked by RailFlow policy'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Body Parsing Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 3. Request Logging Middleware
app.use(requestLogger);

// 4. API Routes Mounting
app.use('/api', apiRoutes);

// 5. Root Info Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'RailFlow Enterprise API',
    version: '1.0.0-mvp',
    corridor: 'Southern Railway (SR) • Chennai, Salem, Tiruchirappalli & Madurai Divisions',
    endpoints: {
      health: '/api/health',
      blockEvaluation: '/api/v1/blocks/evaluate',
      corridors: '/api/v1/corridors/stations',
      telemetry: '/api/v1/telemetry/status',
      requisitions: '/api/v1/requisitions',
      config: '/api/v1/config',
      audit: '/api/v1/audit/logs'
    }
  });
});

// 6. 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// 7. Server Bootstrap
const db = require('./services/db');
const PORT = config.port || 5000;
const server = app.listen(PORT, async () => {
  console.log(`================================================================`);
  console.log(`  RailFlow Enterprise Backend Started on Port ${PORT}`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`  CORS Allowed Origins: ${config.corsOrigins.join(', ')}`);
  console.log(`  API Base: http://localhost:${PORT}/api/v1`);
  console.log(`================================================================`);
  await db.checkConnection();
});

module.exports = { app, server };

