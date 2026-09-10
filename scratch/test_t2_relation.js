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

async function testRel() {
  console.log('Fetching relation 13319740 (Chennai Egmore - Nagercoil)...');
  const q = `[out:json][timeout:60];
relation(13319740);
way(r);
out geom;`;
  try {
    const data = await queryOverpass(q);
    console.log(`Received ${data.elements.length} ways for Chennai Egmore - Nagercoil.`);
    let totalPts = 0;
    data.elements.forEach(w => {
      if (w.geometry) totalPts += w.geometry.length;
    });
    console.log(`Total track coordinate points: ${totalPts}`);
    fs.writeFileSync('scratch/t2_relation_ways.json', JSON.stringify(data, null, 2));
  } catch(e) {
    console.error('Error:', e.message);
  }
}

testRel();
