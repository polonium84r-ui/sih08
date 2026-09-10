const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'NodeJS' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function check() {
  const meta = await get('https://raw.githubusercontent.com/datameet/railways/master/trains.json');
  console.log('trains.json type:', typeof meta, Array.isArray(meta) ? 'array len ' + meta.length : Object.keys(meta).slice(0, 5));
  if (meta.features) {
    console.log('GeoJSON features count:', meta.features.length);
    console.log('Sample feature:', JSON.stringify(meta.features[0]).slice(0, 300));
  }
}

check();
