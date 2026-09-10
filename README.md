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

1. **Clone & Install Dependencies:**
   ```bash
   npm run install:all
   ```

2. **Start Backend & Frontend Services:**
   ```bash
   # Run both Backend API and Frontend Dev Server together in a SINGLE terminal:
   npm run dev

   # (Alternatively, run individually if needed):
   # npm run dev:backend    # Backend on Port 5000
   # npm run dev:frontend   # Frontend on Port 3000
   ```
   *Access the web application at:* `http://localhost:3000`  
   *API Swagger / Health Endpoint:* `http://localhost:5000/api/health`

### Environment Configuration
* **Backend (`backend/.env`):**
  ```env
  PORT=5000
  RAILRADAR_API_KEY=your_railradar_api_token_here
  CORS_ORIGIN=http://localhost:3000,http://localhost:5173
  ```
* **Frontend (`frontend/.env`):**
  ```env
  VITE_API_BASE_URL=http://localhost:5000/api/v1
  ```

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

## 🗄️ Database Architecture: PostgreSQL + Prisma ORM

RailFlow uses **PostgreSQL 16** with **Prisma ORM** for enterprise-grade persistence, ACID transactions, and structured relational modeling:

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend (Vite / ES Modules)                │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST (/api/v1/*)
┌──────────────────────────────▼──────────────────────────────┐
│                Backend API Server (Express.js)              │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │       Unified Database Service Layer (db.js)          │  │
│  │  - Proactive connectivity health check                │  │
│  │  - Resilient zero-downtime In-Memory Fallback         │  │
│  └───────────────┬───────────────────────┬───────────────┘  │
└──────────────────┼───────────────────────┼──────────────────┘
                   │ Connected             │ Disconnected
                   ▼                       ▼
┌──────────────────────────────────────┐  ┌───────────────────┐
│     PostgreSQL Database (Prisma)     │  │  In-Memory Seed   │
│  - Stations & TrackSections          │  │  (Zero-breakage   │
│  - Requisitions & BlockDecisions     │  │   offline dev/CI) │
│  - OperationalConfig & AuditLogs     │  └───────────────────┘
└──────────────────────────────────────┘
```

### PostgreSQL Quick Start with Docker
To launch PostgreSQL in the background:
```bash
# Start PostgreSQL 16 database container
npm run db:up

# Generate Prisma Client
npm run db:generate

# Seed the database with authentic Southern Railway data
npm run db:seed

# Stop PostgreSQL container
npm run db:down
```

### Environment Configurations
- **Backend (`backend/.env`)**:
  ```env
  PORT=5000
  NODE_ENV=development
  CORS_ORIGIN=http://localhost:3000,http://localhost:5173
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/railflow_db?schema=public"
  ```
- **Frontend (`frontend/.env`)**:
  ```env
  VITE_API_BASE_URL=http://localhost:5000/api/v1
  ```

---

## 📁 Repository Structure (Decoupled MVP Architecture)

```
.
├── docker-compose.yml                   # PostgreSQL 16 local service container
├── package.json                         # Monorepo task runner (start, test, dev, db)
│
├── backend/                             # Express REST API Server
│   ├── .env                             # Backend config (PORT=5000, DATABASE_URL)
│   ├── package.json                     # Express, Prisma ORM, CORS, Dotenv
│   ├── prisma/
│   │   ├── schema.prisma                # Relational models (Station, Section, Requisition, etc.)
│   │   └── seed.js                      # Southern Railway network & baseline seed script
│   ├── src/
│   │   ├── server.js                    # Express app bootstrap & db check
│   │   ├── config/                      # Environment variables & operational defaults
│   │   ├── routes/                      # Versioned REST endpoints (/api/v1/*)
│   │   ├── controllers/                 # Domain request/response handlers
│   │   ├── middleware/                  # Request validation, error handling, logging
│   │   ├── services/
│   │   │   ├── db.js                    # Unified Prisma DB service with fallback
│   │   │   ├── blockOptimizationService.js # 24h continuous block search & ranking
│   │   │   ├── conflictDetectionService.js # Safety buffers, caution orders, power block
│   │   │   ├── trainDataService.js      # Corridor trains & worksite KM validation
│   │   │   ├── railRadarService.js      # RailRadar real-time API client
│   │   │   ├── auditLogService.js       # Form IR-OP-41 sanction memos & logs
│   │   │   └── rulesEngine.js           # Pluggable railway rules & business logic
│   │   └── data/                        # Corridor topology & station chainage
│   └── tests/                           # Unit & integration test suites (23 tests)
│
├── frontend/                            # Vite Modern Web Client
│   ├── .env                             # Frontend configuration (VITE_API_BASE_URL)
│   ├── vite.config.js                   # Vite dev server & backend proxy config
│   ├── package.json                     # Frontend dependencies & build scripts
│   ├── index.html                       # Application interface template
│   └── src/
│       ├── main.js                      # Application bootstrap & lifecycle
│       ├── api/                         # Backend API client
│       ├── store/                       # Central reactive state store
│       ├── modules/                     # Modular domain controllers (map, requisitions, planner, coordination, config)
│       ├── data/                        # Track geometry & network definitions
│       └── styles/                      # Modular CSS design system
│
└── scratch/                             # OSM track extraction tools & raw data
```

---

## ⚖️ Disclaimer & Advisory Protocol

RailFlow is an **automated decision-support prototype**. In compliance with Indian Railways General and Subsidiary Rules (G&SR):
- Maintenance blocks proposed by RailFlow represent advisory decision-support recommendations.
- Final authority for block possession, line blocking, and traffic diversion remains exclusively with authorised railway operating personnel (Chief Section Controller / Section Controller via the Control Office Application — COA).
