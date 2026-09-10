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

async function testTN() {
  console.log('Testing Overpass query for Tamil Nadu mainlines...');
  // Let's test northern chunk first: lat 11.5 to 13.5, lon 76.5 to 80.5 (MAS-JTJ-SA-ED-CBE and MS-VM)
  const q = `[out:json][timeout:60];
way["railway"="rail"]["service"!~".*"]["usage"~"main|branch|.*"](11.0,76.5,13.5,80.5);
out geom;`;
  const t0 = Date.now();
  try {
    const data = await queryOverpass(q);
    console.log(`Received ${data.elements.length} ways in ${(Date.now() - t0)/1000}s.`);
    fs.writeFileSync('scratch/tn_north_ways.json', JSON.stringify(data));
    console.log('Saved scratch/tn_north_ways.json size:', (fs.statSync('scratch/tn_north_ways.json').size / 1024 / 1024).toFixed(2), 'MB');
  } catch(e) {
    console.error('Error:', e.message);
  }
}

testTN();
