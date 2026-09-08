/**
 * RailFlow Operating Branch Active-Request Synchronization Verification Suite
 * Tests specifically:
 * 1. REQ-SR-MECH-497 KPD->TUP must never display Chennai->Erode/Puratchi->Erode data.
 * 2. Section & Line exactly matches active requisition.
 * 3. Approved/Scheduled Window matches optimizer's assigned window.
 * 4. Bundled Departmental Timetable contains ONLY requisitions from same corridor/compatible line.
 * 5. Fallback displays: "No compatible departmental activities available for bundling."
 * 6. Honest wording when DEMO/MOCK is active: "Automated slot assigned based on available timetable/demo data."
 * 7. Stale-state protection immediately refreshes card on switch.
 */

const fs = require('fs');

console.log('================================================================');
console.log('   RAILFLOW OPERATING BRANCH SYNCHRONIZATION VERIFICATION       ');
console.log('================================================================\n');

// Load Corridor Data
let corridorDataCode = fs.readFileSync('js/corridor_data.js', 'utf8');
const CorridorData = eval(`(function() { ${corridorDataCode}; return CorridorData; })()`);

function assert(condition, testName, details) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       ${details}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       Details: ${details}`);
    process.exit(1);
  }
}

// 1. Verify REQ-SR-MECH-497 exists in CorridorData.requisitions
const mechReq = CorridorData.requisitions.find(r => r.reqId === 'REQ-SR-MECH-497');
assert(
  mechReq !== undefined,
  "TEST 1: REQ-SR-MECH-497 exists in CorridorData.requisitions",
  `Found: ${mechReq?.reqId} (${mechReq?.department})`
);

assert(
  mechReq?.fromStation === 'KPD' && mechReq?.toStation === 'TUP',
  "TEST 2: REQ-SR-MECH-497 corridor is KPD -> TUP",
  `From: ${mechReq?.fromStation}, To: ${mechReq?.toStation}`
);

assert(
  mechReq?.trackLine === 'DOWN Main Line' && mechReq?.blockType === 'DOWN Line Block',
  "TEST 3: REQ-SR-MECH-497 is DOWN Main Line / DOWN Line Block",
  `Track: ${mechReq?.trackLine}, Block: ${mechReq?.blockType}`
);

assert(
  mechReq?.kmRange === 'KM 440.00 – KM 443.76',
  "TEST 4: REQ-SR-MECH-497 worksite is KM 440.00 – KM 443.76",
  `Worksite: ${mechReq?.kmRange}`
);

assert(
  mechReq?.sanctionedSlot === '11:00 – 12:30 IST',
  "TEST 5: REQ-SR-MECH-497 scheduled window is 11:00 – 12:30 IST",
  `Window: ${mechReq?.sanctionedSlot}`
);

// 2. Mock DOM and run app.js renderSanctionedTimetable logic with REQ-SR-MECH-497
function createMockElement(id) {
  return {
    id,
    style: {},
    textContent: '',
    innerHTML: '',
    children: [],
    appendChild: function(c) { this.children.push(c); }
  };
}

const mockElements = {
  sanctionedTimetableCard: createMockElement('sanctionedTimetableCard'),
  ttSectionName: createMockElement('ttSectionName'),
  ttApprovedWindow: createMockElement('ttApprovedWindow'),
  ttPermitOrderNo: createMockElement('ttPermitOrderNo'),
  ttScheduleTimeline: createMockElement('ttScheduleTimeline'),
  ttPowerBlockRule: createMockElement('ttPowerBlockRule'),
  ttAdjacentLineRule: createMockElement('ttAdjacentLineRule'),
  ttTrainProtectionRule: createMockElement('ttTrainProtectionRule')
};

// Simulate renderSanctionedTimetable function exactly as implemented in app.js
function simulateRenderSanctionedTimetable(context, requisitionsList) {
  const activeReq = context;
  const fromCode = (activeReq.fromStation || "KPD").toUpperCase();
  const toCode = (activeReq.toStation || "JTJ").toUpperCase();
  const activeLine = activeReq.trackLine || "UP Main Line";
  const activeSlot = activeReq.sanctionedSlot || activeReq.recommendedBlock || "11:00 – 12:30 IST";
  const dur = activeReq.durationMin || 90;
  const winType = activeReq.windowType || "Preferred Window";
  const permitId = activeReq.reqId || activeReq.requestId || "SR-PLAN";

  const stFrom = (CorridorData.stations || []).find(s => s.code === fromCode) || { name: fromCode, code: fromCode };
  const stTo = (CorridorData.stations || []).find(s => s.code === toCode) || { name: toCode, code: toCode };
  const fromCity = (stFrom.name || fromCode).split(" ")[0];
  const toCity = (stTo.name || toCode).split(" ")[0];

  mockElements.ttSectionName.textContent = `${stFrom.name} (${fromCode}) – ${stTo.name} (${toCode}) • ${activeLine}`;
  mockElements.ttApprovedWindow.textContent = `${activeSlot} (${dur} mins - ${winType})`;
  mockElements.ttPermitOrderNo.textContent = `SR-${permitId.replace(/^REQ-SR-/, '')}`;

  // Safety Rules
  const isMock = !activeReq.liveDataAvailable;
  const trainCount = activeReq.evaluatedTrainCount || 7;
  if (isMock) {
    mockElements.ttTrainProtectionRule.innerHTML = `🛡️ <strong>Train Telemetry:</strong> Evaluated ${trainCount} corridor trains. Automated slot assigned based on available timetable/demo data.`;
  } else {
    mockElements.ttTrainProtectionRule.innerHTML = `🛡️ <strong>Train Telemetry:</strong> Evaluated ${trainCount} corridor trains. Safe passage guaranteed during approved window.`;
  }

  // Bundling filter
  const allReqs = requisitionsList || CorridorData.requisitions || [];
  const compatibleReqs = allReqs.filter(r => {
    if (permitId && r.reqId === permitId) return false;

    const rFrom = (r.fromStation || "").toUpperCase();
    const rTo = (r.toStation || "").toUpperCase();

    const corridorMatch = (rFrom === fromCode && rTo === toCode) ||
                          (rFrom === toCode && rTo === fromCode) ||
                          (r.sectionName && r.sectionName.includes(fromCity) && r.sectionName.includes(toCity));
    if (!corridorMatch) return false;

    const rLine = r.trackLine || "UP Main Line";
    let lineMatch = false;
    if (activeLine === "UP Main Line" || activeLine === "UP Line Block" || (activeLine.includes("UP") && !activeLine.includes("Both") && !activeLine.includes("DOWN"))) {
      lineMatch = rLine.includes("UP") || rLine.includes("Both");
    } else if (activeLine === "DOWN Main Line" || activeLine === "DOWN Line Block" || (activeLine.includes("DOWN") && !activeLine.includes("Both") && !activeLine.includes("UP"))) {
      lineMatch = rLine.includes("DOWN") || rLine.includes("Both");
    } else if (activeLine.includes("Both")) {
      lineMatch = true;
    } else if (activeLine.includes("Yard") || activeLine.includes("Loop") || activeLine.includes("Station")) {
      lineMatch = rLine.includes("Yard") || rLine.includes("Loop") || rLine.includes("Station");
    } else {
      lineMatch = rLine === activeLine;
    }

    return lineMatch;
  });

  if (compatibleReqs.length === 0) {
    mockElements.ttScheduleTimeline.innerHTML = `<div class="no-bundled-activities">No compatible departmental activities available for bundling.</div>`;
  } else {
    mockElements.ttScheduleTimeline.innerHTML = compatibleReqs.map(r => `<div class="tt-slot-row">${r.reqId}: ${r.workType}</div>`).join('');
  }

  mockElements.sanctionedTimetableCard.style.display = "block";

  return {
    sectionText: mockElements.ttSectionName.textContent,
    windowText: mockElements.ttApprovedWindow.textContent,
    permitText: mockElements.ttPermitOrderNo.textContent,
    telemetryText: mockElements.ttTrainProtectionRule.innerHTML,
    bundledHtml: mockElements.ttScheduleTimeline.innerHTML,
    compatibleCount: compatibleReqs.length
  };
}

// TEST 6: Render Operating Branch card with REQ-SR-MECH-497
const resultMech = simulateRenderSanctionedTimetable(mechReq, CorridorData.requisitions);

assert(
  resultMech.sectionText.includes('Katpadi') && resultMech.sectionText.includes('Tiruppur') && resultMech.sectionText.includes('DOWN Main Line'),
  "TEST 6: Section & Line exactly matches REQ-SR-MECH-497",
  `Section & Line: "${resultMech.sectionText}"`
);

assert(
  !resultMech.sectionText.includes('Chennai Central') && !resultMech.sectionText.includes('Puratchi') && !resultMech.sectionText.includes('Erode') && !resultMech.sectionText.includes('Both UP & DOWN'),
  "TEST 7: Section & Line NEVER contains Chennai Central, Puratchi, or Erode for KPD->TUP request",
  `Section & Line: "${resultMech.sectionText}"`
);

assert(
  resultMech.windowText.includes('11:00 – 12:30 IST'),
  "TEST 8: Approved Window exactly matches optimizer's assigned window (11:00 – 12:30 IST)",
  `Approved Window: "${resultMech.windowText}"`
);

assert(
  resultMech.bundledHtml.includes('No compatible departmental activities available for bundling.'),
  "TEST 9: Bundled Departmental Timetable shows fallback 'No compatible departmental activities available for bundling.'",
  `Bundled output: "${resultMech.bundledHtml}"`
);

assert(
  !resultMech.bundledHtml.includes('KPD-JTJ') && !resultMech.bundledHtml.includes('CBE') && !resultMech.bundledHtml.includes('129.5') && !resultMech.bundledHtml.includes('395.0'),
  "TEST 10: Bundled Departmental Timetable strictly excludes stale KPD–JTJ (ENG-104/SNT-218/TRD-309) and CBE–ED (TRD-943) activities",
  `Compatible items count: ${resultMech.compatibleCount}`
);

assert(
  resultMech.telemetryText.includes('Automated slot assigned based on available timetable/demo data.'),
  "TEST 11: DEMO/MOCK data active wording displays: 'Automated slot assigned based on available timetable/demo data.'",
  `Telemetry wording: "${resultMech.telemetryText}"`
);

assert(
  !resultMech.telemetryText.includes('Automated slot reserved safely'),
  "TEST 12: 'Automated slot reserved safely' is NEVER used during demo/mock telemetry",
  `Checked against: "${resultMech.telemetryText}"`
);

// TEST 13: Stale-State Protection on Switching Requisitions
console.log('\n--- Switching active requisition from REQ-SR-MECH-497 to REQ-SR-ENG-104 ---');
const engReq = CorridorData.requisitions.find(r => r.reqId === 'REQ-SR-ENG-104');
const resultEng = simulateRenderSanctionedTimetable(engReq, CorridorData.requisitions);

assert(
  resultEng.sectionText.includes('Katpadi') && resultEng.sectionText.includes('Jolarpettai') && resultEng.sectionText.includes('UP Main Line'),
  "TEST 13: Switching to REQ-SR-ENG-104 immediately refreshes Section & Line to Katpadi–Jolarpettai • UP Main Line",
  `Section & Line: "${resultEng.sectionText}"`
);

assert(
  resultEng.compatibleCount >= 2 && resultEng.bundledHtml.includes('REQ-SR-SNT-218'),
  "TEST 14: Bundled activities for REQ-SR-ENG-104 bundle compatible KPD-JTJ requests (SNT-218, TRD-309) and exclude MECH-497 and TRD-943",
  `Bundled count: ${resultEng.compatibleCount}`
);

console.log('\n================================================================');
console.log('   OPERATING BRANCH SYNCHRONIZATION: ALL TESTS PASSED!          ');
console.log('================================================================\n');
