const fs = require('fs');

const CorridorData = require('../js/corridor_data.js');

console.log('====================================================');
console.log('       RAILWAY TRACK ALIGNMENT VERIFICATION         ');
console.log('====================================================\n');

let pass = 0, fail = 0;
function assert(cond, desc) {
  if (cond) {
    pass++;
    console.log(`[PASS] ${desc}`);
  } else {
    fail++;
    console.log(`[FAIL] ${desc}`);
  }
}

// 1. Check trackGeometry exists and has detailed points
assert(CorridorData.trackGeometry != null, 'CorridorData.trackGeometry is defined');
assert(Array.isArray(CorridorData.trackGeometry.trunkLine1) && CorridorData.trackGeometry.trunkLine1.length > 50,
  `Trunk Line 1 (Blue Mainline) has high resolution (${CorridorData.trackGeometry.trunkLine1.length} points)`);
assert(Array.isArray(CorridorData.trackGeometry.trunkLine2) && CorridorData.trackGeometry.trunkLine2.length > 50,
  `Trunk Line 2 (Green Chord) has high resolution (${CorridorData.trackGeometry.trunkLine2.length} points)`);
assert(Array.isArray(CorridorData.trackGeometry.feederRoutes) && CorridorData.trackGeometry.feederRoutes.length >= 7,
  `Feeder routes count: ${CorridorData.trackGeometry.feederRoutes.length}`);

// 2. Check station proximity to track lines (within railway yard width < 0.1km)
const t1Codes = ["MAS", "AJJ", "KPD", "JTJ", "MAP", "SA", "ED", "TUP", "CBE"];
t1Codes.forEach(code => {
  const st = CorridorData.stations.find(s => s.code === code);
  let minDist = Infinity;
  CorridorData.trackGeometry.trunkLine1.forEach(pt => {
    const d = Math.hypot(pt[0] - st.lat, (pt[1] - st.lng) * Math.cos(st.lat * Math.PI / 180)) * 111;
    if (d < minDist) minDist = d;
  });
  assert(minDist < 0.1, `Station ${code} sits directly on blue track (offset: ${(minDist * 1000).toFixed(1)} m)`);
});

// 3. Test track slicing function
function sliceTrackGeometry(polyline, stFrom, stTo) {
  if (!polyline || polyline.length === 0 || !stFrom || !stTo) return null;
  let fromIdx = -1, toIdx = -1;
  let minFromDist = Infinity, minToDist = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const dFrom = Math.hypot(polyline[i][0] - stFrom.lat, polyline[i][1] - stFrom.lng);
    if (dFrom < minFromDist) {
      minFromDist = dFrom;
      fromIdx = i;
    }
    const dTo = Math.hypot(polyline[i][0] - stTo.lat, polyline[i][1] - stTo.lng);
    if (dTo < minToDist) {
      minToDist = dTo;
      toIdx = i;
    }
  }
  if (minFromDist > 0.2 || minToDist > 0.2) return null;
  if (fromIdx <= toIdx) {
    return polyline.slice(fromIdx, toIdx + 1);
  } else {
    return polyline.slice(toIdx, fromIdx + 1).reverse();
  }
}

const getSt = code => CorridorData.stations.find(s => s.code === code);

// KPD -> JTJ
const kpdJtj = sliceTrackGeometry(CorridorData.trackGeometry.trunkLine1, getSt('KPD'), getSt('JTJ'));
assert(kpdJtj && kpdJtj.length >= 500, `KPD->JTJ traces ${kpdJtj.length} OSM track points along Palar river curve`);

// CBE -> ED
const cbeEd = sliceTrackGeometry(CorridorData.trackGeometry.trunkLine1, getSt('CBE'), getSt('ED'));
assert(cbeEd && cbeEd.length >= 600, `CBE->ED traces ${cbeEd.length} OSM track points through Tiruppur & Perundurai`);

// SA -> ED
const saEd = sliceTrackGeometry(CorridorData.trackGeometry.trunkLine1, getSt('SA'), getSt('ED'));
assert(saEd && saEd.length >= 450, `SA->ED traces ${saEd.length} OSM track points through Sankari Durg`);

// MS -> TPJ
const msTpj = sliceTrackGeometry(CorridorData.trackGeometry.trunkLine2, getSt('MS'), getSt('TPJ'));
assert(msTpj && msTpj.length >= 2000, `MS->TPJ traces ${msTpj.length} OSM track points along Grand Chord`);

// CGL -> VM (passing Olakur station)
const cglVm = sliceTrackGeometry(CorridorData.trackGeometry.trunkLine2, getSt('CGL'), getSt('VM'));
assert(cglVm && cglVm.length >= 500, `CGL->VM traces ${cglVm.length} OSM track points passing through Olakur`);

// Olakur station check (lat 12.30493, lon 79.72093)
let minOlDist = Infinity;
CorridorData.trackGeometry.trunkLine2.forEach(pt => {
  const d = Math.hypot(pt[0] - 12.30493, (pt[1] - 79.72093) * Math.cos(12.3 * Math.PI / 180)) * 111000;
  if (d < minOlDist) minOlDist = d;
});
assert(minOlDist < 60, `Olakur station sits directly on Grand Chord track (offset: ${minOlDist.toFixed(1)} m)`);

console.log(`\n====================================================`);
console.log(`TOTAL: ${pass + fail} | PASSED: ${pass} | FAILED: ${fail}`);
console.log(`====================================================`);
