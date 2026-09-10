/**
 * RailFlow Frontend API Client
 * Manages communication with the backend API.
 * Uses VITE_API_BASE_URL from frontend/.env with intelligent fallback.
 */

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : '/api/v1';

class ApiClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((data && data.error && data.error.message) || `HTTP ${response.status}: Request failed`);
      }

      return data;
    } catch (err) {
      console.warn(`[ApiClient] Request to ${url} failed:`, err.message);
      // If primary endpoint failed on /v1, try fallback to legacy proxy /api
      if (this.baseUrl.includes('/v1')) {
        const fallbackUrl = `/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
        try {
          const fallbackRes = await fetch(fallbackUrl, { ...options, headers });
          if (fallbackRes.ok) {
            return await fallbackRes.json();
          }
        } catch (e) {}
      }
      throw err;
    }
  }

  // 1. Block Optimization & Evaluation
  async evaluateBlock(payload) {
    return this.request('/blocks/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // 2. Telemetry & Health
  async getTelemetryStatus() {
    return this.request('/telemetry/status');
  }

  async getTrainsBetween(from, to, live = true) {
    return this.request(`/telemetry/trains?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&live=${live}`);
  }

  async getTrainSchedule(trainNumber, haltsOnly = false) {
    return this.request(`/telemetry/trains/${encodeURIComponent(trainNumber)}?haltsOnly=${haltsOnly}`);
  }

  async getLiveTrainStatus(trainNumber, options = {}) {
    const qs = new URLSearchParams(options).toString();
    return this.request(`/telemetry/trains/${encodeURIComponent(trainNumber)}/live${qs ? '?' + qs : ''}`);
  }

  async getTrainRouteGeometry(trainNumber, format = 'geojson', stops = true) {
    return this.request(`/telemetry/trains/${encodeURIComponent(trainNumber)}/route?format=${format}&stops=${stops}`);
  }

  // 3. Corridors & Stations
  async getStations() {
    return this.request('/corridors/stations');
  }

  async getCorridorTelemetry(from, to) {
    return this.request(`/corridors/telemetry?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  // 4. Requisitions
  async getRequisitions(corridor = null) {
    const qs = corridor ? `?corridor=${encodeURIComponent(corridor)}` : '';
    return this.request(`/requisitions${qs}`);
  }

  async createRequisition(payload) {
    return this.request('/requisitions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // 5. Configuration
  async getConfig() {
    return this.request('/config');
  }

  async updateConfig(payload) {
    return this.request('/config', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // 6. Audit & Sanction Memo
  async getAuditLogs() {
    return this.request('/audit/logs');
  }

  async generateSanctionMemo(candidate, controllerName) {
    return this.request('/audit/sanction-memo', {
      method: 'POST',
      body: JSON.stringify({ candidate, controllerName })
    });
  }

  // 7. Network Sections & Health
  async getSections() {
    return this.request('/corridors/sections');
  }

  async checkHealth() {
    try {
      const url = this.baseUrl.replace(/\/v1\/?$/, '') + '/health';
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) return await res.json();
    } catch (e) {
      try {
        const directRes = await fetch('http://localhost:5000/api/health');
        if (directRes.ok) return await directRes.json();
      } catch (err) {}
    }
    return null;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
