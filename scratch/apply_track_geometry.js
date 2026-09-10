const fs = require('fs');

const tracks = JSON.parse(fs.readFileSync('scratch/network_tracks.json', 'utf8'));

// 1. Update js/corridor_data.js
let corridorData = fs.readFileSync('js/corridor_data.js', 'utf8');

// Accurate station coordinates on tracks
const stationReplacements = [
  ['{ code: "MAS", name: "Puratchi Thalaivar Dr. M.G.R. Chennai Central", km: 0.0, lat: 13.0827, lng: 80.2707, loops: 12, division: "Chennai" }',
   '{ code: "MAS", name: "Puratchi Thalaivar Dr. M.G.R. Chennai Central", km: 0.0, lat: 13.08476, lng: 80.27486, loops: 12, division: "Chennai" }'],
  ['{ code: "AJJ", name: "Arakkonam Junction", km: 68.6, lat: 13.0783, lng: 79.6687, loops: 6, division: "Chennai" }',
   '{ code: "AJJ", name: "Arakkonam Junction", km: 68.6, lat: 13.08151, lng: 79.66799, loops: 6, division: "Chennai" }'],
  ['{ code: "KPD", name: "Katpadi Junction (Vellore)", km: 129.6, lat: 12.9698, lng: 79.1378, loops: 6, division: "Chennai" }',
   '{ code: "KPD", name: "Katpadi Junction (Vellore)", km: 129.6, lat: 12.97273, lng: 79.13534, loops: 6, division: "Chennai" }'],
  ['{ code: "JTJ", name: "Jolarpettai Junction", km: 214.1, lat: 12.5594, lng: 78.5746, loops: 8, division: "Chennai" }',
   '{ code: "JTJ", name: "Jolarpettai Junction", km: 214.1, lat: 12.56085, lng: 78.57782, loops: 8, division: "Chennai" }'],
  ['{ code: "MAP", name: "Morappur", km: 268.5, lat: 12.1287, lng: 78.3842, loops: 4, division: "Salem" }',
   '{ code: "MAP", name: "Morappur", km: 268.5, lat: 12.12407, lng: 78.39387, loops: 4, division: "Salem" }'],
  ['{ code: "SA", name: "Salem Junction", km: 334.2, lat: 11.6643, lng: 78.1460, loops: 6, division: "Salem" }',
   '{ code: "SA", name: "Salem Junction", km: 334.2, lat: 11.67173, lng: 78.11342, loops: 6, division: "Salem" }'],
  ['{ code: "ED", name: "Erode Junction", km: 394.0, lat: 11.3410, lng: 77.7172, loops: 7, division: "Salem" }',
   '{ code: "ED", name: "Erode Junction", km: 394.0, lat: 11.32768, lng: 77.72593, loops: 7, division: "Salem" }'],
  ['{ code: "TUP", name: "Tiruppur", km: 444.2, lat: 11.1085, lng: 77.3411, loops: 4, division: "Salem" }',
   '{ code: "TUP", name: "Tiruppur", km: 444.2, lat: 11.10891, lng: 77.34125, loops: 4, division: "Salem" }'],
  ['{ code: "CBE", name: "Coimbatore Junction", km: 494.4, lat: 11.0016, lng: 76.9628, loops: 6, division: "Salem" }',
   '{ code: "CBE", name: "Coimbatore Junction", km: 494.4, lat: 10.99764, lng: 76.96630, loops: 6, division: "Salem" }'],
  ['{ code: "MS", name: "Chennai Egmore", km: 2.1, lat: 13.0784, lng: 80.2612, loops: 10, division: "Chennai" }',
   '{ code: "MS", name: "Chennai Egmore", km: 2.1, lat: 13.07768, lng: 80.26019, loops: 10, division: "Chennai" }'],
  ['{ code: "TBM", name: "Tambaram", km: 27.2, lat: 12.9249, lng: 80.1478, loops: 8, division: "Chennai" }',
   '{ code: "TBM", name: "Tambaram", km: 27.2, lat: 12.92604, lng: 80.11916, loops: 8, division: "Chennai" }'],
  ['{ code: "CGL", name: "Chengalpattu Junction", km: 55.8, lat: 12.6841, lng: 79.9836, loops: 6, division: "Chennai" }',
   '{ code: "CGL", name: "Chengalpattu Junction", km: 55.8, lat: 12.69286, lng: 79.98152, loops: 6, division: "Chennai" }'],
  ['{ code: "TMV", name: "Tindivanam", km: 121.4, lat: 12.2286, lng: 79.6508, loops: 4, division: "Tiruchirappalli" }',
   '{ code: "TMV", name: "Tindivanam", km: 121.4, lat: 12.22941, lng: 79.65133, loops: 4, division: "Tiruchirappalli" }'],
  ['{ code: "VM", name: "Villupuram Junction", km: 158.9, lat: 11.9401, lng: 79.4861, loops: 7, division: "Tiruchirappalli" }',
   '{ code: "VM", name: "Villupuram Junction", km: 158.9, lat: 11.94297, lng: 79.50010, loops: 7, division: "Tiruchirappalli" }'],
  ['{ code: "VRI", name: "Vriddhachalam Junction", km: 213.4, lat: 11.5157, lng: 79.3243, loops: 5, division: "Tiruchirappalli" }',
   '{ code: "VRI", name: "Vriddhachalam Junction", km: 213.4, lat: 11.53497, lng: 79.31607, loops: 5, division: "Tiruchirappalli" }'],
  ['{ code: "TPJ", name: "Tiruchirappalli Junction", km: 336.8, lat: 10.7905, lng: 78.6946, loops: 8, division: "Tiruchirappalli" }',
   '{ code: "TPJ", name: "Tiruchirappalli Junction", km: 336.8, lat: 10.79407, lng: 78.68536, loops: 8, division: "Tiruchirappalli" }'],
  ['{ code: "DG", name: "Dindigul Junction", km: 431.1, lat: 10.3673, lng: 77.9803, loops: 5, division: "Madurai" }',
   '{ code: "DG", name: "Dindigul Junction", km: 431.1, lat: 10.35381, lng: 77.98547, loops: 5, division: "Madurai" }'],
  ['{ code: "MDU", name: "Madurai Junction", km: 493.3, lat: 9.9252, lng: 78.1198, loops: 7, division: "Madurai" }',
   '{ code: "MDU", name: "Madurai Junction", km: 493.3, lat: 9.91991, lng: 78.11031, loops: 7, division: "Madurai" }'],
  ['{ code: "VPT", name: "Virudhunagar Junction", km: 536.8, lat: 9.5872, lng: 77.9575, loops: 5, division: "Madurai" }',
   '{ code: "VPT", name: "Virudhunagar Junction", km: 536.8, lat: 9.59641, lng: 77.95774, loops: 5, division: "Madurai" }'],
  ['{ code: "TEN", name: "Tirunelveli Junction", km: 650.2, lat: 8.7139, lng: 77.7567, loops: 6, division: "Madurai" }',
   '{ code: "TEN", name: "Tirunelveli Junction", km: 650.2, lat: 8.73636, lng: 77.70798, loops: 6, division: "Madurai" }'],
  ['{ code: "CAPE", name: "Kanyakumari", km: 735.6, lat: 8.0883, lng: 77.5385, loops: 4, division: "Thiruvananthapuram" }',
   '{ code: "CAPE", name: "Kanyakumari", km: 735.6, lat: 8.08803, lng: 77.54250, loops: 4, division: "Thiruvananthapuram" }']
];

for (const [target, repl] of stationReplacements) {
  corridorData = corridorData.replace(target, repl);
}

// Add trackGeometry
const trackGeometryCode = `\n  // Authentic Southern Railway Track Geometry (OpenStreetMap Network Topology)\n  trackGeometry: ${JSON.stringify(tracks, null, 2)},\n`;

if (!corridorData.includes('trackGeometry:')) {
  corridorData = corridorData.replace('stations: [', trackGeometryCode + '  stations: [');
} else {
  corridorData = corridorData.replace(/trackGeometry:\s*\{[\s\S]*?feederRoutes:\s*\[[\s\S]*?\]\s*\},/, trackGeometryCode.trim());
}

fs.writeFileSync('js/corridor_data.js', corridorData);
console.log('Updated js/corridor_data.js with authentic stations & trackGeometry');
