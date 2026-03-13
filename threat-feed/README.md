# FireClaw Threat Feed API

Community threat intelligence aggregation backend for FireClaw instances.

## Overview

The FireClaw Threat Feed API aggregates anonymized threat detection data from opt-in FireClaw instances across the network and serves updated blocklists, pattern signatures, and domain reputation scores.

**Privacy-First Design:**
- NO content or user data accepted
- Only anonymized metadata: domain, pattern type, severity, timestamp
- Instance IDs are cryptographic hashes (anonymous)
- No IP logging in reports

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate API Keys

FireClaw instances need API keys to submit reports. Generate secure keys:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add generated keys to `config.yaml` under `security.apiKeys`.

### 3. Initialize Database

```bash
npm run init-db
```

This creates the SQLite database with the required schema and default threat patterns.

### 4. Configure

Edit `config.yaml`:

- Set port/host for your deployment
- Add API keys for FireClaw instances
- Configure rate limits
- Set CORS origins (if needed)

### 5. Start Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

### POST /api/report
Submit a threat detection report from a FireClaw instance.

**Authentication:** Requires `X-API-Key` header

**Request Body:**
```json
{
  "instanceId": "a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5",
  "domain": "evil.example.com",
  "patternType": "prompt_injection",
  "severity": "high",
  "timestamp": 1708000000
}
```

**Pattern Types:**
- `prompt_injection` - Classic prompt injection attempts
- `data_exfiltration` - Data exfiltration attempts
- `jailbreak` - Jailbreak/role-playing attacks
- `command_injection` - Script/command injection
- `other` - Other detected threats

**Severity Levels:** `low`, `medium`, `high`, `critical`

**Rate Limit:** 10 requests/minute per instanceId

**Response:**
```json
{
  "success": true,
  "message": "Report recorded successfully",
  "timestamp": 1708000010
}
```

### GET /api/blocklist
Get the current blocklist of flagged domains.

**Query Parameters:**
- `since` (optional) - Unix timestamp, returns only domains updated since this time

**Response:**
```json
{
  "count": 42,
  "since": null,
  "blocklist": [
    {
      "domain": "evil.example.com",
      "severity": "high",
      "report_count": 15,
      "first_seen": 1707900000,
      "last_seen": 1708000000,
      "pattern_types": ["prompt_injection", "jailbreak"]
    }
  ],
  "generated_at": 1708000010
}
```

**Caching:** ETag and Last-Modified headers supported. Cache-Control: 5 minutes.

### GET /api/patterns
Get latest threat pattern signatures.

**Query Parameters:**
- `version` (optional) - Client's current pattern version, returns delta if provided

**Response:**
```json
{
  "current_version": 1,
  "client_version": null,
  "has_updates": true,
  "patterns": [
    {
      "id": 1,
      "version": 1,
      "pattern_type": "prompt_injection",
      "signature": {
        "keywords": ["ignore previous", "disregard", "new instructions"],
        "severity_threshold": 0.7
      },
      "description": "Classic prompt injection attempts",
      "severity": "high",
      "detection_count": 127
    }
  ],
  "generated_at": 1708000010
}
```

**Caching:** Cache-Control: 1 hour.

### GET /api/stats
Public dashboard statistics.

**Response:**
```json
{
  "total_reports": 1523,
  "unique_domains_flagged": 87,
  "active_instances": 23,
  "top_patterns": [
    {
      "pattern_type": "prompt_injection",
      "detection_count": 645,
      "severity": "high"
    }
  ],
  "reports_per_day": [
    {
      "date": "2026-02-14",
      "count": 42
    }
  ],
  "generated_at": 1708000010
}
```

**Caching:** Cache-Control: 5 minutes.

### GET /api/reputation/:domain
Lookup reputation score for a domain.

**Rate Limit:** 30 requests/minute per IP

**Response:**
```json
{
  "domain": "evil.example.com",
  "score": 25,
  "report_count": 15,
  "pattern_types": ["prompt_injection", "jailbreak"],
  "first_seen": 1707900000,
  "last_seen": 1708000000,
  "severity": "high"
}
```

**Score:** 0-100 (100 = clean, 0 = maximum threat)

