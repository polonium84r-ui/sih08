# RailFlow: Smarter Railway Maintenance Block Planning

> **Southern Railway (SR) Decision Support System & Smart India Hackathon Prototype**  
> *Corridor: Southern Railway &bull; Chennai / Salem / Tiruchirappalli / Madurai Divisions (Katpadi Junction &ndash; Jolarpettai Junction)*

---

## 🚂 Executive Overview

**RailFlow** is an intelligent operational decision-support system designed to solve the chronic bottleneck in railway corridor maintenance scheduling across Indian Railways.

In traditional railway operations, maintenance planning is fragmented across separate departments:
1. **Civil Engineering (Track / P-Way):** Plain track tamping & track geometry alignment (CSM 09-32 + BRM), deep ballast screening (BCM RM-80), turnout overhaul (`MT-SR-ENG-104`).
2. **Signal & Telecommunication (S&T):** Point machine overhaul, electronic interlocking tests, dual axle counter calibration (`MT-SR-SNT-218`).
3. **Electrical (TRD / OHE):** 25kV catenary tensioning, insulator maintenance, Power Block isolation permit (`MT-SR-TRD-309`).

Because each department schedules maintenance independently without shared corridor visibility, tracks undergo repeated closures. This causes severe downstream **delay cascades** for passenger and freight trains.

RailFlow integrates corridor network modeling, conflict detection, delay cascade simulation, and explainable AI to recommend coordinated **Mega-Blocks** that bundle multi-department activities into optimal shadow windows.

---

## 🎯 Tamil Nadu Network Case Study: Katpadi – Jolarpettai (S-KPD-JTJ)

In the Southern Railway **Katpadi Junction &ndash; Jolarpettai Junction (UP Mainline, KM 129.5 &ndash; 214.0)** corridor:

| Metric | Traditional Manual Planning | RailFlow Coordinated Mega-Block | Net Improvement |
| :--- | :--- | :--- | :--- |
| **Total Closures** | **3 Separate Closures** | **1 Coordinated Block** | **-66% closures** |
| **Total Delay Propagation** | **52 Minutes** | **14 Minutes** | **-73% delay reduction** |
| **Priority Conflicts** | **2 Conflicts** *(Vande Bharat / Kovai SF)* | **0 Conflicts** *(100% Protected)* | **Zero priority disruption** |
| **Corridor Punctuality** | **-17.8% drop** | **-1.9% (negligible)** | **+15.9% punctuality retained** |
| **Inter-Department Efficiency**| **31%** | **95%** | **Seamless co-location** |

---

## 🖥️ Screen-by-Screen Architecture

### 1. Operations Console (`Operations` Tab)
* **Tamil Nadu Railway Network Map (Leaflet / OpenStreetMap):**
  * Spans the complete authentic Southern Railway network in Tamil Nadu:
    * **Trunk Line 1:** Chennai Central &rarr; Arakkonam &rarr; Katpadi &rarr; Jolarpettai &rarr; Morappur &rarr; Salem &rarr; Erode &rarr; Tiruppur &rarr; Coimbatore.
    * **Trunk Line 2:** Chennai Egmore &rarr; Tambaram &rarr; Chengalpattu &rarr; Tindivanam &rarr; Villupuram &rarr; Vriddhachalam &rarr; Tiruchirappalli &rarr; Dindigul &rarr; Madurai &rarr; Virudhunagar &rarr; Tirunelveli &rarr; Kanniyakumari.
    * **Connecting Lines:** Erode &rarr; Karur &rarr; Trichy, Coimbatore &rarr; Pollachi &rarr; Palani &rarr; Dindigul, Salem &rarr; Vriddhachalam, Katpadi &rarr; Tiruvannamalai &rarr; Villupuram, Madurai &rarr; Rameswaram.
  * Features the highlighted red dashed proposed block on `Katpadi Junction — Jolarpettai Junction`.
  * Directional train markers (green/red triangles) representing live trains (Vande Bharat, Kovai SF, Vaigai SF, Pandian SF, MEMUs, and Freight rakes).
  * Layer control box (`Trains`, `Proposed block`, `Speed restriction`, `Conflicts`).
  * Bottom-left corridor badge: `Southern Railway (SR) • Chennai / Salem / TPJ / Madurai Divisions`.
