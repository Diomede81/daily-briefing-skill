/**
 * Built-in Scheduler
 * Manages cron jobs for multiple briefs
 */

const { CronJob } = require('cron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class Scheduler {
  constructor(configManager) {
    this.configManager = configManager;
    this.jobs = new Map(); // briefId -> CronJob
    this.timezone = process.env.TZ || 'Europe/London';
  }

  /**
   * Start all scheduled briefs
   */
  startAll() {
    const briefs = this.configManager.getBriefs();
    
    for (const brief of briefs) {
      if (brief.enabled && brief.schedule) {
        this.scheduleJob(brief);
      }
    }
    
    console.log(`📅 Scheduler started: ${this.jobs.size} jobs`);
  }

  /**
   * Stop all jobs
   */
  stopAll() {
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    console.log('📅 Scheduler stopped');
  }

  /**
   * Schedule a specific brief
   */
  scheduleJob(brief) {
    // Stop existing job if any
    if (this.jobs.has(brief.id)) {
      this.jobs.get(brief.id).stop();
    }

    if (!brief.schedule || !brief.enabled) {
      this.jobs.delete(brief.id);
      return null;
    }

    try {
      const job = new CronJob(
        brief.schedule,
        () => this.runBrief(brief.id),
        null,
        true,
        this.timezone
      );

      this.jobs.set(brief.id, job);
      console.log(`📅 Scheduled "${brief.name}": ${brief.schedule}`);
      
      return {
        id: brief.id,
        schedule: brief.schedule,
        nextRun: job.nextDate().toISO()
      };
    } catch (err) {
      console.error(`Failed to schedule "${brief.name}":`, err.message);
      return null;
    }
  }

  /**
   * Run a brief immediately
   */
  async runBrief(briefId) {
    console.log(`🚀 Running brief: ${briefId}`);
    
    const brief = this.configManager.getBrief(briefId);
    if (!brief) {
      console.error(`Brief not found: ${briefId}`);
      return { success: false, error: 'Brief not found' };
    }

    try {
      const scriptPath = path.join(__dirname, '..', 'scripts', 'run-brief.js');
      
      return new Promise((resolve) => {
        const child = spawn('node', [scriptPath, briefId], {
          cwd: path.join(__dirname, '..'),
          env: { ...process.env, BRIEF_ID: briefId }
        });

        let output = '';
        child.stdout.on('data', (data) => { output += data.toString(); });
        child.stderr.on('data', (data) => { output += data.toString(); });

        child.on('close', (code) => {
          const success = code === 0;
          
          this.configManager.recordBriefRun(briefId, {
            success,
            output: output.substring(0, 2000),
            timestamp: new Date().toISOString()
          });

          resolve({ success, exitCode: code, output });
        });
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get next run time for a brief
   */
  getNextRun(briefId) {
    const job = this.jobs.get(briefId);
    if (!job) return null;
    
    return job.nextDate().toISO();
  }

  /**
   * Get all scheduled jobs status
   */
  getStatus() {
    const status = [];
    
    for (const [id, job] of this.jobs) {
      const brief = this.configManager.getBrief(id);
      status.push({
        id,
        name: brief?.name || 'Unknown',
        schedule: brief?.schedule,
        running: job.running,
        nextRun: job.nextDate().toISO()
      });
    }
    
    return status;
  }

  /**
   * Reschedule a brief (after config change)
   */
  reschedule(briefId) {
    const brief = this.configManager.getBrief(briefId);
    if (brief) {
      return this.scheduleJob(brief);
    }
    return null;
  }

  /**
   * Remove a job
   */
  removeJob(briefId) {
    const job = this.jobs.get(briefId);
    if (job) {
      job.stop();
      this.jobs.delete(briefId);
    }
  }
}

module.exports = Scheduler;
