const fs = require('fs');

const trainData = JSON.parse(fs.readFileSync('scratch/trains.json', 'utf8'));
const t12673 = trainData.features.find(f => f.properties && f.properties.number === '12673');
const t12633 = trainData.features.find(f => f.properties && f.properties.number === '12633');

const t1Coords = t12673.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);
const t2Coords = t12633.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);

console.log('Trunk 1 points count:', t1Coords.length);
console.log('Trunk 2 points count:', t2Coords.length);

// Let's also check other connecting lines in Tamil Nadu:
// 1. Erode -> Karur -> Tiruchirappalli (train 56842 / 56844 or search)
const edTpj = trainData.features.find(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'ED' && p.to_station_code === 'TPJ') || (p.from_station_code === 'TPJ' && p.to_station_code === 'ED');
});
console.log('ED-TPJ route coords:', edTpj ? edTpj.geometry.coordinates.length : 0);

// 2. Salem -> Vriddhachalam (56836)
const saVri = trainData.features.find(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'SA' && p.to_station_code === 'VRI') || (p.from_station_code === 'VRI' && p.to_station_code === 'SA');
});
console.log('SA-VRI route coords:', saVri ? saVri.geometry.coordinates.length : 0);

// 3. Arakkonam -> Kanchipuram -> Chengalpattu (56003)
const ajjCgl = trainData.features.find(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'AJJ' && p.to_station_code === 'CGL') || (p.from_station_code === 'CGL' && p.to_station_code === 'AJJ');
});
console.log('AJJ-CGL route coords:', ajjCgl ? ajjCgl.geometry.coordinates.length : 0);

// 4. Madurai -> Manamadurai -> Ramanathapuram -> Rameswaram (12789 / 16702)
// For RMM from MDU, let's find train with MDU and RMM
const mduRmm = trainData.features.find(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'MDU' && p.to_station_code === 'RMM') || (p.from_station_code === 'RMM' && p.to_station_code === 'MDU');
}) || trainData.features.find(f => {
  const p = f.properties || {};
  return p.name && p.name.toLowerCase().includes('rameswaram') && f.geometry.coordinates.length > 20;
});
console.log('MDU-RMM route coords:', mduRmm ? mduRmm.properties.name + ' ' + mduRmm.geometry.coordinates.length : 0);

// 5. Jolarpettai -> Bangalore branch (12028 from SBC to MAS - slice between SBC and JTJ)
const sbcMas = trainData.features.find(f => f.properties && f.properties.number === '12028');
console.log('SBC-MAS Shatabdi coords:', sbcMas ? sbcMas.geometry.coordinates.length : 0);
