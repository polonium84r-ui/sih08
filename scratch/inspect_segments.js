const fs = require('fs');

const trainData = JSON.parse(fs.readFileSync('scratch/trains.json', 'utf8'));
const t1 = trainData.features.find(f => f.properties && f.properties.number === '12673');
const t1Coords = t1.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);

console.log('KPD to JTJ segment:');
// KPD is around index 38, JTJ is around index 51
console.log(t1Coords.slice(38, 52));

console.log('JTJ to SA segment:');
console.log(t1Coords.slice(51, 68));

console.log('SA to ED segment:');
console.log(t1Coords.slice(67, 76));

console.log('ED to CBE segment:');
console.log(t1Coords.slice(75, 91));
