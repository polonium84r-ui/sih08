const https = require('https');
const fs = require('fs');

function queryOverpass(q) {
  return new Promise((resolve, reject) => {
    const postData = 'data=' + encodeURIComponent(q);
    const req = https.request('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'RailFlow-TrackExtractor/1.0'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) {
          reject(new Error(e.message + ': ' + body.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testCglVm() {
  console.log('Fetching way[railway=rail] for Chengalpattu to Villupuram...');
  // Bounding box for CGL to VM (roughly 11.9 to 12.8 lat, 79.4 to 80.1 lon)
  // Only main railway lines
  const q = `[out:json][timeout:30];
way["railway"="rail"]["service"!~".*"](11.9,79.4,12.75,80.05);
out geom;`;
  try {
    const data = await queryOverpass(q);
    console.log(`Received ${data.elements.length} ways between CGL and VM.`);
    fs.writeFileSync('scratch/cgl_vm_ways.json', JSON.stringify(data, null, 2));

    // Find points near Olakur
    let olakurPts = [];
    data.elements.forEach(w => {
      if (w.geometry) {
        w.geometry.forEach(pt => {
          const dist = Math.hypot(pt.lat - 12.30493, pt.lon - 79.72093) * 111;
          if (dist < 1) olakurPts.push({ pt, dist: dist.toFixed(3) + 'km' });
        });
      }
    });
    olakurPts.sort((a,b) => parseFloat(a.dist) - parseFloat(b.dist));
    console.log('Points within 1km of Olakur station:', olakurPts.length);
    console.log('Closest point to Olakur:', olakurPts[0]);
  } catch(e) {
    console.error('Error:', e.message);
  }
}

testCglVm();
