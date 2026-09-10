const fs = require('fs');

let content = fs.readFileSync('js/corridor_data.js', 'utf8');

const replacement = `  // Authentic Southern Railway Track Geometry (OpenStreetMap Network Topology)
  // High-precision tracks extracted from OpenStreetMap railway=rail network
  trackGeometry: (typeof TrackGeometry !== "undefined")
    ? TrackGeometry
    : (function() {
        try { return require('./track_geometry.js'); } catch(e) { return {}; }
      })(),`;

const updatedStations = JSON.parse(fs.readFileSync('scratch/updated_stations.json'));
let stationsStr = `  stations: [\n` + updatedStations.map(st => {
  return `    { code: "${st.code}", name: "${st.name}", km: ${st.km.toFixed(1)}, lat: ${st.lat.toFixed(5)}, lng: ${st.lng.toFixed(5)}, loops: ${st.loops}, division: "${st.division}" }`;
}).join(',\n') + `\n  ],`;

const regex = /  stations: \[\r?\n[\s\S]*?\{ code: "CAPE"[\s\S]*?\r?\n  \],/;

if (!regex.test(content)) {
  console.error('Regex did not match stations array in corridor_data.js!');
  process.exit(1);
}

let newContent = content.replace(regex, `${replacement}\n\n${stationsStr}`);

fs.writeFileSync('js/corridor_data.js', newContent);
console.log('Successfully applied trackGeometry and updated stations to js/corridor_data.js!');
