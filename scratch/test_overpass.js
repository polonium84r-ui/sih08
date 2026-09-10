const https = require('https');

async function testOverpass() {
  const query = `[out:json][timeout:25];
(
  way["railway"="rail"]["usage"="main"](10.8,76.8,13.2,80.4);
);
out tags;`;

  const body = 'data=' + encodeURIComponent(query);
  const options = {
    hostname: 'overpass.kumi.systems',
    port: 443,
    path: '/api/interpreter',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'RailFlow/1.0'
    }
  };

  const req = https.request(options, (res) => {
    let resp = '';
    res.on('data', chunk => resp += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode, 'Length:', resp.length);
    });
  });
  req.on('error', console.error);
  req.write(body);
  req.end();
}

testOverpass();
