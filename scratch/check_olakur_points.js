const fs = require('fs');
const d = JSON.parse(fs.readFileSync('scratch/osm_perfect_tracks.json'));
const t2 = d.trunkLine2;

const olakurPts = [];
t2.forEach((pt, i) => {
  const distM = Math.hypot(pt[0] - 12.30493, (pt[1] - 79.72093) * Math.cos(12.3*Math.PI/180)) * 111000;
  if (distM < 3000) {
    olakurPts.push({ idx: i, pt, distM: distM.toFixed(1) });
  }
});

console.log('Points within 3km of Olakur station:');
olakurPts.forEach(p => console.log(`  [${p.idx}] [${p.pt[0]}, ${p.pt[1]}] -> ${p.distM}m from station`));
