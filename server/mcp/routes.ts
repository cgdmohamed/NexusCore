import type { Express } from "express";
import { handleBody } from "./protocol";
import { authenticateBearer, withinRate } from "./tokens";
import { createToolkit, INSTRUCTIONS } from "./tools";

// POST /mcp: the Model Context Protocol endpoint for Claude, OpenAI and other MCP clients.
// It authenticates with a bearer token only (no cookies, so no CSRF), and is mounted ahead of the session middleware.
export function registerMcpRoutes(app: Express) {
  app.post("/mcp", async (req: any, res) => {
    try {
      const auth = await authenticateBearer(req.headers.authorization);
      if (!auth) {
        res.set("WWW-Authenticate", 'Bearer realm="nexus-mcp"');
        return res.status(401).json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing, invalid or revoked access token" } });
      }
      if (!withinRate(auth.tokenId)) {
        res.set("Retry-After", "30");
        return res.status(429).json({ jsonrpc: "2.0", id: null, error: { code: -32002, message: "Too many requests; slow down" } });
      }

      req.user = auth.user;
      const toolkit = createToolkit(req);
      const reply = await handleBody(req.body, {
        serverInfo: { name: "nexuscore", version: "1.0.0" },
        instructions: INSTRUCTIONS,
        tools: toolkit.tools,
        knownToolNames: toolkit.knownToolNames,
        callTool: toolkit.callTool,
      });
      if (reply === null) return res.status(202).end();
      res.json(reply);
    } catch (error) {
      console.error("MCP request failed:", error);
      res.status(500).json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error" } });
    }
  });

  // This server does not open event streams or keep sessions
  const notSupported = (_req: any, res: any) => res.status(405).set("Allow", "POST").json({ message: "Use POST" });
  app.get("/mcp", notSupported);
  app.delete("/mcp", notSupported);
}
