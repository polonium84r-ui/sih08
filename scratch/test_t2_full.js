const fs = require('fs');

const northData = JSON.parse(fs.readFileSync('scratch/tn_north_ways.json'));
const southData = JSON.parse(fs.readFileSync('scratch/tn_south_ways.json'));
const gapData = JSON.parse(fs.readFileSync('scratch/gap_vm.json'));

const allWays = [...northData.elements, ...southData.elements, ...gapData.elements];

const nodePos = new Map();
const ways = [];

allWays.forEach(w => {
  if (!w.geometry || w.geometry.length < 2 || !w.nodes || w.nodes.length !== w.geometry.length) return;
  for (let i = 0; i < w.nodes.length; i++) {
    nodePos.set(w.nodes[i], { lat: w.geometry[i].lat, lon: w.geometry[i].lon });
  }
  ways.push(w);
});

const SNAP_DEG = 0.00050; // ~55 meters
function gridKey(lat, lon) {
  return `${Math.floor(lat / SNAP_DEG)},${Math.floor(lon / SNAP_DEG)}`;
}

const grid = new Map();
const nodeCluster = new Map();
let nextClusterId = 1;

const endpoints = new Set();
ways.forEach(w => {
  endpoints.add(w.nodes[0]);
  endpoints.add(w.nodes[w.nodes.length - 1]);
});

endpoints.forEach(nid => {
  const pos = nodePos.get(nid);
  if (!pos) return;
  const gx = Math.floor(pos.lat / SNAP_DEG);
  const gy = Math.floor(pos.lon / SNAP_DEG);

  let foundCluster = null;
  for (let dx = -1; dx <= 1 && !foundCluster; dx++) {
    for (let dy = -1; dy <= 1 && !foundCluster; dy++) {
      const cell = grid.get(`${gx + dx},${gy + dy}`);
      if (cell) {
        for (const item of cell) {
          const d = Math.hypot(item.lat - pos.lat, item.lon - pos.lon) * 111;
          if (d < 0.060) { // 60m
            foundCluster = item.clusterId;
            break;
          }
        }
      }
    }
  }

  const cid = foundCluster || (nextClusterId++);
  nodeCluster.set(nid, cid);

  const k = `${gx},${gy}`;
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push({ clusterId: cid, lat: pos.lat, lon: pos.lon });
});

const adj = new Map();

function addEdge(c1, c2, geom, wayId) {
  let lenKm = 0;
  for (let i = 0; i < geom.length - 1; i++) {
    lenKm += Math.hypot(geom[i+1][0] - geom[i][0], geom[i+1][1] - geom[i][1]) * 111;
  }
  if (!adj.has(c1)) adj.set(c1, []);
  adj.get(c1).push({ toCluster: c2, geom, wayId, lenKm });
}

ways.forEach(w => {
  const c1 = nodeCluster.get(w.nodes[0]);
  const c2 = nodeCluster.get(w.nodes[w.nodes.length - 1]);
  if (!c1 || !c2 || c1 === c2) return;

  const fwd = w.geometry.map(p => [parseFloat(p.lat.toFixed(5)), parseFloat(p.lon.toFixed(5))]);
  const rev = [...fwd].reverse();

  addEdge(c1, c2, fwd, w.id);
  addEdge(c2, c1, rev, w.id);
});

function findPath(startLat, startLon, endLat, endLon) {
  let startCid = null, minStartD = Infinity;
  let endCid = null, minEndD = Infinity;

  for (const [cid, edges] of adj.entries()) {
    const pt = edges[0].geom[0];
    const dS = Math.hypot(pt[0] - startLat, pt[1] - startLon) * 111;
    if (dS < minStartD) { minStartD = dS; startCid = cid; }
    const dE = Math.hypot(pt[0] - endLat, pt[1] - endLon) * 111;
    if (dE < minEndD) { minEndD = dE; endCid = cid; }
  }

  if (!startCid || !endCid) return null;

  const targetPt = adj.get(endCid)[0].geom[0];
  function h(cid) {
    const pt = adj.get(cid)[0].geom[0];
    return Math.hypot(pt[0] - targetPt[0], pt[1] - targetPt[1]) * 111;
  }

  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  const pq = [{ cid: startCid, cost: 0, priority: h(startCid) }];
  dist.set(startCid, 0);

  while (pq.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i].priority < pq[minIdx].priority) minIdx = i;
    }
    const { cid: curr, cost: currCost } = pq.splice(minIdx, 1)[0];

    if (curr === endCid) break;
    if (visited.has(curr)) continue;
    visited.add(curr);

    const edges = adj.get(curr) || [];
    for (const edge of edges) {
      if (visited.has(edge.toCluster)) continue;
      const newCost = currCost + edge.lenKm;
      if (!dist.has(edge.toCluster) || newCost < dist.get(edge.toCluster)) {
        dist.set(edge.toCluster, newCost);
        prev.set(edge.toCluster, { prevCid: curr, geom: edge.geom });
        pq.push({ cid: edge.toCluster, cost: newCost, priority: newCost + h(edge.toCluster) });
      }
    }
  }

  if (!prev.has(endCid) && startCid !== endCid) return null;

  const polyline = [];
  let curr = endCid;
  while (curr !== startCid) {
    const step = prev.get(curr);
    if (!step) break;
    for (let i = step.geom.length - 1; i >= 0; i--) {
      polyline.unshift(step.geom[i]);
    }
    curr = step.prevCid;
  }

  const clean = [];
  for (let i = 0; i < polyline.length; i++) {
    if (i === 0 || polyline[i][0] !== polyline[i-1][0] || polyline[i][1] !== polyline[i-1][1]) {
      clean.push(polyline[i]);
    }
  }
  return clean;
}

const stations = {
  MS:   [13.0805, 80.2612],
  TBM:  [12.9248, 80.1197],
  CGL:  [12.6929, 79.9815],
  TMV:  [12.2274, 79.6521],
  VM:   [11.9430, 79.5001],
  VRI:  [11.5350, 79.3161],
  TPJ:  [10.7941, 78.6854],
  DG:   [10.3538, 77.9855],
  MDU:  [9.9199,  78.1103],
  VPT:  [9.5857,  77.9547],
  TEN:  [8.7303,  77.7280],
  CAPE: [8.0883,  77.5385]
};

const t2Seq = ["MS", "TBM", "CGL", "TMV", "VM", "VRI", "TPJ", "DG", "MDU", "VPT", "TEN", "CAPE"];
console.log('Testing all Trunk Line 2 segments:');
for (let i = 0; i < t2Seq.length - 1; i++) {
  const s1 = stations[t2Seq[i]];
  const s2 = stations[t2Seq[i+1]];
  const seg = findPath(s1[0], s1[1], s2[0], s2[1]);
  if (seg) {
    console.log(`  [OK] ${t2Seq[i]} -> ${t2Seq[i+1]}: ${seg.length} points`);
  } else {
    console.error(`  [FAIL] ${t2Seq[i]} -> ${t2Seq[i+1]}`);
  }
}
