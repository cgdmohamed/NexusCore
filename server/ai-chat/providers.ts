// Thin adapters for the two model APIs. No SDK: a single fetch each, mapped to one neutral message format.

export interface ToolCall { id: string; name: string; args: Record<string, unknown> }
export type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls?: ToolCall[] }
  | { role: "tool"; results: { id: string; name: string; content: string; isError?: boolean }[] };

export interface ModelTool { name: string; description: string; inputSchema: Record<string, unknown> }
export interface Completion { text: string; toolCalls: ToolCall[] }
export interface Provider {
  complete(input: { system: string; messages: ChatMessage[]; tools: ModelTool[] }): Promise<Completion>;
}
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type ProviderKind = "anthropic" | "openai";
export const DEFAULT_MODELS: Record<ProviderKind, string> = { anthropic: "claude-sonnet-5-5", openai: "gpt-4o" };
export const MAX_OUTPUT_TOKENS = 3000;
const TIMEOUT_MS = 60_000;

// What the person sees when the provider refuses; never includes the key
export class ProviderError extends Error {
  constructor(message: string, public status = 502, public upstream?: number, public detail?: string) { super(message); }
}

function friendly(status: number, body: string): ProviderError {
  let detail = "";
  try { const j = JSON.parse(body); detail = j?.error?.message ?? j?.message ?? ""; } catch { /* not JSON */ }
  if (status === 401 || status === 403) return new ProviderError("The AI provider rejected the API key. Check it in Settings.", 502);
  if (status === 429) return new ProviderError("The AI provider is busy or the quota is used up. Try again shortly.", 503, 429);
  if (status === 400 && /model/i.test(detail) && !/reasoning_effort|\/v1\/responses/i.test(detail)) return new ProviderError(`The AI provider does not accept this model name (${detail.slice(0, 120)}).`, 502, 400, detail);
  return new ProviderError(`The AI provider returned an error (${status}).${detail ? " " + detail.slice(0, 160) : ""}`, 502, status, detail);
}

// A provider that is briefly busy or restarting deserves one more try before the person sees an error
const TRANSIENT = new Set([429, 500, 502, 503, 504, 529]);
export const RETRY_DELAY_MS = { value: process.env.VITEST ? 1 : 800 };

async function post(fetchImpl: FetchLike, url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  try {
    return await postOnce(fetchImpl, url, headers, body);
  } catch (error) {
    const transient = error instanceof ProviderError && (TRANSIENT.has(error.upstream ?? 0));
    if (!transient) throw error;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS.value));
    return postOnce(fetchImpl, url, headers, body);
  }
}

async function postOnce(fetchImpl: FetchLike, url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const text = await res.text();
    if (!res.ok) throw friendly(res.status, text);
    try { return JSON.parse(text); } catch { throw new ProviderError("The AI provider sent an unreadable reply."); }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if ((error as any)?.name === "AbortError") throw new ProviderError("The AI provider took too long to answer.", 504);
    throw new ProviderError("Could not reach the AI provider.", 502);
  } finally {
    clearTimeout(timer);
  }
}

export const anthropicBody = (model: string, system: string, messages: ChatMessage[], tools: ModelTool[]) => ({
  model, max_tokens: MAX_OUTPUT_TOKENS, system,
  ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })) } : {}),
  messages: messages.map((m) => {
    if (m.role === "user") return { role: "user", content: m.text };
    if (m.role === "assistant") {
      const content: unknown[] = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const c of m.toolCalls ?? []) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.args });
      return { role: "assistant", content };
    }
    return { role: "user", content: m.results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })) };
  }),
});

export function parseAnthropic(json: any): Completion {
  const blocks: any[] = Array.isArray(json?.content) ? json.content : [];
  return {
    text: blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim(),
    toolCalls: blocks.filter((b) => b.type === "tool_use").map((b) => ({ id: String(b.id), name: String(b.name), args: (b.input ?? {}) as Record<string, unknown> })),
  };
}

export const openaiBody = (model: string, system: string, messages: ChatMessage[], tools: ModelTool[]) => ({
  model, max_completion_tokens: MAX_OUTPUT_TOKENS,
  ...(tools.length ? { tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })) } : {}),
  messages: [
    { role: "system", content: system },
    ...messages.flatMap((m): unknown[] => {
      if (m.role === "user") return [{ role: "user", content: m.text }];
      if (m.role === "assistant") {
        return [{
          role: "assistant", content: m.text || null,
          ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}),
        }];
      }
      return m.results.map((r) => ({ role: "tool", tool_call_id: r.id, content: r.content }));
    }),
  ],
});

export function parseOpenAI(json: any): Completion {
  const msg = json?.choices?.[0]?.message ?? {};
  const calls: any[] = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
  return {
    text: typeof msg.content === "string" ? msg.content.trim() : "",
    toolCalls: calls.map((c) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* the model sent broken JSON; the tool will report the missing fields */ }
      return { id: String(c.id), name: String(c.function?.name), args };
    }),
  };
}

