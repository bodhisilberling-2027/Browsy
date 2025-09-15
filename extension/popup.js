const $ = (id) => document.getElementById(id);
const setStatus = (t) => { $("status").textContent = t; };

// Get recording state from background script
async function getRecordingState() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "GET_RECORDING_STATE" }, resolve);
  });
}

// Update recording state in background script
async function setRecordingState(state) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "SET_RECORDING_STATE", payload: state }, resolve);
  });
}

// Initialize popup with current state
async function initializePopup() {
  const state = await getRecordingState();
  
  if (state.isRecording) {
    setStatus("Recording… Click, scroll, and type on the page");
    $("start").classList.add("recording");
    $("stop").classList.remove("stopped");
  } else {
    setStatus("Ready to record");
    $("start").classList.remove("recording");
    $("stop").classList.remove("stopped");
  }
  
  if (state.sessionName) {
    $("sessionName").value = state.sessionName;
  }
  
  $("scrapeMode").checked = state.scrapeMode;
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', initializePopup);

async function send(action, payload={}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if we can access the tab (some pages like chrome:// are restricted)
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
    throw new Error('Cannot record on browser internal pages. Please navigate to a regular website.');
  }
  
  try {
    return await chrome.tabs.sendMessage(tab.id, { action, payload });
  } catch (error) {
    // Content script not loaded, try to inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['recorder.js', 'scraper.js']
      });
      
      // Wait a moment for scripts to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return await chrome.tabs.sendMessage(tab.id, { action, payload });
    } catch (injectionError) {
      throw new Error('Could not inject scripts. Try refreshing the page and try again.');
    }
  }
}

$("start").onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setStatus("Connecting to page...");
    await send("RECORDER_START", { scrape: $("scrapeMode").checked });
    
    // Update background state
    await setRecordingState({
      isRecording: true,
      tabId: tab.id,
      sessionName: $("sessionName").value,
      scrapeMode: $("scrapeMode").checked
    });
    
    setStatus("Recording… Click, scroll, and type on the page");
    $("start").classList.add("recording");
    $("stop").classList.remove("stopped");
  } catch (e) {
    setStatus("Error: " + e.message);
    console.error("Browsy popup error:", e);
  }
};

$("stop").onclick = async () => {
  try {
    await send("RECORDER_STOP");
    
    // Update background state
    await setRecordingState({
      isRecording: false,
      tabId: null,
      sessionName: $("sessionName").value,
      scrapeMode: $("scrapeMode").checked
    });
    
    setStatus("Stopped. Enter session name and save.");
    $("start").classList.remove("recording");
    $("stop").classList.add("stopped");
  } catch (e) {
    setStatus("Error: " + e.message);
  }
};

$("save").onclick = async () => {
  const name = $("sessionName").value || `session-${Date.now()}`;
  try {
    const data = await send("RECORDER_EXPORT");
    const payload = { name, ...data };
    const response = await fetch("http://localhost:3100/api/sessions", {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      setStatus(`Saved as "${name}"`);
      // Update session name in background state
      await setRecordingState({
        sessionName: name,
        scrapeMode: $("scrapeMode").checked
      });
    } else {
      const errorText = await response.text();
      setStatus(`Save failed: ${response.status} - Check if server is running`);
      console.error("Save error:", errorText);
    }
  } catch (e) {
    setStatus("Save failed: " + e.message);
  }
};

$("replay").onclick = async () => {
  const name = $("sessionName").value;
  if (!name) { 
    setStatus("Enter session name first."); 
    return; 
  }
  try {
    setStatus("Replaying…");
    const res = await fetch(`http://localhost:3100/api/replay/${encodeURIComponent(name)}`, { 
      method: "POST" 
    });
    const result = await res.json();
    setStatus(result.ok ? `Replay finished: ${result.message}` : `Replay failed: ${result.message}`);
  } catch (e) {
    setStatus("Replay failed: " + e.message);
  }
};
