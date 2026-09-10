/**
 * Central Reactive State Store for RailFlow Frontend
 * Single source of truth for corridor, requisitions, recommendations, and config.
 */

import corridorData from '../data/corridorData.js';
import apiClient from '../api/client.js';

class CorridorStore {
  constructor() {
    this.listeners = new Set();

    // Database & System Connection State
    this.dbStatus = {
      connected: false,
      mode: 'Connecting...',
      lastChecked: null
    };

    // Stations & Sections (populated dynamically from DB)
    this.stations = JSON.parse(JSON.stringify(corridorData.stations || []));
    this.sections = JSON.parse(JSON.stringify(corridorData.sections || []));

    // Active Corridor State
    this.activeCorridor = {
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

    // Requisitions List
    this.requisitions = JSON.parse(JSON.stringify(corridorData.requisitions || []));

    // Prototype / Operational Configuration
    this.config = {
      maxSpeedKmH: 130,
      headwayMinutes: 12,
      cautionSpeedKmH: 30
    };

    // Current Recommendation from Optimizer
    this.currentRecommendation = null;
    this.currentCorridorData = null;

    // Filter mode for activity register ('active' or 'all')
    this.registerFilter = 'active';

    // Decision History Logs & Audit Trail
    this.decisionLogs = [
      {
        time: "10:15 IST",
        reqId: "REQ-SR-ENG-104",
        dept: "Civil / Track (P-Way)",
        corridor: "Katpadi – Jolarpettai",
        requestedWindow: "11:00 – 14:30 IST",
        duration: "150 min",
        selectedWindow: "11:30 – 14:00 IST",
        conflictsConsidered: "3 trains (12675 Kovai, 66021 MEMU, 20643 VB)",
        status: "Auto-Scheduled (Feasible)",
        dataSource: "PostgreSQL Database"
      }
    ];
    this.auditLogs = [];
  }

  /**
   * Initializes store with live data from PostgreSQL database via backend API
   */
  async initFromBackend() {
    try {
      const health = await apiClient.checkHealth();
      const isOnline = health && health.status === 'UP';

      if (isOnline) {
        this.dbStatus = {
          connected: true,
          mode: 'PostgreSQL (railflow_db)',
          lastChecked: new Date()
        };

        // 1. Fetch live requisitions from PostgreSQL
        try {
          const reqRes = await apiClient.getRequisitions();
          if (reqRes && reqRes.success && Array.isArray(reqRes.requisitions) && reqRes.requisitions.length > 0) {
            this.requisitions = reqRes.requisitions.map(r => ({
              ...r,
              reqId: r.reqId || r.id,
              requestId: r.requestId || r.id,
              kmRange: r.kmRange || `KM ${r.worksiteStartKm?.toFixed(2) || '0.00'} – KM ${r.worksiteEndKm?.toFixed(2) || '0.00'}`
            }));
            this.notify('REQUISITIONS_UPDATED', this.requisitions);
          }
        } catch (e) {
          console.warn('[CorridorStore] Could not load requisitions from DB:', e.message);
        }

        // 2. Fetch live stations from PostgreSQL
        try {
          const stnRes = await apiClient.getStations();
          if (stnRes && stnRes.success && Array.isArray(stnRes.stations) && stnRes.stations.length > 0) {
            this.stations = stnRes.stations;
            this.notify('STATIONS_UPDATED', this.stations);
          }
        } catch (e) {
          console.warn('[CorridorStore] Could not load stations from DB:', e.message);
        }

        // 3. Fetch operational config from PostgreSQL
        try {
          const cfgRes = await apiClient.getConfig();
          if (cfgRes && cfgRes.success && cfgRes.config) {
            this.config = { ...this.config, ...cfgRes.config };
            this.notify('CONFIG_UPDATED', this.config);
          }
        } catch (e) {
          console.warn('[CorridorStore] Could not load config from DB:', e.message);
        }

        // 4. Fetch audit logs from PostgreSQL
        try {
          const auditRes = await apiClient.getAuditLogs();
          if (auditRes && auditRes.success && Array.isArray(auditRes.logs)) {
            this.auditLogs = auditRes.logs;
            this.notify('AUDIT_LOGS_UPDATED', this.auditLogs);
          }
        } catch (e) {
          console.warn('[CorridorStore] Could not load audit logs from DB:', e.message);
        }

      } else {
        this.dbStatus = {
          connected: false,
          mode: 'Offline / In-Memory Mock Fallback',
          lastChecked: new Date()
        };
      }
    } catch (err) {
      console.warn('[CorridorStore] Backend initialization fallback:', err.message);
      this.dbStatus = {
        connected: false,
        mode: 'Offline / In-Memory Mock Fallback',
        lastChecked: new Date()
      };
    }

    this.notify('DB_STATUS_CHANGED', this.dbStatus);
    this.notify('STORE_INITIALIZED', this);
    return this.dbStatus;
  }

  // Subscribe to state changes
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changeType, payload) {
    for (const listener of this.listeners) {
      try {
        listener(changeType, payload, this);
      } catch (err) {
        console.error('[CorridorStore] Listener error:', err);
      }
    }
  }

  // Set Active Corridor
  setActiveCorridor(corridorState) {
    this.activeCorridor = {
      ...this.activeCorridor,
      ...corridorState
    };
    this.notify('ACTIVE_CORRIDOR_CHANGED', this.activeCorridor);
  }

  // Set Current Recommendation
  setRecommendation(recommendation, corridorData) {
    this.currentRecommendation = recommendation;
    this.currentCorridorData = corridorData;
    this.notify('RECOMMENDATION_UPDATED', { recommendation, corridorData });
  }

  // Add or Update Requisition
  saveRequisition(req) {
    const idx = this.requisitions.findIndex(r => r.reqId === req.reqId);
    if (idx >= 0) {
      this.requisitions[idx] = { ...this.requisitions[idx], ...req };
    } else {
      this.requisitions.unshift(req);
    }
    this.notify('REQUISITIONS_UPDATED', this.requisitions);
  }

  // Record a decision in history
  logDecision(entry) {
    this.decisionLogs.unshift({
      time: entry.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST',
      reqId: entry.reqId || '--',
      dept: entry.dept || 'Engineering',
      corridor: entry.corridor || 'Corridor',
      requestedWindow: entry.requestedWindow || '--',
      duration: entry.duration || '--',
      selectedWindow: entry.selectedWindow || '--',
      conflictsConsidered: entry.conflictsConsidered || 'None',
      status: entry.status || 'SCHEDULED',
      dataSource: entry.dataSource || 'Demo/Mock Data'
    });
    this.notify('DECISION_LOG_UPDATED', this.decisionLogs);
  }

  // Update Config
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.notify('CONFIG_UPDATED', this.config);
  }

  setRegisterFilter(filter) {
    this.registerFilter = filter;
    this.notify('FILTER_CHANGED', filter);
  }
}

export const store = new CorridorStore();
export default store;
