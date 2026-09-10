const fs = require('fs');
const south = JSON.parse(fs.readFileSync('scratch/tn_south_ways.json'));
console.log('Checking ways near Kanyakumari terminal (8.088, 77.542):');
south.elements.forEach(w => {
  if (!w.geometry) return;
  w.geometry.forEach(p => {
    const d = Math.hypot(p.lat - 8.088, p.lon - 77.542) * 111;
    if (d < 1.0) {
      console.log(`Way ${w.id}: [${p.lat}, ${p.lon}] -> ${(d*1000).toFixed(1)}m from station`);
    }
  });
});
