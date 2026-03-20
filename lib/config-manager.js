/**
 * Configuration Manager v2
 * Supports multiple briefs with different source configurations
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, '..', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default configuration
const DEFAULT_CONFIG = {
  version: '2.0.0',
  defaultTimezone: 'Europe/London',
  briefs: [],
  sourceTemplates: {}
};

// Default brief template
const DEFAULT_BRIEF = {
  name: 'Morning Brief',
  enabled: true,
  schedule: '0 7 * * *',
  timezone: 'Europe/London',
  delivery: {
    method: 'email',
    agent: 'max',
    recipients: []
  },
  sources: [],
  lastRun: null
};

class ConfigManager {
  constructor() {
    this.ensureConfigDir();
    this.config = this.load();
    
    // Migrate from v1 if needed
    if (!this.config.briefs && this.config.sources) {
      this.migrateFromV1();
    }
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

  migrateFromV1() {
    console.log('Migrating from v1 config...');
    const oldConfig = { ...this.config };
    
    this.config = {
      ...DEFAULT_CONFIG,
      briefs: [{
        id: 'default',
        name: 'Daily Brief',
        enabled: oldConfig.enabled !== false,
        schedule: oldConfig.schedule || '0 7 * * *',
        timezone: oldConfig.timezone || 'Europe/London',
        delivery: oldConfig.delivery || DEFAULT_BRIEF.delivery,
        sources: oldConfig.sources || [],
        lastRun: oldConfig.lastRun
      }]
    };
    
    this.save();
    console.log('Migration complete');
  }

  // ============== GLOBAL CONFIG ==============

  getConfig() {
    return { ...this.config };
  }

  updateGlobalConfig(updates) {
    this.config = {
      ...this.config,
      ...updates,
      briefs: this.config.briefs // Don't overwrite briefs
    };
    this.save();
    return this.config;
  }

  // ============== BRIEFS ==============

  getBriefs() {
    return this.config.briefs || [];
  }

  getBrief(id) {
    return this.config.briefs.find(b => b.id === id);
  }

  createBrief(brief) {
    const newBrief = {
      ...DEFAULT_BRIEF,
      ...brief,
      id: brief.id || randomUUID().substring(0, 8),
      createdAt: new Date().toISOString()
    };

    // Validate schedule
    if (newBrief.schedule && !this.isValidCron(newBrief.schedule)) {
      throw new Error('Invalid cron expression');
    }

    this.config.briefs.push(newBrief);
    this.save();
    return newBrief;
  }

  updateBrief(id, updates) {
    const index = this.config.briefs.findIndex(b => b.id === id);
    if (index === -1) {
      throw new Error('Brief not found');
    }

    // Validate schedule if provided
    if (updates.schedule && !this.isValidCron(updates.schedule)) {
      throw new Error('Invalid cron expression');
    }

    this.config.briefs[index] = {
      ...this.config.briefs[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.save();
    return this.config.briefs[index];
  }

  deleteBrief(id) {
    const index = this.config.briefs.findIndex(b => b.id === id);
    if (index === -1) {
      throw new Error('Brief not found');
    }

    this.config.briefs.splice(index, 1);
    this.save();
    return true;
  }

  recordBriefRun(briefId, result) {
    const index = this.config.briefs.findIndex(b => b.id === briefId);
    if (index !== -1) {
      this.config.briefs[index].lastRun = result;
      this.save();
    }
  }

  // ============== SOURCES (per brief) ==============

  getSources(briefId) {
    const brief = this.getBrief(briefId);
    return brief?.sources || [];
  }

  getSource(briefId, sourceId) {
    const brief = this.getBrief(briefId);
    return brief?.sources.find(s => s.id === sourceId);
  }

  addSource(briefId, source) {
    const brief = this.getBrief(briefId);
    if (!brief) {
      throw new Error('Brief not found');
    }

    const newSource = {
      id: randomUUID().substring(0, 8),
      ...source,
      enabled: true,
      createdAt: new Date().toISOString(),
      lastTest: null
    };

    brief.sources.push(newSource);
    this.save();
    return newSource;
  }

  updateSource(briefId, sourceId, updates) {
    const brief = this.getBrief(briefId);
    if (!brief) {
      throw new Error('Brief not found');
    }

    const index = brief.sources.findIndex(s => s.id === sourceId);
    if (index === -1) {
      throw new Error('Source not found');
    }

    brief.sources[index] = {
      ...brief.sources[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.save();
    return brief.sources[index];
  }

  deleteSource(briefId, sourceId) {
    const brief = this.getBrief(briefId);
    if (!brief) {
      throw new Error('Brief not found');
    }

    const index = brief.sources.findIndex(s => s.id === sourceId);
    if (index === -1) {
      throw new Error('Source not found');
    }

    brief.sources.splice(index, 1);
    this.save();
    return true;
  }

  // ============== HELPERS ==============

  isValidCron(expr) {
    // Basic cron validation (5 or 6 fields)
    const parts = expr.trim().split(/\s+/);
    return parts.length >= 5 && parts.length <= 6;
  }

  // Schedule presets for UI
  static getSchedulePresets() {
    return [
      { label: 'Every morning at 7 AM', value: '0 7 * * *' },
      { label: 'Every morning at 8 AM', value: '0 8 * * *' },
      { label: 'Weekday mornings at 7 AM', value: '0 7 * * 1-5' },
      { label: 'Weekday mornings at 8:30 AM', value: '30 8 * * 1-5' },
      { label: 'Every evening at 6 PM', value: '0 18 * * *' },
      { label: 'Sunday evening at 8 PM', value: '0 20 * * 0' },
      { label: 'Monday morning at 9 AM', value: '0 9 * * 1' },
      { label: 'Every 6 hours', value: '0 */6 * * *' },
      { label: 'Every hour', value: '0 * * * *' }
    ];
  }
}

module.exports = new ConfigManager();
module.exports.ConfigManager = ConfigManager;
