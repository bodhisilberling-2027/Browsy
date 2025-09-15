// Simple, overridable scraper (Phase 2). You can make this smarter per-site.
window.__BROWSY_SCRAPE__ = function scrape() {
  // Default: structured summary of links + headings + visible inputs
  const headings = Array.from(document.querySelectorAll("h1,h2,h3")).map(h=>h.innerText.trim()).slice(0,100);
  const links = Array.from(document.querySelectorAll("a[href]")).map(a=>({text:a.innerText.trim().slice(0,200), href:a.href})).slice(0,200);
  const inputs = Array.from(document.querySelectorAll("input,select,textarea")).map(el=>({
    tag: el.tagName.toLowerCase(),
    type: el.type || null,
    name: el.name || null,
    id: el.id || null,
    placeholder: el.placeholder || null
  })).slice(0,200);
  
  // Also capture visible text content
  const textContent = document.body.innerText.slice(0, 10000);
  
  return JSON.stringify({ 
    url: location.href, 
    title: document.title, 
    headings, 
    links, 
    inputs,
    textContent
  });
};
