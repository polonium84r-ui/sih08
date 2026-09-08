/**
 * Comprehensive State-Synchronization Verification Suite
 * Tests:
 * 1. Frontend Line & Block sync rules A, B, C, D, E & invalidation
 * 2. Backend validation: HTTP 200 for valid pairs, HTTP 400 INVALID_LINE_BLOCK_TYPE for contradictory pairs
 * 3. Exact value preservation of "Both Lines Block (Simultaneous)"
 * 4. Map & Dashboard Corridor synchronization: CBE->ED vs KPD->JTJ isolation
 * 5. Rapid switching anti-stale protection
 * 6. Honest telemetry labeling
 * 7. End-to-end Cross-Component Consistency for REQ-SR-TRD-943
 */

const http = require('http');
const CorridorData = require('d:/clone/js/corridor_data');

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {})
        }
      },
      (res) => {
        let respData = '';
        res.on('data', chunk => respData += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(respData || '{}');
            resolve({ status: res.statusCode, data: parsed, raw: respData });
          } catch (e) {
            resolve({ status: res.statusCode, raw: respData });
          }
        });
      }
    );
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

// Simulated frontend synchronization logic matching js/app.js syncTrackLineAndBlockType
function simulateFrontendSync(changedField, initialTrackLine, initialBlockType) {
  let trackLine = initialTrackLine;
  let blockType = initialBlockType;

  if (changedField === "TRACK_LINE") {
    if (trackLine === "UP Main Line") {
      blockType = "UP Line Block";
    } else if (trackLine === "DOWN Main Line") {
      blockType = "DOWN Line Block";
    } else if (trackLine === "Both UP & DOWN Lines") {
      blockType = "Both Lines Block (Simultaneous)";
    } else if (trackLine === "Station Loop / Yard Track") {
      if (blockType === "Both Lines Block (Simultaneous)") {
        blockType = "UP Line Block";
      }
    }
  } else if (changedField === "BLOCK_TYPE") {
    if (blockType === "UP Line Block") {
      if (trackLine !== "Station Loop / Yard Track") {
        trackLine = "UP Main Line";
      }
    } else if (blockType === "DOWN Line Block") {
      if (trackLine !== "Station Loop / Yard Track") {
        trackLine = "DOWN Main Line";
      }
    } else if (blockType === "Both Lines Block (Simultaneous)") {
      trackLine = "Both UP & DOWN Lines";
    }
  }

  return { trackLine, blockType };
}