// The Responses API: what OpenAI asks for with its newer "reasoning" models when tools are used. Stateless on purpose (store: false, no
// provider-side ids), because the conversation is kept here and sending a call without its hidden reasoning item would be refused.
export const openaiResponsesBody = (model: string, system: string, messages: ChatMessage[], tools: ModelTool[]) => ({
  model, instructions: system, max_output_tokens: MAX_OUTPUT_TOKENS, store: false,
  ...(tools.length ? { tools: tools.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.inputSchema })) } : {}),
  input: messages.flatMap((m): unknown[] => {
    if (m.role === "user") return [{ role: "user", content: m.text }];
    if (m.role === "assistant") {
      return [
        ...(m.text ? [{ role: "assistant", content: m.text }] : []),
        ...(m.toolCalls ?? []).map((c) => ({ type: "function_call", call_id: c.id, name: c.name, arguments: JSON.stringify(c.args) })),
      ];
    }
    return m.results.map((r) => ({ type: "function_call_output", call_id: r.id, output: r.content }));
  }),
});

export function parseOpenAIResponses(json: any): Completion {
  const items: any[] = Array.isArray(json?.output) ? json.output : [];
  const text = items
    .filter((i) => i?.type === "message")
    .flatMap((i) => (Array.isArray(i.content) ? i.content : []))
    .filter((c: any) => c?.type === "output_text" && typeof c.text === "string")
    .map((c: any) => c.text)
    .join("\n")
    .trim();
  const toolCalls = items.filter((i) => i?.type === "function_call").map((i) => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(i.arguments || "{}"); } catch { /* the model sent broken JSON; the tool will report the missing fields */ }
    return { id: String(i.call_id ?? i.id), name: String(i.name), args };
  });
  return { text, toolCalls };
}

// Models that take tools only through the Responses API (or with reasoning switched off). Remembered once the provider has said so.
const needsResponses = new Set<string>();
const startsOnResponses = (model: string) => /^(gpt-5|o\d)/i.test(model);
const wantsResponses = (err: unknown) => err instanceof ProviderError && err.upstream === 400 && /reasoning_effort|\/v1\/responses/i.test(err.detail ?? "");
const missingEndpoint = (err: unknown) => err instanceof ProviderError && (err.upstream === 404 || err.upstream === 405);
export const resetOpenAIRouting = () => needsResponses.clear();

let fetchOverride: FetchLike | null = null;
export const setProviderFetch = (f: FetchLike | null) => { fetchOverride = f; };

export function createProvider(kind: ProviderKind, apiKey: string, model: string): Provider {
  const fetchImpl: FetchLike = (url, init) => (fetchOverride ?? (fetch as unknown as FetchLike))(url, init);
  // The SDKs' usual variables, so a company gateway or proxy can sit in front of the provider
  const base = (env: string | undefined, fallback: string) => (env || fallback).replace(/\/+$/, "");
  if (kind === "openai") {
    const root = base(process.env.OPENAI_BASE_URL, "https://api.openai.com/v1");
    const auth = { authorization: `Bearer ${apiKey}` };
    const viaChat = async (input: { system: string; messages: ChatMessage[]; tools: ModelTool[] }, noReasoning = false) =>
      parseOpenAI(await post(fetchImpl, `${root}/chat/completions`, auth, { ...openaiBody(model, input.system, input.messages, input.tools), ...(noReasoning ? { reasoning_effort: "none" } : {}) }));
    const viaResponses = async (input: { system: string; messages: ChatMessage[]; tools: ModelTool[] }) =>
      parseOpenAIResponses(await post(fetchImpl, `${root}/responses`, auth, openaiResponsesBody(model, input.system, input.messages, input.tools)));
    return {
      async complete(input) {
        if (needsResponses.has(model) || startsOnResponses(model)) {
          try { return await viaResponses(input); }
          catch (error) {
            // A gateway without the Responses endpoint: the provider's own suggestion is chat completions with reasoning off
            if (!missingEndpoint(error)) throw error;
            return viaChat(input, true);
          }
        }
        try { return await viaChat(input); }
        catch (error) {
          if (!wantsResponses(error)) throw error;
          needsResponses.add(model);
          try { return await viaResponses(input); }
          catch (second) { if (!missingEndpoint(second)) throw second; return viaChat(input, true); }
        }
      },
    };
  }
  return { async complete({ system, messages, tools }) { return parseAnthropic(await post(fetchImpl, `${base(process.env.ANTHROPIC_BASE_URL, "https://api.anthropic.com")}/v1/messages`, { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, anthropicBody(model, system, messages, tools))); } };
}
