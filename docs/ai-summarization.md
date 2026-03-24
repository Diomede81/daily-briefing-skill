# AI Summarization Feature

## Overview

The Daily Briefing skill now includes AI-powered summarization that transforms raw content (RSS feeds, newsletters, podcasts, YouTube transcripts) into concise, actionable insights tailored to your interests.

## What It Does

Instead of just showing article titles and links, AI summarization:

1. **Analyzes content** - Reads full transcripts, descriptions, and article previews
2. **Extracts key insights** - Identifies what's important and why
3. **Scores relevance** - Ranks items 1-5 based on your interests
4. **Generates summaries** - Creates 2-3 sentence summaries highlighting actionable insights
5. **Prioritizes items** - Shows most relevant content first

## Example Output

### Before (without AI):
```
📡 TechCrunch AI

OpenAI launches GPT-5 with breakthrough reasoning capabilities
→ Read more: [link]

EU finalizes AI Act with strict rules for high-risk systems
→ Read more: [link]
```

### After (with AI):
```
📡 TechCrunch AI

OpenAI launches GPT-5 with breakthrough reasoning capabilities
📝 Summary: OpenAI's latest model introduces multi-step reasoning that can solve complex math problems and coding challenges. Early benchmarks show 40% improvement over GPT-4 in logical tasks. Relevant for understanding next-gen AI capabilities in business automation and care technology applications.
→ Read more: [link]

EU finalizes AI Act with strict rules for high-risk systems
📝 Summary: New regulations require transparency reports and human oversight for AI used in hiring, credit scoring, and law enforcement. Companies have 2 years to comply. Critical for Empathika's care tech to ensure compliance with healthcare AI regulations.
→ Read more: [link]
```

## Configuration

### Per-Brief Settings

Add `aiSummary` configuration to any brief:

```json
{
  "name": "My Brief",
  "aiSummary": {
    "enabled": true,
    "style": "concise",
    "maxItemsPerSource": 5,
    "prioritize": "relevance",
    "userContext": "Your interests and focus areas"
  }
}
```

### Configuration Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `enabled` | `true`/`false` | `true` | Enable/disable AI summarization |
| `style` | `concise`/`detailed`/`bullets` | `concise` | Summary style |
| `maxItemsPerSource` | `1-10` | `5` | Limit items per source |
| `prioritize` | `relevance`/`latest`/`all` | `relevance` | Sorting method |
| `userContext` | string | Tech/AI focus | Your interests for relevance scoring |

### Summary Styles

**Concise** (default): 2-3 sentences focusing on key insights and relevance
- Best for: Quick morning scans
- Example: "New AI model improves reasoning by 40%. Relevant for automation tasks. 2-year compliance timeline."

**Detailed**: 4-5 sentences with context, implications, and action items
- Best for: Deep dives on specific topics
- Example: "OpenAI's GPT-5 represents a significant leap in multi-step reasoning capabilities, demonstrating 40% improvement over GPT-4 in logical problem-solving tasks. This breakthrough has immediate implications for business automation, particularly in complex decision-making workflows. For Empathika, this technology could enhance medication interaction analysis and care planning recommendations. Consider pilot testing for clinical decision support features."

**Bullets**: Structured bullet points with main takeaways
- Best for: Scannable lists
- Example:
  - GPT-5 launches with 40% improvement in reasoning
  - Multi-step problem solving for complex tasks
  - Relevant for: business automation, care tech AI
  - Action: Evaluate for clinical decision support

### User Context Examples

Tailor summaries to your focus areas:

```json
// Tech entrepreneur
"userContext": "Tech entrepreneur and CTO interested in AI, SaaS, business automation, and productivity tools"

// Healthcare focus
"userContext": "Healthcare technology leader focused on care home management, medication safety, NHS compliance, and digital health innovations"

// Developer
"userContext": "Full-stack developer interested in web technologies, cloud architecture, DevOps, and AI integration"

// Investor
"userContext": "Early-stage investor focused on AI startups, healthcare tech, and B2B SaaS with strong unit economics"
```

## Technical Details

### How It Works

1. **Content Collection**: Standard adapters fetch content from sources
2. **Batch Processing**: Summarizer groups items by source for efficient API calls
3. **GPT Analysis**: Uses `gpt-4o-mini` (fast, cost-effective) to analyze content
4. **Structured Parsing**: Extracts relevance scores and summaries
5. **Sorting & Ranking**: Orders items by relevance score (5 = most relevant)
6. **Email Generation**: Enhanced template displays AI summaries prominently

### API Usage

Uses OpenAI API (via token-manager):
- Model: `gpt-4o-mini` (~$0.15 per 1M input tokens, $0.60 per 1M output)
- Typical brief: ~2,000 tokens input, ~500 tokens output
- Cost per brief: ~$0.001 (less than one cent)

### Fallback Behavior

If AI summarization fails (API error, no API key, timeout):
- Briefs continue to work normally
- Shows original descriptions/previews
- Logs warning in console
- No interruption to delivery

### Supported Content Types

