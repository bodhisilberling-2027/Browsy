(() => {
  let recording = false;
  let scrape = false;
  let events = [];

  const serializePath = (el) => {
    if (!el) return null;
    // Prefer stable attributes, then CSS path fallback:
    const id = el.id ? `#${el.id}` : "";
    const name = el.getAttribute?.("name");
    if (id) return id;
    if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
    
    // nth-child chain up to 4 levels (good enough for MVP)
    const parts = [];
    let node = el;
    for (let i = 0; i < 4 && node && node.nodeType === 1; i++) {
      const parent = node.parentElement;
      if (!parent) break;
      const idx = Array.from(parent.children).indexOf(node) + 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${idx})`);
      node = parent;
    }
    return parts.length ? parts.join(" > ") : el.tagName.toLowerCase();
  };

  const push = (type, data={}) => {
    events.push({
      t: Date.now(),
      url: location.href,
      type,
      ...data
    });
  };

  const onClick = (e) => {
    if (!recording) return;
    push("click", {
      selector: serializePath(e.target),
      button: e.button,
      x: e.clientX,
      y: e.clientY
    });
  };

  const onInput = (e) => {
    if (!recording) return;
    const el = e.target;
    if (!el) return;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) {
      push("input", {
        selector: serializePath(el),
        value: el.value ?? el.textContent ?? ""
      });
    }
  };

  const onScroll = () => {
    if (!recording) return;
    push("scroll", { x: window.scrollX, y: window.scrollY });
  };

  const onKeyDown = (e) => {
    if (!recording) return;
    // Record special keys like Enter, Tab, etc.
    if (e.key === "Enter" || e.key === "Tab" || e.key === "Escape") {
      push("keydown", {
        key: e.key,
        selector: serializePath(e.target)
      });
    }
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const { action, payload } = msg || {};
    
    try {
      if (action === "RECORDER_START") {
        events = [];
        recording = true;
        scrape = !!payload?.scrape;
        
        // Add initial page load event
        push("navigate", { url: location.href });
        
        window.addEventListener("click", onClick, true);
        window.addEventListener("input", onInput, true);
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("keydown", onKeyDown, true);
        
        console.log("Browsy: Recording started");
        sendResponse({ ok: true });
      }
      else if (action === "RECORDER_STOP") {
        recording = false;
        window.removeEventListener("click", onClick, true);
        window.removeEventListener("input", onInput, true);
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("keydown", onKeyDown, true);
        
        console.log("Browsy: Recording stopped, captured", events.length, "events");
        sendResponse({ ok: true });
      }
      else if (action === "RECORDER_EXPORT") {
        const exportPayload = { events, scrapeRequested: scrape, domSnapshot: null };
        if (scrape) {
          try {
            exportPayload.domSnapshot = window.__BROWSY_SCRAPE__ ? window.__BROWSY_SCRAPE__() : document.documentElement.innerText.slice(0, 200000);
          } catch (e) {
            console.warn("Browsy: Scrape failed:", e);
          }
        }
        console.log("Browsy: Exporting", events.length, "events");
        sendResponse(exportPayload);
      }
      else {
        sendResponse({ ok: false, error: "Unknown action: " + action });
      }
    } catch (error) {
      console.error("Browsy recorder error:", error);
      sendResponse({ ok: false, error: error.message });
    }
    
    return true; // Keep message channel open for async response
  });
})();
