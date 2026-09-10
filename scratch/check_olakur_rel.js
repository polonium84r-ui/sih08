const fs = require('fs');
const d = JSON.parse(fs.readFileSync('scratch/t2_relation_ways.json'));
let olakurPts = [];
d.elements.forEach(w => {
  if (w.geometry) {
    w.geometry.forEach(pt => {
      const dist = Math.hypot(pt.lat - 12.30493, pt.lon - 79.72093) * 111;
      if (dist < 5) olakurPts.push({ pt, dist });
    });
  }
});
olakurPts.sort((a,b) => a.dist - b.dist);
console.log('Points within 5km of Olakur:', olakurPts.length);
console.log('Closest point to Olakur station:', JSON.stringify(olakurPts[0]));
console.log('Next 5 points:', JSON.stringify(olakurPts.slice(0, 5)));
