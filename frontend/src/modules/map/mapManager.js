/**
 * Leaflet Map Controller for Southern Railway Network
 * High-precision OpenStreetMap track rendering, stations, and worksite possessions.
 */

import corridorData from '../../data/corridorData.js';
import trackGeometry from '../../data/trackGeometry.js';
import store from '../../store/corridorStore.js';

export class MapManager {
  constructor(containerId = "leafletMapContainer") {
    this.containerId = containerId;
    this.map = null;
    this.layers = {
      trains: [],
      trainMarkers: {},
      block: null,
      blockMarker: null,
      speedRestriction: null,
      conflicts: null,
      pendingRequests: []
    };
  }

  init() {
    const mapEl = document.getElementById(this.containerId);
    if (!mapEl || typeof L === "undefined") return;

    this.map = L.map(this.containerId, {
      zoomControl: true
    }).setView([11.1271, 78.6569], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors | Southern Railway (SR)"
    }).addTo(this.map);

    this.renderTracks();
    this.renderStations();
    this.plotRequisitions();

    // Listen to store updates
    store.subscribe((changeType, payload) => {
      if (changeType === 'ACTIVE_CORRIDOR_CHANGED' || changeType === 'REQUISITIONS_UPDATED') {
        this.plotRequisitions();
      }
    });
  }

  renderTracks() {
    const tg = trackGeometry || (corridorData && corridorData.trackGeometry) || {};
    const getStCoord = (code, fallbackLat, fallbackLng) => {
      const s = (corridorData.stations || []).find(st => st.code === code);
      return s ? [s.lat, s.lng] : [fallbackLat, fallbackLng];
    };

    const trunkLine1 = tg.trunkLine1 || ["MAS", "AJJ", "KPD", "JTJ", "MAP", "SA", "ED", "TUP", "CBE"].map(c => getStCoord(c, 0, 0));
    const trunkLine2 = tg.trunkLine2 || ["MS", "TBM", "CGL", "TMV", "VM", "VRI", "TPJ", "DG", "MDU", "VPT", "TEN", "CAPE"].map(c => getStCoord(c, 0, 0));
    const feederRoutes = tg.feederRoutes || [
      [getStCoord("ED", 11.3277, 77.7259), [10.9577, 78.0839], getStCoord("TPJ", 10.7941, 78.6854)],
      [getStCoord("CBE", 10.9976, 76.9663), [10.6609, 77.0048], [10.4503, 77.5186], getStCoord("DG", 10.3538, 77.9855)],
      [getStCoord("SA", 11.6717, 78.1134), [11.5954, 78.6015], getStCoord("VRI", 11.5350, 79.3161)],
      [getStCoord("KPD", 12.9727, 79.1353), [12.2253, 79.0747], getStCoord("VM", 11.9430, 79.5001)],
      [getStCoord("AJJ", 13.0815, 79.6680), [12.8342, 79.7036], getStCoord("CGL", 12.6929, 79.9815)]
    ];

    L.polyline(trunkLine1, {
      color: "#1e3a8a",
      weight: 5,
      opacity: 0.92,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(this.map).bindPopup("<strong>Southern Railway Trunk Mainline</strong><br>Chennai Central &ndash; Katpadi &ndash; Jolarpettai &ndash; Salem &ndash; Erode &ndash; Coimbatore");

    L.polyline(trunkLine2, {
      color: "#0f766e",
      weight: 5,
      opacity: 0.92,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(this.map).bindPopup("<strong>Southern Railway Grand Chord</strong><br>Chennai Egmore &ndash; Villupuram &ndash; Trichy &ndash; Madurai &ndash; Kanyakumari");

    feederRoutes.forEach(pts => {
      L.polyline(pts, {
        color: "#475569",
        weight: 3.5,
        opacity: 0.75,
        dashArray: "5, 4"
      }).addTo(this.map);
    });
  }

  renderStations() {
    corridorData.stations.forEach(st => {
      const isMajor = ["MAS", "MS", "SA", "ED", "TPJ", "MDU", "CBE", "KPD", "JTJ"].includes(st.code);
      L.circleMarker([st.lat, st.lng], {
        radius: isMajor ? 6 : 4,
        fillColor: isMajor ? "#0284c7" : "#64748b",
        color: "#ffffff",
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(this.map).bindPopup(`<strong>${st.name} (${st.code})</strong><br>KM ${st.km.toFixed(1)} &bull; ${st.division} Division`);
    });
  }

  plotRequisitions() {
    // Clear old pending markers
    this.layers.pendingRequests.forEach(m => this.map.removeLayer(m));
    this.layers.pendingRequests = [];

    const reqs = store.requisitions || [];
    reqs.forEach(req => {
      const stFrom = corridorData.stations.find(s => s.code === req.fromStation);
      const stTo = corridorData.stations.find(s => s.code === req.toStation);
      if (!stFrom) return;

      const lat = req.lat || (stFrom.lat + (stTo ? (stTo.lat - stFrom.lat) * 0.45 : 0));
      const lng = req.lng || (stFrom.lng + (stTo ? (stTo.lng - stFrom.lng) * 0.45 : 0));

      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: "#059669",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 0.95
      }).addTo(this.map);

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 0.8rem; line-height: 1.4;">
          <strong>${req.reqId} &bull; ${req.department}</strong><br>
          <em>${req.sectionName || `${req.fromStation}-${req.toStation}`}</em><br>
          Line: <strong>${req.trackLine}</strong> &bull; Worksite: <strong>${req.kmRange || 'KM 129.50 – 174.00'}</strong><br>
          Window: <span style="color: #059669; font-weight: bold;">${req.recommendedBlock || req.sanctionedSlot || '11:30 – 14:00 IST'}</span>
        </div>
      `);

      this.layers.pendingRequests.push(marker);
    });
  }

  invalidateSize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 150);
    }
  }
}

export default MapManager;