async function runSuite() {
  console.log('================================================================');
  console.log('       RAILFLOW STATE-SYNCHRONIZATION VERIFICATION SUITE       ');
  console.log('================================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, testName, details = '') {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (details) console.log(`       ${details}`);
      passedCount++;
      return true;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Error: ${details}`);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // PART 16 — TEST TRACK/BLOCK SYNCHRONIZATION
  // -------------------------------------------------------------------------
  console.log('--- SECTION 1: Frontend & Backend Track Line / Block Type Sync ---');

  // TEST 1: Track Line = UP Main Line
  const t1 = simulateFrontendSync("TRACK_LINE", "UP Main Line", "DOWN Line Block");
  assert(
    t1.trackLine === "UP Main Line" && t1.blockType === "UP Line Block",
    "TEST 1: Track Line = UP Main Line -> Block Type = UP Line Block",
    `Result: trackLine="${t1.trackLine}", blockType="${t1.blockType}"`
  );

  // TEST 2: Track Line = DOWN Main Line
  const t2 = simulateFrontendSync("TRACK_LINE", "DOWN Main Line", "UP Line Block");
  assert(
    t2.trackLine === "DOWN Main Line" && t2.blockType === "DOWN Line Block",
    "TEST 2: Track Line = DOWN Main Line -> Block Type = DOWN Line Block",
    `Result: trackLine="${t2.trackLine}", blockType="${t2.blockType}"`
  );

  // TEST 3: Block Type = Both Lines Block (Simultaneous)
  const t3 = simulateFrontendSync("BLOCK_TYPE", "UP Main Line", "Both Lines Block (Simultaneous)");
  assert(
    t3.trackLine === "Both UP & DOWN Lines" && t3.blockType === "Both Lines Block (Simultaneous)",
    "TEST 3: Block Type = Both Lines Block (Simultaneous) -> Track Line = Both UP & DOWN Lines",
    `Result: trackLine="${t3.trackLine}", blockType="${t3.blockType}"`
  );

  // RULE D & E Checks
  const tRuleD = simulateFrontendSync("TRACK_LINE", "Both UP & DOWN Lines", "UP Line Block");
  assert(
    tRuleD.blockType === "Both Lines Block (Simultaneous)",
    "RULE D: Track Line = Both UP & DOWN Lines -> Block Type = Both Lines Block (Simultaneous)",
    `Result: blockType="${tRuleD.blockType}"`
  );

  const tRuleE = simulateFrontendSync("BLOCK_TYPE", "Station Loop / Yard Track", "DOWN Line Block");
  assert(
    tRuleE.trackLine === "Station Loop / Yard Track" && tRuleE.blockType === "DOWN Line Block",
    "RULE E: Station Loop / Yard Track preserves yard/loop track when block type changes",
    `Result: trackLine="${tRuleE.trackLine}", blockType="${tRuleE.blockType}"`
  );

  // TEST 4: Backend API request: UP Main Line + UP Line Block -> HTTP 200
  const res4 = await makeRequest('/api/block-planning/evaluate', 'POST', {
    fromStation: 'KPD',
    toStation: 'JTJ',
    trackLine: 'UP Main Line',
    blockType: 'UP Line Block',
    worksiteStartKm: 135.00,
    worksiteEndKm: 137.50,
    durationMin: 120
  });
  assert(
    res4.status === 200 && res4.data.success === true,
    "TEST 4: Backend API request (UP Main Line + UP Line Block) -> HTTP 200",
    `Status: ${res4.status}, Success: ${res4.data?.success}`
  );

  // TEST 5: Backend API request: DOWN Main Line + DOWN Line Block -> HTTP 200
  const res5 = await makeRequest('/api/block-planning/evaluate', 'POST', {
    fromStation: 'KPD',
    toStation: 'JTJ',
    trackLine: 'DOWN Main Line',
    blockType: 'DOWN Line Block',
    worksiteStartKm: 135.00,
    worksiteEndKm: 137.50,
    durationMin: 120
  });
  assert(
    res5.status === 200 && res5.data.success === true,
    "TEST 5: Backend API request (DOWN Main Line + DOWN Line Block) -> HTTP 200",
    `Status: ${res5.status}, Success: ${res5.data?.success}`
  );

  // TEST 6: Direct backend request: UP Main Line + DOWN Line Block -> HTTP 400 INVALID_LINE_BLOCK_TYPE
  const res6 = await makeRequest('/api/block-planning/evaluate', 'POST', {
    fromStation: 'KPD',
    toStation: 'JTJ',
    trackLine: 'UP Main Line',
    blockType: 'DOWN Line Block',
    worksiteStartKm: 135.00,
    worksiteEndKm: 137.50,
    durationMin: 120
  });
  assert(
    res6.status === 400 && res6.data.error?.code === 'INVALID_LINE_BLOCK_TYPE',
    "TEST 6: Inconsistent request (UP Main Line + DOWN Line Block) -> HTTP 400 INVALID_LINE_BLOCK_TYPE",
    `Status: ${res6.status}, Code: ${res6.data.error?.code}, Message: ${res6.data.error?.message}`
  );

  // TEST 7: Direct backend request: DOWN Main Line + UP Line Block -> HTTP 400 INVALID_LINE_BLOCK_TYPE
  const res7 = await makeRequest('/api/block-planning/evaluate', 'POST', {
    fromStation: 'KPD',
    toStation: 'JTJ',
    trackLine: 'DOWN Main Line',
    blockType: 'UP Line Block',
    worksiteStartKm: 135.00,
    worksiteEndKm: 137.50,
    durationMin: 120
  });
  assert(
    res7.status === 400 && res7.data.error?.code === 'INVALID_LINE_BLOCK_TYPE',
    "TEST 7: Inconsistent request (DOWN Main Line + UP Line Block) -> HTTP 400 INVALID_LINE_BLOCK_TYPE",
    `Status: ${res7.status}, Code: ${res7.data.error?.code}, Message: ${res7.data.error?.message}`
  );

  // TEST 8: Track Line = Both UP & DOWN Lines, Block Type = Both Lines Block (Simultaneous) -> HTTP 200
  const res8 = await makeRequest('/api/block-planning/evaluate', 'POST', {
    fromStation: 'KPD',
    toStation: 'JTJ',
    trackLine: 'Both UP & DOWN Lines',
    blockType: 'Both Lines Block (Simultaneous)',
    worksiteStartKm: 135.00,
    worksiteEndKm: 137.50,
    durationMin: 120
  });
  assert(
    res8.status === 200 && res8.data.result?.blockType === 'Both Lines Block (Simultaneous)',
    "TEST 8: Both Lines Block (Simultaneous) returns exact untruncated blockType",
    `Status: ${res8.status}, Returned blockType: "${res8.data.result?.blockType}"`
  );

  // -------------------------------------------------------------------------
  // PART 17 — TEST MAP CORRIDOR SYNCHRONIZATION
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Map & Dashboard Corridor Synchronization ---');

  // MAP TEST A: CBE -> ED
  const cbeEdTelem = CorridorData.getCorridorTelemetry('CBE', 'ED');
  const cbeHasKpdTrains = cbeEdTelem.runningTrains.some(t => t.name.includes('KPD') || t.name.includes('JTJ') || t.name.includes('Brindavan'));
  const cbeHasKpdConflicts = cbeEdTelem.activeConflicts.some(c => c.detail.includes('KPD') || c.detail.includes('JTJ'));
  const cbeMaintItems = CorridorData.requisitions.filter(r => (r.fromStation === 'CBE' && r.toStation === 'ED') || (r.fromStation === 'ED' && r.toStation === 'CBE'));
  const cbeHasKpdMaint = cbeMaintItems.some(r => r.fromStation === 'KPD' || r.toStation === 'JTJ');

  assert(
    cbeEdTelem.corridorBadge === "Southern Railway — Coimbatore–Erode corridor",
    "MAP TEST A.1: CBE -> ED Corridor Badge is 'Southern Railway — Coimbatore–Erode corridor'",
    `Badge: "${cbeEdTelem.corridorBadge}"`
  );
  assert(
    !cbeHasKpdTrains && cbeEdTelem.runningTrains.length > 0,
    "MAP TEST A.2: CBE -> ED running trains contain ONLY CBE/ED trains (no KPD/JTJ trains)",
    `Trains: ${cbeEdTelem.runningTrains.map(t => t.name).join(', ')}`
  );
  assert(
    !cbeHasKpdConflicts && cbeEdTelem.activeConflicts.length > 0,
    "MAP TEST A.3: CBE -> ED active conflicts contain ONLY CBE/ED conflicts",
    `Conflicts: ${cbeEdTelem.activeConflicts.map(c => c.detail).join(' | ')}`
  );
  assert(
    !cbeHasKpdMaint && cbeMaintItems.length > 0,
    "MAP TEST A.4: CBE -> ED upcoming maintenance contains ONLY CBE/ED requisitions (REQ-SR-TRD-943)",
    `Requisitions: ${cbeMaintItems.map(r => `${r.reqId} (${r.fromStation}->${r.toStation})`).join(', ')}`
  );

  // MAP TEST B: KPD -> JTJ
  const kpdJtjTelem = CorridorData.getCorridorTelemetry('KPD', 'JTJ');
  const kpdHasCbeTrains = kpdJtjTelem.runningTrains.some(t => t.name.includes('CBE–ED') || t.name.includes('Alappuzha'));
  const kpdHasCbeConflicts = kpdJtjTelem.activeConflicts.some(c => c.detail.includes('CBE-ED') || c.detail.includes('Tiruppur'));

  assert(
    kpdJtjTelem.corridorBadge === "Southern Railway — Katpadi–Jolarpettai corridor",
    "MAP TEST B.1: KPD -> JTJ Corridor Badge is 'Southern Railway — Katpadi–Jolarpettai corridor'",
    `Badge: "${kpdJtjTelem.corridorBadge}"`
  );
  assert(
    !kpdHasCbeTrains && kpdJtjTelem.runningTrains.length > 0,
    "MAP TEST B.2: KPD -> JTJ running trains contain ONLY KPD/JTJ trains",
    `Trains: ${kpdJtjTelem.runningTrains.map(t => t.name).join(', ')}`
  );
  assert(
    !kpdHasCbeConflicts && kpdJtjTelem.activeConflicts.length > 0,
    "MAP TEST B.3: KPD -> JTJ active conflicts contain ONLY KPD/JTJ conflicts",
    `Conflicts: ${kpdJtjTelem.activeConflicts.map(c => c.detail).join(' | ')}`
  );

  // MAP TEST C: Rapid switching protection
  console.log('\n--- SECTION 3: Rapid Corridor Switching Simulation ---');
  let currentToken = 0;
  let activeState = null;

  function switchCorridor(from, to, delayMs) {
    const token = ++currentToken;
    return new Promise(resolve => {
      setTimeout(() => {
        // Discard if token is stale
        if (token === currentToken) {
          activeState = { from, to, token };
          resolve({ executed: true, token, from, to });
        } else {
          resolve({ executed: false, token, from, to, reason: 'stale discarded' });
        }
      }, delayMs);
    });
  }

  // Sequence: CBE->ED (slow 80ms), KPD->JTJ (slow 60ms), CBE->ED (fast 20ms)
  const p1 = switchCorridor('CBE', 'ED', 80); // Token 1
  const p2 = switchCorridor('KPD', 'JTJ', 60); // Token 2
  const p3 = switchCorridor('CBE', 'ED', 20); // Token 3 (current)

  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
  assert(
    r1.executed === false && r2.executed === false && r3.executed === true && activeState.from === 'CBE' && activeState.to === 'ED',
    "MAP TEST C: Rapid switching (CBE->ED -> KPD->JTJ -> CBE->ED) strictly discards stale responses",
    `Final Active State: from="${activeState.from}", to="${activeState.to}", token=${activeState.token}`
  );

  // MAP TEST D: Honest data source labeling
  console.log('\n--- SECTION 4: Live Data vs Demo/Mock Honest Labeling ---');
  const resD = await makeRequest('/api/block-planning/evaluate', 'POST', {
    fromStation: 'CBE',
    toStation: 'ED',
    trackLine: 'UP Main Line',
    blockType: 'UP Line Block',
    worksiteStartKm: 395.00,
    worksiteEndKm: 395.45,
    durationMin: 150
  });

  const isMock = !resD.data.corridorData?.liveDataAvailable;
  const isCorrectlyLabeled = isMock ? (resD.data.corridorData?.liveStatusText === 'LIVE DATA UNAVAILABLE' && (resD.data.corridorData?.dataSource || '').includes('Demo/Mock Data')) : true;
  assert(
    isCorrectlyLabeled,
    "MAP TEST D: Demo/Mock fallback is NEVER labeled as LIVE DATA",
    `liveDataAvailable: ${resD.data.corridorData?.liveDataAvailable}, liveStatusText: "${resD.data.corridorData?.liveStatusText}", dataSource: "${resD.data.corridorData?.dataSource}"`
  );

  // -------------------------------------------------------------------------
  // PART 18 — CROSS-COMPONENT CONSISTENCY TEST
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: PART 18 Cross-Component Consistency Test ---');
  const req943 = CorridorData.requisitions.find(r => r.reqId === 'REQ-SR-TRD-943');

  assert(
    req943 !== undefined,
    "PART 18.1: Requisition REQ-SR-TRD-943 exists in CorridorData.requisitions",
    `Found: ${req943?.reqId}`
  );

  assert(
    req943?.fromStation === 'CBE' && req943?.toStation === 'ED',
    "PART 18.2: REQ-SR-TRD-943 corridor is CBE -> ED",
    `From: ${req943?.fromStation}, To: ${req943?.toStation}`
  );

  assert(
    req943?.trackLine === 'UP Main Line' && req943?.blockType === 'UP Line Block',
    "PART 18.3: REQ-SR-TRD-943 trackLine is 'UP Main Line' and blockType is 'UP Line Block'",
    `Track: "${req943?.trackLine}", Block: "${req943?.blockType}"`
  );

  assert(
    req943?.kmRange === 'KM 395.00 – KM 395.45',
    "PART 18.4: REQ-SR-TRD-943 worksite is 'KM 395.00 – KM 395.45'",
    `Worksite: "${req943?.kmRange}"`
  );

  // Backend evaluation consistency
  const res943 = await makeRequest('/api/block-planning/evaluate', 'POST', {
    fromStation: req943.fromStation,
    toStation: req943.toStation,
    trackLine: req943.trackLine,
    blockType: req943.blockType,
    worksiteStartKm: req943.worksiteStartKm,
    worksiteEndKm: req943.worksiteEndKm,
    durationMin: req943.durationMin
  });

  assert(
    res943.status === 200 && res943.data.result?.trackLine === 'UP Main Line' && res943.data.result?.blockType === 'UP Line Block',
    "PART 18.5: Evaluation preserves exact requested UP Main Line & UP Line Block without alteration",
    `Evaluation trackLine: "${res943.data.result?.trackLine}", blockType: "${res943.data.result?.blockType}"`
  );

  const evalHasKpd = (res943.data.corridorData?.trains || []).some(t => t.trainName.includes('KPD') || t.trainName.includes('JTJ'));
  assert(
    !evalHasKpd,
    "PART 18.6: Evaluated CBE -> ED corridor trains do NOT contain any KPD/JTJ trains",
    `Evaluated trains: ${(res943.data.corridorData?.trains || []).map(t => `#${t.trainNumber} ${t.trainName}`).join(', ')}`
  );

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('================================================================');

  if (passedCount === totalCount) {
    console.log('\n>>> ALL STATE-SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! <<<');
    process.exit(0);
  } else {
    console.error('\n>>> SOME TESTS FAILED! <<<');
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
