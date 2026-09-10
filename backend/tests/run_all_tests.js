/**
 * RailFlow Backend Test Suite Runner
 * Runs all unit and integration tests against backend services and routes.
 */

const assert = require('assert');
const http = require('http');

// Set test port
process.env.PORT = '5055';
process.env.NODE_ENV = 'test';

const { app, server } = require('../src/server');
const blockOptimizationService = require('../src/services/blockOptimizationService');
const conflictDetectionService = require('../src/services/conflictDetectionService');
const trainDataService = require('../src/services/trainDataService');
const rulesEngine = require('../src/services/rulesEngine');
const auditLogService = require('../src/services/auditLogService');
const { validateLineBlockCompatibility } = require('../src/middleware/validator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5055,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
        }
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(raw || '{}'), raw });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('================================================================');
  console.log('  RUNNING RAILFLOW BACKEND TEST SUITE');
  console.log('================================================================\n');

  console.log('--- 1. Worksite KM & Chainage Validation ---');
  test('Valid worksite KM within Katpadi-Jolarpettai section', () => {
    const res = trainDataService.validateWorksiteKmRange('KPD', 'JTJ', 135.0, 140.0);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.spanKm, 5.0);
  });

  test('Rejects worksite with startKm >= endKm', () => {
    const res = trainDataService.validateWorksiteKmRange('KPD', 'JTJ', 140.0, 135.0);
    assert.strictEqual(res.valid, false);
  });

  test('Rejects worksite with startKm outside section lower bound', () => {
    const res = trainDataService.validateWorksiteKmRange('KPD', 'JTJ', 10.0, 140.0);
    assert.strictEqual(res.valid, false);
  });

  console.log('\n--- 2. Track Line & Block Possession Compatibility ---');
  test('UP Main Line matches UP Line Block', () => {
    assert.strictEqual(validateLineBlockCompatibility('UP Main Line', 'UP Line Block'), true);
  });

  test('DOWN Main Line matches DOWN Line Block', () => {
    assert.strictEqual(validateLineBlockCompatibility('DOWN Main Line', 'DOWN Line Block'), true);
  });

  test('Rejects mismatched UP Main Line with DOWN Line Block', () => {
    assert.strictEqual(validateLineBlockCompatibility('UP Main Line', 'DOWN Line Block'), false);
  });

  console.log('\n--- 3. Conflict Detection & Safety Rules ---');
  test('Enforces minimum headway buffer of 3 minutes even if configured lower', () => {
    const res = conflictDetectionService.evaluateWindowConflicts(
      600, 750,
      [{ line: 'UP Main Line', passageTime: { entryTimeMins: 602, exitTimeMins: 606 } }],
      'UP Main Line', 'UP Line Block', 'Track tamping', 'CSM',
      { headwayMinutes: 1 }
    );
    assert.strictEqual(res.hasConflict, true);
  });

  test('Power Block is required ONLY when OHE / catenary is involved', () => {
    const civilRes = conflictDetectionService.evaluateWindowConflicts(
      600, 750, [], 'UP Main Line', 'UP Line Block', 'Track tamping', 'CSM'
    );
    assert.strictEqual(civilRes.powerBlock.required, false);

    const oheRes = conflictDetectionService.evaluateWindowConflicts(
      600, 750, [], 'UP Main Line', 'UP Line Block', '25kV Catenary tensioning', 'Tower wagon'
    );
    assert.strictEqual(oheRes.powerBlock.required, true);
  });

  console.log('\n--- 4. Continuous Block Optimizer & Deterministic Ranking ---');
  await runAsyncTest('Finds feasible continuous block inside preferred window', async () => {
    const corridorData = await trainDataService.getCorridorTrains('KPD', 'JTJ', 'KM 135.00 – KM 140.00', 'UP Main Line', 135.0, 140.0);
    const result = blockOptimizationService.findOptimalBlock(corridorData, {
      fromStation: 'KPD',
      toStation: 'JTJ',
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 120,
      preferredSlot: 'Night Shadow (23:00–04:00)'
    });
    assert(result.recommendedBlock !== '--:-- – --:--');
    assert.strictEqual(result.durationMin, 120);
  });

  console.log('\n--- 5. Rules Engine & Extensibility ---');
  test('Rules engine initializes with default safety and operational rules', () => {
    const rules = rulesEngine.listRules();
    assert(rules.length >= 4);
    assert(rules.some(r => r.id === 'RULE-HEADWAY-01'));
    assert(rules.some(r => r.id === 'RULE-BOARD-01'));
  });

  test('Rules engine allows registering custom rules dynamically', () => {
    rulesEngine.registerRule('RULE-CREW-HOURS-01', {
      name: 'Driver / Crew Maximum Continuous Hours',
      category: 'CREW',
      evaluate: (ctx) => {
        return { passed: true, message: 'Crew duty within limits.' };
      }
    });
    const rule = rulesEngine.getRule('RULE-CREW-HOURS-01');
    assert(rule !== undefined);
    assert.strictEqual(rule.category, 'CREW');
  });

  console.log('\n--- 6. Audit Logging & Sanction Memo Generation ---');
  test('Generates formal IR Sanction Memo (Form IR-OP-41)', () => {
    const memo = auditLogService.generateSanctionMemo({
      sectionName: 'Katpadi Junction – Jolarpettai Junction',
      recommendedBlock: '11:30 – 14:00 IST',
      durationMin: 150
    });
    assert(memo.orderNo.startsWith('IR/SR/'));
    assert(memo.authHash.startsWith('RF-SR-'));
    assert.strictEqual(memo.durationMin, 150);
  });

  console.log('\n--- 7. REST API Endpoints & Health Check ---');
  await runAsyncTest('GET /api/health returns UP status', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.status, 'UP');
  });

  await runAsyncTest('GET /api/v1/corridors/stations returns Southern Railway stations', async () => {
    const res = await request('GET', '/api/v1/corridors/stations');
    assert.strictEqual(res.statusCode, 200);
    assert(Array.isArray(res.data.stations));
    assert(res.data.stations.length > 10);
  });

  await runAsyncTest('GET /api/v1/telemetry/status reports API status', async () => {
    const res = await request('GET', '/api/v1/telemetry/status');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.status !== undefined);
  });

  await runAsyncTest('POST /api/v1/blocks/evaluate successfully evaluates block request', async () => {
    const res = await request('POST', '/api/v1/blocks/evaluate', {
      fromStation: 'KPD',
      toStation: 'JTJ',
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      worksiteStartKm: 135.0,
      worksiteEndKm: 140.0,
      durationMin: 150,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.result !== undefined);
    assert(res.data.result.recommendedBlock !== undefined);
  });

  await runAsyncTest('Compatibility alias POST /api/block-planning/evaluate returns 200', async () => {
    const res = await request('POST', '/api/block-planning/evaluate', {
      fromStation: 'KPD',
      toStation: 'JTJ',
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      worksiteStartKm: 135.0,
      worksiteEndKm: 140.0,
      durationMin: 150
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
  });

  await runAsyncTest('Compatibility alias GET /api/telemetry/status returns 200', async () => {
    const res = await request('GET', '/api/telemetry/status');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
  });

  console.log('\n--- 8. Prisma Database Service & Model Verification ---');
  await runAsyncTest('Prisma database service, models, and fallback behavior', async () => {
    const runPrismaTests = require('./test_prisma_db');
    await runPrismaTests();
  });

  console.log('\n--- 9. Database-Backed API Endpoints ---');
  await runAsyncTest('GET /api/v1/requisitions returns list', async () => {
    const res = await request('GET', '/api/v1/requisitions');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.requisitions));
  });

  await runAsyncTest('POST /api/v1/requisitions creates new requisition and logs audit', async () => {
    const res = await request('POST', '/api/v1/requisitions', {
      department: 'Civil / Track',
      deptCode: 'ENG',
      fromStation: 'KPD',
      toStation: 'JTJ',
      workType: 'Track Geometry Alignment',
      durationMin: 120,
      submittedBy: 'HTTP Test Engineer'
    });
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.success, true);
    assert(res.data.requisition.id !== undefined);
  });

  await runAsyncTest('GET /api/v1/config and POST /api/v1/config operational parameters', async () => {
    const getRes = await request('GET', '/api/v1/config');
    assert.strictEqual(getRes.statusCode, 200);
    assert(getRes.data.config.maxSpeedKmH !== undefined);

    const postRes = await request('POST', '/api/v1/config', { maxSpeedKmH: 125 });
    assert.strictEqual(postRes.statusCode, 200);
    assert.strictEqual(postRes.data.config.maxSpeedKmH, 125);
  });

  await runAsyncTest('GET /api/v1/audit/logs returns operational audit trail', async () => {
    const res = await request('GET', '/api/v1/audit/logs');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.logs));
    assert(res.data.logs.length > 0);
  });

  console.log('\n================================================================');
  console.log(`  TOTAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  // Close server
  server.close(() => {
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
}

main().catch(e => {
  console.error('Fatal test error:', e);
  if (server) server.close();
  process.exit(1);
});
