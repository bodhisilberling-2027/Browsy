#!/bin/bash

# Browsy Setup Script
set -e

echo "Setting up Browsy..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERROR: Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "Node.js $(node -v) detected"

# Setup server
echo "Installing server dependencies..."
cd server
cp .env.example .env
npm install
echo "Installing Playwright browsers..."
npx playwright install chromium
cd ..

# Setup agent
echo "Installing agent dependencies..."
cd agent
npm install
cd ..

echo "Setup complete!"
echo ""
echo "Quick Start:"
echo "1. Load Chrome extension:"
echo "   - Open chrome://extensions/"
echo "   - Enable Developer mode"
echo "   - Click 'Load unpacked'"
echo "   - Select the 'extension' folder"
echo ""
echo "2. Start the backend:"
echo "   cd server && npm run dev"
echo ""
echo "3. Start MCP server (in another terminal):"
echo "   cd server && npm run mcp"
echo ""
echo "4. Use the agent (in another terminal):"
echo "   cd agent && npm run dev"
echo ""
echo "For Docker deployment:"
echo "   ./deploy.sh"
