/**
 * RailFlow Backend Configuration Module
 * Loads environment variables with strict fallbacks and defaults.
 */

const path = require('path');
const fs = require('fs');

// Ensure .env is loaded if dotenv is available or manually read
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (e) {
  // Manual loader fallback
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    });
  }
}

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  railRadar: {
    apiKey: process.env.RAILRADAR_API_KEY || '',
    baseUrl: process.env.RAILRADAR_API_BASE_URL || 'https://api.railradar.in/v1',
    timeoutMs: 6000
  },
  operationalDefaults: {
    maxSpeedKmH: 130,
    headwayMinutes: 12,
    cautionSpeedKmH: 30
  }
};

module.exports = config;
