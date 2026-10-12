import { describe, it, expect } from "vitest";
import { handleBody, negotiateVersion, type McpHandlers } from "../server/mcp/protocol";
import { bearerFrom, generateToken, hashToken, resetRateLimits, withinRate } from "../server/mcp/tokens";

const handlers: McpHandlers = {
  serverInfo: { name: "t", version: "1" },
  instructions: "hi",
  tools: [{ name: "echo", description: "e", inputSchema: { type: "object" } }],
  knownToolNames: ["echo", "hidden"],
  callTool: async (name, args) => ({ content: [{ type: "text", text: `${name}:${JSON.stringify(args)}` }] }),
};

describe("MCP JSON-RPC", () => {
  it("negotiates the protocol version", () => {
    expect(negotiateVersion("2025-03-26")).toBe("2025-03-26");
    expect(negotiateVersion("1999-01-01")).toBe("2025-06-18");
    expect(negotiateVersion(undefined)).toBe("2025-06-18");
  });

  it("initializes and lists tools", async () => {
    const init: any = await handleBody({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } }, handlers);
    expect(init.result.protocolVersion).toBe("2024-11-05");
    expect(init.result.capabilities.tools).toBeTruthy();
    expect(init.result.instructions).toBe("hi");
    const list: any = await handleBody({ jsonrpc: "2.0", id: 2, method: "tools/list" }, handlers);
    expect(list.result.tools.map((t: any) => t.name)).toEqual(["echo"]);
  });

  it("calls a tool, and gives notifications no reply", async () => {
    const call: any = await handleBody({ jsonrpc: "2.0", id: "a", method: "tools/call", params: { name: "echo", arguments: { x: 1 } } }, handlers);
    expect(call.id).toBe("a");
    expect(call.result.content[0].text).toBe('echo:{"x":1}');
    expect(await handleBody({ jsonrpc: "2.0", method: "notifications/initialized" }, handlers)).toBeNull();
  });

  it("handles batches and drops the notifications inside them", async () => {
    const out: any = await handleBody([
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "ping" },
    ], handlers);
    expect(out.map((r: any) => r.id)).toEqual([1, 2]);
  });

  it("reports errors the standard way", async () => {
    const unknownMethod: any = await handleBody({ jsonrpc: "2.0", id: 1, method: "nope" }, handlers);
    expect(unknownMethod.error.code).toBe(-32601);
    const unknownTool: any = await handleBody({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "ghost" } }, handlers);
    expect(unknownTool.error.code).toBe(-32602);
    const invalid: any = await handleBody({ not: "jsonrpc" }, handlers);
    expect(invalid.error.code).toBe(-32600);
    expect(((await handleBody([], handlers)) as any).error.code).toBe(-32600);
    // a tool the caller may not use is still known, so the call reaches the permission check
    const known: any = await handleBody({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "hidden" } }, handlers);
    expect(known.result).toBeTruthy();
  });
});

describe("tokens", () => {
  it("generates a prefixed random token and stores only its hash", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.token).toMatch(/^nxc_[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(a.token.startsWith(a.prefix)).toBe(true);
  });

  it("reads only well-formed bearer headers", () => {
    expect(bearerFrom("Bearer nxc_abc")).toBe("nxc_abc");
    expect(bearerFrom("bearer nxc_abc")).toBe("nxc_abc");
    expect(bearerFrom("Bearer other_abc")).toBeNull();
    expect(bearerFrom("Basic nxc_abc")).toBeNull();
    expect(bearerFrom(undefined)).toBeNull();
  });

  it("limits requests per token per minute", () => {
    resetRateLimits();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(withinRate("k", t0 + i, 3)).toBe(true);
    expect(withinRate("k", t0 + 10, 3)).toBe(false);
    expect(withinRate("other", t0 + 10, 3)).toBe(true);
    expect(withinRate("k", t0 + 61_000, 3)).toBe(true);
  });
});
