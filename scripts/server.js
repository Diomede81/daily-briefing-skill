#!/usr/bin/env node
/**
 * Daily Briefing API Server v2
 * 
 * Features:
 * - Multiple briefs support
 * - Built-in scheduler (no external cron needed)
 * - Source type variety (RSS, email, calendar, tasks, podcast, weather)
 * 
 * Endpoints:
 * 
 * BRIEFS:
 *   GET  /api/briefs              - List all briefs
 *   POST /api/briefs              - Create a brief
 *   GET  /api/briefs/:id          - Get brief details
 *   PUT  /api/briefs/:id          - Update brief
 *   DELETE /api/briefs/:id        - Delete brief
 *   POST /api/briefs/:id/run      - Run brief now
 * 
 * SOURCES (per brief):
 *   GET  /api/briefs/:id/sources       - List sources
 *   POST /api/briefs/:id/sources       - Add source (tests first)
 *   DELETE /api/briefs/:id/sources/:sid - Remove source
 *   POST /api/briefs/:id/sources/:sid/test - Test source
 * 
 * SCHEDULES:
 *   GET  /api/schedules           - List all scheduled jobs
 *   GET  /api/schedules/presets   - Get schedule presets
 *   POST /api/briefs/:id/schedule - Update brief schedule
 * 
 * TESTING:
 *   POST /api/test/url            - Test URL (auto-detect type)
 *   GET  /api/source-types        - List available source types
 * 
 * STATUS:
 *   GET  /api/status              - Health and status
 *   GET  /api/schema              - JSON Schema for UI
 */

const express = require('express');
const cors = require('cors');
const configManager = require('../lib/config-manager');
const adapters = require('../lib/adapters');
const Scheduler = require('../lib/scheduler');

const app = express();
const PORT = process.env.PORT || 3020;

// Initialize scheduler
const scheduler = new Scheduler(configManager);

app.use(cors());
app.use(express.json());

// ============== BRIEFS ==============

// GET /api/briefs - List all briefs
app.get('/api/briefs', (req, res) => {
  const briefs = configManager.getBriefs().map(b => ({
    ...b,
    nextRun: scheduler.getNextRun(b.id)
  }));
  res.json({ briefs });
});

