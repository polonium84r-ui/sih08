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
  console.log('Downloading 100% pure OSM railway tracks for Tamil Nadu...');
  // Chunk 1: North (lat 11.0 to 13.6)
  const qNorth = `[out:json][timeout:90];
way["railway"="rail"]["service"!~"spur|siding|yard"](11.0,76.2,13.6,80.5);
out geom;`;
  console.log('Querying North chunk...');
  const dNorth = await queryOverpass(qNorth);
  console.log(`North chunk: ${dNorth.elements.length} ways.`);
  fs.writeFileSync('scratch/osm_north_all.json', JSON.stringify(dNorth));

  // Chunk 2: South (lat 8.0 to 11.2)
  const qSouth = `[out:json][timeout:90];
way["railway"="rail"]["service"!~"spur|siding|yard"](8.0,76.2,11.2,80.5);
out geom;`;
  console.log('Querying South chunk...');
  const dSouth = await queryOverpass(qSouth);
  console.log(`South chunk: ${dSouth.elements.length} ways.`);
  fs.writeFileSync('scratch/osm_south_all.json', JSON.stringify(dSouth));

  console.log('Done downloading full OSM railway dataset for Tamil Nadu!');
}

main();
