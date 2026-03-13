# FireClaw OLED Display Service

Cute animated OLED display for the FireClaw honeypot with Wall-E style eyes and event-driven animations.

## Hardware

- **Display:** SSD1306 128x64 I2C OLED
- **Address:** 0x3C on I2C bus 1
- **Platform:** Raspberry Pi 4

### Wiring

| OLED Pin | Pi Pin | GPIO |
|----------|--------|------|
| VCC      | Pin 1  | 3.3V |
| GND      | Pin 6  | GND  |
| SDA      | Pin 3  | GPIO 2 |
| SCL      | Pin 5  | GPIO 3 |

## Features

### Screen Rotation (5-second intervals)

1. **Eyes** 👀 — Animated eyes with periodic blinking (3-5 seconds, randomized) and subtle movement. Wall-E inspired cuteness!
2. **IP Info** 🌐 — Hostname and IP address
3. **Stats** 📊 — Daily fetches and threat count
4. **Uptime** ⏱️ — Service uptime with status indicator
5. **Health** 🏥 — CPU temp, RAM usage, disk usage

### Event-Triggered Animations

Events interrupt the normal rotation and are triggered by updates to the status file:

- **Fire Eyes** 🔥 — Injection detected! Eyes become angry with flame effects (5s + domain display)
- **Shield Flash** 🛡️ — Successful sanitization (1s)
- **Alert Eyes** ⚠️ — High-severity detection, worried expression (3s)
- **Skull** 💀 — Blocked domain attempted (2s)
- **Sleep Eyes** 😴 — Quiet hours or low activity (10s)

## Installation

### Quick Setup

```bash
cd /path/to/oled/
chmod +x install.sh
./install.sh
```

The installer will:
- Install system dependencies
- Enable I2C interface
- Install Python packages
- Create systemd service
- Start the display service

### Manual Setup

1. Install dependencies:
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-dev libopenjp2-7 libtiff6 i2c-tools fonts-dejavu-core
pip3 install -r requirements.txt
```

2. Enable I2C:
```bash
sudo raspi-config
# Navigate to: Interface Options → I2C → Enable
```

3. Test OLED detection:
```bash
i2cdetect -y 1
# You should see "3c" in the output
```

4. Create data directory:
```bash
sudo mkdir -p /home/admin/fireclaw/data
```

5. Install and start service:
```bash
sudo cp fireclaw-oled.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable fireclaw-oled
sudo systemctl start fireclaw-oled
```

## Usage

### Service Management

```bash
# Check status
sudo systemctl status fireclaw-oled

# Start/stop/restart
sudo systemctl start fireclaw-oled
sudo systemctl stop fireclaw-oled
sudo systemctl restart fireclaw-oled

# View logs
sudo journalctl -u fireclaw-oled -f

# Disable auto-start
sudo systemctl disable fireclaw-oled
```

### Testing

Run manually for testing:
```bash
python3 fireclaw_display.py
```

Press Ctrl+C to stop.

## Status File Integration

The display reads from `/home/admin/fireclaw/data/display-status.json`:

```json
{
  "fetches_today": 42,
  "threats_today": 7,
  "last_event": "2025-02-15T14:30:22",
  "last_event_type": "injection",
  "last_event_domain": "evil.example.com",
  "status": "active"
}
```

### Event Types

- `injection` — Triggers fire eyes animation
- `sanitized` — Triggers shield flash
- `alert` — Triggers alert eyes
- `blocked` — Triggers skull animation
- `sleep` — Triggers sleepy eyes

The FireClaw proxy should update this file when events occur. The display service polls it and reacts automatically.

## Troubleshooting

### OLED not detected

1. Check wiring connections
2. Verify I2C is enabled: `ls /dev/i2c-*`
3. Scan I2C bus: `i2cdetect -y 1`
4. Check for address 0x3C (shows as "3c")

### Display shows "Waiting for data..."

The status file doesn't exist or is unreadable. Create it:
```bash
sudo mkdir -p /home/admin/fireclaw/data
echo '{"fetches_today":0,"threats_today":0,"status":"idle"}' | sudo tee /home/admin/fireclaw/data/display-status.json
```

### Service won't start

Check logs:
```bash
sudo journalctl -u fireclaw-oled -n 50
```

Common issues:
- I2C not enabled
- OLED not connected (service exits cleanly)
- Permission issues with status file
- Missing Python dependencies

### No animations

- Check that the service is running: `systemctl status fireclaw-oled`
- Verify status file is being updated
- Check file permissions on `/home/admin/fireclaw/data/`

## Architecture

### Design Notes

- **Frame rate:** 20 FPS for smooth animations
- **Graphics:** 1-bit monochrome (pure black and white)
- **Library:** luma.oled (standard Pi OLED library)
- **Drawing:** PIL/Pillow for shapes and text
- **Auto-detection:** Gracefully exits if no OLED found (prevents systemd restart loops)

### Eye Animation

- Randomized blink intervals (3-5 seconds)
- Subtle eye movement for liveliness
- Expression changes: normal, angry, alert, sleeping
- Smooth transitions at 20 FPS

### Fire Effect

Random pixel scatter + triangular flame shapes for cartoon fire effect around angry eyes.

## License

AGPLv3 — See LICENSE file for details.

---

**Made with 🔥 for FireClaw**
