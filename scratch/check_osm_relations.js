const https = require('https');

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
  console.log('Querying major railway relations in Tamil Nadu...');
  const q = `[out:json][timeout:30];
relation["route"="railway"](8.0,76.5,13.5,80.5);
out tags;`;
  try {
    const data = await queryOverpass(q);
    console.log(`Found ${data.elements.length} railway relations.`);
    data.elements.forEach(el => {
      console.log(`${el.id} | ${el.tags?.name || el.tags?.ref || 'unnamed'} | from: ${el.tags?.from || ''} to: ${el.tags?.to || ''}`);
    });
  } catch(e) {
    console.error('Error:', e.message);
  }
}

main();
