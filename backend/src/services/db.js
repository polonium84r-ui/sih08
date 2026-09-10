/**
 * RailFlow - Unified Database Service Layer
 * Supports PostgreSQL via Prisma ORM with resilient In-Memory seed fallback
 */

const { PrismaClient } = require('@prisma/client');
const corridorData = require('../data/corridorData');
const config = require('../config');

let prisma = null;
let isConnected = false;

try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  });
} catch (err) {
  console.warn('[Database] Prisma Client initialization deferred:', err.message);
}

// In-memory state for resilient fallback and zero-latency caching
const inMemoryStore = {
  stations: JSON.parse(JSON.stringify(corridorData.stations || [])),
  sections: JSON.parse(JSON.stringify(corridorData.sections || [])),
  requisitions: JSON.parse(JSON.stringify(corridorData.requisitions || [])),
  operationalConfig: {
    maxSpeedKmH: config.operationalDefaults.maxSpeedKmH || 130,
    headwayMinutes: config.operationalDefaults.headwayMinutes || 12,
    cautionSpeedKmH: config.operationalDefaults.cautionSpeedKmH || 30
  },
  auditLogs: [
    {
      id: "LOG-1001",
      timestamp: "09:15:20",
      user: "Sr. Divisional Engineer (Civil - Chennai)",
      action: "SUBMIT_REQUEST",
      details: "Submitted MT-SR-ENG-104: Plain track tamping & track geometry alignment Katpadi-Jolarpettai (150 mins required)"
    },
    {
      id: "LOG-1002",
      timestamp: "09:40:12",
      user: "Sr. Divisional Signal Telecom Engineer (S&T - Salem)",
      action: "SUBMIT_REQUEST",
      details: "Submitted MT-SR-SNT-218: Point machine overhaul & axle counter test Jolarpettai yard (120 mins required)"
    },
    {
      id: "LOG-1003",
      timestamp: "10:05:45",
      user: "Divisional Electrical Engineer (TRD - Chennai)",
      action: "SUBMIT_REQUEST",
      details: "Submitted MT-SR-TRD-309: 25kV OHE catenary tensioning & isolator maintenance (135 mins required)"
    },
    {
      id: "LOG-1004",
      timestamp: "10:15:00",
      user: "RailFlow AI Optimization Engine",
      action: "CONFLICT_AND_BUNDLE",
      details: "Spatial-temporal compatibility detected. Bundled 3 Southern Railway requests into 1 coordinated mega-block window (11:30 - 14:00)."
    }
  ],
  decisions: []
};

class DatabaseService {
  /**
   * Proactively verifies PostgreSQL connectivity via Prisma
   */
  async checkConnection() {
    if (!prisma) {
      isConnected = false;
      return false;
    }
    try {
      await prisma.$queryRaw`SELECT 1`;
      isConnected = true;
      console.log('[Database] Connected to PostgreSQL via Prisma ORM.');
      return true;
    } catch (err) {
      isConnected = false;
      console.log('[Database] PostgreSQL not connected. Operating in resilient In-Memory fallback mode.');
      return false;
    }
  }

  isDatabaseConnected() {
    return isConnected;
  }

  getPrisma() {
    return prisma;
  }

  // ================= STATIONS =================
  async getStations() {
    if (isConnected && prisma) {
      try {
        const rows = await prisma.station.findMany({ orderBy: { km: 'asc' } });
        if (rows && rows.length > 0) return rows;
      } catch (e) {
        console.warn('[Database] Error fetching stations from DB, using fallback:', e.message);
      }
    }
    return inMemoryStore.stations;
  }

  // ================= SECTIONS =================
  async getSections() {
    if (isConnected && prisma) {
      try {
        const rows = await prisma.trackSection.findMany();
        if (rows && rows.length > 0) return rows;
      } catch (e) {
        console.warn('[Database] Error fetching sections from DB, using fallback:', e.message);
      }
    }
    return inMemoryStore.sections;
  }

