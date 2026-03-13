# FireClaw Integration Guide

This document explains how to integrate the production-ready FireClaw core with the OpenClaw platform.

---

## Current Status

### ✅ Complete (Production-Ready)

- 4-stage pipeline architecture
- Pattern database (200+ patterns)
- Sanitization engine
- Canary token system
- Rate limiting & cost controls
- Domain trust tiers
- Audit logging (JSONL)
- Alert system (framework)
- Configuration management

### 🔌 Requires OpenClaw Platform Integration

These components are stubbed with placeholders and need platform API integration:

1. **Web Fetching** — Replace simulated fetch with actual `web_fetch` tool
2. **LLM Summarization** — Replace simulated summary with actual LLM API call
3. **Alert Delivery** — Replace console logs with actual `message` tool
4. **HTTP Requests** — For DNS blocklist fetching (URLhaus, PhishTank, etc.)

---

## Integration Steps

### 1. Web Fetching Integration

**File:** `fireclaw.mjs`  
**Location:** `FireClaw.processFetch()` method  
**Line:** ~650 (search for `[SIMULATED FETCH]`)

**Current (Simulated):**

```javascript
const rawContent = `[SIMULATED FETCH]\nContent from ${url}\n\n...`;
```

**Needed (Production):**

```javascript
// Option A: Direct web_fetch call
import { web_fetch } from '@openclaw/tools';
const result = await web_fetch({ url, extractMode: 'markdown' });
const rawContent = result.content || result.error;

// Option B: Sub-agent isolation (more secure)
import { spawnSubAgent } from '@openclaw/agent';
const subAgent = await spawnSubAgent({
  tools: ['web_fetch'],
  systemPrompt: 'Fetch the URL provided. Return only the content.',
  maxTurns: 1
});
const rawContent = await subAgent.run(`Fetch ${url}`);
```

**Recommendation:** Use Option B (sub-agent) for better isolation. The sub-agent can only call `web_fetch` and cannot affect the main agent.

---

### 2. LLM Summarization Integration

**File:** `fireclaw.mjs`  
**Location:** `FireClaw.summarize()` method  
**Line:** ~720 (search for `[SIMULATED SUMMARY]`)

**Current (Simulated):**

```javascript
const summary = `**Page Topic:** Simulated summary\n\n...`;
```

**Needed (Production):**

```javascript
import { callLLM } from '@openclaw/llm';

const summary = await callLLM({
  model: this.config.model, // e.g., 'anthropic/claude-haiku-4'
  systemPrompt,             // Already loaded from proxy-prompt.md
  userPrompt,               // Already constructed with content
  maxTokens: this.config.pipeline.summarization.max_output_tokens || 1000,
  temperature: this.config.pipeline.summarization.temperature || 0.0,
  timeout: this.config.performance.summarization_timeout_ms
});
```

**Important:**
- The `systemPrompt` is already loaded from `proxy-prompt.md` — **do not modify it**
- The prompt is hardened against injection — changing it would compromise security
- Use the configured model (default: `claude-haiku-4` for cost efficiency)
- Temperature should be 0.0 for deterministic, fact-focused extraction

---

### 3. Alert Delivery Integration

**File:** `fireclaw.mjs`  
**Location:** `AlertManager.deliverAlert()` method  
**Line:** ~450 (search for `TODO: Implement actual message delivery`)

**Current (Simulated):**

```javascript
console.log(`[FireClaw Alert] ${icon} ${alert.severity.toUpperCase()}`);
console.log(alert.message);
```

**Needed (Production):**

```javascript
import { message } from '@openclaw/tools';

await message({
  action: 'send',
  target: this.config.channel, // e.g., 'slack:C123456789'
  message: `${icon} **FireClaw Alert** (${alert.severity})\n\n${alert.message}`,
  priority: alert.priority // 'info' | 'warning' | 'critical'
});
```

**Channel Format:**
- Slack: `slack:C123456789`
- Discord: `discord:channel_id`
- Email: `email:user@example.com`

**Note:** The alert message is already sanitized in `sanitizeAlertMessage()` to prevent injection in the alert itself.

---

### 4. DNS Blocklist Fetching

**File:** `fireclaw.mjs`  
**Location:** `DNSBlocklistManager.updateBlocklist()` method  
**Line:** ~240 (search for `TODO: Implement actual HTTP fetch`)

**Current (Simulated):**

```javascript
// Simulated data
if (source.name === 'fireclaw_community') {
  domains.add('malicious-site.example');
}
```

**Needed (Production):**

