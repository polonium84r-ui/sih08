/**
 * RailFlow Enterprise Application Entry Point (Vite / ES Module)
 * Orchestrates all domain managers, maps, forms, and reactive stores.
 */

import { MapManager } from './modules/map/mapManager.js';
import { RequisitionManager } from './modules/requisitions/requisitionManager.js';
import { PlannerManager } from './modules/planner/plannerManager.js';
import { CoordinationManager } from './modules/coordination/coordinationManager.js';
import { ConfigManager } from './modules/config/configManager.js';
import store from './store/corridorStore.js';
import corridorData from './data/corridorData.js';

document.addEventListener("DOMContentLoaded", () => {
  // 1. Live Header Clock
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

  // 2. Live Database Status Badge
  function updateDbStatusBadge(status) {
    const badgeEl = document.getElementById("dbStatusBadge");
    if (!badgeEl) return;
    if (status && status.connected) {
      badgeEl.className = "rf-db-status-badge online";
      badgeEl.innerHTML = `<span class="db-dot"></span><span class="db-label">PostgreSQL: Connected</span>`;
      badgeEl.title = `Connected to PostgreSQL database (railflow_db) via Prisma ORM`;
    } else {
      badgeEl.className = "rf-db-status-badge fallback";
      badgeEl.innerHTML = `<span class="db-dot"></span><span class="db-label">DB: In-Memory Mode</span>`;
      badgeEl.title = `Backend operating in In-Memory fallback mode`;
    }
  }

  store.subscribe((type, payload) => {
    if (type === 'DB_STATUS_CHANGED') {
      updateDbStatusBadge(payload);
    }
  });

  // 3. Initialize Domain Modules
  const mapMgr = new MapManager("leafletMapContainer");
  const reqMgr = new RequisitionManager();
  const plannerMgr = new PlannerManager();
  const coordMgr = new CoordinationManager();
  const configMgr = new ConfigManager();

  mapMgr.init();
  reqMgr.init();
  plannerMgr.init();
  coordMgr.init();
  configMgr.init();

  // 4. Synchronize live data from PostgreSQL Backend
  store.initFromBackend().then(status => {
    updateDbStatusBadge(status);
    console.log("[RailFlow] Store initialized from backend. Status:", status.mode);
  });

  // 3. Navigation Tab Switching
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

    if (tabId === "tabOperations") {
      mapMgr.invalidateSize();
    } else if (tabId === "tabBlockPlanner") {
      plannerMgr.renderActivityRegister();
    } else if (tabId === "tabCoordination") {
      coordMgr.render();
    } else if (tabId === "tabConfiguration") {
      configMgr.populate();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const tabId = tab.getAttribute("data-tab");
      switchMainTab(tabId);
    });
  });

  // Jump from Raise Request to Map
  const btnJump = document.getElementById("btnReqJumpToOps");
  if (btnJump) {
    btnJump.addEventListener("click", () => switchMainTab("tabOperations"));
  }

  const btnOpenPlanner = document.getElementById("sidebarOpenPlannerBtn");
  if (btnOpenPlanner) {
    btnOpenPlanner.addEventListener("click", () => switchMainTab("tabBlockPlanner"));
  }

  // 4. Sidebar Real-Time Telemetry Initial Populate
  function renderOperationsSidebar() {
    const runningMetric = document.getElementById("opRunningTrainsMetric");
    const delayedContainer = document.getElementById("delayedTrainsContainer");
    const conflictsContainer = document.getElementById("activeConflictsContainer");
    const upcomingContainer = document.getElementById("upcomingMaintContainer");

    if (runningMetric) runningMetric.innerHTML = `5 <span>on monitored corridor</span>`;

    if (delayedContainer && corridorData.delayedTrains) {
      delayedContainer.innerHTML = corridorData.delayedTrains.slice(0, 3).map(t => `
        <div class="train-status-card" style="padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem;">
          <div style="display: flex; justify-content: space-between;">
            <strong>${t.name}</strong>
            <span style="color: #dc2626; font-weight: bold;">${t.delay}</span>
          </div>
          <div style="color: #64748b; font-size: 0.7rem;">Direction: ${t.direction} Mainline</div>
        </div>
      `).join("");
    }

    if (conflictsContainer && corridorData.activeConflicts) {
      conflictsContainer.innerHTML = corridorData.activeConflicts.map(c => `
        <div style="padding: 0.45rem 0; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem;">
          <span class="badge-pill" style="font-size: 0.65rem; background: #fef3c7; color: #92400e;">${c.type}</span>
          <div style="color: #334155; margin-top: 2px;">${c.detail}</div>
        </div>
      `).join("");
    }

    if (upcomingContainer && corridorData.upcomingMaintenance) {
      upcomingContainer.innerHTML = corridorData.upcomingMaintenance.map(m => `
        <div style="padding: 0.45rem 0; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem; display: flex; justify-content: space-between;">
          <span>${m.id} (${m.dept})</span>
          <span class="badge-pill urgency-due" style="font-size: 0.65rem;">${m.urgency}</span>
        </div>
      `).join("");
    }
  }

  renderOperationsSidebar();

  console.log("RailFlow MVP Application initialized successfully with decoupled architecture.");
});
