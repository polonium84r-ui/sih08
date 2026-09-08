/**
 * RailFlow - Official Sanction Memo & Audit Logger
 * Generates standardized Indian Railways Block Sanction Memos and maintains decision audit logs.
 */

class AuditLogger {
  constructor() {
    this.logs = [
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
  }

  logAction(action, user, details) {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    const newLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: timeStr,
      user: user,
      action: action,
      details: details
    };
    this.logs.unshift(newLog);
    return newLog;
  }

  getLogs() {
    return this.logs;
  }

  /**
   * Generates a formal Indian Railways Line Block & Power Block Sanction Memo
   */
  generateSanctionMemo(candidate, controllerName = "Shri K. Ramanathan (Chief Section Controller, Chennai/Salem)") {
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
    const orderNo = `IR/SR/MAS-SA/BLOCK/2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const authHash = "RF-SR-" + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join("");

    return {
      orderNo: orderNo,
      date: dateStr,
      division: "Chennai & Salem Divisions, Southern Railway",
      controller: controllerName,
      section: "Katpadi Junction (KPD) - Jolarpettai Junction (JTJ)",
      track: "UP Main Line (Section KM 129.500 to KM 214.000)",
      kmRange: "KM 129.500 to KM 214.000",
      timeStart: candidate ? candidate.window?.split("–")[0]?.trim() || "11:30" : "11:30",
      timeEnd: candidate ? candidate.window?.split("–")[1]?.split(" ")[0]?.trim() || "14:00" : "14:00",
      durationMin: 150,
      bundledDepartments: [
        { dept: "Civil / Track", task: "Plain track tamping & geometry alignment with CSM 09-32 + BRM (MT-SR-ENG-104)" },
        { dept: "Signal & Telecom (S&T)", task: "Point machine overhaul & dual axle counter calibration (MT-SR-SNT-218)" },
        { dept: "Electrical (TRD / OHE)", task: "25kV catenary tensioning & Power Block isolation permit (MT-SR-TRD-309)" }
      ],
      safetyConditions: [
        "1. Power block sanctioned: TRD staff to confirm 25kV OHE isolation and fix earth discharge rods before track machine enters.",
        "2. Speed restriction of 30 km/h Caution Order enforced on adjacent DOWN line during ballast tamping.",
        "3. Banner flags & detonators placed at 600m and 1200m on UP line as per General & Subsidiary Rules (G&SR 15.09).",
        "4. Train 20643 Vande Bharat running on scheduled priority path; 66023 MEMU regulated at Katpadi loop line."
      ],
      authHash: authHash,
      coordinationSaving: "Consolidated 3 departmental line closures into 1 single coordinated mega-block, saving 52 minutes of passenger network delay."
    };
  }
}

if (typeof window !== "undefined") {
  window.AuditLogger = AuditLogger;
}
