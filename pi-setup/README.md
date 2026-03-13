# FireClaw — Raspberry Pi 4 Deployment

## Prerequisites
- Raspberry Pi 4 (4GB+ recommended)
- Fresh Raspberry Pi OS (64-bit) on SD card
- WiFi or Ethernet connected
- SSH enabled

## Flashing the SD Card
1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Choose: Raspberry Pi OS (64-bit) — Lite is fine (no desktop needed)
3. Click the gear icon before flashing:
   - Set hostname: `fireclaw.local`
   - Enable SSH (password auth)
   - Set username: `pi` (or your preference)
   - Set password
   - Configure WiFi (if not using ethernet)
   - Set locale/timezone: America/Los_Angeles
4. Flash and boot

## First Boot
```bash
# SSH in
ssh pi@fireclaw.local

# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/setup-fireclaw.sh | bash
# OR copy manually:
scp pi-setup/setup-fireclaw.sh pi@fireclaw.local:~/
ssh pi@fireclaw.local "chmod +x setup-fireclaw.sh && ./setup-fireclaw.sh"
```

## Transfer FireClaw Files
```bash
# From the Mac Mini
rsync -avz --exclude node_modules skills/honey-bot/ pi@fireclaw.local:~/fireclaw/
```

## Verify
```bash
ssh pi@fireclaw.local
cd ~/fireclaw
node fireclaw.mjs --test  # Run tests
sudo systemctl status fireclaw-proxy
```

## Connect Main OpenClaw
In your main OpenClaw's FireClaw client config:
```yaml
fireclaw_client:
  mode: "remote"
  remote:
    url: "http://fireclaw.local:8420"
```

## Store Pi Credentials
```bash
# On the Mac Mini — store in Keychain
security add-generic-password -s "fireclaw-pi-ssh" -a "pi" -w "YOUR_PASSWORD"
```

## License

AGPLv3 — See LICENSE file for details.
