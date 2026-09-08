# RailFlow: Intelligent Railway Maintenance Block Planning & Optimization

> **Southern Railway (SR) Operational Decision Support System & Smart India Hackathon Prototype**  
> *Corridor Network: Southern Railway • Chennai, Salem, Tiruchirappalli & Madurai Divisions*

---

## 🚂 Executive Overview

**RailFlow** is an intelligent operational decision-support system designed to resolve maintenance scheduling bottlenecks across Indian Railways.

Traditional maintenance planning is fragmented across independent departments:
1. **Civil Engineering (Track / P-Way):** Plain track tamping, track geometry alignment, deep ballast screening, turnout maintenance.
2. **Signal & Telecommunication (S&T):** Point machine overhaul, electronic interlocking testing, dual axle counter calibration.
3. **Electrical (TRD / OHE):** 25kV catenary wire tensioning, insulator wash, OHE isolation permits.

Because departments submit maintenance requests independently without unified corridor traffic awareness, tracks undergo repeated possessions. This triggers severe downstream **delay cascades** for passenger and freight traffic.

RailFlow introduces a **Single Source of Truth** architecture powered by an **Automatic Block Optimizer**, real-time conflict detection, timetable-aware gap analysis, and corridor isolation.

---

## ⚡ Core Workflow: Automatic Block Optimizer

RailFlow eliminates manual, disconnected scheduling steps in favor of a fully automated, continuous optimization workflow:

```
Submit Block Requisition
        ↓
Block Optimizer runs automatically
        ↓
Check requested Preferred Maintenance Window
        ↓
If feasible   → select best continuous block inside preferred window
If not feasible → analyze conflicts → search alternative windows
        ↓
Rank feasible alternatives (Safety → Full Duration → Min Deviation → Earliest Slot)
        ↓
Automatically assign/schedule the optimized slot
        ↓
Synchronize Single Source of Truth Across All Views:
┌─────────────────────────────────────────────────────────────┐
│ Active Requisitions • Leaflet Map • Operations Dashboard    │
│ Block Planner Register • Coordination Log • Timetable Card  │
└─────────────────────────────────────────────────────────────┘
```

- **Feasible Slot:** Status is assigned as `SCHEDULED (OPTIMIZED)` with the exact continuous time window.
- **Infeasible Slot:** Status is set to `UNSCHEDULED (NO FEASIBLE BLOCK)` with clear train conflict explanations.
- **No Manual Step:** No manual "Schedule Work Slot" button is required for newly submitted requisitions.

---

## 🗺️ Key System Capabilities

### 1. Operations Console & Live Map
* **Southern Railway Network (Leaflet / OpenStreetMap):**
  * Spans key trunk lines and junctions across Tamil Nadu:
    * **Trunk Line 1:** Chennai Central ↔ Arakkonam ↔ Katpadi ↔ Jolarpettai ↔ Salem ↔ Erode ↔ Tiruppur ↔ Coimbatore.
    * **Trunk Line 2:** Chennai Egmore ↔ Tambaram ↔ Chengalpattu ↔ Villupuram ↔ Vriddhachalam ↔ Tiruchirappalli ↔ Dindigul ↔ Madurai.
    * **Chord & Branch Lines:** Erode ↔ Karur ↔ Trichy, Coimbatore ↔ Palani ↔ Dindigul, Salem ↔ Vriddhachalam.
* **Interactive Worksite Markers & Popups:**
  * Displays active requisitions with exact coordinates, corridor, track line, block type, duration, and scheduled window.
* **Corridor-Synchronized Telemetry Sidebar:**
  * Shows running trains, active conflicts, upcoming maintenance, and honest data attribution.

### 2. Block Planner & Dynamic Activity Register
* **Dynamic Requisition Dataset:** Dynamically populates maintenance activities from the active requisition dataset, replacing static hard-coded activities.
* **Corridor Isolation Filters:** Switch between *Active Corridor* (showing only activities on the current section) and *All Corridors*.
* **Evaluated Candidate Cards & Comparison Matrix:** Renders ranked candidate windows with duration, deviation, and impact scores.
* **Impact Analysis:** Visualizes conflicting train passages, passage times through worksite KM boundaries, delays, and downstream effects.

### 3. Coordination & Decision History Log
* **Unified Decision History Table:**
  * Tracks submission timestamp, REQ ID, department, corridor/section, requested window, duration, optimizer-selected window, conflicts considered, decision status, and data source.
* **4 Operational KPI Cards:**
  * *Active Maintenance Tasks*, *Auto-Scheduled Blocks*, *Optimizer Decisions Logged*, and *Corridor Telemetry Source*.
* **Statutory Authority Notice:**
  * Explicitly communicates that RailFlow is an automated decision-support prototype. Final statutory authority remains with authorised railway operating personnel.

### 4. Operating Branch / Coordinated Work Timetable
* **Single Source of Truth Timetable Card:**
  * Displays Section & Line, approved maintenance window, and permit order number matching the active optimizer recommendation.
* **Bundled Departmental Timetable:**
  * Bundles compatible departmental activities located on the same corridor section and track line.
  * When no compatible activities exist, shows: *"No compatible departmental activities available for bundling."*