// POST /api/briefs - Create a new brief
app.post('/api/briefs', (req, res) => {
  try {
    const brief = configManager.createBrief(req.body);
    
    // Schedule if enabled
    if (brief.enabled && brief.schedule) {
      scheduler.scheduleJob(brief);
    }
    
    res.json({ success: true, brief });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/briefs/:id - Get brief details
app.get('/api/briefs/:id', (req, res) => {
  const brief = configManager.getBrief(req.params.id);
  if (!brief) {
    return res.status(404).json({ success: false, error: 'Brief not found' });
  }
  
  res.json({
    ...brief,
    nextRun: scheduler.getNextRun(brief.id)
  });
});

// PUT /api/briefs/:id - Update brief
app.put('/api/briefs/:id', (req, res) => {
  try {
    const brief = configManager.updateBrief(req.params.id, req.body);
    
    // Reschedule
    scheduler.reschedule(brief.id);
    
    res.json({ success: true, brief });
  } catch (err) {
    res.status(err.message === 'Brief not found' ? 404 : 400)
      .json({ success: false, error: err.message });
  }
});

// DELETE /api/briefs/:id - Delete brief
app.delete('/api/briefs/:id', (req, res) => {
  try {
    scheduler.removeJob(req.params.id);
    configManager.deleteBrief(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// POST /api/briefs/:id/run - Run brief immediately
app.post('/api/briefs/:id/run', async (req, res) => {
  const { dryRun = false } = req.body;
  
  const brief = configManager.getBrief(req.params.id);
  if (!brief) {
    return res.status(404).json({ success: false, error: 'Brief not found' });
  }

  // Collect content from all sources
  const results = [];
  for (const source of brief.sources.filter(s => s.enabled)) {
    const result = await adapters.testSource(source);
    results.push({
      sourceId: source.id,
      sourceName: source.name,
      type: source.type,
      ...result
    });
  }

  if (dryRun) {
    return res.json({
      success: true,
      dryRun: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        totalItems: results.reduce((sum, r) => sum + (r.itemCount || 0), 0)
      }
    });
  }

  // Actually run the brief
  const runResult = await scheduler.runBrief(req.params.id);
  res.json({
    success: runResult.success,
    dryRun: false,
    ...runResult
  });
});

// ============== SOURCES ==============

// GET /api/briefs/:id/sources - List sources for a brief
app.get('/api/briefs/:id/sources', (req, res) => {
  const sources = configManager.getSources(req.params.id);
  res.json({ sources });
});

// POST /api/briefs/:id/sources - Add source (tests first)
app.post('/api/briefs/:id/sources', async (req, res) => {
  const { name, type, url, config: sourceConfig } = req.body;

  if (!name || !type) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, type'
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

  try {
    const source = configManager.addSource(req.params.id, {
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
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// DELETE /api/briefs/:id/sources/:sid - Remove source
app.delete('/api/briefs/:id/sources/:sid', (req, res) => {
  try {
    configManager.deleteSource(req.params.id, req.params.sid);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// POST /api/briefs/:id/sources/:sid/test - Test specific source
app.post('/api/briefs/:id/sources/:sid/test', async (req, res) => {
  const source = configManager.getSource(req.params.id, req.params.sid);
  
  if (!source) {
    return res.status(404).json({ success: false, error: 'Source not found' });
  }

  const result = await adapters.testSource(source);

  // Update last test result
  configManager.updateSource(req.params.id, req.params.sid, {
    lastTest: {
      success: result.success,
      timestamp: new Date().toISOString(),
      itemCount: result.itemCount,
      error: result.error
    }
  });

  res.json(result);
});

// ============== SCHEDULES ==============

// GET /api/schedules - List all scheduled jobs
app.get('/api/schedules', (req, res) => {
  res.json({ schedules: scheduler.getStatus() });
});

// GET /api/schedules/presets - Get schedule presets for UI
app.get('/api/schedules/presets', (req, res) => {
  res.json({ 
    presets: configManager.constructor.getSchedulePresets()
  });
});

// POST /api/briefs/:id/schedule - Update brief schedule
app.post('/api/briefs/:id/schedule', (req, res) => {
  const { schedule, enabled } = req.body;
  
  try {
    const updates = {};
    if (schedule !== undefined) updates.schedule = schedule;
    if (enabled !== undefined) updates.enabled = enabled;
    
    const brief = configManager.updateBrief(req.params.id, updates);
    const scheduleResult = scheduler.reschedule(brief.id);
    
    res.json({
      success: true,
      brief,
      nextRun: scheduleResult?.nextRun || null
    });
  } catch (err) {
    res.status(err.message === 'Brief not found' ? 404 : 400)
      .json({ success: false, error: err.message });
  }
});

// ============== TESTING ==============

// POST /api/test/url - Test a URL (auto-detect type)
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

// GET /api/source-types - List available source types
app.get('/api/source-types', (req, res) => {
  res.json({ types: adapters.getSourceTypes() });
});

// ============== OPENCLAW CRON ==============

const { execSync } = require('child_process');
const EXEC_OPTS = { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 };

// Helper: run openclaw cron command
function runCronCmd(args) {
  try {
    const result = execSync(`openclaw cron ${args}`, EXEC_OPTS);
    return { success: true, output: result };
  } catch (err) {
    return { success: false, error: err.stderr || err.message };
  }
}

// GET /api/cron - List OpenClaw cron jobs for briefings
app.get('/api/cron', (req, res) => {
  try {
    const result = execSync('openclaw cron list --json 2>/dev/null || echo "[]"', EXEC_OPTS);
    const jobs = JSON.parse(result);
    const briefingJobs = (jobs.jobs || jobs || []).filter(j => 
      j.name?.startsWith('daily-briefing-') || j.name === 'daily-briefing'
    );
    res.json({ success: true, jobs: briefingJobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/briefs/:id/cron - Create/update OpenClaw cron job for a brief
app.post('/api/briefs/:id/cron', async (req, res) => {
  const brief = configManager.getBrief(req.params.id);
  if (!brief) {
    return res.status(404).json({ success: false, error: 'Brief not found' });
  }

  if (!brief.schedule) {
    return res.status(400).json({ success: false, error: 'Brief has no schedule configured' });
  }

  const jobName = `daily-briefing-${brief.id}`;
  
  try {
    // Check if job exists and remove it
    const listResult = execSync('openclaw cron list --json 2>/dev/null || echo "[]"', EXEC_OPTS);
    const jobs = JSON.parse(listResult);
    const existingJob = (jobs.jobs || jobs || []).find(j => j.name === jobName);
    
    if (existingJob) {
      execSync(`openclaw cron rm "${existingJob.id}" 2>/dev/null`, EXEC_OPTS);
    }

    // Build delivery target
    const deliveryTo = brief.delivery?.recipients?.join(', ') || 'configured recipients';
    
    // Create cron job
    const jobPayload = {
      name: jobName,
      schedule: {
        kind: 'cron',
        expr: brief.schedule,
        tz: brief.timezone || 'Europe/London'
      },
      payload: {
        kind: 'agentTurn',
        message: `Run the daily briefing "${brief.name}" (ID: ${brief.id}). Use the daily-briefing skill to run this brief and send to ${deliveryTo}.`,
        timeoutSeconds: 300
      },
      sessionTarget: 'isolated',
      enabled: brief.enabled !== false
    };

    const addResult = execSync(
      `openclaw cron add '${JSON.stringify(jobPayload)}' 2>&1`,
      EXEC_OPTS
    );

    res.json({
      success: true,
      message: existingJob ? 'Cron job updated' : 'Cron job created',
      jobName,
      schedule: brief.schedule,
      timezone: brief.timezone || 'Europe/London',
      output: addResult.trim()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/briefs/:id/cron - Remove OpenClaw cron job for a brief
app.delete('/api/briefs/:id/cron', (req, res) => {
  const jobName = `daily-briefing-${req.params.id}`;
  
  try {
    const listResult = execSync('openclaw cron list --json 2>/dev/null || echo "[]"', EXEC_OPTS);
    const jobs = JSON.parse(listResult);
    const existingJob = (jobs.jobs || jobs || []).find(j => j.name === jobName);
    
    if (!existingJob) {
      return res.status(404).json({ success: false, error: 'No cron job found for this brief' });
    }

    execSync(`openclaw cron rm "${existingJob.id}" 2>/dev/null`, EXEC_OPTS);
    
    res.json({ success: true, message: 'Cron job removed', jobName });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/briefs/:id/cron/run - Trigger OpenClaw cron job immediately
app.post('/api/briefs/:id/cron/run', (req, res) => {
  const jobName = `daily-briefing-${req.params.id}`;
  
  try {
    const listResult = execSync('openclaw cron list --json 2>/dev/null || echo "[]"', EXEC_OPTS);
    const jobs = JSON.parse(listResult);
    const existingJob = (jobs.jobs || jobs || []).find(j => j.name === jobName);
    
    if (!existingJob) {
      return res.status(404).json({ success: false, error: 'No cron job found for this brief' });
    }

    execSync(`openclaw cron run "${existingJob.id}" 2>/dev/null`, EXEC_OPTS);
    
    res.json({ success: true, message: 'Cron job triggered', jobId: existingJob.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== STATUS ==============

// GET /api/status
app.get('/api/status', (req, res) => {
  const briefs = configManager.getBriefs();
  const schedules = scheduler.getStatus();

  res.json({
    status: 'ok',
    version: '2.0.0',
    briefs: {
      total: briefs.length,
      enabled: briefs.filter(b => b.enabled).length
    },
    scheduler: {
      running: schedules.length,
      jobs: schedules
    },
    sourceTypes: adapters.getSourceTypes().length
  });
});

// ============== SCHEMA ==============

// GET /api/schema
app.get('/api/schema', (req, res) => {
  res.json({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Daily Briefing Configuration",
    "definitions": {
      "brief": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "id": { "type": "string", "readOnly": true },
          "name": { "type": "string", "title": "Brief Name" },
          "enabled": { "type": "boolean", "default": true },
          "schedule": {
            "type": "string",
            "title": "Schedule (Cron)",
            "description": "When to send the brief"
          },
          "timezone": {
            "type": "string",
            "title": "Timezone",
            "default": "Europe/London"
          },
          "delivery": {
            "type": "object",
            "properties": {
              "method": { "type": "string", "enum": ["email"], "default": "email" },
              "agent": { "type": "string", "title": "Sending Agent" },
              "recipients": {
                "type": "array",
                "items": { "type": "string", "format": "email" }
              }
            }
          },
          "sources": {
            "type": "array",
            "items": { "$ref": "#/definitions/source" }
          }
        }
      },
      "source": {
        "type": "object",
        "required": ["name", "type"],
        "properties": {
          "id": { "type": "string", "readOnly": true },
          "name": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["rss", "web-json", "email", "calendar", "tasks", "podcast", "weather"]
          },
          "url": { "type": "string" },
          "enabled": { "type": "boolean", "default": true },
          "config": { "type": "object" }
        }
      }
    },
    "schedulePresets": configManager.constructor.getSchedulePresets(),
    "sourceTypes": adapters.getSourceTypes()
  });
});

// ============== LEGACY ENDPOINTS (backward compatibility) ==============

// GET /api/config - Legacy: returns first brief as config
app.get('/api/config', (req, res) => {
  const briefs = configManager.getBriefs();
  const brief = briefs[0] || {};
  res.json({
    enabled: brief.enabled,
    schedule: brief.schedule,
    timezone: brief.timezone,
    delivery: brief.delivery,
    sources: brief.sources,
    lastRun: brief.lastRun,
    version: '2.0.0',
    _note: 'This is a legacy endpoint. Use /api/briefs for full functionality.'
  });
});

// GET /api/sources - Legacy: returns sources from first brief
app.get('/api/sources', (req, res) => {
  const briefs = configManager.getBriefs();
  const sources = briefs[0]?.sources || [];
  res.json({ sources });
});

// ============== START SERVER ==============

app.listen(PORT, () => {
  console.log(`📰 Daily Briefing API v2 running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/status`);
  console.log(`   Briefs: http://localhost:${PORT}/api/briefs`);
  console.log(`   Source types: http://localhost:${PORT}/api/source-types`);
  
  // Start scheduler
  scheduler.startAll();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  scheduler.stopAll();
  process.exit(0);
});
