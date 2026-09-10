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

async function run() {
  if (!fs.existsSync('scratch/stations.json')) {
    await download('https://raw.githubusercontent.com/datameet/railways/master/stations.json', 'scratch/stations.json');
  }
  const stationsData = JSON.parse(fs.readFileSync('scratch/stations.json', 'utf8'));

  function findStation(code) {
    const f = stationsData.features.find(st => st.properties && st.properties.code === code);
    return f ? {
      code: f.properties.code,
      name: f.properties.name,
      coords: [Number(f.geometry.coordinates[1].toFixed(5)), Number(f.geometry.coordinates[0].toFixed(5))]
    } : null;
  }

  console.log('KPD-VM line:');
  const kpdVmCodes = ['KPD', 'VLR', 'KMM', 'ARV', 'PRL', 'TNM', 'TRK', 'MMP', 'VM'];
  console.log(kpdVmCodes.map(c => findStation(c)).filter(Boolean));

  console.log('CBE-DG line:');
  const cbeDgCodes = ['CBE', 'PTJ', 'CNV', 'POY', 'UDT', 'PLNI', 'ODC', 'DG'];
  console.log(cbeDgCodes.map(c => findStation(c)).filter(Boolean));
}

run().catch(console.error);
