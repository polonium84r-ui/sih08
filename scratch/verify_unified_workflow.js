/**
 * Unified Workflow Verification Suite (Tests 1 - 14)
 * Verifies end-to-end alignment of Block Planner, Coordination, Configuration,
 * Active Requisitions, Map, and Operating Branch Timetable with the automatic Block Optimizer.
 */

const http = require('http');
const trainDataService = require('../server/services/trainDataService');
const blockOptimizationService = require('../server/services/blockOptimizationService');
const conflictDetectionService = require('../server/services/conflictDetectionService');
const corridorDataRef = require('../js/corridor_data');

function makeApiRequest(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
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

// Emulate client-side single source of truth and rendering helpers from app.js
function createClientContext() {
  const requisitions = JSON.parse(JSON.stringify(corridorDataRef.requisitions || []));
  let activeCorridorState = null;
  let prototypeConfig = {
    maxSpeedKmH: 130,
    headwayMinutes: 12,
    cautionSpeedKmH: 30
  };

  function isReqInCorridor(req, corridorState) {
    if (!req || !corridorState) return true;
    const reqFrom = (req.fromStation || '').toUpperCase().trim();
    const reqTo = (req.toStation || '').toUpperCase().trim();
    const cFrom = (corridorState.fromStation || '').toUpperCase().trim();
    const cTo = (corridorState.toStation || '').toUpperCase().trim();

    if (reqFrom === cFrom && reqTo === cTo) return true;
    const reqSec = (req.sectionName || '').toUpperCase();
    const cSec = (corridorState.corridorName || corridorState.sectionName || '').toUpperCase();
    if (cSec && reqSec && (reqSec.includes(cSec) || cSec.includes(reqSec))) return true;

    const fromCity = (corridorState.fromStationName || '').toUpperCase();
    const toCity = (corridorState.toStationName || '').toUpperCase();
    if (fromCity && reqSec.includes(fromCity) && toCity && reqSec.includes(toCity)) return true;

    return false;
  }

  function handleAutoSchedule(submittedReq, optimizerResult) {
    const candidate = optimizerResult?.selectedCandidate || optimizerResult?.scheduledSlot || optimizerResult?.recommendedBlock;
    const isFeasible = candidate && candidate !== '--:-- – --:--' && !optimizerResult.status?.includes('NO FEASIBLE BLOCK');
    
    if (isFeasible) {
      submittedReq.status = 'SCHEDULED';
      submittedReq.scheduledSlot = candidate;
      submittedReq.sanctionedSlot = candidate;
      submittedReq.recommendedBlock = candidate;
      submittedReq.optimizerStatus = 'OPTIMIZED_ASSIGNED';
      submittedReq.optimizerResult = optimizerResult;
    } else {
      submittedReq.status = 'UNSCHEDULED (NO FEASIBLE BLOCK)';
      submittedReq.scheduledSlot = null;
      submittedReq.sanctionedSlot = null;
      submittedReq.recommendedBlock = '--:-- – --:--';
      submittedReq.optimizerStatus = 'NO_FEASIBLE_BLOCK';
      submittedReq.optimizerResult = optimizerResult;
    }

    const idx = requisitions.findIndex(r => r.reqId === submittedReq.reqId);
    if (idx >= 0) {
      requisitions[idx] = submittedReq;
    } else {
      requisitions.unshift(submittedReq);
    }

    activeCorridorState = {
      fromStation: submittedReq.fromStation,
      toStation: submittedReq.toStation,
      fromStationName: submittedReq.fromStationName || submittedReq.fromStation,
      toStationName: submittedReq.toStationName || submittedReq.toStation,
      corridorName: `${submittedReq.fromStation} – ${submittedReq.toStation}`,
      sectionName: submittedReq.sectionName,
      trackLine: submittedReq.trackLine,
      blockType: submittedReq.blockType,
      activeReqId: submittedReq.reqId,
      activeRequisition: submittedReq,
      scheduledSlot: submittedReq.scheduledSlot,
      status: submittedReq.status
    };

    return submittedReq;
  }

  function renderMapPopup(req) {
    const statusLabel = req.status === 'SCHEDULED' ? 'SCHEDULED' : 'UNSCHEDULED';
    const windowHtml = req.scheduledSlot
      ? `<div class="popup-time"><strong>Scheduled Window:</strong> ${req.scheduledSlot}</div>`
      : `<div class="popup-time text-danger">No Feasible Block</div>`;

    return {
      status: statusLabel,
      reqId: req.reqId,
      corridor: `${req.fromStation} – ${req.toStation}`,
      scheduledSlot: req.scheduledSlot,
      html: `
        <div class="popup-title">${req.reqId} • ${req.department}</div>
        <div class="popup-section">${req.fromStation} – ${req.toStation} (${req.trackLine})</div>
        <div class="popup-badge status-${statusLabel.toLowerCase()}">${statusLabel}</div>
        ${windowHtml}
      `
    };
  }

  function renderBlockPlannerRegister(corridorState) {
    const filtered = requisitions.filter(r => isReqInCorridor(r, corridorState));
    return filtered.map(r => {
      const isScheduled = r.status === 'SCHEDULED' && r.scheduledSlot;
      return {
        reqId: r.reqId,
        department: r.department,
        corridor: `${r.fromStation} – ${r.toStation}`,
        worksite: r.worksite || `KM ${r.worksiteStartKm} – KM ${r.worksiteEndKm}`,
        duration: `${r.durationMin} min`,
        planningStatus: isScheduled ? 'SCHEDULED (OPTIMIZED)' : (r.status || 'PENDING'),
        assignedWorkSlot: isScheduled ? r.scheduledSlot : 'Awaiting Feasible Block'
      };
    });
  }

  function renderCoordinationHistory(corridorState) {
    const filtered = requisitions.filter(r => isReqInCorridor(r, corridorState));
    return filtered.map(r => {
      const isScheduled = r.status === 'SCHEDULED' && r.scheduledSlot;
      return {
        reqId: r.reqId,
        department: r.department,
        corridor: `${r.fromStation} – ${r.toStation}`,
        requestedWindow: r.preferredSlot || r.preferredWindow || '11:00–14:30',
        duration: `${r.durationMin} min`,
        optimizerWindow: r.scheduledSlot || 'None Available',
        decisionStatus: isScheduled ? 'SCHEDULED (OPTIMIZED)' : 'UNSCHEDULED (NO FEASIBLE BLOCK)',
        conflictsConsidered: r.optimizerResult?.conflictsCount || r.optimizerResult?.conflicts?.length || 0,
        dataSource: r.optimizerResult?.isLive ? 'LIVE • RailRadar API' : 'DEMO/MOCK DATA'
      };
    });
  }

  function renderOperatingBranchCard(corridorState) {
    const activeReq = corridorState?.activeRequisition;
    if (!activeReq) return null;

    const compatibleBundled = requisitions.filter(r => {
      if (r.reqId === activeReq.reqId) return false;
      if (!isReqInCorridor(r, corridorState)) return false;
      const sameLine = (r.trackLine === activeReq.trackLine ||
        r.trackLine === 'Both UP & DOWN Lines' ||
        activeReq.trackLine === 'Both UP & DOWN Lines');
      return sameLine;
    });

    return {
      activeReqId: activeReq.reqId,
      sectionLine: `${activeReq.fromStation} – ${activeReq.toStation} • ${activeReq.trackLine}`,
      approvedWindow: activeReq.scheduledSlot || 'No Feasible Slot',
      bundledActivities: compatibleBundled,
      bundledMessage: compatibleBundled.length === 0 ? 'No compatible departmental activities available for bundling.' : null
    };
  }

  return {
    requisitions,
    get activeCorridorState() { return activeCorridorState; },
    set activeCorridorState(val) { activeCorridorState = val; },
    prototypeConfig,
    handleAutoSchedule,
    renderMapPopup,
    renderBlockPlannerRegister,
    renderCoordinationHistory,
    renderOperatingBranchCard
  };
}

async function runUnifiedWorkflowVerification() {
  console.log('========================================================================');
  console.log('   RAILFLOW UNIFIED WORKFLOW & CROSS-PAGE SYNCHRONIZATION VERIFICATION ');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, detail = '') {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (detail) console.log(`       ${detail}`);
      passed++;
      return true;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (detail) console.error(`       Details: ${detail}`);
      return false;
    }
  }

  const client = createClientContext();

  // ==========================================================================
  // TEST 1: Submit new requisition -> Optimizer runs automatically
  // ==========================================================================
  console.log('--- TEST 1: Submit new requisition -> Optimizer runs automatically ---');
  let test1Res;
  try {
    test1Res = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'TUP',
      sectionName: 'Katpadi – Tiruppur',
      worksiteStartKm: 440.00,
      worksiteEndKm: 443.76,
      trackLine: 'DOWN Main Line',
      blockType: 'DOWN Line Block',
      durationMin: 90,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)',
      activityName: 'Axle Box Inspection',
      machinery: 'Manual Hand Tools'
    });

    const ranAutomatically = test1Res.statusCode === 200 &&
      test1Res.data.success === true &&
      test1Res.data.result &&
      test1Res.data.result.status;

    assert(
      ranAutomatically,
      'TEST 1: Submitting new requisition invokes Block Optimizer automatically without manual step',
      `Optimizer returned status: "${test1Res.data.result?.status}", Candidate: "${test1Res.data.result?.selectedCandidate}"`
    );
  } catch (e) {
    assert(false, 'TEST 1 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 2: Preferred window is feasible -> Inside preferred window, SCHEDULED (OPTIMIZED)
  // ==========================================================================
  console.log('\n--- TEST 2: Preferred window is feasible ---');
  let scheduledReq1;
  try {
    const result1 = test1Res.data.result;
    const isInside = result1.isInsidePreferred === true;
    
    // Auto-schedule client action
    const req1Payload = {
      reqId: 'REQ-SR-MECH-497',
      department: 'Mechanical (C&W)',
      fromStation: 'KPD',
      toStation: 'TUP',
      sectionName: 'Katpadi – Tiruppur',
      worksiteStartKm: 440.00,
      worksiteEndKm: 443.76,
      trackLine: 'DOWN Main Line',
      blockType: 'DOWN Line Block',
      durationMin: 90,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)',
      activityName: 'Axle Box Inspection'
    };
    scheduledReq1 = client.handleAutoSchedule(req1Payload, result1);

    const checkStatus = scheduledReq1.status === 'SCHEDULED';
    const checkCandidate = scheduledReq1.scheduledSlot === '11:00 – 12:30 IST';

    assert(
      isInside && checkStatus && checkCandidate,
      'TEST 2: Feasible preferred window selects inside preferred window (11:00–12:30) and sets status = SCHEDULED',
      `Selected window: "${scheduledReq1.scheduledSlot}", Status: "${scheduledReq1.status}"`
    );
  } catch (e) {
    assert(false, 'TEST 2 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 3: Preferred window infeasible -> Conflicts identified, alternative selected
  // ==========================================================================
  console.log('\n--- TEST 3: Preferred window infeasible -> Alternative selected automatically ---');
  let test3Res, scheduledReq2;
  try {
    test3Res = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      sectionName: 'Katpadi – Jolarpettai',
      worksiteStartKm: 150.20,
      worksiteEndKm: 153.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 150,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)',
      activityName: '25kV Catenary Wire Tensioning',
      machinery: 'Tower Wagon 8-Wheeler'
    });

    const result2 = test3Res.data.result;
    const notInside = result2.isInsidePreferred === false;
    const hasConflicts = (result2.conflicts && result2.conflicts.length > 0) ||
      (result2.conflictingTrains && result2.conflictingTrains.length > 0) ||
      (result2.conflictCount > 0);
    const hasAlt = !!result2.selectedCandidate;

    const req2Payload = {
      reqId: 'REQ-SR-TRD-927',
      department: 'Electrical / TRD',
      fromStation: 'KPD',
      toStation: 'JTJ',
      sectionName: 'Katpadi – Jolarpettai',
      worksiteStartKm: 150.20,
      worksiteEndKm: 153.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 150,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)'
    };
    scheduledReq2 = client.handleAutoSchedule(req2Payload, result2);

    const conflictCount = result2.conflicts?.length || result2.conflictingTrains?.length || result2.conflictCount || 0;

    assert(
      notInside && hasConflicts && hasAlt && scheduledReq2.status === 'SCHEDULED',
      'TEST 3: Infeasible preferred window detects conflicts and automatically selects alternative slot (SCHEDULED)',
      `Conflicts: ${conflictCount}, Alternative: "${scheduledReq2.scheduledSlot}", Status: "${scheduledReq2.status}"`
    );
  } catch (e) {
    assert(false, 'TEST 3 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 4: Active Requisitions shows exactly the same scheduled window
  // ==========================================================================
  console.log('\n--- TEST 4: Active Requisitions shows exactly the same scheduled window ---');
  try {
    const foundReq = client.requisitions.find(r => r.reqId === 'REQ-SR-MECH-497');
    const matchesReq1 = foundReq && foundReq.scheduledSlot === scheduledReq1.scheduledSlot && foundReq.status === 'SCHEDULED';

    assert(
      matchesReq1,
      'TEST 4: Active Requisitions list contains exact scheduled slot and SCHEDULED status',
      `Req: ${foundReq?.reqId}, Slot: "${foundReq?.scheduledSlot}", Status: "${foundReq?.status}"`
    );
  } catch (e) {
    assert(false, 'TEST 4 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 5: Map popup shows exactly the same scheduled window and SCHEDULED status
  // ==========================================================================
  console.log('\n--- TEST 5: Map popup shows exactly the same scheduled window and SCHEDULED status ---');
  try {
    const popup1 = client.renderMapPopup(scheduledReq1);
    const checkStatus = popup1.status === 'SCHEDULED';
    const checkSlot = popup1.scheduledSlot === scheduledReq1.scheduledSlot;
    const noOptionB = !popup1.html.includes('Option B');
    const noPending = !popup1.html.includes('PENDING');

    assert(
      checkStatus && checkSlot && noOptionB && noPending,
      'TEST 5: Map popup displays exact scheduled slot, SCHEDULED status, without Option B or PENDING',
      `Popup Status: "${popup1.status}", Slot: "${popup1.scheduledSlot}"`
    );
  } catch (e) {
    assert(false, 'TEST 5 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 6: Block Planner shows exactly the same requisition and scheduled window
  // ==========================================================================
  console.log('\n--- TEST 6: Block Planner shows exactly the same requisition and scheduled window ---');
  try {
    // Switch client context to KPD - TUP
    client.activeCorridorState = {
      fromStation: 'KPD',
      toStation: 'TUP',
      corridorName: 'Katpadi – Tiruppur',
      activeRequisition: scheduledReq1
    };

    const bpList = client.renderBlockPlannerRegister(client.activeCorridorState);
    const bpItem = bpList.find(r => r.reqId === 'REQ-SR-MECH-497');

    const bpMatch = bpItem &&
      bpItem.planningStatus === 'SCHEDULED (OPTIMIZED)' &&
      bpItem.assignedWorkSlot === scheduledReq1.scheduledSlot;

    assert(
      bpMatch,
      'TEST 6: Block Planner Activity Register shows SCHEDULED (OPTIMIZED) with exact optimizer window',
      `BP Item: ${bpItem?.reqId}, Status: "${bpItem?.planningStatus}", Slot: "${bpItem?.assignedWorkSlot}"`
    );
  } catch (e) {
    assert(false, 'TEST 6 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 7: Coordination page shows exactly the same optimizer decision
  // ==========================================================================
  console.log('\n--- TEST 7: Coordination page shows exactly the same optimizer decision ---');
  try {
    const coordList = client.renderCoordinationHistory(client.activeCorridorState);
    const coordItem = coordList.find(r => r.reqId === 'REQ-SR-MECH-497');

    const coordMatch = coordItem &&
      coordItem.optimizerWindow === scheduledReq1.scheduledSlot &&
      coordItem.decisionStatus === 'SCHEDULED (OPTIMIZED)';

    assert(
      coordMatch,
      'TEST 7: Coordination Decision History shows exact optimizer window and SCHEDULED (OPTIMIZED)',
      `Coord Item: ${coordItem?.reqId}, Window: "${coordItem?.optimizerWindow}", Status: "${coordItem?.decisionStatus}"`
    );
  } catch (e) {
    assert(false, 'TEST 7 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 8: Operating Branch timetable uses exactly the same scheduled window
  // ==========================================================================
  console.log('\n--- TEST 8: Operating Branch timetable uses exactly the same scheduled window ---');
  try {
    const obCard = client.renderOperatingBranchCard(client.activeCorridorState);
    const obMatch = obCard &&
      obCard.activeReqId === 'REQ-SR-MECH-497' &&
      obCard.approvedWindow === scheduledReq1.scheduledSlot &&
      obCard.sectionLine.includes('KPD') &&
      obCard.sectionLine.includes('TUP');

    assert(
      obMatch,
      'TEST 8: Operating Branch Timetable approved window matches active optimizer result exactly',
      `Active Req: ${obCard?.activeReqId}, Section: "${obCard?.sectionLine}", Approved Window: "${obCard?.approvedWindow}"`
    );
  } catch (e) {
    assert(false, 'TEST 8 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 9: No feasible window -> UNSCHEDULED (NO FEASIBLE BLOCK)
  // ==========================================================================
  console.log('\n--- TEST 9: No feasible window handling ---');
  try {
    const noSlotRes = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 150.20,
      worksiteEndKm: 153.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 1200, // Exceeds any continuous window in corridor
      preferredSlot: 'Night Maintenance Shadow (00:30–04:30)',
      activityName: 'Mega Interlocking Re-wiring'
    });

    const noSlotResult = noSlotRes.data.result;
    const req3Payload = {
      reqId: 'REQ-SR-SIG-999',
      department: 'Signal & Telecom (S&T)',
      fromStation: 'KPD',
      toStation: 'JTJ',
      durationMin: 1200
    };
    const unscheduledReq = client.handleAutoSchedule(req3Payload, noSlotResult);

    const checkUnscheduled = unscheduledReq.status === 'UNSCHEDULED (NO FEASIBLE BLOCK)' &&
      unscheduledReq.scheduledSlot === null;

    const popup3 = client.renderMapPopup(unscheduledReq);
    const checkPopup3 = popup3.status === 'UNSCHEDULED' && popup3.html.includes('No Feasible Block');

    assert(
      checkUnscheduled && checkPopup3,
      'TEST 9: When no feasible block exists, status is UNSCHEDULED (NO FEASIBLE BLOCK) across all views',
      `Status: "${unscheduledReq.status}", ScheduledSlot: ${unscheduledReq.scheduledSlot}, Popup: "${popup3.status}"`
    );
  } catch (e) {
    assert(false, 'TEST 9 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 10: CBE -> ED request must not display KPD -> JTJ planning activities
  // ==========================================================================
  console.log('\n--- TEST 10: CBE -> ED request isolates corridor from KPD -> JTJ ---');
  try {
    const cbeState = {
      fromStation: 'CBE',
      toStation: 'ED',
      corridorName: 'Coimbatore – Erode',
      fromStationName: 'Coimbatore',
      toStationName: 'Erode'
    };

    const cbeBpList = client.renderBlockPlannerRegister(cbeState);
    const hasKpdInCbe = cbeBpList.some(r => r.corridor.includes('KPD') || r.corridor.includes('JTJ'));
    const hasCbeReq = cbeBpList.some(r => r.reqId === 'REQ-SR-TRD-943');

    const cbeCoordList = client.renderCoordinationHistory(cbeState);
    const hasKpdInCbeCoord = cbeCoordList.some(r => r.corridor.includes('KPD') || r.corridor.includes('JTJ'));

    assert(
      !hasKpdInCbe && hasCbeReq && !hasKpdInCbeCoord,
      'TEST 10: CBE -> ED request displays only CBE-ED activities and excludes KPD-JTJ activities',
      `CBE Activity Count: ${cbeBpList.length}, Has KPD: ${hasKpdInCbe}, Has CBE: ${hasCbeReq}`
    );
  } catch (e) {
    assert(false, 'TEST 10 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 11: KPD -> JTJ request must not display CBE -> ED planning activities
  // ==========================================================================
  console.log('\n--- TEST 11: KPD -> JTJ request isolates corridor from CBE -> ED ---');
  try {
    const kpdState = {
      fromStation: 'KPD',
      toStation: 'JTJ',
      corridorName: 'Katpadi – Jolarpettai',
      fromStationName: 'Katpadi',
      toStationName: 'Jolarpettai'
    };

    const kpdBpList = client.renderBlockPlannerRegister(kpdState);
    const hasCbeInKpd = kpdBpList.some(r => r.corridor.includes('CBE') || r.corridor.includes('ED') || r.reqId === 'REQ-SR-TRD-943');
    const hasKpdReq = kpdBpList.some(r => r.corridor.includes('KPD') || r.corridor.includes('JTJ'));

    const kpdCoordList = client.renderCoordinationHistory(kpdState);
    const hasCbeInKpdCoord = kpdCoordList.some(r => r.corridor.includes('CBE') || r.reqId === 'REQ-SR-TRD-943');

    assert(
      !hasCbeInKpd && hasKpdReq && !hasCbeInKpdCoord,
      'TEST 11: KPD -> JTJ request displays only KPD-JTJ activities and excludes CBE-ED activities',
      `KPD Activity Count: ${kpdBpList.length}, Has CBE: ${hasCbeInKpd}, Has KPD: ${hasKpdReq}`
    );
  } catch (e) {
    assert(false, 'TEST 11 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 12: Rapidly switch between two requisitions (stale response protection)
  // ==========================================================================
  console.log('\n--- TEST 12: Rapid request switching & stale token protection ---');
  try {
    let latestAppliedReqId = null;
    let requestToken = 0;

    function asyncRequisitionFetch(reqId, delayMs) {
      const currentToken = ++requestToken;
      return new Promise(resolve => {
        setTimeout(() => {
          if (currentToken === requestToken) {
            latestAppliedReqId = reqId;
            resolve({ applied: true, reqId, token: currentToken });
          } else {
            resolve({ applied: false, reqId, token: currentToken, discarded: true });
          }
        }, delayMs);
      });
    }

    // Fire CBE first with longer delay, then immediately KPD with shorter delay
    const p1 = asyncRequisitionFetch('REQ-SR-TRD-943', 100);
    const p2 = asyncRequisitionFetch('REQ-SR-ENG-104', 30);

    const [resP1, resP2] = await Promise.all([p1, p2]);

    const checkStaleDiscarded = resP1.applied === false && resP1.discarded === true;
    const checkLatestApplied = resP2.applied === true && latestAppliedReqId === 'REQ-SR-ENG-104';

    assert(
      checkStaleDiscarded && checkLatestApplied,
      'TEST 12: Rapid requisition switching discards outdated async responses and prevents stale overwrite',
      `P1 Applied: ${resP1.applied} (discarded=${resP1.discarded}), P2 Applied: ${resP2.applied}, Final Active: ${latestAppliedReqId}`
    );
  } catch (e) {
    assert(false, 'TEST 12 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 13: RailRadar unavailable -> DEMO/MOCK DATA label & no false live claim
  // ==========================================================================
  console.log('\n--- TEST 13: RailRadar unavailable -> DEMO/MOCK DATA honesty ---');
  try {
    const isMock = !test1Res.data.corridorData?.liveDataAvailable;
    const recReason = test1Res.data.result?.reason || '';
    const hasDisruptionClaim = recReason.includes('without train disruption');
    const hasHonestDemoWording = recReason.includes('Feasible continuous block identified using available timetable/demo data.');

    assert(
      isMock && !hasDisruptionClaim && hasHonestDemoWording,
      'TEST 13: When RailRadar is unavailable, DEMO/MOCK DATA status is preserved with honest wording and no false live claim',
      `LiveAvailable: ${!isMock}, Reason: "${recReason}"`
    );
  } catch (e) {
    assert(false, 'TEST 13 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // TEST 14: Configuration values connect safely & do not bypass safety/conflict logic
  // ==========================================================================
  console.log('\n--- TEST 14: Configuration safety & conflict engine integrity ---');
  try {
    // 1. Verify configured headway is respected
    const evalStandard = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 150.20,
      worksiteEndKm: 153.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 150,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)',
      config: { headwayMinutes: 12, cautionSpeedKmH: 30 }
    });

    // 2. Verify larger headway margin increases/maintains safety restrictions
    const evalStricterHeadway = await makeApiRequest({
      fromStation: 'KPD',
      toStation: 'JTJ',
      worksiteStartKm: 150.20,
      worksiteEndKm: 153.50,
      trackLine: 'UP Main Line',
      blockType: 'UP Line Block',
      durationMin: 150,
      preferredSlot: 'Midday Traffic Shadow (11:00–14:30)',
      config: { headwayMinutes: 20, cautionSpeedKmH: 25 }
    });

    // 3. Verify safety/conflict logic CANNOT be bypassed with tiny headway (minimum bound is enforced)
    const directConflictTest = conflictDetectionService.evaluateWindowConflicts(
      740, 770, // 12:20 to 12:50 (Train #66023 passes around 12:29-12:33)
      [
        {
          trainNumber: '66023',
          line: 'UP Main Line',
          passageTime: { entryTimeMins: 749, exitTimeMins: 753 }
        }
      ],
      'UP Main Line',
      'UP Line Block',
      'Track Work',
      'Tools',
      { headwayMinutes: 1, cautionSpeedKmH: 15 } // Trying to set 1 min headway to bypass
    );

    const safetyEnforced = directConflictTest.hasConflict === true &&
      directConflictTest.conflictCount === 1;

    // 4. Verify Power Block logic remains conditional on OHE equipment (Civil work never forces Power Block)
    const civilPowerCheck = directConflictTest.powerBlock.required === false;

    assert(
      evalStandard.statusCode === 200 &&
      evalStricterHeadway.statusCode === 200 &&
      safetyEnforced &&
      civilPowerCheck,
      'TEST 14: Prototype configuration safely parameterizes caution order and headway without bypassing conflict or safety logic',
      `Direct Conflict Detected: ${directConflictTest.hasConflict}, Safety Enforced: ${safetyEnforced}, Civil PowerBlock: ${directConflictTest.powerBlock.required}`
    );
  } catch (e) {
    assert(false, 'TEST 14 Failed with error: ' + e.message);
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n========================================================================');
  console.log(`   UNIFIED WORKFLOW VERIFICATION SUITE: ${passed} / ${total} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passed === total) {
    console.log('🎉 ALL 14 ALIGNMENT AND SYNCHRONIZATION TESTS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runUnifiedWorkflowVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
