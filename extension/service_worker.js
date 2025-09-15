// Background script to maintain recording state
let recordingState = {
  isRecording: false,
  tabId: null,
  sessionName: '',
  scrapeMode: false
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Browsy extension installed');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request || {};
  
  if (action === "GET_RECORDING_STATE") {
    sendResponse(recordingState);
    return true;
  }
  
  if (action === "SET_RECORDING_STATE") {
    recordingState = { ...recordingState, ...payload };
    
    // Update badge to show recording status
    if (recordingState.isRecording) {
      chrome.action.setBadgeText({ text: "REC" });
      chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
    
    sendResponse({ ok: true });
    return true;
  }
  
  // Forward other messages to content script if needed
  return false;
});