  // ================= REQUISITIONS =================
  async getRequisitions(corridorFilter = null) {
    if (isConnected && prisma) {
      try {
        let where = {};
        if (corridorFilter) {
          const c = corridorFilter.toUpperCase();
          where = {
            OR: [
              { sectionName: { contains: c, mode: 'insensitive' } },
              { fromStation: { equals: c, mode: 'insensitive' } },
              { toStation: { equals: c, mode: 'insensitive' } }
            ]
          };
        }
        const rows = await prisma.requisition.findMany({
          where,
          orderBy: { createdAt: 'desc' }
        });
        if (rows) {
          return rows.map(r => ({
            ...r,
            reqId: r.id,
            requestId: r.id
          }));
        }
      } catch (e) {
        console.warn('[Database] Error querying requisitions, using fallback:', e.message);
      }
    }

    let list = inMemoryStore.requisitions;
    if (corridorFilter) {
      const c = corridorFilter.toUpperCase();
      list = list.filter(r => (r.sectionName && r.sectionName.toUpperCase().includes(c)) || (r.fromStation === c) || (r.toStation === c));
    }
    return list;
  }

  async getRequisitionById(id) {
    if (isConnected && prisma) {
      try {
        const item = await prisma.requisition.findUnique({ where: { id } });
        if (item) {
          return { ...item, reqId: item.id, requestId: item.id };
        }
      } catch (e) {
        console.warn('[Database] Error fetching requisition by ID, using fallback:', e.message);
      }
    }
    return inMemoryStore.requisitions.find(r => r.reqId === id || r.requestId === id || r.id === id) || null;
  }

