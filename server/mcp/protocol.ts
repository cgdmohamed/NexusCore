// A small, stateless implementation of the MCP "Streamable HTTP" transport: JSON-RPC 2.0 over POST.
// No sessions and no server-initiated messages are needed for tools, so every request stands alone.

export const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export const ERR = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, internal: -32603 } as const;

export interface ToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface McpHandlers {
  serverInfo: { name: string; version: string };
  instructions?: string;
  tools: ToolDefinition[];
  // Every tool the server has, whether or not this caller may use it, so a refused call gets a clear message
  knownToolNames?: string[];
  callTool: (name: string, args: unknown) => Promise<ToolResult>;
}

// Use the client's version when we speak it, otherwise our newest
export function negotiateVersion(requested: unknown): string {
  return typeof requested === "string" && (SUPPORTED_VERSIONS as readonly string[]).includes(requested) ? requested : SUPPORTED_VERSIONS[0];
}

const isRequest = (m: any): m is JsonRpcRequest => m && typeof m === "object" && m.jsonrpc === "2.0" && typeof m.method === "string";
const fail = (id: JsonRpcResponse["id"], code: number, message: string, data?: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message, data } });

// Handles one message. Returns undefined for notifications, which take no reply.
export async function handleMessage(message: unknown, h: McpHandlers): Promise<JsonRpcResponse | undefined> {
  if (!isRequest(message)) return fail(null, ERR.invalidRequest, "Invalid JSON-RPC request");
  const hasId = message.id !== undefined && message.id !== null;
  const id = hasId ? (message.id as string | number) : null;

  // Anything without an id is a notification (for example notifications/initialized)
  if (!hasId) return undefined;

  try {
    switch (message.method) {
      case "initialize":
        return {
          jsonrpc: "2.0", id,
          result: {
            protocolVersion: negotiateVersion(message.params?.protocolVersion),
            capabilities: { tools: { listChanged: false } },
            serverInfo: h.serverInfo,
            ...(h.instructions ? { instructions: h.instructions } : {}),
          },
        };
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: h.tools } };
      case "tools/call": {
        const name = message.params?.name;
        const known = h.knownToolNames ?? h.tools.map((t) => t.name);
        if (typeof name !== "string" || !known.includes(name)) {
          return fail(id, ERR.invalidParams, `Unknown tool: ${String(name)}`);
        }
        return { jsonrpc: "2.0", id, result: await h.callTool(name, message.params?.arguments ?? {}) };
      }
      default:
        return fail(id, ERR.methodNotFound, `Method not found: ${message.method}`);
    }
  } catch (error) {
    return fail(id, ERR.internal, error instanceof Error ? error.message : "Internal error");
  }
}

// A body may be one message or a batch. Returns the response body, or null when nothing is to be sent (202).
export async function handleBody(body: unknown, h: McpHandlers): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    if (body.length === 0) return fail(null, ERR.invalidRequest, "Empty batch");
    const replies = (await Promise.all(body.map((m) => handleMessage(m, h)))).filter((r): r is JsonRpcResponse => r !== undefined);
    return replies.length ? replies : null;
  }
  return (await handleMessage(body, h)) ?? null;
}
