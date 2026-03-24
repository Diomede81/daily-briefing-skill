---
name: daily-briefing
description: Generate and send personalized daily briefing emails with AI-powered summarization. Transforms raw content (RSS, newsletters, YouTube transcripts, podcasts) into actionable insights with relevance scoring. Use when user asks for a daily briefing, morning summary, news digest, or wants to configure automated daily emails. Supports REST API for UI configuration, 8 source types, AI-powered summarization (GPT-4o-mini), and scheduled execution.
---

# Daily Briefing Skill

Generate personalized daily briefing emails with curated content and AI-powered insights.

## ✨ AI Summarization

Transform raw content into actionable insights! Instead of just titles and links, get:
- **🤖 AI-generated summaries** - 2-3 sentences highlighting key insights
- **📊 Relevance scoring** - Ranked 1-5 based on your interests  
- **🎯 Smart prioritization** - Most important content first
- **💡 Context-aware analysis** - Tailored to your work and projects

**Supported content types:**
- ✅ RSS feeds & blogs (analyzes descriptions)
- ✅ Email newsletters (summarizes previews)
- ✅ Podcasts (analyzes episode descriptions)
- ✅ YouTube videos (processes full transcripts up to 5000 chars)
- ✅ Web scraping (processes extracted content)

See [docs/ai-summarization.md](docs/ai-summarization.md) for complete documentation.

## Features

- 🤖 **AI Summarization** - GPT-4o-mini for concise, relevant summaries (~$0.001/brief)
- 📋 **Multiple briefs** - Morning summary, meeting prep, weekly digest
- ⏰ **Built-in scheduler** - Configure schedules via API
- 📡 **8 source types** - RSS, web, email, calendar, tasks, podcast, weather, YouTube
- ✅ **Source testing** - Validates before adding
- 📧 **Email delivery** - HTML via Microsoft Middleware
- 🔧 **Full REST API** - UI-ready endpoints
- 💰 **Cost effective** - ~$0.03/month for daily briefs

## Quick Start

```bash
# Install dependencies
npm install

# Add OpenAI API key (for AI summarization)
curl -X POST http://localhost:3021/api/tokens \
  -H "Content-Type: application/json" \
  -d '{"service": "OpenAI", "name": "OPENAI_API_KEY", "value": "sk-proj-..."}'

# Start API server (for UI configuration)
npm start
# → http://localhost:3020

# Run briefing immediately
node scripts/run-brief.js <briefId>
```

## Source Types

| Type | Icon | AI Summary | Description |
|------|------|------------|-------------|
| `rss` | 📡 | ✅ | RSS/Atom feeds from blogs, news sites, Substack |
| `web-json` | 🌐 | ✅ | Web pages with embedded JSON (Next.js, etc.) |
| `email` | 📧 | ✅ | Newsletter inbox scanning by sender |
| `podcast` | 🎙️ | ✅ | Podcast RSS feeds with episode info |
| `youtube` | 🎬 | ✅ | YouTube video transcripts |
| `calendar` | 📅 | ⏭️ | Calendar events from Microsoft (already formatted) |
| `tasks` | ✅ | ⏭️ | Tasks from Todoist or Microsoft To Do |
| `weather` | 🌤️ | ⏭️ | Weather forecast via wttr.in |

## AI Configuration

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

**Options:**
- `style`: `concise` (2-3 sentences) | `detailed` (4-5 sentences) | `bullets`
- `maxItemsPerSource`: Limit items per source (1-10)
- `prioritize`: Sort by `relevance` | `latest` | `all`
- `userContext`: Your interests for relevance scoring

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/briefs | List all briefs |
| POST | /api/briefs | Create brief |
| PUT | /api/briefs/:id | Update brief (including AI config) |
| DELETE | /api/briefs/:id | Delete brief |
| POST | /api/briefs/:id/run | Run brief now |
| GET | /api/briefs/:id/sources | List sources |
| POST | /api/briefs/:id/sources | Add source (auto-tests first) |
| DELETE | /api/briefs/:id/sources/:sourceId | Remove source |
| POST | /api/test/url | Test URL before adding |
| GET | /api/schedules | List scheduled jobs |
| GET | /api/status | Health and status |

## Example Configurations

### Morning Tech Brief with AI
```json
{
  "name": "Morning Tech Brief",
  "schedule": "0 7 * * 1-5",
  "delivery": {
    "agent": "max",
    "recipients": ["user@example.com"]
  },
  "aiSummary": {
    "enabled": true,
    "style": "concise",
    "userContext": "CTO interested in AI, SaaS, healthcare tech"
  },
  "sources": [
    {
      "name": "Hacker News",
      "type": "rss",
      "url": "https://news.ycombinator.com/rss"
    },
    {
      "name": "Today's Calendar",
      "type": "calendar",
      "config": {"agent": "luca", "days": 1}
    }
  ]
}
```

### YouTube Learning Brief
```json
{
  "name": "Daily Learning",
  "schedule": "0 20 * * *",
  "aiSummary": {
    "enabled": true,
    "style": "detailed",
    "userContext": "Business leader interested in entrepreneurship"
  },
  "sources": [
    {
      "name": "The Diary of a CEO",
      "type": "youtube",
      "url": "https://www.youtube.com/watch?v=VIDEO_ID",
      "config": {"maxChars": 5000}
    }
  ]
}
```

## Requirements

- **Node.js** 18+
- **Microsoft Middleware** on localhost:3007 (for email delivery)
- **OpenAI API key** (for AI summarization - optional but recommended)
- Agent configured with email permissions

## Files

```
daily-briefing-skill/
├── SKILL.md              # This file
├── README.md             # Full documentation
├── package.json          # Dependencies
├── config/
│   └── config.json       # Persisted configuration
├── scripts/
│   ├── server.js         # API server
│   ├── run-brief.js      # Brief runner
│   └── daily-briefing.js # Legacy runner
├── lib/
│   ├── config-manager.js # Config CRUD
│   ├── scheduler.js      # Built-in scheduler
│   ├── summarizer.js     # ✨ AI summarization engine
│   └── adapters/
│       └── index.js      # Source parsers (8 types)
└── docs/
    └── ai-summarization.md  # AI feature guide
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3020 | API server port |
| MIDDLEWARE_API | http://localhost:3007/api | Microsoft middleware URL |
| CONFIG_DIR | ./config | Config storage directory |
| TZ | Europe/London | Default timezone |

## Scheduling with OpenClaw Cron

Integrates with OpenClaw's cron system for persistent scheduling:

```bash
# Create/update cron job for a brief
curl -X POST http://localhost:3020/api/briefs/{id}/cron

# List all briefing cron jobs
curl http://localhost:3020/api/cron

# Run immediately
curl -X POST http://localhost:3020/api/briefs/{id}/cron/run
```

OpenClaw handles scheduling and runs jobs even if API server is stopped.

## Graceful Fallback

If AI summarization fails (no API key, API error, timeout):
- ✅ Briefs continue to work normally
- ✅ Shows original descriptions/previews
- ⚠️ Logs warning in console
- ✅ No interruption to delivery

**Cost:** ~$0.001 per brief using GPT-4o-mini (~$0.03/month for daily briefs)

## Documentation

- **[README.md](README.md)** - Full documentation with examples
- **[AI Summarization Guide](docs/ai-summarization.md)** - Complete AI feature docs
- **[Test Report](TEST_REPORT.md)** - Verification and test results

---

**Status:** ✅ Production-ready  
**Version:** 2.1.0 (with AI summarization)  
**Last updated:** 2026-03-24
