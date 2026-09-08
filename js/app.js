/**
 * RailFlow - Main Application Coordinator
 * Enterprise Southern Railway (Tamil Nadu Network) Decision Support System:
 * - Operations Tab with Leaflet Tamil Nadu railway map & telemetry sidebar
 * - Block Planner Register (Katpadi - Jolarpettai corridor)
 * - Candidate Windows Cards
 * - Side-by-Side Comparison Matrix
 * - Impact Analysis Subview with mini map, timeline, and affected trains
 * - Confirm Block Approval Modal
 * - Coordination & Decision History with 4 KPI cards & approval records
 * - Corridor & Rule Configuration
 */

document.addEventListener("DOMContentLoaded", () => {
  const data = window.CorridorData;
  const auditLogger = new window.AuditLogger();
  let mapInstance = null;
  let impactMiniMap = null;
  let mapLayers = {
    trains: [],
    trainMarkers: {},
    block: null,
    blockMarker: null,
    speedRestriction: null,
    conflicts: null,
    pendingRequests: []
  };

  // Single Authoritative Active Corridor State across Map & Dashboard
  let activeCorridorState = {
    requestId: "REQ-SR-ENG-104",
    reqId: "REQ-SR-ENG-104",
    fromStation: "KPD",
    toStation: "JTJ",
    sectionName: "Katpadi Junction – Jolarpettai Junction",
    worksiteStartKm: 129.50,
    worksiteEndKm: 174.00,
    kmRange: "KM 129.50 – KM 174.00",
    trackLine: "UP Main Line",
    blockType: "UP Line Block",
    sanctionedSlot: "11:30 – 14:00 IST",
    recommendedBlock: "11:30 – 14:00 IST",
    status: "SCHEDULED",
    department: "Civil / Track (P-Way)",
    deptCode: "CIVIL",
    workType: "Plain Track Tamping & Track Geometry Alignment",
    machinery: "CSM 09-32 Continuous Action Tamping Machine + Ballast Regulator (BRM)",
    durationMin: 150,
    windowType: "Preferred Window",
    liveDataAvailable: false
  };
  let activeCorridorToken = 0;
  let currentRecommendation = null;
  let currentCorridorData = null;
  let currentEvaluationId = 0;
  let activeRequestFingerprint = null;


  // =========================================================================
  // Live Header Clock (Real-Time System Date & Time)
  // =========================================================================
  function updateLiveHeaderClock() {
    const clockEl = document.getElementById("liveHeaderClock");
    if (!clockEl) return;
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(now.getDate()).padStart(2, "0");
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    clockEl.innerHTML = `${day} ${month} ${year} &bull; ${hours}:${minutes}:${seconds} IST`;
  }
  updateLiveHeaderClock();
  setInterval(updateLiveHeaderClock, 1000);

  // =========================================================================
  // 1. Navigation Tab Switching (Enterprise Tabs)
  // =========================================================================
  const navTabs = document.querySelectorAll(".rf-nav-item");
  const tabViews = {
    tabOperations: document.getElementById("tabOperations"),
    tabRaiseRequest: document.getElementById("tabRaiseRequest"),
    tabBlockPlanner: document.getElementById("tabBlockPlanner"),
    tabCoordination: document.getElementById("tabCoordination"),
    tabConfiguration: document.getElementById("tabConfiguration")
  };

  function switchMainTab(tabId) {
    navTabs.forEach(t => {
      if (t.getAttribute("data-tab") === tabId) {
        t.classList.add("active");
      } else {
        t.classList.remove("active");
      }
    });

    Object.keys(tabViews).forEach(k => {
      if (tabViews[k]) {
        if (k === tabId) {
          tabViews[k].classList.add("active");
        } else {
          tabViews[k].classList.remove("active");
        }
      }
    });

    if (tabId === "tabOperations" && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 150);
    } else if (tabId === "tabBlockPlanner") {
      renderActivityRegister();
    } else if (tabId === "tabCoordination") {
      renderCoordinationView();
    } else if (tabId === "tabConfiguration") {
      syncConfigurationInputs();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const tabId = tab.getAttribute("data-tab");
      switchMainTab(tabId);
    });
  });

  // =========================================================================
  // 2. Leaflet Map Initialization (Tamil Nadu Railway Network)
  // =========================================================================
  function initOperationsMap() {
    const mapEl = document.getElementById("leafletMapContainer");
    if (!mapEl || typeof L === "undefined") return;

    // Centered squarely on Tamil Nadu (Chennai to Kanyakumari, Salem to Nagapattinam)
    mapInstance = L.map("leafletMapContainer", {
      zoomControl: true
    }).setView([11.1271, 78.6569], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors | Southern Railway (SR)"
    }).addTo(mapInstance);

    // 1. Define Authentic Tamil Nadu Mainlines & Branch Railway Corridors
    // Trunk Line 1: Chennai Central -> Katpadi -> Jolarpettai -> Salem -> Erode -> Coimbatore
    const trunkLine1 = [
      [13.0827, 80.2755], // MAS (Chennai Central)
      [13.0838, 79.6687], // AJJ (Arakkonam)
      [12.9734, 79.1382], // KPD (Katpadi)
      [12.5284, 78.5776], // JTJ (Jolarpettai)
      [12.0628, 78.4312], // MAP (Morappur)
      [11.6643, 78.1460], // SA  (Salem)
      [11.3410, 77.7172], // ED  (Erode)
      [11.1085, 77.3411], // TUP (Tiruppur)
      [11.0168, 76.9558]  // CBE (Coimbatore)
    ];

    // Trunk Line 2: Chennai Egmore -> Villupuram -> Trichy -> Madurai -> Tirunelveli -> Kanyakumari
    const trunkLine2 = [
      [13.0818, 80.2612], // MS  (Chennai Egmore)
      [12.9249, 80.1000], // TBM (Tambaram)
      [12.6841, 79.9836], // CGL (Chengalpattu)
      [12.2470, 79.6600], // TMV (Tindivanam)
      [11.9398, 79.4862], // VM  (Villupuram)
      [11.5173, 79.3323], // VRI (Vriddhachalam)
      [10.7905, 78.6908], // TPJ (Tiruchirappalli)
      [10.3624, 77.9695], // DG  (Dindigul)
      [9.9197, 78.1194],  // MDU (Madurai)
      [9.5872, 77.9575],  // VPT (Virudhunagar)
      [8.7139, 77.7567],  // TEN (Tirunelveli)
      [8.0883, 77.5385]   // CAPE(Kanniyakumari)
    ];

    // Connecting Network Lines across Tamil Nadu
    const feederRoutes = [
      // Erode -> Karur -> Tiruchirappalli Junction
      [[11.3410, 77.7172], [10.9577, 78.0839], [10.7905, 78.6908]],
      // Coimbatore -> Pollachi -> Palani -> Dindigul
      [[11.0168, 76.9558], [10.6609, 77.0048], [10.4503, 77.5186], [10.3624, 77.9695]],
      // Salem -> Attur -> Vriddhachalam Chord
      [[11.6643, 78.1460], [11.5954, 78.6015], [11.5173, 79.3323]],
      // Katpadi -> Tiruvannamalai -> Villupuram Junction
      [[12.9734, 79.1382], [12.2253, 79.0747], [11.9398, 79.4862]],
      // Arakkonam -> Kanchipuram -> Chengalpattu Chord
      [[13.0838, 79.6687], [12.8342, 79.7036], [12.6841, 79.9836]],
      // Madurai -> Manamadurai -> Ramanathapuram -> Rameswaram
      [[9.9197, 78.1194], [9.8550, 78.5830], [9.3639, 78.8395], [9.2876, 79.3129]],
      // Jolarpettai -> Kuppam (Bangalore/SWR border)
      [[12.5284, 78.5776], [12.7483, 78.3614]]
    ];

    // Draw Mainlines (Primary Double Lines)
    L.polyline(trunkLine1, {
      color: "#1e3a8a",
      weight: 5,
      opacity: 0.9,
      lineCap: "round"
    }).addTo(mapInstance).bindPopup("<strong>Southern Railway Trunk Mainline</strong><br>Chennai Central &ndash; Katpadi &ndash; Salem &ndash; Coimbatore");

    L.polyline(trunkLine2, {
      color: "#0f766e",
      weight: 5,
      opacity: 0.9,
      lineCap: "round"
    }).addTo(mapInstance).bindPopup("<strong>Southern Railway Grand Chord</strong><br>Chennai Egmore &ndash; Villupuram &ndash; Trichy &ndash; Madurai &ndash; Kanyakumari");

    // Draw Cross-Connecting Lines
    feederRoutes.forEach(pts => {
      L.polyline(pts, {
        color: "#475569",
        weight: 3.5,
        opacity: 0.75,
        dashArray: "5, 4"
      }).addTo(mapInstance);
    });

    // 2. Station Markers (All Tamil Nadu Network Stations)
    data.stations.forEach(st => {
      const isBlockJunction = st.code === "KPD" || st.code === "JTJ";
      const isMajorDivisionalHub = ["MAS", "MS", "SA", "ED", "TPJ", "MDU", "CBE"].includes(st.code);

      L.circleMarker([st.lat, st.lng], {
        radius: isBlockJunction ? 8 : (isMajorDivisionalHub ? 6 : 4.5),
        fillColor: isBlockJunction ? "#dc2626" : (isMajorDivisionalHub ? "#0284c7" : "#0f172a"),
        color: "#ffffff",
        weight: isBlockJunction ? 2.5 : 1.5,
        fillOpacity: 1
      }).addTo(mapInstance).bindPopup(`
        <div style="font-family: var(--font-sans); font-size: 12px; line-height: 1.4;">
          <strong style="color: #0f172a; font-size: 13px;">${st.name} (${st.code})</strong><br>
          <span style="color: #64748b;">Division:</span> <strong>${st.division || 'SR'}</strong> | 
          <span style="color: #64748b;">KM:</span> <strong>${st.km}</strong><br>
          <span style="color: #64748b;">Platforms:</span> ${st.platforms || 4} | 
          <span style="color: #64748b;">Tracks:</span> ${(st.lines || []).join(", ")}
          ${isBlockJunction ? `<br><span style="display:inline-block; margin-top:4px; padding:2px 6px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:3px; font-weight:700;">MAINTENANCE BLOCK TERMINAL</span>` : ''}
        </div>
      `);
    });

    setupMapLayerControls();
    plotRequisitionMapMarkers();
    setActiveCorridor(activeCorridorState);
  }

  function plotRequisitionMapMarkers() {
    if (!mapInstance) return;
    mapLayers.pendingRequests.forEach(m => mapInstance.removeLayer(m));
    mapLayers.pendingRequests = [];

    (data.requisitions || []).forEach(req => {
      const isScheduled = req.status === "SCHEDULED" || req.status === "APPROVED" || (req.status && (req.status.includes("SCHEDULED") || req.status.includes("APPROVED") || req.status.includes("SIMULATED")));
      const displayStatus = isScheduled ? "SCHEDULED" : "UNSCHEDULED (NO FEASIBLE BLOCK)";
      
      const iconBg = req.deptCode === "CIVIL" ? "#16a34a" : (req.deptCode === "SNT" ? "#0284c7" : (req.deptCode === "TRD" ? "#d97706" : "#9333ea"));
      const iconSymbol = req.deptCode === "CIVIL" ? "🛠️" : (req.deptCode === "SNT" ? "📡" : (req.deptCode === "TRD" ? "⚡" : "🛞"));

      const reqIcon = L.divIcon({
        className: "custom-req-map-marker",
        html: `<div style="background: ${iconBg}; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2.5px solid #ffffff; box-shadow: 0 0 12px ${iconBg}; cursor: pointer;" title="${req.reqId}: ${req.workType}">${iconSymbol}</div>`,
        iconSize: [28, 28]
      });

      const slotDisplay = req.sanctionedSlot || req.recommendedBlock || "11:00 – 13:15 IST";
      const kmDisplay = req.kmRange || (req.worksiteStartKm && req.worksiteEndKm ? `KM ${parseFloat(req.worksiteStartKm).toFixed(2)} – KM ${parseFloat(req.worksiteEndKm).toFixed(2)}` : 'KM 129.50 – KM 174.00');
      const corridorDisplay = req.sectionName || "Katpadi Junction – Jolarpettai Junction";
      const lineDisplay = req.trackLine || "UP Main Line";
      const blockTypeDisplay = req.blockType || "UP Line Block";

      const marker = L.marker([req.lat, req.lng], { icon: reqIcon })
        .addTo(mapInstance)
        .bindPopup(`
          <div style="font-family: var(--font-sans); font-size: 12px; line-height: 1.45; min-width: 210px;">
            <div style="background: #fef3c7; color: #b45309; padding: 2px 7px; border-radius: 4px; font-weight: 800; display: inline-block; margin-bottom: 5px; font-size: 10px; border: 1px solid #fde68a;">
              DEPARTMENT REQUISITION &bull; ${req.reqId}
            </div><br>
            <strong style="color: #0f172a; font-size: 13px;">${req.department}</strong><br>
            <span style="color: #64748b;">Nature of Work:</span> <strong>${req.workType}</strong><br>
            <span style="color: #64748b;">Corridor:</span> <strong>${corridorDisplay}</strong><br>
            <span style="color: #64748b;">Track Line:</span> <strong>${lineDisplay}</strong><br>
            <span style="color: #64748b;">Block Type:</span> <strong>${blockTypeDisplay}</strong><br>
            <span style="color: #64748b;">Worksite KM:</span> <strong>${kmDisplay}</strong><br>
            <span style="color: #64748b;">Duration Needed:</span> <strong>${req.durationMin} mins</strong><br>
            <span style="color: #64748b;">Status:</span> <strong style="color: ${isScheduled ? '#16a34a' : '#dc2626'};">${displayStatus}</strong>
            <br>
            <div style="margin-top: 5px; padding: 4px 7px; background: ${isScheduled ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isScheduled ? '#86efac' : '#fecaca'}; border-radius: 4px; color: ${isScheduled ? '#166534' : '#991b1b'}; font-size: 11px; font-weight: 700;">
              ${isScheduled ? `Scheduled Window: ${slotDisplay}` : `⚠️ No Feasible Slot Available`}
            </div>
          </div>
        `);

      mapLayers.pendingRequests.push(marker);
      mapLayers.trainMarkers[req.reqId] = marker;
    });
  }

  function setupMapLayerControls() {
    const chkTrains = document.getElementById("layerTrains");
    const chkBlock = document.getElementById("layerProposedBlock");
    const chkSpeed = document.getElementById("layerSpeedRestriction");
    const chkConflicts = document.getElementById("layerConflicts");

    if (chkTrains) {
      chkTrains.addEventListener("change", (e) => {
        mapLayers.trains.forEach(m => {
          if (e.target.checked) mapInstance.addLayer(m);
          else mapInstance.removeLayer(m);
        });
      });
    }

    if (chkBlock) {
      chkBlock.addEventListener("change", (e) => {
        if (mapLayers.block) {
          if (e.target.checked) {
            mapInstance.addLayer(mapLayers.block);
            if (mapLayers.blockMarker) mapInstance.addLayer(mapLayers.blockMarker);
          } else {
            mapInstance.removeLayer(mapLayers.block);
            if (mapLayers.blockMarker) mapInstance.removeLayer(mapLayers.blockMarker);
          }
        }
      });
    }

    if (chkSpeed) {
      chkSpeed.addEventListener("change", (e) => {
        if (mapLayers.speedRestriction) {
          if (e.target.checked) mapInstance.addLayer(mapLayers.speedRestriction);
          else mapInstance.removeLayer(mapLayers.speedRestriction);
        }
      });
    }

    if (chkConflicts) {
      chkConflicts.addEventListener("change", (e) => {
        if (mapLayers.conflicts) {
          if (e.target.checked) mapInstance.addLayer(mapLayers.conflicts);
          else mapInstance.removeLayer(mapLayers.conflicts);
        }
      });
    }
  }

  // Mini Map in Impact Analysis View (Katpadi - Jolarpettai Section)
  function initImpactMiniMap() {
    const miniEl = document.getElementById("impactMiniMapContainer");
    if (!miniEl || typeof L === "undefined") return;

    if (impactMiniMap) {
      impactMiniMap.invalidateSize();
      return;
    }

    impactMiniMap = L.map("impactMiniMapContainer", {
      zoomControl: false,
      attributionControl: false
    }).setView([12.7509, 78.8579], 9);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18
    }).addTo(impactMiniMap);

    const kpd = data.stations.find(s => s.code === "KPD");
    const jtj = data.stations.find(s => s.code === "JTJ");

    if (kpd && jtj) {
      L.polyline([[kpd.lat, kpd.lng], [jtj.lat, jtj.lng]], {
        color: "#dc2626",
        weight: 6,
        dashArray: "6, 4"
      }).addTo(impactMiniMap);

      // Station endpoints on mini map
      [kpd, jtj].forEach(st => {
        L.circleMarker([st.lat, st.lng], {
          radius: 6,
          fillColor: "#dc2626",
          color: "#ffffff",
          weight: 2,
          fillOpacity: 1
        }).addTo(impactMiniMap).bindPopup(`<strong>${st.name} (${st.code})</strong>`);
      });

      const blockIcon = L.divIcon({
        className: "mini-block-icon",
        html: `<div style="background: #dc2626; color: #fff; padding: 1px 5px; border-radius: 3px; font-size: 10px; font-weight: bold; white-space: nowrap;">BLOCK: KPD–JTJ</div>`,
        iconSize: [80, 18]
      });
      const midLat = (kpd.lat + jtj.lat) / 2;
      const midLng = (kpd.lng + jtj.lng) / 2;
      L.marker([midLat, midLng], { icon: blockIcon }).addTo(impactMiniMap);

      L.popup({ autoClose: false, closeOnClick: false })
        .setLatLng([midLat, midLng])
        .setContent("<span style='font-size: 11px; font-weight: 600;'>Section: Katpadi Junction — Jolarpettai Junction (SR)</span>")
        .openOn(impactMiniMap);
    }
  }

  // =========================================================================
  // 3. Authoritative Active Corridor State & Operations Dashboard
  // =========================================================================
  function setActiveCorridor(newCorridor) {
    if (!newCorridor) return;
    const token = ++activeCorridorToken;

    const fromCode = (newCorridor.fromStation || activeCorridorState.fromStation || "KPD").toUpperCase();
    const toCode = (newCorridor.toStation || activeCorridorState.toStation || "JTJ").toUpperCase();
    const line = newCorridor.trackLine || activeCorridorState.trackLine || "UP Main Line";
    const block = newCorridor.blockType || activeCorridorState.blockType || "UP Line Block";
    const reqId = newCorridor.reqId || newCorridor.requestId || activeCorridorState.requestId;

    const stFrom = (data.stations || []).find(s => s.code === fromCode) || { code: fromCode, name: fromCode, lat: 12.9698, lng: 79.1378, km: 129.6 };
    const stTo = (data.stations || []).find(s => s.code === toCode) || { code: toCode, name: toCode, lat: 12.5594, lng: 78.5746, km: 214.1 };

    const startKm = newCorridor.worksiteStartKm !== undefined && newCorridor.worksiteStartKm !== null
      ? parseFloat(newCorridor.worksiteStartKm)
      : (newCorridor.startKm !== undefined ? parseFloat(newCorridor.startKm) : Math.min(stFrom.km, stTo.km));
    const endKm = newCorridor.worksiteEndKm !== undefined && newCorridor.worksiteEndKm !== null
      ? parseFloat(newCorridor.worksiteEndKm)
      : (newCorridor.endKm !== undefined ? parseFloat(newCorridor.endKm) : Math.max(stFrom.km, stTo.km));

    const kmRange = newCorridor.kmRange || `KM ${startKm.toFixed(2)} – KM ${endKm.toFixed(2)}`;
    const fromCity = stFrom.name.split(" ")[0];
    const toCity = stTo.name.split(" ")[0];
    const secName = newCorridor.sectionName || `${fromCity} – ${toCity}`;

    activeCorridorState = {
      requestId: reqId,
      reqId: reqId,
      fromStation: fromCode,
      toStation: toCode,
      sectionName: secName,
      trackLine: line,
      blockType: block,
      worksiteStartKm: startKm,
      worksiteEndKm: endKm,
      kmRange: kmRange,
      sanctionedSlot: newCorridor.sanctionedSlot || newCorridor.recommendedBlock || "11:00 – 12:30 IST",
      recommendedBlock: newCorridor.recommendedBlock || newCorridor.sanctionedSlot || "11:00 – 12:30 IST",
      status: newCorridor.status || "SCHEDULED",
      department: newCorridor.department || "Mechanical (C&W)",
      deptCode: newCorridor.deptCode || "MECH",
      workType: newCorridor.workType || newCorridor.workDesc || "Maintenance Work",
      machinery: newCorridor.machinery || "Standard Machinery",
      durationMin: newCorridor.durationMin || 90,
      windowType: newCorridor.windowType || "Preferred Window",
      isInsidePreferred: newCorridor.isInsidePreferred !== undefined ? newCorridor.isInsidePreferred : true,
      powerBlock: newCorridor.powerBlock || null,
      adjacentLineRestrictions: newCorridor.adjacentLineRestrictions || null,
      liveDataAvailable: newCorridor.liveDataAvailable !== undefined ? newCorridor.liveDataAvailable : false,
      token: token
    };

    // Stale-state protection: Immediately synchronize Operating Branch card to active requisition
    renderSanctionedTimetable(activeCorridorState);

    // 1. Immediately clear stale UI & show loading indicators
    const badgeEl = document.getElementById("mapCorridorBadge");
    const noticeEl = document.getElementById("opNoticeBox");
    const titleEl = document.getElementById("opCorridorTitle");
    const subEl = document.getElementById("opCorridorSub");
    const metricEl = document.getElementById("opRunningTrainsMetric");
    const dtContainer = document.getElementById("delayedTrainsContainer");
    const acContainer = document.getElementById("activeConflictsContainer");
    const umContainer = document.getElementById("upcomingMaintContainer");

    const corridorLabel = `Southern Railway — ${fromCity}–${toCity} corridor`;

    if (badgeEl) badgeEl.textContent = corridorLabel;
    if (titleEl) titleEl.innerHTML = `${stFrom.name} &mdash; ${stTo.name}`;
    if (subEl) subEl.textContent = `${stFrom.division || 'Salem'} Division • Southern Railway jurisdiction`;

    if (metricEl) metricEl.innerHTML = `-- <span>on monitored corridor</span>`;
    if (dtContainer) dtContainer.innerHTML = `<div style="font-size: 0.75rem; color: #64748b; padding: 0.5rem; font-style: italic;">Loading corridor trains...</div>`;
    if (acContainer) acContainer.innerHTML = `<div style="font-size: 0.75rem; color: #64748b; padding: 0.5rem; font-style: italic;">Evaluating corridor conflicts...</div>`;
    if (umContainer) umContainer.innerHTML = `<div style="font-size: 0.75rem; color: #64748b; padding: 0.5rem; font-style: italic;">Filtering upcoming maintenance...</div>`;

    // 2. Clear & Update Map Corridor Layers
    if (mapInstance) {
      if (mapLayers.block) mapInstance.removeLayer(mapLayers.block);
      if (mapLayers.blockMarker) mapInstance.removeLayer(mapLayers.blockMarker);
      if (mapLayers.speedRestriction) mapInstance.removeLayer(mapLayers.speedRestriction);
      if (mapLayers.conflicts) mapInstance.removeLayer(mapLayers.conflicts);
      (mapLayers.trains || []).forEach(m => mapInstance.removeLayer(m));
      mapLayers.trains = [];

      // Draw active corridor proposed block
      const isScheduled = newCorridor.status === "SCHEDULED" || newCorridor.status === "APPROVED" || (newCorridor.status && (newCorridor.status.includes("SCHEDULED") || newCorridor.status.includes("APPROVED") || newCorridor.status.includes("SIMULATED")));
      const displayStatus = isScheduled ? "SCHEDULED" : "UNSCHEDULED (NO FEASIBLE BLOCK)";
      const windowVal = newCorridor.sanctionedSlot || newCorridor.recommendedBlock || "11:00 – 13:15 IST";
      const reqIdText = newCorridor.reqId || newCorridor.requestId || "REQ-SR-PLAN";

      mapLayers.block = L.polyline([[stFrom.lat, stFrom.lng], [stTo.lat, stTo.lng]], {
        color: "#dc2626",
        weight: 8,
        opacity: 0.85,
        dashArray: "8, 6"
      }).addTo(mapInstance).bindPopup(`
        <div style="font-family: var(--font-sans); font-size: 12px; line-height: 1.45; min-width: 210px;">
          <strong style="color: #dc2626; font-size: 13px;">COORDINATED MAINTENANCE BLOCK</strong><br>
          <div style="background: #fef3c7; color: #b45309; padding: 2px 7px; border-radius: 4px; font-weight: 800; display: inline-block; margin: 4px 0; font-size: 10px; border: 1px solid #fde68a;">
            REQUISITION ID: ${reqIdText}
          </div><br>
          <strong>Corridor:</strong> ${stFrom.name} &ndash; ${stTo.name} (${fromCode}&ndash;${toCode})<br>
          <strong>Track Line:</strong> ${line}<br>
          <strong>Block Type:</strong> ${block}<br>
          <strong>Worksite:</strong> ${kmRange}<br>
          <strong>Status:</strong> <span style="color: ${isScheduled ? '#166534' : '#dc2626'}; font-weight: 700;">${displayStatus}</span><br>
          <div style="margin-top: 5px; padding: 4px 7px; background: ${isScheduled ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isScheduled ? '#86efac' : '#fecaca'}; border-radius: 4px; color: ${isScheduled ? '#166534' : '#991b1b'}; font-size: 11px; font-weight: 700;">
            ${isScheduled ? `Scheduled Window: ${windowVal}` : `⚠️ No Feasible Slot Available`}
          </div>
        </div>
      `);

      const midLat = (stFrom.lat + stTo.lat) / 2;
      const midLng = (stFrom.lng + stTo.lng) / 2;
      const blockIcon = L.divIcon({
        className: "custom-block-icon",
        html: `<div style="background: #dc2626; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.4); white-space: nowrap;">SR BLOCK: ${fromCode}–${toCode}</div>`,
        iconSize: [95, 20]
      });
      mapLayers.blockMarker = L.marker([midLat, midLng], { icon: blockIcon }).addTo(mapInstance);

      // Speed Restriction Layer (adjacent track caution)
      const latOffset = 0.015;
      const lngOffset = 0.015;
      mapLayers.speedRestriction = L.polyline([
        [stFrom.lat + latOffset, stFrom.lng + lngOffset],
        [stTo.lat + latOffset, stTo.lng + lngOffset]
      ], {
        color: "#f59e0b",
        weight: 5,
        opacity: 0.85,
        dashArray: "4, 4"
      }).addTo(mapInstance).bindPopup(`<strong>CAUTION ORDER (G&amp;SR 15.09)</strong><br>30 km/h speed restriction on adjacent track during block on ${fromCity}–${toCity}.`);
    }

    // 3. Load corridor telemetry & handle fingerprint / token validation
    const telem = (typeof CorridorData !== "undefined" && CorridorData.getCorridorTelemetry)
      ? CorridorData.getCorridorTelemetry(fromCode, toCode)
      : { corridorBadge: corridorLabel, runningTrains: [], delayedTrains: [], activeConflicts: [], upcomingMaintenance: [] };

    // Discard if another switch happened in the meantime (protection against race conditions)
    if (token !== activeCorridorToken) {
      console.warn(`Discarding stale corridor telemetry for token ${token}, current is ${activeCorridorToken}`);
      return;
    }

    // Update Notice Box with corridor-specific count
    const corridorReqs = (data.requisitions || []).filter(r =>
      (r.fromStation === fromCode && r.toStation === toCode) ||
      (r.fromStation === toCode && r.toStation === fromCode) ||
      (r.sectionName && r.sectionName.includes(fromCity) && r.sectionName.includes(toCity))
    );
    const maintCount = corridorReqs.length > 0 ? corridorReqs.length : (telem.upcomingMaintenance ? telem.upcomingMaintenance.length : 0);
    if (noticeEl) {
      noticeEl.textContent = `${maintCount} maintenance ${maintCount === 1 ? 'activity requires' : 'activities require'} coordinated planning on ${fromCity}–${toCity} section.`;
    }

    if (metricEl) {
      metricEl.innerHTML = `${telem.trainsCount || corridorReqs.length || 5} <span>on monitored corridor</span>`;
    }

    // Render Delayed Trains
    if (dtContainer) {
      if (!telem.delayedTrains || telem.delayedTrains.length === 0) {
        dtContainer.innerHTML = `<div style="font-size: 0.75rem; color: #166534; padding: 0.5rem; font-style: italic;">All corridor trains running on time.</div>`;
      } else {
        let dHtml = "";
        telem.delayedTrains.forEach(t => {
          dHtml += `
            <div class="op-delayed-item" data-train-id="${t.id}" style="cursor: pointer;" title="Click to zoom on map">
              <span class="op-train-name">
                ${t.name}
                ${t.priorityTag ? `<span class="badge-board-priority">${t.priorityTag}</span>` : ''}
              </span>
              <span class="delay-tag">${t.delay}</span>
            </div>
          `;
        });
        dtContainer.innerHTML = dHtml;

        dtContainer.querySelectorAll(".op-delayed-item").forEach(item => {
          item.addEventListener("click", () => {
            const tid = item.getAttribute("data-train-id");
            const tr = (telem.runningTrains || []).find(t => t.id === tid) || (telem.delayedTrains || []).find(t => t.id === tid);
            if (tr && mapInstance) {
              mapInstance.flyTo([tr.lat, tr.lng], 10, { duration: 1 });
              const m = mapLayers.trainMarkers[tid];
              if (m) setTimeout(() => m.openPopup(), 1100);
            }
          });
        });
      }
    }

    // Render Active Conflicts
    if (acContainer) {
      if (!telem.activeConflicts || telem.activeConflicts.length === 0) {
        acContainer.innerHTML = `<div style="font-size: 0.75rem; color: #64748b; padding: 0.5rem; font-style: italic;">No active corridor conflicts</div>`;
      } else {
        let cHtml = "";
        telem.activeConflicts.forEach(c => {
          cHtml += `
            <div class="op-conflict-item">
              <span class="${c.typeClass}">${c.type}</span>
              <span style="color: var(--text-sub);">${c.detail}</span>
            </div>
          `;
        });
        acContainer.innerHTML = cHtml;

        // Draw conflict marker on map
        if (mapInstance && telem.activeConflicts.length > 0) {
          const conflictIcon = L.divIcon({
            className: "custom-conflict-icon",
            html: `<div style="background: #dc2626; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid #fff; box-shadow: 0 0 10px #dc2626;">!</div>`,
            iconSize: [22, 22]
          });
          mapLayers.conflicts = L.marker([(stFrom.lat + stTo.lat) / 2 + 0.02, (stFrom.lng + stTo.lng) / 2 + 0.02], { icon: conflictIcon })
            .addTo(mapInstance)
            .bindPopup(`<strong>ACTIVE CONFLICT</strong><br>${telem.activeConflicts[0].detail}`);
        }
      }
    }

    // Render Upcoming Maintenance (corridor filtered)
    if (umContainer) {
      const maintList = [];
      corridorReqs.forEach(r => {
        maintList.push({
          id: r.reqId,
          dept: r.department,
          urgency: r.urgency,
          urgencyClass: r.urgency === "Urgent" ? "urgency-overdue" : "urgency-due"
        });
      });

      if (maintList.length === 0 && telem.upcomingMaintenance) {
        telem.upcomingMaintenance.forEach(m => maintList.push(m));
      }

      if (maintList.length === 0) {
        umContainer.innerHTML = `<div style="font-size: 0.75rem; color: #64748b; padding: 0.5rem; font-style: italic;">No upcoming maintenance for this corridor</div>`;
      } else {
        let mHtml = "";
        maintList.forEach(m => {
          mHtml += `
            <div class="op-maint-item">
              <span><span class="maint-id">${m.id}</span> ${m.dept}</span>
              <span class="${m.urgencyClass}">${m.urgency}</span>
            </div>
          `;
        });
        umContainer.innerHTML = mHtml;
      }
    }

    // Synchronize Coordinated Work Timetable, Block Planner, and Coordination with active corridor
    renderSanctionedTimetable(newCorridor);
    renderActivityRegister();
    renderCoordinationView();

    // Draw Corridor Train Markers on Map
    if (mapInstance && telem.runningTrains && telem.runningTrains.length > 0) {
      telem.runningTrains.forEach(tr => {
        const isUp = tr.direction === "UP";
        const color = tr.status === "delayed" ? "#dc2626" : "#059669";
        const symbol = isUp ? "&#9650;" : "&#9660;";

        const trainIcon = L.divIcon({
          className: "custom-train-marker",
          html: `<div style="font-size: 18px; color: ${color}; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${symbol}</div>`,
          iconSize: [20, 20]
        });

        const marker = L.marker([tr.lat, tr.lng], { icon: trainIcon })
          .addTo(mapInstance)
          .bindPopup(`
            <div style="font-family: var(--font-sans); font-size: 12px;">
              <strong style="font-size: 13px;">${tr.name}</strong><br>
              <span style="color: #64748b;">Corridor:</span> <strong>${fromCity} &ndash; ${toCity}</strong><br>
              <span style="color: #64748b;">Direction:</span> <strong>${tr.direction}</strong> | 
              <span style="color: #64748b;">Speed:</span> <strong>${tr.speed || '95 km/h'}</strong><br>
              <span style="color: #64748b;">Status:</span> <span style="color: ${color}; font-weight: 700;">${tr.delay}</span>
              ${tr.priorityTag ? `<br><span class="badge-board-priority" style="margin-top: 4px; display: inline-block;">${tr.priorityTag}</span>` : ''}
            </div>
          `);

        mapLayers.trains.push(marker);
        mapLayers.trainMarkers[tr.id] = marker;
      });
    }
  }

  function renderOperationsSidebar() {
    setActiveCorridor(activeCorridorState);

    const openPlannerBtn = document.getElementById("sidebarOpenPlannerBtn");
    if (openPlannerBtn && !openPlannerBtn.dataset.bound) {
      openPlannerBtn.dataset.bound = "true";
      openPlannerBtn.addEventListener("click", () => {
        switchMainTab("tabBlockPlanner");
        showBlockPlannerSubview("subviewRegister");
      });
    }
  }

  // =========================================================================
  // 4. Configurable Operational Parameters (Prototype Decision-Support)
  // =========================================================================
  let prototypeConfig = {
    maxSpeedKmH: 130,
    headwayMinutes: 12,
    cautionSpeedKmH: 30
  };

  function syncConfigurationInputs() {
    const spdEl = document.getElementById("cfgMaxSpeed");
    const hdwEl = document.getElementById("cfgHeadway");
    const ctnEl = document.getElementById("cfgCautionSpeed");
    if (spdEl) spdEl.value = prototypeConfig.maxSpeedKmH;
    if (hdwEl) hdwEl.value = prototypeConfig.headwayMinutes;
    if (ctnEl) ctnEl.value = prototypeConfig.cautionSpeedKmH;
  }

  // =========================================================================
  // 5. Block Planner Subviews Management & Dynamic Activity Register
  // =========================================================================
  const subviews = {
    subviewRegister: document.getElementById("subviewRegister"),
    subviewCandidates: document.getElementById("subviewCandidates"),
    subviewComparison: document.getElementById("subviewComparison"),
    subviewImpactAnalysis: document.getElementById("subviewImpactAnalysis")
  };

  let blockPlannerFilterMode = "corridor"; // "corridor" | "all"

  function showBlockPlannerSubview(viewKey) {
    Object.keys(subviews).forEach(k => {
      if (subviews[k]) {
        subviews[k].style.display = k === viewKey ? "block" : "none";
      }
    });

    if (viewKey === "subviewCandidates") {
      renderCandidateCards();
    } else if (viewKey === "subviewComparison") {
      renderComparisonView();
    } else if (viewKey === "subviewImpactAnalysis") {
      renderImpactAnalysis();
      setTimeout(() => initImpactMiniMap(), 150);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Render Dynamic Activity Register Table (Single Source of Truth)
  function renderActivityRegister() {
    const tbody = document.getElementById("activityRegisterTbody");
    if (!tbody) return;

    const activeReq = activeCorridorState || (data.requisitions && data.requisitions[0]);
    const fromCode = (activeReq?.fromStation || "KPD").toUpperCase();
    const toCode = (activeReq?.toStation || "JTJ").toUpperCase();
    const stFrom = (data.stations || []).find(s => s.code === fromCode) || { name: fromCode };
    const stTo = (data.stations || []).find(s => s.code === toCode) || { name: toCode };
    const fromCity = (stFrom.name || fromCode).split(" ")[0];
    const toCity = (stTo.name || toCode).split(" ")[0];

    // Filter by active corridor (strict dynamic corridor isolation)
    const allReqs = data.requisitions || [];
    const corridorReqs = allReqs.filter(r => {
      if (blockPlannerFilterMode === "all") return true;
      const rFrom = (r.fromStation || "").toUpperCase();
      const rTo = (r.toStation || "").toUpperCase();
      return (rFrom === fromCode && rTo === toCode) ||
             (rFrom === toCode && rTo === fromCode) ||
             (r.sectionName && r.sectionName.includes(fromCity) && r.sectionName.includes(toCity));
    });

    const subTitleEl = document.getElementById("bpSectionSubtitle");
    const calloutEl = document.getElementById("bpCalloutBanner");
    const countBadge = document.getElementById("bpRegisterCountBadge");

    if (subTitleEl) {
      subTitleEl.textContent = `Section: ${stFrom.name} (${fromCode}) – ${stTo.name} (${toCode}) • ${corridorReqs.length} ${corridorReqs.length === 1 ? 'activity' : 'activities'} active on corridor`;
    }
    if (calloutEl) {
      calloutEl.textContent = `${corridorReqs.length} departmental maintenance ${corridorReqs.length === 1 ? 'activity' : 'activities'} active on this corridor section. Coordinated planning synchronizes schedules directly with the automatic Block Optimizer.`;
    }
    if (countBadge) {
      countBadge.textContent = `${corridorReqs.length} Active on Section`;
    }

    if (corridorReqs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; color: #64748b; padding: 1.5rem; font-style: italic;">
            No active maintenance requisitions for ${fromCity} – ${toCity} corridor.
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    corridorReqs.forEach(req => {
      const isScheduled = req.status === "SCHEDULED" || req.status === "APPROVED" || (req.status && (req.status.includes("SCHEDULED") || req.status.includes("APPROVED") || req.status.includes("SIMULATED")));
      const slotVal = req.sanctionedSlot || req.recommendedBlock || "--:-- – --:--";
      const urgencyClass = req.urgency === "Urgent" || req.urgency === "Critical" ? "badge-urgent" : "badge-routine";
      const kmText = req.kmRange || (req.worksiteStartKm && req.worksiteEndKm ? `KM ${parseFloat(req.worksiteStartKm).toFixed(2)} – KM ${parseFloat(req.worksiteEndKm).toFixed(2)}` : 'Section stretch');
      const statusBadge = isScheduled
        ? `<span class="badge-pill pill-rec" style="background: #dcfce7; color: #166534; font-weight: 700; white-space: nowrap;">SCHEDULED (OPTIMIZED)</span>`
        : `<span class="badge-pill pill-danger" style="background: #fee2e2; color: #991b1b; font-weight: 700; white-space: nowrap;">UNSCHEDULED (NO FEASIBLE BLOCK)</span>`;

      html += `
        <tr>
          <td><input type="checkbox" checked disabled></td>
          <td class="task-id-code"><strong>${req.reqId}</strong></td>
          <td style="font-weight: 600;">${req.department}</td>
          <td>
            ${req.sectionName || (fromCity + ' – ' + toCity)}
            <span class="section-subtext">${req.trackLine}</span>
          </td>
          <td style="font-family: monospace; font-size: 0.78rem;">${kmText}</td>
          <td>${req.workType}</td>
          <td style="font-weight: 600;">${req.durationMin} mins</td>
          <td><span class="badge-pill ${urgencyClass}">${req.urgency}</span></td>
          <td>
            <div class="compatibility-tag" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">Verified Compatible</div>
          </td>
          <td>${statusBadge}</td>
          <td style="font-weight: 700; color: ${isScheduled ? '#166534' : '#991b1b'}; font-family: monospace;">${isScheduled ? slotVal : 'None'}</td>
          <td>
            <button class="rf-btn rf-btn-outline view-task-detail-btn" data-req-id="${req.reqId}" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">View Details</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll(".view-task-detail-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const reqId = btn.getAttribute("data-req-id");
        openTaskDetailModal(reqId);
      });
    });

    const btnFilterActive = document.getElementById("btnFilterActiveCorridor");
    const btnFilterAll = document.getElementById("btnFilterAllCorridors");
    if (btnFilterActive && !btnFilterActive.dataset.bound) {
      btnFilterActive.dataset.bound = "true";
      btnFilterActive.addEventListener("click", () => {
        blockPlannerFilterMode = "corridor";
        btnFilterActive.classList.add("active");
        if (btnFilterAll) btnFilterAll.classList.remove("active");
        renderActivityRegister();
      });
    }
    if (btnFilterAll && !btnFilterAll.dataset.bound) {
      btnFilterAll.dataset.bound = "true";
      btnFilterAll.addEventListener("click", () => {
        blockPlannerFilterMode = "all";
        btnFilterAll.classList.add("active");
        if (btnFilterActive) btnFilterActive.classList.remove("active");
        renderActivityRegister();
      });
    }

    const btnFind = document.getElementById("btnFindBlockWindow");
    if (btnFind && !btnFind.dataset.bound) {
      btnFind.dataset.bound = "true";
      btnFind.addEventListener("click", () => {
        showBlockPlannerSubview("subviewCandidates");
      });
    }

    const btnReturnOps = document.getElementById("btnReturnToOps");
    if (btnReturnOps && !btnReturnOps.dataset.bound) {
      btnReturnOps.dataset.bound = "true";
      btnReturnOps.addEventListener("click", () => {
        switchMainTab("tabOperations");
      });
    }
  }

  // Render Dynamic Candidate Cards based on Current Optimizer Recommendation
  function renderCandidateCards() {
    const container = document.getElementById("candidatesCardsRow");
    const subtitleEl = document.getElementById("bpCandidatesSubtitle");
    if (!container) return;

    const activeReq = activeCorridorState || (data.requisitions && data.requisitions[0]);
    const rec = currentRecommendation;

    if (subtitleEl && activeReq) {
      subtitleEl.textContent = `Ranked candidate windows evaluated for ${activeReq.reqId} (${activeReq.sectionName || 'Active Corridor'}) • Required: ${activeReq.durationMin} mins`;
    }

    const isScheduled = activeReq && (activeReq.status === "SCHEDULED" || activeReq.status === "APPROVED" || (activeReq.status && (activeReq.status.includes("SCHEDULED") || activeReq.status.includes("APPROVED") || activeReq.status.includes("SIMULATED"))));
    const primarySlot = activeReq ? (activeReq.sanctionedSlot || activeReq.recommendedBlock || "11:00 – 12:30 IST") : "11:00 – 12:30 IST";
    const durMin = activeReq?.durationMin || rec?.durationMin || 90;
    const cautionSpeed = prototypeConfig.cautionSpeedKmH || 30;

    let html = "";

    // Candidate 1: Primary Assigned Window
    if (isScheduled) {
      html += `
        <div class="candidate-box recommended-box">
          <div class="rec-banner-top">&#10003; OPTIMIZED BLOCK SCHEDULE &mdash; AUTO-ASSIGNED WORK SLOT</div>
          <div class="candidate-inner-content">
            <div class="cand-header-box">
              <div class="cand-header-left">
                <div class="cand-name">Primary Optimized Slot (${activeReq.reqId})</div>
                <div class="cand-time-ist">${primarySlot}</div>
              </div>
              <div class="cand-header-right">
                <span class="cand-badge-pill pill-rec">Assigned Window</span>
                <span class="cand-badge-pill pill-rec">SCHEDULED (OPTIMIZED)</span>
              </div>
            </div>

            <table class="cand-metrics-table">
              <tr>
                <td>Maintenance completion</td>
                <td>Feasible (${durMin} min continuous block)</td>
              </tr>
              <tr>
                <td>Corridor Section</td>
                <td>${activeReq.sectionName} (${activeReq.trackLine})</td>
              </tr>
              <tr>
                <td>Worksite KM</td>
                <td>${activeReq.kmRange}</td>
              </tr>
              <tr>
                <td>Direct Train Conflicts</td>
                <td class="val-bold-green">0 direct conflicts</td>
              </tr>
              <tr>
                <td>Adjacent Line Safety</td>
                <td>${cautionSpeed} km/h Caution Order with safety lookouts</td>
              </tr>
              <tr>
                <td>Traction Power Block</td>
                <td>${activeReq.powerBlock ? activeReq.powerBlock.label : 'Conditional on worksite equipment'}</td>
              </tr>
              <tr>
                <td>Estimated Delay Impact</td>
                <td class="val-bold-green">Lowest operational impact</td>
              </tr>
            </table>

            <div class="cand-actions">
              <button class="rf-btn rf-btn-navy cand-impact-btn">
                View Impact Analysis
              </button>
              <button class="rf-btn rf-btn-outline cand-select-btn">
                Compare Candidates
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="candidate-box" style="border-left: 4px solid #ef4444;">
          <div class="candidate-inner-content">
            <div class="cand-header-box">
              <div class="cand-header-left">
                <div class="cand-name">${activeReq ? activeReq.reqId : 'Request'}</div>
                <div class="cand-time-ist" style="color: #991b1b;">--:-- &ndash; --:-- IST</div>
              </div>
              <div class="cand-header-right">
                <span class="cand-badge-pill pill-danger">UNSCHEDULED (NO FEASIBLE BLOCK)</span>
              </div>
            </div>
            <div style="font-size: 0.82rem; color: #991b1b; padding: 1rem 0; line-height: 1.5;">
              No continuous conflict-free block could be assigned for ${durMin} minutes within the evaluation horizon.
            </div>
          </div>
        </div>
      `;
    }

    // Candidate 2 & 3: Ranked Alternatives from Optimizer (if present)
    if (rec && rec.alternatives && rec.alternatives.length > 0) {
      rec.alternatives.forEach((alt, idx) => {
        html += `
          <div class="candidate-box">
            <div class="candidate-inner-content">
              <div class="cand-header-box">
                <div class="cand-header-left">
                  <div class="cand-name">Alternative #${alt.rank || (idx + 1)}</div>
                  <div class="cand-time-ist">${alt.recommendedBlock}</div>
                </div>
                <div class="cand-header-right">
                  <span class="cand-badge-pill pill-warning">${alt.windowType}</span>
                </div>
              </div>

              <table class="cand-metrics-table">
                <tr>
                  <td>Maintenance completion</td>
                  <td>Feasible (${alt.durationMin} min continuous block)</td>
                </tr>
                <tr>
                  <td>Window Classification</td>
                  <td>${alt.extensionDetail || alt.reason}</td>
                </tr>
                <tr>
                  <td>Adjacent Line Safety</td>
                  <td>${cautionSpeed} km/h Caution Order</td>
                </tr>
                <tr>
                  <td>Ranking Priority</td>
                  <td>Rank #${alt.rank || (idx + 2)} (Alternative slot)</td>
                </tr>
              </table>

              <div class="cand-actions">
                <button class="rf-btn rf-btn-outline cand-select-btn">
                  Compare Candidates
                </button>
              </div>
            </div>
          </div>
        `;
      });
    }

    container.innerHTML = html;

    container.querySelectorAll(".cand-impact-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        showBlockPlannerSubview("subviewImpactAnalysis");
      });
    });

    container.querySelectorAll(".cand-select-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        showBlockPlannerSubview("subviewComparison");
      });
    });

    const btnBackReg = document.getElementById("btnBackToRegister");
    if (btnBackReg && !btnBackReg.dataset.bound) {
      btnBackReg.dataset.bound = "true";
      btnBackReg.addEventListener("click", () => {
        showBlockPlannerSubview("subviewRegister");
      });
    }

    const btnCompare = document.getElementById("btnCompareRecommend");
    if (btnCompare && !btnCompare.dataset.bound) {
      btnCompare.dataset.bound = "true";
      btnCompare.addEventListener("click", () => {
        showBlockPlannerSubview("subviewComparison");
      });
    }
  }

  // Render Dynamic Comparison Matrix Table
  function renderComparisonView() {
    const matrixTbody = document.getElementById("comparisonMatrixTbody");
    const calloutTitle = document.getElementById("bpAssessmentTitle");
    const calloutBody = document.getElementById("bpAssessmentBody");
    const subTitleEl = document.getElementById("bpComparisonSubtitle");

    const activeReq = activeCorridorState || (data.requisitions && data.requisitions[0]);
    const rec = currentRecommendation;

    const primarySlot = activeReq ? (activeReq.sanctionedSlot || activeReq.recommendedBlock || "11:00 – 12:30 IST") : "11:00 – 12:30 IST";
    const durMin = activeReq?.durationMin || rec?.durationMin || 90;
    const cautionSpeed = prototypeConfig.cautionSpeedKmH || 30;

    if (subTitleEl && activeReq) {
      subTitleEl.textContent = `Side-by-side comparison of candidate windows scored for ${activeReq.reqId} &bull; ${activeReq.sectionName || 'Active Corridor'}`;
    }

    const alt1 = (rec && rec.alternatives && rec.alternatives[0]) ? rec.alternatives[0].recommendedBlock : "--:-- – --:--";
    const alt2 = (rec && rec.alternatives && rec.alternatives[1]) ? rec.alternatives[1].recommendedBlock : "--:-- – --:--";

    if (matrixTbody) {
      matrixTbody.innerHTML = `
        <tr>
          <td class="matrix-row-title">Window (IST)</td>
          <td class="col-rec"><strong>${primarySlot}</strong></td>
          <td>${alt1}</td>
          <td>${alt2}</td>
        </tr>
        <tr>
          <td class="matrix-row-title">Maintenance Completion</td>
          <td class="col-rec">Feasible (${durMin} min)</td>
          <td>${alt1 !== "--:-- – --:--" ? `Feasible (${durMin} min)` : 'Not evaluated'}</td>
          <td>${alt2 !== "--:-- – --:--" ? `Feasible (${durMin} min)` : 'Not evaluated'}</td>
        </tr>
        <tr>
          <td class="matrix-row-title">Direct Conflicts</td>
          <td class="col-rec">0</td>
          <td>0</td>
          <td>0</td>
        </tr>
        <tr>
          <td class="matrix-row-title">Adjacent Line Caution</td>
          <td class="col-rec">${cautionSpeed} km/h</td>
          <td>${cautionSpeed} km/h</td>
          <td>${cautionSpeed} km/h</td>
        </tr>
        <tr>
          <td class="matrix-row-title">Optimization Status</td>
          <td class="col-rec"><span class="badge-pill pill-rec">SCHEDULED (OPTIMIZED)</span></td>
          <td>Alternative Candidate</td>
          <td>Alternative Candidate</td>
        </tr>
      `;
    }

    if (calloutTitle && activeReq) {
      calloutTitle.textContent = `RailFlow Assessment: ${activeReq.reqId} (${primarySlot})`;
    }
    if (calloutBody) {
      calloutBody.textContent = rec?.reason || (
        `Assigned by RailFlow Block Optimizer as the optimal continuous maintenance window for ${activeReq?.department || 'Department'} ` +
        `on ${activeReq?.sectionName || 'selected section'} (${activeReq?.trackLine || 'Line'}). Avoids train path conflicts and applies configured safety caution orders.`
      );
    }

    setupComparisonAndImpactActions();
  }

  // Setup Actions in Comparison View & Impact View
  function setupComparisonAndImpactActions() {
    const btnApprove = document.getElementById("btnApproveRec");
    const btnChooseAlt = document.getElementById("btnChooseAlt");
    const btnViewImpact = document.getElementById("btnViewImpactAnalysis");
    const btnCoordHist = document.getElementById("btnCoordinationHistory");

    if (btnApprove && !btnApprove.dataset.bound) {
      btnApprove.dataset.bound = "true";
      btnApprove.addEventListener("click", () => {
        switchMainTab("tabOperations");
      });
    }

    if (btnChooseAlt && !btnChooseAlt.dataset.bound) {
      btnChooseAlt.dataset.bound = "true";
      btnChooseAlt.addEventListener("click", () => {
        showBlockPlannerSubview("subviewCandidates");
      });
    }

    if (btnViewImpact && !btnViewImpact.dataset.bound) {
      btnViewImpact.dataset.bound = "true";
      btnViewImpact.addEventListener("click", () => {
        showBlockPlannerSubview("subviewImpactAnalysis");
      });
    }

    if (btnCoordHist && !btnCoordHist.dataset.bound) {
      btnCoordHist.dataset.bound = "true";
      btnCoordHist.addEventListener("click", () => {
        switchMainTab("tabCoordination");
      });
    }

    const btnBackImpact = document.getElementById("btnBackToComparisonFromImpact");
    if (btnBackImpact && !btnBackImpact.dataset.bound) {
      btnBackImpact.dataset.bound = "true";
      btnBackImpact.addEventListener("click", () => {
        showBlockPlannerSubview("subviewComparison");
      });
    }

    const btnBackRegFromImpact = document.getElementById("btnBackToRegisterFromImpact");
    if (btnBackRegFromImpact && !btnBackRegFromImpact.dataset.bound) {
      btnBackRegFromImpact.dataset.bound = "true";
      btnBackRegFromImpact.addEventListener("click", () => {
        showBlockPlannerSubview("subviewRegister");
      });
    }
  }

  // Render Dynamic Impact Analysis for Active Requisition
  function renderImpactAnalysis() {
    const activeReq = activeCorridorState || (data.requisitions && data.requisitions[0]);
    if (!activeReq) return;

    const slotVal = activeReq.sanctionedSlot || activeReq.recommendedBlock || "11:00 – 12:30 IST";
    const parts = slotVal.split(/[–\-]/);
    const startStr = parts[0] ? parts[0].trim() : "11:00";
    const endStr = parts[1] ? parts[1].replace(/IST/, '').trim() : "12:30";

    const startTimeEl = document.getElementById("bpTimelineStartTime");
    const endTimeEl = document.getElementById("bpTimelineEndTime");
    const sumWindow = document.getElementById("bpSummaryWindow");
    const sumLine = document.getElementById("bpSummaryLine");
    const sumWorksite = document.getElementById("bpSummaryWorksite");
    const sumFeas = document.getElementById("bpSummaryFeasibility");
    const titleEl = document.getElementById("bpImpactTitle");
    const subTitleEl = document.getElementById("bpImpactSubtitle");
    const trainsListEl = document.getElementById("bpImpactTrainsList");

    if (startTimeEl) startTimeEl.textContent = `${startStr} IST`;
    if (endTimeEl) endTimeEl.textContent = `${endStr} IST`;
    if (sumWindow) sumWindow.textContent = slotVal;
    if (sumLine) sumLine.textContent = activeReq.trackLine || "UP Main Line";
    if (sumWorksite) sumWorksite.textContent = activeReq.kmRange || "Worksite stretch";
    if (sumFeas) {
      const isSched = activeReq.status === "SCHEDULED" || (activeReq.status && activeReq.status.includes("SCHEDULED"));
      sumFeas.textContent = isSched ? "SCHEDULED (OPTIMIZED)" : "UNSCHEDULED";
      sumFeas.style.color = isSched ? "#059669" : "#dc2626";
    }
    if (titleEl) titleEl.textContent = `Impact Analysis — ${activeReq.reqId} (${slotVal})`;
    if (subTitleEl) subTitleEl.textContent = `Estimated train regulation, downstream cascade, and safety precautions • ${activeReq.sectionName}`;

    // Render Corridor Trains & Conflicts
    if (trainsListEl) {
      const fromCode = (activeReq.fromStation || "KPD").toUpperCase();
      const toCode = (activeReq.toStation || "JTJ").toUpperCase();
      const telem = (typeof CorridorData !== "undefined" && CorridorData.getCorridorTelemetry)
        ? CorridorData.getCorridorTelemetry(fromCode, toCode)
        : null;

      const running = telem?.runningTrains || [];
      if (running.length === 0) {
        trainsListEl.innerHTML = `<div style="font-size: 0.78rem; color: #64748b; padding: 0.5rem; font-style: italic;">No train conflicts on active corridor.</div>`;
      } else {
        let tHtml = "";
        running.slice(0, 3).forEach(tr => {
          tHtml += `
            <div class="impact-item-row">
              <div>
                <div>
                  <span class="impact-train-title">#${tr.id} ${tr.name}</span>
                  <span class="impact-train-code">${tr.direction}</span>
                </div>
                <div class="impact-train-desc">${tr.direction === 'UP' ? 'Running on scheduled path.' : 'Adjacent track under caution speed.'}</div>
              </div>
              <div class="impact-badges-col">
                <span class="badge-delay-pink">${tr.delay}</span>
              </div>
            </div>
          `;
        });
        trainsListEl.innerHTML = tHtml;
      }
    }
  }

  // =========================================================================
  // 6. Dynamic Coordination & Decision History View (Single Source of Truth)
  // =========================================================================
  function renderCoordinationView() {
    const tbody = document.getElementById("coordDecisionHistoryTbody");
    if (!tbody) return;

    const activeReq = activeCorridorState || (data.requisitions && data.requisitions[0]);
    const fromCode = (activeReq?.fromStation || "KPD").toUpperCase();
    const toCode = (activeReq?.toStation || "JTJ").toUpperCase();
    const stFrom = (data.stations || []).find(s => s.code === fromCode) || { name: fromCode };
    const stTo = (data.stations || []).find(s => s.code === toCode) || { name: toCode };
    const fromCity = (stFrom.name || fromCode).split(" ")[0];
    const toCity = (stTo.name || toCode).split(" ")[0];

    // Filter requisitions strictly by active corridor
    const allReqs = data.requisitions || [];
    const corridorReqs = allReqs.filter(r => {
      const rFrom = (r.fromStation || "").toUpperCase();
      const rTo = (r.toStation || "").toUpperCase();
      return (rFrom === fromCode && rTo === toCode) ||
             (rFrom === toCode && rTo === fromCode) ||
             (r.sectionName && r.sectionName.includes(fromCity) && r.sectionName.includes(toCity));
    });

    const isScheduled = activeReq && (activeReq.status === "SCHEDULED" || activeReq.status === "APPROVED" || (activeReq.status && (activeReq.status.includes("SCHEDULED") || activeReq.status.includes("APPROVED") || activeReq.status.includes("SIMULATED"))));
    const activeSlot = activeReq ? (activeReq.sanctionedSlot || activeReq.recommendedBlock || "--:-- – --:--") : "--:-- – --:--";

    // Update KPI Boxes
    const kpiTasks = document.getElementById("coordKpiTasks");
    const kpiScheduled = document.getElementById("coordKpiScheduled");
    const kpiDecisions = document.getElementById("coordKpiDecisions");
    const kpiTelemetry = document.getElementById("coordKpiTelemetry");
    const subTitleEl = document.getElementById("coordSubtitle");
    const statusPill = document.getElementById("coordStatusPill");

    const scheduledCount = corridorReqs.filter(r => r.status === "SCHEDULED" || (r.status && r.status.includes("SCHEDULED"))).length;

    if (kpiTasks) kpiTasks.textContent = corridorReqs.length;
    if (kpiScheduled) kpiScheduled.textContent = `${scheduledCount} / ${corridorReqs.length}`;
    if (kpiDecisions) kpiDecisions.textContent = corridorReqs.length;
    if (kpiTelemetry) {
      const isLive = corridorReqs.some(r => r.liveDataAvailable);
      kpiTelemetry.innerHTML = isLive ? `<span style="color: #166534;">🟢 LIVE</span>` : `<span style="color: #475569;">⚪ DEMO/MOCK</span>`;
    }
    if (subTitleEl) {
      subTitleEl.textContent = `Maintenance coordination metrics and optimizer decision log • ${stFrom.name} (${fromCode}) – ${stTo.name} (${toCode}) • Single Source of Truth`;
    }
    if (statusPill) {
      statusPill.textContent = activeReq
        ? `${activeReq.reqId}: ${isScheduled ? 'SCHEDULED (OPTIMIZED) • ' + activeSlot : 'UNSCHEDULED'}`
        : 'Optimizer Auto-Scheduled';
    }

    if (corridorReqs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; color: #64748b; padding: 1.5rem; font-style: italic;">
            No decisions recorded yet for ${fromCity} – ${toCity} corridor.
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    corridorReqs.forEach(req => {
      const isReqSched = req.status === "SCHEDULED" || req.status === "APPROVED" || (req.status && (req.status.includes("SCHEDULED") || req.status.includes("APPROVED") || req.status.includes("SIMULATED")));
      const slotVal = req.sanctionedSlot || req.recommendedBlock || "--:-- – --:--";
      const conflictsText = req.conflicts && req.conflicts.length > 0
        ? `${req.conflicts.length} conflict(s)`
        : (req.isInsidePreferred ? '0 direct conflicts' : 'Alternative window (conflict-free)');
      const decisionBadge = isReqSched
        ? `<span class="badge-pill pill-rec" style="background: #dcfce7; color: #166534; font-weight: 700; white-space: nowrap;">SCHEDULED (OPTIMIZED)</span>`
        : `<span class="badge-pill pill-danger" style="background: #fee2e2; color: #991b1b; font-weight: 700; white-space: nowrap;">UNSCHEDULED (NO FEASIBLE BLOCK)</span>`;
      const dataSrcBadge = req.liveDataAvailable
        ? `<span class="badge-pill" style="background: #dcfce7; color: #166534;">LIVE</span>`
        : `<span class="badge-pill" style="background: #f1f5f9; color: #475569;">DEMO/MOCK</span>`;

      html += `
        <tr>
          <td style="font-family: monospace; font-size: 0.76rem; color: #0284c7; font-weight: 600;">${req.submittedTime || '10:15 IST'}</td>
          <td><code>${req.reqId}</code></td>
          <td style="font-weight: 600;">${req.department}</td>
          <td>${req.sectionName || (fromCity + ' – ' + toCity)} <span class="section-subtext">${req.trackLine}</span></td>
          <td style="font-family: monospace; font-size: 0.74rem;">${req.preferredSlot || '11:00–14:30'}</td>
          <td style="font-weight: 600;">${req.durationMin} min</td>
          <td style="font-family: monospace; font-weight: 700; color: ${isReqSched ? '#166534' : '#991b1b'};">${isReqSched ? slotVal : 'None'}</td>
          <td style="font-size: 0.74rem; color: #64748b;">${conflictsText}</td>
          <td>${decisionBadge}</td>
          <td>${dataSrcBadge}</td>
          <td>
            <button class="rf-btn rf-btn-outline btn-view-coord-detail" data-id="${req.reqId}" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">View Details</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll(".btn-view-coord-detail").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openTaskDetailModal(id);
      });
    });
  }

  // =========================================================================
  // 7. Modals: Requisition Details & Printable Sanction Memo
  // =========================================================================
  const taskModal = document.getElementById("taskDetailModal");
  const conflictModal = document.getElementById("conflictDetailModal");

  function openTaskDetailModal(reqId) {
    const req = (data.requisitions || []).find(r => r.reqId === reqId) ||
                (data.activities || []).find(a => a.taskId === reqId) ||
                (data.requisitions && data.requisitions[0]);
    if (!req) return;

    const titleEl = document.getElementById("taskModalTitle");
    const deptEl = document.getElementById("taskModalDept");
    const durEl = document.getElementById("taskModalDuration");
    const machEl = document.getElementById("taskModalMachinery");

    const idVal = req.reqId || req.taskId || "REQ-SR";
    const slotVal = req.sanctionedSlot || req.recommendedBlock || "--:-- – --:--";
    const isSched = req.status === "SCHEDULED" || (req.status && req.status.includes("SCHEDULED"));

    if (titleEl) titleEl.textContent = `Requisition Details: ${idVal}`;
    if (deptEl) deptEl.textContent = req.department || "Department Maintenance";
    if (durEl) durEl.textContent = `${req.durationMin || 90} mins continuous`;
    if (machEl) {
      machEl.textContent = req.machinery || (
        req.department.includes("Civil") || req.department.includes("Track") 
          ? "CSM 09-32 Continuous Action Tamping Machine + Ballast Regulator (BRM)" 
          : (req.department.includes("S&T") ? "Point Diagnostic System + Test Rake" : "Tower Wagon Car #09 (25kV AC Traction)")
      );
    }

    if (taskModal) {
      const existingFooter = taskModal.querySelector(".detail-footer-note");
      if (!existingFooter) {
        const note = document.createElement("div");
        note.className = "detail-footer-note";
        note.style.cssText = "font-size: 0.76rem; color: #64748b; font-style: italic; margin-top: 1rem; border-top: 1px dashed #cbd5e1; padding-top: 0.5rem;";
        note.textContent = "Scheduled by RailFlow Optimizer — Decision-Support Prototype. Final authority remains with authorised railway operating personnel.";
        taskModal.querySelector(".detail-modal-card")?.appendChild(note);
      }
      taskModal.style.display = "flex";
    }
  }

  function openConflictModal() {
    if (conflictModal) conflictModal.style.display = "flex";
  }

  ["taskModalCloseBtn", "taskModalCloseBtn2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => { if (taskModal) taskModal.style.display = "none"; });
  });

  ["conflictModalCloseBtn", "conflictModalCloseBtn2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => { if (conflictModal) conflictModal.style.display = "none"; });
  });

  // Printable Sanction Memo Modal
  const sanctionModal = document.getElementById("sanctionModal");
  const sanctionModalContent = document.getElementById("sanctionModalContent");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const btnViewDecisionDetails = document.getElementById("btnViewDecisionDetails");

  function openPrintableSanctionMemo(targetReqId = null) {
    const activeReq = (targetReqId ? (data.requisitions || []).find(r => r.reqId === targetReqId) : null) ||
                      activeCorridorState ||
                      (data.requisitions && data.requisitions[0]);
    if (!activeReq) return;

    const cand = {
      id: activeReq.reqId,
      name: `Optimized Slot for ${activeReq.reqId}`,
      window: activeReq.sanctionedSlot || activeReq.recommendedBlock || "11:00 – 12:30 IST"
    };

    const memo = auditLogger.generateSanctionMemo(cand, "Chief Section Controller (Chennai / Salem)");
    const slotVal = activeReq.sanctionedSlot || activeReq.recommendedBlock || "11:00 – 12:30 IST";
    const kmText = activeReq.kmRange || (activeReq.worksiteStartKm && activeReq.worksiteEndKm ? `KM ${parseFloat(activeReq.worksiteStartKm).toFixed(2)} to KM ${parseFloat(activeReq.worksiteEndKm).toFixed(2)}` : 'Section boundaries');

    let html = `
      <div class="memo-crest">
        <h2>GOVERNMENT OF INDIA &bull; MINISTRY OF RAILWAYS</h2>
        <h4>SOUTHERN RAILWAY &bull; CHENNAI &amp; SALEM DIVISIONS (OPERATING BRANCH)</h4>
        <div style="font-family: var(--font-mono); font-size: 0.85rem; color: #718096; margin-top: 0.35rem;">
          OFFICIAL LINE BLOCK &amp; POWER BLOCK SANCTION ORDER MEMO
        </div>
      </div>

      <div class="memo-meta-grid">
        <div><strong>Sanction Order No:</strong> <code>${memo.orderNo}</code></div>
        <div><strong>Date:</strong> 24 Aug 2026</div>
        <div><strong>Authority:</strong> ${memo.controller}</div>
        <div><strong>Corridor Section:</strong> ${activeReq.sectionName || 'Southern Railway Section'}</div>
        <div><strong>Track Line:</strong> ${activeReq.trackLine} (${kmText})</div>
        <div><strong>Sanctioned Time Window:</strong> <span style="color: #059669; font-weight: 700;">${slotVal} (${activeReq.durationMin} minutes)</span></div>
        <div><strong>Security Token:</strong> <code>${memo.authHash}</code></div>
      </div>

      <h4 style="margin-bottom: 0.5rem; color: #2d3748; font-size: 0.95rem;">COORDINATED MULTI-DEPARTMENTAL WORKS SANCTIONED:</h4>
      <table class="memo-table">
        <thead>
          <tr>
            <th>Task ID</th>
            <th>Department</th>
            <th>Work Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>${activeReq.reqId}</code></td>
            <td><strong>${activeReq.department}</strong></td>
            <td>${activeReq.workType} (${activeReq.machinery || 'Standard Equipment'})</td>
          </tr>
        </tbody>
      </table>

      <h4 style="margin-bottom: 0.5rem; color: #c53030; font-size: 0.95rem;">SAFETY PRECAUTIONS ENFORCED:</h4>
      <div class="safety-precautions-box" style="font-size: 0.82rem; line-height: 1.6; color: #4a5568; background: #fff5f5; border-left: 4px solid #e53e3e; padding: 0.75rem; border-radius: 4px; margin-bottom: 1.25rem;">
        <div>1. ${activeReq.powerBlock ? activeReq.powerBlock.label : 'Conditional traction power isolation: subject to worksite conditions.'}</div>
        <div>2. Caution Order of ${prototypeConfig.cautionSpeedKmH} km/h on adjacent line during maintenance operations.</div>
        <div>3. Red banner flags &amp; detonators positioned at 600m and 1200m as per G&amp;SR 15.09 rules.</div>
        <div>4. Scheduled by RailFlow Optimizer — Decision-Support Prototype. Final authority remains with authorised railway operating personnel.</div>
      </div>

      <div class="memo-stamp">
        <div class="digital-signature-seal">
          <div>&#10003; ELECTRONICALLY VERIFIED &amp; SANCTIONED</div>
          <div>AUTH TOKEN: ${memo.authHash}</div>
          <div>TIMESTAMP: 24-AUG-2026 10:12:45 IST</div>
        </div>
        <div style="text-align: right; font-size: 0.85rem;">
          <div style="font-weight: 700;">Sr. Divisional Operations Manager</div>
          <div style="color: #718096;">Section Control Board, Chennai / Salem Division</div>
        </div>
      </div>

      <div class="memo-actions no-print" style="margin-top: 1.75rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button class="rf-btn rf-btn-outline" onclick="window.print()">Print Order Memo</button>
        <button class="rf-btn rf-btn-green" onclick="document.getElementById('sanctionModal').style.display='none';">Close</button>
      </div>
    `;

    sanctionModalContent.innerHTML = html;
    sanctionModal.style.display = "flex";
    sanctionModal.scrollTop = 0;
  }

  if (btnViewDecisionDetails) {
    btnViewDecisionDetails.addEventListener("click", () => {
      openPrintableSanctionMemo();
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      sanctionModal.style.display = "none";
    });
  }

  // Dismiss any modal when clicking on the dark backdrop overlay
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.style.display = "none";
      }
    });
  });

  // =========================================================================
  // 8. Configuration Form Save Action (Connected to Optimizer)
  // =========================================================================
  const btnSaveConfig = document.getElementById("btnSaveConfig");
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener("click", () => {
      const maxSpd = parseInt(document.getElementById("cfgMaxSpeed").value, 10) || 130;
      const hdw = parseInt(document.getElementById("cfgHeadway").value, 10) || 12;
      const ctn = parseInt(document.getElementById("cfgCautionSpeed").value, 10) || 30;

      prototypeConfig.maxSpeedKmH = maxSpd;
      prototypeConfig.headwayMinutes = hdw;
      prototypeConfig.cautionSpeedKmH = ctn;

      auditLogger.logAction(
        "UPDATE_CONFIG",
        "Chief Section Controller",
        `Updated parameters: Max Speed=${maxSpd} km/h, Headway=${hdw} min, Caution Speed=${ctn} km/h`
      );

      alert(`Prototype Configuration Saved:\n• Sectional Max Speed: ${maxSpd} km/h\n• Safety Headway: ${hdw} min\n• Caution Speed: ${ctn} km/h\n\nParameters are applied to subsequent automatic Block Optimizer evaluations.`);
    });
  }

  // =========================================================================
  // 9. Departmental Requisition Portal & Timetable Generator
  // =========================================================================
  
  // Indian Railways Departmental Work & Machinery Catalog (IRPWM / IRTMM Standards)
  const IR_WORK_CATALOG = {
    CIVIL: {
      department: "Civil / Track (P-Way)",
      categories: [
        {
          id: "CIVIL_TAMP",
          name: "Plain Track Tamping & Alignment (CSM 09-32 + BRM)",
          desc: "Plain track tamping, leveling & ballast profiling (track geometry alignment)",
          machinery: "CSM 09-32 Continuous Action Tamping Machine + Ballast Regulator (BRM)",
          duration: 150,
          trackLine: "UP Main Line",
          urgency: "Due",
          slot: "Midday Traffic Shadow (11:00–14:30)"
        },
        {
          id: "CIVIL_BCM",
          name: "Deep Ballast Screening & Cleaning (BCM RM-80 + CSM + BRM)",
          desc: "Deep ballast screening, shoulder cleaning & muck disposal (BCM RM-80)",
          machinery: "BCM RM-80 Ballast Cleaning Machine + CSM 09-32 + Ballast Regulator (BRM)",
          duration: 240,
          trackLine: "UP Main Line",
          urgency: "Urgent",
          slot: "Midday Traffic Shadow (11:00–14:30)"
        },
        {
          id: "CIVIL_TURNOUT",
          name: "Turnout / Points & Crossing Overhaul (Unimat 08-475)",
          desc: "Turnout overhaul, switch geometry alignment & crossing tamping",
          machinery: "Unimat 08-475 Points & Crossing Tamping Machine",
          duration: 120,
          trackLine: "Station Loop / Yard Track",
          urgency: "Due",
          slot: "Midday Traffic Shadow (11:00–14:30)"
        },
        {
          id: "CIVIL_LWR",
          name: "LWR Thermal Destressing & Tensor Alignment (Rail Tensor)",
          desc: "Long Welded Rail (LWR) thermal destressing & tensor rail adjustment",
          machinery: "Hydraulic Rail Tensor + Mobile Flash Butt Welder",
          duration: 180,
          trackLine: "UP Main Line",
          urgency: "Critical",
          slot: "Midday Traffic Shadow (11:00–14:30)"
        }
      ]
    },
    SNT: {
      department: "Signal & Telecom (S&T)",
      categories: [
        {
          id: "SNT_POINT",
          name: "Point Machine Overhaul & Ground Gear Testing",
          desc: "Point Machine #14 overhaul, ground gear testing & dual axle counter calibration",
          machinery: "Point Diagnostic System + Signal Test Track Rake",
          duration: 120,
          trackLine: "Station Loop / Yard Track",
          urgency: "Urgent",
          slot: "Midday Traffic Shadow (11:00–14:30)"
        },
        {
          id: "SNT_EI",
          name: "Electronic Interlocking (EI) Routine Testing",
          desc: "Station Electronic Interlocking (EI) logic test & panel route verification",
          machinery: "Electronic Interlocking Diagnostic Kit",
          duration: 90,
          trackLine: "Both UP & DOWN Lines",
          urgency: "Routine",
          slot: "Afternoon Shadow (14:30–17:30)"
        },
        {
          id: "SNT_TC",
          name: "Track Circuit & Glued Joint Replacement",
          desc: "High-frequency track circuit transmitter check & glued insulated joint replacement",
          machinery: "Track Circuit Impedance Bond Tester + Insulation Kit",
          duration: 105,
          trackLine: "UP Main Line",
          urgency: "Due",
          slot: "Midday Traffic Shadow (11:00–14:30)"
        }
      ]
    },
    TRD: {
      department: "Electrical / Traction (TRD)",
      categories: [
        {
          id: "TRD_TENSION",
          name: "25kV OHE Catenary Wire Tensioning & Insulator Washing",
          desc: "25kV AC OHE catenary wire tensioning, cantilever bracket adjustment & insulator washing",
          machinery: "Tower Wagon Car #09 (25kV AC Traction / OHE)",
          duration: 135,
          trackLine: "UP Main Line",
          urgency: "Due",
          slot: "Midday Traffic Shadow (11:00–14:30)"
        },
        {
          id: "TRD_ISOLATOR",
          name: "Power Block Isolator Switch & Contact Wire Renewal",
          desc: "Section isolator switch replacement & contact wire splice renewal under Power Block",
          machinery: "Tower Wagon Car #09 + Contact Wire Reel Drum",
          duration: 150,
          trackLine: "UP Main Line",
          urgency: "Critical",
          slot: "Midday Traffic Shadow (11:00–14:30)"
        },
        {
          id: "TRD_INSPECTION",
          name: "Periodic Cantilever & Dropper Inspection",
          desc: "Periodic dropper adjustment, stagger measurement & contact wire height survey",
          machinery: "Self-Propelled 4-Wheeler Tower Wagon",
          duration: 105,
          trackLine: "Both UP & DOWN Lines",
          urgency: "Routine",
          slot: "Morning Shadow (08:00–11:00)"
        }
      ]
    },
    MECH: {
      department: "Mechanical (C&W)",
      categories: [
        {
          id: "MECH_AIRBRAKE",
          name: "Freight Rake Air Brake Examination & Wheel Profiling",
          desc: "En-route freight rake air brake testing, bogie examination & wheel profile check",
          machinery: "Rake Test Rig + Wheel Impact Load Detector (WILD)",
          duration: 90,
          trackLine: "Station Loop / Yard Track",
          urgency: "Routine",
          slot: "Afternoon Shadow (14:30–17:30)"
        },
        {
          id: "MECH_HOTAXLE",
          name: "Hot Axle / Brake Binding Emergency Examination",
          desc: "Wheel flat measurement & roller bearing temperature examination on detained rake",
          machinery: "Infrared Thermography Camera + Wheel Flat Detector",
          duration: 60,
          trackLine: "Station Loop / Yard Track",
          urgency: "Critical",
          slot: "Midday Traffic Shadow (11:00–14:30)"
        }
      ]
    }
  };

  function initRequisitionPortal() {
    const reqForm = document.getElementById("blockRequisitionForm");
    const deptCards = document.querySelectorAll(".dept-radio-card");
    const categorySelect = document.getElementById("reqWorkCategory");
    const btnJump = document.getElementById("btnReqJumpToOps");
    const btnPrintSlip = document.getElementById("btnPrintSanctionSlip");
    const btnViewMap = document.getElementById("btnViewOnTamilNaduMap");

    function applyWorkCategory(deptCode, catId) {
      const deptData = IR_WORK_CATALOG[deptCode] || IR_WORK_CATALOG.CIVIL;
      const cat = deptData.categories.find(c => c.id === catId) || deptData.categories[0];
      if (!cat) return;

      const descEl = document.getElementById("reqWorkDesc");
      const machEl = document.getElementById("reqMachinery");
      const durEl = document.getElementById("reqDuration");
      const trackEl = document.getElementById("reqTrackLine");
      const urgEl = document.getElementById("reqUrgency");
      const slotEl = document.getElementById("reqPreferredSlot");

      if (descEl) descEl.value = cat.desc;
      if (machEl) machEl.value = cat.machinery;
      if (durEl) durEl.value = cat.duration;
      if (trackEl && cat.trackLine) trackEl.value = cat.trackLine;
      if (urgEl && cat.urgency) urgEl.value = cat.urgency;
      if (slotEl && cat.slot) slotEl.value = cat.slot;
    }

    function populateWorkCategories(deptCode, selectedCatId = null) {
      if (!categorySelect) return;
      const deptData = IR_WORK_CATALOG[deptCode] || IR_WORK_CATALOG.CIVIL;
      categorySelect.innerHTML = deptData.categories.map(cat => 
        `<option value="${cat.id}">${cat.name}</option>`
      ).join("");

      if (selectedCatId && deptData.categories.some(c => c.id === selectedCatId)) {
        categorySelect.value = selectedCatId;
      } else {
        categorySelect.value = deptData.categories[0].id;
      }
      applyWorkCategory(deptCode, categorySelect.value);
    }

    // 1. Department selector cards toggle & dynamic auto-preset
    deptCards.forEach(card => {
      card.addEventListener("click", () => {
        deptCards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          const deptCode = radio.getAttribute("data-dept-code") || "CIVIL";
          populateWorkCategories(deptCode);
        }
      });
    });

    // 2. Work category change listener
    if (categorySelect) {
      categorySelect.addEventListener("change", (e) => {
        const activeRadio = document.querySelector('input[name="reqDepartment"]:checked');
        const deptCode = activeRadio ? activeRadio.getAttribute("data-dept-code") : "CIVIL";
        applyWorkCategory(deptCode, e.target.value);
      });
    }

    // 3. Reset handler restores Civil / Track default preset
    if (reqForm) {
      reqForm.addEventListener("reset", () => {
        setTimeout(() => {
          deptCards.forEach(c => c.classList.remove("active"));
          const civilCard = document.querySelector(".dept-radio-card.dept-civil");
          if (civilCard) civilCard.classList.add("active");
          const civilRadio = document.querySelector('input[name="reqDepartment"][data-dept-code="CIVIL"]');
          if (civilRadio) civilRadio.checked = true;
          populateWorkCategories("CIVIL", "CIVIL_TAMP");
        }, 50);
      });
    }

    // Initialize categories on load
    const activeRadio = document.querySelector('input[name="reqDepartment"]:checked');
    const initDeptCode = activeRadio ? activeRadio.getAttribute("data-dept-code") : "CIVIL";
    populateWorkCategories(initDeptCode, "CIVIL_TAMP");

    // 2. Section KM Range (Read-Only) & Worksite Start/End KM Handling
    const fromStationEl = document.getElementById("reqFromStation");
    const toStationEl = document.getElementById("reqToStation");
    const sectionKmDisplayEl = document.getElementById("reqSectionKmDisplay");
    const sectionKmNoteEl = document.getElementById("reqSectionKmNote");
    const worksiteStartKmEl = document.getElementById("reqWorksiteStartKm");
    const worksiteEndKmEl = document.getElementById("reqWorksiteEndKm");
    const kmValidationMsgEl = document.getElementById("reqKmValidationMsg");
    const trackLineEl = document.getElementById("reqTrackLine");
    const blockTypeEl = document.getElementById("reqBlockType");

    function updateSectionKmDisplay(shouldResetWorksite = true) {
      const from = (fromStationEl ? fromStationEl.value : "MAS").toUpperCase();
      const to = (toStationEl ? toStationEl.value : "AJJ").toUpperCase();

      const sec = (data && data.getSectionKmRange)
        ? data.getSectionKmRange(from, to)
        : (typeof CorridorData !== "undefined" && CorridorData.getSectionKmRange)
          ? CorridorData.getSectionKmRange(from, to)
          : { available: false, message: "Section KM range unavailable — enter worksite KM manually" };

      if (sectionKmDisplayEl) {
        if (sec.available) {
          sectionKmDisplayEl.textContent = sec.label;
          sectionKmDisplayEl.style.color = "#0f172a";
        } else {
          sectionKmDisplayEl.textContent = "KM --.-- – KM --.--";
          sectionKmDisplayEl.style.color = "#94a3b8";
        }
      }

      if (sectionKmNoteEl) {
        if (sec.available) {
          sectionKmNoteEl.textContent = sec.note || "Automatically determined from selected section";
          sectionKmNoteEl.style.color = "#64748b";
        } else {
          sectionKmNoteEl.textContent = "Section KM range unavailable — enter worksite KM manually";
          sectionKmNoteEl.style.color = "#d97706";
        }
      }

      // Constrain inputs or placeholders to selected section limits
      if (worksiteStartKmEl && worksiteEndKmEl) {
        if (sec.available) {
          worksiteStartKmEl.placeholder = `min ${sec.startKm.toFixed(2)}`;
          worksiteEndKmEl.placeholder = `max ${sec.endKm.toFixed(2)}`;
          worksiteStartKmEl.min = sec.startKm;
          worksiteStartKmEl.max = sec.endKm;
          worksiteEndKmEl.min = sec.startKm;
          worksiteEndKmEl.max = sec.endKm;
        } else {
          worksiteStartKmEl.placeholder = "e.g. 10.00";
          worksiteEndKmEl.placeholder = "e.g. 13.50";
          worksiteStartKmEl.removeAttribute("min");
          worksiteStartKmEl.removeAttribute("max");
          worksiteEndKmEl.removeAttribute("min");
          worksiteEndKmEl.removeAttribute("max");
        }

        // When From/To Station changes, reset previous worksite inputs
        if (shouldResetWorksite) {
          worksiteStartKmEl.value = "";
          worksiteEndKmEl.value = "";
          if (kmValidationMsgEl) {
            kmValidationMsgEl.style.color = "#64748b";
            kmValidationMsgEl.textContent = sec.available
              ? `Please enter worksite start and end KM within Section KM Range (${sec.label}).`
              : "Section KM range unavailable — enter worksite KM manually.";
          }
        }
      }

      return sec;
    }

    function validateWorksiteKmRangeLive() {
      if (!worksiteStartKmEl || !worksiteEndKmEl || !kmValidationMsgEl) return { valid: false };
      const from = (fromStationEl ? fromStationEl.value : "MAS").toUpperCase();
      const to = (toStationEl ? toStationEl.value : "AJJ").toUpperCase();

      const sec = (data && data.getSectionKmRange)
        ? data.getSectionKmRange(from, to)
        : (typeof CorridorData !== "undefined" && CorridorData.getSectionKmRange)
          ? CorridorData.getSectionKmRange(from, to)
          : { available: false, message: "Section KM range unavailable — enter worksite KM manually" };

      const rawStart = worksiteStartKmEl.value.trim();
      const rawEnd = worksiteEndKmEl.value.trim();

      if (rawStart === "" || rawEnd === "") {
        kmValidationMsgEl.style.color = "#64748b";
        kmValidationMsgEl.textContent = sec.available
          ? `Please enter worksite start and end KM within Section KM Range (${sec.label}).`
          : "Please specify worksite start and end KM.";
        return { valid: false, empty: true, section: sec };
      }

      const s = parseFloat(rawStart);
      const e = parseFloat(rawEnd);

      if (isNaN(s) || isNaN(e)) {
        kmValidationMsgEl.style.color = "#dc2626";
        kmValidationMsgEl.textContent = "⚠️ Please enter valid numeric KM values.";
        return { valid: false, section: sec };
      }

      if (s >= e) {
        kmValidationMsgEl.style.color = "#dc2626";
        kmValidationMsgEl.textContent = `⚠️ Worksite Start KM (${s.toFixed(2)}) must be strictly less than Worksite End KM (${e.toFixed(2)}).`;
        return { valid: false, section: sec };
      }

      const span = (e - s).toFixed(2);

      if (sec.available) {
        if (s < sec.startKm) {
          kmValidationMsgEl.style.color = "#dc2626";
          kmValidationMsgEl.textContent = `⚠️ Worksite Start KM (${s.toFixed(2)}) is outside Section KM Range (${sec.label}). Cannot be less than ${sec.startKm.toFixed(2)}.`;
          return { valid: false, section: sec };
        }

        if (e > sec.endKm) {
          kmValidationMsgEl.style.color = "#dc2626";
          kmValidationMsgEl.textContent = `⚠️ Worksite End KM (${e.toFixed(2)}) is outside Section KM Range (${sec.label}). Cannot exceed ${sec.endKm.toFixed(2)}.`;
          return { valid: false, section: sec };
        }

        if (parseFloat(span) > 25.0) {
          kmValidationMsgEl.style.color = "#d97706";
          kmValidationMsgEl.textContent = `⚠️ Worksite span is ${span} km. Worksite KM Range should represent only the specific maintenance stretch, not the entire section.`;
          return { valid: true, spanKm: span, warning: true, startKm: s, endKm: e, section: sec };
        }

        kmValidationMsgEl.style.color = "#166534";
        kmValidationMsgEl.textContent = `✓ Valid worksite stretch: KM ${s.toFixed(2)} – KM ${e.toFixed(2)} (Span: ${span} km within ${sec.label})`;
        return { valid: true, spanKm: span, startKm: s, endKm: e, section: sec };
      }

      // Section mapping unavailable fallback
      kmValidationMsgEl.style.color = "#166534";
      kmValidationMsgEl.textContent = `✓ Worksite span: ${span} km (Section KM range unavailable — manual verification required)`;
      return { valid: true, spanKm: span, startKm: s, endKm: e, section: sec };
    }

    // 7. Real-Time Block Planning Result State & Invalidation System


    function getCurrentRequestFingerprint() {
      const from = (fromStationEl ? fromStationEl.value : "").toUpperCase();
      const to = (toStationEl ? toStationEl.value : "").toUpperCase();
      const startKm = worksiteStartKmEl ? worksiteStartKmEl.value.trim() : "";
      const endKm = worksiteEndKmEl ? worksiteEndKmEl.value.trim() : "";
      const line = trackLineEl ? trackLineEl.value : "";
      const blockType = blockTypeEl ? blockTypeEl.value : "";
      const duration = document.getElementById("reqDuration")?.value || "";
      const preferredSlot = document.getElementById("reqPreferredSlot")?.value || "";
      return `${from}|${to}|${startKm}|${endKm}|${line}|${blockType}|${duration}|${preferredSlot}`;
    }

    function invalidateEvaluationState(customMessage = null) {
      currentEvaluationId++;
      currentRecommendation = null;
      currentCorridorData = null;
      activeRequestFingerprint = null;

      const statusBadge = document.getElementById("bpStatusBadge");
      const dataStatusBadge = document.getElementById("bpDataStatusBadge");
      const reqWinEl = document.getElementById("bpRequestedWindow");
      const recBlockEl = document.getElementById("bpRecommendedBlock");
      const recDurEl = document.getElementById("bpRecommendedDuration");
      const blockCategoryLabel = document.getElementById("bpBlockCategoryLabel");
      const windowTypeBadge = document.getElementById("bpWindowTypeBadge");
      const extensionNote = document.getElementById("bpExtensionNote");
      const recContainer = document.getElementById("bpRecommendedContainer");
      const worksiteKmEl = document.getElementById("bpWorksiteKm");
      const worksiteSpanEl = document.getElementById("bpWorksiteSpan");
      const blockTypeDisplayEl = document.getElementById("bpBlockType");
      const trackLineDisplayEl = document.getElementById("bpTrackLine");
      const reasonBanner = document.getElementById("bpReasonBanner");
      const trainCountText = document.getElementById("bpTrainCountText");
      const trainsTableBody = document.getElementById("bpTrainsTableBody");
      const btnBpSanction = document.getElementById("btnBpSanction");
      const sanctionedCard = document.getElementById("sanctionedTimetableCard");
      const alternativesContainer = document.getElementById("bpAlternativesContainer");
      const alternativesList = document.getElementById("bpAlternativesList");

      // 1. Reset evaluation status to WAITING FOR WORKSITE
      if (statusBadge) {
        statusBadge.textContent = "WAITING FOR WORKSITE";
        statusBadge.style.background = "#fef3c7";
        statusBadge.style.color = "#92400e";
        statusBadge.style.borderColor = "#fde68a";
      }

      if (dataStatusBadge) {
        dataStatusBadge.textContent = "Evaluation Pending";
        dataStatusBadge.style.background = "#f1f5f9";
        dataStatusBadge.style.color = "#475569";
      }

      // 2. Sync Requested Window with current form selection
      const prefSlotEl = document.getElementById("reqPreferredSlot");
      if (reqWinEl) {
        reqWinEl.textContent = prefSlotEl ? prefSlotEl.value : "--:-- – --:-- IST";
      }

      // 3. Clear previous recommendation and window
      if (recBlockEl) {
        recBlockEl.textContent = "--:-- – --:--";
        recBlockEl.style.color = "#334155";
      }
      if (blockCategoryLabel) {
        blockCategoryLabel.textContent = "Recommended Block";
        blockCategoryLabel.style.color = "#475569";
      }
      if (recDurEl) {
        recDurEl.textContent = "Pending evaluation";
        recDurEl.style.color = "#64748b";
      }
      if (windowTypeBadge) {
        windowTypeBadge.style.display = "none";
      }
      if (extensionNote) {
        extensionNote.style.display = "none";
        extensionNote.textContent = "";
      }
      if (recContainer) {
        recContainer.style.background = "#f8fafc";
        recContainer.style.borderColor = "#e2e8f0";
      }

      // 4. Update Worksite KM Range display
      const rawStart = worksiteStartKmEl ? worksiteStartKmEl.value.trim() : "";
      const rawEnd = worksiteEndKmEl ? worksiteEndKmEl.value.trim() : "";
      if (worksiteKmEl) {
        if (rawStart && rawEnd && !isNaN(parseFloat(rawStart)) && !isNaN(parseFloat(rawEnd))) {
          worksiteKmEl.textContent = `KM ${parseFloat(rawStart).toFixed(2)} – KM ${parseFloat(rawEnd).toFixed(2)}`;
        } else {
          worksiteKmEl.textContent = "--";
        }
      }
      if (worksiteSpanEl) {
        if (rawStart && rawEnd && !isNaN(parseFloat(rawStart)) && !isNaN(parseFloat(rawEnd))) {
          const span = (parseFloat(rawEnd) - parseFloat(rawStart)).toFixed(2);
          worksiteSpanEl.textContent = span > 0 ? `Worksite span: ${span} km (Pending evaluation)` : 'Worksite stretch not specified';
        } else {
          worksiteSpanEl.textContent = "Worksite stretch not specified";
        }
      }

      // 5. Update Line & Block Type display verbatim
      if (blockTypeDisplayEl) {
        blockTypeDisplayEl.textContent = blockTypeEl ? blockTypeEl.value : "UP Line Block";
      }
      if (trackLineDisplayEl) {
        trackLineDisplayEl.textContent = trackLineEl ? trackLineEl.value : "UP Main Line";
      }

      // 6. Reset Reason Banner to required prompt
      const hasValidKm = rawStart !== "" && rawEnd !== "" && !isNaN(parseFloat(rawStart)) && !isNaN(parseFloat(rawEnd)) && parseFloat(rawStart) < parseFloat(rawEnd);
      const promptMessage = customMessage || (hasValidKm
        ? "Worksite parameters updated. Click 'Submit Block Requisition' to evaluate block availability."
        : "Enter a valid Worksite KM Range to evaluate block availability.");

      if (reasonBanner) {
        reasonBanner.style.background = "#eff6ff";
        reasonBanner.style.borderColor = "#bfdbfe";
        reasonBanner.style.borderLeft = "4px solid #3b82f6";
        reasonBanner.style.color = "#1e40af";
        reasonBanner.innerHTML = `ℹ️ <strong>Status:</strong> <span id="bpReasonText">${promptMessage}</span>`;
      }

      // 7. Clear previous train evaluation results & conflict list & alternatives
      if (trainCountText) {
        trainCountText.textContent = "Evaluation pending";
      }
      if (trainsTableBody) {
        trainsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 1.5rem 0.5rem; font-style: italic;">Enter a valid Worksite KM Range to evaluate block availability.</td></tr>`;
      }
      if (alternativesContainer) {
        alternativesContainer.style.display = "none";
      }
      if (alternativesList) {
        alternativesList.innerHTML = "";
      }

      // 8. Disable simulated controller approval & hide stale timetable
      if (btnBpSanction) {
        btnBpSanction.disabled = true;
      }
      if (sanctionedCard) {
        sanctionedCard.style.display = "none";
      }
    }

    // Critical Field Invalidation Listeners
    if (worksiteStartKmEl) {
      worksiteStartKmEl.addEventListener("input", () => {
        validateWorksiteKmRangeLive();
        invalidateEvaluationState();
      });
      worksiteStartKmEl.addEventListener("change", () => {
        validateWorksiteKmRangeLive();
        invalidateEvaluationState();
      });
    }

    if (worksiteEndKmEl) {
      worksiteEndKmEl.addEventListener("input", () => {
        validateWorksiteKmRangeLive();
        invalidateEvaluationState();
      });
      worksiteEndKmEl.addEventListener("change", () => {
        validateWorksiteKmRangeLive();
        invalidateEvaluationState();
      });
    }

    if (fromStationEl) {
      fromStationEl.addEventListener("change", () => {
        updateSectionKmDisplay(true);
        invalidateEvaluationState("Enter a valid Worksite KM Range to evaluate block availability.");
      });
    }

    if (toStationEl) {
      toStationEl.addEventListener("change", () => {
        updateSectionKmDisplay(true);
        invalidateEvaluationState("Enter a valid Worksite KM Range to evaluate block availability.");
      });
    }

    // 3. Centralized Track Line & Block Type Synchronization
    let isSynchronizingLineBlock = false;

    function syncTrackLineAndBlockType(changedField) {
      if (isSynchronizingLineBlock) return;
      isSynchronizingLineBlock = true;

      try {
        if (!trackLineEl || !blockTypeEl) return;

        if (changedField === "TRACK_LINE") {
          const val = trackLineEl.value;
          if (val === "UP Main Line") {
            blockTypeEl.value = "UP Line Block";
          } else if (val === "DOWN Main Line") {
            blockTypeEl.value = "DOWN Line Block";
          } else if (val === "Both UP & DOWN Lines") {
            blockTypeEl.value = "Both Lines Block (Simultaneous)";
          } else if (val === "Station Loop / Yard Track") {
            blockTypeEl.value = "Station Loop / Yard Track Block";
          }
        } else if (changedField === "BLOCK_TYPE") {
          const val = blockTypeEl.value;
          if (val === "UP Line Block") {
            trackLineEl.value = "UP Main Line";
          } else if (val === "DOWN Line Block") {
            trackLineEl.value = "DOWN Main Line";
          } else if (val === "Both Lines Block (Simultaneous)") {
            trackLineEl.value = "Both UP & DOWN Lines";
          } else if (val === "Station Loop / Yard Track Block") {
            trackLineEl.value = "Station Loop / Yard Track";
          }
        }

        // Immediately update right-side card summary from final synchronized form state
        const trackLineDisplayEl = document.getElementById("bpTrackLine");
        const blockTypeDisplayEl = document.getElementById("bpBlockType");
        if (trackLineDisplayEl) {
          trackLineDisplayEl.textContent = trackLineEl.value;
        }
        if (blockTypeDisplayEl) {
          blockTypeDisplayEl.textContent = blockTypeEl.value;
        }

        // Invalidate previous evaluation
        invalidateEvaluationState();
      } finally {
        isSynchronizingLineBlock = false;
      }
    }

    if (trackLineEl) {
      trackLineEl.addEventListener("change", () => syncTrackLineAndBlockType("TRACK_LINE"));
    }

    if (blockTypeEl) {
      blockTypeEl.addEventListener("change", () => syncTrackLineAndBlockType("BLOCK_TYPE"));
    }

    // Critical duration & preferred slot change listeners
    const durationInputEl = document.getElementById("reqDuration");
    if (durationInputEl) {
      durationInputEl.addEventListener("input", () => invalidateEvaluationState());
      durationInputEl.addEventListener("change", () => invalidateEvaluationState());
    }

    const preferredSlotSelectEl = document.getElementById("reqPreferredSlot");
    if (preferredSlotSelectEl) {
      preferredSlotSelectEl.addEventListener("change", () => invalidateEvaluationState());
    }

    // Initialize section display and initial waiting state (worksite inputs empty)
    updateSectionKmDisplay(true);
    invalidateEvaluationState("Enter a valid Worksite KM Range to evaluate block availability.");

    // 4. Jump to Operations Map Button
    if (btnJump) {
      btnJump.addEventListener("click", () => {
        switchMainTab("tabOperations");
      });
    }

    // 5. View on Tamil Nadu Map from Timetable Card
    if (btnViewMap) {
      btnViewMap.addEventListener("click", () => {
        const from = (fromStationEl ? fromStationEl.value : "KPD").toUpperCase();
        const to = (toStationEl ? toStationEl.value : "JTJ").toUpperCase();
        const line = trackLineEl ? trackLineEl.value : "UP Main Line";
        const block = blockTypeEl ? blockTypeEl.value : "UP Line Block";
        const start = worksiteStartKmEl ? parseFloat(worksiteStartKmEl.value) : null;
        const end = worksiteEndKmEl ? parseFloat(worksiteEndKmEl.value) : null;
        const stFrom = (data.stations || []).find(s => s.code === from) || { lat: 12.9698, lng: 79.1378 };
        const stTo = (data.stations || []).find(s => s.code === to) || { lat: 12.5594, lng: 78.5746 };
        const midLat = (stFrom.lat + stTo.lat) / 2;
        const midLng = (stFrom.lng + stTo.lng) / 2;

        setActiveCorridor({
          requestId: currentRecommendation?.requestId || "REQ-SR-PLAN",
          fromStation: from,
          toStation: to,
          trackLine: line,
          blockType: block,
          worksiteStartKm: start,
          worksiteEndKm: end,
          lat: midLat,
          lng: midLng
        });

        switchMainTab("tabOperations");
        if (mapInstance) {
          setTimeout(() => {
            mapInstance.flyTo([midLat, midLng], 10, { duration: 1 });
          }, 300);
        }
      });
    }

    // 6. Print Sanction Slip from Timetable Card
    if (btnPrintSlip) {
      btnPrintSlip.addEventListener("click", () => {
        openPrintableSanctionMemo();
      });
    }

    function renderBlockPlanningResult(rec, corridorData) {
      currentRecommendation = rec;
      currentCorridorData = corridorData;
      const card = document.getElementById("blockPlanningResultCard");
      if (!card) return;

      card.style.display = "block";

      const statusBadge = document.getElementById("bpStatusBadge");
      const dataStatusBadge = document.getElementById("bpDataStatusBadge");
      const reqWinEl = document.getElementById("bpRequestedWindow");
      const recBlockEl = document.getElementById("bpRecommendedBlock");
      const recDurEl = document.getElementById("bpRecommendedDuration");
      const blockCategoryLabel = document.getElementById("bpBlockCategoryLabel");
      const windowTypeBadge = document.getElementById("bpWindowTypeBadge");
      const extensionNote = document.getElementById("bpExtensionNote");
      const worksiteKmEl = document.getElementById("bpWorksiteKm");
      const worksiteSpanEl = document.getElementById("bpWorksiteSpan");
      const blockTypeDisplayEl = document.getElementById("bpBlockType");
      const trackLineDisplayEl = document.getElementById("bpTrackLine");
      const reasonBanner = document.getElementById("bpReasonBanner");
      const reasonText = document.getElementById("bpReasonText");
      const trainCountText = document.getElementById("bpTrainCountText");
      const trainsTableBody = document.getElementById("bpTrainsTableBody");
      const powerBlockText = document.getElementById("bpPowerBlockText");
      const adjacentLineText = document.getElementById("bpAdjacentLineText");
      const alternativesContainer = document.getElementById("bpAlternativesContainer");
      const alternativesList = document.getElementById("bpAlternativesList");
      const btnBpSanction = document.getElementById("btnBpSanction");

      if (statusBadge) {
        if (rec.status && rec.status.includes("NO FEASIBLE")) {
          statusBadge.textContent = "NO FEASIBLE BLOCK FOUND";
          statusBadge.style.background = "#fee2e2";
          statusBadge.style.color = "#991b1b";
          statusBadge.style.borderColor = "#fca5a5";
        } else {
          statusBadge.textContent = "SCHEDULED (OPTIMIZED)";
          statusBadge.style.background = "#dcfce7";
          statusBadge.style.color = "#166534";
          statusBadge.style.borderColor = "#86efac";
        }
      }

      if (dataStatusBadge) {
        if (rec.liveDataAvailable) {
          dataStatusBadge.textContent = "🟢 LIVE DATA • RailRadar Real-Time API";
          dataStatusBadge.style.background = "#dcfce7";
          dataStatusBadge.style.color = "#166534";
          dataStatusBadge.style.borderColor = "#86efac";
        } else {
          dataStatusBadge.textContent = "⚪ LIVE DATA UNAVAILABLE • DEMO/MOCK DATA";
          dataStatusBadge.style.background = "#f1f5f9";
          dataStatusBadge.style.color = "#475569";
          dataStatusBadge.style.borderColor = "#cbd5e1";
        }
      }

      if (reqWinEl) reqWinEl.textContent = `${rec.requestedWindow} IST`;
      if (recBlockEl) recBlockEl.textContent = rec.recommendedBlock;
      if (recDurEl) recDurEl.textContent = `${rec.durationMin} mins continuous`;

      // Distinct Preferred vs Alternative Window presentation
      if (rec.status && rec.status.includes("NO FEASIBLE")) {
        if (blockCategoryLabel) blockCategoryLabel.textContent = "No Feasible Block Found";
        if (windowTypeBadge) {
          windowTypeBadge.textContent = "Unavailable";
          windowTypeBadge.style.background = "#fee2e2";
          windowTypeBadge.style.color = "#991b1b";
          windowTypeBadge.style.display = "inline-block";
        }
        if (extensionNote) {
          extensionNote.style.display = "block";
          extensionNote.textContent = "⚠️ No continuous slot fits within evaluation horizon";
        }
        if (btnBpSanction) btnBpSanction.disabled = true;
      } else if (rec.isInsidePreferred) {
        if (blockCategoryLabel) blockCategoryLabel.textContent = "Recommended Block (Inside Preferred Window)";
        if (windowTypeBadge) {
          windowTypeBadge.textContent = "Preferred Window";
          windowTypeBadge.style.background = "#dcfce7";
          windowTypeBadge.style.color = "#166534";
          windowTypeBadge.style.display = "inline-block";
        }
        if (extensionNote) extensionNote.style.display = "none";
        if (btnBpSanction) btnBpSanction.disabled = false;
      } else {
        if (blockCategoryLabel) blockCategoryLabel.textContent = "Recommended Alternative Window";
        if (windowTypeBadge) {
          windowTypeBadge.textContent = "Alternative Window";
          windowTypeBadge.style.background = "#ffedd5";
          windowTypeBadge.style.color = "#c2410c";
          windowTypeBadge.style.display = "inline-block";
        }
        if (extensionNote) {
          extensionNote.style.display = "block";
          extensionNote.textContent = rec.extensionDetail ? `⚠️ ${rec.extensionDetail}` : "⚠️ Extends outside preferred window";
        }
        if (btnBpSanction) btnBpSanction.disabled = false;
      }

      if (worksiteKmEl) worksiteKmEl.textContent = rec.worksiteKmRange;
      if (worksiteSpanEl) {
        const span = corridorData?.kmValidation?.spanKm;
        worksiteSpanEl.textContent = span ? `Worksite span: ${span} km` : 'Maintenance worksite stretch';
      }
      if (blockTypeDisplayEl) blockTypeDisplayEl.textContent = rec.blockType;
      if (trackLineDisplayEl) trackLineDisplayEl.textContent = rec.trackLine;

      // Render Top Alternatives (Block Optimizer Ranked Candidates)
      if (alternativesContainer && alternativesList) {
        if (rec.alternatives && rec.alternatives.length > 0) {
          alternativesContainer.style.display = "block";
          alternativesList.innerHTML = rec.alternatives.map((alt, idx) => {
            const badgeBg = alt.isInsidePreferred ? '#dcfce7' : '#ffedd5';
            const badgeColor = alt.isInsidePreferred ? '#166534' : '#c2410c';
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 0.4rem 0.65rem; font-size: 0.74rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 700; color: #475569;">#${alt.rank || (idx + 2)}</span>
                  <strong style="color: #1e293b; font-family: monospace;">${alt.recommendedBlock}</strong>
                  <span style="color: #64748b; font-size: 0.7rem;">(${alt.durationMin} mins continuous)</span>
                  <span class="badge-pill" style="background: ${badgeBg}; color: ${badgeColor}; font-size: 0.64rem; padding: 0.1rem 0.35rem;">${alt.windowType}</span>
                </div>
                <div style="color: #64748b; font-size: 0.7rem; font-style: italic;">
                  ${alt.extensionDetail || alt.reason}
                </div>
              </div>
            `;
          }).join("");
        } else {
          alternativesContainer.style.display = "none";
          alternativesList.innerHTML = "";
        }
      }

      if (reasonBanner) {
        const dataSourceNote = !rec.liveDataAvailable
          ? `<div style="font-size: 0.72rem; color: #64748b; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-style: italic;">⚪ <strong>Notice:</strong> Real-time RailRadar telemetry is currently unavailable (${rec.liveUnavailableReason || 'Rate limit / monthly quota reached'}). This evaluation is generated using verified baseline corridor timetable data (Demo/Mock Data).</div>`
          : `<div style="font-size: 0.72rem; color: #166534; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #86efac; font-style: italic;">🟢 <strong>Live Telemetry:</strong> Evaluated using real-time RailRadar API telemetry.</div>`;

        if (rec.status && rec.status.includes("NO FEASIBLE")) {
          reasonBanner.style.background = "#fef2f2";
          reasonBanner.style.borderColor = "#fecaca";
          reasonBanner.style.borderLeft = "4px solid #ef4444";
          reasonBanner.style.color = "#991b1b";
          reasonBanner.innerHTML = `
            <div style="font-weight: 800; color: #b91c1c; margin-bottom: 2px;">⚠️ NO FEASIBLE BLOCK FOUND</div>
            <div style="font-size: 0.74rem; color: #991b1b; line-height: 1.4;">${rec.reason}</div>
            ${dataSourceNote}
          `;
        } else if (!rec.isInsidePreferred) {
          reasonBanner.style.background = "#fff7ed";
          reasonBanner.style.borderColor = "#fed7aa";
          reasonBanner.style.borderLeft = "4px solid #ea580c";
          reasonBanner.style.color = "#9a3412";
          reasonBanner.innerHTML = `
            <div style="font-weight: 800; color: #c2410c; margin-bottom: 2px;">⚠️ No feasible block available within preferred window (${rec.requestedWindow} IST).</div>
            <div style="font-weight: 600; color: #9a3412; margin-bottom: 3px;">Identified Alternative Window: <strong>${rec.recommendedBlock}</strong> (${rec.extensionDetail || 'shifted'})</div>
            <div style="font-size: 0.74rem; color: #7c2d12; line-height: 1.4;">${rec.reason}</div>
            ${dataSourceNote}
          `;
        } else {
          reasonBanner.style.background = "#f0fdf4";
          reasonBanner.style.borderColor = "#bbf7d0";
          reasonBanner.style.borderLeft = "4px solid #22c55e";
          reasonBanner.style.color = "#166534";
          reasonBanner.innerHTML = `
            <div style="font-weight: 800; color: #15803d; margin-bottom: 2px;">✓ Continuous block is feasible inside preferred window.</div>
            <div style="font-size: 0.74rem; color: #166534; line-height: 1.4;">${rec.reason}</div>
            ${dataSourceNote}
          `;
        }
      }

      if (trainCountText) {
        trainCountText.textContent = `${rec.evaluatedTrainCount || (corridorData?.trains?.length || 0)} corridor trains evaluated`;
      }

      // Populate trains table
      if (trainsTableBody) {
        const corridorTrains = corridorData?.trains || [];
        const conflictingNums = new Set((rec.conflictingTrains || []).map(t => String(t.trainNumber)));

        if (corridorTrains.length === 0) {
          trainsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 0.75rem;">No train telemetry records found.</td></tr>`;
        } else {
          trainsTableBody.innerHTML = corridorTrains.map(tr => {
            const isConflicting = conflictingNums.has(String(tr.trainNumber));
            const pTime = tr.passageTime ? `${tr.passageTime.entryTimeFormatted} – ${tr.passageTime.exitTimeFormatted}` : tr.scheduledDeparture;
            const delayStr = tr.delayMinutes > 0 ? `+${tr.delayMinutes}m delay` : 'Right Time';
            const delayColor = tr.delayMinutes > 0 ? '#b91c1c' : '#166534';
            const impactBadge = isConflicting
              ? `<span class="badge-pill" style="background: #fee2e2; color: #b91c1c;">Direct Conflict</span>`
              : (tr.line && tr.line.includes('DOWN')
                  ? `<span class="badge-pill" style="background: #fef3c7; color: #92400e;">Adjacent Track</span>`
                  : `<span class="badge-pill" style="background: #dcfce7; color: #166534;">Clear Window</span>`);

            return `
              <tr style="${isConflicting ? 'background: #fff5f5;' : ''}">
                <td style="padding: 0.45rem 0.65rem;"><strong>#${tr.trainNumber}</strong> <span style="font-size: 0.7rem; color: #64748b;">${tr.trainName}</span></td>
                <td style="padding: 0.45rem 0.65rem; font-size: 0.72rem;">${tr.line}</td>
                <td style="padding: 0.45rem 0.65rem; font-family: monospace; font-size: 0.74rem;">${pTime}</td>
                <td style="padding: 0.45rem 0.65rem; font-size: 0.72rem; color: ${delayColor}; font-weight: 600;">${delayStr}</td>
                <td style="padding: 0.45rem 0.65rem;">${impactBadge}</td>
              </tr>
            `;
          }).join("");
        }
      }

      // Configurable Safety Rules
      if (powerBlockText && rec.powerBlock) {
        if (rec.powerBlock.required) {
          powerBlockText.innerHTML = `⚡ <strong>25kV Traction Power Block:</strong> ${rec.powerBlock.label} &mdash; <span style="color: #64748b;">${rec.powerBlock.detail}</span>`;
        } else {
          powerBlockText.innerHTML = `⚡ <strong>25kV Traction Power Block:</strong> ${rec.powerBlock.label}`;
        }
      }
      if (adjacentLineText && rec.adjacentLineRestrictions) {
        adjacentLineText.innerHTML = `⚠️ <strong>Adjacent Track (${rec.trackLine.includes('UP') ? 'DOWN Main Line' : 'UP Main Line'}):</strong> ${rec.adjacentLineRestrictions}`;
      }

      // Automatically sync scheduled timetable card
      const isFeasible = !rec.status?.includes("NO FEASIBLE") && rec.recommendedBlock !== "--:-- – --:--";
      const ttCard = document.getElementById("sanctionedTimetableCard");

      if (isFeasible) {
        renderSanctionedTimetable(rec);
        if (ttCard) ttCard.style.display = "block";
      } else if (ttCard) {
        ttCard.style.display = "none";
      }
    }

    // 8. Simulated Controller Approval Workflow (Prototype Demo)
    const btnBpSanction = document.getElementById("btnBpSanction");
    if (btnBpSanction) {
      btnBpSanction.addEventListener("click", () => {
        if (!currentRecommendation) return;

        currentRecommendation.status = "SIMULATED CONTROLLER APPROVAL (DEMO)";
        const statusBadge = document.getElementById("bpStatusBadge");
        if (statusBadge) {
          statusBadge.textContent = "SIMULATED CONTROLLER APPROVAL (DEMO)";
          statusBadge.style.background = "#dcfce7";
          statusBadge.style.color = "#166534";
          statusBadge.style.borderColor = "#86efac";
        }

        // Update matching requisition in data.requisitions
        if (currentRecommendation.requestId) {
          const matchingReq = (data.requisitions || []).find(r => r.reqId === currentRecommendation.requestId);
          if (matchingReq) {
            matchingReq.status = "SCHEDULED";
            matchingReq.sanctionedSlot = currentRecommendation.recommendedBlock;
          }
        }
        renderRequisitionsList();
        plotRequisitionMapMarkers();

        // Update timetable card with simulated approval window
        renderSanctionedTimetable(currentRecommendation);

        auditLogger.logAction(
          "SIMULATED_CONTROLLER_APPROVAL",
          "Section Controller (Demo)",
          `Simulated controller approval for ${permitNo}: ${currentRecommendation.recommendedBlock} on ${currentRecommendation.trackLine} (${currentRecommendation.worksiteKmRange})`
        );

        alert(
          `[Decision-Support Prototype Demo]\n\n` +
          `Simulated Controller Approval recorded for demo purposes.\n\n` +
          `• Demo Permit ID: ${permitNo}\n` +
          `• Approved Window: ${currentRecommendation.recommendedBlock} (${currentRecommendation.windowType})\n` +
          `• Track Line: ${currentRecommendation.trackLine}\n` +
          `• Worksite: ${currentRecommendation.worksiteKmRange}\n\n` +
          `Note: RailFlow is an automated decision-support system. Statutory block booking remains the exclusive operational prerogative of the Chief Section Controller via the Control Office Application (COA).`
        );

        const ttCard = document.getElementById("sanctionedTimetableCard");
        if (ttCard) {
          ttCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    // 9. View Worksite on Live Map Handler
    const btnBpViewMap = document.getElementById("btnBpViewMap");
    if (btnBpViewMap) {
      btnBpViewMap.addEventListener("click", () => {
        const from = (fromStationEl ? fromStationEl.value : "KPD").toUpperCase();
        const to = (toStationEl ? toStationEl.value : "JTJ").toUpperCase();
        const line = trackLineEl ? trackLineEl.value : "UP Main Line";
        const block = blockTypeEl ? blockTypeEl.value : "UP Line Block";
        const start = worksiteStartKmEl ? parseFloat(worksiteStartKmEl.value) : null;
        const end = worksiteEndKmEl ? parseFloat(worksiteEndKmEl.value) : null;
        const stFrom = (data.stations || []).find(s => s.code === from) || { lat: 12.9698, lng: 79.1378 };
        const stTo = (data.stations || []).find(s => s.code === to) || { lat: 12.5594, lng: 78.5746 };
        const midLat = (stFrom.lat + stTo.lat) / 2;
        const midLng = (stFrom.lng + stTo.lng) / 2;

        const reqId = currentRecommendation?.requestId || "REQ-SR-PLAN";
        const matchedReq = (data.requisitions || []).find(r => r.reqId === reqId);

        setActiveCorridor({
          requestId: reqId,
          reqId: reqId,
          department: matchedReq?.department || "Department Requisition",
          workType: matchedReq?.workType || "Maintenance Block",
          fromStation: from,
          toStation: to,
          trackLine: line,
          blockType: block,
          worksiteStartKm: start,
          worksiteEndKm: end,
          kmRange: currentRecommendation?.worksiteKmRange || `KM ${start} – KM ${end}`,
          status: matchedReq ? matchedReq.status : (currentRecommendation?.status || "RECOMMENDED – PENDING CONTROLLER APPROVAL"),
          sanctionedSlot: currentRecommendation?.recommendedBlock,
          recommendedBlock: currentRecommendation?.recommendedBlock,
          lat: midLat,
          lng: midLng
        });

        switchMainTab("tabOperations");
        if (mapInstance) {
          setTimeout(() => {
            mapInstance.flyTo([midLat, midLng], 11, { duration: 1 });
            const m = mapLayers.trainMarkers[reqId] || (mapLayers.pendingRequests || []).find(pr => pr._latlng && Math.abs(pr._latlng.lat - midLat) < 0.05);
            if (m) {
              setTimeout(() => m.openPopup(), 1100);
            } else if (mapLayers.block) {
              setTimeout(() => mapLayers.block.openPopup(), 1100);
            }
          }, 300);
        }
      });
    }

    // 10. Evaluate Block Planning Request against Backend Engine
    async function evaluateBlockRequest(payload) {
      const response = await fetch('/api/block-planning/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await response.json();
    }

    // 11. Handle Form Submission
    if (reqForm) {
      reqForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById("btnSubmitRequisition");
        const originalBtnText = submitBtn ? submitBtn.innerHTML : "Submit Block Requisition &rarr;";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `Evaluating Telemetry &amp; Optimizing Block...`;
        }

        const deptRadio = document.querySelector('input[name="reqDepartment"]:checked');
        const department = deptRadio ? deptRadio.value : "Civil / Track (P-Way)";
        const deptCode = deptRadio ? deptRadio.getAttribute("data-dept-code") : "CIVIL";

        const fromStation = document.getElementById("reqFromStation").value;
        const toStation = document.getElementById("reqToStation").value;
        const trackLine = document.getElementById("reqTrackLine").value;
        const blockType = document.getElementById("reqBlockType")?.value || "UP Line Block";
        
        const startEl = document.getElementById("reqWorksiteStartKm");
        const endEl = document.getElementById("reqWorksiteEndKm");
        const validation = validateWorksiteKmRangeLive();

        if (!validation.valid) {
          alert(`Worksite KM Error:\n${kmValidationMsgEl ? kmValidationMsgEl.textContent : 'Please enter valid worksite KM limits within the selected section.'}`);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          }
          if (startEl && !startEl.value) startEl.focus();
          else if (endEl) endEl.focus();
          return;
        }

        const startKm = parseFloat(startEl.value);
        const endKm = parseFloat(endEl.value);
        const worksiteKmRange = `KM ${startKm.toFixed(2)} – KM ${endKm.toFixed(2)}`;

        const workCategory = document.getElementById("reqWorkCategory")?.value || "CIVIL_TAMP";
        const workDesc = document.getElementById("reqWorkDesc").value;
        const machinery = document.getElementById("reqMachinery").value || "Standard Machinery";
        const durationMin = parseInt(document.getElementById("reqDuration").value, 10) || 150;
        const urgency = document.getElementById("reqUrgency").value;
        const preferredSlot = document.getElementById("reqPreferredSlot")?.value || "Midday Traffic Shadow (11:00–14:30)";

        const stFrom = data.stations.find(s => s.code === fromStation) || data.stations[0];
        const stTo = data.stations.find(s => s.code === toStation) || data.stations[1];
        const sectionName = `${stFrom.name.split(" ")[0]} – ${stTo.name.split(" ")[0]}`;

        // Tag request with unique evaluation ID and fingerprint to prevent stale overwrites
        const evalId = ++currentEvaluationId;
        const requestFingerprint = `${fromStation}|${toStation}|${startKm}|${endKm}|${trackLine}|${blockType}|${durationMin}|${preferredSlot}`;
        activeRequestFingerprint = requestFingerprint;

        const reqPayload = {
          fromStation: fromStation,
          toStation: toStation,
          trackLine: trackLine,
          blockType: blockType,
          worksiteStartKm: startKm,
          worksiteEndKm: endKm,
          worksiteKmRange: worksiteKmRange,
          workCategory: workCategory,
          workDesc: workDesc,
          machinery: machinery,
          durationMin: durationMin,
          urgency: urgency,
          preferredSlot: preferredSlot,
          config: prototypeConfig,
          headwayMinutes: prototypeConfig.headwayMinutes,
          cautionSpeedKmH: prototypeConfig.cautionSpeedKmH,
          maxSpeedKmH: prototypeConfig.maxSpeedKmH
        };

        try {
          const resData = await evaluateBlockRequest(reqPayload);

          // Discard if user changed parameters or triggered another evaluation in the meantime
          if (evalId !== currentEvaluationId || getCurrentRequestFingerprint() !== requestFingerprint) {
            console.warn("Discarding stale evaluation response for request:", requestFingerprint);
            return;
          }

          if (!resData.success) {
            alert(`Evaluation Rejection (${resData.error?.code || 'ERROR'}):\n${resData.error?.message || 'Server rejected block evaluation.'}`);
            invalidateEvaluationState(resData.error?.message || "Evaluation rejected.");
            return;
          }

          if (resData.result) {
            resData.result.fromStation = fromStation;
            resData.result.toStation = toStation;
            resData.result.trackLine = trackLine;
            resData.result.blockType = blockType;
            resData.result.department = department;
            resData.result.deptCode = deptCode;
            resData.result.workDesc = workDesc;
            resData.result.workType = workDesc;
            resData.result.machinery = machinery;
            resData.result.durationMin = durationMin;
            resData.result.urgency = urgency;
            resData.result.worksiteStartKm = startKm;
            resData.result.worksiteEndKm = endKm;
            resData.result.kmRange = worksiteKmRange;
            resData.result.sectionName = sectionName;

            renderBlockPlanningResult(resData.result, resData.corridorData);

            const isFeasible = !resData.result.status?.includes("NO FEASIBLE") && resData.result.recommendedBlock !== "--:-- – --:--";
            const reqStatus = isFeasible ? "SCHEDULED" : "UNSCHEDULED (NO FEASIBLE BLOCK)";
            const finalSlot = isFeasible ? resData.result.recommendedBlock : "--:-- – --:--";

            const reqId = `REQ-SR-${deptCode}-${Math.floor(100 + Math.random() * 900)}`;
            const midLat = (stFrom.lat + stTo.lat) / 2 + (Math.random() - 0.5) * 0.05;
            const midLng = (stFrom.lng + stTo.lng) / 2 + (Math.random() - 0.5) * 0.05;

            const newReq = {
              reqId: reqId,
              requestId: reqId,
              department: department,
              deptCode: deptCode,
              fromStation: fromStation,
              toStation: toStation,
              sectionName: sectionName,
              trackLine: trackLine,
              blockType: blockType,
              worksiteStartKm: startKm,
              worksiteEndKm: endKm,
              kmRange: worksiteKmRange,
              workType: workDesc,
              machinery: machinery,
              durationMin: durationMin,
              urgency: urgency,
              status: reqStatus,
              submittedBy: `Field Supervisor (${department})`,
              submittedTime: "Just now",
              sanctionedSlot: finalSlot,
              scheduledSlot: finalSlot,
              recommendedBlock: finalSlot,
              windowType: resData.result.windowType,
              isInsidePreferred: resData.result.isInsidePreferred,
              powerBlock: resData.result.powerBlock,
              adjacentLineRestrictions: resData.result.adjacentLineRestrictions,
              liveDataAvailable: resData.result.liveDataAvailable,
              lat: midLat,
              lng: midLng
            };

            if (currentRecommendation) {
              currentRecommendation.requestId = reqId;
              currentRecommendation.department = department;
              currentRecommendation.workType = workDesc;
              currentRecommendation.status = isFeasible ? "OPTIMIZED & SCHEDULED (SIMULATION)" : "NO FEASIBLE BLOCK FOUND";
            }

            data.requisitions.unshift(newReq);

            auditLogger.logAction(
              "AUTOMATIC_OPTIMIZED_SCHEDULE",
              department,
              `Auto-scheduled ${reqId}: ${workDesc} on ${sectionName} (${durationMin} min). Assigned Slot: ${finalSlot}`
            );

            renderRequisitionsList();
            plotRequisitionMapMarkers();
            setActiveCorridor(newReq);

            const resultCard = document.getElementById("blockPlanningResultCard");
            if (resultCard) {
              resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        } catch (err) {
          console.error("Evaluation error:", err);
          alert("Could not evaluate real-time block recommendation: " + err.message);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          }
        }
      });
    }

    renderRequisitionsList();
    renderSanctionedTimetable();
  }

  function renderRequisitionsList() {
    const listContainer = document.getElementById("requisitionsListContainer");
    const countBadge = document.getElementById("requisitionsCountBadge");
    if (!listContainer) return;

    const reqs = data.requisitions || [];
    if (countBadge) countBadge.textContent = `${reqs.length} Active`;

    let html = "";
    reqs.forEach((req) => {
      const isScheduled = req.status === "SCHEDULED" || req.status === "APPROVED" || (req.status && (req.status.includes("SCHEDULED") || req.status.includes("APPROVED") || req.status.includes("SIMULATED")));
      const icon = req.deptCode === "CIVIL" ? "🛠️" : (req.deptCode === "SNT" ? "📡" : (req.deptCode === "TRD" ? "⚡" : "🛞"));
      const deptColor = req.deptCode === "CIVIL" ? "#16a34a" : (req.deptCode === "SNT" ? "#0284c7" : (req.deptCode === "TRD" ? "#d97706" : "#9333ea"));
      const slotVal = req.sanctionedSlot || req.recommendedBlock || "11:00 – 13:15 IST";

      html += `
        <div class="req-list-item" data-id="${req.reqId}">
          <div class="req-item-top">
            <span class="req-item-dept" style="color: ${deptColor};">
              <span>${icon}</span> ${req.department}
            </span>
            <span class="badge-pill ${isScheduled ? 'pill-rec' : 'pill-danger'}" style="${!isScheduled ? 'background: #fee2e2; color: #991b1b;' : ''}">
              ${isScheduled ? '&#10003; SCHEDULED' : '⚠️ UNSCHEDULED'}
            </span>
          </div>

          <div class="req-item-work">
            <strong>${req.reqId}:</strong> ${req.workType}
          </div>

          <div class="req-item-meta">
            <span>📍 ${req.sectionName} (${req.trackLine})</span>
            <span>⏱️ ${req.durationMin} mins</span>
            <span>🚨 ${req.urgency}</span>
          </div>

          <div style="font-size: 0.74rem; color: ${isScheduled ? '#166534' : '#991b1b'}; background: ${isScheduled ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isScheduled ? '#bbf7d0' : '#fecaca'}; padding: 0.25rem 0.5rem; border-radius: 4px; margin-top: 2px;">
            <strong>${isScheduled ? 'Scheduled Window:' : 'Status:'}</strong> ${isScheduled ? slotVal : 'No feasible block available'}
          </div>

          <div class="req-item-actions">
            <button class="rf-btn rf-btn-outline btn-view-req-map" data-id="${req.reqId}" style="padding: 0.25rem 0.65rem; font-size: 0.74rem; width: 100%;">
              📍 View on Map
            </button>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;

    // View on map buttons
    listContainer.querySelectorAll(".btn-view-req-map").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        const req = (data.requisitions || []).find(r => r.reqId === id);
        if (req) {
          setActiveCorridor(req);
          switchMainTab("tabOperations");
          if (mapInstance) {
            setTimeout(() => {
              mapInstance.flyTo([req.lat, req.lng], 11, { duration: 1 });
              const m = mapLayers.trainMarkers[id] || (mapLayers.pendingRequests || []).find(pr => pr._latlng && Math.abs(pr._latlng.lat - req.lat) < 0.001);
              if (m) setTimeout(() => m.openPopup(), 1100);
            }, 200);
          }
        }
      });
    });

    // Also clicking any requisition card switches active corridor immediately
    listContainer.querySelectorAll(".req-list-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-id");
        const req = (data.requisitions || []).find(r => r.reqId === id);
        if (req) {
          setActiveCorridor(req);
        }
      });
    });
  }

  function renderSanctionedTimetable(context = null) {
    const ttCard = document.getElementById("sanctionedTimetableCard");
    const timeline = document.getElementById("ttScheduleTimeline");
    if (!timeline) return;

    // Single source of truth: explicitly passed context, or activeCorridorState
    const activeReq = context || activeCorridorState;
    if (!activeReq) return;

    const fromCode = (activeReq.fromStation || "KPD").toUpperCase();
    const toCode = (activeReq.toStation || "JTJ").toUpperCase();
    const activeLine = activeReq.trackLine || "UP Main Line";
    const activeSlot = activeReq.sanctionedSlot || activeReq.recommendedBlock || currentRecommendation?.recommendedBlock || "11:00 – 12:30 IST";
    const dur = activeReq.durationMin || currentRecommendation?.durationMin || 90;
    const winType = activeReq.windowType || currentRecommendation?.windowType || "Preferred Window";
    const permitId = activeReq.reqId || activeReq.requestId || "SR-PLAN";

    const stFrom = (data.stations || []).find(s => s.code === fromCode) || { name: fromCode, code: fromCode };
    const stTo = (data.stations || []).find(s => s.code === toCode) || { name: toCode, code: toCode };
    const fromCity = (stFrom.name || fromCode).split(" ")[0];
    const toCity = (stTo.name || toCode).split(" ")[0];

    // 1. Update Card Header Section & Line + Approved Window + Permit No
    const ttSectionEl = document.getElementById("ttSectionName");
    const ttWindowEl = document.getElementById("ttApprovedWindow");
    const ttPermitEl = document.getElementById("ttPermitOrderNo");

    if (ttSectionEl) {
      ttSectionEl.textContent = `${stFrom.name} (${fromCode}) – ${stTo.name} (${toCode}) • ${activeLine}`;
    }
    if (ttWindowEl) {
      ttWindowEl.textContent = `${activeSlot} (${dur} mins - ${winType})`;
    }
    if (ttPermitEl) {
      ttPermitEl.textContent = `SR-${permitId.replace(/^REQ-SR-/, '')}`;
    }

    // 2. Update Safety Rules with Honest Demo/Mock telemetry wording
    const ttPowerEl = document.getElementById("ttPowerBlockRule");
    const ttAdjEl = document.getElementById("ttAdjacentLineRule");
    const ttTrainEl = document.getElementById("ttTrainProtectionRule");

    if (ttPowerEl) {
      const power = activeReq.powerBlock || currentRecommendation?.powerBlock;
      if (power) {
        ttPowerEl.innerHTML = power.required
          ? `⚡ <strong>Traction Power:</strong> ${power.label} (${power.detail || 'Local feed isolation'})`
          : `⚡ <strong>Traction Power:</strong> ${power.label}`;
      } else {
        const isTrd = (activeReq.deptCode === 'TRD') || (activeReq.department && activeReq.department.includes('TRD'));
        ttPowerEl.innerHTML = isTrd
          ? `⚡ <strong>Traction Power:</strong> 25kV AC Power Block Required`
          : `⚡ <strong>Traction Power:</strong> No automatic Power Block requirement identified for this activity; final OHE isolation requirement is subject to worksite conditions and authorised railway procedures.`;
      }
    }

    if (ttAdjEl) {
      const adj = activeReq.adjacentLineRestrictions || currentRecommendation?.adjacentLineRestrictions;
      if (adj) {
        ttAdjEl.innerHTML = `⚠️ <strong>Adjacent Track:</strong> ${adj}`;
      } else {
        const oppLine = activeLine.includes('UP') ? 'DOWN Main Line' : (activeLine.includes('DOWN') ? 'UP Main Line' : 'Adjacent Track');
        ttAdjEl.innerHTML = `⚠️ <strong>Adjacent Track (${oppLine}):</strong> Caution order 30 km/h and safety lookouts required.`;
      }
    }

    if (ttTrainEl) {
      const isMock = !activeReq.liveDataAvailable && (!currentRecommendation || !currentRecommendation.liveDataAvailable);
      const trainCount = activeReq.evaluatedTrainCount || currentRecommendation?.evaluatedTrainCount || 7;
      if (isMock) {
        ttTrainEl.innerHTML = `🛡️ <strong>Train Telemetry:</strong> Evaluated ${trainCount} corridor trains. Automated slot assigned based on available timetable/demo data.`;
      } else {
        ttTrainEl.innerHTML = `🛡️ <strong>Train Telemetry:</strong> Evaluated ${trainCount} corridor trains. Safe passage guaranteed during approved window.`;
      }
    }

    // 3. Filter Bundled Departmental Timetable:
    // Strictly isolate to the SAME corridor/section and compatible line conditions
    const allReqs = data.requisitions || [];
    const compatibleReqs = allReqs.filter(r => {
      // Exclude the active requisition itself from the bundled departmental activities list
      if (permitId && r.reqId === permitId) return false;

      const rFrom = (r.fromStation || "").toUpperCase();
      const rTo = (r.toStation || "").toUpperCase();

      // Strict corridor match: exactly the same station pair or city names
      const corridorMatch = (rFrom === fromCode && rTo === toCode) ||
                            (rFrom === toCode && rTo === fromCode) ||
                            (r.sectionName && r.sectionName.includes(fromCity) && r.sectionName.includes(toCity));
      if (!corridorMatch) return false;

      // Track line compatibility
      const rLine = r.trackLine || "UP Main Line";
      let lineMatch = false;
      if (activeLine === "UP Main Line" || activeLine === "UP Line Block" || (activeLine.includes("UP") && !activeLine.includes("Both") && !activeLine.includes("DOWN"))) {
        lineMatch = rLine.includes("UP") || rLine.includes("Both");
      } else if (activeLine === "DOWN Main Line" || activeLine === "DOWN Line Block" || (activeLine.includes("DOWN") && !activeLine.includes("Both") && !activeLine.includes("UP"))) {
        lineMatch = rLine.includes("DOWN") || rLine.includes("Both");
      } else if (activeLine.includes("Both")) {
        lineMatch = true;
      } else if (activeLine.includes("Yard") || activeLine.includes("Loop") || activeLine.includes("Station")) {
        lineMatch = rLine.includes("Yard") || rLine.includes("Loop") || rLine.includes("Station");
      } else {
        lineMatch = rLine === activeLine;
      }

      return lineMatch;
    });

    // 4. Render Bundled Departmental Timetable Schedule
    if (compatibleReqs.length === 0) {
      timeline.innerHTML = `
        <div class="no-bundled-activities" style="text-align: center; color: #64748b; padding: 1.25rem 0.5rem; font-style: italic; font-size: 0.8rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px;">
          No compatible departmental activities available for bundling.
        </div>
      `;
    } else {
      let html = "";
      compatibleReqs.forEach(req => {
        const deptCode = req.deptCode || (req.department.includes("Civil") ? "CIVIL" : (req.department.includes("Signal") || req.department.includes("S&T") ? "SNT" : (req.department.includes("Electrical") || req.department.includes("TRD") ? "TRD" : "GEN")));
        const deptClass = deptCode === "CIVIL" ? "slot-civil" : (deptCode === "SNT" ? "slot-snt" : (deptCode === "TRD" ? "slot-trd" : "slot-mech"));
        const deptColor = deptCode === "CIVIL" ? "#166534" : (deptCode === "SNT" ? "#0284c7" : (deptCode === "TRD" ? "#d97706" : "#9333ea"));

        const slotTime = req.sanctionedSlot || req.recommendedBlock || activeSlot;
        const kmText = req.kmRange || (req.worksiteStartKm && req.worksiteEndKm ? `KM ${parseFloat(req.worksiteStartKm).toFixed(2)} – KM ${parseFloat(req.worksiteEndKm).toFixed(2)}` : 'Section stretch');
        const secText = req.sectionName || `${stFrom.name} – ${stTo.name}`;
        const machineText = req.machinery ? ` (${req.machinery})` : '';

        html += `
          <div class="tt-slot-row ${deptClass}">
            <div>
              <strong style="color: ${deptColor};">${req.department}</strong> &bull; ${req.workType}${machineText}
              <div style="font-size: 0.72rem; color: #64748b;">${secText} (${req.trackLine}, ${kmText})</div>
            </div>
            <div class="tt-slot-time">${slotTime} (${req.durationMin} min)</div>
          </div>
        `;
      });

      timeline.innerHTML = html;
    }

    if (ttCard) {
      ttCard.style.display = "block";
    }
  }

  // =========================================================================
  // 10. Bootstrap Initial Views
  // =========================================================================
  initOperationsMap();
  renderOperationsSidebar();
  renderActivityRegister();
  renderCandidateCards();
  setupComparisonAndImpactActions();
  initRequisitionPortal();
});
