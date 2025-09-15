#!/bin/bash

# Browsy Demo Test Script
set -e

echo "Running Browsy Demo Test..."

# Check if server is running
if ! curl -f http://localhost:3100/ > /dev/null 2>&1; then
    echo "ERROR: Browsy server is not running. Please start it first:"
    echo "   cd server && npm run dev"
    exit 1
fi

echo "Server is running"

# Test API endpoints
echo "Testing API endpoints..."

# Test health check
echo "Testing health check..."
curl -s http://localhost:3100/ | jq .

# Test scraping
echo "Testing scraper..."
curl -s "http://localhost:3100/api/scrape?url=https://example.com" | jq .

# Test sessions list
echo "Testing sessions list..."
curl -s http://localhost:3100/api/sessions | jq .

# Test API fast-path
echo "Testing API fast-path..."
curl -s "http://localhost:3100/api/sessions/test/analyze" | jq . || echo "No test session found (expected)"

echo "All API tests passed!"
echo ""
echo "Next steps:"
echo "1. Record a session using the Chrome extension"
echo "2. Test replay functionality"
echo "3. Try the MCP agent: cd agent && npm run dev"
