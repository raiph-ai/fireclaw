# FireClaw Threat Feed - Setup Guide

Step-by-step guide to get the API running.

## Prerequisites

- Node.js 18+ installed
- Terminal access
- Text editor

## Step 1: Install Dependencies

```bash
cd /Users/rAIph/clawd/skills/honey-bot/threat-feed
npm install
```

This installs:
- Express.js (web server)
- better-sqlite3 (database)
- helmet (security)
- express-rate-limit (rate limiting)
- cors (cross-origin support)
- joi (validation)
- yaml (config parsing)

## Step 2: Generate API Keys

FireClaw instances need API keys to submit reports. Generate one or more:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output:
```
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

Copy this key.

## Step 3: Configure API Keys

Open `config.yaml` and replace the placeholder API keys:

```yaml
security:
  apiKeys:
    - "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
    - "GENERATE_ANOTHER_KEY_IF_YOU_NEED_MULTIPLE"
```

**Security Note:** Each FireClaw instance should have its own API key for tracking and revocation.

## Step 4: Initialize Database

Create the SQLite database and schema:

```bash
npm run init-db
```

You should see:
```
✓ Database initialized: ./data/fireclaw.db
✓ Default patterns inserted
Database initialized successfully
```

## Step 5: Start the Server

```bash
npm start
```

You should see:
```
🔥 FireClaw Threat Feed API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server running at http://0.0.0.0:3000
Environment: production
Database: ./data/fireclaw.db

Available endpoints:
  POST /api/report           - Submit threat report
  GET  /api/blocklist        - Get blocklist
  GET  /api/patterns         - Get patterns
  GET  /api/stats            - Get statistics
  GET  /api/reputation/:domain - Domain lookup
  GET  /health               - Health check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The API is now running! 🎉

## Step 6: Test the API

In a new terminal, run the test client:

```bash
# Set your API key
export API_KEY="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"

# Run tests
node test-client.mjs
```

This will:
1. Submit sample threat reports
2. Fetch the blocklist
3. Get threat patterns
4. Retrieve statistics
5. Check domain reputation

## Step 7: Verify with curl

Health check:
```bash
curl http://localhost:3000/health
```

Get stats:
```bash
curl http://localhost:3000/api/stats
```

Submit a report (replace YOUR_API_KEY):
```bash
curl -X POST http://localhost:3000/api/report \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "instanceId": "test123456789abcdef",
    "domain": "evil.example.com",
    "patternType": "prompt_injection",
    "severity": "high",
    "timestamp": '$(date +%s)'
  }'
```

## Configuration Options

### Change Port

Edit `config.yaml`:
```yaml
server:
  port: 8080  # Change from 3000
```

Or use environment variable:
```bash
PORT=8080 npm start
```

### Enable CORS for Your Domain

Edit `config.yaml`:
```yaml
security:
  cors:
    enabled: true
    origins:
      - "https://fireclaw.app"
      - "https://yourdomain.com"  # Add your domain
```

### Adjust Rate Limits

Edit `config.yaml`:
```yaml
rateLimits:
  report:
    windowMs: 60000
    maxRequests: 20  # Increase from 10 to allow more reports
```

## Production Deployment

### 1. Use a Process Manager

Install PM2:
```bash
npm install -g pm2
```

Start with PM2:
```bash
pm2 start server.mjs --name fireclaw-api
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

### 2. Set Up Reverse Proxy (nginx)

Create `/etc/nginx/sites-available/fireclaw`:
```nginx
server {
    listen 80;
    server_name fireclaw.app;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/fireclaw /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Enable SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d fireclaw.app
```

### 4. Configure for Production

Update `config.yaml`:
```yaml
server:
  trustProxy: true  # Important when behind nginx
```

## Troubleshooting

### Port already in use
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:** Change port or kill the process using it:
```bash
lsof -ti:3000 | xargs kill
```

### Database permission error
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**Solution:** Ensure data directory exists and has write permissions:
```bash
mkdir -p data
chmod 755 data
```

### API key not working
```
{"error":"Invalid API key"}
```

**Solution:** Check that:
1. API key in config.yaml matches what you're sending
2. No extra spaces or quotes in the key
3. Header is `X-API-Key` (case-sensitive)

### Rate limit errors
```
{"error":"Report rate limit exceeded"}
```

**Solution:** You're sending reports too fast. Either:
1. Wait before retrying
2. Increase rate limits in config.yaml

## Monitoring

View logs with PM2:
```bash
pm2 logs fireclaw-api
```

Check server status:
```bash
curl http://localhost:3000/health
```

Monitor database size:
```bash
ls -lh data/fireclaw.db
```

## Backup

Backup database:
```bash
sqlite3 data/fireclaw.db ".backup data/fireclaw-$(date +%Y%m%d).db"
```

Automate with cron (daily backup):
```bash
0 2 * * * cd /path/to/threat-feed && sqlite3 data/fireclaw.db ".backup data/fireclaw-$(date +\%Y\%m\%d).db"
```

## Next Steps

1. **Connect FireClaw instances** - Give them API keys and configure endpoint
2. **Set up monitoring** - Use tools like Grafana or simple uptime monitors
3. **Plan scaling** - If you get high traffic, consider load balancing
4. **Review logs** - Check for suspicious patterns in reports
5. **Update patterns** - Add new threat signatures as they're discovered

## Support

- Read the [README.md](README.md) for API documentation
- Check the [Feature Spec](../FEATURE-SPEC.md) for architecture details
- Report issues on GitHub (when available)

---

**You're all set! The FireClaw Threat Feed is now protecting the network.** 🔥🛡️
