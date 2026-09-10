const fs = require('fs');

const northData = JSON.parse(fs.readFileSync('scratch/tn_north_ways.json'));
const southData = JSON.parse(fs.readFileSync('scratch/tn_south_ways.json'));

const allWays = [...northData.elements, ...southData.elements];
console.log(`Total ways: ${allWays.length}`);

// Collect all node positions and way endpoints
// In OSM, each way has nodes: [id0, id1, ...] and geometry: [{lat, lon}, ...]
const nodePos = new Map(); // nodeId -> {lat, lon}
const ways = [];

allWays.forEach(w => {
  if (!w.geometry || w.geometry.length < 2 || !w.nodes || w.nodes.length !== w.geometry.length) return;
  for (let i = 0; i < w.nodes.length; i++) {
    nodePos.set(w.nodes[i], { lat: w.geometry[i].lat, lon: w.geometry[i].lon });
  }
  ways.push(w);
});

console.log(`Valid ways: ${ways.length}, Known nodes: ${nodePos.size}`);

// Spatial grid to cluster nearby nodes (within 25 meters = 0.00025 deg)
// This bridges small gaps across switches and platform tracks
const SNAP_DEG = 0.0003; // ~30 meters
function gridKey(lat, lon) {
  return `${Math.floor(lat / SNAP_DEG)},${Math.floor(lon / SNAP_DEG)}`;
}

const grid = new Map(); // gridKey -> Array of { clusterId, lat, lon }
const nodeCluster = new Map(); // nodeId -> clusterId
let nextClusterId = 1;

// Assign clusters to way endpoints
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

  // Check neighbor grid cells
  let foundCluster = null;
  for (let dx = -1; dx <= 1 && !foundCluster; dx++) {
    for (let dy = -1; dy <= 1 && !foundCluster; dy++) {
      const cell = grid.get(`${gx + dx},${gy + dy}`);
      if (cell) {
        for (const item of cell) {
          const d = Math.hypot(item.lat - pos.lat, item.lon - pos.lon) * 111;
          if (d < 0.035) { // 35 meters
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

console.log(`Grouped ${endpoints.size} endpoints into ${nextClusterId - 1} clusters.`);

// Build cluster adjacency graph
const adj = new Map(); // clusterId -> Array of { toCluster, geom: [[lat, lon], ...], wayId, lenKm }

function addEdge(c1, c2, geom, wayId) {
  let lenKm = 0;
  for (let i = 0; i < geom.length - 1; i++) {
    lenKm += Math.hypot(geom[i+1][0] - geom[i][0], geom[i+1][1] - geom[i][1]) * 111;
  }
  if (!adj.has(c1)) adj.set(c1, []);
  adj.get(c1).push({ toCluster: c2, geom, wayId, lenKm });
}

ways.forEach(w => {
  const startNid = w.nodes[0];
  const endNid = w.nodes[w.nodes.length - 1];
  const c1 = nodeCluster.get(startNid);
  const c2 = nodeCluster.get(endNid);
  if (!c1 || !c2 || c1 === c2) return;

  const fwd = w.geometry.map(p => [p.lat, p.lon]);
  const rev = [...fwd].reverse();

  addEdge(c1, c2, fwd, w.id);
  addEdge(c2, c1, rev, w.id);
});

console.log(`Connected graph has ${adj.size} clusters.`);

// Find path using A*
function findPath(startLat, startLon, endLat, endLon) {
  // Find closest clusters
  let startCid = null, minStartD = Infinity;
  let endCid = null, minEndD = Infinity;

  for (const [cid, edges] of adj.entries()) {
    // Get representative coord from first edge
    const pt = edges[0].geom[0];
    const dS = Math.hypot(pt[0] - startLat, pt[1] - startLon) * 111;
    if (dS < minStartD) { minStartD = dS; startCid = cid; }
    const dE = Math.hypot(pt[0] - endLat, pt[1] - endLon) * 111;
    if (dE < minEndD) { minEndD = dE; endCid = cid; }
  }

  console.log(`Start cluster: ${startCid} (${minStartD.toFixed(3)}km), End cluster: ${endCid} (${minEndD.toFixed(3)}km)`);
  if (!startCid || !endCid) return null;

  // A* search
  const targetEdge = adj.get(endCid)[0];
  const targetPt = targetEdge.geom[0];

  function h(cid) {
    const pt = adj.get(cid)[0].geom[0];
    return Math.hypot(pt[0] - targetPt[0], pt[1] - targetPt[1]) * 111;
  }

  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  const pq = [{ cid: startCid, cost: 0, priority: h(startCid) }];
  dist.set(startCid, 0);

  let iters = 0;
  while (pq.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i].priority < pq[minIdx].priority) minIdx = i;
    }
    const { cid: curr, cost: currCost } = pq.splice(minIdx, 1)[0];

    if (curr === endCid) {
      console.log(`Found path in ${iters} iterations!`);
      break;
    }

    if (visited.has(curr)) continue;
    visited.add(curr);
    iters++;

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

  if (!prev.has(endCid) && startCid !== endCid) {
    console.error('No path found in graph!');
    return null;
  }

  // Reconstruct path
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

  // Clean deduplicated points
  const clean = [];
  for (let i = 0; i < polyline.length; i++) {
    if (i === 0 || polyline[i][0] !== polyline[i-1][0] || polyline[i][1] !== polyline[i-1][1]) {
      clean.push(polyline[i]);
    }
  }
  return clean;
}

// Test on CGL to TMV (passing Olakur)
const cgl = [12.6929, 79.9815];
const tmv = [12.2274, 79.6521];
console.log('\nTracing railway line CGL -> TMV (passing Olakur)...');
const path = findPath(cgl[0], cgl[1], tmv[0], tmv[1]);
if (path) {
  console.log(`SUCCESS! Path length: ${path.length} points!`);
  let minOlDist = Infinity;
  let closestPt = null;
  path.forEach(pt => {
    const d = Math.hypot(pt[0] - 12.30493, pt[1] - 79.72093) * 111;
    if (d < minOlDist) { minOlDist = d; closestPt = pt; }
  });
  console.log(`Distance from path to Olakur station: ${(minOlDist * 1000).toFixed(1)} meters!`);
  console.log(`Closest point to Olakur:`, closestPt);
}
