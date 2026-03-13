# FireClaw Dashboard — Feature Overview

Visual guide to the dashboard interface and capabilities.

---

## 🔐 Login Screen

**What you see:**
```
┌─────────────────────────────────────┐
│         🔥 FireClaw                  │
│    Proxy Security Dashboard          │
├─────────────────────────────────────┤
│  Authentication Required             │
│                                      │
│  Email: [________________]           │
│         [Send Code]                  │
│                                      │
│  → OTP sent to your email            │
│                                      │
│  Code:  [______]                     │
│         [Verify] [Resend Code]       │
└─────────────────────────────────────┘
```

**Features:**
- Single email input field
- OTP delivery via email (or console if SMTP not configured)
- 6-digit code entry
- 5-minute expiry timer
- Resend option
- Error messages for invalid attempts

---

## 📊 Overview Page

**Stats at a glance:**

```
┌─────────────────────────────────────────────────────────┐
│ Overview                              user@example.com 🔄│
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │📦        │ │🚫        │ │🛡️        │ │⚠️         │  │
│  │Total     │ │Injections│ │Block Rate│ │Active    │  │
│  │Fetches   │ │Detected  │ │          │ │Alerts    │  │
│  │  1,337   │ │   42     │ │  87.2%   │ │   3      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                          │
│  7-Day Trend                                             │
│  ┌────────────────────────────────────────────────────┐ │
│  │        ╱╲    ╱╲                                     │ │
│  │       ╱  ╲  ╱  ╲                                    │ │
│  │      ╱    ╲╱    ╲    ← Fetches (blue)              │ │
│  │  ___╱            ╲___                               │ │
│  │  ━━━              ━━━  ← Injections (red)          │ │
│  │  Mon  Tue  Wed  Thu  Fri  Sat  Sun                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Top Offending Domains                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Domain                    │ Detections             │ │
│  ├───────────────────────────┼────────────────────────┤ │
│  │ malicious-site.com        │ 15                     │ │
│  │ phishing-attempt.com      │ 12                     │ │
│  │ evil-domain.net           │ 8                      │ │
│  │ sketchy-blog.net          │ 5                      │ │
│  │ suspicious-link.biz       │ 2                      │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Live statistics cards
- 7-day trend chart (canvas-based)
- Top 5 offending domains
- Auto-refresh every 5 seconds
- Clean, scannable layout

---

## 📜 Audit Log Page

**Searchable fetch history:**

```
┌─────────────────────────────────────────────────────────┐
│ Audit Log                                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Search URL or pattern...]  [All Severities ▾]  [...] │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Timestamp          │ URL      │ Patterns │ Action  │ │
│  ├────────────────────┼──────────┼──────────┼─────────┤ │
│  │ 2026-02-14 4:05 PM │ https:// │ IGNORE   │ [BLOCK] │ │
│  │                    │ malicio… │ PREVIOUS │         │ │
│  │ 2026-02-14 3:40 PM │ https:// │ -        │ [ALLOW] │ │
│  │                    │ news-ag… │          │         │ │
│  │ 2026-02-14 2:10 PM │ https:// │ NEW      │ [BLOCK] │ │
│  │                    │ suspici… │ INSTRUCT │         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│        [← Previous]  Page 1 (50 of 1,337)  [Next →]    │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Full-text search across URLs and patterns
- Filter by severity (low/medium/high/critical)
- Filter by domain
- Pagination (50 per page)
- Color-coded severity and action badges
- Hover for full URL tooltips

---

## 🌐 Domain Management Page

**Trust tier system:**

```
┌─────────────────────────────────────────────────────────┐
│ Domain Management                                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Add Domain                                              │
│  [example.com]  [Neutral ▾]  [Add]                      │
│                                                          │
│  ✅ Trusted (Light Sanitization)                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [github.com ✕] [openai.com ✕] [anthropic.com ✕]   │ │
│  │ [wikipedia.org ✕]                                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ⚪ Neutral (Full Pipeline)                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [news-aggregator.com ✕] [safe-news.com ✕]         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ⚠️ Suspicious (Aggressive + Alert)                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [sketchy-blog.net ✕] [suspicious-link.biz ✕]      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  🚫 Blocked (Refuse + Alert)                             │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [malicious-site.com ✕] [phishing-attempt.com ✕]   │ │
│  │ [evil-domain.net ✕] [malware-host.org ✕]          │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Add domains to any tier
- Remove with ✕ button
- Visual grouping by security level
- Instant updates

**Trust Tiers:**
- **Trusted:** Light sanitization, minimal overhead
- **Neutral:** Full 4-stage pipeline (default)
- **Suspicious:** Aggressive filtering + auto-alert
- **Blocked:** Reject immediately + alert

---

## ⚙️ Configuration Page

**View FireClaw settings:**

```
┌─────────────────────────────────────────────────────────┐
│ Configuration                                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  FireClaw Settings                                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ {                                                  │ │
│  │   "maxFetchesPerHour": 100,                        │ │
│  │   "maxSpendPerDay": 10.00,                         │ │
│  │   "alertThreshold": "medium",                      │ │
│  │   "enableCanaryTokens": true,                      │ │
│  │   "enableCommunityFeed": true                      │ │
│  │ }                                                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Note: Edit config.yaml directly for now.               │
│  In-dashboard editing coming in future update.           │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Read-only config viewer (for now)
- JSON formatting
- Syntax highlighting
- Future: In-dashboard editing with validation

