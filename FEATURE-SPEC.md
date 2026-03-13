# FireClaw — Complete Feature Specification

**Date:** 2026-02-14
**Status:** Approved by Ralph — build in progress

---

## Product Name: FireClaw
- Domain: fireclaw.app (community hub / threat feed)
- Tagline: TBD (website coming later)

## Four Workstreams

### 1. Core FireClaw Proxy Service
The sanitization proxy with all features:

- **4-Stage Pipeline:** fetch → structural sanitize → LLM summarize → output scan
- **Community Threat Feed Client:** pulls updated blocklists/patterns from fireclaw.app
- **DNS-Level Pre-Check:** checks URLs against FireClaw community list + public lists (URLhaus, PhishTank, OpenPhish) before fetching
- **Canary Token System:** injects unique markers before summarization; detects if content passes through unsummarized or if injection reaches main agent actions
- **Rate Limiting & Cost Controls:** max fetches per minute/hour/day, max spend per day, auto-throttle, alerts when approaching limits
- **Audit Log:** append-only JSONL log of every fetch — URL, patterns detected, actions taken, timestamps. Replay capability for retroactive analysis
- **Domain Trust Tiers:** trusted (light sanitization), neutral (full pipeline), suspicious (aggressive + auto-alert), blocked (refuse + alert). Customizable per user.
- **Alert System:** severity-tiered alerts (low/medium/high/critical) via configured messaging platform. Anti-injection hardened alerts. Configurable threshold and digest mode.
- **Inner Alignment Protection:** proxy pipeline is FIXED — main agent cannot override or bypass sanitization
- **❌ NO Bypass Mode** (Ralph explicitly excluded this)

### 2. Web Dashboard (Local Network)
- Lightweight web UI running on the FireClaw proxy instance
- **Local network only** — binds to LAN IP, not internet-exposed
- **OTP via email** for authentication — one-time code, 5-minute expiry
- **Features:**
  - Stats: fetches proxied, injections detected, top offending domains, trends
  - Config: enable/disable features, manage trusted domains, adjust thresholds
  - Audit log viewer: browse and search fetch history
  - Threat feed: browse community data from fireclaw.app
  - Domain management: trust tiers, blocklist, allowlist

### 3. fireclaw.app Backend
- Community threat feed aggregation API
- **Receives:** anonymized detection data from opt-in FireClaw instances (domain, pattern type, timestamp, severity — no content, no user data)
- **Serves:** updated blocklists, pattern signatures, domain reputation scores
- **Public dashboard:** "X injection attempts blocked across the network this week"
- **API endpoints:** for FireClaw instances to report and pull data

### 4. Main OpenClaw Skill (Client)
- The `fireclaw` skill installed on the main OpenClaw instance
- **Tool replacements:** `fireclaw_fetch`, `fireclaw_search`
- **Commands:** `fireclaw enable`, `fireclaw disable`, `fireclaw status`
- **Disabled reminder:** If FireClaw proxy is disabled, reminds the human at the start of each new thread/session
- **Conversational control:** user can toggle via chat ("pause FireClaw", "show stats")
- **Proxies dashboard access** if user wants single pane of glass

## 5. fireclaw.app Website & Hosting

### Architecture (cheapest possible)
- **Marketing site** → GitHub Pages (FREE) — static HTML/CSS/JS with motion effects
- **Threat feed API** → Supabase free tier (FREE) — 500MB PostgreSQL, REST API built in
- **Domain** → fireclaw.app (~$12/year)
- **Total cost: ~$1/month**
- Custom domain via CNAME to GitHub Pages, free SSL

### Website Sections
- Hero with fire animation, "A firewall for your agent's brain"
- Problem explanation (prompt injection)
- How it works (animated 4-stage pipeline)
- Features grid (8 features)
- Community threat intelligence ("stronger together")
- Deploy anywhere (Pi, Docker, Node.js)
- Dashboard preview
- Open source (MIT, GitHub, contributing)
- Support FireClaw (Buy Me a Coffee / Ko-fi link)

### Future Revenue
- Buy Me a Coffee / Ko-fi for community support
- No paid tiers initially — keep it free and open source
- Ralph funding from pocket, minimize costs

## Additional Notes
- Multimodal protection (images/PDFs) is future work, not in this build
- Docker for community distribution (Ralph's decision)
- Supabase for threat feed DB (Ralph wants cheapest option)