* **Right Telemetry Sidebar:**
  * Blue callout: *"3 maintenance activities require coordinated planning on Katpadi–Jolarpettai section."*
  * Status sections: `CORRIDOR STATUS`, `RUNNING TRAINS` (5), `DELAYED TRAINS` (Kovai SF +10 min, Vaigai SF +6 min, BTPN Oil Rake +18 min), `ACTIVE CONFLICTS` (FIFO & Priority override), `UPCOMING MAINTENANCE` (Civil Due, S&T Overdue, TRD Due).
  * Clicking any delayed train automatically centers and zooms the map onto that train.

### 2. Maintenance Block Planner Register (`Block Planner` Tab)
* **Header:** `Maintenance Block Planner` &bull; `Section: Katpadi–Jolarpettai · 24 Aug 2026 · 3 activities pending`.
* **Filter Bar:** `Monthly` | `Weekly` (active navy pill) | `Operational`.
* **Activity Register Table:**
  * `MT-SR-ENG-104` (Periodic, 2.5h, Due, CSM 09-32 continuous tamping machine + BRM).
  * `MT-SR-SNT-218` (Defective, 2.0h, Overdue, Point machine overhaul & axle counter test).
  * `MT-SR-TRD-309` (Preventive, 2.25h, Due, 25kV OHE catenary tensioning).
  * Green compatibility tags showing all 3 tasks can be safely bundled.
  * `[View Details]` button opens task details modal with machinery and manpower allocations.

### 3. Candidate Block Windows
* 3 candidate options:
  * **Option A (08:30–11:00 IST):** 5 trains affected, 58 delay-mins, 2 priority trains affected, 2 conflicts, overall impact: High.
  * **Option B (11:30–14:00 IST) [Recommended Coordinated Block]:**
    * Top green banner: `LOWEST OPERATIONAL IMPACT — RECOMMENDED FOR COORDINATED BLOCK`.
    * 3 trains affected, 14 delay-mins, None priority affected, 1 conflict, overall impact: Lower.
  * **Option C (14:30–17:00 IST):**
    * Badges: `[Temporary Speed Restriction Required]` &amp; `[Not preferred]`.
    * 4 trains affected, 36 delay-mins, TSR: `Required — last resort`.

### 4. Side-by-Side Comparison & Recommendation
* 10-row side-by-side comparison matrix with **Option B column shaded light green**.
* **RailFlow Assessment Callout Box:** Green callout explaining coordinated completion without TSR, and all tags (`[Combined block]`, `[FIFO preserved on C-FIFO-01]`, `[Railway Board list applied on C-BOARD-01]`, `[No Temporary Speed Restriction]`, `[Confidence: HIGH]`, `[Last sync 28s ago]`).
* Decision buttons: `[Approve Recommendation]`, `[Choose Alternative]`, `[Reject]`, `[View Impact Analysis]`, `[Coordination & History]`.

### 5. Impact Analysis View
* **Operational Timeline:**
  * `13:30 IST`: `66023 AJJ-JTJ MEMU path adjusted` (Held +4 min on loop line).
  * `14:00 IST`: `Block ends` (Section restored. Total estimated delay: 14 min.)
* **Affected Trains Card:**
  * `66021 MMC-KPD MEMU`: +5 min delay, +1 downstream.
  * `66023 AJJ-JTJ MEMU`: +4 min delay, +1 downstream.
  * `BTPN Oil Tanker Rake`: +5 min delay.
* **Related Conflicts Card:**
  * `[FIFO]` `66021 MMC-KPD MEMU vs 66023 AJJ-JTJ MEMU` with `[View Conflict]` modal.
* **Mini Map & Summary:** Leaflet map zoomed in on Katpadi &ndash; Jolarpettai with Option B summary card.

### 6. Confirm Block Approval Modal
* Advisory disclaimer modal:
  *"This records your planning decision in the RailFlow decision log. RailFlow is advisory — it does not set signals, book official blocks, or write to the Control Office Application."*
* Approving summary: Block W-B (11:30–14:00 IST), Tasks `MT-SR-ENG-104`, `MT-SR-SNT-218`, `MT-SR-TRD-309`, Impact: 3 trains, 14 estimated delay-minutes.

### 7. Coordination & Decision History Dashboard (`Coordination` Tab)
* Top-right green status pill: `Block approved · 11:30–14:00`.
* **4 Metric KPI Cards:**
  1. `Maintenance Tasks`: **3** (`on section today`).
  2. `Blocks Planned / Combined`: **1 / 1** (`11:30–14:00 IST`).
  3. `Controller Decisions`: **1** (`1 accepted · 0 modified · 0 rejected`).
  4. `Approved Block Impact`: **14 min** (`estimated delay`).
