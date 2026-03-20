# Daily Briefing Skill

**OpenClaw/SuperAgents skill for automated daily briefing emails**

Generate personalized daily briefing emails with curated AI news, newsletters, and content from configurable sources.

## Features

- 📰 **Newsletter scanning** - Scans email inbox for newsletters from configurable senders
- 🤖 **Web scraping** - Extracts articles from sites with JSON data (Next.js, etc.)
- 📡 **RSS feeds** - Parses any RSS/Atom feed
- 📧 **Email delivery** - Sends formatted HTML briefings via Microsoft Middleware
- 🔧 **REST API** - Full configuration via API (no CLI required)
- ✅ **Source testing** - Validates sources before adding

---

## Quick Start

```bash
# Clone
git clone https://github.com/Diomede81/daily-briefing-skill.git
cd daily-briefing-skill

# Install
npm install

# Start API server
npm start
# → http://localhost:3020

# Run briefing immediately
npm run run

# Dry run (preview without sending)
npm run run:dry
```

---

## API Reference

**Base URL:** `http://localhost:3020`

### Configuration

#### GET /api/config
Returns full configuration.

```bash
curl http://localhost:3020/api/config
```

**Response:**
```json
{
  "enabled": true,
  "schedule": "0 7 * * *",
  "timezone": "Europe/London",
  "delivery": {
    "method": "email",
    "agent": "max",
    "recipients": ["user@example.com"]
  },
  "sources": [...],
  "lastRun": null,
  "version": "1.0.0"
}
```

#### PUT /api/config
Update configuration (partial update supported).

```bash
curl -X PUT http://localhost:3020/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 8 * * *",
    "delivery": {
      "recipients": ["newuser@example.com"]
    }
  }'
```

### Sources

#### GET /api/sources
List all configured sources.

```bash
curl http://localhost:3020/api/sources
```

**Response:**
```json
{
  "sources": [
    {
      "id": "abc123",
      "name": "TechCrunch",
      "type": "rss",
      "url": "https://techcrunch.com/feed/",
      "enabled": true,
      "lastTest": {
        "success": true,
        "timestamp": "2026-03-20T10:00:00Z",
        "itemCount": 10
      }
    }
  ]
}
```

#### POST /api/sources
Add a new source. **Automatically tests before saving** - fails if source can't be fetched.

```bash
curl -X POST http://localhost:3020/api/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hacker News",
    "type": "rss",
    "url": "https://news.ycombinator.com/rss",
    "config": {
      "maxItems": 10
    }
  }'
```

**Success Response:**
```json
{
  "success": true,
  "source": {
    "id": "xyz789",
    "name": "Hacker News",
    "type": "rss",
    "url": "https://news.ycombinator.com/rss",
    "enabled": true
  },
  "testResult": {
    "itemCount": 10,
    "sampleItems": [
      {"title": "Article 1", "url": "..."},
      {"title": "Article 2", "url": "..."}
    ]
  }
}
```

