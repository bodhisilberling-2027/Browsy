import { chromium, Page, Browser } from "playwright";
import { Session, RecordedEvent } from "./sessions.js";

async function clickBySelector(page: Page, selector: string) {
  // Try fast: exact CSS; fallback to text if selector looks like text
  try { 
    await page.waitForSelector(selector, { timeout: 5000 }); 
    await page.click(selector); 
    return; 
  } catch {}
  
  // If selector looks like text content, try text-based selection
  if (selector && selector.length < 80 && !selector.includes(":nth-child") && !selector.includes("#") && !selector.includes("[")) {
    try { 
      await page.getByText(selector, { exact: true }).click(); 
      return; 
    } catch {}
    
    // Try partial text match
    try {
      await page.getByText(selector).first().click();
      return;
    } catch {}
  }
  
  throw new Error(`Could not click selector: ${selector}`);
}

async function fillBySelector(page: Page, selector: string, value: string) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.fill(selector, value);
  } catch {
    // Try by placeholder or label
    try {
      await page.getByPlaceholder(value).fill(value);
    } catch {
      throw new Error(`Could not fill selector: ${selector}`);
    }
  }
}

export async function replay(session: Session): Promise<{ok: boolean, scraped?: string, error?: string}> {
  let browser: Browser | null = null;
  
  try {
    browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    let currentUrl = "";

    console.log(`Replaying session "${session.name}" with ${session.events.length} events`);

    for (const [index, ev] of session.events.entries()) {
      console.log(`Event ${index + 1}/${session.events.length}: ${ev.type}`);
      
      // Navigate if URL changed
      if (ev.type === "navigate" || (ev.url && ev.url !== currentUrl)) {
        console.log(`Navigating to: ${ev.url}`);
        await page.goto(ev.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        currentUrl = ev.url;
        await page.waitForTimeout(1000); // Allow page to settle
      }
      
      // Handle different event types
      if (ev.type === "scroll" && typeof ev.x === "number" && typeof ev.y === "number") {
        await page.evaluate(([x,y]) => window.scrollTo(x,y), [ev.x, ev.y]);
        await page.waitForTimeout(500);
      } 
      else if (ev.type === "input" && ev.selector && ev.value !== undefined) {
        await fillBySelector(page, ev.selector, ev.value);
        await page.waitForTimeout(500);
      } 
      else if (ev.type === "click" && ev.selector) {
        await clickBySelector(page, ev.selector);
        await page.waitForTimeout(1000); // Allow for navigation/loading
      }
      else if (ev.type === "keydown" && ev.key) {
        await page.keyboard.press(ev.key);
        await page.waitForTimeout(500);
      }
    }

    // Optional: scrape after replay (Phase 2 convenience)
    let scraped: string | null = null;
    if (session.scrapeRequested) {
      scraped = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h1,h2,h3")).map(h=>h.innerText.trim()).slice(0,50);
        const links = Array.from(document.querySelectorAll("a[href]")).map(a=>({text:a.innerText.trim().slice(0,100), href:a.href})).slice(0,100);
        return JSON.stringify({
          url: location.href,
          title: document.title,
          headings,
          links,
          textContent: document.body.innerText.slice(0, 5000)
        });
      });
    }

    // Keep browser open for a moment to see result
    await page.waitForTimeout(3000);
    
    return { ok: true, scraped: scraped || undefined };
  } catch (error: any) {
    console.error("Replay error:", error);
    return { ok: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function generatePlaywrightScript(session: Session): Promise<string> {
  const events = session.events;
  let script = `// Generated Playwright script for session: ${session.name}
import { test, expect } from '@playwright/test';

test('${session.name}', async ({ page }) => {
`;

  let currentUrl = "";
  
  for (const ev of events) {
    if (ev.type === "navigate" || (ev.url && ev.url !== currentUrl)) {
      script += `  await page.goto('${ev.url}');\n`;
      currentUrl = ev.url;
    }
    
    if (ev.type === "click" && ev.selector) {
      script += `  await page.click('${ev.selector}');\n`;
    } else if (ev.type === "input" && ev.selector && ev.value !== undefined) {
      script += `  await page.fill('${ev.selector}', '${ev.value.replace(/'/g, "\\'")}');\n`;
    } else if (ev.type === "scroll" && typeof ev.x === "number" && typeof ev.y === "number") {
      script += `  await page.evaluate(() => window.scrollTo(${ev.x}, ${ev.y}));\n`;
    } else if (ev.type === "keydown" && ev.key) {
      script += `  await page.keyboard.press('${ev.key}');\n`;
    }
  }
  
  script += `});
`;
  
  return script;
}