### 5. Prototype Operational Configuration
* **Configurable Parameters:**
  * **Sectional Maximum Speed** (e.g. 130 km/h)
  * **Minimum Safety Headway Margin** (e.g. 12 min — parameterizes train clearance buffers with an enforced minimum bound of 3 minutes)
  * **Adjacent Line Caution Speed** (e.g. 30 km/h Caution Order applied to opposite line)
* **Conditional Safety Logic:**
  * **25kV Traction Power Block:** Conditional upon electrical OHE equipment involvement (catenary wire, tower wagon). Civil track work never forces an unnecessary Power Block.
  * Configuration values cannot bypass conflict detection or safety constraints.

### 6. Honest Live vs Demo/Mock Data Reporting
* **Live Telemetry Active:**
  * `"LIVE DATA • RailRadar Real-Time API"`
* **Fallback Mode (Quota / Rate-Limit / Offline):**
  * `"LIVE DATA UNAVAILABLE • DEMO/MOCK DATA"`
  * Uses honest reasoning: *"Feasible continuous block identified using available timetable/demo data."* Never falsely claims live train disruption verification when running on mock data.

---

## 🚀 Getting Started Locally

### Prerequisites
* Node.js (v18+ recommended)
* npm

### Installation & Launch

1. **Clone the repository:**
   ```bash
   git clone https://github.com/polonium84r-ui/sih08.git
   cd sih08
   ```

2. **Install dependencies (if any):**
   ```bash
   npm install
   ```

3. **Start the RailFlow Server:**
   ```bash
   npm start
   ```
   *Access the web application at:* `http://localhost:3000`

### Optional Environment Variables (`.env`)
```env
PORT=3000
RAILRADAR_API_KEY=your_railradar_api_token_here
```
*(If no API key is provided, RailFlow automatically operates in Demo/Mock Mode using verified corridor timetables).*

---

## 🧪 Verification & Automated Test Suites

RailFlow includes comprehensive automated verification suites in `scratch/` covering 77 automated test assertions:

```bash
# Run the Unified Workflow Verification Suite (Tests 1–14)
node scratch/verify_unified_workflow.js

# Run the Block Optimizer Verification Suite
node scratch/verify_block_optimizer.js

# Run the State Synchronization & Corridor Isolation Suite
node scratch/verify_corridor_sync.js

# Run the Operating Branch Timetable Suite
node scratch/verify_operating_branch.js

# Run the Railway Operational Scenarios Suite
node scratch/verify_scenarios.js
```

### Test Coverage Summary:
| Test Suite | Purpose | Tests | Status |
| :--- | :--- | :---: | :---: |
| `verify_unified_workflow.js` | End-to-end Submit → Optimize → Auto-Schedule cross-page sync | 14 | ✅ PASSED |
| `verify_block_optimizer.js` | Feasibility ranking, alternatives, line/block pairing, KM validation | 13 | ✅ PASSED |
| `verify_corridor_sync.js` | Track line sync, corridor isolation (CBE–ED vs KPD–JTJ), live/demo honesty | 28 | ✅ PASSED |
| `verify_operating_branch.js`| Coordinated timetable card, bundled activity filtering | 14 | ✅ PASSED |
| `verify_scenarios.js` | 8 railway operational scenarios (OHE Power Block, caution orders, rate limits) | 8 | ✅ PASSED |
| **Total Automated Tests** | | **77** | **100% PASS** |

---

## 📁 Repository Structure

```
.
├── index.html                           # Single-page interface (Operations, Block Planner, Coordination, Config)
├── server.js                            # Node.js backend server with REST endpoints
├── package.json                         # Project dependencies and npm start script
├── README.md                            # Comprehensive project documentation
├── css/
│   ├── main.css                         # Core styling, tokens, and layout
│   └── components.css                   # Component styles (tables, KPI cards, badges, modal dialogs)
├── js/
│   ├── app.js                           # Frontend controller, Leaflet maps, auto-schedule dispatch
│   ├── corridor_data.js                 # Network stations, track topology, reference timetables & requisitions
│   ├── conflict_engine.js               # Client-side spatial, temporal, and electrical conflict checks
│   ├── cascade_simulator.js             # Delay cascade simulation model
│   ├── recommender.js                   # Client recommendation candidate generator
│   └── audit_logger.js                  # Audit logging system
├── server/
│   └── services/
│       ├── railRadarService.js          # RailRadar API client with error & rate-limit handling
│       ├── trainDataService.js          # Corridor train schedule discovery, worksite KM range validation
│       ├── conflictDetectionService.js  # Train conflict detection, safety buffers, configurable caution orders
│       └── blockOptimizationService.js # 24h continuous block search, deterministic ranking & alternative slots
└── scratch/
    ├── verify_unified_workflow.js       # 14-point end-to-end unified workflow verification test
    ├── verify_block_optimizer.js        # Block Optimizer core logic test suite
    ├── verify_corridor_sync.js          # Cross-corridor state isolation and line/block validation suite
    ├── verify_operating_branch.js       # Operating Branch Timetable card synchronization suite
    └── verify_scenarios.js              # 8 core railway operational scenarios suite
```

---

## ⚖️ Disclaimer & Advisory Protocol

RailFlow is an **automated decision-support prototype**. In compliance with Indian Railways General and Subsidiary Rules (G&SR):
- Maintenance blocks proposed by RailFlow represent advisory decision-support recommendations.
- Final authority for block possession, line blocking, and traffic diversion remains exclusively with authorised railway operating personnel (Chief Section Controller / Section Controller via the Control Office Application — COA).
