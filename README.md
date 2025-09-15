# Browsy - AI-Powered Browser Action Recorder

Browsy is a Chrome extension that records browser actions and creates a Model Context Protocol (MCP) server for AI agents to replay those actions.

## Project Structure

```
browsy/
├── extension/                     # Chrome extension (MV3)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── content.js
│   ├── recorder.js
│   ├── scraper.js
│   └── service_worker.js
├── server/                        # Local backend + MCP server
│   ├── package.json
│   ├── src/
│   │   ├── index.ts              # Express + WebSocket + session store
│   │   ├── sessions.ts           # JSON/SQLite session storage
│   │   ├── playwrightRunner.ts   # Generate + replay Playwright scripts
│   │   ├── mcp.ts                # MCP server with recorded tools
│   │   ├── scraper.ts            # Headless scrape util
│   │   └── apiMode.ts            # Phase 4 "Network/API" fast path
│   ├── playwright.config.ts
│   └── .env.example
├── agent/
│   ├── package.json
│   └── cli.ts                    # Simple chat -> MCP tools
├── docker/
│   ├── Dockerfile.server
│   └── docker-compose.yml
└── README.md
```

## Features

### Browser Action Recording
The Chrome extension captures all user interactions including clicks, scrolls, form inputs, keyboard shortcuts, and page navigation. Each action is recorded with precise timing, element selectors, and contextual information to ensure accurate replay.

### Intelligent Element Selection
Uses a multi-layered selector strategy that combines CSS selectors, XPath, text content, and visual positioning. When websites update their HTML structure, the system automatically falls back to alternative selection methods to maintain automation reliability.

### Model Context Protocol Integration
Recorded sessions are automatically exposed as callable tools through the Model Context Protocol (MCP). AI agents can discover and execute these tools without requiring custom integration code. Each session becomes a reusable automation component.

### Playwright-Based Replay Engine
Sessions are converted to Playwright scripts for reliable cross-browser automation. The replay engine handles dynamic content loading, manages timeouts, and provides detailed execution logs for debugging failed automations.

### Network Request Optimization
Analyzes recorded sessions to identify direct API calls that can bypass full browser automation. When possible, the system extracts API endpoints and parameters to enable faster execution through direct HTTP requests.

### Session Management
Provides a complete CRUD interface for managing recorded sessions. Sessions can be listed, inspected, modified, exported as standalone Playwright scripts, or deleted. Supports both JSON file storage and database backends.

### CLI Agent Interface
Includes a command-line agent that connects to the MCP server for interactive session management. Supports session replay, URL scraping, API testing, and detailed session inspection with verbose logging options.

### Production Deployment
Docker containerization with nginx reverse proxy for production deployments. Includes health checks, logging configuration, and environment variable management for scalable automation infrastructure.

## Quick Start

### 1. Install Server Dependencies
```bash
cd server
cp .env.example .env
npm install
npx playwright install
```

### 2. Start the Backend
```bash
# Terminal 1: Main server
npm run dev

# Terminal 2: MCP server
npm run mcp
```

### 3. Load Chrome Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

### 4. Record a Session
1. Navigate to any website
2. Click the Browsy extension icon
3. Click "Start Recording"
4. Perform actions (clicks, scrolls, inputs)
5. Click "Stop" then "Save Session"

### 5. Replay Session
- Click "Replay" in the extension popup, or
- Use the CLI agent: `cd agent && npm run dev`

## Usage Examples

### Recording Actions
1. Go to Amazon.com
2. Start recording
3. Search for "laptop"
4. Click on a product
5. Save as "amazon-search"

### Using MCP Tools
```bash
cd agent
npm run dev

> replay amazon-search
> scrape https://news.ycombinator.com
> api https://api.github.com/repos/microsoft/typescript
```

## Environment Variables

Create `server/.env`:
```
PORT=3100
MCP_PORT=3325
```

## Docker Deployment

```bash
docker-compose up -d
```

## Security Notes

- Runs locally by default
- Avoid recording sensitive information
- Use ignore lists for password fields in production

## Anti-Bot Detection

For sites with Cloudflare/bot detection, consider using Camoufox:
```bash
npm install camoufox
```

## License

MIT
