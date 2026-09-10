const fs = require('fs');

async function checkStations() {
  const https = require('https');
  function get(url) {
    return new Promise((res, rej) => {
      https.get(url, { headers: { 'User-Agent': 'NodeJS' } }, r => {
        let b = '';
        r.on('data', d => b += d);
        r.on('end', () => res(JSON.parse(b)));
      }).on('error', rej);
    });
  }

  const stationsData = await get('https://raw.githubusercontent.com/datameet/railways/master/stations.json');
  console.log('stations.json features count:', stationsData.features ? stationsData.features.length : 0);
  
  const codes = ['MAS', 'AJJ', 'KPD', 'JTJ', 'MAP', 'SA', 'ED', 'TUP', 'CBE', 'MS', 'TBM', 'CGL', 'TMV', 'VM', 'VRI', 'TPJ', 'DG', 'MDU', 'VPT', 'TEN', 'CAPE'];
  const found = (stationsData.features || []).filter(f => {
    const p = f.properties || {};
    return codes.includes(p.code);
  });
  console.log('Found stations:', found.map(f => ({
    code: f.properties.code,
    name: f.properties.name,
    coords: [f.geometry.coordinates[1], f.geometry.coordinates[0]] // [lat, lng]
  })));
}

checkStations().catch(console.error);
