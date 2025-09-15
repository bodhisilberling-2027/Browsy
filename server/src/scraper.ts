import { chromium } from "playwright";

export async function scrape(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    const result = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
        .map(h => h.innerText.trim())
        .filter(text => text.length > 0)
        .slice(0,100);
        
      const links = Array.from(document.querySelectorAll("a[href]"))
        .map(a => ({
          text: a.innerText.trim().slice(0,200), 
          href: a.href
        }))
        .filter(link => link.text.length > 0)
        .slice(0,200);
        
      const inputs = Array.from(document.querySelectorAll("input,select,textarea"))
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          type: (el as HTMLInputElement).type || null,
          name: el.getAttribute('name') || null,
          id: el.id || null,
          placeholder: (el as HTMLInputElement).placeholder || null,
          value: (el as HTMLInputElement).value || null
        }))
        .slice(0,200);
        
      const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button']"))
        .map(btn => ({
          text: btn.innerText?.trim() || (btn as HTMLInputElement).value || '',
          type: (btn as HTMLInputElement).type || 'button',
          id: btn.id || null,
          className: btn.className || null
        }))
        .filter(btn => btn.text.length > 0)
        .slice(0,50);
        
      // Get main content text, excluding navigation and footer
      const mainContent = document.querySelector('main, article, .content, #content') || document.body;
      const textContent = mainContent.innerText.slice(0, 10000);
      
      return { 
        url: location.href, 
        title: document.title, 
        headings, 
        links, 
        inputs,
        buttons,
        textContent,
        timestamp: Date.now()
      };
    });
    
    return result;
  } finally {
    await browser.close();
  }
}
