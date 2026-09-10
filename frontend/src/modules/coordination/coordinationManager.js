/**
 * Coordination & Decision History Manager
 * Handles KPI cards, decision logs, and Form IR-OP-41 printable sanction memo.
 */

import store from '../../store/corridorStore.js';
import apiClient from '../../api/client.js';

export class CoordinationManager {
  constructor() {
    this.kpiTasks = document.getElementById("coordKpiTasks");
    this.kpiScheduled = document.getElementById("coordKpiScheduled");
    this.kpiDecisions = document.getElementById("coordKpiDecisions");
    this.kpiTelemetry = document.getElementById("coordKpiTelemetry");
    this.tbody = document.getElementById("coordDecisionHistoryTbody");
  }

  init() {
    this.render();
    store.subscribe((type) => {
      if (type === 'DECISION_LOG_UPDATED' || type === 'REQUISITIONS_UPDATED' || type === 'AUDIT_LOGS_UPDATED') {
        this.render();
      }
    });

    this.bindPrintButtons();
  }

  render() {
    const reqs = store.requisitions || [];
    const logs = store.decisionLogs || [];
    const scheduled = reqs.filter(r => r.status === 'SCHEDULED').length;

    if (this.kpiTasks) this.kpiTasks.textContent = reqs.length;
    if (this.kpiScheduled) this.kpiScheduled.textContent = scheduled;
    if (this.kpiDecisions) this.kpiDecisions.textContent = logs.length;
    if (this.kpiTelemetry) this.kpiTelemetry.textContent = store.dbStatus?.connected ? "PostgreSQL Active" : "Local Mock";

    if (this.tbody) {
      this.tbody.innerHTML = logs.map(l => `
        <tr>
          <td>${l.time}</td>
          <td><strong>${l.reqId}</strong></td>
          <td>${l.dept}</td>
          <td>${l.corridor}</td>
          <td>${l.requestedWindow}</td>
          <td>${l.duration}</td>
          <td><strong style="color: #059669;">${l.selectedWindow}</strong></td>
          <td><span style="font-size: 0.72rem; color: #64748b;">${l.conflictsConsidered}</span></td>
          <td><span class="badge-pill" style="background: #dcfce7; color: #166534; font-size: 0.68rem;">${l.status}</span></td>
          <td><span class="badge-pill" style="background: #f1f5f9; color: #334155; font-size: 0.68rem;">${l.dataSource}</span></td>
          <td><button class="rf-btn rf-btn-outline btn-print-slip" data-req="${l.reqId}" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;">Memo</button></td>
        </tr>
      `).join("");
    }
  }

  bindPrintButtons() {
    document.addEventListener("click", async (e) => {
      if (e.target.classList.contains("btn-print-slip")) {
        const reqId = e.target.getAttribute("data-req");
        const req = store.requisitions.find(r => r.reqId === reqId || r.id === reqId) || {
          reqId: reqId,
          department: "Civil / Track (P-Way)",
          fromStation: "KPD",
          toStation: "JTJ",
          trackLine: "UP Main Line",
          sanctionedSlot: "11:30 – 14:00 IST",
          recommendedBlock: "11:30 – 14:00 IST",
          durationMin: 150
        };
        try {
          const res = await apiClient.generateSanctionMemo(req, "Shri K. Ramanathan (Chief Section Controller, Chennai/Salem)");
          if (res.success) {
            this.showSanctionModal(res.memo);
          }
        } catch (err) {
          alert(`Error generating sanction memo: ${err.message}`);
        }
      }
    });

    const closeBtn = document.getElementById("modalCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const modal = document.getElementById("sanctionModal");
        if (modal) modal.style.display = "none";
      });
    }
  }

  showSanctionModal(memo) {
    const modal = document.getElementById("sanctionModal");
    const content = document.getElementById("sanctionModalContent");
    if (!modal || !content) return;

    content.innerHTML = `
      <div style="font-family: monospace; padding: 1.5rem; border: 2px solid #0f172a; background: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 0.75rem; margin-bottom: 1rem;">
          <h2 style="margin: 0; font-size: 1.2rem;">SOUTHERN RAILWAY &bull; OPERATING DEPARTMENT</h2>
          <h4 style="margin: 4px 0 0 0; font-size: 0.9rem;">LINE BLOCK &amp; POWER BLOCK SANCTION ORDER (FORM IR-OP-41)</h4>
          <div style="font-size: 0.8rem; margin-top: 4px;">ORDER NO: <strong>${memo.orderNo}</strong> &bull; DATE: <strong>${memo.date}</strong></div>
        </div>
        <div style="font-size: 0.85rem; line-height: 1.6; margin-bottom: 1rem;">
          <div><strong>SECTION:</strong> ${memo.section}</div>
          <div><strong>TRACK LINE:</strong> ${memo.track}</div>
          <div><strong>SANCTIONED WINDOW:</strong> <span style="font-size: 1rem; color: #059669; font-weight: bold;">${memo.timeStart} – ${memo.timeEnd} IST (${memo.durationMin} mins)</span></div>
          <div><strong>ISSUING CONTROLLER:</strong> ${memo.controller}</div>
          <div><strong>SECURITY AUTH HASH:</strong> ${memo.authHash}</div>
        </div>
        <div style="border-top: 1px dashed #cbd5e1; padding-top: 0.75rem; font-size: 0.75rem; color: #64748b;">
          * Statutory compliance: Automated advisory decision-support record. Possession must be granted in COA.
        </div>
        <div style="margin-top: 1rem; text-align: right;">
          <button class="rf-btn rf-btn-navy" onclick="window.print()">Print Sanction Order</button>
        </div>
      </div>
    `;

    modal.style.display = "flex";
  }
}

export default CoordinationManager;
