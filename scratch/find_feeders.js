const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/trains.json', 'utf8'));

function findTrain(from, to) {
  return data.features.find(f => {
    const p = f.properties || {};
    return p.from_station_code === from && p.to_station_code === to;
  }) || data.features.find(f => {
    const p = f.properties || {};
    return (p.from_station_code === to && p.to_station_code === from);
  });
}

function searchRoutes(namePart) {
  return data.features.filter(f => {
    const p = f.properties || {};
    const n = (p.name || '').toLowerCase();
    return n.includes(namePart.toLowerCase());
  }).map(f => ({
    name: f.properties.name,
    number: f.properties.number,
    from: f.properties.from_station_code,
    to: f.properties.to_station_code,
    pts: f.geometry.coordinates.length
  }));
}

console.log('ED-TPJ / KRR:', searchRoutes('karur').slice(0, 5));
console.log('Salem - VRI:', searchRoutes('vriddhachalam').concat(searchRoutes('vridhachalam')).slice(0, 5));
console.log('KPD - VM / Tiruvannamalai:', searchRoutes('tiruvannamalai').concat(searchRoutes('villupuram')).slice(0, 5));
console.log('MDU - RMM / Rameswaram:', searchRoutes('rameswaram').slice(0, 5));
