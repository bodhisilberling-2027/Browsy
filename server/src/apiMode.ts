// Phase 4 hook – minimal API fast-path implementation
export async function tryApiFastPath(url: string) {
  try {
    const u = new URL(url);
    
    // Check if URL looks like a JSON API endpoint
    if (u.pathname.endsWith(".json") || 
        u.searchParams.get("format") === "json" ||
        u.pathname.includes("/api/") ||
        u.hostname.includes("api.")) {
      
      const headers: Record<string, string> = { 
        "Accept": "application/json",
        "User-Agent": "Browsy/1.0"
      };
      
      const res = await fetch(url, { 
        headers,
        method: "GET"
      });
      
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const data = await res.json();
          return { 
            hit: true, 
            data,
            status: res.status,
            contentType 
          };
        }
      }
    }
    
    // Check for common REST API patterns
    const apiPatterns = [
      /\/api\/v?\d+\//,
      /\/rest\//,
      /\/graphql/,
      /\.json$/
    ];
    
    if (apiPatterns.some(pattern => pattern.test(u.pathname))) {
      try {
        const res = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          }
        });
        
        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            return { hit: true, data, status: res.status };
          } catch {
            return { hit: true, data: text, status: res.status, isText: true };
          }
        }
      } catch (e) {
        console.warn("API fast-path failed:", e);
      }
    }
    
  } catch (e) {
    console.warn("Fast-path URL parsing failed:", e);
  }
  
  return { hit: false };
}

export async function tryNetworkCapture(events: any[]): Promise<{apis: any[], canOptimize: boolean}> {
  // Analyze recorded events to see if they could be replaced with direct API calls
  const apis: any[] = [];
  let canOptimize = false;
  
  // Look for patterns that suggest API usage
  for (const event of events) {
    if (event.url) {
      const fastPath = await tryApiFastPath(event.url);
      if (fastPath.hit) {
        apis.push({
          url: event.url,
          method: "GET", // Default, could be enhanced to detect POST/PUT
          response: fastPath.data
        });
        canOptimize = true;
      }
    }
  }
  
  return { apis, canOptimize };
}
