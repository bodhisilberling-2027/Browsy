import "dotenv/config";
import readline from "readline-sync";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

class BrowsyAgent {
  private client: Client | null = null;
  private mcpProcess: any = null;

  async connect() {
    try {
      console.log("🔌 Connecting to existing MCP server...");
      
      // Create client without spawning - assume MCP server is already running
      this.client = new Client(
        {
          name: "browsy-agent",
          version: "0.1.0",
        },
        {
          capabilities: {},
        }
      );

      // For now, we'll connect to a running MCP server via stdio
      // User should run 'npm run mcp' in server directory first
      const transport = new StdioClientTransport();
      
      await this.client.connect(transport);
      console.log("✅ Connected to Browsy MCP server");
      return true;
    } catch (error) {
      console.error("❌ Failed to connect to MCP server:", error);
      console.log("💡 Please run 'cd server && npm run mcp' in another terminal first");
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
    }
    if (this.mcpProcess) {
      this.mcpProcess.kill();
    }
  }

  async listTools() {
    if (!this.client) throw new Error("Not connected");
    const response = await this.client.listTools();
    return response.tools;
  }

  async callTool(name: string, args: any = {}) {
    if (!this.client) throw new Error("Not connected");
    const response = await this.client.callTool({ name, arguments: args });
    return response;
  }

