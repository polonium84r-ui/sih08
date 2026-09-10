const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/trains.json', 'utf8'));

const t12673 = data.features.find(f => f.properties && f.properties.number === '12673');
// Note: GeoJSON coordinates are [lon, lat], Leaflet polyline expects [lat, lng]
const coords = t12673.geometry.coordinates.map(pt => [Number(pt[1].toFixed(5)), Number(pt[0].toFixed(5))]);

console.log('Total coordinates for Trunk 1 (MAS - CBE):', coords.length);
console.log('Start (MAS):', coords[0]);
console.log('End (CBE):', coords[coords.length - 1]);

// Let's verify intermediate points near KPD, JTJ, SA, ED, TUP
const findNear = (lat, lng, name) => {
  let closest = null;
  let minDist = Infinity;
  coords.forEach((c, idx) => {
    const d = Math.hypot(c[0] - lat, c[1] - lng);
    if (d < minDist) {
      minDist = d;
      closest = { idx, coord: c, distKm: d * 111 };
    }
  });
  console.log(`Station ${name} (${lat}, ${lng}): closest point #${closest.idx} at (${closest.coord[0]}, ${closest.coord[1]}), dist: ${closest.distKm.toFixed(2)} km`);
};

findNear(13.0827, 80.2707, 'MAS');
findNear(13.0783, 79.6687, 'AJJ');
findNear(12.9698, 79.1378, 'KPD');
findNear(12.5594, 78.5746, 'JTJ');
findNear(12.1287, 78.3842, 'MAP');
findNear(11.6643, 78.1460, 'SA');
findNear(11.3410, 77.7172, 'ED');
findNear(11.1085, 77.3411, 'TUP');
findNear(11.0016, 76.9628, 'CBE');
