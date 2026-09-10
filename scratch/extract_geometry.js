const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/trains.json', 'utf8'));

// Cheran Express (12673) MAS -> CBE
const t12673 = data.features.find(f => f.properties && f.properties.number === '12673');
console.log('12673 Name:', t12673.properties.name);
console.log('12673 Coords count:', t12673.geometry.coordinates.length);
// Coordinates in GeoJSON are [lng, lat]
console.log('First 5 coords:', t12673.geometry.coordinates.slice(0, 5));
console.log('Last 5 coords:', t12673.geometry.coordinates.slice(-5));

// 12633 MS -> CAPE
const t12633 = data.features.find(f => f.properties && f.properties.number === '12633');
console.log('12633 Name:', t12633.properties.name);
console.log('12633 Coords count:', t12633.geometry.coordinates.length);

// Also check Salem to Vriddhachalam 56836
const t56836 = data.features.find(f => f.properties && f.properties.number === '56836');
if (t56836) console.log('56836 SA-VRI Coords:', t56836.geometry.coordinates.length);

// Also check Erode to Trichy (train 56842 or 56844 or similar)
const edTpj = data.features.find(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'ED' && p.to_station_code === 'TPJ') ||
         (p.from_station_code === 'TPJ' && p.to_station_code === 'ED');
});
console.log('ED-TPJ Train:', edTpj ? edTpj.properties.name + ' ' + edTpj.geometry.coordinates.length : 'Not found');
