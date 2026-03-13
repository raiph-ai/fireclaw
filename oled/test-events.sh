#!/bin/bash
# Test script to trigger different OLED animations
# Usage: ./test-events.sh [event_type]
# Events: injection, sanitized, alert, blocked, sleep

STATUS_FILE="/home/admin/fireclaw/data/display-status.json"

if [ ! -f "$STATUS_FILE" ]; then
    echo "Creating initial status file..."
    sudo mkdir -p /home/admin/fireclaw/data
    sudo cp test-status.json "$STATUS_FILE"
    sudo chown admin:admin "$STATUS_FILE"
fi

EVENT_TYPE="${1:-injection}"
TIMESTAMP=$(date -Iseconds)

# Clear events
if [ "$EVENT_TYPE" = "clear" ]; then
    echo "Clearing events, returning to normal rotation..."
    sudo tee "$STATUS_FILE" > /dev/null <<EOF
{
  "fetches_today": 42,
  "threats_today": 7,
  "last_event": null,
  "last_event_type": null,
  "last_event_domain": null,
  "status": "idle"
}
EOF
    echo "✓ Events cleared"
    exit 0
fi

echo "🔥 Triggering $EVENT_TYPE event..."

case $EVENT_TYPE in
    injection)
        DOMAIN="evil-hacker.example.com"
        ;;
    sanitized)
        DOMAIN="cleaned.example.com"
        ;;
    alert)
        DOMAIN="suspicious.example.com"
        ;;
    blocked)
        DOMAIN="malware.example.com"
        ;;
    sleep)
        DOMAIN=""
        ;;
    *)
        echo "Unknown event type: $EVENT_TYPE"
        echo "Valid types: injection, sanitized, alert, blocked, sleep"
        exit 1
        ;;
esac

# Update status file
sudo tee "$STATUS_FILE" > /dev/null <<EOF
{
  "fetches_today": 42,
  "threats_today": 7,
  "last_event": "$TIMESTAMP",
  "last_event_type": "$EVENT_TYPE",
  "last_event_domain": "$DOMAIN",
  "status": "active"
}
EOF

echo "✓ Event triggered! Watch the OLED display."
echo ""
echo "To clear events and return to normal rotation:"
echo "  ./test-events.sh clear"