```javascript
// Use Node.js fetch or axios
const response = await fetch(source.url, {
  timeout: 5000,
  headers: {
    'User-Agent': 'FireClaw/2.0 (OpenClaw Agent Security)'
  }
});

if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}

const data = await response.text();

// Parse based on source format
const domains = new Set();

if (source.name === 'urlhaus') {
  // URLhaus format: one URL per line, skip comments
  for (const line of data.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    try {
      const url = new URL(line.trim());
      domains.add(url.hostname.toLowerCase());
    } catch (e) {
      // Skip malformed URLs
    }
  }
} else if (source.name === 'phishtank') {
  // PhishTank format: JSON
  const json = JSON.parse(data);
  for (const entry of json) {
    if (entry.url) {
      try {
        const url = new URL(entry.url);
        domains.add(url.hostname.toLowerCase());
      } catch (e) {}
    }
  }
} else if (source.name === 'openphish') {
  // OpenPhish format: one URL per line
  for (const line of data.split('\n')) {
    if (!line.trim()) continue;
    try {
      const url = new URL(line.trim());
      domains.add(url.hostname.toLowerCase());
    } catch (e) {}
  }
} else if (source.name === 'fireclaw_community') {
  // FireClaw format: JSON array of domains
  const json = JSON.parse(data);
  for (const domain of json.blocklist || []) {
    domains.add(domain.toLowerCase());
  }
}

this.blocklists.set(source.name, domains);
this.lastUpdate.set(source.name, Date.now());
```

**Blocklist Sources:**

- **URLhaus:** https://urlhaus.abuse.ch/downloads/text/
- **PhishTank:** http://data.phishtank.com/data/online-valid.json
- **OpenPhish:** https://openphish.com/feed.txt
- **FireClaw Community:** https://fireclaw.app/api/v1/blocklist (to be built)

**Caching:** The `DNSBlocklistManager` already handles caching based on `cache_ttl_hours` in config.

---

## Configuration for Production

### Recommended Production Settings

```yaml
fireclaw:
  enabled: true
  version: "2.0.0"
  
  # Use efficient model for summarization
  model: "anthropic/claude-haiku-4"
  
  rate_limiting:
    max_fetches_per_minute: 10
    max_fetches_per_hour: 100
    max_fetches_per_day: 500
    max_cost_per_day: 5.00
    cost_per_fetch_estimate: 0.01
    throttle_at_percent: 80
    hard_limit: true
  
  pipeline:
    dns_check:
      enabled: true
      timeout_ms: 2000
      sources:
        - name: "fireclaw_community"
          url: "https://fireclaw.app/api/v1/blocklist"
          enabled: false  # Disable until fireclaw.app is live
        - name: "urlhaus"
          url: "https://urlhaus.abuse.ch/downloads/text/"
          enabled: true
        - name: "phishtank"
          url: "http://data.phishtank.com/data/online-valid.json"
          enabled: true
        - name: "openphish"
          url: "https://openphish.com/feed.txt"
          enabled: true
      action_on_block: "reject"
    
    summarization:
      canary_tokens:
        enabled: true
        inject_count: 3
        detection_threshold: 1
  
  trust_tiers:
    default_tier: "neutral"
    trusted:
      - "wikipedia.org"
      - "github.com"
      - "docs.python.org"
      - "nodejs.org"
      - "developer.mozilla.org"
    suspicious: []
    blocked: []
  
  alerts:
    enabled: true
    channel: null  # Set this in user config
    threshold: "medium"
    digest_mode: false
    sanitize_alert_content: true
  
  logging:
    audit_log_enabled: true
    audit_log_file: "logs/fireclaw-audit.jsonl"
    log_fetches: true
    log_searches: true
    log_detections: true
    log_alerts: true
    store_full_content: false  # Privacy: don't store full content
  
  performance:
    cache_enabled: true
    cache_ttl_seconds: 300
    cache_max_entries: 100
    max_concurrent_fetches: 3
```

---

## OpenClaw Skill Definition

### SKILL.md

```markdown
# FireClaw — AI Agent Security Proxy

**Category:** Security  
**Version:** 2.0.0  
**Author:** Azze (OpenClaw Engineering)

## Description

FireClaw protects AI agents from prompt injection attacks when fetching web content. 
It provides a 4-stage sanitization pipeline with DNS blocklists, structural sanitization, 
isolated LLM summarization, and output scanning.

## Tools

- `fireclaw_fetch(url, intent?)` — Secure web content fetching
- `fireclaw_search(query, count?)` — Secure web search
- `fireclaw_stats()` — View security statistics
- `fireclaw_enable()` — Enable protection
- `fireclaw_disable()` — Disable protection
- `fireclaw_status()` — Check current status

## Usage

Instead of calling `web_fetch` directly, use `fireclaw_fetch`:

```javascript
// Unsafe (direct web_fetch)
const result = await web_fetch({ url: 'https://untrusted.com' });

// Safe (via FireClaw)
const result = await fireclaw_fetch('https://untrusted.com', 'Get main topic');
console.log(result.content);      // Sanitized summary
console.log(result.metadata);     // Detection info
```

## Configuration

Edit `skills/honey-bot/config.yaml`:

- Set trusted domains
- Configure rate limits
- Set alert channel
- Enable/disable features

## When to Use

Use FireClaw when:
- Fetching content from untrusted websites
- Searching the web for information
- Your agent has high-privilege tools (exec, message, file write)
- Operating in a production environment

Skip FireClaw when:
- Fetching from your own infrastructure
- Trusted domains (pre-configured)
- Development/testing (but test with it enabled!)

## Learn More

See `skills/honey-bot/README.md` for full documentation.
```

