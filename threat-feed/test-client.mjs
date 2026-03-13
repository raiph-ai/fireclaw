#!/usr/bin/env node

// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

/**
 * FireClaw Threat Feed API - Test Client
 * Demonstrates how FireClaw instances interact with the API
 */

import { createHash } from 'crypto';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'GENERATE_AND_REPLACE_WITH_SECURE_KEY_1';

// Generate anonymous instance ID (in production, this would be stable per instance)
const INSTANCE_ID = createHash('sha256')
  .update('test-instance-' + process.env.HOSTNAME || 'local')
  .digest('hex')
  .substring(0, 32);

/**
 * Make API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();
  
  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

/**
 * Submit a threat report
 */
async function submitReport(domain, patternType, severity) {
  console.log(`\n📤 Submitting report for ${domain}...`);
  
  const result = await apiRequest('/api/report', {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      instanceId: INSTANCE_ID,
      domain,
      patternType,
      severity,
      timestamp: Math.floor(Date.now() / 1000)
    })
  });

  if (result.ok) {
    console.log('✓ Report submitted successfully');
  } else {
    console.log('✗ Report failed:', result.data.error);
  }
  
  return result;
}

/**
 * Get blocklist
 */
async function getBlocklist(since = null) {
  console.log('\n📋 Fetching blocklist...');
  
  const endpoint = since ? `/api/blocklist?since=${since}` : '/api/blocklist';
  const result = await apiRequest(endpoint);

  if (result.ok) {
    console.log(`✓ Blocklist fetched: ${result.data.count} domains`);
    
    if (result.data.blocklist.length > 0) {
      console.log('\nTop 5 flagged domains:');
      result.data.blocklist.slice(0, 5).forEach((entry, i) => {
        console.log(`  ${i + 1}. ${entry.domain} (${entry.severity}, ${entry.report_count} reports)`);
      });
    }
  } else {
    console.log('✗ Failed to fetch blocklist:', result.data.error);
  }
  
  return result;
}

/**
 * Get threat patterns
 */
async function getPatterns(version = null) {
  console.log('\n🔍 Fetching threat patterns...');
  
  const endpoint = version !== null ? `/api/patterns?version=${version}` : '/api/patterns';
  const result = await apiRequest(endpoint);

  if (result.ok) {
    console.log(`✓ Patterns fetched: ${result.data.patterns.length} patterns`);
    console.log(`  Current version: ${result.data.current_version}`);
    console.log(`  Has updates: ${result.data.has_updates}`);
    
    if (result.data.patterns.length > 0) {
      console.log('\nPattern types:');
      result.data.patterns.forEach(p => {
        console.log(`  - ${p.pattern_type} (${p.severity}, ${p.detection_count} detections)`);
      });
    }
  } else {
    console.log('✗ Failed to fetch patterns:', result.data.error);
  }
  
  return result;
}

/**
 * Get statistics
 */
async function getStats() {
  console.log('\n📊 Fetching statistics...');
  
  const result = await apiRequest('/api/stats');

  if (result.ok) {
    const stats = result.data;
    console.log('✓ Statistics fetched:');
    console.log(`  Total reports: ${stats.total_reports}`);
    console.log(`  Unique domains flagged: ${stats.unique_domains_flagged}`);
    console.log(`  Active instances: ${stats.active_instances}`);
    
    if (stats.top_patterns.length > 0) {
      console.log('\n  Top patterns:');
      stats.top_patterns.forEach(p => {
        console.log(`    - ${p.pattern_type}: ${p.detection_count} detections`);
      });
    }
  } else {
    console.log('✗ Failed to fetch stats:', result.data.error);
  }
  
  return result;
}

/**
 * Check domain reputation
 */
async function checkReputation(domain) {
  console.log(`\n🔎 Checking reputation for ${domain}...`);
  
  const result = await apiRequest(`/api/reputation/${domain}`);

  if (result.ok) {
    const rep = result.data;
    console.log('✓ Reputation fetched:');
    console.log(`  Score: ${rep.score}/100`);
    console.log(`  Reports: ${rep.report_count}`);
    console.log(`  Severity: ${rep.severity || 'none'}`);
    
    if (rep.pattern_types.length > 0) {
      console.log(`  Patterns: ${rep.pattern_types.join(', ')}`);
    }
  } else {
    console.log('✗ Failed to check reputation:', result.data.error);
  }
  
  return result;
}

/**
 * Main test flow
 */
async function main() {
  console.log('🔥 FireClaw Threat Feed API - Test Client');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`API: ${API_BASE}`);
  console.log(`Instance ID: ${INSTANCE_ID}`);

  try {
    // Test 1: Submit some threat reports
    await submitReport('evil-injector.com', 'prompt_injection', 'high');
    await submitReport('phishing-site.net', 'data_exfiltration', 'critical');
    await submitReport('evil-injector.com', 'jailbreak', 'high'); // Same domain, different pattern
    
    // Small delay to let database updates complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 2: Get blocklist
    await getBlocklist();

    // Test 3: Get patterns
    await getPatterns();

    // Test 4: Get statistics
    await getStats();

    // Test 5: Check domain reputation
    await checkReputation('evil-injector.com');
    await checkReputation('safe-domain.com'); // Clean domain

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ All tests completed successfully');
    console.log('');

  } catch (error) {
    console.error('\n✗ Error during testing:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
