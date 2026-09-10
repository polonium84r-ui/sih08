/**
 * RailFlow - Authentic Tamil Nadu Railway Network & Operational Data
 * Southern Railway (SR) - Chennai, Salem, Tiruchirappalli, Madurai Divisions
 */

const CorridorData = {
  corridorName: "Chennai Central — Coimbatore / Chennai Egmore — Madurai",
  subJurisdiction: "Tamil Nadu Rail Network · Southern Railway (SR) Jurisdiction",
  targetSection: "Katpadi–Jolarpettai",
  sectionCode: "S-KPD-JTJ",
  operationalDate: "24 Aug 2026",
  currentTime: "10:12 IST",

  // Geographical Coordinates for Tamil Nadu Railway Network on Leaflet Map
  // Authentic Southern Railway Track Geometry (OpenStreetMap Network Topology)
  // High-precision tracks extracted from OpenStreetMap railway=rail network
  trackGeometry: (typeof TrackGeometry !== "undefined")
    ? TrackGeometry
    : (function() {
        try { return require('./track_geometry.js'); } catch(e) { return {}; }
      })(),

  stations: [
    { code: "MAS", name: "Puratchi Thalaivar Dr. M.G.R. Chennai Central", km: 0.0, lat: 13.08351, lng: 80.27543, loops: 12, division: "Chennai" },
    { code: "AJJ", name: "Arakkonam Junction", km: 68.6, lat: 13.08137, lng: 79.66732, loops: 6, division: "Chennai" },
    { code: "KPD", name: "Katpadi Junction (Vellore)", km: 129.6, lat: 12.97244, lng: 79.13460, loops: 6, division: "Chennai" },
    { code: "JTJ", name: "Jolarpettai Junction", km: 214.1, lat: 12.55857, lng: 78.57753, loops: 8, division: "Chennai" },
    { code: "MAP", name: "Morappur", km: 268.5, lat: 12.12308, lng: 78.39327, loops: 4, division: "Salem" },
    { code: "SA", name: "Salem Junction", km: 334.2, lat: 11.66100, lng: 78.11729, loops: 6, division: "Salem" },
    { code: "ED", name: "Erode Junction", km: 394.0, lat: 11.32769, lng: 77.72536, loops: 7, division: "Salem" },
    { code: "TUP", name: "Tiruppur", km: 444.2, lat: 11.10911, lng: 77.34140, loops: 4, division: "Salem" },
    { code: "CBE", name: "Coimbatore Junction", km: 494.4, lat: 11.00216, lng: 76.96367, loops: 6, division: "Salem" },
    { code: "MS", name: "Chennai Egmore", km: 2.1, lat: 13.07822, lng: 80.26150, loops: 10, division: "Chennai" },
    { code: "TBM", name: "Tambaram", km: 27.2, lat: 12.93662, lng: 80.13072, loops: 8, division: "Chennai" },
    { code: "CGL", name: "Chengalpattu Junction", km: 55.8, lat: 12.68465, lng: 79.98483, loops: 6, division: "Chennai" },
    { code: "TMV", name: "Tindivanam", km: 121.4, lat: 12.22848, lng: 79.65087, loops: 4, division: "Tiruchirappalli" },
    { code: "VM", name: "Villupuram Junction", km: 158.9, lat: 11.93875, lng: 79.49987, loops: 7, division: "Tiruchirappalli" },
    { code: "VRI", name: "Vriddhachalam Junction", km: 213.4, lat: 11.52158, lng: 79.31213, loops: 5, division: "Tiruchirappalli" },
    { code: "TPJ", name: "Tiruchirappalli Junction", km: 336.8, lat: 10.79535, lng: 78.69568, loops: 8, division: "Tiruchirappalli" },
    { code: "DG", name: "Dindigul Junction", km: 431.1, lat: 10.35585, lng: 77.98873, loops: 5, division: "Madurai" },
    { code: "MDU", name: "Madurai Junction", km: 493.3, lat: 9.92769, lng: 78.11359, loops: 7, division: "Madurai" },
    { code: "VPT", name: "Virudhunagar Junction", km: 536.8, lat: 9.58742, lng: 77.95889, loops: 5, division: "Madurai" },
    { code: "TEN", name: "Tirunelveli Junction", km: 650.2, lat: 8.71243, lng: 77.72852, loops: 6, division: "Madurai" },
    { code: "CAPE", name: "Kanyakumari", km: 735.6, lat: 8.08836, lng: 77.53826, loops: 4, division: "Thiruvananthapuram" }
  ],

  // Targeted Coordinated Block Segment (Katpadi - Jolarpettai, Tamil Nadu)
  proposedBlockSection: {
    from: "KPD",
    to: "JTJ",
    fromName: "Katpadi Junction (Vellore)",
    toName: "Jolarpettai Junction",
    track: "UP Mainline (Track 1)",
    lengthKm: 84.5
  },

  // 3 Maintenance Activities in the Register for Southern Railway
  activities: [
    {
      taskId: "MT-SR-ENG-104",
      department: "Engineering / Track",
      section: "Katpadi–Jolarpettai",
      sectionCode: "S-KPD-JTJ",
      workType: "PERIODIC",
      workTypeClass: "type-periodic",
      duration: "2.5 h",
      durationMin: 150,
      urgency: "Due",
      urgencyClass: "urgency-due",
      compatibility: "COMPATIBLE",
      compatibleWith: "with MT-SR-SNT-218, MT-SR-TRD-309",
      planningStatus: "Due this week",
      blockReq: "Yes",
      selected: true
    },
    {
      taskId: "MT-SR-SNT-218",
      department: "S&T",
      section: "Katpadi–Jolarpettai",
      sectionCode: "S-KPD-JTJ",
      workType: "DEFECTIVE",
      workTypeClass: "type-defective",
      duration: "1.5 h",
      durationMin: 90,
      urgency: "Overdue",
      urgencyClass: "urgency-overdue",
      compatibility: "COMPATIBLE",
      compatibleWith: "with MT-SR-ENG-104, MT-SR-TRD-309",
      planningStatus: "Immediate attention",
      blockReq: "Yes",
      selected: true
    },
    {
      taskId: "MT-SR-TRD-309",
      department: "Traction / OHE",
      section: "Katpadi–Jolarpettai",
      sectionCode: "S-KPD-JTJ",
      workType: "PREVENTIVE",
      workTypeClass: "type-preventive",
      duration: "2.5 h",
      durationMin: 150,
      urgency: "Due",
      urgencyClass: "urgency-due",
      compatibility: "COMPATIBLE",
      compatibleWith: "with MT-SR-ENG-104, MT-SR-SNT-218",
      planningStatus: "Due this week",
      blockReq: "Yes",
      selected: true
    }
  ],

  // Live Running & Delayed Trains across Tamil Nadu Corridor
  delayedTrains: [
    {
      id: "12675",
      name: "12675 Kovai Superfast Express",
      delay: "+12 min",
      priorityTag: "Railway Board priority",
      tagClass: "badge-board-priority",
      lat: 12.82,
      lng: 78.98,
      direction: "UP",
      status: "delayed"
    },
    {
      id: "66021",
      name: "66021 KPD-JTJ MEMU Passenger",
      delay: "+4 min",
      priorityTag: null,
      lat: 12.65,
      lng: 78.72,
      direction: "DN",
      status: "delayed"
    },
    {
      id: "BTPN-ENR",
      name: "BTPN Petroleum Rake Ennore-CBE",
      delay: "+22 min",
      priorityTag: null,
      lat: 12.92,
      lng: 79.25,
      direction: "UP",
      status: "delayed"
    },
    {
      id: "12635",
      name: "12635 Vaigai Superfast Express",
      delay: "On Time",
      priorityTag: null,
      lat: 11.75,
      lng: 79.42,
      direction: "UP",
      status: "running"
    },
    {
      id: "20643",
      name: "20643 Coimbatore Vande Bharat Express",
      delay: "On Time",
      priorityTag: "Highest Priority",
      lat: 13.02,
      lng: 79.45,
      direction: "UP",
      status: "running"
    }
  ],

  // Active Headway & FIFO Conflicts on Monitored Corridor
  activeConflicts: [
    {
      type: "FIFO",
      typeClass: "badge-fifo",
      detail: "66021 KPD-JTJ MEMU vs 66023 KPD-SA Passenger"
    },
    {
      type: "Priority override",
      typeClass: "badge-priority-override",
      detail: "66021 KPD-JTJ MEMU vs 12675 Kovai Express"
    }
  ],

  // Upcoming Maintenance Queue
  upcomingMaintenance: [
    {
      id: "MT-SR-ENG-104",
      dept: "Engineering / Track",
      urgency: "Due",
      urgencyClass: "urgency-due"
    },
    {
      id: "MT-SR-SNT-218",
      dept: "S&T",
      urgency: "Overdue",
      urgencyClass: "urgency-overdue"
    },
    {
      id: "MT-SR-TRD-309",
      dept: "Traction / OHE",
      urgency: "Due",
      urgencyClass: "urgency-due"
    }
  ],

  // Candidate Windows Scored for Tamil Nadu Section
  candidateWindows: [
    {
      id: "OPTION-A",
      name: "Option A",
      window: "08:30–11:00 IST",
      maintenanceCompletion: "Feasible",
      trainsAffected: 5,
      estDelayMin: 64,
      priorityTrainsAffected: 2,
      conflicts: 2,
      speedRestriction: "Not required",
      combinedActivities: "3 departments",
      overallImpact: "High",
      status: "—",
      isRecommended: false,
      hasSpeedRestriction: false
    },
    {
      id: "OPTION-B",
      name: "Option B",
      window: "11:30–14:00 IST",
      maintenanceCompletion: "Feasible",
      trainsAffected: 3,
      estDelayMin: 18,
      priorityTrainsAffected: "None",
      conflicts: 1,
      speedRestriction: "Not required",
      combinedActivities: "3 departments",
      overallImpact: "Lower",
      status: "Recommended",
      isRecommended: true,
      hasSpeedRestriction: false,
      recommendationBanner: "LOWEST OPERATIONAL IMPACT — RECOMMENDED FOR COORDINATED BLOCK",
      assessment: {
        title: "RailFlow Assessment: Option B (W-B, 11:30–14:00)",
        text: "Recommended because it completes the required Engineering, S&T and Traction work on Katpadi–Jolarpettai in one coordinated block, avoids peak paths for 20643 Vande Bharat and 12675 Kovai Express, does not require a Temporary Speed Restriction, and produces the lowest estimated train-delay impact (18 min). Track, signalling and traction departments are compatible — no department is ranked above another.",
        tags: [
          "Combined block",
          "FIFO preserved on C-FIFO-01",
          "Railway Board list applied on C-BOARD-01",
          "No Temporary Speed Restriction",
          "Confidence: HIGH",
          "Last sync 28s ago"
        ]
      }
    },
    {
      id: "OPTION-C",
      name: "Option C",
      window: "14:30–17:00 IST",
      maintenanceCompletion: "Feasible",
      trainsAffected: 4,
      estDelayMin: 40,
      priorityTrainsAffected: 1,
      conflicts: 1,
      speedRestriction: "Required — last resort",
      combinedActivities: "3 departments",
      overallImpact: "High complexity",
      status: "Not preferred",
      isRecommended: false,
      hasSpeedRestriction: true
    }
  ],

  totalKm: 494.4,

  // Track Sections for Tamil Nadu Network
  sections: [
    { id: "S-KPD-JTJ", from: "KPD", to: "JTJ", lengthKm: 84.5, trackType: "DOUBLE", maxSpeed: 130, status: "PROPOSED_BLOCK" },
    { id: "SEC-MAS-AJJ", from: "MAS", to: "AJJ", lengthKm: 68.6, trackType: "QUADRUPLE", maxSpeed: 130, status: "CLEAR" },
    { id: "SEC-AJJ-KPD", from: "AJJ", to: "KPD", lengthKm: 61.0, trackType: "DOUBLE", maxSpeed: 130, status: "CLEAR" },
    { id: "SEC-JTJ-SA", from: "JTJ", to: "SA", lengthKm: 120.1, trackType: "DOUBLE", maxSpeed: 130, status: "CLEAR" },
    { id: "SEC-SA-ED", from: "SA", to: "ED", lengthKm: 59.8, trackType: "DOUBLE", maxSpeed: 130, status: "CLEAR" },
    { id: "SEC-ED-CBE", from: "ED", to: "CBE", lengthKm: 100.4, trackType: "DOUBLE", maxSpeed: 130, status: "CLEAR" },
    { id: "SEC-MS-VM", from: "MS", to: "VM", lengthKm: 158.9, trackType: "DOUBLE", maxSpeed: 130, status: "CLEAR" },
    { id: "SEC-VM-TPJ", from: "VM", to: "TPJ", lengthKm: 177.9, trackType: "DOUBLE", maxSpeed: 130, status: "CLEAR" },
    { id: "SEC-TPJ-MDU", from: "TPJ", to: "MDU", lengthKm: 156.5, trackType: "DOUBLE", maxSpeed: 130, status: "CLEAR" },
    { id: "SEC-MDU-TEN", from: "MDU", to: "TEN", lengthKm: 156.9, trackType: "DOUBLE", maxSpeed: 130, status: "CLEAR" },
    { id: "SEC-TEN-CAPE", from: "TEN", to: "CAPE", lengthKm: 85.4, trackType: "SINGLE", maxSpeed: 110, status: "CLEAR" }
  ],

  // Detailed Timetable of Key Trains on Tamil Nadu Corridors
  trains: [
    {
      id: "20643",
      name: "Coimbatore Vande Bharat Express",
      type: "SUPERFAST",
      priority: 1,
      direction: "UP",
      stops: [
        { station: "MAS", arr: "06:10", dep: "06:10" },
        { station: "KPD", arr: "07:38", dep: "07:40" },
        { station: "JTJ", arr: "08:33", dep: "08:35" },
        { station: "SA", arr: "09:58", dep: "10:00" },
        { station: "ED", arr: "10:53", dep: "10:55" },
        { station: "TUP", arr: "11:33", dep: "11:35" },
        { station: "CBE", arr: "12:15", dep: "12:15" }
      ],
      speedKmh: 130,
      color: "#00e5ff"
    },
    {
      id: "12675",
      name: "12675 Kovai Superfast Express",
      type: "SUPERFAST",
      priority: 2,
      direction: "UP",
      stops: [
        { station: "MAS", arr: "06:50", dep: "06:50" },
        { station: "AJJ", arr: "07:48", dep: "07:50" },
        { station: "KPD", arr: "08:38", dep: "08:40" },
        { station: "JTJ", arr: "09:48", dep: "09:50" },
        { station: "SA", arr: "11:17", dep: "11:20" },
        { station: "ED", arr: "12:20", dep: "12:25" },
        { station: "TUP", arr: "13:08", dep: "13:10" },
        { station: "CBE", arr: "14:05", dep: "14:05" }
      ],
      speedKmh: 110,
      color: "#f59e0b"
    },
    {
      id: "66021",
      name: "66021 Katpadi-Jolarpettai MEMU",
      type: "PASSENGER",
      priority: 4,
      direction: "UP",
      stops: [
        { station: "KPD", arr: "11:40", dep: "11:45" },
        { station: "JTJ", arr: "13:15", dep: "13:20" }
      ],
      speedKmh: 60,
      color: "#94a3b8"
    },
    {
      id: "66022",
      name: "66022 Jolarpettai-Katpadi MEMU",
      type: "PASSENGER",
      priority: 4,
      direction: "DOWN",
      stops: [
        { station: "JTJ", arr: "10:30", dep: "10:35" },
        { station: "KPD", arr: "12:10", dep: "12:15" }
      ],
      speedKmh: 60,
      color: "#94a3b8"
    },
    {
      id: "BTPN-ENR",
      name: "BTPN Petroleum Rake Ennore-CBE",
      type: "FREIGHT",
      priority: 5,
      direction: "UP",
      stops: [
        { station: "MAS", arr: "08:15", dep: "08:25" },
        { station: "AJJ", arr: "09:40", dep: "09:45" },
        { station: "KPD", arr: "11:15", dep: "11:20" },
        { station: "JTJ", arr: "12:50", dep: "12:55" },
        { station: "SA", arr: "15:10", dep: "15:20" },
        { station: "ED", arr: "16:45", dep: "16:55" },
        { station: "CBE", arr: "18:30", dep: "18:40" }
      ],
      speedKmh: 65,
      color: "#8b5cf6"
    }
  ],

  // Departmental Maintenance Requisitions
  requisitions: [
    {
      reqId: "REQ-SR-MECH-497",
      department: "Mechanical (C&W)",
      deptCode: "MECH",
      fromStation: "KPD",
      toStation: "TUP",
      sectionName: "Katpadi Junction – Tiruppur",
      trackLine: "DOWN Main Line",
      blockType: "DOWN Line Block",
      kmRange: "KM 440.00 – KM 443.76",
      worksiteStartKm: 440.00,
      worksiteEndKm: 443.76,
      workType: "Rolling Stock & Brake Gear Examination / Wheel Profile Inspection",
      machinery: "Diagnostic Ultrasound Car + Tool Rake",
      durationMin: 90,
      urgency: "Due",
      status: "SCHEDULED",
      submittedBy: "DME (C&W, Salem Division)",
      submittedTime: "Today 07:45 IST",
      sanctionedSlot: "11:00 – 12:30 IST",
      recommendedBlock: "11:00 – 12:30 IST",
      windowType: "Preferred Window",
      lat: 11.1085,
      lng: 77.3411
    },
    {
      reqId: "REQ-SR-TRD-943",
      department: "Electrical / Traction (TRD)",
      deptCode: "TRD",
      fromStation: "CBE",
      toStation: "ED",
      sectionName: "Coimbatore Junction – Erode Junction",
      trackLine: "UP Main Line",
      blockType: "UP Line Block",
      kmRange: "KM 395.00 – KM 395.45",
      worksiteStartKm: 395.00,
      worksiteEndKm: 395.45,
      workType: "25kV Catenary Wire Tensioning & Insulator Overhaul",
      machinery: "Tower Wagon Car #14 (25kV AC)",
      durationMin: 150,
      urgency: "Urgent",
      status: "SCHEDULED",
      submittedBy: "DEE (TRD, Salem Division)",
      submittedTime: "Today 08:30 IST",
      sanctionedSlot: "11:00 – 13:30 IST (Approved Block)",
      lat: 11.1739,
      lng: 77.3365
    },
    {
      reqId: "REQ-SR-SNT-218",
      department: "Signal & Telecom (S&T)",
      deptCode: "SNT",
      fromStation: "KPD",
      toStation: "JTJ",
      sectionName: "Katpadi Junction – Jolarpettai Junction",
      trackLine: "UP Main Line (Jolarpettai Yard)",
      blockType: "UP Line Block",
      kmRange: "KM 212.00 – KM 214.00",
      worksiteStartKm: 212.0,
      worksiteEndKm: 214.0,
      workType: "Point Machine Overhaul & Dual Axle Counter Test",
      machinery: "Point Diagnostic Tool + Test Rake",
      durationMin: 120,
      urgency: "Urgent",
      status: "SCHEDULED",
      submittedBy: "Sr. DSTE (Salem Division)",
      submittedTime: "Today 09:40 IST",
      sanctionedSlot: "11:30 – 13:30 IST",
      recommendedBlock: "11:30 – 13:30 IST",
      lat: 12.5284,
      lng: 78.5776
    },
    {
      reqId: "REQ-SR-ENG-104",
      department: "Civil / Track (P-Way)",
      deptCode: "CIVIL",
      fromStation: "KPD",
      toStation: "JTJ",
      sectionName: "Katpadi Junction – Jolarpettai Junction",
      trackLine: "UP Main Line",
      blockType: "UP Line Block",
      kmRange: "KM 129.50 – KM 174.00",
      worksiteStartKm: 129.5,
      worksiteEndKm: 174.0,
      workType: "Plain Track Tamping & Track Geometry Alignment",
      machinery: "CSM 09-32 Continuous Action Tamping Machine + Ballast Regulator (BRM)",
      durationMin: 150,
      urgency: "Due",
      status: "SCHEDULED",
      submittedBy: "Sr. DEN (Civil, Chennai Division)",
      submittedTime: "Today 09:15 IST",
      sanctionedSlot: "11:30 – 14:00 IST",
      recommendedBlock: "11:30 – 14:00 IST",
      lat: 12.7509,
      lng: 78.8579
    },
    {
      reqId: "REQ-SR-TRD-309",
      department: "Electrical / Traction (TRD)",
      deptCode: "TRD",
      fromStation: "KPD",
      toStation: "JTJ",
      sectionName: "Katpadi Junction – Jolarpettai Junction",
      trackLine: "UP Main Line",
      blockType: "UP Line Block",
      kmRange: "KM 129.50 – KM 214.00",
      worksiteStartKm: 129.5,
      worksiteEndKm: 214.0,
      workType: "25kV Catenary Wire Tensioning & Insulator Overhaul",
      machinery: "Tower Wagon Car #09 (25kV AC)",
      durationMin: 135,
      urgency: "Due",
      status: "SCHEDULED",
      submittedBy: "DEE (TRD, Chennai Division)",
      submittedTime: "Today 10:05 IST",
      sanctionedSlot: "11:30 – 13:45 IST",
      recommendedBlock: "11:30 – 13:45 IST",
      lat: 12.8620,
      lng: 79.0010
    }
  ],

  /**
   * Automatically determines section KM limits from the station reference dataset.
   * Does NOT invent ranges if mapping is unavailable.
   */
  getSectionKmRange: function(fromCode, toCode) {
    if (!fromCode || !toCode) {
      return { available: false, message: "Section KM range unavailable — enter worksite KM manually" };
    }
    const from = String(fromCode).trim().toUpperCase();
    const to = String(toCode).trim().toUpperCase();
    const stFrom = this.stations.find(s => s.code === from);
    const stTo = this.stations.find(s => s.code === to);

    if (!stFrom || !stTo || typeof stFrom.km !== 'number' || typeof stTo.km !== 'number') {
      return { available: false, message: "Section KM range unavailable — enter worksite KM manually" };
    }

    const minKm = Math.min(stFrom.km, stTo.km);
    const maxKm = Math.max(stFrom.km, stTo.km);
    const span = parseFloat((maxKm - minKm).toFixed(2));

    return {
      available: true,
      fromCode: from,
      toCode: to,
      fromName: stFrom.name,
      toName: stTo.name,
      startKm: minKm,
      endKm: maxKm,
      spanKm: span,
      label: `KM ${minKm.toFixed(2)} – KM ${maxKm.toFixed(2)}`,
      note: "Automatically determined from selected section"
    };
  },

  /**
   * Retrieves corridor-specific trains, conflicts, and upcoming maintenance
   * strictly isolated to the requested section to avoid cross-corridor state leaks.
   */
  getCorridorTelemetry: function(fromCode, toCode) {
    const from = String(fromCode || 'KPD').trim().toUpperCase();
    const to = String(toCode || 'JTJ').trim().toUpperCase();
    const isCbeEd = (from === 'CBE' && to === 'ED') || (from === 'ED' && to === 'CBE');

    if (isCbeEd) {
      return {
        corridorBadge: "Southern Railway — Coimbatore–Erode corridor",
        corridorTitle: "Coimbatore Junction — Erode Junction",
        corridorSub: "Salem Division • Southern Railway jurisdiction",
        noticeText: "1 maintenance activity requires coordinated planning on Coimbatore–Erode section.",
        trainsCount: 5,
        runningTrains: [
          {
            id: "12676",
            name: "12676 Kovai Superfast Express (CBE–MAS)",
            delay: "+8 min",
            priorityTag: "Railway Board priority",
            lat: 11.18,
            lng: 77.38,
            direction: "UP",
            status: "delayed",
            speed: "92 km/h"
          },
          {
            id: "06802",
            name: "06802 CBE–ED MEMU Passenger",
            delay: "+15 min",
            priorityTag: null,
            lat: 11.12,
            lng: 77.28,
            direction: "UP",
            status: "delayed",
            speed: "55 km/h"
          },
          {
            id: "20644",
            name: "20644 Coimbatore – Chennai Vande Bharat",
            delay: "On Time",
            priorityTag: "Highest Priority",
            lat: 11.26,
            lng: 77.52,
            direction: "UP",
            status: "running",
            speed: "110 km/h"
          },
          {
            id: "12680",
            name: "12680 Coimbatore – Chennai Intercity SF",
            delay: "On Time",
            priorityTag: null,
            lat: 11.05,
            lng: 77.05,
            direction: "UP",
            status: "running",
            speed: "95 km/h"
          },
          {
            id: "13352",
            name: "13352 Alappuzha – Dhanbad Express",
            delay: "On Time",
            priorityTag: null,
            lat: 11.30,
            lng: 77.65,
            direction: "UP",
            status: "running",
            speed: "80 km/h"
          }
        ],
        delayedTrains: [
          {
            id: "12676",
            name: "12676 Kovai Superfast Express",
            delay: "+8 min",
            priorityTag: "Railway Board priority",
            lat: 11.18,
            lng: 77.38,
            direction: "UP",
            status: "delayed"
          },
          {
            id: "06802",
            name: "06802 CBE–ED MEMU Passenger",
            delay: "+15 min",
            priorityTag: null,
            lat: 11.12,
            lng: 77.28,
            direction: "UP",
            status: "delayed"
          }
        ],
        activeConflicts: [
          {
            type: "FIFO",
            typeClass: "badge-fifo",
            detail: "06802 CBE-ED MEMU vs 12676 Kovai Express (Tiruppur platform precedence)"
          },
          {
            type: "Priority override",
            typeClass: "badge-priority-override",
            detail: "12680 Intercity SF vs 20644 Vande Bharat (Erode approach priority)"
          }
        ],
        upcomingMaintenance: [
          {
            id: "REQ-SR-TRD-943",
            dept: "Electrical / TRD (CBE–ED)",
            urgency: "Urgent",
            urgencyClass: "urgency-overdue"
          }
        ]
      };
    }

    if ((from === 'KPD' && to === 'JTJ') || (from === 'JTJ' && to === 'KPD')) {
      return {
        corridorBadge: "Southern Railway — Katpadi–Jolarpettai corridor",
        corridorTitle: "Chennai Central — Coimbatore / Chennai Egmore — Madurai",
        corridorSub: "Katpadi–Jolarpettai interchange • Southern Railway jurisdiction",
        noticeText: "3 maintenance activities require coordinated planning on Katpadi–Jolarpettai section.",
        trainsCount: 5,
        runningTrains: [
          {
            id: "12675",
            name: "12675 Kovai Superfast Express",
            delay: "+12 min",
            priorityTag: "Railway Board priority",
            tagClass: "badge-board-priority",
            lat: 12.82,
            lng: 78.98,
            direction: "UP",
            status: "delayed",
            speed: "95 km/h"
          },
          {
            id: "66021",
            name: "66021 KPD-JTJ MEMU Passenger",
            delay: "+4 min",
            priorityTag: null,
            lat: 12.65,
            lng: 78.72,
            direction: "DN",
            status: "delayed",
            speed: "60 km/h"
          },
          {
            id: "BTPN-ENR",
            name: "BTPN Petroleum Rake Ennore-CBE",
            delay: "+22 min",
            priorityTag: null,
            lat: 12.92,
            lng: 79.25,
            direction: "UP",
            status: "delayed",
            speed: "45 km/h"
          },
          {
            id: "12639",
            name: "12639 Brindavan Express",
            delay: "On Time",
            priorityTag: null,
            lat: 12.88,
            lng: 79.02,
            direction: "UP",
            status: "running",
            speed: "98 km/h"
          },
          {
            id: "20643",
            name: "20643 Coimbatore Vande Bharat Express",
            delay: "On Time",
            priorityTag: "Highest Priority",
            lat: 12.72,
            lng: 78.85,
            direction: "UP",
            status: "running",
            speed: "115 km/h"
          }
        ],
        delayedTrains: [
          {
            id: "12675",
            name: "12675 Kovai Superfast Express",
            delay: "+12 min",
            priorityTag: "Railway Board priority",
            lat: 12.82,
            lng: 78.98,
            direction: "UP",
            status: "delayed"
          },
          {
            id: "66021",
            name: "66021 KPD-JTJ MEMU Passenger",
            delay: "+4 min",
            priorityTag: null,
            lat: 12.65,
            lng: 78.72,
            direction: "DN",
            status: "delayed"
          },
          {
            id: "BTPN-ENR",
            name: "BTPN Petroleum Rake Ennore-CBE",
            delay: "+22 min",
            priorityTag: null,
            lat: 12.92,
            lng: 79.25,
            direction: "UP",
            status: "delayed"
          }
        ],
        activeConflicts: [
          {
            type: "FIFO",
            typeClass: "badge-fifo",
            detail: "66021 KPD-JTJ MEMU vs 66023 AJJ-JTJ MEMU (Platform 2 Katpadi precedence)"
          },
          {
            type: "Priority override",
            typeClass: "badge-priority-override",
            detail: "66021 KPD-JTJ MEMU vs 12675 Kovai Express"
          }
        ],
        upcomingMaintenance: [
          {
            id: "MT-SR-ENG-104",
            dept: "Engineering / Track",
            urgency: "Due",
            urgencyClass: "urgency-due"
          },
          {
            id: "MT-SR-SNT-218",
            dept: "S&T",
            urgency: "Overdue",
            urgencyClass: "urgency-overdue"
          },
          {
            id: "MT-SR-TRD-309",
            dept: "Traction / OHE",
            urgency: "Due",
            urgencyClass: "urgency-due"
          }
        ]
      };
    }

    // Generic fallback for any other Tamil Nadu section
    const stFrom = this.stations.find(s => s.code === from);
    const stTo = this.stations.find(s => s.code === to);
    const fromCity = stFrom ? stFrom.name.split(" ")[0] : from;
    const toCity = stTo ? stTo.name.split(" ")[0] : to;

    return {
      corridorBadge: `Southern Railway — ${fromCity}–${toCity} corridor`,
      corridorTitle: `${stFrom ? stFrom.name : from} — ${stTo ? stTo.name : to}`,
      corridorSub: `${stFrom?.division || 'Southern Railway'} Division • SR Jurisdiction`,
      noticeText: `Maintenance block monitoring active for ${fromCity}–${toCity} section.`,
      trainsCount: 0,
      runningTrains: [],
      delayedTrains: [],
      activeConflicts: [],
      upcomingMaintenance: []
    };
  }
};

if (typeof window !== "undefined") {
  window.CorridorData = CorridorData;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = CorridorData;
}