  parseCommand(input: string): { command: string; args: string[]; flags: Record<string, boolean> } {
    const parts = input.trim().split(/\s+/);
    const command = parts[0] || "";
    const args: string[] = [];
    const flags: Record<string, boolean> = {};

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith("--")) {
        flags[part.slice(2)] = true;
      } else if (part.startsWith("-")) {
        flags[part.slice(1)] = true;
      } else {
        args.push(part);
      }
    }

    return { command, args, flags };
  }

  formatResponse(response: any): string {
    if (response.content) {
      return response.content.map((c: any) => c.text).join("\n");
    }
    return JSON.stringify(response, null, 2);
  }

  showHelp() {
    console.log(`
🤖 Browsy Agent - AI-powered browser automation

Available commands:
  help                          - Show this help message
  list                         - List all recorded sessions
  sessions                     - Alias for 'list'
  
  replay <session-name>        - Replay a recorded session
  scrape <url>                 - Scrape a webpage for structured data
  api <url>                    - Try direct API call (fast-path)
  info <session-name>          - Get detailed session information
  
  tools                        - List all available MCP tools
  call <tool-name> [args...]   - Call any MCP tool directly
  
  exit, quit, q                - Exit the agent

Examples:
  replay amazon-search         - Replay the "amazon-search" session
  scrape https://news.ycombinator.com
  api https://api.github.com/repos/microsoft/typescript
  info my-session              - Show details about "my-session"
  call list_sessions           - Call the list_sessions tool directly

Flags:
  --json                       - Output raw JSON response
  --verbose, -v                - Show detailed output
`);
  }

  async run() {
    console.log("🚀 Starting Browsy Agent...");
    
    const connected = await this.connect();
    if (!connected) {
      console.log("💡 Make sure the MCP server is available. Try running 'npm run mcp' in the server directory.");
      return;
    }

    console.log("🎯 Browsy Agent ready! Type 'help' for commands or 'exit' to quit.");
    
    while (true) {
      try {
        const input = readline.question("\n🤖 > ");
        if (!input.trim()) continue;

        const { command, args, flags } = this.parseCommand(input);

        if (["exit", "quit", "q"].includes(command)) {
          console.log("👋 Goodbye!");
          break;
        }

        if (command === "help" || command === "h") {
          this.showHelp();
          continue;
        }

        if (command === "list" || command === "sessions") {
          const response = await this.callTool("list_sessions");
          const result = this.formatResponse(response);
          
          if (flags.json) {
            console.log(result);
          } else {
            try {
              const data = JSON.parse(result);
              if (data.sessions && data.sessions.length > 0) {
                console.log(`📋 Found ${data.count} recorded sessions:`);
                data.sessions.forEach((session: string, i: number) => {
                  console.log(`  ${i + 1}. ${session}`);
                });
              } else {
                console.log("📭 No sessions found. Record some actions using the Chrome extension first.");
              }
            } catch {
              console.log(result);
            }
          }
          continue;
        }

        if (command === "tools") {
          const tools = await this.listTools();
          console.log(`🛠️  Available MCP tools (${tools.length}):`);
          tools.forEach((tool: any, i: number) => {
            console.log(`  ${i + 1}. ${tool.name} - ${tool.description}`);
          });
          continue;
        }

        if (command === "replay" && args.length > 0) {
          const sessionName = args.join(" ");
          console.log(`🔄 Replaying session: ${sessionName}`);
          
          const response = await this.callTool("replay_session", { name: sessionName });
          const result = this.formatResponse(response);
          
          if (flags.json) {
            console.log(result);
          } else {
            try {
              const data = JSON.parse(result);
              if (data.ok) {
                console.log(`✅ ${data.message}`);
                if (data.scraped) {
                  console.log("📄 Scraped data available:");
                  console.log(data.scraped.slice(0, 500) + (data.scraped.length > 500 ? "..." : ""));
                }
              } else {
                console.log(`❌ ${data.message}`);
              }
            } catch {
              console.log(result);
            }
          }
          continue;
        }

        if (command === "scrape" && args.length > 0) {
          const url = args.join(" ");
          console.log(`🕷️  Scraping: ${url}`);
          
          const response = await this.callTool("scrape_url", { url });
          const result = this.formatResponse(response);
          
          if (flags.json) {
            console.log(result);
          } else {
            try {
              const data = JSON.parse(result);
              console.log(`📄 Scraped: ${data.title}`);
              console.log(`🔗 URL: ${data.url}`);
              if (data.headings && data.headings.length > 0) {
                console.log(`📝 Headings (${data.headings.length}):`);
                data.headings.slice(0, 5).forEach((h: string) => console.log(`  • ${h}`));
              }
              if (data.links && data.links.length > 0) {
                console.log(`🔗 Links (${data.links.length}):`);
                data.links.slice(0, 3).forEach((l: any) => console.log(`  • ${l.text} -> ${l.href}`));
              }
              if (flags.verbose || flags.v) {
                console.log("\n📋 Full data:");
                console.log(JSON.stringify(data, null, 2));
              }
            } catch {
              console.log(result);
            }
          }
          continue;
        }

        if (command === "api" && args.length > 0) {
          const url = args.join(" ");
          console.log(`⚡ Trying API fast-path: ${url}`);
          
          const response = await this.callTool("query_api", { url });
          const result = this.formatResponse(response);
          
          if (flags.json) {
            console.log(result);
          } else {
            try {
              const data = JSON.parse(result);
              if (data.hit) {
                console.log(`✅ API call successful (${data.status})`);
                console.log("📊 Data preview:");
                console.log(JSON.stringify(data.data, null, 2).slice(0, 1000));
              } else {
                console.log("❌ Not a direct API endpoint or call failed");
              }
            } catch {
              console.log(result);
            }
          }
          continue;
        }

        if (command === "info" && args.length > 0) {
          const sessionName = args.join(" ");
          const response = await this.callTool("get_session_info", { name: sessionName });
          const result = this.formatResponse(response);
          
          if (flags.json) {
            console.log(result);
          } else {
            try {
              const data = JSON.parse(result);
              console.log(`📋 Session: ${data.name}`);
              console.log(`🎬 Events: ${data.eventCount}`);
              console.log(`🕷️  Scrape mode: ${data.scrapeRequested ? "Yes" : "No"}`);
              console.log(`📅 Created: ${data.createdAt ? new Date(data.createdAt).toLocaleString() : "Unknown"}`);
              
              if (flags.verbose || flags.v) {
                console.log("\n🎯 Event details:");
                data.events.forEach((e: any) => {
                  console.log(`  ${e.index + 1}. ${e.type} ${e.selector ? `-> ${e.selector}` : ""} (${e.url})`);
                });
              }
            } catch {
              console.log(result);
            }
          }
          continue;
        }

        if (command === "call" && args.length > 0) {
          const toolName = args[0];
          const toolArgs = args.slice(1);
          
          // Parse tool arguments (simple key=value format)
          const parsedArgs: any = {};
          toolArgs.forEach(arg => {
            if (arg.includes("=")) {
              const [key, ...valueParts] = arg.split("=");
              parsedArgs[key] = valueParts.join("=");
            }
          });
          
          console.log(`🔧 Calling tool: ${toolName}`);
          const response = await this.callTool(toolName, parsedArgs);
          console.log(this.formatResponse(response));
          continue;
        }

        // If no command matched, show help
        console.log(`❓ Unknown command: ${command}`);
        console.log("💡 Type 'help' to see available commands");

      } catch (error: any) {
        console.error("❌ Error:", error.message);
        if (flags.verbose || flags.v) {
          console.error(error);
        }
      }
    }

    await this.disconnect();
  }
}

async function main() {
  const agent = new BrowsyAgent();
  
  process.on("SIGINT", async () => {
    console.log("\n👋 Shutting down...");
    await agent.disconnect();
    process.exit(0);
  });
  
  await agent.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Failed to start agent:", error);
    process.exit(1);
  });
}
