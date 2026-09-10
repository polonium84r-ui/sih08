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

async function testSouth() {
  console.log('Testing Overpass query for southern Tamil Nadu mainlines...');
  const q = `[out:json][timeout:60];
way["railway"="rail"]["service"!~".*"](8.0,76.5,11.2,80.5);
out geom;`;
  const t0 = Date.now();
  try {
    const data = await queryOverpass(q);
    console.log(`Received ${data.elements.length} ways in ${(Date.now() - t0)/1000}s.`);
    fs.writeFileSync('scratch/tn_south_ways.json', JSON.stringify(data));
    console.log('Saved scratch/tn_south_ways.json size:', (fs.statSync('scratch/tn_south_ways.json').size / 1024 / 1024).toFixed(2), 'MB');
  } catch(e) {
    console.error('Error:', e.message);
  }
}

testSouth();
