#!/usr/bin/env node
/**
 * Daily Briefing API Server
 * SuperAgents-compatible REST API for configuration and management
 * 
 * Endpoints:
 *   GET  /api/config        - Get configuration
 *   PUT  /api/config        - Update configuration
 *   GET  /api/sources       - List sources
 *   POST /api/sources       - Add source (tests first)
 *   DELETE /api/sources/:id - Remove source
 *   POST /api/sources/:id/test - Test specific source
 *   POST /api/test          - Test all sources
 *   POST /api/test/url      - Test URL before adding
 *   POST /api/run           - Run briefing now
 *   GET  /api/status        - Health and status
 *   GET  /api/schema        - JSON Schema for UI
 */

const express = require('express');
const cors = require('cors');
const configManager = require('../lib/config-manager');
const adapters = require('../lib/adapters');

const app = express();
const PORT = process.env.PORT || 3020;

app.use(cors());
app.use(express.json());

// ============== CONFIGURATION ==============

// GET /api/config
app.get('/api/config', (req, res) => {
  res.json(configManager.getConfig());
});

// PUT /api/config
app.put('/api/config', (req, res) => {
  try {
    const config = configManager.updateConfig(req.body);
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============== SOURCES ==============

// GET /api/sources
app.get('/api/sources', (req, res) => {
  res.json({ sources: configManager.getSources() });
});

// POST /api/sources - Add new source (tests first)
app.post('/api/sources', async (req, res) => {
  const { name, type, url, config: sourceConfig } = req.body;

  if (!name || !type || !url) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, type, url'
    });
  }

  // Test the source first
  const testResult = await adapters.testSource({ type, url, config: sourceConfig });

  if (!testResult.success) {
    return res.status(400).json({
      success: false,
      error: `Source test failed: ${testResult.error}`,
      testResult
    });
  }

  // Add to config
  const source = configManager.addSource({
    name,
    type,
    url,
    config: sourceConfig,
    lastTest: {
      success: true,
      timestamp: new Date().toISOString(),
      itemCount: testResult.itemCount
    }
  });

  res.json({
    success: true,
    source,
    testResult: {
      itemCount: testResult.itemCount,
      sampleItems: testResult.sampleItems
    }
  });
});

