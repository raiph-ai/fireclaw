// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

/**
 * FireClaw Usage Examples
 * Demonstrates how to use the FireClaw skill in OpenClaw agents
 */

import { fireclaw_fetch, fireclaw_search, fireclaw_stats } from '../fireclaw.mjs';

/**
 * Example 1: Basic fetch
 */
async function example1_basicFetch() {
  console.log('\n=== Example 1: Basic Fetch ===\n');
  
  const result = await fireclaw_fetch('https://example.com/article');
  
  console.log('Content:', result.content);
  console.log('\nMetadata:', result.metadata);
  
  if (result.error) {
    console.error('Error:', result.error);
  }
}

/**
 * Example 2: Fetch with intent
 */
async function example2_fetchWithIntent() {
  console.log('\n=== Example 2: Fetch with Intent ===\n');
  
  const result = await fireclaw_fetch(
    'https://news.site/security-breach',
    'Extract the CVE number, affected versions, and patch information'
  );
  
  console.log('Targeted summary:', result.content);
  console.log('\nDetections:', result.metadata?.detections || 0);
}

/**
 * Example 3: Search
 */
async function example3_search() {
  console.log('\n=== Example 3: Search ===\n');
  
  const result = await fireclaw_search('latest AI security vulnerabilities', 5);
  
  console.log('Search results:', result.content);
  console.log('\nSeverity:', result.metadata?.severityLevel || 'none');
}

/**
 * Example 4: Handling malicious content
 */
async function example4_maliciousContent() {
  console.log('\n=== Example 4: Handling Malicious Content ===\n');
  
  // Simulate fetching a page with prompt injection
  const result = await fireclaw_fetch('https://malicious.example.com/injected');
  
  if (result.metadata?.flagged) {
    console.log('⚠️  Content was flagged for injection attempts!');
    console.log(`Severity: ${result.metadata.severityLevel}`);
    console.log(`Detections: ${result.metadata.detections}`);
  }
  
  console.log('\nSanitized content:', result.content);
}

/**
 * Example 5: Bypassing trusted domains
 */
async function example5_bypassTrusted() {
  console.log('\n=== Example 5: Bypass Trusted Domain ===\n');
  
  // GitHub is in the default bypass list
  const result = await fireclaw_fetch('https://github.com/readme.md');
  
  if (result.bypassed) {
    console.log('✅ Content bypassed sanitization (trusted domain)');
  }
  
  console.log('Content:', result.content);
}

/**
 * Example 6: Get statistics
 */
async function example6_stats() {
  console.log('\n=== Example 6: FireClaw Statistics ===\n');
  
  const stats = await fireclaw_stats();
  
  console.log('Configuration:');
  console.log(`  Model: ${stats.config.model}`);
  console.log(`  Max input: ${stats.config.max_input_chars} chars`);
  console.log(`  Max output: ${stats.config.max_output_chars} chars`);
  console.log(`  Bypass domains: ${stats.config.bypass_domains}`);
  console.log(`  Cache: ${stats.config.cache_enabled ? 'enabled' : 'disabled'}`);
  
  console.log('\nPatterns loaded:');
  console.log(`  Structural: ${stats.patterns.structural}`);
  console.log(`  Injection signatures: ${stats.patterns.injection_signatures}`);
  console.log(`  Output signatures: ${stats.patterns.output_signatures}`);
  
  if (stats.cache) {
    console.log('\nCache:');
    console.log(`  Size: ${stats.cache.size} entries`);
    console.log(`  TTL: ${stats.cache.ttl} seconds`);
  }
}

/**
 * Example 7: Error handling
 */
async function example7_errorHandling() {
  console.log('\n=== Example 7: Error Handling ===\n');
  
  try {
    const result = await fireclaw_fetch('https://nonexistent.invalid.tld');
    
    if (result.error) {
      console.error('Fetch failed:', result.error);
      // Handle error gracefully
      return 'Could not fetch content from the specified URL';
    }
    
    return result.content;
  } catch (err) {
    console.error('Unexpected error:', err.message);
    return null;
  }
}

/**
 * Example 8: Integration in an agent workflow
 */
async function example8_agentWorkflow() {
  console.log('\n=== Example 8: Agent Workflow ===\n');
  
  // Agent receives user request: "Research the latest CVE for OpenSSL"
  
  // Step 1: Search for relevant info
  const searchResult = await fireclaw_search('latest OpenSSL CVE vulnerability', 3);
  console.log('Step 1 - Search results:', searchResult.content?.substring(0, 200) + '...');
  
  // Step 2: Fetch detailed article (assume we found a URL)
  const articleResult = await fireclaw_fetch(
    'https://security.example.com/openssl-cve',
    'Extract CVE ID, affected versions, severity, and mitigation steps'
  );
  console.log('\nStep 2 - Article summary:', articleResult.content);
  
  // Step 3: Check for injection attempts
  const totalDetections = (searchResult.metadata?.detections || 0) + 
                          (articleResult.metadata?.detections || 0);
  
  if (totalDetections > 0) {
    console.log(`\n⚠️  Warning: ${totalDetections} injection attempts detected and neutralized during research`);
  }
  
  // Step 4: Synthesize response for user
  console.log('\n📝 Final response prepared for user (safe to use)');
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('🔥 FireClaw Usage Examples\n');
  console.log('Note: These examples use simulated data in the prototype.');
  console.log('In production OpenClaw, they would fetch real web content.\n');
  
  await example6_stats();
  
  // Uncomment to run other examples:
  // await example1_basicFetch();
  // await example2_fetchWithIntent();
  // await example3_search();
  // await example4_maliciousContent();
  // await example5_bypassTrusted();
  // await example7_errorHandling();
  // await example8_agentWorkflow();
  
  console.log('\n✅ Examples completed!\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(err => {
    console.error('Example failed:', err);
    process.exit(1);
  });
}

export {
  example1_basicFetch,
  example2_fetchWithIntent,
  example3_search,
  example4_maliciousContent,
  example5_bypassTrusted,
  example6_stats,
  example7_errorHandling,
  example8_agentWorkflow
};
