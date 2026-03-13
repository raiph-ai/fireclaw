# FireClaw Client Skill

The FireClaw client skill connects your main OpenClaw agent to a FireClaw proxy instance. It provides safe web browsing by routing all web fetches through the FireClaw sanitization pipeline.

## What It Does

- Replaces `web_fetch` and `web_search` with `fireclaw_fetch` and `fireclaw_search`
- Routes requests to your FireClaw proxy (local sub-agent or remote instance)
- Shows FireClaw status and stats on demand
- **Reminds the user at the start of each new thread if FireClaw is disabled**
- Allows conversational control: "enable FireClaw", "disable FireClaw", "FireClaw status"

## Installation

1. Copy the `client/` folder into your OpenClaw skills directory
2. Configure the proxy connection in your OpenClaw config or `client/config.yaml`
3. Add to your agent's AGENTS.md: "Use fireclaw_fetch instead of web_fetch for all web browsing"

## Configuration

```yaml
fireclaw_client:
  enabled: true
  mode: "sub-agent"          # "sub-agent" or "remote"
  
  # Sub-agent mode
  sub_agent:
    model: "google/gemini-2.0-flash"
    tools_allow: ["web_fetch", "web_search"]
    tools_deny: ["exec", "message", "sessions_spawn", "gateway", "Write", "nodes", "canvas"]
  
  # Remote mode  
  remote:
    url: "http://192.168.1.x:8420"  # FireClaw proxy URL
    api_key: ""                       # Set via keychain
    timeout_ms: 30000
  
  # Behavior
  remind_when_disabled: true    # Remind at start of new threads
  reminder_message: "⚠️ FireClaw is currently disabled. Web browsing is unprotected against prompt injection. Say 'enable fireclaw' to re-enable."
  
  # Alerts
  alerts:
    enabled: true
    channel: null               # Use current channel
    severity_threshold: "medium"
```

## Tools Provided

### fireclaw_fetch(url, intent?)
Safely fetch a URL through the FireClaw proxy.
- `url` — The URL to fetch
- `intent` (optional) — What information you need (improves summarization accuracy)
- Returns: `{ content, metadata: { severity, detections, duration, cached, trustTier } }`

### fireclaw_search(query, count?)
Safely search the web through the FireClaw proxy.
- `query` — Search query
- `count` (optional) — Number of results (1-10)
- Returns: `{ content, metadata }`

### fireclaw_status()
Check FireClaw proxy status, connection health, and recent stats.

### fireclaw_enable()
Enable the FireClaw proxy.

### fireclaw_disable()
Disable the FireClaw proxy (will trigger reminders on new threads).

## Thread Reminder

When FireClaw is disabled, the skill injects a reminder at the start of each new conversation thread:

> ⚠️ FireClaw is currently disabled. Web browsing is unprotected against prompt injection. Say "enable fireclaw" to re-enable.

This ensures the user is always aware when protection is off. The reminder is conversational — the user can re-enable with a simple command.
