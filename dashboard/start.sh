#!/bin/bash
# FireClaw Dashboard Quick Start

set -e

echo "🔥 FireClaw Dashboard"
echo "===================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

# Check if config exists
if [ ! -f "config.yaml" ]; then
  echo "⚠️  Warning: config.yaml not found"
  echo "   Using default configuration"
  echo ""
fi

# Check for SMTP password
if [ -z "$SMTP_PASSWORD" ]; then
  echo "⚠️  Warning: SMTP_PASSWORD not set"
  echo "   OTP codes will be logged to console instead of emailed"
  echo ""
  echo "   To enable email OTP:"
  echo "   export SMTP_PASSWORD='your-gmail-app-password'"
  echo ""
fi

echo "🚀 Starting dashboard..."
echo "   Access at: http://localhost:8420"
echo ""

node server.mjs
