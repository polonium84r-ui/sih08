const fs = require('fs');
const d = require('../js/corridor_data.js');
const tracks = JSON.parse(fs.readFileSync('scratch/osm_perfect_tracks.json'));

console.log('Checking station proximity to 100% accurate OSM tracks:');
const t1Stations = ["MAS", "AJJ", "KPD", "JTJ", "MAP", "SA", "ED", "TUP", "CBE"];
const t2Stations = ["MS", "TBM", "CGL", "TMV", "VM", "VRI", "TPJ", "DG", "MDU", "VPT", "TEN", "CAPE"];

console.log('\n--- Trunk Line 1 Stations ---');
t1Stations.forEach(code => {
  const st = d.stations.find(s => s.code === code);
  let minD = Infinity;
  let closest = null;
  tracks.trunkLine1.forEach(pt => {
    const distM = Math.hypot(pt[0] - st.lat, (pt[1] - st.lng)*Math.cos(st.lat*Math.PI/180)) * 111000;
    if (distM < minD) { minD = distM; closest = pt; }
  });
  console.log(`  Station ${code}: ${minD.toFixed(1)}m from track (st: [${st.lat}, ${st.lng}], closest track: [${closest[0]}, ${closest[1]}])`);
});

console.log('\n--- Trunk Line 2 Stations ---');
t2Stations.forEach(code => {
  const st = d.stations.find(s => s.code === code);
  let minD = Infinity;
  let closest = null;
  tracks.trunkLine2.forEach(pt => {
    const distM = Math.hypot(pt[0] - st.lat, (pt[1] - st.lng)*Math.cos(st.lat*Math.PI/180)) * 111000;
    if (distM < minD) { minD = distM; closest = pt; }
  });
  console.log(`  Station ${code}: ${minD.toFixed(1)}m from track (st: [${st.lat}, ${st.lng}], closest track: [${closest[0]}, ${closest[1]}])`);
});
