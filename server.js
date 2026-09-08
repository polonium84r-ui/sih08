/**
 * RailFlow Local Development & API Server
 * Zero-dependency Node.js HTTP server integrating RailRadar telemetry.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Lightweight .env loader (zero external dependencies)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    });
  } catch (e) {
    console.warn('[RailFlow] Warning: Could not read .env file:', e.message);
  }
}

// Import backend services
const trainDataService = require('./server/services/trainDataService');
const blockOptimizationService = require('./server/services/blockOptimizationService');
const railRadarService = require('./server/services/railRadarService');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // =========================================================================
  // API ROUTE 1: Evaluate Block Planning Request
  // POST /api/block-planning/evaluate
  // =========================================================================
  if (pathname === '/api/block-planning/evaluate' && req.method === 'POST') {
    let bodyData = '';
    req.on('data', (chunk) => {
      bodyData += chunk;
      // Protect from body flood (> 1MB)
      if (bodyData.length > 1e6) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyData || '{}');

        const fromStation = payload.fromStation || 'KPD';
        const toStation = payload.toStation || 'JTJ';
        const trackLine = payload.trackLine || 'UP Main Line';
        const blockType = payload.blockType || 'UP Line Block';
        const worksiteStartKm = payload.worksiteStartKm !== undefined && payload.worksiteStartKm !== null && payload.worksiteStartKm !== '' ? payload.worksiteStartKm : null;
        const worksiteEndKm = payload.worksiteEndKm !== undefined && payload.worksiteEndKm !== null && payload.worksiteEndKm !== '' ? payload.worksiteEndKm : null;
        const worksiteKmRange = payload.worksiteKmRange || (worksiteStartKm !== null && worksiteEndKm !== null ? `KM ${parseFloat(worksiteStartKm).toFixed(2)} – KM ${parseFloat(worksiteEndKm).toFixed(2)}` : 'KM 129.50 – KM 180.00');

        // 1. Strict backend Line & Block Type compatibility validation
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

        if (!validateLineBlockCompatibility(trackLine, blockType)) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: 'INVALID_LINE_BLOCK_TYPE',
              message: 'Track Line and Block Type are inconsistent.'
            }
          });
        }

        // 2. Strict backend chainage & worksite validation
        const kmValidation = trainDataService.validateWorksiteKmRange(
          fromStation,
          toStation,
          worksiteStartKm !== null ? worksiteStartKm : worksiteKmRange,
          worksiteEndKm
        );

        if (!kmValidation.valid) {
          return sendJson(res, 400, {
            success: false,
            error: {
              code: 'INVALID_WORKSITE_KM',
              message: kmValidation.error || 'Worksite KM range is outside allowable section boundaries.'
            },
            validation: kmValidation
          });
        }

        // 2. Fetch train corridor data via TrainDataService (RailRadar or fallback)
        const corridorData = await trainDataService.getCorridorTrains(
          fromStation,
          toStation,
          worksiteKmRange,
          trackLine,
          worksiteStartKm,
          worksiteEndKm
        );

        // 3. Compute optimal continuous block recommendation
        const result = blockOptimizationService.findOptimalBlock(corridorData, payload);

        return sendJson(res, 200, {
          success: true,
          result: result,
          corridorData: {
            fromStation: corridorData.fromStation,
            toStation: corridorData.toStation,
            fromKm: corridorData.fromKm,
            toKm: corridorData.toKm,
            sectionKmRange: corridorData.sectionKmRange,
            worksiteStartKm: corridorData.worksiteStartKm,
            worksiteEndKm: corridorData.worksiteEndKm,
            kmValidation: corridorData.kmValidation,
            liveDataAvailable: corridorData.liveDataAvailable,
            liveStatusText: corridorData.liveStatusText,
            timetableStatusText: corridorData.timetableStatusText,
            dataSource: corridorData.dataSource,
            liveUnavailableReason: corridorData.liveUnavailableReason,
            trainsCount: corridorData.trains.length,
            trains: corridorData.trains
          }
        });
      } catch (err) {
        return sendJson(res, 500, {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: `Internal error evaluating block request: ${err.message}`
          }
        });
      }
    });
    return;
  }

  // =========================================================================
  // API ROUTE 2: Telemetry & API Key Status
  // GET /api/telemetry/status
  // =========================================================================
  if (pathname === '/api/telemetry/status' && req.method === 'GET') {
    const hasKey = !!railRadarService.getApiKey();
    return sendJson(res, 200, {
      success: true,
      apiKeyConfigured: hasKey,
      endpoint: 'https://api.railradar.in/v1',
      defaultCorridor: 'Katpadi Junction (KPD) - Jolarpettai Junction (JTJ)'
    });
  }

  // =========================================================================
  // STATIC ASSET SERVER
  // =========================================================================
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  RailFlow Command Center Server Started`);
  console.log(`  Access the application at: http://localhost:${PORT}`);
  console.log(`  Corridor: Southern Railway • Chennai - Coimbatore - Madurai (SR)`);
  console.log(`  RailRadar Integration: Active on /api/block-planning/evaluate`);
  console.log(`=======================================================`);
});
