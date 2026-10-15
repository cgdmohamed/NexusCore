import { describe, expect, it } from "vitest";
import { anthropicBody, createProvider, openaiBody, openaiResponsesBody, parseAnthropic, parseOpenAI, parseOpenAIResponses, setProviderFetch, ProviderError, type ChatMessage } from "../server/ai-chat/providers";
import { buildSystemPrompt, relativeDates, DECLINED, MAX_STEPS, resolvePending, sendMessage, toView, windowed, type ChatState, type Toolkit } from "../server/ai-chat/agent";

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

  it("links a created record from its tool result", () => {
    const state: ChatState = {
      pending: null,
      messages: [{ role: "tool", results: [
        { id: "1", name: "create_invoice", content: JSON.stringify({ id: "abc-1", path: "/invoices/abc-1" }) },
        { id: "2", name: "list_clients", content: "[]" },
        { id: "3", name: "create_task", content: JSON.stringify({ path: "https://evil.example/x" }) },
        { id: "4", name: "create_invoice", content: "failed", isError: true },
      ] }],
    };
    const events: any[] = toView(state).items;
    expect(events.map((e) => e.link)).toEqual(["/invoices/abc-1", undefined, undefined, undefined]);
  });

  it("keeps a window that starts at a person's message", () => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) msgs.push({ role: "user", text: `u${i}` }, { role: "assistant", text: `a${i}`, toolCalls: [{ id: `${i}`, name: "x", args: {} }] }, { role: "tool", results: [{ id: `${i}`, name: "x", content: "" }] });
    const w = windowed(msgs, 30);
    expect(w[0].role).toBe("user");
    expect(w.length).toBeLessThanOrEqual(30);
  });
});

describe("what the assistant is told", () => {
  it("knows today's weekday and works out relative dates", () => {
    // 2026-10-14 is a Wednesday
    const text = relativeDates("2026-10-14");
    expect(text).toContain("tomorrow 2026-10-15");
    expect(text).toContain("next Sunday 2026-10-18");
    expect(text).toContain("next Thursday 2026-10-15");
    expect(text).toContain("next Monday 2026-10-19");
    expect(text).toContain("end of this month 2026-10-31");
    // the same weekday means a week ahead, not today
    expect(relativeDates("2026-10-18")).toContain("next Sunday 2026-10-25");
  });

  it("names the person, their id, their role and the tools they have, and states the accuracy rules", () => {
    const p = buildSystemPrompt({ name: "Sara", language: "ar", today: "2026-10-14", userId: "u-1", role: "Admin", tools: ["list_tasks", "create_task"] });
    expect(p).toContain("Wednesday 2026-10-14");
    expect(p).toContain("user id is u-1");
    expect(p).toContain("role: Admin");
    expect(p).toContain("list_tasks, create_task");
    expect(p).toContain("hasMore");
    expect(p).toContain("rose gold");
    expect(p).toContain("Modern Standard Arabic");
  });
});

describe("a busy provider", () => {
  const ok = { ok: true, status: 200, text: async () => JSON.stringify({ content: [{ type: "text", text: "hello" }] }) };
  const busy = (status: number) => ({ ok: false, status, text: async () => "{}" });

  it("is tried once more on a temporary error, and the person never sees the first failure", async () => {
    const providers = await import("../server/ai-chat/providers");
    providers.RETRY_DELAY_MS.value = 1;
    let calls = 0;
    providers.setProviderFetch(async () => (++calls === 1 ? busy(529) : ok));
    try {
      const out = await providers.createProvider("anthropic", "k", "m").complete({ system: "s", messages: [{ role: "user", text: "hi" }], tools: [] });
      expect(out.text).toBe("hello");
      expect(calls).toBe(2);
    } finally { providers.setProviderFetch(null); }
  });

  it("gives up after one retry, and does not retry a rejected key", async () => {
    const providers = await import("../server/ai-chat/providers");
    providers.RETRY_DELAY_MS.value = 1;
    let calls = 0;
    providers.setProviderFetch(async () => { calls++; return busy(503); });
    try {
      await expect(providers.createProvider("openai", "k", "m").complete({ system: "s", messages: [], tools: [] })).rejects.toThrow(/error \(503\)/);
      expect(calls).toBe(2);
      calls = 0;
      providers.setProviderFetch(async () => { calls++; return busy(401); });
      await expect(providers.createProvider("openai", "k", "m").complete({ system: "s", messages: [], tools: [] })).rejects.toThrow(/rejected the API key/);
      expect(calls).toBe(1);
    } finally { providers.setProviderFetch(null); }
  });
});