  async createRequisition(data) {
    const id = data.reqId || data.requestId || `REQ-SR-${data.deptCode || 'GEN'}-${Math.floor(100 + Math.random() * 900)}`;
    const newReq = {
      ...data,
      id: id,
      reqId: id,
      requestId: id,
      submittedTime: data.submittedTime || (new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'),
      status: data.status || 'SCHEDULED'
    };

    inMemoryStore.requisitions.unshift(newReq);

    if (isConnected && prisma) {
      try {
        const created = await prisma.requisition.create({
          data: {
            id: id,
            department: newReq.department,
            deptCode: newReq.deptCode || 'GEN',
            fromStation: newReq.fromStation,
            toStation: newReq.toStation,
            sectionName: newReq.sectionName || `${newReq.fromStation}-${newReq.toStation}`,
            trackLine: newReq.trackLine || 'UP Main Line',
            blockType: newReq.blockType || 'UP Line Block',
            worksiteStartKm: Number(newReq.worksiteStartKm || 0),
            worksiteEndKm: Number(newReq.worksiteEndKm || 0),
            kmRange: newReq.kmRange || '',
            workType: newReq.workType || 'Track Maintenance',
            workDesc: newReq.workDesc || newReq.workType || 'Maintenance',
            machinery: newReq.machinery || null,
            durationMin: Number(newReq.durationMin || 150),
            urgency: newReq.urgency || 'Due',
            status: newReq.status || 'SCHEDULED',
            submittedBy: newReq.submittedBy || 'Field Engineer',
            submittedTime: newReq.submittedTime,
            sanctionedSlot: newReq.sanctionedSlot || newReq.recommendedBlock || null,
            recommendedBlock: newReq.recommendedBlock || null,
            windowType: newReq.windowType || 'Preferred Window',
            lat: newReq.lat ? Number(newReq.lat) : null,
            lng: newReq.lng ? Number(newReq.lng) : null
          }
        });
        return { ...created, reqId: created.id, requestId: created.id };
      } catch (e) {
        console.warn('[Database] Failed to persist requisition to PostgreSQL:', e.message);
      }
    }

    return newReq;
  }

  // ================= OPERATIONAL CONFIG =================
  async getConfig() {
    if (isConnected && prisma) {
      try {
        const cfg = await prisma.operationalConfig.findFirst({ where: { id: 1 } });
        if (cfg) {
          return {
            maxSpeedKmH: cfg.maxSpeedKmH,
            headwayMinutes: cfg.headwayMinutes,
            cautionSpeedKmH: cfg.cautionSpeedKmH
          };
        }
      } catch (e) {
        console.warn('[Database] Error fetching config from DB, using fallback:', e.message);
      }
    }
    return inMemoryStore.operationalConfig;
  }

  async updateConfig(updates) {
    const { maxSpeedKmH, headwayMinutes, cautionSpeedKmH } = updates || {};
    if (maxSpeedKmH !== undefined) inMemoryStore.operationalConfig.maxSpeedKmH = Number(maxSpeedKmH);
    if (headwayMinutes !== undefined) inMemoryStore.operationalConfig.headwayMinutes = Number(headwayMinutes);
    if (cautionSpeedKmH !== undefined) inMemoryStore.operationalConfig.cautionSpeedKmH = Number(cautionSpeedKmH);

    if (isConnected && prisma) {
      try {
        await prisma.operationalConfig.upsert({
          where: { id: 1 },
          update: {
            maxSpeedKmH: inMemoryStore.operationalConfig.maxSpeedKmH,
            headwayMinutes: inMemoryStore.operationalConfig.headwayMinutes,
            cautionSpeedKmH: inMemoryStore.operationalConfig.cautionSpeedKmH
          },
          create: {
            id: 1,
            maxSpeedKmH: inMemoryStore.operationalConfig.maxSpeedKmH,
            headwayMinutes: inMemoryStore.operationalConfig.headwayMinutes,
            cautionSpeedKmH: inMemoryStore.operationalConfig.cautionSpeedKmH
          }
        });
      } catch (e) {
        console.warn('[Database] Error updating operationalConfig in DB:', e.message);
      }
    }

    return inMemoryStore.operationalConfig;
  }

  // ================= AUDIT LOGS =================
  async getAuditLogs() {
    if (isConnected && prisma) {
      try {
        const rows = await prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50
        });
        if (rows && rows.length > 0) return rows;
      } catch (e) {
        console.warn('[Database] Error fetching audit logs from DB:', e.message);
      }
    }
    return inMemoryStore.auditLogs;
  }

  async logAudit(action, user, details) {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    const logId = `LOG-${Date.now().toString().slice(-4)}`;

    const logEntry = {
      id: logId,
      timestamp: timeStr,
      user: user || 'RailFlow Controller',
      action: action,
      details: details
    };

    inMemoryStore.auditLogs.unshift(logEntry);

    if (isConnected && prisma) {
      try {
        await prisma.auditLog.create({
          data: {
            id: logId,
            timestamp: timeStr,
            user: logEntry.user,
            action: action,
            details: details
          }
        });
      } catch (e) {
        console.warn('[Database] Failed to persist audit log:', e.message);
      }
    }

    return logEntry;
  }

  // ================= BLOCK DECISIONS =================
  async logBlockDecision(decisionData) {
    inMemoryStore.decisions.unshift(decisionData);

    if (isConnected && prisma) {
      try {
        await prisma.blockDecision.create({
          data: {
            time: decisionData.time || new Date().toISOString(),
            reqId: decisionData.reqId || null,
            department: decisionData.department || null,
            corridor: decisionData.corridor || null,
            requestedWindow: decisionData.requestedWindow || null,
            durationMin: decisionData.durationMin ? Number(decisionData.durationMin) : null,
            selectedWindow: decisionData.selectedWindow || null,
            conflictsConsidered: typeof decisionData.conflictsConsidered === 'object'
              ? JSON.stringify(decisionData.conflictsConsidered)
              : String(decisionData.conflictsConsidered || ''),
            status: decisionData.status || 'SANCTIONED',
            dataSource: decisionData.dataSource || 'RailFlow Engine'
          }
        });
      } catch (e) {
        console.warn('[Database] Failed to log block decision to DB:', e.message);
      }
    }
  }
}

module.exports = new DatabaseService();
