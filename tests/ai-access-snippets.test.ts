import { describe, it, expect } from "vitest";
import { snippet } from "../client/src/lib/ai-access-snippets";

const url = "https://nexus.example.com/mcp";
const token = "nxc_abc123";

describe("MCP connection snippets", () => {
  it("builds the Claude Code command", () => {
    expect(snippet("claudeCode", url, token)).toBe(`claude mcp add --transport http nexus ${url} --header "Authorization: Bearer ${token}"`);
  });

  it("produces valid JSON that carries the url and token for the other clients", () => {
    const desktop = JSON.parse(snippet("claudeDesktop", url, token));
    expect(desktop.mcpServers.nexus.args).toContain(url);
    expect(desktop.mcpServers.nexus.env.NEXUS_TOKEN).toBe(token);
    expect(JSON.parse(snippet("anthropicApi", url, token)).mcp_servers[0]).toMatchObject({ url, authorization_token: token });
    expect(JSON.parse(snippet("openai", url, token)).tools[0]).toMatchObject({ type: "mcp", server_url: url, authorization: token });
  });
});