describe("OpenAI reasoning models and the Responses API", () => {
  const msgs: ChatMessage[] = [
    { role: "user", text: "ما المتأخر؟" },
    { role: "assistant", text: "سأبحث", toolCalls: [{ id: "call_1", name: "summary_invoices", args: { a: 1 } }] },
    { role: "tool", results: [{ id: "call_1", name: "summary_invoices", content: '{"overdue":2}', isError: false }] },
  ];
  const tools = [{ name: "summary_invoices", description: "d", inputSchema: { type: "object", properties: {} } }];

  it("builds a stateless Responses request with flat tools and no provider ids", () => {
    const b = openaiResponsesBody("gpt-5.6-terra", "sys", msgs, tools);
    expect(b).toMatchObject({ model: "gpt-5.6-terra", instructions: "sys", store: false, max_output_tokens: 3000 });
    expect(b.tools).toEqual([{ type: "function", name: "summary_invoices", description: "d", parameters: { type: "object", properties: {} } }]);
    expect(b.input).toEqual([
      { role: "user", content: "ما المتأخر؟" },
      { role: "assistant", content: "سأبحث" },
      { type: "function_call", call_id: "call_1", name: "summary_invoices", arguments: '{"a":1}' },
      { type: "function_call_output", call_id: "call_1", output: '{"overdue":2}' },
    ]);
    expect(JSON.stringify(b.input)).not.toContain('"id"');
  });

  it("reads text and tool calls out of a Responses reply and ignores the reasoning items", () => {
    const out = parseOpenAIResponses({ output: [
      { type: "reasoning", summary: [] },
      { type: "message", content: [{ type: "output_text", text: "لديك " }, { type: "output_text", text: "فاتورتان" }] },
      { type: "function_call", id: "fc_9", call_id: "call_9", name: "my_day", arguments: '{"x":2}' },
      { type: "function_call", call_id: "call_10", name: "list_tasks", arguments: "not json" },
    ] });
    expect(out.text).toBe("لديك \nفاتورتان");
    expect(out.toolCalls).toEqual([{ id: "call_9", name: "my_day", args: { x: 2 } }, { id: "call_10", name: "list_tasks", args: {} }]);
    expect(parseOpenAIResponses({})).toEqual({ text: "", toolCalls: [] });
  });

  const chatOk = { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: "chat" } }] }) };
  const respOk = { ok: true, status: 200, text: async () => JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: "resp" }] }] }) };
  const fail = (status: number, message: string) => ({ ok: false, status, text: async () => JSON.stringify({ error: { message } }) });
  const run = async (model: string, handler: (url: string, body: any) => any) => {
    const providers = await import("../server/ai-chat/providers");
    providers.resetOpenAIRouting();
    const urls: string[] = [];
    providers.setProviderFetch(async (url, init) => { urls.push(url.replace(/^.*\/v1/, "")); return handler(url, JSON.parse(init.body)); });
    try {
      const out = await providers.createProvider("openai", "k", model).complete({ system: "s", messages: [{ role: "user", text: "hi" }], tools });
      return { out, urls };
    } finally { providers.setProviderFetch(null); }
  };
  const refusal = "Function tools with reasoning_effort are not supported for gpt-5.6-terra in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to none.";

  it("keeps gpt-4o on chat completions", async () => {
    const { out, urls } = await run("gpt-4o", () => chatOk);
    expect(out.text).toBe("chat");
    expect(urls).toEqual(["/chat/completions"]);
  });

  it("starts a gpt-5 / o-series model on the Responses API", async () => {
    for (const model of ["gpt-5.6-terra", "o4-mini"]) {
      const { out, urls } = await run(model, () => respOk);
      expect(out.text).toBe("resp");
      expect(urls).toEqual(["/responses"]);
    }
  });

  it("moves to the Responses API when the provider asks for it, and remembers that for the model", async () => {
    const providers = await import("../server/ai-chat/providers");
    providers.resetOpenAIRouting();
    const urls: string[] = [];
    providers.setProviderFetch(async (url) => { urls.push(url.replace(/^.*\/v1/, "")); return url.endsWith("/chat/completions") ? fail(400, refusal) : respOk; });
    try {
      const p = providers.createProvider("openai", "k", "custom-reasoner");
      const input = { system: "s", messages: [{ role: "user", text: "hi" } as ChatMessage], tools };
      expect((await p.complete(input)).text).toBe("resp");
      expect((await p.complete(input)).text).toBe("resp");
      expect(urls).toEqual(["/chat/completions", "/responses", "/responses"]); // the second message goes straight to /responses
    } finally { providers.setProviderFetch(null); providers.resetOpenAIRouting(); }
  });

  it("falls back to chat completions with reasoning off when there is no Responses endpoint", async () => {
    let sent: any = null;
    const { out, urls } = await run("gpt-5.6-terra", (url, body) => {
      if (url.endsWith("/responses")) return fail(404, "Not found");
      sent = body;
      return chatOk;
    });
    expect(out.text).toBe("chat");
    expect(urls).toEqual(["/responses", "/chat/completions"]);
    expect(sent.reasoning_effort).toBe("none");
  });

  it("does not mistake an unknown model name or a bad key for this", async () => {
    await expect(run("gpt-4o", () => fail(400, "The model `gpt-9` does not exist"))).rejects.toThrow(/does not accept this model name/);
    await expect(run("gpt-5.6-terra", () => fail(401, "bad key"))).rejects.toThrow(/rejected the API key/);
  });
});
