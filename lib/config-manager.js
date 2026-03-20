/**
 * Configuration Manager
 * Handles CRUD operations for skill configuration
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, '..', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default configuration
const DEFAULT_CONFIG = {
  enabled: true,
  schedule: '0 7 * * *',
  timezone: 'Europe/London',
  delivery: {
    method: 'email',
    agent: 'max',
    recipients: []
  },
  sources: [],
  lastRun: null,
  version: '1.0.0'
};

class ConfigManager {
  constructor() {
    this.ensureConfigDir();
    this.config = this.load();
  }

  ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  load() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (err) {
      console.error('Failed to load config:', err.message);
    }
    return { ...DEFAULT_CONFIG };
  }

  save() {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      return true;
    } catch (err) {
      console.error('Failed to save config:', err.message);
      return false;
    }
  }

  // Get full config
  getConfig() {
    return { ...this.config };
  }

  // Update config (partial update)
  updateConfig(updates) {
    // Validate schedule if provided
    if (updates.schedule && !this.isValidCron(updates.schedule)) {
      throw new Error('Invalid cron expression');
    }

    // Merge updates
    this.config = {
      ...this.config,
      ...updates,
      delivery: {
        ...this.config.delivery,
        ...(updates.delivery || {})
      }
    };

    this.save();
    return this.config;
  }

  isValidCron(expr) {
    // Basic cron validation (5 or 6 fields)
    const parts = expr.trim().split(/\s+/);
    return parts.length >= 5 && parts.length <= 6;
  }

  // Source management
  getSources() {
    return this.config.sources || [];
  }

  getSource(id) {
    return this.config.sources.find(s => s.id === id);
  }

  addSource(source) {
    const newSource = {
      id: randomUUID().substring(0, 8),
      ...source,
      enabled: true,
      createdAt: new Date().toISOString(),
      lastTest: null
    };

    this.config.sources.push(newSource);
    this.save();
    return newSource;
  }

  updateSource(id, updates) {
    const index = this.config.sources.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error('Source not found');
    }

    this.config.sources[index] = {
      ...this.config.sources[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.save();
    return this.config.sources[index];
  }

  deleteSource(id) {
    const index = this.config.sources.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error('Source not found');
    }

    this.config.sources.splice(index, 1);
    this.save();
    return true;
  }

  // Record run result
  recordRun(result) {
    this.config.lastRun = {
      timestamp: new Date().toISOString(),
      ...result
    };
    this.save();
  }
}

module.exports = new ConfigManager();