// DELETE /api/sources/:id
app.delete('/api/sources/:id', (req, res) => {
  try {
    configManager.deleteSource(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// POST /api/sources/:id/test
app.post('/api/sources/:id/test', async (req, res) => {
  const source = configManager.getSource(req.params.id);
  
  if (!source) {
    return res.status(404).json({ success: false, error: 'Source not found' });
  }

  const result = await adapters.testSource(source);

  // Update last test result
  configManager.updateSource(req.params.id, {
    lastTest: {
      success: result.success,
      timestamp: new Date().toISOString(),
      itemCount: result.itemCount,
      error: result.error
    }
  });

  res.json(result);
});

// ============== TESTING ==============

// POST /api/test - Test all enabled sources
app.post('/api/test', async (req, res) => {
  const sources = configManager.getSources().filter(s => s.enabled);
  const results = [];

  for (const source of sources) {
    const result = await adapters.testSource(source);
    results.push({
      sourceId: source.id,
      sourceName: source.name,
      ...result
    });

    // Update last test
    configManager.updateSource(source.id, {
      lastTest: {
        success: result.success,
        timestamp: new Date().toISOString(),
        itemCount: result.itemCount,
        error: result.error
      }
    });
  }

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  res.json({
    success: failed === 0,
    results,
    summary: { total: sources.length, passed, failed }
  });
});

// POST /api/test/url - Test a URL before adding
app.post('/api/test/url', async (req, res) => {
  const { url, type } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL required' });
  }

  let result;
  if (type) {
    result = await adapters.testSource({ url, type, config: {} });
    result.detectedType = type;
  } else {
    result = await adapters.detectSourceType(url);
  }

  // Try to suggest a name from URL
  try {
    const urlObj = new URL(url);
    result.suggestedName = urlObj.hostname.replace('www.', '').split('.')[0];
    result.suggestedName = result.suggestedName.charAt(0).toUpperCase() + result.suggestedName.slice(1);
  } catch (e) {}

  res.json(result);
});

// ============== EXECUTION ==============

// POST /api/run - Run briefing now
app.post('/api/run', async (req, res) => {
  const { dryRun = false } = req.body;
  
  try {
    // Import and run the main briefing script
    const { spawn } = require('child_process');
    const scriptPath = require('path').join(__dirname, 'daily-briefing.js');
    
    const args = dryRun ? ['--dry-run'] : [];
    const child = spawn('node', [scriptPath, ...args], {
      cwd: require('path').join(__dirname, '..'),
      env: process.env
    });

    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { output += data.toString(); });

    child.on('close', (code) => {
      const success = code === 0;
      
      if (!dryRun) {
        configManager.recordRun({
          success,
          output: output.substring(0, 1000)
        });
      }

      res.json({
        success,
        dryRun,
        exitCode: code,
        output
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== STATUS ==============

// GET /api/status
app.get('/api/status', (req, res) => {
  const config = configManager.getConfig();
  const sources = configManager.getSources();

  res.json({
    status: 'ok',
    version: config.version || '1.0.0',
    enabled: config.enabled,
    schedule: config.schedule,
    lastRun: config.lastRun,
    nextRun: calculateNextRun(config.schedule),
    sources: {
      total: sources.length,
      enabled: sources.filter(s => s.enabled).length,
      healthy: sources.filter(s => s.lastTest?.success).length
    }
  });
});

function calculateNextRun(cronExpr) {
  // Simple next run calculation (approximate)
  try {
    const [min, hour] = cronExpr.split(' ');
    const now = new Date();
    const next = new Date();
    next.setHours(parseInt(hour) || 7, parseInt(min) || 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  } catch (e) {
    return null;
  }
}

// ============== SCHEMA ==============

// GET /api/schema
app.get('/api/schema', (req, res) => {
  res.json({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Daily Briefing Configuration",
    "type": "object",
    "properties": {
      "enabled": {
        "type": "boolean",
        "title": "Enabled",
        "default": true
      },
      "schedule": {
        "type": "string",
        "title": "Schedule (Cron)",
        "description": "When to send the briefing (cron expression)",
        "default": "0 7 * * *",
        "examples": ["0 7 * * *", "30 8 * * 1-5"]
      },
      "timezone": {
        "type": "string",
        "title": "Timezone",
        "default": "Europe/London"
      },
      "delivery": {
        "type": "object",
        "title": "Delivery Settings",
        "properties": {
          "method": {
            "type": "string",
            "enum": ["email"],
            "default": "email"
          },
          "agent": {
            "type": "string",
            "title": "Sending Agent",
            "description": "Microsoft middleware agent to send from"
          },
          "recipients": {
            "type": "array",
            "title": "Recipients",
            "items": { "type": "string", "format": "email" }
          }
        }
      },
      "sources": {
        "type": "array",
        "title": "Content Sources",
        "items": { "$ref": "#/definitions/source" }
      }
    },
    "definitions": {
      "source": {
        "type": "object",
        "required": ["name", "type", "url"],
        "properties": {
          "id": { "type": "string", "readOnly": true },
          "name": { "type": "string", "title": "Source Name" },
          "type": {
            "type": "string",
            "enum": ["rss", "web-json", "email"],
            "title": "Source Type"
          },
          "url": { "type": "string", "format": "uri", "title": "URL" },
          "enabled": { "type": "boolean", "default": true },
          "config": {
            "type": "object",
            "properties": {
              "maxItems": { "type": "integer", "minimum": 1, "maximum": 50 },
              "senders": { "type": "array", "items": { "type": "string" } },
              "agent": { "type": "string" }
            }
          }
        }
      }
    }
  });
});

// ============== START SERVER ==============

app.listen(PORT, () => {
  console.log(`📰 Daily Briefing API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/status`);
  console.log(`   Config: http://localhost:${PORT}/api/config`);
});
