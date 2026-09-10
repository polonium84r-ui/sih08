const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/trains.json', 'utf8'));

function search(query) {
  return data.features.filter(f => {
    const p = f.properties || {};
    const text = `${p.name} ${p.from_station_code} ${p.to_station_code}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }).map(f => ({
    name: f.properties.name,
    number: f.properties.number,
    from: f.properties.from_station_code,
    to: f.properties.to_station_code,
    coords: f.geometry.coordinates.length
  }));
}

console.log('Pollachi / Dindigul / Palani:', search('palani').concat(search('pollachi')).slice(0, 5));
console.log('Katpadi - Villupuram:', search('tiruvannamalai').concat(data.features.filter(f => (f.properties.from_station_code === 'KPD' && f.properties.to_station_code === 'VM') || (f.properties.from_station_code === 'VM' && f.properties.to_station_code === 'KPD')).map(f => ({ name: f.properties.name, number: f.properties.number, pts: f.geometry.coordinates.length }))).slice(0, 5));
console.log('AJJ - CGL / Kanchipuram:', search('kanchipuram').concat(search('chengalpattu')).slice(0, 5));
console.log('Madurai - RMM:', search('rameswaram').slice(0, 5));
console.log('JTJ - SBC / Bangalore:', search('bangalore').concat(search('bengaluru')).slice(0, 5));
