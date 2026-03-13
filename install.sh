#!/bin/bash
# FireClaw Installation Script

set -e

echo "🔥 Installing FireClaw..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the fireclaw directory."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ required (you have $(node -v))"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"

# Run tests
echo "🧪 Running test suite..."
npm test

if [ $? -ne 0 ]; then
    echo "⚠️  Tests failed, but installation completed"
    echo "   You may need to configure patterns or update test samples"
else
    echo "✅ All tests passed"
fi

# Display next steps
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 FireClaw installation complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Review config.yaml and customize as needed"
echo "  2. Add trusted domains to bypass_domains list"
echo "  3. Import fireclaw_fetch and fireclaw_search in your agent code"
echo "  4. Read SKILL.md for complete documentation"
echo ""
echo "Quick test:"
echo "  node examples/usage.mjs"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
