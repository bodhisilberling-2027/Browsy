import "dotenv/config";
import express from "express";
import cors from "cors";
import { saveSession, loadSession, listSessions, deleteSession } from "./sessions.js";
import { replay, generatePlaywrightScript } from "./playwrightRunner.js";
import { scrape } from "./scraper.js";
import { tryApiFastPath, tryNetworkCapture } from "./apiMode.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = Number(process.env.PORT || 3100);

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "Browsy Server",
    version: "1.0.0",
    uptime: process.uptime(),
    endpoints: ["/api/sessions", "/api/replay/:name", "/api/scrape", "/api/sessions/:name/script"]
  });
});

// Save a recorded session
app.post("/api/sessions", async (req, res) => {
  const { name, events, scrapeRequested, domSnapshot } = req.body || {};
  if (!name || !events) {
    return res.status(400).json({ ok: false, message: "missing name/events" });
  }
  
  try {
    await saveSession({ name, events, scrapeRequested, domSnapshot });
    console.log(`Saved session "${name}" with ${events.length} events`);
    res.json({ ok: true, message: `Session "${name}" saved successfully` });
  } catch (error: any) {
    console.error("Save session error:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
});

// List all sessions
app.get("/api/sessions", async (req, res) => {
  try {
    const sessions = await listSessions();
    res.json({ ok: true, sessions });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Get session details
app.get("/api/sessions/:name", async (req, res) => {
  const name = req.params.name;
  try {
    const session = await loadSession(name);
    if (!session) {
      return res.status(404).json({ ok: false, message: "session not found" });
    }
    res.json({ ok: true, session });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Delete a session
app.delete("/api/sessions/:name", async (req, res) => {
  const name = req.params.name;
  try {
    const deleted = await deleteSession(name);
    if (!deleted) {
      return res.status(404).json({ ok: false, message: "session not found" });
    }
    res.json({ ok: true, message: `Session "${name}" deleted` });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Replay a session
app.post("/api/replay/:name", async (req, res) => {
  const name = req.params.name;
  const s = await loadSession(name);
  if (!s) {
    return res.status(404).json({ ok: false, message: "session not found" });
  }

  try {
    // Phase 4 fast-path: check if we can optimize with API calls
    const lastUrl = [...s.events].reverse().find(e => e.url)?.url;
    if (lastUrl) {
      const fast = await tryApiFastPath(lastUrl);
      if (fast.hit) {
        console.log(`Using API fast-path for ${lastUrl}`);
        return res.json({ 
          ok: true, 
          message: "API fast-path used", 
          data: fast.data,
          fastPath: true 
        });
      }
    }

    // Regular Playwright replay
    console.log(`Starting replay of session "${name}"`);
    const result = await replay(s);
    
    if (result.ok) {
      res.json({ 
        ok: true, 
        message: "Replay completed successfully", 
        scraped: result.scraped || null 
      });
    } else {
      res.status(500).json({ 
        ok: false, 
        message: result.error || "Replay failed" 
      });
    }
  } catch (e: any) {
    console.error("Replay error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Generate Playwright script for a session
app.get("/api/sessions/:name/script", async (req, res) => {
  const name = req.params.name;
  try {
    const session = await loadSession(name);
    if (!session) {
      return res.status(404).json({ ok: false, message: "session not found" });
    }
    
    const script = await generatePlaywrightScript(session);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.spec.ts"`);
    res.send(script);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Scrape a URL
app.get("/api/scrape", async (req, res) => {
  const url = String(req.query.url || "");
  if (!url) {
    return res.status(400).json({ ok: false, message: "url parameter required" });
  }
  
  try {
    console.log(`Scraping URL: ${url}`);
    const data = await scrape(url);
    res.json({ ok: true, data });
  } catch (e: any) {
    console.error("Scrape error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// Analyze session for API optimization opportunities
app.post("/api/sessions/:name/analyze", async (req, res) => {
  const name = req.params.name;
  try {
    const session = await loadSession(name);
    if (!session) {
      return res.status(404).json({ ok: false, message: "session not found" });
    }
    
    const analysis = await tryNetworkCapture(session.events);
    res.json({ ok: true, analysis });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Browsy server listening on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`   GET  /                     - Health check`);
  console.log(`   POST /api/sessions         - Save session`);
  console.log(`   GET  /api/sessions         - List sessions`);
  console.log(`   POST /api/replay/:name     - Replay session`);
  console.log(`   GET  /api/scrape?url=...   - Scrape URL`);
  console.log(`   GET  /api/sessions/:name/script - Export Playwright script`);
});
