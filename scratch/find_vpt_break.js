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

const SNAP_DEG = 0.00045; // ~50m
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
          if (d < 0.055) { // 55m
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
ways.forEach(w => {
  const c1 = nodeCluster.get(w.nodes[0]);
  const c2 = nodeCluster.get(w.nodes[w.nodes.length - 1]);
  if (!c1 || !c2 || c1 === c2) return;
  if (!adj.has(c1)) adj.set(c1, []);
  if (!adj.has(c2)) adj.set(c2, []);
  adj.get(c1).push(c2);
  adj.get(c2).push(c1);
});

// Find cluster for VPT (9.5857, 77.9547)
let vptCid = null, minD = Infinity;
for (const [cid, neighbors] of adj.entries()) {
  const item = Array.from(grid.values()).flat().find(x => x.clusterId === cid);
  if (item) {
    const d = Math.hypot(item.lat - 9.5857, item.lon - 77.9547) * 111;
    if (d < minD) { minD = d; vptCid = cid; }
  }
}

console.log('VPT cluster:', vptCid, 'dist:', minD.toFixed(3), 'km');

// BFS from VPT
const visited = new Set([vptCid]);
const queue = [vptCid];
let minLatReached = 99;
let furthestCluster = null;

while (queue.length > 0) {
  const curr = queue.shift();
  const item = Array.from(grid.values()).flat().find(x => x.clusterId === curr);
  if (item && item.lat < minLatReached) {
    minLatReached = item.lat;
    furthestCluster = item;
  }
  for (const n of adj.get(curr) || []) {
    if (!visited.has(n)) {
      visited.add(n);
      queue.push(n);
    }
  }
}

console.log(`From VPT, reached min lat: ${minLatReached.toFixed(4)} at [${furthestCluster?.lat}, ${furthestCluster?.lon}]`);
console.log(`Tirunelveli is at lat 8.7303`);
