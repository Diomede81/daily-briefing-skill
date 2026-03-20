---
name: daily-briefing
description: Generate and send personalized daily briefing emails with AI news, newsletters, and curated content. Use when: user asks for a daily briefing, morning summary, news digest, or wants to set up automated daily emails with AI/tech news. Supports custom sources, email delivery via Microsoft 365, and scheduled cron execution.
---

# Daily Briefing Skill

Generate personalized daily briefing emails with curated AI news and newsletter content.

## Quick Start

```bash
# Run briefing now (sends email immediately)
node scripts/daily-briefing.js

# Test without sending (dry run)
node scripts/daily-briefing.js --dry-run

# Schedule daily at 7 AM
(crontab -l 2>/dev/null; echo "0 7 * * * $(which node) $(pwd)/scripts/daily-briefing.js >> ~/briefing.log 2>&1") | crontab -
```

## Requirements

- **Microsoft Middleware API** running on `localhost:3007` (for email send/receive)
- **Node.js** 18+
- Agent configured in middleware with email permissions

## Configuration

Edit `scripts/daily-briefing.js` to customize:

### Email Settings
```javascript
const CONFIG = {
  MIDDLEWARE_API: 'http://localhost:3007/api',
  SEND_FROM_AGENT: 'max',           // Middleware agent name
  SEND_TO: 'user@example.com',       // Recipient email
  INBOX_AGENT: 'luca',               // Agent whose inbox to scan for newsletters
};
```

### Newsletter Sources
```javascript
const NEWSLETTER_SENDERS = [
  'therundown',      // The Rundown AI
  'morningbrew',     // Morning Brew
  'platformer',      // Platformer
  'axios',           // Axios
  // Add more sender keywords...
];
```

### News Sources
The script fetches from:
1. **The Verge AI** - Extracts articles from theverge.com/ai-artificial-intelligence
2. **Last Week in AI** - Substack newsletter (lastweekinai.substack.com)

## Output

Sends an HTML email containing:
1. **📰 Newsletters** - Recent newsletters from configured senders (last 24h)
2. **🤖 AI News** - Latest articles from The Verge AI section
3. **🎙️ Last Week in AI** - Recent posts from the Substack

Also saves a markdown summary to `memory/daily-briefing/YYYY-MM-DD.md`.

## Customization

### Add Custom News Source

Add a new async function following this pattern:

```javascript
async function getCustomSource() {
  console.log('📡 Fetching from Custom Source...');
  try {
    const html = execSync('curl -sL "https://example.com/feed" --max-time 20', { encoding: 'utf8' });
    // Parse and return array of { title, url, author? }
    return articles;
  } catch (err) {
    console.log(`   ⚠️ Custom source failed: ${err.message}`);
    return [];
  }
}
```

Then add to `buildAndSendBriefing()` and update the HTML template.

### Change Schedule

```bash
# View current cron
crontab -l | grep briefing

# Remove existing
crontab -l | grep -v briefing | crontab -

# Add new schedule (e.g., 8:30 AM)
(crontab -l 2>/dev/null; echo "30 8 * * * /path/to/node /path/to/daily-briefing.js") | crontab -
```

## Troubleshooting

### "Email send failed"
- Check middleware is running: `curl http://localhost:3007/health`
- Verify agent has email permissions in middleware config
- Check agent token is valid: `ms-middleware token-device <agent>`

### "No newsletters found"
- Verify `INBOX_AGENT` is correct
- Check `NEWSLETTER_SENDERS` matches your subscriptions
- Confirm emails exist in last 24 hours

### "AI news fetch failed"
- The Verge structure may have changed - check if JSON extraction still works
- Try increasing curl timeout
- Check network connectivity

## Files

- `scripts/daily-briefing.js` - Main script (run directly or via cron)
