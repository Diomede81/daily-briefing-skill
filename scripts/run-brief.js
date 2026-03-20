#!/usr/bin/env node
/**
 * Run a specific brief by ID
 * Called by scheduler or manually
 * 
 * Usage: node run-brief.js <briefId>
 */

const fs = require('fs');
const path = require('path');
const configManager = require('../lib/config-manager');
const adapters = require('../lib/adapters');

const MIDDLEWARE_API = process.env.MIDDLEWARE_API || 'http://localhost:3007/api';

async function runBrief(briefId) {
  console.log(`🚀 Running brief: ${briefId}`);
  
  const brief = configManager.getBrief(briefId);
  if (!brief) {
    console.error(`Brief not found: ${briefId}`);
    process.exit(1);
  }

  console.log(`📋 Brief: ${brief.name}`);
  console.log(`📧 Recipients: ${brief.delivery?.recipients?.join(', ') || 'None configured'}`);

  // Collect content from all enabled sources
  const sections = [];
  
  for (const source of brief.sources.filter(s => s.enabled)) {
    console.log(`📡 Fetching: ${source.name} (${source.type})`);
    
    const result = await adapters.testSource(source);
    
    if (result.success && result.items?.length > 0) {
      sections.push({
        name: source.name,
        type: source.type,
        icon: getSourceIcon(source.type),
        items: result.items
      });
      console.log(`   ✅ ${result.itemCount} items`);
    } else {
      console.log(`   ⚠️ Failed: ${result.error || 'No items'}`);
    }
  }

  if (sections.length === 0) {
    console.log('❌ No content collected');
    process.exit(1);
  }

  // Build HTML email
  const html = buildEmailHTML(brief, sections);

  // Send email
  if (!brief.delivery?.recipients?.length) {
    console.log('⚠️ No recipients configured - skipping email');
    console.log('\n📊 Preview:');
    console.log(sections.map(s => `  ${s.icon} ${s.name}: ${s.items.length} items`).join('\n'));
    process.exit(0);
  }

  const subject = `${brief.name} - ${new Date().toLocaleDateString('en-GB')}`;
  
  try {
    const sendResp = await fetch(`${MIDDLEWARE_API}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: brief.delivery.agent || 'max',
        to: brief.delivery.recipients.join(','),
        subject: subject,
        body: html
      })
    });
    
    const sendResult = await sendResp.json();
    if (!sendResult.success) {
      throw new Error(sendResult.error || 'Send failed');
    }
    
    console.log('✅ Email sent successfully');
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    process.exit(1);
  }

  console.log('\n📊 Summary:');
  console.log(`   Sections: ${sections.length}`);
  console.log(`   Total items: ${sections.reduce((sum, s) => sum + s.items.length, 0)}`);
  console.log('✅ Brief complete!');
}

function getSourceIcon(type) {
  const icons = {
    'rss': '📡',
    'web-json': '🌐',
    'email': '📧',
    'calendar': '📅',
    'tasks': '✅',
    'podcast': '🎙️',
    'weather': '🌤️'
  };
  return icons[type] || '📄';
}

function buildEmailHTML(brief, sections) {
  const date = new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });
  
  let html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #1a1a1a; border-bottom: 3px solid #007bff; padding-bottom: 15px; margin-bottom: 25px; }
    h2 { color: #007bff; margin-top: 30px; border-left: 4px solid #007bff; padding-left: 15px; }
    .source { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0; }
    .item { margin: 12px 0; padding: 12px; border-left: 3px solid #28a745; background: white; }
    .item a { color: #007bff; text-decoration: none; font-weight: 500; }
    .item a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 12px; margin-top: 5px; }
    .calendar-item { border-left-color: #6f42c1; }
    .task-item { border-left-color: #fd7e14; }
    .weather-item { border-left-color: #20c997; }
    hr { border: none; border-top: 1px solid #eee; margin: 30px 0; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
  <h1>${brief.name}</h1>
  <p style="color: #666; margin-top: -20px;">${date}</p>`;

  for (const section of sections) {
    html += `<h2>${section.icon} ${section.name}</h2>`;
    html += '<div class="source">';
    
    for (const item of section.items) {
      const itemClass = getItemClass(section.type);
      
      if (section.type === 'calendar') {
        const start = new Date(item.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const end = new Date(item.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        html += `<div class="item ${itemClass}">`;
        html += `<strong>${start} - ${end}</strong>: ${item.title}`;
        if (item.location) html += `<div class="meta">📍 ${item.location}</div>`;
        if (item.isOnline && item.joinUrl) html += `<div class="meta"><a href="${item.joinUrl}">Join meeting</a></div>`;
        html += `</div>`;
      } else if (section.type === 'tasks') {
        const status = item.completed ? '☑️' : '⬜';
        html += `<div class="item ${itemClass}">`;
        html += `${status} ${item.title}`;
        if (item.due) html += `<div class="meta">Due: ${item.due}</div>`;
        html += `</div>`;
      } else if (section.type === 'weather') {
        html += `<div class="item ${itemClass}">`;
        html += `<strong>${item.title}</strong> - ${item.temperature}`;
        html += `<div class="meta">Humidity: ${item.humidity} | Wind: ${item.wind}</div>`;
        if (item.forecast) {
          html += '<div style="margin-top: 10px;">';
          for (const day of item.forecast) {
            html += `<span style="margin-right: 15px;">${day.date}: ${day.high}/${day.low}</span>`;
          }
          html += '</div>';
        }
        html += `</div>`;
      } else if (section.type === 'podcast') {
        html += `<div class="item">`;
        html += `<a href="${item.url}">${item.title}</a>`;
        if (item.duration) html += ` <span style="color: #666;">(${item.duration})</span>`;
        if (item.description) html += `<div class="meta">${item.description}</div>`;
        html += `</div>`;
      } else {
        // Default for rss, web-json, email
        html += `<div class="item">`;
        if (item.url) {
          html += `<a href="${item.url}">${item.title}</a>`;
        } else {
          html += `<strong>${item.title}</strong>`;
        }
        if (item.from) html += `<div class="meta">From: ${item.from}</div>`;
        if (item.author) html += `<div class="meta">By ${item.author}</div>`;
        if (item.preview) html += `<div class="meta">${item.preview}</div>`;
        html += `</div>`;
      }
    }
    
    html += '</div>';
  }

  html += `<hr>
  <p class="footer">Generated at ${new Date().toLocaleString('en-GB', {timeZone: brief.timezone || 'Europe/London'})}</p>
  </div>
</body></html>`;

  return html;
}

function getItemClass(type) {
  const classes = {
    'calendar': 'calendar-item',
    'tasks': 'task-item',
    'weather': 'weather-item'
  };
  return classes[type] || '';
}

// Main
const briefId = process.argv[2] || process.env.BRIEF_ID;
if (!briefId) {
  console.error('Usage: node run-brief.js <briefId>');
  process.exit(1);
}

runBrief(briefId).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