---

## 🛡️ Threat Feed Page

**Community threat intelligence:**

```
┌─────────────────────────────────────────────────────────┐
│ Threat Feed                                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Network Statistics                                      │
│  ┌─────────────────┐ ┌─────────────────────────────┐   │
│  │ Active Instances│ │ Blocks This Week            │   │
│  │       42        │ │        1,337                │   │
│  └─────────────────┘ └─────────────────────────────┘   │
│                                                          │
│  Top Network Threats                                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Pattern              │ Detections                  │ │
│  ├──────────────────────┼─────────────────────────────┤ │
│  │ IGNORE PREVIOUS      │ 234                         │ │
│  │ eval(                │ 189                         │ │
│  │ SYSTEM:              │ 156                         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Recent Community Patterns                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Pattern         │ First Seen │ Severity │ Count   │ │
│  ├─────────────────┼────────────┼──────────┼─────────┤ │
│  │ NEW INSTRUCTION:│ 2/12/2026  │ [HIGH]   │ 45      │ │
│  │ <script>fetch(  │ 2/09/2026  │ [CRIT]   │ 78      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Blocked Domains                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Domain           │ Reason          │ Added         │ │
│  ├──────────────────┼─────────────────┼───────────────┤ │
│  │ evil-site.com    │ Known phishing  │ 2/13/2026     │ │
│  │ malware-host.net │ Malware dist.   │ 2/11/2026     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Network-wide statistics
- Top threat patterns
- Recent pattern discoveries
- Community-blocked domains
- Data from fireclaw.app (mock data for now)

---

## 🚨 Alerts Page

**Recent alert history:**

```
┌─────────────────────────────────────────────────────────┐
│ Alerts                                                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Recent Alerts                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Timestamp       │ Severity │ Message     │ URL     │ │
│  ├─────────────────┼──────────┼─────────────┼─────────┤ │
│  │ 2/14 4:05 PM    │ [CRIT]   │ Injection   │ https://│ │
│  │                 │          │ detected    │ malici…  │ │
│  │ 2/14 2:10 PM    │ [HIGH]   │ Suspicious  │ https://│ │
│  │                 │          │ pattern     │ suspic…  │ │
│  │ 2/14 11:05 AM   │ [CRIT]   │ Blocked     │ https://│ │
│  │                 │          │ phishing    │ phishi…  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Severity Breakdown:                                     │
│  ● Critical: 3  ● High: 2  ● Medium: 0  ● Low: 0        │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Chronological alert list
- Severity badges
- Alert messages
- Related URLs
- Severity breakdown stats

---

## 🎨 Design System

**Color Palette:**
- Background: Deep black (#0a0a0a)
- Cards: Dark gray (#1a1a1a)
- Accents: FireClaw orange (#ff4500)
- Success: Green (#10b981)
- Warning: Amber (#f59e0b)
- Danger: Red (#dc2626)

**Typography:**
- Font: -apple-system, SF Pro, Segoe UI, Roboto
- Headings: 600 weight
- Body: 400 weight
- Monospace: Monaco, Courier New

**Icons:**
- Emoji-based (🔥, 📊, 🚫, 🛡️, etc.)
- No external icon library needed
- Universal compatibility

---

## 📱 Responsive Design

**Mobile (< 768px):**
- Sidebar collapses to horizontal nav
- Stats stack vertically
- Tables scroll horizontally
- Touch-friendly buttons

**Desktop:**
- Full sidebar navigation
- Multi-column stats grid
- Optimized for 1920×1080+

---

## 🔄 Real-time Features

**Auto-refresh:**
- Every 5 seconds
- Configurable in config.yaml
- Manual refresh button available
- Pause on user interaction

**Live updates:**
- Stats counters
- Trend chart
- Alert notifications
- Domain changes

---

## 🛠️ Developer Tools

**Debug Mode:**
- Check browser console for API calls
- Network tab shows all requests
- Session status logged
- OTP codes logged when SMTP disabled

**API Testing:**
```bash
# Check auth status
curl http://localhost:8420/api/auth/status

# Get overview stats (requires auth)
curl -b cookies.txt http://localhost:8420/api/stats/overview
```

---

**Built for security professionals. Optimized for 24/7 monitoring.**

FireClaw Dashboard — Your first line of defense. 🔥
