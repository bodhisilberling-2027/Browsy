import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadSession, listSessions } from "./sessions.js";
import { replay } from "./playwrightRunner.js";
import { scrape } from "./scraper.js";
import { tryApiFastPath } from "./apiMode.js";

const MCP_PORT = Number(process.env.MCP_PORT || 3325);

class BrowsyMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "browsy-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error("[MCP Server Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const sessions = await listSessions();
      
      const tools = [
        {
          name: "replay_session",
          description: "Replay a recorded browser session by name. This will open a browser and perform all the recorded actions.",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the session to replay"
              }
            },
            required: ["name"]
          },
        },
        {
          name: "scrape_url",
          description: "Scrape a webpage and return structured data including headings, links, inputs, and text content.",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "URL to scrape"
              }
            },
            required: ["url"]
          },
        },
        {
          name: "query_api",
          description: "Try to fetch data from a URL using direct API calls (fast-path). Works best with JSON APIs.",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "API URL to query"
              }
            },
            required: ["url"]
          },
        },
        {
          name: "list_sessions",
          description: "List all available recorded browser sessions.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "get_session_info",
          description: "Get detailed information about a specific session including events and metadata.",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the session to inspect"
              }
            },
            required: ["name"]
          },
        }
      ];

      // Add dynamic tools for each recorded session
      for (const sessionName of sessions) {
        tools.push({
          name: `replay_${sessionName.replace(/[^a-zA-Z0-9_]/g, '_')}`,
          description: `Replay the specific session: ${sessionName}`,
          inputSchema: {
            type: "object",
            properties: {},
          },
        });
      }

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "replay_session": {
            const sessionName = args?.name as string;
            if (!sessionName) {
              throw new Error("Session name is required");
            }

            const session = await loadSession(sessionName);
            if (!session) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Session not found: ${sessionName}`,
                  },
                ],
              };
            }

            const result = await replay(session);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    ok: result.ok,
                    message: result.ok ? "Replay completed successfully" : result.error,
                    scraped: result.scraped || null,
                    sessionName
                  }, null, 2),
                },
              ],
            };
          }

          case "scrape_url": {
            const url = args?.url as string;
            if (!url) {
              throw new Error("URL is required");
            }

            const data = await scrape(url);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case "query_api": {
            const url = args?.url as string;
            if (!url) {
              throw new Error("URL is required");
            }

            const result = await tryApiFastPath(url);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "list_sessions": {
            const sessions = await listSessions();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    sessions,
                    count: sessions.length
                  }, null, 2),
                },
              ],
            };
          }

          case "get_session_info": {
            const sessionName = args?.name as string;
            if (!sessionName) {
              throw new Error("Session name is required");
            }

            const session = await loadSession(sessionName);
            if (!session) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Session not found: ${sessionName}`,
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    name: session.name,
                    eventCount: session.events.length,
                    scrapeRequested: session.scrapeRequested,
                    createdAt: session.createdAt,
                    events: session.events.map((e, i) => ({
                      index: i,
                      type: e.type,
                      url: e.url,
                      selector: e.selector,
                      timestamp: e.t
                    }))
                  }, null, 2),
                },
              ],
            };
          }

          default: {
            // Handle dynamic session replay tools
            if (name.startsWith("replay_")) {
              const sessionName = name.replace("replay_", "").replace(/_/g, " ");
              const session = await loadSession(sessionName);
              
              if (!session) {
                // Try with underscores converted back
                const altName = name.replace("replay_", "").replace(/_/g, "-");
                const altSession = await loadSession(altName);
                
                if (!altSession) {
                  return {
                    content: [
                      {
                        type: "text",
                        text: `Session not found: ${sessionName} (also tried: ${altName})`,
                      },
                    ],
                  };
                }
                
                const result = await replay(altSession);
                return {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        ok: result.ok,
                        message: result.ok ? "Replay completed successfully" : result.error,
                        scraped: result.scraped || null,
                        sessionName: altName
                      }, null, 2),
                    },
                  ],
                };
              }

              const result = await replay(session);
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      ok: result.ok,
                      message: result.ok ? "Replay completed successfully" : result.error,
                      scraped: result.scraped || null,
                      sessionName
                    }, null, 2),
                  },
                ],
              };
            }

            throw new Error(`Unknown tool: ${name}`);
          }
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("🔌 Browsy MCP server running on stdio");
    console.log("🛠️  Available tools: replay_session, scrape_url, query_api, list_sessions, get_session_info");
    console.log("📋 Dynamic tools will be created for each recorded session");
  }
}

async function main() {
  const server = new BrowsyMCPServer();
  await server.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  });
}
