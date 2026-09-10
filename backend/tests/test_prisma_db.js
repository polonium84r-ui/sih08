/**
 * Unit & Integration Test: Prisma Database Service Layer
 * Tests Prisma client instantiation, model access, and resilient fallback execution
 */

const assert = require('assert');
const db = require('../src/services/db');

async function runPrismaTests() {
  console.log('Testing Prisma Database Service & Models...');

  // 1. Prisma Client Instantiation
  const prisma = db.getPrisma();
  assert(prisma !== null, 'Prisma Client should be instantiated');
  console.log('  ✔ Prisma Client is properly initialized');

  // 2. Connection Check (Handles offline gracefully)
  await db.checkConnection();
  const isConnected = db.isDatabaseConnected();
  console.log(`  ✔ Database connection check executed (PostgreSQL is ${isConnected ? 'ONLINE' : 'OFFLINE (in resilient fallback)'})`);

  // 3. Station Queries
  const stations = await db.getStations();
  assert(Array.isArray(stations), 'Stations must be an array');
  assert(stations.length >= 20, `Expected >= 20 stations, found ${stations.length}`);
  const mas = stations.find(s => s.code === 'MAS');
  assert(mas, 'Chennai Central (MAS) station must exist');
  assert.strictEqual(mas.code, 'MAS');
  console.log(`  ✔ Stations queried successfully (${stations.length} stations found, MAS verified)`);

  // 4. Section Queries
  const sections = await db.getSections();
  assert(Array.isArray(sections), 'Sections must be an array');
  assert(sections.length > 0, 'Sections must not be empty');
  console.log(`  ✔ Track sections queried successfully (${sections.length} sections found)`);

  // 5. Requisition CRUD
  const initialReqs = await db.getRequisitions();
  assert(Array.isArray(initialReqs), 'Requisitions must be an array');
  console.log(`  ✔ Requisitions queried successfully (${initialReqs.length} initial requisitions)`);

  const testReqData = {
    department: 'Civil / Track',
    deptCode: 'ENG',
    fromStation: 'KPD',
    toStation: 'JTJ',
    sectionName: 'Katpadi-Jolarpettai',
    trackLine: 'UP Main Line',
    blockType: 'UP Line Block',
    worksiteStartKm: 140.0,
    worksiteEndKm: 145.5,
    workType: 'Deep Screening Machine (BCM)',
    workDesc: 'Ballast cleaning and tamping',
    durationMin: 180,
    urgency: 'Critical',
    submittedBy: 'Prisma Test Engineer'
  };

  const createdReq = await db.createRequisition(testReqData);
  assert(createdReq, 'Created requisition must exist');
  assert(createdReq.id, 'Created requisition must have an id');
  assert.strictEqual(createdReq.department, testReqData.department);
  console.log(`  ✔ Requisition created successfully with ID: ${createdReq.id}`);

  const fetchedReq = await db.getRequisitionById(createdReq.id);
  assert(fetchedReq, 'Fetched requisition must not be null');
  assert.strictEqual(fetchedReq.id, createdReq.id);
  console.log(`  ✔ Requisition fetched by ID verified`);

  // 6. Operational Config
  const cfg = await db.getConfig();
  assert(cfg, 'Operational config must exist');
  assert(typeof cfg.maxSpeedKmH === 'number', 'maxSpeedKmH must be a number');
  assert(typeof cfg.headwayMinutes === 'number', 'headwayMinutes must be a number');
  console.log(`  ✔ Operational config retrieved: maxSpeed=${cfg.maxSpeedKmH} km/h, headway=${cfg.headwayMinutes} min`);

  const updatedCfg = await db.updateConfig({ maxSpeedKmH: 135 });
  assert.strictEqual(updatedCfg.maxSpeedKmH, 135, 'maxSpeedKmH should be updated to 135');
  console.log(`  ✔ Operational config updated successfully to 135 km/h`);

  // 7. Audit Logging
  const initialLogs = await db.getAuditLogs();
  assert(Array.isArray(initialLogs), 'Audit logs must be an array');
  const logged = await db.logAudit('PRISMA_TEST_ACTION', 'Prisma Unit Test', 'Automated verification test completed');
  assert(logged && logged.id, 'Logged entry must have an ID');
  const logsAfter = await db.getAuditLogs();
  assert(logsAfter.some(l => l.id === logged.id), 'New log entry must appear in audit log list');
  console.log(`  ✔ Audit log created and verified (ID: ${logged.id})`);

  console.log('\nAll Prisma Database Service tests passed successfully!\n');
}

if (require.main === module) {
  runPrismaTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Prisma test failure:', err);
      process.exit(1);
    });
}

module.exports = runPrismaTests;
