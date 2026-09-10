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

async function main() {
  const q = `[out:json][timeout:30];
way["railway"="rail"](11.96,79.48,12.05,79.55);
out geom;`;
  console.log('Querying gap between 11.96 and 12.05...');
  const d = await queryOverpass(q);
  console.log(`Found ${d.elements.length} ways in gap!`);
  fs.writeFileSync('scratch/gap_vm.json', JSON.stringify(d));
}

main();
