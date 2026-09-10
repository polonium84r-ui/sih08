const fs = require('fs');
const content = fs.readFileSync('js/app.js', 'utf8');

const trackFnMatch = content.match(/function getCorridorTrackPath\([\s\S]*?\n  \}/);
const midFnMatch = content.match(/function getCorridorMidpoint\([\s\S]*?\n  \}/);

const data = require('./js/corridor_data');

eval(trackFnMatch[0]);
eval(midFnMatch[0]);

const stFrom = data.stations.find(s => s.code === 'CBE');
const stTo = data.stations.find(s => s.code === 'ED');

const pts = getCorridorTrackPath('CBE', 'ED', stFrom, stTo);
console.log('CBE-ED Path Points count:', pts.length);
console.log('Path Points:', JSON.stringify(pts));
const mid = getCorridorMidpoint('CBE', 'ED', stFrom, stTo);
console.log('Midpoint:', JSON.stringify(mid));

if (pts.length === 3 && pts[1][0] === 11.1085 && pts[1][1] === 77.3411) {
  console.log('PASS: Tiruppur intermediate station accurately included in CBE-ED block path!');
} else {
  console.error('FAIL: Expected 3 points passing through Tiruppur');
  process.exit(1);
}

// Test ED-CBE reverse
const ptsRev = getCorridorTrackPath('ED', 'CBE', stTo, stFrom);
if (ptsRev.length === 3 && ptsRev[0][0] === 11.3410 && ptsRev[2][0] === 11.0016) {
  console.log('PASS: Reverse corridor ED-CBE path is properly ordered!');
} else {
  console.error('FAIL: Reverse corridor path incorrect');
  process.exit(1);
}

// Test Trunk Line 2 (MS - TPJ)
const msSt = data.stations.find(s => s.code === 'MS');
const tpjSt = data.stations.find(s => s.code === 'TPJ');
const ptsChord = getCorridorTrackPath('MS', 'TPJ', msSt, tpjSt);
console.log('MS-TPJ Path Points count:', ptsChord.length);
if (ptsChord.length === 7) {
  console.log('PASS: MS-TPJ Chord route correctly slices 7 stations along Grand Chord!');
} else {
  console.error('FAIL: MS-TPJ should contain 7 stations');
  process.exit(1);
}
