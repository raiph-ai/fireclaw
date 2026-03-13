# FireClaw Dashboard

Local network-only web UI for managing and monitoring FireClaw proxy.

## Features

- **🔒 OTP Authentication** — Email-based one-time password (5-minute expiry)
- **📊 Overview** — Real-time stats, trends, and top offending domains
- **📜 Audit Log** — Searchable/filterable fetch history
- **🌐 Domain Management** — Trust tiers (trusted/neutral/suspicious/blocked)
- **⚙️ Configuration** — View FireClaw settings
- **🛡️ Threat Feed** — Community threat intelligence from fireclaw.app
- **🚨 Alerts** — Recent alert history with severity levels

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/rAIph/clawd/skills/honey-bot/dashboard
npm install
```

### 2. Configure

Edit `config.yaml`:

- Set `auth.adminEmail` to your email address
- Configure SMTP settings for OTP delivery
- Set `SMTP_PASSWORD` environment variable or update `smtp.auth.pass`

**SMTP Configuration:**

For Gmail:
1. Enable 2FA on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password in config or set env var:

```bash
export SMTP_PASSWORD="your-app-password"
```

### 3. Run

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

Dashboard will be available at:
- http://localhost:8420
- http://[your-lan-ip]:8420

## Security

- **Local network only** — Server rejects connections from non-private IPs
- **No internet exposure** — Do NOT expose port 8420 to the public internet
- **Session cookies** — 24-hour expiry, httpOnly flag
- **OTP expiry** — Codes expire after 5 minutes

## File Structure

```
dashboard/
├── server.mjs           # Express.js backend
├── config.yaml          # Configuration
├── package.json         # Dependencies
├── public/
│   ├── index.html       # Single-page app
│   ├── style.css        # Dark theme styles
│   └── app.js           # Frontend logic
└── README.md
```

## Data Files

The dashboard reads from:

- `../data/audit.jsonl` — Audit log (one JSON object per line)
- `../config.yaml` — FireClaw configuration
- `../data/domain-tiers.json` — Domain trust tiers

Example audit log entry:

```json
{
  "timestamp": "2026-02-14T18:00:00.000Z",
  "url": "https://example.com/page",
  "patternsDetected": ["IGNORE PREVIOUS"],
  "action": "block",
  "severity": "high",
  "alert": true
}
```

Example domain tiers:

```json
{
  "trusted": ["github.com", "openai.com"],
  "neutral": ["wikipedia.org"],
  "suspicious": ["sketchy-site.com"],
  "blocked": ["evil-domain.net"]
}
```

## Troubleshooting

### OTP Not Sending

If OTP emails aren't arriving:

1. Check SMTP credentials in `config.yaml`
2. Verify `SMTP_PASSWORD` environment variable is set
3. For Gmail, ensure you're using an App Password, not your account password
4. Check server console — OTP will be logged if SMTP is not configured

### Can't Access Dashboard

1. Verify server is running: `http://localhost:8420`
2. Check firewall settings
3. Ensure your IP is in a private network range (192.168.x.x, 10.x.x.x, etc.)
4. Check server logs for IP restriction messages

### Session Expired

Sessions last 24 hours. Click "Logout" and log in again with a new OTP.

## Production Deployment

For production use:

1. **Change session secret** in `config.yaml`
2. **Use HTTPS** — Set up reverse proxy (nginx/Caddy) with TLS
3. **Set secure cookie flag** — Update `server.mjs` session config when using HTTPS
4. **Environment variables** — Store secrets in env vars, not config file
5. **Firewall** — Restrict port 8420 to local network only

## Development

The frontend is vanilla JavaScript — no build step required. Just edit and refresh.

### Adding a New Page

1. Add nav link in `index.html`:
   ```html
   <li><a href="#" data-page="mypage" class="nav-link">My Page</a></li>
   ```

2. Add page content:
   ```html
   <div id="page-mypage" class="page">
     <!-- Your content -->
   </div>
   ```

3. Add API route in `server.mjs`
4. Add load function in `app.js`

## License

AGPLv3 — See LICENSE file for details.
