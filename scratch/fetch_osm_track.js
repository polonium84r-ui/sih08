const https = require('https');
const fs = require('fs');

const query = `[out:json][timeout:25];
way["railway"="rail"](12.28,79.70,12.33,79.74);
out geom;`;

const postData = 'data=' + encodeURIComponent(query);

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
      const parsed = JSON.parse(body);
      fs.writeFileSync('scratch/olakur_osm.json', JSON.stringify(parsed, null, 2));
      console.log('Got OSM elements:', parsed.elements.length);
      parsed.elements.forEach((el, idx) => {
        console.log(`Way ${idx}: ${el.tags?.name || 'unnamed'}, points: ${el.geometry?.length}`);
        if (el.geometry && el.geometry.length > 0) {
          console.log('  first point:', el.geometry[0]);
          console.log('  mid point:', el.geometry[Math.floor(el.geometry.length/2)]);
          console.log('  last point:', el.geometry[el.geometry.length - 1]);
        }
      });
    } catch(e) {
      console.error('Error parsing response:', e.message, body.slice(0, 200));
    }
  });
});

req.on('error', (e) => console.error('Req error:', e.message));
req.write(postData);
req.end();
