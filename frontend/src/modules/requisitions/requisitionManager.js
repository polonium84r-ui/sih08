/**
 * Requisition Form & Worksite Validation Manager
 */

import corridorData from '../../data/corridorData.js';
import store from '../../store/corridorStore.js';
import apiClient from '../../api/client.js';

export class RequisitionManager {
  constructor() {
    this.form = document.getElementById("blockRequisitionForm");
    this.deptRadios = document.querySelectorAll('input[name="reqDepartment"]');
    this.fromSelect = document.getElementById("reqFromStation");
    this.toSelect = document.getElementById("reqToStation");
    this.trackLineSelect = document.getElementById("reqTrackLine");
    this.blockTypeSelect = document.getElementById("reqBlockType");
    this.startKmInput = document.getElementById("reqWorksiteStartKm");
    this.endKmInput = document.getElementById("reqWorksiteEndKm");
    this.kmValidationMsgEl = document.getElementById("reqKmValidationMsg");
    this.sectionKmDisplayEl = document.getElementById("reqSectionKmDisplay");
    this.categorySelect = document.getElementById("reqWorkCategory");
    this.workDescInput = document.getElementById("reqWorkDesc");
    this.machineryInput = document.getElementById("reqMachinery");
    this.submitBtn = document.getElementById("btnSubmitRequisition");
  }

  init() {
    if (!this.form) return;

    this.populateStationDropdowns();
    this.bindDepartmentCards();
    this.bindSectionSelectors();
    this.bindTrackLineAndBlockType();
    this.bindKmInputs();
    this.bindFormSubmission();
    this.renderRequisitionsList();

    // Re-render when requisitions or stations update in store
    store.subscribe((type) => {
      if (type === 'REQUISITIONS_UPDATED') {
        this.renderRequisitionsList();
      } else if (type === 'STATIONS_UPDATED') {
        this.populateStationDropdowns();
      }
    });

    // Initial populate
    this.updateSectionKmDisplay(true);
    this.populateWorkCategories("CIVIL");
  }

  populateStationDropdowns() {
    if (!this.fromSelect || !this.toSelect) return;
    const stations = (store.stations && store.stations.length > 0) ? store.stations : (corridorData.stations || []);
    if (!stations || stations.length === 0) return;

    const currentFrom = this.fromSelect.value || "MAS";
    const currentTo = this.toSelect.value || "AJJ";

    const optionsHtml = stations.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join("");
    this.fromSelect.innerHTML = optionsHtml;
    this.toSelect.innerHTML = optionsHtml;

    if (stations.some(s => s.code === currentFrom)) {
      this.fromSelect.value = currentFrom;
    } else {
      this.fromSelect.value = stations[0]?.code || "MAS";
    }

    if (stations.some(s => s.code === currentTo)) {
      this.toSelect.value = currentTo;
    } else {
      this.toSelect.value = stations[1]?.code || "AJJ";
    }
  }

