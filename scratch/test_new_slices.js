const d = require('../js/corridor_data.js');
const getSt = code => d.stations.find(s => s.code === code);
function slice(polyline, stFrom, stTo) {
  let fromIdx = -1, toIdx = -1, minF = Infinity, minT = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const dF = Math.hypot(polyline[i][0] - stFrom.lat, polyline[i][1] - stFrom.lng);
    if (dF < minF) { minF = dF; fromIdx = i; }
    const dT = Math.hypot(polyline[i][0] - stTo.lat, polyline[i][1] - stTo.lng);
    if (dT < minT) { minT = dT; toIdx = i; }
  }
  return fromIdx <= toIdx ? polyline.slice(fromIdx, toIdx + 1) : polyline.slice(toIdx, fromIdx + 1).reverse();
}
const kpdJtj = slice(d.trackGeometry.trunkLine1, getSt('KPD'), getSt('JTJ'));
const cbeEd = slice(d.trackGeometry.trunkLine1, getSt('CBE'), getSt('ED'));
const saEd = slice(d.trackGeometry.trunkLine1, getSt('SA'), getSt('ED'));
const msTpj = slice(d.trackGeometry.trunkLine2, getSt('MS'), getSt('TPJ'));
const cglVm = slice(d.trackGeometry.trunkLine2, getSt('CGL'), getSt('VM'));

console.log('KPD->JTJ slice points:', kpdJtj.length);
console.log('CBE->ED slice points:', cbeEd.length);
console.log('SA->ED slice points:', saEd.length);
console.log('MS->TPJ slice points:', msTpj.length);
console.log('CGL->VM slice points (passing Olakur):', cglVm.length);
