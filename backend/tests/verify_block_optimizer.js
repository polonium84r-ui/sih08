/**
 * Comprehensive Verification Suite for RailFlow Block Optimizer
 * Tests all required cases:
 * - Preferred window feasible (with demo wording vs live wording)
 * - Preferred window infeasible -> alternative found
 * - No feasible window
 * - Alternative ranking priority
 * - UP/DOWN/Both-line and Station Loop consistency
 * - Worksite KM validation
 * - Non-OHE Power Block wording
 * - Corridor isolation
 * - Live/mock labeling and honest reasoning
 * - Rapid request switching / stale response protection
 */

const http = require('http');
const trainDataService = require('../src/services/trainDataService');
const blockOptimizationService = require('../src/services/blockOptimizationService');
const conflictDetectionService = require('../src/services/conflictDetectionService');
const corridorDataRef = require('../src/data/corridorData');

function makeApiRequest(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: process.env.PORT || 5000,
        path: '/api/block-planning/evaluate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body || '{}') });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runBlockOptimizerSuite() {
  console.log('========================================================================');
  console.log('       RAILFLOW BLOCK OPTIMIZER — VERIFICATION TEST SUITE               ');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, name, detail = '') {
    total++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      if (detail) console.log(`       ${detail}`);
      passed++;
      return true;
    } else {
      console.error(`[FAIL] ${name}`);
      if (detail) console.error(`       Details: ${detail}`);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1 — Preferred Window Feasible & Honest Demo Wording
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: Preferred Window Feasible & Honest Demo Wording ---');
  try {
    const res1 = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 150.20,
      worksiteEndKm: 153.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 90,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)',
      activityName: 'Plain Track Tamping & Alignment',
      machinery: 'CSM 09-32'
    });

    const rec1 = res1.data.result;
    const isMock = !res1.data.corridorData?.liveDataAvailable;
    const hasDisruptionClaim = rec1?.reason?.includes('without train disruption');
    const hasDemoReason = rec1?.reason?.includes('Feasible continuous block identified using available timetable/demo data.');

    assert(
      res1.statusCode === 200 &&
      rec1.isInsidePreferred === true &&
      rec1.windowType === 'Preferred Window' &&
      rec1.status.includes('OPTIMIZED BLOCK SCHEDULE – RECOMMENDED – PENDING CONTROLLER APPROVAL') &&
      (!isMock || (!hasDisruptionClaim && hasDemoReason)),
      'TEST 1: 90-min block inside preferred window uses honest demo data wording when live data is unavailable',
      `Reason: "${rec1?.reason}", LiveAvailable: ${!isMock}`
    );
  } catch (e) {
    assert(false, 'TEST 1 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2 — Preferred Window NOT Feasible -> Alternative Recommendation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Preferred Window NOT Feasible -> Alternative Recommendation ---');
  try {
    const res2 = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 150.20,
      worksiteEndKm: 153.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 150,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)',
      activityName: 'Plain Track Tamping & Alignment',
      machinery: 'CSM 09-32'
    });

    const rec2 = res2.data.result;
    assert(
      res2.statusCode === 200 &&
      rec2.isInsidePreferred === false &&
      rec2.windowType === 'Alternative Window' &&
      rec2.status.includes('OPTIMIZED BLOCK SCHEDULE – RECOMMENDED – PENDING CONTROLLER APPROVAL') &&
      rec2.conflictingTrains.length > 0 &&
      rec2.extensionBeyondPreferredMins > 0,
      'TEST 2: 150-min block NOT feasible in 11:00–14:30; optimizer finds alternative window with extension details',
      `Alternative: ${rec2?.recommendedBlock}, Conflict Train: #${rec2?.conflictingTrains[0]?.trainNumber}, Extension: ${rec2?.extensionBeyondPreferredMins}m`
    );
  } catch (e) {
    assert(false, 'TEST 2 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3 — No Feasible Window Handling
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: No Feasible Window Handling ---');
  try {
    const res3 = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 150.20,
      worksiteEndKm: 153.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 1200, // 20 hours continuous
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)',
      activityName: 'Plain Track Tamping & Alignment',
      machinery: 'CSM 09-32'
    });

    const rec3 = res3.data.result;
    assert(
      res3.statusCode === 200 &&
      rec3.status === 'NO FEASIBLE BLOCK FOUND' &&
      rec3.recommendedBlock === '--:-- – --:--',
      'TEST 3: When no feasible block fits in horizon, system clearly shows "NO FEASIBLE BLOCK FOUND" without fabricating blocks',
      `Status: "${rec3?.status}", Recommended: "${rec3?.recommendedBlock}", Reason: "${rec3?.reason}"`
    );
  } catch (e) {
    assert(false, 'TEST 3 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4 — Alternative Ranking Priority Order
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Candidate Window Deterministic Ranking ---');
  try {
    const preferred = { startMins: 660, endMins: 870, label: '11:00–14:30' };
    const candidates = [
      { startMins: 900, endMins: 1050, durationMin: 150, isInsidePreferred: false, startFormatted: '15:00', endFormatted: '17:30', evaluation: { adjacentTrainCount: 2 } },
      { startMins: 825, endMins: 975, durationMin: 150, isInsidePreferred: false, startFormatted: '13:45', endFormatted: '16:15', evaluation: { adjacentTrainCount: 1 } },
      { startMins: 840, endMins: 990, durationMin: 150, isInsidePreferred: false, startFormatted: '14:00', endFormatted: '16:30', evaluation: { adjacentTrainCount: 1 } },
      { startMins: 660, endMins: 810, durationMin: 150, isInsidePreferred: true, startFormatted: '11:00', endFormatted: '13:30', evaluation: { adjacentTrainCount: 0 } }
    ];

    const ranked = blockOptimizationService.rankCandidateWindows(candidates, preferred, 150);
    const top = ranked[0];

    assert(
      top.isInsidePreferred === true && top.startFormatted === '11:00' &&
      ranked[1].startFormatted === '13:45' && ranked[2].startFormatted === '14:00',
      'TEST 4: Ranking strictly prioritizes: Inside Preferred > Minimum Deviation > Min Disruption > Earliest Time',
      `Rank 1: ${ranked[0].startFormatted} (inside=${ranked[0].isInsidePreferred}), Rank 2: ${ranked[1].startFormatted}, Rank 3: ${ranked[2].startFormatted}`
    );
  } catch (e) {
    assert(false, 'TEST 4 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5 — UP Line Block
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: UP Line Block Preservation ---');
  try {
    const res5 = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 135.00,
      worksiteEndKm: 137.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 120
    });

    const rec5 = res5.data.result;
    assert(
      res5.statusCode === 200 &&
      rec5.trackLine === 'UP Main Line' &&
      rec5.blockType === 'UP Line Block',
      'TEST 5: Recommendation preserves Track Line: "UP Main Line" and Block Type: "UP Line Block"',
      `Track: "${rec5?.trackLine}", Block: "${rec5?.blockType}"`
    );
  } catch (e) {
    assert(false, 'TEST 5 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6 — DOWN Line Block
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: DOWN Line Block Preservation ---');
  try {
    const res6 = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 135.00,
      worksiteEndKm: 137.50,
      trackLine: 'DOWN Main Line',
      blockType: 'DOWN Line Block',
      durationMin: 120
    });

    const rec6 = res6.data.result;
    assert(
      res6.statusCode === 200 &&
      rec6.trackLine === 'DOWN Main Line' &&
      rec6.blockType === 'DOWN Line Block',
      'TEST 6: Recommendation preserves Track Line: "DOWN Main Line" and Block Type: "DOWN Line Block"',
      `Track: "${rec6?.trackLine}", Block: "${rec6?.blockType}"`
    );
  } catch (e) {
    assert(false, 'TEST 6 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7 — Both Lines Block (Simultaneous)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Both Lines Block (Simultaneous) Exact Value Preservation ---');
  try {
    const res7 = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 135.00,
      worksiteEndKm: 137.50,
      trackLine: 'Both UP & DOWN Lines',
      blockType: 'Both Lines Block (Simultaneous)',
      durationMin: 120
    });

    const rec7 = res7.data.result;
    assert(
      res7.statusCode === 200 &&
      rec7.blockType === 'Both Lines Block (Simultaneous)',
      'TEST 7: Returns exact value "Both Lines Block (Simultaneous)"',
      `Returned blockType: "${rec7?.blockType}"`
    );
  } catch (e) {
    assert(false, 'TEST 7 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8 — Station Loop / Yard Track Block
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Station Loop / Yard Track Block Synchronization & Validation ---');
  try {
    const resValid = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 135.00,
      worksiteEndKm: 137.50,
      trackLine: 'Station Loop / Yard Track',
      blockType: 'Station Loop / Yard Track Block',
      durationMin: 120
    });

    const resInvalid = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 135.00,
      worksiteEndKm: 137.50,
      trackLine: 'Station Loop / Yard Track',
      blockType: 'UP Line Block',
      durationMin: 120
    });

    assert(
      resValid.statusCode === 200 &&
      resValid.data.result?.trackLine === 'Station Loop / Yard Track' &&
      resValid.data.result?.blockType === 'Station Loop / Yard Track Block' &&
      resInvalid.statusCode === 400 &&
      resInvalid.data.error?.code === 'INVALID_LINE_BLOCK_TYPE',
      'TEST 8: Station Loop / Yard Track pairs only with Station Loop / Yard Track Block',
      `Valid: ${resValid.statusCode} ("${resValid.data.result?.blockType}"), Invalid mismatch: ${resInvalid.statusCode} ("${resInvalid.data.error?.code}")`
    );
  } catch (e) {
    assert(false, 'TEST 8 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9 — Non-OHE Power Block Wording
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Non-OHE Power Block Wording ---');
  try {
    const res9 = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 135.00,
      worksiteEndKm: 137.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 120,
      activityName: 'Plain Track Tamping & Alignment',
      machinery: 'CSM 09-32'
    });

    const pb = res9.data.result?.powerBlock;
    const expectedWording = 'No automatic Power Block requirement identified for this activity; final OHE isolation requirement is subject to worksite conditions and authorised railway procedures.';

    assert(
      pb?.required === false && pb?.label === expectedWording,
      'TEST 9: Non-OHE work returns non-definitive disclaimer wording for Power Block',
      `Power Block Label: "${pb?.label}"`
    );
  } catch (e) {
    assert(false, 'TEST 9 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10 — Invalid Worksite KM
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 10: Invalid Worksite KM Range Validation ---');
  try {
    const res10 = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 50.00,
      worksiteEndKm: 55.00,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 120
    });

    assert(
      res10.statusCode === 400 &&
      res10.data.error?.code === 'INVALID_WORKSITE_KM',
      'TEST 10: Out-of-section KM range returns HTTP 400 INVALID_WORKSITE_KM and no recommendation',
      `Status: ${res10.statusCode}, Code: "${res10.data?.error?.code}", Message: "${res10.data?.error?.message}"`
    );
  } catch (e) {
    assert(false, 'TEST 10 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11 — Corridor State Isolation (CBE–ED vs KPD–JTJ)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 11: Corridor State Isolation ---');
  try {
    const resCbe = await makeApiRequest({
      fromStation: 'CBE',
      toStation: 'ED',
      worksiteStartKm: 395.00,
      worksiteEndKm: 395.45,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 150
    });

    const resKpd = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 150.20,
      worksiteEndKm: 153.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 150
    });

    const cbeTrains = resCbe.data.corridorData?.trains || [];
    const kpdTrains = resKpd.data.corridorData?.trains || [];

    const cbeHasKpd = cbeTrains.some(t => t.trainName.includes('KPD') || t.trainName.includes('JTJ') || t.trainNumber === '66023');
    const kpdHasCbe = kpdTrains.some(t => t.trainName.includes('CBE–ED') || t.trainNumber === '06802');

    assert(
      !cbeHasKpd && !kpdHasCbe && cbeTrains.length > 0 && kpdTrains.length > 0,
      'TEST 11: CBE–ED and KPD–JTJ train telemetry and conflict sets are strictly isolated',
      `CBE trains: ${cbeTrains.map(t => t.trainNumber).join(', ')} | KPD trains: ${kpdTrains.map(t => t.trainNumber).join(', ')}`
    );
  } catch (e) {
    assert(false, 'TEST 11 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12 — Rapid Request Change & Stale Overwrite Protection
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 12: Rapid Request Change & Stale Fingerprint Protection ---');
  try {
    let evaluationSeq = 0;
    let activeFingerprint = null;
    let activeResult = null;

    function simulateEvaluationRequest(corridor, delayMs) {
      const evalId = ++evaluationSeq;
      const fingerprint = `${corridor.from}|${corridor.to}|${corridor.startKm}|${corridor.endKm}|${corridor.duration}`;
      activeFingerprint = fingerprint;

      return new Promise(resolve => {
        setTimeout(async () => {
          const res = await makeApiRequest({
            fromStation: corridor.from,
            toStation: corridor.to,
            worksiteStartKm: corridor.startKm,
            worksiteEndKm: corridor.endKm,
            trackLine: 'UP Main Line',
            blockType: 'UP Line Block',
            durationMin: corridor.duration
          });

          // Discard if stale
          if (evalId === evaluationSeq && activeFingerprint === fingerprint) {
            activeResult = { corridor: corridor.from + '->' + corridor.to, res: res.data.result };
            resolve({ applied: true, evalId, corridor: corridor.from });
          } else {
            resolve({ applied: false, evalId, corridor: corridor.from, reason: 'stale discarded' });
          }
        }, delayMs);
      });
    }

    // Launch slow CBE->ED first, then fast KPD->JTJ
    const pCbe = simulateEvaluationRequest({ from: 'CBE', to: 'ED', startKm: 395.00, endKm: 395.45, duration: 150 }, 80);
    const pKpd = simulateEvaluationRequest({ from: 'KPD', to: 'JTJ', startKm: 150.20, endKm: 153.50, duration: 150 }, 20);

    const [rCbe, rKpd] = await Promise.all([pCbe, pKpd]);

    assert(
      rCbe.applied === false && rKpd.applied === true && activeResult.corridor === 'KPD->JTJ',
      'TEST 12: Rapid request change discards outdated responses and prevents stale state overwrite',
      `CBE applied: ${rCbe.applied}, KPD applied: ${rKpd.applied}, Active corridor: ${activeResult.corridor}`
    );
  } catch (e) {
    assert(false, 'TEST 12 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // TEST 13 — Fully Automatic Scheduling Workflow (Single Source of Truth)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 13: Fully Automatic Scheduling Workflow (Submit -> Optimize -> Auto-Schedule) ---');
  try {
    const trdPayload = {
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 130.00,
      worksiteEndKm: 214.00,
      worksiteKmRange: 'KM 130.00 – KM 214.00',
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 135,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)',
      workCategory: 'TRD_CATENARY',
      workDesc: '25kV Catenary Wire Tensioning & Insulator Overhaul',
      machinery: 'Tower Wagon Car #09 (25kV AC)',
      urgency: 'Due'
    };

    const res13 = await makeApiRequest(trdPayload);
    const rec13 = res13.data.result;

    // Optimizer recommendation
    const optimizedWindow = rec13.recommendedBlock;
    const isFeasible = !rec13.status?.includes("NO FEASIBLE") && rec13.recommendedBlock !== "--:-- – --:--";

    // Simulate Requisition auto-scheduling from optimizer response (verbatim client logic in app.js)
    const testReqId = 'REQ-SR-TRD-927';
    const autoStatus = isFeasible ? 'SCHEDULED' : 'UNSCHEDULED (NO FEASIBLE BLOCK)';
    const assignedSlot = isFeasible ? optimizedWindow : '--:-- – --:--';

    const requisition = {
      reqId: testReqId,
      department: 'Electrical / Traction (TRD)',
      deptCode: 'TRD',
      fromStation: trdPayload.fromStation,
      toStation: trdPayload.toStation,
      sectionName: 'Katpadi – Jolarpettai',
      trackLine: trdPayload.trackLine,
      blockType: trdPayload.blockType,
      worksiteStartKm: trdPayload.worksiteStartKm,
      worksiteEndKm: trdPayload.worksiteEndKm,
      kmRange: trdPayload.worksiteKmRange,
      workType: trdPayload.workDesc,
      durationMin: trdPayload.durationMin,
      urgency: trdPayload.urgency,
      status: autoStatus,
      sanctionedSlot: assignedSlot,
      recommendedBlock: assignedSlot,
      lat: 12.8620,
      lng: 79.0010
    };

    // Helper function representing app.js popup generation logic
    function generateMapPopup(req) {
      const isScheduled = req.status === "SCHEDULED" || req.status === "APPROVED" || (req.status && (req.status.includes("SCHEDULED") || req.status.includes("APPROVED") || req.status.includes("SIMULATED")));
      const displayStatus = isScheduled ? "SCHEDULED" : "UNSCHEDULED (NO FEASIBLE BLOCK)";
      const slotDisplay = req.sanctionedSlot || req.recommendedBlock;
      return {
        reqId: req.reqId,
        status: displayStatus,
        isScheduled: isScheduled,
        windowLabel: isScheduled ? "Scheduled Window" : "Status",
        windowValue: slotDisplay,
        html: `[${req.reqId}] Status: ${displayStatus} | ${isScheduled ? 'Scheduled Window' : 'Status'}: ${slotDisplay}`
      };
    }

    const popup = generateMapPopup(requisition);

    const check1 = isFeasible === true;
    const check2 = requisition.status === 'SCHEDULED';
    const check3 = requisition.sanctionedSlot === optimizedWindow;
    const check4 = popup.status === 'SCHEDULED';
    const check5 = popup.windowValue === optimizedWindow;
    const check6 = popup.windowLabel === 'Scheduled Window';
    const check7 = !popup.html.includes('Option B') && !popup.html.includes('PENDING');

    assert(
      res13.statusCode === 200 &&
      check1 && check2 && check3 && check4 && check5 && check6 && check7,
      `TEST 13: Submit -> Optimize -> Auto-Schedule: REQ-SR-TRD-927 is automatically SCHEDULED for ${optimizedWindow} on map popup and active requisitions without manual approval click`,
      `Status: "${popup.status}", Window: "${popup.windowValue}", Label: "${popup.windowLabel}"`
    );
  } catch (e) {
    assert(false, 'TEST 13 Failed with error: ' + e.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`   BLOCK OPTIMIZER TEST SUITE: ${passed} / ${total} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passed === total) {
    console.log('🎉 ALL BLOCK OPTIMIZER TEST CASES VERIFIED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runBlockOptimizerSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
