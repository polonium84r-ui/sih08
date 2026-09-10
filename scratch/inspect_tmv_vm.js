const fs = require('fs');

const north = JSON.parse(fs.readFileSync('scratch/tn_north_ways.json'));
const south = JSON.parse(fs.readFileSync('scratch/tn_south_ways.json'));
const all = [...north.elements, ...south.elements];

// Find all ways in the box 11.9 to 12.3 lat, 79.4 to 79.7 lon (between VM and TMV)
const boxWays = [];
all.forEach(w => {
  if (!w.geometry) return;
  const inBox = w.geometry.some(p => p.lat >= 11.90 && p.lat <= 12.30 && p.lon >= 79.40 && p.lon <= 79.75);
  if (inBox) boxWays.push(w);
});

console.log(`Ways between VM and TMV: ${boxWays.length}`);
boxWays.forEach((w, i) => {
  const g = w.geometry;
  console.log(`Way ${i} (id=${w.id}): [${g[0].lat.toFixed(4)}, ${g[0].lon.toFixed(4)}] -> [${g[g.length-1].lat.toFixed(4)}, ${g[g.length-1].lon.toFixed(4)}], len=${g.length}, tags=${JSON.stringify(w.tags)}`);
});
