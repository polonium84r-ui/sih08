const fs = require('fs');
const d = JSON.parse(fs.readFileSync('scratch/osm_perfect_tracks.json'));
const t1 = d.trunkLine1;
console.log('T1 points:', t1.length);
let dists = [];
for (let i = 0; i < t1.length - 1; i++) {
  const dM = Math.hypot(t1[i+1][0] - t1[i][0], (t1[i+1][1] - t1[i][1]) * Math.cos(t1[i][0]*Math.PI/180)) * 111000;
  dists.push(dM);
}
dists.sort((a,b) => a - b);
console.log('Min dist:', dists[0].toFixed(1), 'm, Median:', dists[Math.floor(dists.length/2)].toFixed(1), 'm, Max:', dists[dists.length-1].toFixed(1), 'm');
