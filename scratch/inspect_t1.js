const fs = require('fs');

const trainData = JSON.parse(fs.readFileSync('scratch/trains.json', 'utf8'));
const t1 = trainData.features.find(f => f.properties && f.properties.number === '12673');
const t1Coords = t1.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);

console.log('T1 points count:', t1Coords.length);
// Let's print points between KPD and JTJ, JTJ and SA, SA and ED, ED and CBE
console.log('Sample T1 coordinates:');
console.log(JSON.stringify(t1Coords.slice(0, 10)));
