// Ready-to-paste connection settings for the MCP endpoint, one per client

export type SnippetKind = "claudeCode" | "claudeDesktop" | "anthropicApi" | "openai";

export function snippet(kind: SnippetKind, url: string, token: string): string {
  switch (kind) {
    case "claudeCode":
      return `claude mcp add --transport http nexus ${url} --header "Authorization: Bearer ${token}"`;
    case "claudeDesktop":
      return JSON.stringify({
        mcpServers: {
          nexus: {
            command: "npx",
            args: ["-y", "mcp-remote", url, "--header", "Authorization: Bearer ${NEXUS_TOKEN}"],
            env: { NEXUS_TOKEN: token },
          },
        },
      }, null, 2);
    case "anthropicApi":
      return JSON.stringify({ mcp_servers: [{ type: "url", url, name: "nexus", authorization_token: token }] }, null, 2);
    case "openai":
      return JSON.stringify({ tools: [{ type: "mcp", server_label: "nexus", server_url: url, authorization: token, require_approval: "never" }] }, null, 2);
  }
}
