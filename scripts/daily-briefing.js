#!/usr/bin/env node
/**
 * Daily Briefing Script
 * Generates and sends personalized daily briefing emails
 * 
 * Sources:
 * - User's inbox newsletters (via Microsoft Middleware)
 * - The Verge AI news
 * - Last Week in AI (Substack)
 * 
 * Requirements:
 * - Microsoft Middleware API running on localhost:3007
 * - Node.js 18+
 * 
 * Usage:
 *   node daily-briefing.js           # Send briefing
 *   node daily-briefing.js --dry-run # Preview without sending
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============== CONFIGURATION ==============
const CONFIG = {
  // Microsoft Middleware API endpoint
  MIDDLEWARE_API: process.env.MIDDLEWARE_API || 'http://localhost:3007/api',
  
  // Agent to send emails from
  SEND_FROM_AGENT: process.env.SEND_FROM_AGENT || 'max',
  
  // Recipient email address
  SEND_TO: process.env.SEND_TO || 'llicata@tulip-tech.com',
  
  // Agent whose inbox to scan for newsletters
  INBOX_AGENT: process.env.INBOX_AGENT || 'luca',
  
  // Directory to save briefing summaries (optional)
  MEMORY_DIR: process.env.MEMORY_DIR || null,
};

// Newsletter senders to look for (case-insensitive substring match on email/name)
const NEWSLETTER_SENDERS = [
  'therundown',
  'rundown',
  'beehiiv',
  'agentai',
  'morningbrew',
  'platformer',
  'axios',
  'newsletter',
  'digest',
  'daily',
];

// ============== NEWSLETTERS ==============
async function getNewsletters() {
  console.log('📧 Scanning inbox for newsletters...');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const resp = await fetch(`${CONFIG.MIDDLEWARE_API}/email/list/${CONFIG.INBOX_AGENT}?top=50`);
    const data = await resp.json();
    if (data.error) throw new Error(`Email fetch failed: ${data.error.message || data.error}`);
    
    const newsletters = data.filter(e => {
      const receivedDate = new Date(e.receivedDateTime);
      const isRecent = receivedDate >= new Date(yesterday);
      const addr = (e.from?.emailAddress?.address || '').toLowerCase();
      const name = (e.from?.emailAddress?.name || '').toLowerCase();
      return isRecent && NEWSLETTER_SENDERS.some(sender => 
        addr.includes(sender) || name.includes(sender)
      );
    });
    
    console.log(`   Found ${newsletters.length} newsletters`);
    
    // Fetch full content for each newsletter
    for (let i = 0; i < newsletters.length; i++) {
      try {
        const fullResp = await fetch(`${CONFIG.MIDDLEWARE_API}/email/read/${CONFIG.INBOX_AGENT}/${newsletters[i].id}`);
        const full = await fullResp.json();
        newsletters[i].fullBody = full.body;
      } catch (e) {
        console.log(`   ⚠️ Could not fetch full body for ${newsletters[i].subject}`);
      }
    }
    
    return newsletters;
  } catch (err) {
    console.log(`   ⚠️ Newsletter fetch failed: ${err.message}`);
    return [];
  }
}

// ============== THE VERGE AI NEWS ==============
async function getAINews() {
  console.log('🤖 Fetching AI news from The Verge...');
  try {
    const html = execSync(
      'curl -sL "https://www.theverge.com/ai-artificial-intelligence" --max-time 30 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"',
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    const articles = [];
    
    // Extract JSON data from __NEXT_DATA__
    const jsonMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        const posts = jsonData?.props?.pageProps?.hydration?.responses?.[0]?.data?.node?.posts?.nodes || [];
        
        for (const post of posts.slice(0, 8)) {
          if (post.title && post.title.length > 10) {
            articles.push({
              title: post.title,
              url: post.permalink || 'https://www.theverge.com/ai-artificial-intelligence',
              author: post.authors?.[0]?.name || 'The Verge',
              date: post.publishedAt || ''
            });
          }
        }
      } catch (parseErr) {
        console.log(`   ⚠️ JSON parse failed: ${parseErr.message}`);
      }
    }
    
    // Fallback: extract titles from JSON strings
    if (articles.length === 0) {
      const titleRegex = /"title":\s*"([^"]{20,150})"/g;
      let match;
      while ((match = titleRegex.exec(html)) !== null && articles.length < 8) {
        const title = match[1]
          .replace(/\\u0026/g, '&')
          .replace(/\\u003c/g, '<')
          .replace(/\\u003e/g, '>')
          .replace(/\\/g, '');
        
        if (!title.toLowerCase().includes('ai')) continue;
        if (title.includes('thumbnail') || title.includes('Verge')) continue;
        
        if (!articles.some(a => a.title === title)) {
          articles.push({ title, url: 'https://www.theverge.com/ai-artificial-intelligence' });
        }
      }
    }
    
    console.log(`   Found ${articles.length} articles`);
    return articles;
  } catch (err) {
    console.log(`   ⚠️ AI news fetch failed: ${err.message}`);
    return [];
  }
}

// ============== LAST WEEK IN AI (SUBSTACK) ==============
async function getLastWeekInAI() {
  console.log('🎙️ Checking Last Week in AI...');
  try {
    const rss = execSync(
      'curl -sL "https://lastweekinai.substack.com/feed" --max-time 20 -A "Mozilla/5.0"',
      { encoding: 'utf8' }
    );
    
    const episodes = [];
    const items = rss.split('<item>').slice(1, 4);
    
    for (const item of items) {
      const titleMatch = item.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>|<title>([^<]+)<\/title>/);
      const linkMatch = item.match(/<link>([^<]+)<\/link>/);
      
      if (titleMatch) {
        const title = (titleMatch[1] || titleMatch[2]).trim();
        const link = linkMatch ? linkMatch[1].trim() : 'https://lastweekinai.substack.com/';
        episodes.push({ title, link, isRecent: true });
      }
    }
    
    console.log(`   Found ${episodes.length} articles`);
    return episodes;
  } catch (err) {
    console.log(`   ⚠️ Last Week in AI fetch failed: ${err.message}`);
    return [];
  }
}

// ============== BUILD HTML EMAIL ==============
function buildEmailHTML(newsletters, aiNews, lastWeekInAI) {
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
    .article { margin: 12px 0; padding: 12px; border-left: 3px solid #28a745; background: white; }
    .article a { color: #007bff; text-decoration: none; font-weight: 500; }
    .article a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 12px; margin-top: 5px; }
    a { color: #007bff; }
    hr { border: none; border-top: 1px solid #eee; margin: 30px 0; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; }
    .empty { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
  <h1>🌅 Daily Briefing</h1>
  <p style="color: #666; margin-top: -20px;">${date}</p>`;

  // Newsletters
  html += '<h2>📰 Newsletters</h2>';
  if (newsletters.length > 0) {
    for (const n of newsletters) {
      const time = new Date(n.receivedDateTime).toLocaleString('en-GB', {
        timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit'
      });
      html += `<div class="source">`;
      html += `<strong>${n.subject}</strong>`;
      html += `<div class="meta">From: ${n.from?.emailAddress?.name || n.from?.emailAddress?.address} • ${time}</div>`;
      
      if (n.fullBody && n.fullBody.content) {
        let textContent = n.fullBody.content
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 1500);
        html += `<p style="margin-top: 10px; font-size: 14px; line-height: 1.6;">${textContent}...</p>`;
      } else if (n.bodyPreview) {
        html += `<p style="margin-top: 10px; font-size: 14px;">${n.bodyPreview}</p>`;
      }
      html += `</div>`;
    }
  } else {
    html += '<p class="empty">No newsletters received in the last 24 hours.</p>';
  }

  // AI News
  html += '<h2>🤖 AI News (The Verge)</h2>';
  if (aiNews.length > 0) {
    html += '<div class="source">';
    for (const article of aiNews) {
      html += `<div class="article"><a href="${article.url}">${article.title}</a>`;
      if (article.author) {
        html += `<div class="meta">By ${article.author}</div>`;
      }
      html += `</div>`;
    }
    html += '</div>';
  } else {
    html += '<p class="empty">Unable to fetch AI news today.</p>';
  }

  // Last Week in AI
  html += '<h2>🎙️ Last Week in AI</h2>';
  if (lastWeekInAI.length > 0) {
    html += '<div class="source">';
    for (const ep of lastWeekInAI) {
      html += `<div class="article"><a href="${ep.link}">${ep.title}</a></div>`;
    }
    html += '<p style="margin-top: 15px;"><a href="https://lastweekinai.substack.com/">📰 Read more on Substack</a></p></div>';
  } else {
    html += '<p class="empty">Could not fetch Last Week in AI articles.</p>';
  }

  html += `<hr>
  <p class="footer">Generated at ${new Date().toLocaleString('en-GB', {timeZone: 'Europe/London'})}</p>
  </div>
</body></html>`;

  return html;
}

// ============== SEND EMAIL ==============
async function sendEmail(html, dryRun = false) {
  const subject = `Daily Briefing - ${new Date().toLocaleDateString('en-GB')}`;
  
  if (dryRun) {
    console.log('📤 DRY RUN - Would send email:');
    console.log(`   To: ${CONFIG.SEND_TO}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   From agent: ${CONFIG.SEND_FROM_AGENT}`);
    return true;
  }
  
  console.log(`📤 Sending email to ${CONFIG.SEND_TO}...`);
  
  try {
    const sendResp = await fetch(`${CONFIG.MIDDLEWARE_API}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: CONFIG.SEND_FROM_AGENT,
        to: CONFIG.SEND_TO,
        subject: subject,
        body: html
      })
    });
    
    const sendResult = await sendResp.json();
    if (!sendResult.success) {
      throw new Error(sendResult.error || 'Send failed');
    }
    console.log('   ✅ Email sent successfully');
    return true;
  } catch (err) {
    console.log(`   ❌ Email send failed: ${err.message}`);
    return false;
  }
}

// ============== SAVE TO MEMORY ==============
function saveToMemory(newsletters, aiNews, lastWeekInAI) {
  if (!CONFIG.MEMORY_DIR) return;
  
  const date = new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });
  const dateStr = new Date().toISOString().split('T')[0];
  
  const mdContent = `# Daily Briefing - ${date}\n\n` +
    `## Newsletters (${newsletters.length})\n` + 
    newsletters.map(n => `- ${n.subject} (${n.from?.emailAddress?.name || 'Unknown'})`).join('\n') + '\n\n' +
    `## AI News (${aiNews.length})\n` + 
    aiNews.map(a => `- [${a.title}](${a.url})`).join('\n') + '\n\n' +
    `## Last Week in AI (${lastWeekInAI.length})\n` + 
    lastWeekInAI.map(e => `- [${e.title}](${e.link})`).join('\n');
  
  try {
    fs.mkdirSync(CONFIG.MEMORY_DIR, { recursive: true });
    fs.writeFileSync(path.join(CONFIG.MEMORY_DIR, `${dateStr}.md`), mdContent);
    console.log('   ✅ Saved to memory');
  } catch (err) {
    console.log(`   ⚠️ Memory save failed: ${err.message}`);
  }
}

// ============== MAIN ==============
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🌅 Starting Daily Briefing...');
  if (dryRun) console.log('   (DRY RUN MODE)\n');
  else console.log('');
  
  // Gather content
  const newsletters = await getNewsletters();
  const aiNews = await getAINews();
  const lastWeekInAI = await getLastWeekInAI();
  
  // Build and send
  const html = buildEmailHTML(newsletters, aiNews, lastWeekInAI);
  await sendEmail(html, dryRun);
  
  // Save summary
  saveToMemory(newsletters, aiNews, lastWeekInAI);
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Newsletters: ${newsletters.length}`);
  console.log(`   AI News: ${aiNews.length}`);
  console.log(`   Last Week in AI: ${lastWeekInAI.length}`);
  console.log('\n✅ Daily briefing complete!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
