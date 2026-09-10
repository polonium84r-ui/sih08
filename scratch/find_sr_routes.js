const fs = require('fs');
const https = require('https');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'NodeJS' } }, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  const localPath = 'scratch/trains.json';
  if (!fs.existsSync(localPath)) {
    console.log('Downloading trains.json...');
    await download('https://raw.githubusercontent.com/datameet/railways/master/trains.json', localPath);
    console.log('Downloaded trains.json');
  }

  const raw = fs.readFileSync(localPath, 'utf8');
  const data = JSON.parse(raw);
  console.log('Total features:', data.features.length);

  // Find trains between MAS and CBE
  const cbeTrains = data.features.filter(f => {
    const p = f.properties || {};
    const name = (p.name || '').toLowerCase();
    const from = (p.from_station_code || '');
    const to = (p.to_station_code || '');
    return (from === 'MAS' && to === 'CBE') || (from === 'CBE' && to === 'MAS') ||
           name.includes('kovai') || name.includes('cheran');
  });

  console.log('Found CBE trains:', cbeTrains.map(t => ({
    name: t.properties.name,
    number: t.properties.number,
    from: t.properties.from_station_code,
    to: t.properties.to_station_code,
    coordsCount: t.geometry.coordinates.length
  })));

  // Find trains between MS and MDU / CAPE / TPJ
  const chordTrains = data.features.filter(f => {
    const p = f.properties || {};
    const name = (p.name || '').toLowerCase();
    const from = (p.from_station_code || '');
    const to = (p.to_station_code || '');
    return ((from === 'MS' || from === 'MAS') && (to === 'MDU' || to === 'CAPE' || to === 'TEN' || to === 'TPJ')) ||
           name.includes('vaigai') || name.includes('pandian') || name.includes('kanyakumari');
  });

  console.log('Found Chord trains:', chordTrains.map(t => ({
    name: t.properties.name,
    number: t.properties.number,
    from: t.properties.from_station_code,
    to: t.properties.to_station_code,
    coordsCount: t.geometry.coordinates.length
  })));
}

main().catch(console.error);