**Failure Response (source couldn't be fetched):**
```json
{
  "success": false,
  "error": "Source test failed: Connection timeout",
  "testResult": {
    "success": false,
    "error": "Connection timeout"
  }
}
```

#### DELETE /api/sources/:id
Remove a source.

```bash
curl -X DELETE http://localhost:3020/api/sources/abc123
```

#### POST /api/sources/:id/test
Test a specific source without modifying config.

```bash
curl -X POST http://localhost:3020/api/sources/abc123/test
```

**Response:**
```json
{
  "success": true,
  "itemCount": 8,
  "sampleItems": [...],
  "responseTime": 1234
}
```

### Testing

#### POST /api/test
Test all enabled sources.

```bash
curl -X POST http://localhost:3020/api/test
```

**Response:**
```json
{
  "success": true,
  "results": [
    {"sourceId": "abc", "sourceName": "TechCrunch", "success": true, "itemCount": 10},
    {"sourceId": "xyz", "sourceName": "HN", "success": false, "error": "Timeout"}
  ],
  "summary": {"total": 2, "passed": 1, "failed": 1}
}
```

#### POST /api/test/url
Test a URL before adding as source. Auto-detects source type if not specified.

```bash
# With explicit type
curl -X POST http://localhost:3020/api/test/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/feed.xml", "type": "rss"}'

# Auto-detect type
curl -X POST http://localhost:3020/api/test/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/feed.xml"}'
```

**Response:**
```json
{
  "success": true,
  "detectedType": "rss",
  "itemCount": 15,
  "sampleItems": [...],
  "suggestedName": "Example"
}
```

### Execution

#### POST /api/run
Run the briefing immediately.

```bash
# Send briefing now
curl -X POST http://localhost:3020/api/run

# Dry run (no email sent)
curl -X POST http://localhost:3020/api/run \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Response:**
```json
{
  "success": true,
  "dryRun": false,
  "exitCode": 0,
  "output": "🌅 Starting Daily Briefing...\n..."
}
```

### Status

#### GET /api/status
Health check and execution status.

```bash
curl http://localhost:3020/api/status
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "enabled": true,
  "schedule": "0 7 * * *",
  "lastRun": {
    "timestamp": "2026-03-20T07:00:00Z",
    "success": true
  },
  "nextRun": "2026-03-21T07:00:00Z",
  "sources": {
    "total": 3,
    "enabled": 3,
    "healthy": 2
  }
}
```

### Schema

#### GET /api/schema
JSON Schema for UI form generation.

```bash
curl http://localhost:3020/api/schema
```

---

## Source Types

### RSS (`type: "rss"`)
Standard RSS/Atom feed parser.

```json
{
  "name": "Hacker News",
  "type": "rss",
  "url": "https://news.ycombinator.com/rss",
  "config": {
    "maxItems": 10
  }
}
```

**Works with:** Any RSS/Atom feed, Substack, WordPress, most blogs.

### Web JSON (`type: "web-json"`)
Extracts articles from sites with embedded JSON (Next.js `__NEXT_DATA__`, etc.)

```json
{
  "name": "The Verge AI",
  "type": "web-json",
  "url": "https://www.theverge.com/ai-artificial-intelligence",
  "config": {
    "maxItems": 8
  }
}
```

**Works with:** Next.js sites, The Verge, many modern news sites.

### Email (`type: "email"`)
Scans inbox for newsletters from specific senders.

```json
{
  "name": "Newsletters",
  "type": "email",
  "url": "inbox",
  "config": {
    "agent": "luca",
    "senders": ["therundown", "morningbrew", "axios"],
    "maxAge": "24h"
  }
}
```

**Requires:** Microsoft Middleware running on localhost:3007.

**Config options:**
- `agent` - Microsoft Middleware agent name to scan inbox
- `senders` - Array of sender keywords (matches email address or name)
- `maxAge` - How far back to look: `24h`, `48h`, `7d`, etc.

---

## Agent Configuration Guide

**For AI agents configuring this skill:**

### Step 1: Start the server
```bash
cd /path/to/daily-briefing-skill
npm install
npm start
```

### Step 2: Configure delivery
```bash
curl -X PUT http://localhost:3020/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "delivery": {
      "agent": "max",
      "recipients": ["user@example.com"]
    }
  }'
```

### Step 3: Add sources
Test URL first, then add if successful:
```bash
# Test
curl -X POST http://localhost:3020/api/test/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://news.ycombinator.com/rss"}'

# Add (only if test succeeded)
curl -X POST http://localhost:3020/api/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hacker News",
    "type": "rss", 
    "url": "https://news.ycombinator.com/rss"
  }'
```

### Step 4: Test all sources
```bash
curl -X POST http://localhost:3020/api/test
```

### Step 5: Run a test briefing
```bash
curl -X POST http://localhost:3020/api/run \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

### Step 6: Schedule with cron
```bash
# Add to crontab (runs at 7 AM daily)
(crontab -l 2>/dev/null; echo "0 7 * * * cd /path/to/skill && node scripts/daily-briefing.js >> /var/log/briefing.log 2>&1") | crontab -
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3020` | API server port |
| `MIDDLEWARE_API` | `http://localhost:3007/api` | Microsoft Middleware URL |
| `CONFIG_DIR` | `./config` | Config storage directory |

---

## Requirements

- **Node.js** 18+
- **Microsoft Middleware** (for email delivery) - https://github.com/Diomede81/openclaw_microsoft_middleware

---

## File Structure

```
daily-briefing-skill/
├── SKILL.md              # OpenClaw skill metadata
├── README.md             # This file
├── package.json
├── config/
│   └── config.json       # Persisted configuration
├── scripts/
│   ├── server.js         # API server (npm start)
│   └── daily-briefing.js # Main runner (npm run run)
└── lib/
    ├── config-manager.js # Config CRUD operations
    └── adapters/
        └── index.js      # Source type parsers (RSS, web-json, email)
```

---

## License

MIT
