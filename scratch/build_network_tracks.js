const fs = require('fs');

const trainsData = JSON.parse(fs.readFileSync('scratch/trains.json', 'utf8'));
const stationsData = JSON.parse(fs.readFileSync('scratch/stations.json', 'utf8'));

// 1. Trunk 1: MAS to CBE (train 12673)
const t1 = trainsData.features.find(f => f.properties && f.properties.number === '12673');
const trunk1 = t1.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);

// 2. Trunk 2: MS to CAPE (train 12633)
const t2 = trainsData.features.find(f => f.properties && f.properties.number === '12633');
const trunk2 = t2.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);

// 3. Erode to Trichy (train 56842)
const tEdTpj = trainsData.features.find(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'ED' && p.to_station_code === 'TPJ') ||
         (p.from_station_code === 'TPJ' && p.to_station_code === 'ED');
});
const edTpj = tEdTpj.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);

// 4. Salem to Vriddhachalam (train 56836)
const tSaVri = trainsData.features.find(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'SA' && p.to_station_code === 'VRI') ||
         (p.from_station_code === 'VRI' && p.to_station_code === 'SA');
});
const saVri = tSaVri.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);

// 5. Arakkonam to Chengalpattu (train 56003)
const tAjjCgl = trainsData.features.find(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'AJJ' && p.to_station_code === 'CGL') ||
         (p.from_station_code === 'CGL' && p.to_station_code === 'AJJ');
});
const ajjCgl = tAjjCgl.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);

// 6. Madurai to Rameswaram (train 56723 / 16702)
const tMduRmm = trainsData.features.find(f => {
  const p = f.properties || {};
  return (p.from_station_code === 'MDU' && p.to_station_code === 'RMM') ||
         (p.from_station_code === 'RMM' && p.to_station_code === 'MDU');
}) || trainsData.features.find(f => {
  const p = f.properties || {};
  return p.name && p.name.toLowerCase().includes('rameswaram') && f.geometry.coordinates.length > 20;
});
const mduRmm = tMduRmm.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);

// 7. Katpadi to Villupuram (KPD - VLR - KMM - ARV - PRL - TNM - TRK - MMP - VM)
const kpdVmCodes = ['KPD', 'VLR', 'KMM', 'ARV', 'PRL', 'TNM', 'TRK', 'MMP', 'VM'];
const kpdVm = kpdVmCodes.map(code => {
  const st = stationsData.features.find(f => f.properties && f.properties.code === code);
  return [Number(st.geometry.coordinates[1].toFixed(5)), Number(st.geometry.coordinates[0].toFixed(5))];
});

// 8. Coimbatore to Dindigul via Pollachi & Palani (CBE - PTJ - CNV - POY - UDT - PLNI - ODC - DG)
const cbeDgCodes = ['CBE', 'PTJ', 'POY', 'PLNI', 'ODC', 'DG'];
const cbeDg = cbeDgCodes.map(code => {
  const st = stationsData.features.find(f => f.properties && f.properties.code === code);
  return [Number(st.geometry.coordinates[1].toFixed(5)), Number(st.geometry.coordinates[0].toFixed(5))];
});

// 9. Jolarpettai to Bangalore border (JTJ -> Kuppam -> Bangarapet)
const tSbc = trainsData.features.find(f => f.properties && f.properties.number === '12028');
// Find JTJ in 12028 and get points towards SBC
const sbcCoords = tSbc.geometry.coordinates.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5))]);
// Reverse so it starts from JTJ and goes to Kuppam/Bangarapet
let jtjIdx = -1;
let minJtjDist = Infinity;
sbcCoords.forEach((c, i) => {
  const d = Math.hypot(c[0] - 12.56085, c[1] - 78.57782);
  if (d < minJtjDist) {
    minJtjDist = d;
    jtjIdx = i;
  }
});
const jtjBangalore = sbcCoords.slice(Math.max(0, jtjIdx - 6), jtjIdx + 1).reverse();

console.log('Results summary:');
console.log('Trunk 1 points:', trunk1.length);
console.log('Trunk 2 points:', trunk2.length);
console.log('ED-TPJ points:', edTpj.length);
console.log('SA-VRI points:', saVri.length);
console.log('AJJ-CGL points:', ajjCgl.length);
console.log('MDU-RMM points:', mduRmm.length);
console.log('KPD-VM points:', kpdVm.length);
console.log('CBE-DG points:', cbeDg.length);
console.log('JTJ-SBC points:', jtjBangalore.length);

const output = {
  trunkLine1: trunk1,
  trunkLine2: trunk2,
  feederRoutes: [
    edTpj,
    cbeDg,
    saVri,
    kpdVm,
    ajjCgl,
    mduRmm,
    jtjBangalore
  ]
};

fs.writeFileSync('scratch/network_tracks.json', JSON.stringify(output, null, 2));
console.log('Wrote scratch/network_tracks.json');
