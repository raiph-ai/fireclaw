#!/bin/bash
# FireClaw OLED Display Installation Script

set -e

echo "🔥 FireClaw OLED Display Setup"
echo "================================"

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ] || ! grep -q "Raspberry Pi" /proc/device-tree/model; then
    echo "⚠️  Warning: This doesn't appear to be a Raspberry Pi"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update package list
echo "📦 Updating package list..."
sudo apt-get update

# Install system dependencies
echo "📦 Installing system dependencies..."
sudo apt-get install -y \
    python3-pip \
    python3-dev \
    python3-pil \
    libopenjp2-7 \
    libtiff6 \
    i2c-tools \
    fonts-dejavu-core

# Enable I2C if not already enabled
if ! grep -q "^dtparam=i2c_arm=on" /boot/config.txt; then
    echo "🔧 Enabling I2C..."
    sudo raspi-config nonint do_i2c 0
    echo "⚠️  I2C enabled - you may need to reboot for changes to take effect"
else
    echo "✓ I2C already enabled"
fi

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip3 install -r requirements.txt --break-system-packages || pip3 install -r requirements.txt

# Test OLED detection
echo ""
echo "🔍 Scanning for OLED display..."
if i2cdetect -y 1 | grep -q "3c"; then
    echo "✓ OLED detected at address 0x3C"
else
    echo "⚠️  No OLED detected at 0x3C"
    echo "   Check your wiring:"
    echo "   - SDA → GPIO 2 (Pin 3)"
    echo "   - SCL → GPIO 3 (Pin 5)"
    echo "   - VCC → 3.3V (Pin 1)"
    echo "   - GND → GND (Pin 6)"
    read -p "Continue with installation anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create data directory
echo "📁 Creating data directory..."
sudo mkdir -p /home/admin/fireclaw/data
sudo chown admin:admin /home/admin/fireclaw/data

# Install systemd service
echo "🔧 Installing systemd service..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
sudo cp fireclaw-oled.service /etc/systemd/system/

# Update service file with correct path
sudo sed -i "s|/path/to|$SCRIPT_DIR|g" /etc/systemd/system/fireclaw-oled.service

# Reload systemd
sudo systemctl daemon-reload

# Enable service
echo "✓ Enabling fireclaw-oled service..."
sudo systemctl enable fireclaw-oled.service

# Start service
echo "🚀 Starting fireclaw-oled service..."
sudo systemctl start fireclaw-oled.service

# Check status
echo ""
echo "📊 Service status:"
sudo systemctl status fireclaw-oled.service --no-pager -l

echo ""
echo "✅ Installation complete!"
echo ""
echo "Commands:"
echo "  sudo systemctl status fireclaw-oled   # Check status"
echo "  sudo systemctl restart fireclaw-oled  # Restart service"
echo "  sudo systemctl stop fireclaw-oled     # Stop service"
echo "  sudo journalctl -u fireclaw-oled -f   # View logs"
echo ""
