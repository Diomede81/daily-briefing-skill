# Daily Briefing Skill v2 🤖

**OpenClaw/SuperAgents skill for automated daily briefings with AI-powered summarization**

Transform raw content into actionable insights! Get AI-generated summaries that highlight what matters most, automatically prioritized by relevance to your work.

---

## ✨ What's New: AI Summarization

Instead of just titles and links, get:
- **🤖 AI-generated summaries** - 2-3 sentences highlighting key insights
- **📊 Relevance scoring** - Ranked 1-5 based on your interests
- **🎯 Smart prioritization** - Most important content first
- **💡 Context-aware** - Tailored to your work and projects

**Example:**
```
📡 TechCrunch AI

OpenAI launches GPT-5 with breakthrough reasoning capabilities
📝 Summary: OpenAI's latest model introduces multi-step reasoning with 40% 
improvement over GPT-4. Relevant for business automation and care technology 
applications. Early access available for API customers.
→ Read more: [link]
```

See [docs/ai-summarization.md](docs/ai-summarization.md) for full details.

---

## Features

- 🤖 **AI Summarization** - GPT-4o-mini generates concise, relevant summaries
- 📋 **Multiple briefs** - Morning summary, meeting prep, weekly digest
- ⏰ **Built-in scheduler** - Configure schedules via API, no cron needed
- 📡 **8 source types** - RSS, web, email, calendar, tasks, podcast, weather, YouTube
- ✅ **Source testing** - Validates sources before adding
- 📧 **Email delivery** - Sends formatted HTML via Microsoft Middleware
- 🔧 **Full REST API** - Configure everything via API (SuperAgents compatible)
- 💰 **Cost effective** - ~$0.001 per brief using GPT-4o-mini

---

## Quick Start

```bash
# Clone
git clone https://github.com/Diomede81/daily-briefing-skill.git
cd daily-briefing-skill

# Install
npm install

# Add OpenAI API key (for AI summarization)
curl -X POST http://localhost:3021/api/tokens \
  -H "Content-Type: application/json" \
  -d '{"service": "OpenAI", "name": "OPENAI_API_KEY", "value": "sk-proj-..."}'

# Configuration (first time)
cp config/config.template.json config/config.json
# Edit config.json with your briefs, sources, and email addresses

# Start API server (includes scheduler)
npm start
# → http://localhost:3020

# Test a brief
node scripts/run-brief.js <briefId>
```

**Note:** `config/config.json` contains runtime state (lastRun timestamps, brief IDs) and is git-ignored. Use the template to set up your own configuration.

---

## Production Setup (systemd)

For automatic startup and restarts, set up a systemd service:

```bash
# Create service file
cat > ~/.config/systemd/user/daily-briefing-api.service << 'EOF'
[Unit]
Description=Daily Briefing API Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/YOUR_USER/path/to/daily-briefing-skill
ExecStart=/home/YOUR_USER/.nvm/versions/node/vX.X.X/bin/node scripts/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

Environment="NODE_ENV=production"
Environment="MIDDLEWARE_API=http://localhost:3007/api"

[Install]
WantedBy=default.target
EOF

# Update paths in the service file above, then:
systemctl --user daemon-reload
systemctl --user enable daily-briefing-api
systemctl --user start daily-briefing-api

# Check status
systemctl --user status daily-briefing-api

# View logs
journalctl --user -u daily-briefing-api -f
```

**Benefits:**
- Auto-starts on boot
- Auto-restarts if crashed
- Logs to systemd journal
- Managed lifecycle

---

## Source Types

| Type | Icon | Description | AI Summary | Example |
|------|------|-------------|------------|---------|
| `rss` | 📡 | RSS/Atom feeds (with attributes support) | ✅ Yes | Substack, blogs, The Verge |
| `web-json` | 🌐 | Web pages with JSON | ✅ Yes | Modern sites with Next.js |
| `email` | 📧 | Newsletter inbox (sender OR subject keywords) | ✅ Yes | Filter by sender + subject |
| `podcast` | 🎙️ | Podcast episodes | ✅ Yes | Any podcast RSS |
| `youtube` | 🎬 | YouTube transcripts | ✅ Yes | Full video transcript analysis |
| `calendar` | 📅 | Calendar events | ⏭️ Skipped | Today's meetings (already formatted) |
| `tasks` | ✅ | Task lists | ⏭️ Skipped | Todoist, Microsoft To Do |
| `weather` | 🌤️ | Weather forecast | ⏭️ Skipped | Any location (already structured) |

---

## AI Summarization Configuration

Enable AI summarization for any brief:

