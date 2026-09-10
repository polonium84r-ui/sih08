const fs = require('fs');
const d = JSON.parse(fs.readFileSync('scratch/t2_relation_ways.json'));
let minLat = 999, maxLat = -999, minLon = 999, maxLon = -999;
d.elements.forEach(w => {
  if (w.geometry) {
    w.geometry.forEach(pt => {
      if (pt.lat < minLat) minLat = pt.lat;
      if (pt.lat > maxLat) maxLat = pt.lat;
      if (pt.lon < minLon) minLon = pt.lon;
      if (pt.lon > maxLon) maxLon = pt.lon;
    });
  }
});
console.log('Bounds:', { minLat, maxLat, minLon, maxLon });
