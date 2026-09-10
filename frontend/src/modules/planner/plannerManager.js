/**
 * Block Planner View Manager
 * Handles: Activity Register, Candidate Cards, Comparison Matrix, and Impact Analysis.
 */

import store from '../../store/corridorStore.js';

export class PlannerManager {
  constructor() {
    this.subviews = {
      register: document.getElementById("subviewRegister"),
      candidates: document.getElementById("subviewCandidates"),
      comparison: document.getElementById("subviewComparison"),
      impact: document.getElementById("subviewImpactAnalysis")
    };
  }

  init() {
    this.bindNavigationButtons();
    this.renderActivityRegister();
    this.renderCandidateCards();

    store.subscribe((type) => {
      if (type === 'REQUISITIONS_UPDATED' || type === 'ACTIVE_CORRIDOR_CHANGED' || type === 'FILTER_CHANGED') {
        this.renderActivityRegister();
        this.renderCandidateCards();
      }
    });
  }

  bindNavigationButtons() {
    const btnFind = document.getElementById("btnFindBlockWindow");
    if (btnFind) btnFind.addEventListener("click", () => this.switchSubview("candidates"));

    const btnBackToReg = document.getElementById("btnBackToRegister");
    if (btnBackToReg) btnBackToReg.addEventListener("click", () => this.switchSubview("register"));

    const btnCompare = document.getElementById("btnCompareRecommend");
    if (btnCompare) btnCompare.addEventListener("click", () => {
      this.switchSubview("comparison");
      this.renderComparisonView();
    });

    const btnImpact = document.getElementById("btnViewImpactAnalysis");
    if (btnImpact) btnImpact.addEventListener("click", () => {
      this.switchSubview("impact");
      this.renderImpactAnalysis();
    });

    const btnFilterActive = document.getElementById("btnFilterActiveCorridor");
    const btnFilterAll = document.getElementById("btnFilterAllCorridors");

    if (btnFilterActive && btnFilterAll) {
      btnFilterActive.addEventListener("click", () => {
        btnFilterActive.classList.add("active");
        btnFilterAll.classList.remove("active");
        store.setRegisterFilter("active");
      });

      btnFilterAll.addEventListener("click", () => {
        btnFilterAll.classList.add("active");
        btnFilterActive.classList.remove("active");
        store.setRegisterFilter("all");
      });
    }
  }

  switchSubview(viewName) {
    Object.keys(this.subviews).forEach(k => {
      if (this.subviews[k]) {
        this.subviews[k].style.display = (k === viewName) ? "block" : "none";
      }
    });
  }

  renderActivityRegister() {
    const tbody = document.getElementById("activityRegisterTbody");
    if (!tbody) return;

    let reqs = store.requisitions || [];
    const active = store.activeCorridor;

    if (store.registerFilter === "active" && active) {
      reqs = reqs.filter(r => (r.fromStation === active.fromStation && r.toStation === active.toStation) || (r.sectionName === active.sectionName));
    }

    tbody.innerHTML = reqs.map(r => `
      <tr>
        <td><input type="checkbox" checked disabled></td>
        <td><strong>${r.reqId}</strong></td>
        <td>${r.department}</td>
        <td>${r.sectionName || `${r.fromStation}–${r.toStation}`}</td>
        <td>${r.kmRange || 'KM 129.50 – 174.00'}</td>
        <td><span class="badge-pill" style="font-size: 0.7rem; background: #e0f2fe; color: #0369a1;">${r.workType || 'Maintenance'}</span></td>
        <td>${r.durationMin || 150} min</td>
        <td><span class="badge-pill urgency-due">${r.urgency || 'Due'}</span></td>
        <td><span class="badge-pill" style="background: #f0fdf4; color: #166534;">COMPATIBLE</span></td>
        <td>${r.status}</td>
        <td><strong style="color: #059669;">${r.recommendedBlock || r.sanctionedSlot || '--:--'}</strong></td>
        <td><button class="rf-btn rf-btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.72rem;">Details</button></td>
      </tr>
    `).join("");
  }

  renderCandidateCards() {
    const container = document.getElementById("candidatesCardsRow");
    if (!container) return;

    const rec = store.currentRecommendation;
    const primarySlot = rec ? rec.recommendedBlock : "11:30 – 14:00 IST";
    const primaryReason = rec ? rec.reason : "Feasible continuous block identified inside midday traffic shadow.";

    container.innerHTML = `
      <div class="candidate-card recommended" style="border: 2px solid #059669; border-radius: 8px; padding: 1.25rem; background: #ffffff; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h4 style="color: #0f172a; font-size: 1rem; margin: 0;">Primary Recommended Window</h4>
          <span class="badge-pill" style="background: #dcfce7; color: #166534; font-weight: bold;">RECOMMENDED</span>
        </div>
        <div style="font-size: 1.35rem; font-weight: 800; color: #059669; margin-bottom: 0.5rem;">${primarySlot}</div>
        <p style="font-size: 0.8rem; color: #475569; margin-bottom: 0.75rem;">${primaryReason}</p>
        <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: #64748b;">
          <span>Duration: <strong>150 min</strong></span>
          <span>Disruption: <strong>Lowest</strong></span>
          <span>Safety Clearance: <strong>Verified</strong></span>
        </div>
      </div>
    `;
  }

  renderComparisonView() {
    const tbody = document.getElementById("comparisonMatrixTbody");
    const rec = store.currentRecommendation;
    const slot = rec ? rec.recommendedBlock : "11:30 – 14:00 IST";

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td><strong>Scheduled Time Window</strong></td>
          <td class="col-rec"><strong style="color: #059669;">${slot}</strong></td>
          <td>08:30 – 11:00 IST</td>
          <td>14:30 – 17:00 IST</td>
        </tr>
        <tr>
          <td><strong>Feasibility</strong></td>
          <td class="col-rec"><span style="color: #166534; font-weight: bold;">Feasible (Zero Conflicts)</span></td>
          <td>Infeasible (2 conflicts)</td>
          <td>Feasible (Caution req.)</td>
        </tr>
        <tr>
          <td><strong>Estimated Network Delay</strong></td>
          <td class="col-rec"><strong style="color: #059669;">18 min</strong></td>
          <td>64 min</td>
          <td>40 min</td>
        </tr>
        <tr>
          <td><strong>Traction Power Block</strong></td>
          <td class="col-rec">Conditional (Synchronized)</td>
          <td>Not Synchronized</td>
          <td>Synchronized</td>
        </tr>
      `;
    }
  }

  renderImpactAnalysis() {
    const startEl = document.getElementById("bpTimelineStartTime");
    const endEl = document.getElementById("bpTimelineEndTime");
    const windowEl = document.getElementById("bpSummaryWindow");
    const rec = store.currentRecommendation;

    const slot = rec ? rec.recommendedBlock : "11:30 – 14:00 IST";
    const parts = slot.split(/[–\-]/);

    if (startEl && parts[0]) startEl.textContent = parts[0].trim();
    if (endEl && parts[1]) endEl.textContent = parts[1].trim();
    if (windowEl) windowEl.textContent = slot;
  }
}

export default PlannerManager;