```bash
curl -X PUT http://localhost:3020/api/briefs/<briefId> \
  -H "Content-Type: application/json" \
  -d '{
    "aiSummary": {
      "enabled": true,
      "style": "concise",
      "maxItemsPerSource": 5,
      "prioritize": "relevance",
      "userContext": "Tech entrepreneur interested in AI, healthcare tech, and automation"
    }
  }'
```

### Configuration Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `enabled` | `true`/`false` | `true` | Enable/disable AI summarization |
| `style` | `concise`/`detailed`/`bullets` | `concise` | Summary style (2-3 vs 4-5 sentences) |
| `maxItemsPerSource` | `1-10` | `5` | Limit items per source |
| `prioritize` | `relevance`/`latest`/`all` | `relevance` | Sorting method |
| `userContext` | string | Tech/AI focus | Your interests for relevance scoring |

### Costs

Using GPT-4o-mini:
- ~$0.001 per brief (typical: 3 sources, 15 items)
- Monthly (30 briefs): ~$0.03
- Annual: ~$0.36

**Fallback:** If AI unavailable, briefs continue with original format (titles + links).

---

## API Reference

**Base URL:** `http://localhost:3020`

### Briefs

#### GET /api/briefs
List all briefs.

```bash
curl http://localhost:3020/api/briefs
```

#### POST /api/briefs
Create a new brief.

```bash
curl -X POST http://localhost:3020/api/briefs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Tech Brief",
    "schedule": "0 7 * * *",
    "timezone": "Europe/London",
    "delivery": {
      "agent": "max",
      "recipients": ["user@example.com"]
    },
    "aiSummary": {
      "enabled": true,
      "style": "concise",
      "userContext": "Your interests here"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "brief": {
    "id": "abc123",
    "name": "Morning Tech Brief",
    "enabled": true,
    "schedule": "0 7 * * *",
    "sources": [],
    "aiSummary": {
      "enabled": true,
      "style": "concise"
    },
    "createdAt": "2026-03-20T10:00:00Z"
  }
}
```

#### PUT /api/briefs/:id
Update a brief.

```bash
curl -X PUT http://localhost:3020/api/briefs/abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Brief Name",
    "enabled": false,
    "aiSummary": {
      "enabled": true,
      "style": "detailed"
    }
  }'
```

#### DELETE /api/briefs/:id
Delete a brief.

```bash
curl -X DELETE http://localhost:3020/api/briefs/abc123
```

#### POST /api/briefs/:id/run
Run a brief immediately.

```bash
# Run and send
curl -X POST http://localhost:3020/api/briefs/abc123/run

# Dry run (preview without sending)
curl -X POST http://localhost:3020/api/briefs/abc123/run \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

### Sources

#### GET /api/briefs/:id/sources
List sources for a brief.

```bash
curl http://localhost:3020/api/briefs/abc123/sources
```

#### POST /api/briefs/:id/sources
Add a source (auto-tests before saving).

```bash
# RSS Feed
curl -X POST http://localhost:3020/api/briefs/abc123/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hacker News",
    "type": "rss",
    "url": "https://news.ycombinator.com/rss",
    "config": {"maxItems": 10}
  }'

# YouTube Video Transcript
curl -X POST http://localhost:3020/api/briefs/abc123/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "The Diary of a CEO",
    "type": "youtube",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "config": {"maxChars": 5000}
  }'

# Calendar
curl -X POST http://localhost:3020/api/briefs/abc123/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Today'\''s Meetings",
    "type": "calendar",
    "config": {"agent": "luca", "days": 1}
  }'

# Email Newsletters
curl -X POST http://localhost:3020/api/briefs/abc123/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Newsletters",
    "type": "email",
    "config": {
      "agent": "luca",
      "senders": ["therundown", "morningbrew", "beehiiv"],
      "subjectKeywords": ["briefing", "news", "newsletter", "digest", "roundup", "update", "weekly", "daily"],
      "maxAge": "24h"
    }
  }'

# Tasks
curl -X POST http://localhost:3020/api/briefs/abc123/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Today'\''s Tasks",
    "type": "tasks",
    "config": {"provider": "todoist"}
  }'

# Podcast
curl -X POST http://localhost:3020/api/briefs/abc123/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Last Week in AI",
    "type": "podcast",
    "url": "https://lastweekinai.substack.com/feed",
    "config": {"maxItems": 3}
  }'

# Weather
curl -X POST http://localhost:3020/api/briefs/abc123/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "London Weather",
    "type": "weather",
    "config": {"location": "London", "units": "metric"}
  }'
