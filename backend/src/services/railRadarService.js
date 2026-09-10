/**
 * RailRadar API Client Service
 * Communicates securely with https://api.railradar.in/v1
 * Keep API keys strictly on the backend.
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const config = require('../config');

class RailRadarService {
  constructor() {
    this.apiKey = config.railRadar.apiKey;
    this.baseUrl = config.railRadar.baseUrl;
  }

  getApiKey() {
    if (this.apiKey) return this.apiKey;
    if (process.env.RAILRADAR_API_KEY) return process.env.RAILRADAR_API_KEY;

    // Hot-reload dynamically from .env if updated while server is running
    try {
      const envPath = path.join(__dirname, '..', '..', '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^RAILRADAR_API_KEY\s*=\s*([^\r\n#]+)/m);
        if (match && match[1]) {
          const val = match[1].trim().replace(/^["']|["']$/g, '');
          if (val) {
            process.env.RAILRADAR_API_KEY = val;
            this.apiKey = val;
            return val;
          }
        }
      }
    } catch (e) {}

    return '';
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Core request dispatcher with error, timeout and rate-limit handling
   */
  async request(endpoint, queryParams = {}) {
    const key = this.getApiKey();

    const qs = Object.entries(queryParams)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const fullUrl = `${this.baseUrl}${endpoint}${qs ? '?' + qs : ''}`;

    return new Promise((resolve) => {
      if (!key) {
        return resolve({
          success: false,
          error: {
            code: 'API_KEY_MISSING',
            message: 'RAILRADAR_API_KEY environment variable is not configured on backend.'
          },
          liveDataAvailable: false
        });
      }

      try {
        const urlObj = new URL(fullUrl);
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Accept': 'application/json',
            'User-Agent': 'RailFlow-MVP/1.0'
          },
          timeout: config.railRadar.timeoutMs || 6000
        };

        const req = https.request(options, (res) => {
          let rawData = '';

          res.on('data', (chunk) => {
            rawData += chunk;
          });

          res.on('end', () => {
            let parsed;
            try {
              parsed = JSON.parse(rawData);
            } catch (err) {
              return resolve({
                success: false,
                statusCode: res.statusCode,
                error: {
                  code: 'MALFORMED_RESPONSE',
                  message: 'Received invalid JSON response from RailRadar API.'
                },
                liveDataAvailable: false
              });
            }

            if (res.statusCode === 200 && parsed.success) {
              return resolve({
                success: true,
                statusCode: 200,
                data: parsed.data,
                meta: parsed.meta,
                liveDataAvailable: true
              });
            } else if (res.statusCode === 429) {
              return resolve({
                success: false,
                statusCode: 429,
                error: {
                  code: 'RATE_LIMITED',
                  message: 'RailRadar API rate limit exceeded (plan quota reached).'
                },
                liveDataAvailable: false
              });
            } else if (res.statusCode === 401) {
              return resolve({
                success: false,
                statusCode: 401,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Invalid or unauthorized RAILRADAR_API_KEY.'
                },
                liveDataAvailable: false
              });
            } else {
              return resolve({
                success: false,
                statusCode: res.statusCode,
                error: parsed.error || {
                  code: `HTTP_${res.statusCode}`,
                  message: parsed.message || 'RailRadar API request failed'
                },
                liveDataAvailable: false
              });
            }
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            error: {
              code: 'TIMEOUT',
              message: 'RailRadar API request timed out (upstream latency).'
            },
            liveDataAvailable: false
          });
        });

        req.on('error', (err) => {
          resolve({
            success: false,
            error: {
              code: 'NETWORK_ERROR',
              message: `Network failure contacting RailRadar: ${err.message}`
            },
            liveDataAvailable: false
          });
        });

        req.end();
      } catch (err) {
        resolve({
          success: false,
          error: {
            code: 'CLIENT_ERROR',
            message: err.message
          },
          liveDataAvailable: false
        });
      }
    });
  }

  /**
   * 1. Trains Between Stations API
   * GET /v1/trains/between/{from}/{to}
   */
  async getTrainsBetweenStations(fromCode, toCode, options = {}) {
    const from = encodeURIComponent((fromCode || '').toUpperCase().trim());
    const to = encodeURIComponent((toCode || '').toUpperCase().trim());
    const query = {
      date: options.date,
      type: options.type,
      category: options.category,
      live: options.live !== undefined ? options.live : true
    };
    return this.request(`/trains/between/${from}/${to}`, query);
  }

  /**
   * 2. Train Schedule & Timetable API
   * GET /v1/trains/{number}
   */
  async getTrainDetails(trainNumber, options = {}) {
    const num = encodeURIComponent(String(trainNumber).trim());
    const query = {
      haltsOnly: options.haltsOnly !== undefined ? options.haltsOnly : false
    };
    return this.request(`/trains/${num}`, query);
  }

  async getTrainSchedule(trainNumber, options = {}) {
    return this.getTrainDetails(trainNumber, options);
  }

  /**
   * 3. Live Train Running Status API
   * GET /v1/trains/{number}/live
   */
  async getLiveTrainStatus(trainNumber, options = {}) {
    const num = encodeURIComponent(String(trainNumber).trim());
    const query = {
      date: options.date,
      authoritative: options.authoritative || false,
      haltsOnly: options.haltsOnly !== undefined ? options.haltsOnly : false
    };
    return this.request(`/trains/${num}/live`, query);
  }

  /**
   * 4. Train Route Geometry (GIS) API
   * GET /v1/trains/{number}/route
   */
  async getTrainRouteGeometry(trainNumber, options = {}) {
    const num = encodeURIComponent(String(trainNumber).trim());
    const query = {
      format: options.format || 'geojson',
      stops: options.stops !== undefined ? options.stops : true
    };
    return this.request(`/trains/${num}/route`, query);
  }
}

module.exports = new RailRadarService();
