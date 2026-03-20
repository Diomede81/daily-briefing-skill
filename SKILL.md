---
name: daily-briefing
description: Generate and send personalized daily briefing emails with AI news, newsletters, and curated content. Use when user asks for a daily briefing, morning summary, news digest, or wants to configure automated daily emails. Supports REST API for UI configuration, custom sources (RSS, web, email), and scheduled cron execution.
---

# Daily Briefing Skill

Generate personalized daily briefing emails with curated AI news and newsletter content.

## Quick Start

```bash
# Install dependencies
npm install

# Start API server (for UI configuration)
npm start
# → http://localhost:3020

# Run briefing immediately
npm run run

# Dry run (no email sent)
npm run run:dry
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/config | Get full configuration |
| PUT | /api/config | Update configuration |
| GET | /api/sources | List all sources |
| POST | /api/sources | Add source (tests first) |
| DELETE | /api/sources/:id | Remove source |
| POST | /api/sources/:id/test | Test specific source |
| POST | /api/test | Test all sources |
| POST | /api/test/url | Test URL before adding |
| POST | /api/run | Run briefing now |
| GET | /api/status | Health and status |
| GET | /api/schema | JSON Schema for UI |

## Configuration

### Via API
```bash
# Get current config
curl http://localhost:3020/api/config

# Update schedule
curl -X PUT http://localhost:3020/api/config \
  -H "Content-Type: application/json" \
  -d '{"schedule": "0 8 * * *"}'

# Add a source (tests automatically)
curl -X POST http://localhost:3020/api/sources \
  -H "Content-Type: application/json" \
  -d '{"name": "TechCrunch", "type": "rss", "url": "https://techcrunch.com/feed/"}'

# Test all sources
curl -X POST http://localhost:3020/api/test
```

### Source Types

| Type | Use For | Config Options |
|------|---------|----------------|
| `rss` | RSS/Atom feeds | `maxItems` |
| `web-json` | Sites with __NEXT_DATA__ | `maxItems`, `jsonPath` |
| `email` | Newsletter inbox | `agent`, `senders`, `maxAge` |

### Example: Add RSS Source
```json
{
  "name": "Hacker News",
  "type": "rss",
  "url": "https://news.ycombinator.com/rss",
  "config": { "maxItems": 10 }
}
```

### Example: Add Email Source
```json
{
  "name": "Newsletters",
  "type": "email",
  "url": "inbox",
  "config": {
    "agent": "luca",
    "senders": ["therundown", "morningbrew"],
    "maxAge": "24h"
  }
}
```

## Requirements

- **Node.js** 18+
- **Microsoft Middleware** on localhost:3007 (for email delivery)
- Agent configured with email permissions

## Files

```
daily-briefing-skill/
├── SKILL.md              # This file
├── package.json          # Dependencies
├── config/
│   └── config.json       # Persisted configuration
├── scripts/
│   ├── server.js         # API server
│   └── daily-briefing.js # Main runner
└── lib/
    ├── config-manager.js # Config CRUD
    └── adapters/
        └── index.js      # Source parsers
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3020 | API server port |
| MIDDLEWARE_API | http://localhost:3007/api | Microsoft middleware URL |
| CONFIG_DIR | ./config | Config storage directory |

## Scheduling

Use cron to run on schedule:
```bash
0 7 * * * cd /path/to/skill && node scripts/daily-briefing.js >> /var/log/briefing.log 2>&1
```

Or configure via API and use a job runner.
