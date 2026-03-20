# Daily Briefing Skill v2

**OpenClaw/SuperAgents skill for automated daily briefings with scheduling and multiple source types**

Create multiple personalized briefings with built-in scheduling - no external cron needed.

## Features

- 📋 **Multiple briefs** - Morning summary, meeting prep, weekly digest, etc.
- ⏰ **Built-in scheduler** - Configure schedules via API, no cron needed
- 📡 **7 source types** - RSS, web, email, calendar, tasks, podcast, weather
- ✅ **Source testing** - Validates sources before adding
- 📧 **Email delivery** - Sends formatted HTML via Microsoft Middleware
- 🔧 **Full REST API** - Configure everything via API (SuperAgents compatible)

---

## Quick Start

```bash
# Clone
git clone https://github.com/Diomede81/daily-briefing-skill.git
cd daily-briefing-skill

# Install
npm install

# Start API server (includes scheduler)
npm start
# → http://localhost:3020
```

---

## Source Types

| Type | Icon | Description | Example |
|------|------|-------------|---------|
| `rss` | 📡 | RSS/Atom feeds | Substack, blogs, news |
| `web-json` | 🌐 | Web pages with JSON | The Verge, modern sites |
| `email` | 📧 | Newsletter inbox | Filter by sender |
| `calendar` | 📅 | Calendar events | Today's meetings |
| `tasks` | ✅ | Task lists | Todoist, Microsoft To Do |
| `podcast` | 🎙️ | Podcast episodes | Any podcast RSS |
| `weather` | 🌤️ | Weather forecast | Any location |

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
    "enabled": false
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
      "senders": ["therundown", "morningbrew"],
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

**Response:**
```json
{
  "presets": [
    {"label": "Every morning at 7 AM", "value": "0 7 * * *"},
    {"label": "Weekday mornings at 8:30 AM", "value": "30 8 * * 1-5"},
    {"label": "Sunday evening at 8 PM", "value": "0 20 * * 0"}
  ]
}
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

**Response:**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "briefs": {"total": 2, "enabled": 2},
  "scheduler": {
    "running": 2,
    "jobs": [...]
  },
  "sourceTypes": 7
}
```

---

## Agent Configuration Guide

### Step 1: Start the server
```bash
cd /path/to/daily-briefing-skill
npm install
npm start
```

### Step 2: Create a brief
```bash
curl -X POST http://localhost:3020/api/briefs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Brief",
    "schedule": "0 7 * * *",
    "delivery": {
      "agent": "max",
      "recipients": ["user@example.com"]
    }
  }'
```
Save the returned `id`.

### Step 3: Add sources
For each source, test first then add:

```bash
# Test URL
curl -X POST http://localhost:3020/api/test/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://news.ycombinator.com/rss"}'

# If successful, add to brief
curl -X POST http://localhost:3020/api/briefs/{id}/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hacker News",
    "type": "rss",
    "url": "https://news.ycombinator.com/rss"
  }'
```

### Step 4: Verify schedule
```bash
curl http://localhost:3020/api/schedules
```

### Step 5: Test run
```bash
curl -X POST http://localhost:3020/api/briefs/{id}/run \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

---

## Example Brief Configurations

### Morning Tech Brief
```bash
# Create brief
curl -X POST http://localhost:3020/api/briefs -H "Content-Type: application/json" \
  -d '{"name": "Morning Tech Brief", "schedule": "0 7 * * 1-5", "delivery": {"agent": "max", "recipients": ["me@work.com"]}}'

# Add sources
curl -X POST http://localhost:3020/api/briefs/{id}/sources -H "Content-Type: application/json" \
  -d '{"name": "Hacker News", "type": "rss", "url": "https://news.ycombinator.com/rss"}'

curl -X POST http://localhost:3020/api/briefs/{id}/sources -H "Content-Type: application/json" \
  -d '{"name": "Today'\''s Calendar", "type": "calendar", "config": {"agent": "luca", "days": 1}}'

curl -X POST http://localhost:3020/api/briefs/{id}/sources -H "Content-Type: application/json" \
  -d '{"name": "My Tasks", "type": "tasks", "config": {"provider": "todoist"}}'
```

### Weekly AI Digest
```bash
curl -X POST http://localhost:3020/api/briefs -H "Content-Type: application/json" \
  -d '{"name": "Weekly AI Digest", "schedule": "0 20 * * 0", "delivery": {"agent": "max", "recipients": ["me@home.com"]}}'

# Add AI-focused sources
curl -X POST http://localhost:3020/api/briefs/{id}/sources -H "Content-Type: application/json" \
  -d '{"name": "The Verge AI", "type": "web-json", "url": "https://www.theverge.com/ai-artificial-intelligence"}'

curl -X POST http://localhost:3020/api/briefs/{id}/sources -H "Content-Type: application/json" \
  -d '{"name": "Last Week in AI", "type": "podcast", "url": "https://lastweekinai.substack.com/feed"}'
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3020` | API server port |
| `MIDDLEWARE_API` | `http://localhost:3007/api` | Microsoft Middleware URL |
| `CONFIG_DIR` | `./config` | Config storage directory |
| `TZ` | `Europe/London` | Default timezone |
| `TODOIST_SCRIPT` | `/home/lucalicata/clawd/todoist.js` | Todoist CLI path |

---

## Requirements

- **Node.js** 18+
- **Microsoft Middleware** (for email/calendar/tasks) - optional but recommended

---

## File Structure

```
daily-briefing-skill/
├── SKILL.md              # OpenClaw skill metadata
├── README.md             # This file
├── package.json
├── config/
│   └── config.json       # Briefs and sources
├── scripts/
│   ├── server.js         # API server with scheduler
│   ├── daily-briefing.js # Legacy single-brief runner
│   └── run-brief.js      # Run specific brief by ID
└── lib/
    ├── config-manager.js # Multi-brief config management
    ├── scheduler.js      # Built-in cron scheduler
    └── adapters/
        └── index.js      # Source type parsers
```

---

## License

MIT
