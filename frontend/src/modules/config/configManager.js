/**
 * Configuration Manager
 * Handles operational rule parameters (headway, caution speeds, maximum speed).
 */

import store from '../../store/corridorStore.js';
import apiClient from '../../api/client.js';

export class ConfigManager {
  constructor() {
    this.maxSpeedInput = document.getElementById("cfgMaxSpeed");
    this.headwayInput = document.getElementById("cfgHeadway");
    this.cautionSpeedInput = document.getElementById("cfgCautionSpeed");
    this.saveBtn = document.getElementById("btnSaveConfig");
  }

  init() {
    this.populate();
    if (this.saveBtn) {
      this.saveBtn.addEventListener("click", () => this.save());
    }

    // Auto-update inputs when config is synchronized from PostgreSQL
    store.subscribe((type) => {
      if (type === 'CONFIG_UPDATED') {
        this.populate();
      }
    });
  }

  populate() {
    const cfg = store.config;
    if (this.maxSpeedInput) this.maxSpeedInput.value = cfg.maxSpeedKmH;
    if (this.headwayInput) this.headwayInput.value = cfg.headwayMinutes;
    if (this.cautionSpeedInput) this.cautionSpeedInput.value = cfg.cautionSpeedKmH;
  }

  async save() {
    const updated = {
      maxSpeedKmH: parseInt(this.maxSpeedInput?.value, 10) || 130,
      headwayMinutes: parseInt(this.headwayInput?.value, 10) || 12,
      cautionSpeedKmH: parseInt(this.cautionSpeedInput?.value, 10) || 30
    };

    store.updateConfig(updated);

    try {
      await apiClient.updateConfig(updated);
      alert("Operational parameters updated and synchronized with backend optimizer!");
    } catch (e) {
      console.warn("Backend config sync fallback:", e.message);
      alert("Operational parameters updated locally.");
    }
  }
}

export default ConfigManager;