---

## Testing Integration

### Test Plan

1. **Test web_fetch integration:**
   ```javascript
   const result = await fireclaw_fetch('https://example.com');
   assert(result.content !== null);
   assert(result.metadata.tier === 'neutral');
   ```

2. **Test LLM summarization:**
   ```javascript
   const result = await fireclaw_fetch('https://en.wikipedia.org/wiki/Prompt_injection');
   assert(result.content.includes('prompt injection'));
   assert(result.metadata.detections >= 0);
   ```

3. **Test DNS blocklist:**
   - Add a test domain to blocklist
   - Verify it's blocked
   - Check audit log for block event

4. **Test canary detection:**
   - Inject known injection pattern
   - Verify canaries are detected in output
   - Verify alert is sent

5. **Test rate limiting:**
   - Make rapid requests
   - Verify rate limit kicks in
   - Check audit log for rate limit events

6. **Test trusted domains:**
   - Fetch from wikipedia.org
   - Verify sanitization is skipped
   - Verify performance is faster

7. **Test alerts:**
   - Trigger high-severity detection
   - Verify alert is delivered to configured channel
   - Verify alert message is sanitized

---

## Performance Optimization

### Caching Strategy

FireClaw caches sanitized results for 5 minutes (configurable). This means:

- Repeated fetches of the same URL = instant (no re-sanitization)
- Trusted domains are always fast (sanitization skipped)
- Cache key includes `intent` parameter (different intents = different cache entries)

### LLM Model Selection

**Cost vs. Quality Trade-off:**

| Model | Cost/1M tokens | Speed | Quality | Recommendation |
|-------|----------------|-------|---------|----------------|
| claude-haiku-4 | $0.25 | Fast | Good | **Default (production)** |
| claude-sonnet-4 | $3.00 | Medium | Better | High-value fetches |
| claude-opus-4 | $15.00 | Slow | Best | Critical/sensitive |

**Recommendation:** Use `claude-haiku-4` as default. The summarization task is simple (fact extraction), so Haiku is sufficient for 95% of cases.

### Rate Limiting Tuning

**Conservative (default):**
```yaml
max_fetches_per_day: 500
max_cost_per_day: 5.00
```

**Aggressive (high-volume agent):**
```yaml
max_fetches_per_day: 2000
max_cost_per_day: 20.00
```

**Estimate your needs:**
- 1 fetch = ~500 tokens output = ~$0.0001 (Haiku)
- 500 fetches/day = ~$0.05/day
- Set `max_cost_per_day` to 2x your expected usage (buffer)

---

## Deployment Checklist

Before deploying to production:

- [ ] Integrate web_fetch (replace simulation)
- [ ] Integrate LLM API (replace simulation)
- [ ] Integrate message tool (alerts)
- [ ] Integrate HTTP fetch (DNS blocklists)
- [ ] Set `config.yaml` alert channel
- [ ] Add production trusted domains
- [ ] Test end-to-end with real websites
- [ ] Test injection samples from https://github.com/TakSec/Prompt-Injection-Everywhere
- [ ] Set up log rotation for audit log
- [ ] Monitor initial deployment for false positives
- [ ] Adjust severity thresholds based on real data
- [ ] Document any custom patterns added

---

## Monitoring

### Key Metrics to Track

1. **Detections per day** — Trend analysis
2. **Blocked fetches** — Are you under attack?
3. **False positives** — Detections on legitimate sites
4. **Cache hit rate** — Performance optimization
5. **Cost per day** — Budget tracking
6. **Average severity** — Threat landscape

### Audit Log Analysis

```bash
# Daily detection summary
cat logs/fireclaw-audit.jsonl | \
  jq -s 'group_by(.severityLevel) | map({severity: .[0].severityLevel, count: length})'

# Top offending domains
cat logs/fireclaw-audit.jsonl | \
  jq -r '.url' | \
  sed 's|https\?://\([^/]*\).*|\1|' | \
  sort | uniq -c | sort -rn | head -20

# Cost tracking
cat logs/fireclaw-audit.jsonl | \
  jq -s 'map(select(.cost)) | map(.cost) | add'
```

---

## Support

### For OpenClaw Team

If you have questions during integration:

- **Code questions:** Comment in the source files, I'll update
- **Design decisions:** See architecture notes in `README.md`
- **Security concerns:** Review `FEATURE-SPEC.md` for threat model

### For Community

Once live:

- **Documentation:** https://fireclaw.app/docs
- **Issues:** https://github.com/openclaw/fireclaw/issues
- **Discord:** https://discord.gg/fireclaw

---

**End of Integration Guide**

Good luck with the integration! The core is production-ready — you just need to wire up the platform APIs.

— Azze