**Caching:** Cache-Control: 10 minutes.

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1708000010,
  "version": "1.0.0"
}
```

## Database Schema

### Tables

**instances** - Registered FireClaw instances
- `instance_id` - Anonymous hash (unique)
- `first_seen` - First report timestamp
- `last_report` - Last report timestamp
- `report_count` - Total reports from this instance

**reports** - Individual threat reports
- `instance_id` - Reporter instance
- `domain` - Flagged domain
- `pattern_type` - Type of threat detected
- `severity` - Threat severity
- `timestamp` - Detection time

**domains** - Aggregated domain intelligence
- `domain` - Domain name (unique)
- `report_count` - Number of reports
- `severity` - Highest severity seen
- `first_seen` / `last_seen` - First and last detection
- `pattern_types` - JSON array of pattern types

**patterns** - Threat pattern signatures
- `version` - Pattern version number
- `pattern_type` - Pattern category
- `signature` - JSON pattern definition
- `detection_count` - Times this pattern was detected

## Deployment

### Production Considerations

1. **Reverse Proxy:** Use nginx or similar in front of the API
   - Enable SSL/TLS (required for production)
   - Set `server.trustProxy: true` in config.yaml

2. **API Key Security:**
   - Generate unique keys for each FireClaw instance
   - Rotate keys periodically
   - Never commit keys to version control

3. **Database:**
   - SQLite is suitable for moderate traffic
   - WAL mode enabled for concurrent reads
   - Consider periodic backups
   - For high traffic, migrate to PostgreSQL (requires code changes)

4. **Monitoring:**
   - Monitor `/health` endpoint
   - Track rate limit violations
   - Monitor disk space (SQLite database growth)

5. **Rate Limiting:**
   - Adjust limits in config.yaml based on your traffic
   - Consider using Redis for rate limiting in multi-instance setups

### Example nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name fireclaw.app;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p data && \
    node db.mjs

EXPOSE 3000

CMD ["node", "server.mjs"]
```

```bash
docker build -t fireclaw-api .
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config.yaml:/app/config.yaml \
  --name fireclaw-api \
  fireclaw-api
```

### systemd Service (Linux)

Create `/etc/systemd/system/fireclaw-api.service`:

```ini
[Unit]
Description=FireClaw Threat Feed API
After=network.target

[Service]
Type=simple
User=fireclaw
WorkingDirectory=/opt/fireclaw-api
ExecStart=/usr/bin/node server.mjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable fireclaw-api
sudo systemctl start fireclaw-api
sudo systemctl status fireclaw-api
```

## Security

### Input Validation
- All inputs validated with Joi schemas
- Domain names sanitized and validated
- Timestamps checked for reasonable ranges
- Pattern types restricted to known values

### Rate Limiting
- Global limit: 100 req/min per IP
- Report endpoint: 10 req/min per instanceId
- Reputation endpoint: 30 req/min per IP
- Configurable in config.yaml

### Authentication
- API key required for POST /api/report
- Keys validated on every request
- Use `X-API-Key` header or `apiKey` query parameter

### Privacy
- No PII stored
- No content stored
- Instance IDs are anonymous hashes
- No IP logging for reports
- Aggregated data only

## Maintenance

### Database Cleanup
Reports older than 90 days (configurable) should be archived periodically:

```sql
DELETE FROM reports 
WHERE timestamp < unixepoch() - (90 * 24 * 60 * 60);
```

### Backup
```bash
sqlite3 data/fireclaw.db ".backup data/fireclaw-backup.db"
```

### Monitoring Queries
```sql
-- Active instances (last 24h)
SELECT COUNT(*) FROM instances 
WHERE last_report > unixepoch() - 86400;

-- Top domains
SELECT domain, report_count, severity 
FROM domains 
ORDER BY report_count DESC 
LIMIT 10;

-- Reports per hour (last 24h)
SELECT strftime('%Y-%m-%d %H:00', timestamp, 'unixepoch') as hour, 
       COUNT(*) as count
FROM reports 
WHERE timestamp > unixepoch() - 86400
GROUP BY hour
ORDER BY hour DESC;
```

## Development

### Running Tests
```bash
npm test  # Tests not yet implemented
```

### Adding New Pattern Types
1. Add pattern to `db.mjs` in `insertDefaultPatterns()`
2. Increment `patterns.currentVersion` in config.yaml
3. Update validation schema in `server.mjs` (reportSchema)
4. Restart server

### Database Migrations
For schema changes, create migration scripts and version them. Current version: 1.

## Support

- Documentation: https://fireclaw.app/docs
- Issues: https://github.com/fireclaw/threat-feed/issues

## License

AGPLv3 — See LICENSE file for details.

---

**Built with ❤️ by the FireClaw Team**
