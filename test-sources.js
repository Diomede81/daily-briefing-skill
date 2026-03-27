#!/usr/bin/env node

/**
 * Test all sources in the daily briefing config
 */

const { testSource } = require('./lib/adapters');
const config = require('./config/config.json');

async function testAllSources() {
  console.log('🧪 Testing Daily Briefing Sources\n');
  
  const brief = config.briefs[0];
  const results = [];
  
  for (const source of brief.sources) {
    if (!source.enabled) {
      console.log(`⏭️  Skipping disabled source: ${source.name}`);
      continue;
    }
    
    console.log(`📡 Testing: ${source.name} (${source.type})`);
    
    const result = await testSource(source);
    results.push({ source: source.name, ...result });
    
    if (result.success) {
      console.log(`   ✅ ${result.itemCount} items (${result.responseTime}ms)`);
      if (result.sampleItems && result.sampleItems.length > 0) {
        console.log(`   Sample: ${result.sampleItems[0].title?.substring(0, 80)}...`);
      }
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
    }
    console.log();
  }
  
  // Summary
  console.log('\n📊 Summary:');
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed sources:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.source}: ${r.error}`);
    });
    process.exit(1);
  }
  
  console.log('\n✅ All sources working!');
  process.exit(0);
}

testAllSources().catch(err => {
  console.error('💥 Test failed:', err);
  process.exit(1);
});
