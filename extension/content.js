// Enhanced content script for network monitoring (Phase 4)
(() => {
  let networkRequests = [];
  let isMonitoring = false;

  // Override fetch to capture network requests
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    if (isMonitoring) {
      const startTime = Date.now();
      const [resource, config] = args;
      const url = typeof resource === 'string' ? resource : resource.url;
      const method = config?.method || 'GET';
      
      try {
        const response = await originalFetch.apply(this, args);
        const endTime = Date.now();
        
        // Capture request/response metadata
        const requestData = {
          url,
          method,
          headers: config?.headers || {},
          body: config?.body,
          timestamp: startTime,
          duration: endTime - startTime,
          status: response.status,
          statusText: response.statusText,
          responseHeaders: Object.fromEntries(response.headers.entries())
        };
        
        // Try to capture response body for JSON APIs
        if (response.headers.get('content-type')?.includes('application/json')) {
          try {
            const clonedResponse = response.clone();
            requestData.responseBody = await clonedResponse.json();
          } catch (e) {
            // Ignore if can't parse JSON
          }
        }
        
        networkRequests.push(requestData);
        return response;
      } catch (error) {
        const endTime = Date.now();
        networkRequests.push({
          url,
          method,
          headers: config?.headers || {},
          body: config?.body,
          timestamp: startTime,
          duration: endTime - startTime,
          error: error.message
        });
        throw error;
      }
    }
    
    return originalFetch.apply(this, args);
  };

  // Override XMLHttpRequest
  const originalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new originalXHR();
    
    if (isMonitoring) {
      let requestData = {
        timestamp: Date.now(),
        method: 'GET',
        url: '',
        headers: {},
        body: null
      };
      
      const originalOpen = xhr.open;
      xhr.open = function(method, url, ...args) {
        requestData.method = method;
        requestData.url = url;
        return originalOpen.apply(this, [method, url, ...args]);
      };
      
      const originalSend = xhr.send;
      xhr.send = function(body) {
        requestData.body = body;
        requestData.timestamp = Date.now();
        return originalSend.apply(this, [body]);
      };
      
      xhr.addEventListener('loadend', () => {
        requestData.status = xhr.status;
        requestData.statusText = xhr.statusText;
        requestData.duration = Date.now() - requestData.timestamp;
        
        try {
          if (xhr.responseText && xhr.getResponseHeader('content-type')?.includes('application/json')) {
            requestData.responseBody = JSON.parse(xhr.responseText);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
        
        networkRequests.push(requestData);
      });
    }
    
    return xhr;
  };

  // Listen for messages from popup/recorder
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const { action, payload } = msg || {};
    
    if (action === "NETWORK_START") {
      networkRequests = [];
      isMonitoring = true;
      sendResponse({ ok: true });
    }
    else if (action === "NETWORK_STOP") {
      isMonitoring = false;
      sendResponse({ ok: true });
    }
    else if (action === "NETWORK_EXPORT") {
      sendResponse({ requests: networkRequests });
    }
  });
})();