```

#### DELETE /api/briefs/:id/sources/:sourceId
Remove a source.

```bash
curl -X DELETE http://localhost:3020/api/briefs/abc123/sources/xyz789
```

#### POST /api/briefs/:id/sources/:sourceId/test
Test a specific source.

```bash
curl -X POST http://localhost:3020/api/briefs/abc123/sources/xyz789/test
```

### Scheduling

#### GET /api/schedules
List all scheduled jobs.

```bash
curl http://localhost:3020/api/schedules
```

**Response:**
```json
{
  "schedules": [
    {
      "id": "abc123",
      "name": "Morning Tech Brief",
      "schedule": "0 7 * * *",
      "running": true,
      "nextRun": "2026-03-21T07:00:00.000Z"
    }
  ]
}
```

#### GET /api/schedules/presets
Get schedule presets for UI dropdowns.

```bash
curl http://localhost:3020/api/schedules/presets
```

#### POST /api/briefs/:id/schedule
Update brief schedule.

```bash
curl -X POST http://localhost:3020/api/briefs/abc123/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "30 8 * * 1-5",
    "enabled": true
  }'
```

### Testing

#### POST /api/test/url
Test a URL (auto-detect source type).

```bash
curl -X POST http://localhost:3020/api/test/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://techcrunch.com/feed/"}'
```

**Response:**
```json
{
  "success": true,
  "detectedType": "rss",
  "itemCount": 10,
  "sampleItems": [...],
  "suggestedName": "Techcrunch"
}
```

#### GET /api/source-types
List available source types with config schemas.

```bash
curl http://localhost:3020/api/source-types
```

### Status

#### GET /api/status
Health check and scheduler status.

```bash
curl http://localhost:3020/api/status
```

---

## Example Brief Configurations

### Morning Tech Brief (with AI)
```bash
# Create brief
curl -X POST http://localhost:3020/api/briefs -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Tech Brief",
    "schedule": "0 7 * * 1-5",
    "delivery": {"agent": "max", "recipients": ["me@work.com"]},
    "aiSummary": {
      "enabled": true,
      "style": "concise",
      "userContext": "CTO interested in AI, SaaS, healthcare tech, productivity tools"
    }
  }'

# Add sources
curl -X POST http://localhost:3020/api/briefs/{id}/sources -H "Content-Type: application/json" \
  -d '{"name": "Hacker News", "type": "rss", "url": "https://news.ycombinator.com/rss"}'

curl -X POST http://localhost:3020/api/briefs/{id}/sources -H "Content-Type: application/json" \
  -d '{"name": "Today'\''s Calendar", "type": "calendar", "config": {"agent": "luca", "days": 1}}'
```

### YouTube Learning Brief
```bash
curl -X POST http://localhost:3020/api/briefs -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Learning",
    "schedule": "0 20 * * *",
    "aiSummary": {
      "enabled": true,
      "style": "detailed",
      "userContext": "Business leader interested in entrepreneurship and leadership"
    }
  }'

curl -X POST http://localhost:3020/api/briefs/{id}/sources -H "Content-Type: application/json" \
  -d '{
    "name": "The Diary of a CEO",
    "type": "youtube",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "config": {"maxChars": 5000}
  }'
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3020` | API server port |
| `MIDDLEWARE_API` | `http://localhost:3007/api` | Microsoft Middleware URL |
| `CONFIG_DIR` | `./config` | Config storage directory |
| `TZ` | `Europe/London` | Default timezone |
| `TODOIST_SCRIPT` | `todoist` | Todoist CLI command or script path |

---

## Requirements

- **Node.js** 18+
- **Microsoft Middleware** (for email/calendar/tasks) - optional but recommended
- **OpenAI API key** (for AI summarization) - optional but recommended

---

## Documentation

- **[AI Summarization Guide](docs/ai-summarization.md)** - Complete feature documentation
- **[Test Report](TEST_REPORT.md)** - Verification and test results
- **[Quick Reference](QUICK_REFERENCE.md)** - Common commands cheat sheet

---

## File Structure

```
daily-briefing-skill/
├── SKILL.md              # OpenClaw skill metadata
├── README.md             # This file
├── package.json
├── config/
│   ├── config.json       # Briefs and sources (runtime state)
│   └── config.template.json
├── scripts/
│   ├── server.js         # API server with scheduler
│   ├── daily-briefing.js # Legacy single-brief runner
│   └── run-brief.js      # Run specific brief by ID
├── lib/
│   ├── config-manager.js # Multi-brief config management
│   ├── scheduler.js      # Built-in cron scheduler
│   ├── summarizer.js     # ✨ AI summarization engine
│   └── adapters/
│       └── index.js      # Source type parsers
└── docs/
    └── ai-summarization.md  # AI feature guide
```

---

## License

MIT

---

## Credits

Created for OpenClaw/SuperAgents by Max (Luca's AI assistant)

**Contributors:**
- AI Summarization: March 2024
- YouTube Support: March 2024
- Multi-brief architecture: January 2024
