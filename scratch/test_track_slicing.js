const fs = require('fs');

const tracks = JSON.parse(fs.readFileSync('scratch/network_tracks.json', 'utf8'));

// Helper to find index of closest point in polyline to [lat, lng]
function findClosestIndex(polyline, lat, lng) {
  let bestIdx = -1;
  let minDist = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const d = Math.hypot(polyline[i][0] - lat, polyline[i][1] - lng);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }
  return { index: bestIdx, dist: minDist };
}

// Slice polyline between station A and station B
function sliceTrack(polyline, stFrom, stTo) {
  const fromMatch = findClosestIndex(polyline, stFrom.lat, stFrom.lng);
  const toMatch = findClosestIndex(polyline, stTo.lat, stTo.lng);
  if (fromMatch.dist > 0.1 || toMatch.dist > 0.1) {
    return null; // Not on this track (dist > ~10km)
  }
  if (fromMatch.index <= toMatch.index) {
    return polyline.slice(fromMatch.index, toMatch.index + 1);
  } else {
    return polyline.slice(toMatch.index, fromMatch.index + 1).reverse();
  }
}

const stations = [
  { code: "KPD", lat: 12.97273, lng: 79.13534 },
  { code: "JTJ", lat: 12.56085, lng: 78.57782 },
  { code: "CBE", lat: 10.99764, lng: 76.96630 },
  { code: "ED",  lat: 11.32768, lng: 77.72593 },
  { code: "SA",  lat: 11.67173, lng: 78.11342 },
  { code: "MS",  lat: 13.07768, lng: 80.26019 },
  { code: "TPJ", lat: 10.79407, lng: 78.68536 },
  { code: "MDU", lat: 9.91991,  lng: 78.11031 }
];

const getSt = code => stations.find(s => s.code === code);

console.log('Testing KPD -> JTJ:');
const kpdJtj = sliceTrack(tracks.trunkLine1, getSt('KPD'), getSt('JTJ'));
console.log('Points count:', kpdJtj.length, 'Start:', kpdJtj[0], 'End:', kpdJtj[kpdJtj.length - 1]);

console.log('Testing CBE -> ED:');
const cbeEd = sliceTrack(tracks.trunkLine1, getSt('CBE'), getSt('ED'));
console.log('Points count:', cbeEd.length, 'Start:', cbeEd[0], 'End:', cbeEd[cbeEd.length - 1]);

console.log('Testing ED -> CBE:');
const edCbe = sliceTrack(tracks.trunkLine1, getSt('ED'), getSt('CBE'));
console.log('Points count:', edCbe.length, 'Start:', edCbe[0], 'End:', edCbe[edCbe.length - 1]);

console.log('Testing SA -> ED:');
const saEd = sliceTrack(tracks.trunkLine1, getSt('SA'), getSt('ED'));
console.log('Points count:', saEd.length, 'Start:', saEd[0], 'End:', saEd[saEd.length - 1]);

console.log('Testing MS -> TPJ:');
const msTpj = sliceTrack(tracks.trunkLine2, getSt('MS'), getSt('TPJ'));
console.log('Points count:', msTpj.length, 'Start:', msTpj[0], 'End:', msTpj[msTpj.length - 1]);

console.log('Testing TPJ -> MDU:');
const tpjMdu = sliceTrack(tracks.trunkLine2, getSt('TPJ'), getSt('MDU'));
console.log('Points count:', tpjMdu.length, 'Start:', tpjMdu[0], 'End:', tpjMdu[tpjMdu.length - 1]);
