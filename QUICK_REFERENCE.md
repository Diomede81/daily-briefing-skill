# Quick Reference: AI Summarization

## Enable AI for a Brief

```bash
curl -X PUT http://localhost:3020/api/briefs/<briefId> \
  -H "Content-Type: application/json" \
  -d '{
    "aiSummary": {
      "enabled": true,
      "style": "concise",
      "userContext": "Describe your interests here"
    }
  }'
```

## Configuration Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `enabled` | `true`/`false` | `true` | Enable AI |
| `style` | `concise`/`detailed`/`bullets` | `concise` | Summary length |
| `maxItemsPerSource` | `1-10` | `5` | Items per source |
| `userContext` | string | Tech/AI focus | Your interests |

## Summary Styles

**Concise:** 2-3 sentences (quick scans)  
**Detailed:** 4-5 sentences (deep dives)  
**Bullets:** Structured lists (scannable)

## Test a Brief

```bash
node scripts/run-brief.js <briefId>
```

## Check Console Output

```
🤖 Running AI summarization...
🤖 AI Summarization enabled
   Processing: TechCrunch AI (5 items)
   ✅ Summarized 5 items
```

## Costs

~$0.001 per brief (~$0.03/month for daily brief)

## Troubleshooting

**No summaries appearing?**
1. Check `aiSummary.enabled: true` in brief config
2. Verify OpenAI key: `curl -s "http://localhost:3021/api/search?q=openai"`
3. Check console logs for errors

**Summaries not relevant?**
- Update `userContext` to be more specific about your interests

## Documentation

- **Full guide:** [docs/ai-summarization.md](docs/ai-summarization.md)
- **Implementation:** [ENHANCEMENT_SUMMARY.md](ENHANCEMENT_SUMMARY.md)
- **Tests:** [TEST_REPORT.md](TEST_REPORT.md)

## Currently Configured

- ✅ **Luca Morning Brief** (`1cd65ac0`) - AI enabled, concise style
- ✅ **YouTube Brief** (`db4db64d`) - AI enabled, detailed style

## Quick Examples

**Tech entrepreneur:**
```json
"userContext": "Tech entrepreneur interested in AI, SaaS, automation"
```

**Healthcare focus:**
```json
"userContext": "Healthcare tech leader focused on care homes, medication safety, NHS compliance"
```

**Developer:**
```json
"userContext": "Full-stack developer interested in web tech, cloud, DevOps, AI"
```