AI summarization works with:
- ✅ **RSS feeds** - Analyzes article descriptions
- ✅ **Web scraping** - Processes extracted content
- ✅ **Email newsletters** - Summarizes email previews
- ✅ **Podcasts** - Analyzes episode descriptions
- ✅ **YouTube** - Processes full transcripts (up to 5000 chars)
- ⏭️ **Calendar** - Skipped (already concise)
- ⏭️ **Tasks** - Skipped (already structured)
- ⏭️ **Weather** - Skipped (already formatted)

## Setup

### 1. Ensure OpenAI API Key is Available

Check token registry:
```bash
curl -s "http://localhost:3021/api/search?q=openai" | jq
```

If not found, add it:
```bash
curl -X POST http://localhost:3021/api/tokens \
  -H "Content-Type: application/json" \
  -d '{"service": "OpenAI", "name": "OPENAI_API_KEY", "value": "sk-proj-..."}'
```

### 2. Enable for a Brief

Via API:
```bash
curl -X PUT http://localhost:3020/api/briefs/<briefId> \
  -H "Content-Type: application/json" \
  -d '{
    "aiSummary": {
      "enabled": true,
      "style": "concise",
      "userContext": "Your interests here"
    }
  }'
```

Or edit `config/config.json` directly and restart service.

### 3. Test the Brief

```bash
node scripts/run-brief.js <briefId>
```

Check console output for:
```
🤖 Running AI summarization...
🤖 AI Summarization enabled
   Processing: TechCrunch AI (5 items)
   ✅ Summarized 5 items
```

## Examples

### Luca Morning Brief

Already configured with:
```json
{
  "aiSummary": {
    "enabled": true,
    "style": "concise",
    "maxItemsPerSource": 5,
    "prioritize": "relevance",
    "userContext": "Tech entrepreneur and CTO interested in AI, healthcare technology (especially care home/medication management), business automation, Microsoft 365 ecosystem, and productivity tools. Runs Empathika (care tech SaaS), Tuliptech (Microsoft services), and Acuity AI (AI consultancy)."
  }
}
```

### YouTube Transcript Briefing

For video content:
```json
{
  "name": "Daily Learning Brief",
  "sources": [
    {
      "name": "The Diary of a CEO",
      "type": "youtube",
      "url": "https://www.youtube.com/watch?v=VIDEO_ID"
    }
  ],
  "aiSummary": {
    "enabled": true,
    "style": "detailed",
    "userContext": "Business leader interested in entrepreneurship, leadership, and personal development"
  }
}
```

AI will process the full transcript and extract key insights.

## Monitoring

### Console Output

Successful run:
```
🤖 Running AI summarization...
🤖 AI Summarization enabled
   Processing: TechCrunch AI (5 items)
   ✅ Summarized 5 items
   Processing: Hacker News (5 items)
   ✅ Summarized 5 items
```

Graceful failure:
```
🤖 Running AI summarization...
⚠️ OpenAI API key not found - skipping AI summarization
```

API error:
```
🤖 Running AI summarization...
   Processing: TechCrunch AI (5 items)
⚠️ AI summarization failed: OpenAI API error: 429 - Rate limit exceeded
```

### Email Indicators

AI-summarized items show:
- Blue-highlighted summary box
- 📝 Summary icon
- Relevance-based ordering (most relevant first)
- Original content in collapsible `<details>` (for reference)

## Cost Estimation

Typical daily brief with 3 sources, 5 items each:
- Input: ~2,000 tokens
- Output: ~500 tokens
- Cost: ~$0.001 per brief

Monthly (30 briefs): ~$0.03/month

Annual: ~$0.36/year

## Troubleshooting

### No Summaries Appearing

1. Check AI is enabled in brief config
2. Verify OpenAI API key exists:
   ```bash
   curl -s "http://localhost:3021/api/search?q=openai"
   ```
3. Check console logs for errors
4. Test API key manually:
   ```bash
   node -e "require('./lib/summarizer').summarizeItems([{title:'test'}], {type:'rss'}, {apiKey:'sk-...'})"
   ```

### Summaries Not Relevant

Update `userContext` to be more specific:
```json
"userContext": "Add more detail about your specific interests, industry, projects, and priorities"
```

### Cost Concerns

Reduce API usage:
```json
"aiSummary": {
  "maxItemsPerSource": 3,  // Fewer items
  "style": "concise"       // Shorter summaries
}
```

Or disable for specific briefs:
```json
"aiSummary": {
  "enabled": false
}
```

## Future Enhancements

Potential improvements:
- [ ] Support for Anthropic Claude (via sessions_send)
- [ ] Cached context for repeated sources
- [ ] Multi-language summarization
- [ ] Action item extraction
- [ ] Topic clustering across sources
- [ ] Sentiment analysis
- [ ] Scheduled digest optimization (weekly rollups)

## Related Files

- `lib/summarizer.js` - Core AI summarization logic
- `scripts/run-brief.js` - Integration point
- `lib/adapters/index.js` - Content fetching (provides data to summarizer)
- `config/config.json` - Per-brief AI configuration

---

**Last updated:** 2026-03-24  
**Status:** ✅ Production-ready