  bindDepartmentCards() {
    this.deptRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        document.querySelectorAll(".dept-radio-card").forEach(c => c.classList.remove("active"));
        const parentCard = e.target.closest(".dept-radio-card");
        if (parentCard) parentCard.classList.add("active");
        const deptCode = e.target.getAttribute("data-dept-code");
        this.populateWorkCategories(deptCode);
      });
    });
  }

  bindSectionSelectors() {
    const handleStationChange = () => {
      this.updateSectionKmDisplay(true);
      this.validateWorksiteKm();
    };
    if (this.fromSelect) this.fromSelect.addEventListener("change", handleStationChange);
    if (this.toSelect) this.toSelect.addEventListener("change", handleStationChange);
  }

  bindTrackLineAndBlockType() {
    if (this.trackLineSelect) {
      this.trackLineSelect.addEventListener("change", () => {
        const line = this.trackLineSelect.value;
        if (line === "UP Main Line") this.blockTypeSelect.value = "UP Line Block";
        else if (line === "DOWN Main Line") this.blockTypeSelect.value = "DOWN Line Block";
        else if (line === "Both UP & DOWN Lines") this.blockTypeSelect.value = "Both Lines Block (Simultaneous)";
        else if (line === "Station Loop / Yard Track") this.blockTypeSelect.value = "Station Loop / Yard Track Block";
      });
    }

    if (this.blockTypeSelect) {
      this.blockTypeSelect.addEventListener("change", () => {
        const block = this.blockTypeSelect.value;
        if (block === "UP Line Block") this.trackLineSelect.value = "UP Main Line";
        else if (block === "DOWN Line Block") this.trackLineSelect.value = "DOWN Main Line";
        else if (block === "Both Lines Block (Simultaneous)") this.trackLineSelect.value = "Both UP & DOWN Lines";
        else if (block === "Station Loop / Yard Track Block") this.trackLineSelect.value = "Station Loop / Yard Track";
      });
    }
  }

  bindKmInputs() {
    if (this.startKmInput) this.startKmInput.addEventListener("input", () => this.validateWorksiteKm());
    if (this.endKmInput) this.endKmInput.addEventListener("input", () => this.validateWorksiteKm());
  }

  updateSectionKmDisplay(shouldResetWorksite = true) {
    const from = (this.fromSelect ? this.fromSelect.value : "MAS").toUpperCase();
    const to = (this.toSelect ? this.toSelect.value : "AJJ").toUpperCase();
    const section = corridorData.getSectionKmRange(from, to);

    if (this.sectionKmDisplayEl) {
      this.sectionKmDisplayEl.textContent = section.available ? section.label : "KM Range Unavailable";
    }

    if (shouldResetWorksite && section.available) {
      const defaultSpan = 3.2;
      const defaultStart = parseFloat((section.startKm + 5.0).toFixed(2));
      const defaultEnd = parseFloat(Math.min(section.endKm, defaultStart + defaultSpan).toFixed(2));
      if (this.startKmInput) this.startKmInput.value = defaultStart.toFixed(2);
      if (this.endKmInput) this.endKmInput.value = defaultEnd.toFixed(2);
      this.validateWorksiteKm();
    }
  }

  validateWorksiteKm() {
    const from = (this.fromSelect ? this.fromSelect.value : "MAS").toUpperCase();
    const to = (this.toSelect ? this.toSelect.value : "AJJ").toUpperCase();
    const section = corridorData.getSectionKmRange(from, to);

    const startVal = parseFloat(this.startKmInput?.value);
    const endVal = parseFloat(this.endKmInput?.value);

    if (isNaN(startVal) || isNaN(endVal)) {
      if (this.kmValidationMsgEl) {
        this.kmValidationMsgEl.textContent = `Please enter valid start and end KM inside ${section.label}.`;
        this.kmValidationMsgEl.style.color = "#dc2626";
      }
      return { valid: false };
    }

    if (startVal >= endVal) {
      if (this.kmValidationMsgEl) {
        this.kmValidationMsgEl.textContent = `Worksite Start KM (${startVal.toFixed(2)}) must be strictly less than End KM (${endVal.toFixed(2)}).`;
        this.kmValidationMsgEl.style.color = "#dc2626";
      }
      return { valid: false };
    }

    if (section.available) {
      if (startVal < section.startKm || endVal > section.endKm) {
        if (this.kmValidationMsgEl) {
          this.kmValidationMsgEl.textContent = `Worksite must be within Section KM Range (${section.label}).`;
          this.kmValidationMsgEl.style.color = "#dc2626";
        }
        return { valid: false };
      }
    }

    const span = (endVal - startVal).toFixed(2);
    if (this.kmValidationMsgEl) {
      this.kmValidationMsgEl.textContent = `✓ Valid worksite span: ${span} km (${section.label})`;
      this.kmValidationMsgEl.style.color = "#059669";
    }

    return { valid: true, startKm: startVal, endKm: endVal, spanKm: span };
  }

  populateWorkCategories(deptCode) {
    if (!this.categorySelect) return;
    let categories = [];
    if (deptCode === "CIVIL") {
      categories = [
        { id: "CIVIL_TAMP", label: "Plain Track Tamping & Alignment (CSM 09-32 + BRM)", desc: "Plain track tamping & track geometry alignment", mach: "CSM 09-32 Continuous Action Tamping Machine + BRM", duration: 150 },
        { id: "CIVIL_BCM", label: "Deep Ballast Screening & Cleaning (BCM RM-80 + CSM)", desc: "Deep ballast screening & shoulder cleaning", mach: "BCM RM-80 Ballast Cleaning Machine + BRM", duration: 210 }
      ];
    } else if (deptCode === "SNT") {
      categories = [
        { id: "SNT_POINT", label: "Point Machine Overhaul & Lubrication", desc: "Electric point machine overhaul & detector slide test", mach: "S&T Tool Van & Diagnostic Calibration Kit", duration: 90 },
        { id: "SNT_EI", label: "Electronic Interlocking Software Test", desc: "Interlocking route testing & signal head replacement", mach: "EI Testing Console & Optical Power Meter", duration: 120 }
      ];
    } else if (deptCode === "TRD") {
      categories = [
        { id: "TRD_CATENARY", label: "25kV Catenary Wire Tensioning (Power Block)", desc: "25kV AC catenary tensioning, contact wire wear check", mach: "8-Wheeler Self-Propelled OHE Tower Wagon", duration: 150 },
        { id: "TRD_INSULATOR", label: "Porcelain Insulator High-Pressure Wash", desc: "Silicone/porcelain insulator wash & jumper check", mach: "Tower Wagon + High-Pressure Insulator Washing Rake", duration: 120 }
      ];
    } else {
      categories = [
        { id: "MECH_BRAKE", label: "Brake Gear & Wheel Profile Examination", desc: "Rolling stock examination & caliper calibration", mach: "Diagnostic Ultrasound Car + Tool Rake", duration: 90 }
      ];
    }

    this.categorySelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
    if (categories.length > 0) {
      if (this.workDescInput) this.workDescInput.value = categories[0].desc;
      if (this.machineryInput) this.machineryInput.value = categories[0].mach;
    }
  }

  bindFormSubmission() {
    this.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const validation = this.validateWorksiteKm();
      if (!validation.valid) {
        alert("Please enter a valid Worksite KM stretch within section boundaries.");
        return;
      }

      if (this.submitBtn) {
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = "Evaluating Telemetry & Optimizing Block...";
      }

      const deptRadio = document.querySelector('input[name="reqDepartment"]:checked');
      const department = deptRadio ? deptRadio.value : "Civil / Track (P-Way)";
      const deptCode = deptRadio ? deptRadio.getAttribute("data-dept-code") : "CIVIL";

      const fromStation = this.fromSelect.value;
      const toStation = this.toSelect.value;
      const trackLine = this.trackLineSelect.value;
      const blockType = this.blockTypeSelect.value;
      const durationMin = parseInt(document.getElementById("reqDuration")?.value, 10) || 150;
      const urgency = document.getElementById("reqUrgency")?.value || "Due";
      const preferredSlot = document.getElementById("reqPreferredSlot")?.value || "Midday Traffic Shadow (11:00–14:30)";

      const payload = {
        department,
        deptCode,
        fromStation,
        toStation,
        trackLine,
        blockType,
        worksiteStartKm: validation.startKm,
        worksiteEndKm: validation.endKm,
        worksiteKmRange: `KM ${validation.startKm.toFixed(2)} – KM ${validation.endKm.toFixed(2)}`,
        workDesc: this.workDescInput?.value || "Maintenance work",
        machinery: this.machineryInput?.value || "Track Machinery",
        durationMin,
        urgency,
        preferredSlot,
        config: store.config
      };

      try {
        const response = await apiClient.evaluateBlock(payload);
        if (response.success) {
          const result = response.result;
          const isFeasible = !result.status?.includes("NO FEASIBLE") && result.recommendedBlock !== "--:-- – --:--";
          const reqId = `REQ-SR-${deptCode}-${Math.floor(100 + Math.random() * 900)}`;

          const newReq = {
            id: reqId,
            reqId,
            requestId: reqId,
            ...payload,
            status: isFeasible ? "SCHEDULED" : "UNSCHEDULED (NO FEASIBLE BLOCK)",
            sanctionedSlot: isFeasible ? result.recommendedBlock : "--:-- – --:--",
            recommendedBlock: isFeasible ? result.recommendedBlock : "--:-- – --:--",
            windowType: result.windowType
          };

          // 1. Persist directly to PostgreSQL database
          try {
            const dbRes = await apiClient.createRequisition(newReq);
            if (dbRes && dbRes.success && dbRes.requisition) {
              newReq.id = dbRes.requisition.id;
              newReq.reqId = dbRes.requisition.id;
              newReq.requestId = dbRes.requisition.id;
            }
          } catch (dbErr) {
            console.warn('[RequisitionManager] Requisition stored locally (backend offline):', dbErr.message);
          }

          // 2. Update reactive Store
          store.saveRequisition(newReq);
          store.setActiveCorridor(newReq);
          store.setRecommendation(result, response.corridorData);
          store.logDecision({
            reqId: newReq.reqId,
            dept: newReq.department,
            corridor: `${fromStation} – ${toStation}`,
            requestedWindow: preferredSlot,
            duration: `${durationMin} min`,
            selectedWindow: result.recommendedBlock,
            status: newReq.status,
            dataSource: store.dbStatus?.connected ? 'PostgreSQL Database' : 'In-Memory Fallback'
          });

          this.renderResultCard(result, response.corridorData);
        }
      } catch (err) {
        alert(`Evaluation error: ${err.message}`);
      } finally {
        if (this.submitBtn) {
          this.submitBtn.disabled = false;
          this.submitBtn.innerHTML = "Submit Block Requisition &rarr;";
        }
      }
    });
  }

  renderResultCard(result, corridorData) {
    const card = document.getElementById("blockPlanningResultCard");
    if (!card) return;

    const statusBadge = document.getElementById("bpStatusBadge");
    const recBlock = document.getElementById("bpRecommendedBlock");
    const reasonText = document.getElementById("bpReasonText");
    const trainsTbody = document.getElementById("bpTrainsTableBody");

    const isFeasible = !result.status?.includes("NO FEASIBLE") && result.recommendedBlock !== "--:-- – --:--";

    if (statusBadge) {
      statusBadge.textContent = isFeasible ? "SCHEDULED (OPTIMIZED)" : "NO FEASIBLE BLOCK";
      statusBadge.style.background = isFeasible ? "#dcfce7" : "#fee2e2";
      statusBadge.style.color = isFeasible ? "#166534" : "#991b1b";
    }

    if (recBlock) recBlock.textContent = result.recommendedBlock;
    if (reasonText) reasonText.textContent = result.reason || "Evaluated corridor traffic.";

    if (trainsTbody && corridorData?.trains) {
      trainsTbody.innerHTML = corridorData.trains.slice(0, 5).map(t => `
        <tr>
          <td><strong>#${t.trainNumber}</strong><br><span style="font-size: 0.68rem; color: #64748b;">${t.trainName}</span></td>
          <td>${t.line}</td>
          <td>${t.passageTime ? `${t.passageTime.entryTimeFormatted}–${t.passageTime.exitTimeFormatted}` : '--:--'}</td>
          <td>${t.delayMinutes > 0 ? `+${t.delayMinutes}m` : 'On Time'}</td>
          <td><span class="badge-pill" style="font-size: 0.68rem; background: #e0f2fe; color: #0369a1;">Evaluated</span></td>
        </tr>
      `).join("");
    }
  }

  renderRequisitionsList() {
    const container = document.getElementById("requisitionsListContainer");
    const countBadge = document.getElementById("requisitionsCountBadge");
    if (!container) return;

    const reqs = store.requisitions;
    if (countBadge) countBadge.textContent = `${reqs.length} Active`;

    container.innerHTML = reqs.map(r => `
      <div style="padding: 0.75rem 0.5rem; border-bottom: 1px solid #f1f5f9; font-size: 0.78rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <strong style="color: #0f172a;">${r.reqId}</strong>
          <span class="badge-pill" style="font-size: 0.65rem; background: ${r.status === 'SCHEDULED' ? '#dcfce7' : '#fee2e2'}; color: ${r.status === 'SCHEDULED' ? '#166534' : '#991b1b'};">${r.status}</span>
        </div>
        <div style="color: #475569;">${r.department} &bull; ${r.sectionName || `${r.fromStation}-${r.toStation}`}</div>
        <div style="color: #059669; font-weight: 600; margin-top: 2px;">Slot: ${r.recommendedBlock || r.sanctionedSlot || '--:--'}</div>
      </div>
    `).join("");
  }
}

export default RequisitionManager;
