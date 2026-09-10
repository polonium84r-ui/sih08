const fs = require('fs');
const trainData = JSON.parse(fs.readFileSync('scratch/trains.json', 'utf8'));

// Search for train passing through CBE, POY, DG or similar
const pollachiTrains = trainData.features.filter(f => {
  const p = f.properties || {};
  const n = (p.name || '').toLowerCase();
  return n.includes('palani') || n.includes('pollachi') || n.includes('tiruchendur');
});
console.log('Pollachi / Palani trains:', pollachiTrains.map(t => ({
  name: t.properties.name,
  number: t.properties.number,
  from: t.properties.from_station_code,
  to: t.properties.to_station_code,
  coords: t.geometry.coordinates.length
})));

// Search for train with KPD and VM
const kpdVm = trainData.features.filter(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'KPD' || p.to_station_code === 'KPD') &&
         (p.name || '').toLowerCase().includes('villupuram');
});
console.log('KPD-VM trains:', kpdVm.map(t => ({
  name: t.properties.name,
  number: t.properties.number,
  coords: t.geometry.coordinates.length
})));
