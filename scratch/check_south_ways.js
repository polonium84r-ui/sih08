const fs = require('fs');

const south = JSON.parse(fs.readFileSync('scratch/tn_south_ways.json'));
console.log('Total south ways:', south.elements.length);

// Check ways near VPT (9.5857, 77.9547) and TEN (8.7303, 77.7280)
let vptWays = 0, tenWays = 0, capeWays = 0;
south.elements.forEach(w => {
  if (!w.geometry) return;
  if (w.geometry.some(p => Math.hypot(p.lat - 9.5857, p.lon - 77.9547) * 111 < 10)) vptWays++;
  if (w.geometry.some(p => Math.hypot(p.lat - 8.7303, p.lon - 77.7280) * 111 < 10)) tenWays++;
  if (w.geometry.some(p => Math.hypot(p.lat - 8.0883, p.lon - 77.5385) * 111 < 10)) capeWays++;
});

console.log({ vptWays, tenWays, capeWays });

// Find ways between lat 8.0 and 9.6, lon 77.4 and 78.0
const southernMainWays = [];
south.elements.forEach(w => {
  if (!w.geometry) return;
  const inRange = w.geometry.some(p => p.lat >= 8.0 && p.lat <= 9.6 && p.lon >= 77.4 && p.lon <= 78.0);
  if (inRange) southernMainWays.push(w);
});
console.log('Southern main ways in range 8.0-9.6:', southernMainWays.length);
