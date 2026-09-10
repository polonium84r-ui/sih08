/**
 * RailFlow - Prisma Database Seed Script
 * Seeds initial Southern Railway network, stations, sections, requisitions, and operational configs
 */

const { PrismaClient } = require('@prisma/client');
const corridorData = require('../src/data/corridorData');

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting RailFlow database seed on PostgreSQL...');

  // 1. Seed Stations
  console.log(`[Seed] Seeding ${corridorData.stations.length} stations...`);
  for (const stn of corridorData.stations) {
    await prisma.station.upsert({
      where: { code: stn.code },
      update: {
        name: stn.name,
        km: Number(stn.km),
        lat: Number(stn.lat),
        lng: Number(stn.lng),
        loops: Number(stn.loops || 4),
        division: stn.division || 'Chennai'
      },
      create: {
        code: stn.code,
        name: stn.name,
        km: Number(stn.km),
        lat: Number(stn.lat),
        lng: Number(stn.lng),
        loops: Number(stn.loops || 4),
        division: stn.division || 'Chennai'
      }
    });
  }

  // 2. Seed Track Sections
  console.log(`[Seed] Seeding ${corridorData.sections.length} track sections...`);
  for (const sec of corridorData.sections) {
    await prisma.trackSection.upsert({
      where: { id: sec.id },
      update: {
        fromCode: sec.from,
        toCode: sec.to,
        lengthKm: Number(sec.lengthKm),
        trackType: sec.trackType || 'DOUBLE',
        maxSpeed: Number(sec.maxSpeed || 130),
        status: sec.status || 'CLEAR'
      },
      create: {
        id: sec.id,
        fromCode: sec.from,
        toCode: sec.to,
        lengthKm: Number(sec.lengthKm),
        trackType: sec.trackType || 'DOUBLE',
        maxSpeed: Number(sec.maxSpeed || 130),
        status: sec.status || 'CLEAR'
      }
    });
  }

  // 3. Seed Departmental Requisitions
  const requisitions = corridorData.requisitions || [];
  console.log(`[Seed] Seeding ${requisitions.length} requisitions...`);
  for (const req of requisitions) {
    const id = req.reqId || req.id || req.requestId;
    await prisma.requisition.upsert({
      where: { id: id },
      update: {
        department: req.department,
        deptCode: req.deptCode || 'GEN',
        fromStation: req.fromStation,
        toStation: req.toStation,
        sectionName: req.sectionName || `${req.fromStation}-${req.toStation}`,
        trackLine: req.trackLine || 'UP Main Line',
        blockType: req.blockType || 'UP Line Block',
        worksiteStartKm: Number(req.worksiteStartKm || 0),
        worksiteEndKm: Number(req.worksiteEndKm || 0),
        kmRange: req.kmRange || '',
        workType: req.workType || 'Track Maintenance',
        workDesc: req.workDesc || req.workType || 'Maintenance',
        machinery: req.machinery || null,
        durationMin: Number(req.durationMin || 150),
        urgency: req.urgency || 'Due',
        status: req.status || 'SCHEDULED',
        submittedBy: req.submittedBy || 'Field Engineer',
        submittedTime: req.submittedTime || '09:00 IST',
        sanctionedSlot: req.sanctionedSlot || req.recommendedBlock || null,
        recommendedBlock: req.recommendedBlock || null,
        windowType: req.windowType || 'Preferred Window',
        lat: req.lat ? Number(req.lat) : null,
        lng: req.lng ? Number(req.lng) : null
      },
      create: {
        id: id,
        department: req.department,
        deptCode: req.deptCode || 'GEN',
        fromStation: req.fromStation,
        toStation: req.toStation,
        sectionName: req.sectionName || `${req.fromStation}-${req.toStation}`,
        trackLine: req.trackLine || 'UP Main Line',
        blockType: req.blockType || 'UP Line Block',
        worksiteStartKm: Number(req.worksiteStartKm || 0),
        worksiteEndKm: Number(req.worksiteEndKm || 0),
        kmRange: req.kmRange || '',
        workType: req.workType || 'Track Maintenance',
        workDesc: req.workDesc || req.workType || 'Maintenance',
        machinery: req.machinery || null,
        durationMin: Number(req.durationMin || 150),
        urgency: req.urgency || 'Due',
        status: req.status || 'SCHEDULED',
        submittedBy: req.submittedBy || 'Field Engineer',
        submittedTime: req.submittedTime || '09:00 IST',
        sanctionedSlot: req.sanctionedSlot || req.recommendedBlock || null,
        recommendedBlock: req.recommendedBlock || null,
        windowType: req.windowType || 'Preferred Window',
        lat: req.lat ? Number(req.lat) : null,
        lng: req.lng ? Number(req.lng) : null
      }
    });
  }

  // 4. Seed Operational Config
  console.log('[Seed] Seeding operational configuration...');
  await prisma.operationalConfig.upsert({
    where: { id: 1 },
    update: {
      maxSpeedKmH: 130,
      headwayMinutes: 12,
      cautionSpeedKmH: 30
    },
    create: {
      id: 1,
      maxSpeedKmH: 130,
      headwayMinutes: 12,
      cautionSpeedKmH: 30
    }
  });

  // 5. Seed Audit Logs
  console.log('[Seed] Seeding initial audit logs...');
  const initialLogs = [
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
  ];

  for (const log of initialLogs) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: {
        timestamp: log.timestamp,
        user: log.user,
        action: log.action,
        details: log.details
      },
      create: {
        id: log.id,
        timestamp: log.timestamp,
        user: log.user,
        action: log.action,
        details: log.details
      }
    });
  }

  console.log('[Seed] RailFlow database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
