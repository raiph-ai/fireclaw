# FireClaw Threat Feed API - Quick Reference

Cheat sheet for common operations.

## Installation

```bash
npm install
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ^ Copy key to config.yaml
npm run init-db
npm start
```

## API Calls

### Submit Report (requires API key)
```bash
curl -X POST http://localhost:3000/api/report \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY_HERE" \
  -d '{
    "instanceId": "abc123...",
    "domain": "evil.com",
    "patternType": "prompt_injection",
    "severity": "high",
    "timestamp": '$(date +%s)'
  }'
```

### Get Blocklist
```bash
# Full list
curl http://localhost:3000/api/blocklist

# Incremental update (since timestamp)
curl "http://localhost:3000/api/blocklist?since=1708000000"
```

### Get Patterns
```bash
# All patterns
curl http://localhost:3000/api/patterns

# Delta (only new patterns since version X)
curl "http://localhost:3000/api/patterns?version=1"
```

### Get Stats
```bash
curl http://localhost:3000/api/stats | jq
```

### Check Domain Reputation
```bash
curl http://localhost:3000/api/reputation/evil.com | jq
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Database

### Backup
```bash
sqlite3 data/fireclaw.db ".backup data/backup.db"
```

### Query Reports
```bash
sqlite3 data/fireclaw.db "SELECT * FROM reports ORDER BY timestamp DESC LIMIT 10;"
```

### Query Top Domains
```bash
sqlite3 data/fireclaw.db "SELECT domain, report_count, severity FROM domains ORDER BY report_count DESC LIMIT 10;"
```

### Query Pattern Stats
```bash
sqlite3 data/fireclaw.db "SELECT pattern_type, detection_count FROM patterns ORDER BY detection_count DESC;"
```

### Clean Old Reports (90+ days)
```bash
sqlite3 data/fireclaw.db "DELETE FROM reports WHERE timestamp < unixepoch() - 7776000;"
```

## Process Management

### PM2
```bash
# Start
pm2 start server.mjs --name fireclaw-api

# Status
pm2 status

# Logs
pm2 logs fireclaw-api

# Restart
pm2 restart fireclaw-api

# Stop
pm2 stop fireclaw-api

# Auto-start on boot
pm2 startup
pm2 save
```

### systemd
```bash
# Start
sudo systemctl start fireclaw-api

# Status
sudo systemctl status fireclaw-api

# Logs
sudo journalctl -u fireclaw-api -f

# Restart
sudo systemctl restart fireclaw-api

# Enable auto-start
sudo systemctl enable fireclaw-api
```

## Development

### Start with auto-reload
```bash
npm run dev
```

### Run tests
```bash
export API_KEY="your_key_here"
node test-client.mjs
```

### Validate setup
```bash
node validate-setup.mjs
```

## Configuration

### Change port
```bash
PORT=8080 npm start
```

Or in `config.yaml`:
```yaml
server:
  port: 8080
```

### Add API key
Edit `config.yaml`:
```yaml
security:
  apiKeys:
    - "key1_here"
    - "key2_here"
```

### Adjust rate limits
Edit `config.yaml`:
```yaml
rateLimits:
  report:
    maxRequests: 20  # Increase limit
```

## Monitoring

### Check if server is running
```bash
curl http://localhost:3000/health
```

### Monitor request rate
```bash
# Watch logs for rate limit hits
pm2 logs fireclaw-api --lines 50 | grep "rate limit"
```

### Database size
```bash
ls -lh data/fireclaw.db
```

### Count reports
```bash
sqlite3 data/fireclaw.db "SELECT COUNT(*) FROM reports;"
```

## Troubleshooting

### Port already in use
```bash
# Find process
lsof -ti:3000

# Kill it
lsof -ti:3000 | xargs kill
```

### Reset database
```bash
rm -rf data/
npm run init-db
```

### View full error logs
```bash
pm2 logs fireclaw-api --err --lines 100
```

### Test API key
```bash
curl -X POST http://localhost:3000/api/report \
  -H "X-API-Key: test" \
  -H "Content-Type: application/json" \
  -d '{}' -v
# Should get 403 if key is wrong
```

## Common Pattern Types

- `prompt_injection` - Classic prompt injection
- `data_exfiltration` - Data theft attempts  
- `jailbreak` - Role-playing attacks
- `command_injection` - Script injection
- `other` - Other threats

## Severity Levels

- `low` - Minor threat, informational
- `medium` - Moderate threat, watch list
- `high` - Serious threat, block recommended
- `critical` - Severe threat, block immediately

## Reputation Scores

- **100** - Clean domain (no reports)
- **75-99** - Minor issues (1-2 reports)
- **50-74** - Concerning (multiple reports)
- **25-49** - High risk (many reports or high severity)
- **0-24** - Maximum threat (critical severity, many reports)

## Rate Limits (default)

- **Global:** 100 req/min per IP
- **Report:** 10 req/min per instanceId
- **Reputation:** 30 req/min per IP

## File Locations

- **Config:** `./config.yaml`
- **Database:** `./data/fireclaw.db`
- **Logs:** PM2: `~/.pm2/logs/`, systemd: `journalctl`

## Environment Variables

```bash
PORT=3000              # Server port
HOST=0.0.0.0          # Bind address
NODE_ENV=production   # Environment
```

## nginx Reverse Proxy

Minimal config:
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## Security Checklist

- [ ] Strong API keys (64+ chars)
- [ ] No placeholder keys in config
- [ ] CORS origins configured
- [ ] SSL/TLS enabled (production)
- [ ] Firewall rules set
- [ ] Regular backups scheduled
- [ ] Log monitoring enabled
- [ ] Rate limits appropriate

---

**For full documentation, see README.md and SETUP-GUIDE.md**
