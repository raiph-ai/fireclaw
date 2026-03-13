#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# FireClaw — Raspberry Pi 4 Setup Script
# Run this on a fresh Raspberry Pi OS (64-bit) installation
# ═══════════════════════════════════════════════════════════════

set -e

echo "🔥 FireClaw — Pi Setup Starting..."
echo "═══════════════════════════════════════════════════"

# ── System Updates ────────────────────────────────────────────
echo ""
echo "📦 Step 1/6: Updating system packages..."
sudo apt update && sudo apt upgrade -y

# ── Install Node.js (LTS) ────────────────────────────────────
echo ""
echo "📦 Step 2/6: Installing Node.js..."
if command -v node &> /dev/null; then
    echo "Node.js already installed: $(node -v)"
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "Node.js installed: $(node -v)"
fi

echo "npm version: $(npm -v)"

# ── Create FireClaw directory ─────────────────────────────────
echo ""
echo "📁 Step 3/6: Setting up FireClaw directory..."
FIRECLAW_DIR="$HOME/fireclaw"
mkdir -p "$FIRECLAW_DIR"
mkdir -p "$FIRECLAW_DIR/data"
mkdir -p "$FIRECLAW_DIR/logs"

# ── Install FireClaw components ───────────────────────────────
echo ""
echo "📦 Step 4/6: Installing FireClaw components..."

# Copy files (assumes they've been transferred via scp/rsync)
if [ -d "$FIRECLAW_DIR/proxy" ]; then
    echo "Proxy directory exists, installing dependencies..."
    cd "$FIRECLAW_DIR/proxy"
    npm install --production 2>/dev/null || echo "No package.json yet — will install after file transfer"
fi

if [ -d "$FIRECLAW_DIR/dashboard" ]; then
    echo "Dashboard directory exists, installing dependencies..."
    cd "$FIRECLAW_DIR/dashboard"
    npm install --production 2>/dev/null || echo "No package.json yet — will install after file transfer"
fi

if [ -d "$FIRECLAW_DIR/threat-feed" ]; then
    echo "Threat feed directory exists, installing dependencies..."
    cd "$FIRECLAW_DIR/threat-feed"
    npm install --production 2>/dev/null || echo "No package.json yet — will install after file transfer"
fi

# ── Create systemd services ──────────────────────────────────
echo ""
echo "⚙️  Step 5/6: Creating systemd services..."

# FireClaw Proxy Service
sudo tee /etc/systemd/system/fireclaw-proxy.service > /dev/null << 'EOF'
[Unit]
Description=FireClaw Security Proxy
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/fireclaw/proxy
ExecStart=/usr/bin/node fireclaw.mjs
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# FireClaw Dashboard Service
sudo tee /etc/systemd/system/fireclaw-dashboard.service > /dev/null << 'EOF'
[Unit]
Description=FireClaw Dashboard
After=network.target fireclaw-proxy.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/fireclaw/dashboard
ExecStart=/usr/bin/node server.mjs
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8420

[Install]
WantedBy=multi-user.target
EOF

# FireClaw Threat Feed Service (optional — only if running locally)
sudo tee /etc/systemd/system/fireclaw-threatfeed.service > /dev/null << 'EOF'
[Unit]
Description=FireClaw Threat Feed API
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/fireclaw/threat-feed
ExecStart=/usr/bin/node server.mjs
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8421

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

# ── Network & Firewall ────────────────────────────────────────
echo ""
echo "🔒 Step 6/6: Configuring network security..."

# Install ufw if not present
if ! command -v ufw &> /dev/null; then
    sudo apt install -y ufw
fi

# Allow SSH
sudo ufw allow ssh

# Allow FireClaw dashboard (LAN only)
# Adjust 192.168.0.0/16 to match your network
sudo ufw allow from 192.168.0.0/16 to any port 8420 comment "FireClaw Dashboard"
sudo ufw allow from 192.168.0.0/16 to any port 8421 comment "FireClaw Threat Feed"

# Enable firewall (won't interrupt current SSH)
echo "y" | sudo ufw enable 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════"
echo "🔥 FireClaw Pi setup complete!"
echo ""
echo "Next steps:"
echo "  1. Transfer FireClaw files to ~/fireclaw/"
echo "     scp -r skills/honey-bot/* pi@<pi-ip>:~/fireclaw/"
echo ""
echo "  2. Install npm dependencies in each directory:"
echo "     cd ~/fireclaw && npm install"
echo "     cd ~/fireclaw/dashboard && npm install"
echo "     cd ~/fireclaw/threat-feed && npm install"
echo ""
echo "  3. Edit configs:"
echo "     nano ~/fireclaw/config.yaml"
echo "     nano ~/fireclaw/dashboard/config.yaml"
echo ""
echo "  4. Start services:"
echo "     sudo systemctl enable --now fireclaw-proxy"
echo "     sudo systemctl enable --now fireclaw-dashboard"
echo ""
echo "  5. Access dashboard:"
echo "     http://$(hostname -I | awk '{print $1}'):8420"
echo ""
echo "  6. Connect main OpenClaw:"
echo "     Set remote.url in client/config.yaml to:"
echo "     http://$(hostname -I | awk '{print $1}'):8420"
echo "═══════════════════════════════════════════════════"
