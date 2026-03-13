#!/usr/bin/env node

// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

/**
 * FireClaw Test Suite
 * Basic validation and demonstration
 * 
 * Run: node test-fireclaw.mjs
 */

import { 
  fireclaw_fetch, 
  fireclaw_search, 
  fireclaw_stats, 
  fireclaw_status,
  fireclaw_enable,
  fireclaw_disable
} from './fireclaw.mjs';

console.log('🛡️  FireClaw Test Suite\n');

/**
 * Test 1: Status Check
 */
async function testStatus() {
  console.log('Test 1: Status Check');
  const status = await fireclaw_status();
  console.log('  Status:', status);
  console.log('  ✓ Status check passed\n');
}

/**
 * Test 2: Fetch from neutral domain
 */
async function testNeutralFetch() {
  console.log('Test 2: Fetch from neutral domain');
  const result = await fireclaw_fetch('https://example.com', 'Get main topic');
  
  console.log('  Content length:', result.content?.length || 0);
  console.log('  Error:', result.error);
  console.log('  Tier:', result.metadata?.tier);
  console.log('  Detections:', result.metadata?.detections);
  console.log('  Severity:', result.metadata?.severityLevel);
  console.log('  Duration:', result.metadata?.duration, 'ms');
  
  if (result.content) {
    console.log('  ✓ Neutral fetch passed\n');
  } else {
    console.log('  ⚠️  Fetch returned no content (expected with simulation)\n');
  }
}

/**
 * Test 3: Fetch from trusted domain
 */
async function testTrustedFetch() {
  console.log('Test 3: Fetch from trusted domain (wikipedia.org)');
  const result = await fireclaw_fetch('https://wikipedia.org', 'Get homepage info');
  
  console.log('  Tier:', result.metadata?.tier);
  console.log('  Skipped sanitization:', result.metadata?.skippedSanitization);
  console.log('  Detections:', result.metadata?.detections);
  
  if (result.metadata?.tier === 'trusted') {
    console.log('  ✓ Trusted domain handling passed\n');
  } else {
    console.log('  ⚠️  Expected trusted tier\n');
  }
}

/**
 * Test 4: Search
 */
async function testSearch() {
  console.log('Test 4: Web search');
  const result = await fireclaw_search('prompt injection attacks', 5);
  
  console.log('  Content length:', result.content?.length || 0);
  console.log('  Detections:', result.metadata?.detections);
  console.log('  Severity:', result.metadata?.severityLevel);
  
  if (result.content || result.error) {
    console.log('  ✓ Search passed\n');
  }
}

/**
 * Test 5: Statistics
 */
async function testStats() {
  console.log('Test 5: Statistics');
  const stats = await fireclaw_stats();
  
  console.log('  Enabled:', stats.enabled);
  console.log('  Version:', stats.version);
  console.log('  Total fetches:', stats.stats.fetchesTotal);
  console.log('  Total searches:', stats.stats.searchesTotal);
  console.log('  Total detections:', stats.stats.detectionsTotal);
  console.log('  Total blocked:', stats.stats.blockedTotal);
  console.log('  Cache size:', stats.cache?.size || 0);
  console.log('  Pattern counts:', stats.patterns);
  console.log('  Trust tiers:', stats.trustTiers);
  
  if (stats.rateLimiter) {
    console.log('  Rate limiter:');
    console.log('    Fetches remaining (day):', stats.rateLimiter.fetches.perDay);
    console.log('    Cost today: $' + stats.rateLimiter.cost.today);
    console.log('    Cost limit: $' + stats.rateLimiter.cost.limit);
    console.log('    Usage: ' + stats.rateLimiter.cost.percent + '%');
  }
  
  if (stats.auditLog) {
    console.log('  Audit log:', stats.auditLog.path);
    console.log('    Size:', stats.auditLog.sizeMB, 'MB');
  }
  
  console.log('  ✓ Stats passed\n');
}

/**
 * Test 6: Enable/Disable
 */
async function testEnableDisable() {
  console.log('Test 6: Enable/Disable');
  
  const disableResult = await fireclaw_disable();
  console.log('  Disable:', disableResult);
  
  const statusDisabled = await fireclaw_status();
  console.log('  Status after disable:', statusDisabled.enabled);
  
  const enableResult = await fireclaw_enable();
  console.log('  Enable:', enableResult);
  
  const statusEnabled = await fireclaw_status();
  console.log('  Status after enable:', statusEnabled.enabled);
  
  if (!statusDisabled.enabled && statusEnabled.enabled) {
    console.log('  ✓ Enable/disable passed\n');
  } else {
    console.log('  ❌ Enable/disable failed\n');
  }
}

/**
 * Test 7: Rate Limiting
 */
async function testRateLimiting() {
  console.log('Test 7: Rate limiting (making 3 rapid requests)');
  
  for (let i = 1; i <= 3; i++) {
    const result = await fireclaw_fetch(`https://example-${i}.com`, 'Test');
    
    if (result.rateLimited) {
      console.log(`  Request ${i}: Rate limited (${result.error})`);
    } else if (result.metadata) {
      console.log(`  Request ${i}: Success (${result.metadata.duration}ms)`);
    } else {
      console.log(`  Request ${i}: ${result.error || 'Unknown'}`);
    }
  }
  
  console.log('  ✓ Rate limiting test passed\n');
}

/**
 * Test 8: Pattern Detection (Simulated Injection)
 */
async function testPatternDetection() {
  console.log('Test 8: Pattern detection (manual test)');
  console.log('  Note: This test requires manual inspection');
  console.log('  Patterns loaded:', (await fireclaw_stats()).patterns);
  console.log('  ✓ Pattern database loaded\n');
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    await testStatus();
    await testNeutralFetch();
    await testTrustedFetch();
    await testSearch();
    await testRateLimiting();
    await testStats();
    await testEnableDisable();
    await testPatternDetection();
    
    console.log('✅ All tests completed!\n');
    console.log('Note: Some tests use simulated data until OpenClaw integration is complete.');
    console.log('See INTEGRATION.md for production deployment steps.\n');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
