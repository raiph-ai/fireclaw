# Changelog

All notable changes to FireClaw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-22

### Added
- **`/api/scan` endpoint** — Scan arbitrary text through stages 2–4 without fetching a URL
  - Use for tool descriptions, memory artifacts, MCP server responses, or any untrusted text
  - Supports `source` label for audit trail and `intent` for LLM focus
  - 64KB max input, proper validation and error handling
  - Also accessible via `/api/proxy` with `X-FireClaw-Action: scan`
- **`fireclaw_scan(text, source?, intent?)` export** — Programmatic access to the scan pipeline
- Updated roadmap with completed arbitrary text scanning milestone

### Fixed
- **Reduced false positives in Stage 4 output scanner** — Relaxed overly aggressive patterns:
  - `unicode_trickery` — no longer flags normal Unicode text (e.g. curly quotes, em dashes)
  - `credential_request` — scoped to actual credential extraction attempts, not mentions of credentials in context
  - `sensitive_op_format` — tightened to match actual tool-call syntax, not prose descriptions

### Verified
- **Community threat feed (Supabase)** — confirmed working across instances; anonymous detection metadata is shared correctly with INSERT-only Row Level Security

### Changed
- Proxy module loader now includes `fireclaw_scan` in dynamic import
- Updated README with full `/api/scan` API documentation

## [1.0.0] - 2026-02-14

### Added
- Initial release of FireClaw
- 4-stage sanitization pipeline:
  - Stage 1: Raw fetch via restricted sub-agent
  - Stage 2: Structural sanitization (rule-based)
  - Stage 3: LLM summarization with hardened prompt
  - Stage 4: Output scan for residual injection
- `fireclaw_fetch(url, intent?)` — Proxied web_fetch with injection defense
- `fireclaw_search(query, count?)` — Proxied web_search with injection defense
- `fireclaw_stats()` — Get FireClaw configuration and statistics
- Comprehensive injection pattern library:
  - 12 structural patterns (HTML tricks, hidden Unicode, etc.)
  - 25 injection signatures (ignore previous, system impersonation, etc.)
  - 7 output patterns (tool call syntax, JSON exploits, etc.)
- Configuration via `config.yaml`:
  - Configurable proxy model (default: Gemini Flash)
  - Input/output size limits
  - Alert settings (channel, severity)
  - Trusted domain bypass list
  - Sub-agent restrictions
- In-memory caching with TTL
- Comprehensive logging (fetch operations + sanitization decisions)
- Alert system for high-severity detections
- Test suite with injection samples
- Usage examples
- Complete documentation

### Security
- Sub-agent restricted to read-only tools (no exec, message, write)
- Hardened system prompt that ignores embedded instructions
- Pattern-based detection of 30+ known injection vectors
- Severity scoring and classification
- Automatic alerting on high-risk content

## [Unreleased]

### Planned
- Physical isolation mode (Docker/separate instance)
- Multimodal pipeline (image OCR → text sanitization)
- Canary token detection (auto-detect successful injections)
- Reputation scoring for domains
- Audit log persistence
- Community pattern repository
- Pattern auto-updates
- Browser content sanitization
- PDF text extraction + sanitization
- Integration tests with real OpenClaw instance
- Performance benchmarks
- Async batch processing
- Custom summarization templates

### Ideas for Community
- Pattern contribution system (GitHub PRs)
- False positive reporting
- Bypass domain suggestions
- Custom sanitization rules (per-domain)
- Sanitization strictness levels (strict, balanced, permissive)
- SIEM integration (export alerts to security tools)
- Grafana dashboard for metrics
