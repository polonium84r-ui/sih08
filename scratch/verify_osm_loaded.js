const d = require('../js/corridor_data.js');
console.log('Stations count:', d.stations.length);
console.log('Trunk 1 points:', d.trackGeometry.trunkLine1.length);
console.log('Trunk 2 points:', d.trackGeometry.trunkLine2.length);
console.log('Feeder routes:', d.trackGeometry.feederRoutes.length);

let minOl = Infinity;
let closestPt = null;
d.trackGeometry.trunkLine2.forEach(pt => {
  const dist = Math.hypot(pt[0] - 12.30493, (pt[1] - 79.72093)*Math.cos(12.3*Math.PI/180)) * 111000;
  if (dist < minOl) { minOl = dist; closestPt = pt; }
});
console.log('Trunk 2 distance to Olakur station:', minOl.toFixed(1), 'meters');
console.log('Closest point on Trunk 2 to Olakur:', closestPt);
