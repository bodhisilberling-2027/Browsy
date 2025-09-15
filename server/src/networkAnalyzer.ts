// Phase 4: Advanced network analysis and API optimization
export interface NetworkRequest {
  url: string;
  method: string;
  headers: Record<string, any>;
  body?: any;
  timestamp: number;
  duration: number;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;
}

export interface ApiPattern {
  baseUrl: string;
  endpoints: string[];
  authHeaders?: Record<string, string>;
  commonParams?: Record<string, any>;
  rateLimit?: number;
}

export class NetworkAnalyzer {
  
  static analyzeRequests(requests: NetworkRequest[]): {
    apiCalls: NetworkRequest[];
    patterns: ApiPattern[];
    optimizable: boolean;
  } {
    const apiCalls = requests.filter(req => this.isApiCall(req));
    const patterns = this.extractPatterns(apiCalls);
    const optimizable = apiCalls.length > 0;
    
    return { apiCalls, patterns, optimizable };
  }
  
  static isApiCall(request: NetworkRequest): boolean {
    const url = new URL(request.url);
    
    // Check for API indicators
    const apiIndicators = [
      url.pathname.includes('/api/'),
      url.pathname.includes('/rest/'),
      url.pathname.includes('/graphql'),
      url.pathname.endsWith('.json'),
      url.hostname.startsWith('api.'),
      request.responseHeaders?.['content-type']?.includes('application/json'),
      request.method !== 'GET' && request.responseBody
    ];
    
    return apiIndicators.some(indicator => indicator);
  }
  
  static extractPatterns(apiCalls: NetworkRequest[]): ApiPattern[] {
    const patterns: Map<string, ApiPattern> = new Map();
    
    for (const call of apiCalls) {
      const url = new URL(call.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      
      if (!patterns.has(baseUrl)) {
        patterns.set(baseUrl, {
          baseUrl,
          endpoints: [],
          authHeaders: {},
          commonParams: {}
        });
      }
      
      const pattern = patterns.get(baseUrl)!;
      
      // Add endpoint
      if (!pattern.endpoints.includes(url.pathname)) {
        pattern.endpoints.push(url.pathname);
      }
      
      // Extract auth headers
      if (call.headers) {
        for (const [key, value] of Object.entries(call.headers)) {
          if (key.toLowerCase().includes('auth') || 
              key.toLowerCase().includes('token') ||
              key.toLowerCase() === 'x-api-key') {
            pattern.authHeaders![key] = value;
          }
        }
      }
    }
    
    return Array.from(patterns.values());
  }
  
  static async optimizeSession(requests: NetworkRequest[]): Promise<{
    canOptimize: boolean;
    optimizedCalls: Array<{
      original: NetworkRequest;
      optimized: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: any;
      };
    }>;
  }> {
    const analysis = this.analyzeRequests(requests);
    
    if (!analysis.optimizable) {
      return { canOptimize: false, optimizedCalls: [] };
    }
    
    const optimizedCalls = analysis.apiCalls.map(call => ({
      original: call,
      optimized: {
        url: call.url,
        method: call.method,
        headers: this.cleanHeaders(call.headers),
        body: call.body
      }
    }));
    
    return { canOptimize: true, optimizedCalls };
  }
  
  static cleanHeaders(headers: Record<string, any>): Record<string, string> {
    const cleaned: Record<string, string> = {};
    
    // Keep only essential headers
    const essentialHeaders = [
      'authorization',
      'x-api-key',
      'content-type',
      'accept',
      'user-agent'
    ];
    
    for (const [key, value] of Object.entries(headers)) {
      if (essentialHeaders.some(h => key.toLowerCase().includes(h))) {
        cleaned[key] = String(value);
      }
    }
    
    return cleaned;
  }
  
  static generateApiScript(patterns: ApiPattern[]): string {
    let script = `// Generated API optimization script
// This script can replace browser automation for pure API calls

`;
    
    for (const pattern of patterns) {
      script += `
// API Pattern: ${pattern.baseUrl}
class ${this.toCamelCase(pattern.baseUrl.replace(/[^a-zA-Z0-9]/g, ''))}Api {
  constructor() {
    this.baseUrl = '${pattern.baseUrl}';
    this.headers = ${JSON.stringify(pattern.authHeaders, null, 4)};
  }
  
  async request(endpoint, options = {}) {
    const url = this.baseUrl + endpoint;
    const config = {
      method: 'GET',
      headers: { ...this.headers, ...options.headers },
      ...options
    };
    
    const response = await fetch(url, config);
    return response.json();
  }
`;
      
      for (const endpoint of pattern.endpoints) {
        const methodName = this.endpointToMethodName(endpoint);
        script += `
  async ${methodName}(params = {}) {
    return this.request('${endpoint}', params);
  }`;
      }
      
      script += `
}
`;
    }
    
    return script;
  }
  
  private static toCamelCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  
  private static endpointToMethodName(endpoint: string): string {
    return endpoint
      .split('/')
      .filter(part => part && !part.match(/^\d+$/))
      .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
      .replace(/[^a-zA-Z0-9]/g, '');
  }
}
