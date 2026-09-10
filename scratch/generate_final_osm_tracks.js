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

const SNAP_DEG = 0.00055;
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
          if (d < 0.065) {
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

function perpendicularDistance(pt, lineStart, lineEnd) {
  const dx = lineEnd[1] - lineStart[1];
  const dy = lineEnd[0] - lineStart[0];
  const norm = Math.hypot(dx, dy);
  if (norm === 0) return Math.hypot(pt[0] - lineStart[0], pt[1] - lineStart[1]) * 111000;
  return Math.abs(dy * pt[1] - dx * pt[0] + lineEnd[0] * lineStart[1] - lineEnd[1] * lineStart[0]) / norm * 111000;
}

function simplify(pts, epsilonMeters = 5.0) {
  if (pts.length <= 2) return pts;
  let dmax = 0;
  let index = 0;
  const end = pts.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(pts[i], pts[0], pts[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }
  if (dmax > epsilonMeters) {
    const rec1 = simplify(pts.slice(0, index + 1), epsilonMeters);
    const rec2 = simplify(pts.slice(index), epsilonMeters);
    return rec1.slice(0, -1).concat(rec2);
  } else {
    return [pts[0], pts[end]];
  }
}

const stations = {
  MAS: [13.0827, 80.2755],
  AJJ: [13.0815, 79.6680],
  KPD: [12.9727, 79.1353],
  JTJ: [12.5609, 78.5778],
  MAP: [12.1322, 78.3970],
  SA:  [11.6717, 78.1134],
  ED:  [11.3277, 77.7259],
  TUP: [11.1085, 77.3411],
  CBE: [10.9976, 76.9663],

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
  CAPE: [8.08803, 77.5425],

  KRR:  [10.9577, 78.0839],
  POY:  [10.6609, 77.0048],
  TNM:  [12.2253, 79.0747],
  CJ:   [12.8342, 79.7036],
  MNM:  [9.8550,  78.5830],
  RMM:  [9.2876,  79.3129],
  BWT:  [12.7483, 78.3614]
};

function traceSequence(seq, name, epsilon = 5.0) {
  console.log(`Tracing ${name}...`);
  const full = [];
  for (let i = 0; i < seq.length - 1; i++) {
    const s1 = stations[seq[i]];
    const s2 = stations[seq[i+1]];
    const seg = findPath(s1[0], s1[1], s2[0], s2[1]);
    if (!seg) {
      console.error(`  ERROR: Failed on ${seq[i]} -> ${seq[i+1]}`);
      return null;
    }
    if (i === 0) full.push(...seg);
    else full.push(...seg.slice(1));
  }
  const simp = simplify(full, epsilon);
  console.log(`  ${name}: raw ${full.length} pts -> simplified ${simp.length} pts (tolerance <= ${epsilon}m)`);
  return simp;
}

// 1. Trunk Line 1 (MAS - CBE)
const trunkLine1 = traceSequence(["MAS", "AJJ", "KPD", "JTJ", "MAP", "SA", "ED", "TUP", "CBE"], "Trunk Line 1", 5.0);

// 2. Trunk Line 2 (MS - CAPE)
const trunkLine2 = traceSequence(["MS", "TBM", "CGL", "TMV", "VM", "VRI", "TPJ", "DG", "MDU", "VPT", "TEN", "CAPE"], "Trunk Line 2", 5.0);

// 3. Feeders
const feederRoutes = [
  traceSequence(["ED", "KRR", "TPJ"], "Feeder ED-KRR-TPJ", 6.0),
  traceSequence(["CBE", "POY", "DG"], "Feeder CBE-POY-DG", 6.0),
  traceSequence(["SA", "VRI"], "Feeder SA-VRI", 6.0),
  traceSequence(["KPD", "TNM", "VM"], "Feeder KPD-TNM-VM", 6.0),
  traceSequence(["AJJ", "CJ", "CGL"], "Feeder AJJ-CJ-CGL", 6.0),
  traceSequence(["MDU", "MNM", "RMM"], "Feeder MDU-MNM-RMM", 6.0),
  traceSequence(["JTJ", "BWT"], "Feeder JTJ-BWT", 6.0)
];

// Check Olakur in Trunk Line 2
let minOlDist = Infinity;
let closestOlPt = null;
trunkLine2.forEach(pt => {
  const d = Math.hypot(pt[0] - 12.30493, pt[1] - 79.72093) * 111;
  if (d < minOlDist) { minOlDist = d; closestOlPt = pt; }
});
console.log(`\nVerification: Olakur station (12.30493, 79.72093) distance from Trunk 2 track: ${(minOlDist * 1000).toFixed(1)} meters!`);
console.log(`Closest point to Olakur on Trunk 2:`, closestOlPt);

const finalTracks = {
  trunkLine1,
  trunkLine2,
  feederRoutes
};

fs.writeFileSync('scratch/osm_perfect_tracks.json', JSON.stringify(finalTracks));
const sizeKb = (fs.statSync('scratch/osm_perfect_tracks.json').size / 1024).toFixed(1);
console.log(`Successfully generated scratch/osm_perfect_tracks.json (${sizeKb} KB)`);