* **Decision History Table:** Timestamp, tasks, candidates, recommended (`W-B`), reason, controller decision (`Approved`), status (`Approved — advisory record logged`), and `[View Details]` button which opens the official printable Indian Railways Block Sanction Memo for Southern Railway.

### 8. System & Rule Configuration (`Configuration` Tab)
* Operational parameters (Maximum Line Speed, Minimum Headway, Caution Order Speed, Departmental Prioritisation) and safety rule configuration with audit logging.

---

## 🚀 How to Run Locally

### Option 1: Using Node.js
```bash
npm start
# Server starts at http://localhost:3000
```

### Option 2: Using Python
```bash
python -m http.server 8080 --directory d:\clone
# Open http://localhost:8080
```

### Option 3: Direct Browser Launch
Double-click or open [d:/clone/index.html](file:///d:/clone/index.html) in any modern browser (Chrome, Edge, Firefox).

---

## 🛰️ Real-Time RailRadar Integration & Architecture

RailFlow integrates live railway telemetry from **RailRadar** (`https://api.railradar.in/v1`) using a secure backend service layer:

1. **Trains Between Stations API (`GET /v1/trains/between/{from}/{to}`)**:
   - Dynamically discovers active trains traversing the selected corridor (e.g. Katpadi `KPD` &rarr; Jolarpettai `JTJ`).
   - No hardcoded train numbers.
2. **Train Schedule & Timetable API (`GET /v1/trains/{number}`)**:
   - Retrieves full station timetable, halts, and scheduled corridor traversal.
3. **Live Train Running Status API (`GET /v1/trains/{number}/live`)**:
   - Retrieves real-time delay minutes and current GPS/station location.
4. **Worksite Passage Time Calculation**:
   - Estimates entry and exit times of each train through the specific maintenance worksite KM range (e.g. KM 150.20 – 153.50).
5. **Configurable Operational & Safety Rules**:
   - **UP Line Block**: Evaluates UP-line conflicts.
   - **Adjacent DOWN Line**: Flagged as *"Subject to operational/safety restrictions"*.
   - **25kV Traction Power Block**: Dynamically required only when the selected activity requires OHE isolation (TRD catenary/tower wagon), not for plain track tamping.
6. **Block Recommendation Engine**:
   - Status: `"RECOMMENDED – PENDING CONTROLLER APPROVAL"` (advisory only; block authorization remains strictly with Chief Section Controller).
   - Searches for continuous block within the preferred window first. If conflicts occur, automatically finds and recommends the next best feasible window with complete conflict explanation.

### Environment Configuration:
Create a `.env` file in the root directory (optional):
```env
RAILRADAR_API_KEY=your_railradar_api_token_here
PORT=3000
```
*(If no API key is set, the system gracefully falls back to `"Demo/Mock Data"` with clear UI indicators).*

---

## 📁 Project Structure

```
d:/clone/
├── index.html               # Main Command Center interface (4 Enterprise Tabs)
├── package.json             # NPM package specification & start script
├── server.js                # Node.js HTTP server integrating RailRadar REST endpoints
├── README.md                # Documentation & Southern Railway corridor mapping
├── css/
│   ├── main.css             # Enterprise light-slate railway theme tokens & Operations layout
│   └── components.css       # Register, candidate cards, comparison table, modals & KPI cards
├── js/
│   ├── app.js               # Coordinator, Leaflet maps, live KM validation & block planning UI
│   ├── corridor_data.js     # Tamil Nadu network stations, coordinates, timetables & tasks
│   ├── conflict_engine.js   # Spatial, temporal, adjacent line & power interlocks
│   ├── cascade_simulator.js # Delay cascade propagation physics & headway domino engine
│   ├── recommender.js       # Multi-candidate window generation & explainable scoring
│   └── audit_logger.js      # Official Block Sanction Order generator & audit logger
└── server/
    └── services/
        ├── railRadarService.js        # HTTPS client for https://api.railradar.in/v1 with Bearer auth & rate-limit handling
        ├── trainDataService.js        # Corridor train discovery, timetable, live telemetry & worksite KM validation
        ├── conflictDetectionService.js# Configurable safety rules, UP/DOWN line isolation & OHE checks
        └── blockOptimizationService.js # Proximity-based continuous block search & recommendation engine
```
