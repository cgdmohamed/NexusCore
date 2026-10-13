import { describe, expect, it } from "vitest";
import { anthropicBody, createProvider, openaiBody, parseAnthropic, parseOpenAI, setProviderFetch, ProviderError, type ChatMessage } from "../server/ai-chat/providers";
import { buildSystemPrompt, DECLINED, MAX_STEPS, resolvePending, sendMessage, toView, windowed, type ChatState, type Toolkit } from "../server/ai-chat/agent";

const tools = [{ name: "list_clients", description: "d", inputSchema: { type: "object" } }];
const history: ChatMessage[] = [
  { role: "user", text: "hi" },
  { role: "assistant", text: "looking", toolCalls: [{ id: "c1", name: "list_clients", args: { search: "a" } }] },
  { role: "tool", results: [{ id: "c1", name: "list_clients", content: "[]", isError: false }] },
];

describe("provider request shapes", () => {
  it("maps the conversation to Anthropic blocks", () => {
    const b: any = anthropicBody("m", "sys", history, tools);
    expect(b.system).toBe("sys");
    expect(b.tools[0]).toEqual({ name: "list_clients", description: "d", input_schema: { type: "object" } });
    expect(b.messages[1].content).toEqual([{ type: "text", text: "looking" }, { type: "tool_use", id: "c1", name: "list_clients", input: { search: "a" } }]);
    expect(b.messages[2]).toEqual({ role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "[]" }] });
  });

  it("maps the conversation to OpenAI messages", () => {
    const b: any = openaiBody("m", "sys", history, tools);
    expect(b.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(b.messages[2].tool_calls[0]).toEqual({ id: "c1", type: "function", function: { name: "list_clients", arguments: '{"search":"a"}' } });
    expect(b.messages[3]).toEqual({ role: "tool", tool_call_id: "c1", content: "[]" });
    expect(b.tools[0].function.parameters).toEqual({ type: "object" });
  });

  it("reads tool calls back from both providers", () => {
    expect(parseAnthropic({ content: [{ type: "text", text: "ok" }, { type: "tool_use", id: "t", name: "x", input: { a: 1 } }] })).toEqual({ text: "ok", toolCalls: [{ id: "t", name: "x", args: { a: 1 } }] });
    expect(parseOpenAI({ choices: [{ message: { content: null, tool_calls: [{ id: "t", function: { name: "x", arguments: '{"a":1}' } }] } }] })).toEqual({ text: "", toolCalls: [{ id: "t", name: "x", args: { a: 1 } }] });
    expect(parseOpenAI({ choices: [{ message: { content: "hi", tool_calls: [{ id: "t", function: { name: "x", arguments: "{broken" } }] } }] }).toolCalls[0].args).toEqual({});
  });

  it("turns provider failures into clear messages without the key", async () => {
    setProviderFetch(async () => ({ ok: false, status: 401, text: async () => '{"error":{"message":"bad key sk-secret"}}' }));
    const p = createProvider("anthropic", "sk-secret", "m");
    const err = await p.complete({ system: "", messages: [], tools: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).not.toContain("sk-secret");
    setProviderFetch(async () => ({ ok: false, status: 429, text: async () => "{}" }));
    expect((await p.complete({ system: "", messages: [], tools: [] }).catch((e) => e)).status).toBe(503);
    setProviderFetch(null);
  });

  it("sends the key in the right header", async () => {
    const seen: any[] = [];
    setProviderFetch(async (url, init) => { seen.push({ url, headers: init.headers }); return { ok: true, status: 200, text: async () => JSON.stringify({ content: [{ type: "text", text: "OK" }] }) }; });
    await createProvider("anthropic", "k1", "m").complete({ system: "s", messages: [{ role: "user", text: "x" }], tools: [] });
    expect(seen[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect(seen[0].headers["x-api-key"]).toBe("k1");
    setProviderFetch(null);
  });
});

// A scripted model and a recording toolkit
const script = (...replies: { text?: string; calls?: { id: string; name: string; args?: any }[] }[]) => {
  let n = 0;
  return { complete: async () => { const r = replies[Math.min(n++, replies.length - 1)]; return { text: r.text ?? "", toolCalls: (r.calls ?? []).map((c) => ({ id: c.id, name: c.name, args: c.args ?? {} })) }; }, get turns() { return n; } };
};
const toolkit = (log: string[]): Toolkit => ({
  tools: [
    { name: "list_clients", title: "List clients", description: "", inputSchema: {}, annotations: { readOnlyHint: true } },
    { name: "create_task", title: "Create task", description: "", inputSchema: {} },
  ],
  callTool: async (name) => { log.push(name); return { content: [{ type: "text", text: `result of ${name}` }] }; },
});
const fresh = (): ChatState => ({ messages: [], pending: null });
const system = buildSystemPrompt({ name: "Sara", language: "ar", today: "2026-10-12" });

describe("assistant loop", () => {
  it("runs reading tools at once and answers", async () => {
    const log: string[] = [];
    const state = fresh();
    await sendMessage(state, "who are my clients", { provider: script({ calls: [{ id: "1", name: "list_clients" }] }, { text: "You have none." }), toolkit: toolkit(log), system });
    expect(log).toEqual(["list_clients"]);
    expect(state.pending).toBeNull();
    expect(toView(state).items.map((i) => i.role)).toEqual(["user", "event", "assistant"]);
  });

  it("pauses before a change and runs nothing until confirmed", async () => {
    const log: string[] = [];
    const state = fresh();
    const provider = script({ calls: [{ id: "1", name: "list_clients" }, { id: "2", name: "create_task", args: { title: "x" } }] }, { text: "Created." });
    await sendMessage(state, "make a task", { provider, toolkit: toolkit(log), system });
    expect(log).toEqual(["list_clients"]); // the read ran, the write did not
    expect(state.pending?.calls.filter((c) => c.write).map((c) => c.name)).toEqual(["create_task"]);
    expect(toView(state).pending).toEqual([{ id: "2", name: "create_task", title: "Create task", args: { title: "x" } }]);
    await expect(sendMessage(state, "again", { provider, toolkit: toolkit(log), system })).rejects.toThrow();

    await resolvePending(state, true, { provider, toolkit: toolkit(log), system });
    expect(log).toEqual(["list_clients", "create_task"]);
    expect(state.pending).toBeNull();
    expect(state.messages.at(-1)).toMatchObject({ role: "assistant", text: "Created." });
  });

  it("tells the model when the person declines, and does not run the change", async () => {
    const log: string[] = [];
    const state = fresh();
    await sendMessage(state, "make a task", { provider: script({ calls: [{ id: "1", name: "create_task" }] }, { text: "Okay, cancelled." }), toolkit: toolkit(log), system });
    await resolvePending(state, false, { provider: script({ text: "Okay, cancelled." }), toolkit: toolkit(log), system });
    expect(log).toEqual([]);
    const toolMsg: any = state.messages.find((m) => m.role === "tool");
    expect(toolMsg.results[0].content).toBe(DECLINED);
  });

  it("treats an unknown tool as a plain error and stops runaway loops", async () => {
    const log: string[] = [];
    const state = fresh();
    await sendMessage(state, "go", { provider: script({ calls: [{ id: "1", name: "list_clients" }] }), toolkit: toolkit(log), system }); // never stops calling
    expect(log.length).toBe(MAX_STEPS);
    expect(state.messages.at(-1)).toMatchObject({ role: "assistant" });
  });

  it("keeps a window that starts at a person's message", () => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) msgs.push({ role: "user", text: `u${i}` }, { role: "assistant", text: `a${i}`, toolCalls: [{ id: `${i}`, name: "x", args: {} }] }, { role: "tool", results: [{ id: `${i}`, name: "x", content: "" }] });
    const w = windowed(msgs, 30);
    expect(w[0].role).toBe("user");
    expect(w.length).toBeLessThanOrEqual(30);
  });
});
