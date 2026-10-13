import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";

describe.skipIf(!TEST_DATABASE_URL)("In-app AI assistant (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  let replies: any[] = [];
  let requests: any[] = [];
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.VAULT_ENCRYPTION_KEY = "ab".repeat(32);
    ctx = await startApp();
    const { setProviderFetch } = await import("../../server/ai-chat/providers");
    setProviderFetch(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      const next = replies.shift();
      if (!next) return { ok: false, status: 500, text: async () => "{}" };
      return { ok: true, status: 200, text: async () => JSON.stringify({ content: next }) };
    });
  });
  afterAll(async () => { const { setProviderFetch } = await import("../../server/ai-chat/providers"); setProviderFetch(null); await ctx?.close(); });
  beforeEach(async () => { requests = []; replies = []; const { resetAiChatLimits } = await import("../../server/ai-chat/routes"); resetAiChatLimits(); await api("POST", "/api/ai-chat/new"); });

  const text = (t: string) => [{ type: "text", text: t }];
  const use = (id: string, name: string, input: unknown) => [{ type: "tool_use", id, name, input }];
  const configure = (extra: object = {}) => api("PUT", "/api/settings/ai-chat", { provider: "anthropic", model: "claude-x", apiKey: "sk-ant-test-WXYZ", enabled: true, ...extra });

  it("is off until an administrator sets a key, and never returns the key", async () => {
    expect((await api("GET", "/api/ai-chat/status")).body.enabled).toBe(false);
    const sent = await api("POST", "/api/ai-chat/messages", { text: "hello" });
    expect(sent.status).toBe(503);
    expect((await configure()).status).toBe(200);
    expect((await api("GET", "/api/ai-chat/status")).body.enabled).toBe(true);
    const s = (await api("GET", "/api/settings/ai-chat")).body;
    expect(s).toMatchObject({ provider: "anthropic", model: "claude-x", hasKey: true, keyLast4: "WXYZ" });
    expect(JSON.stringify(s)).not.toContain("sk-ant-test");
    const { aiSettings } = await import("../../shared/schema");
    const [row] = await ctx.db.select().from(aiSettings);
    expect(row.apiKeyEnc).not.toContain("sk-ant-test");
    // Saving without a key keeps the stored one
    await configure({ apiKey: undefined, model: "claude-y" });
    expect((await api("GET", "/api/settings/ai-chat")).body).toMatchObject({ hasKey: true, model: "claude-y" });
  });

  it("answers a plain question", async () => {
    await configure();
    replies = [text("مرحباً")];
    const r = await api("POST", "/api/ai-chat/messages", { text: "السلام عليكم", language: "ar" });
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: any) => i.text)).toEqual(["السلام عليكم", "مرحباً"]);
    expect(requests[0].model).toBe("claude-x");
    expect(requests[0].system).toContain("Modern Standard Arabic");
    // The conversation survives a reload
    expect((await api("GET", "/api/ai-chat/current")).body.items).toHaveLength(2);
  });

  it("asks before creating, then creates as the signed-in person only when confirmed", async () => {
    await configure();
    const { tasks } = await import("../../shared/schema");
    const countTasks = async () => (await ctx.db.select().from(tasks)).length;
    const before = await countTasks();

    replies = [use("t1", "create_task", { title: "Call the supplier" })];
    const asked = await api("POST", "/api/ai-chat/messages", { text: "add a task to call the supplier" });
    expect(asked.body.pending).toEqual([expect.objectContaining({ name: "create_task", args: { title: "Call the supplier" } })]);
    expect(await countTasks()).toBe(before);
    // Typing again while a confirmation is waiting is refused
    expect((await api("POST", "/api/ai-chat/messages", { text: "hello" })).status).toBe(409);

    replies = [text("Done.")];
    const done = await api("POST", "/api/ai-chat/confirm", { approve: true });
    expect(done.status).toBe(200);
    expect(done.body.pending).toBeNull();
    expect(done.body.items.some((i: any) => i.role === "event" && i.name === "create_task" && i.ok)).toBe(true);
    expect(await countTasks()).toBe(before + 1);
    const [created] = (await ctx.db.select().from(tasks)).filter((t: any) => t.title === "Call the supplier");
    expect(created.createdBy).toBe(ctx.currentUserId);
    const { auditLogs } = await import("../../shared/schema");
    expect((await ctx.db.select().from(auditLogs)).some((a: any) => a.action === "chat:create_task")).toBe(true);
  });

  it("does nothing when the person cancels", async () => {
    await configure();
    const { tasks } = await import("../../shared/schema");
    const before = (await ctx.db.select().from(tasks)).length;
    replies = [use("t1", "create_task", { title: "Never made" })];
    await api("POST", "/api/ai-chat/messages", { text: "add a task" });
    replies = [text("Cancelled.")];
    const r = await api("POST", "/api/ai-chat/confirm", { approve: false });
    expect(r.body.pending).toBeNull();
    expect((await ctx.db.select().from(tasks)).length).toBe(before);
    expect((await api("POST", "/api/ai-chat/confirm", { approve: true })).status).toBe(409);
  });

  it("runs reading tools without asking", async () => {
    await configure();
    await api("POST", "/api/clients", { name: "Wayne Enterprises" });
    replies = [use("t1", "list_clients", { search: "wayne" }), text("Found Wayne Enterprises.")];
    const r = await api("POST", "/api/ai-chat/messages", { text: "find wayne" });
    expect(r.body.pending).toBeNull();
    expect(r.body.items.at(-1).text).toBe("Found Wayne Enterprises.");
    // The model was given the tool result
    const toolResult = requests[1].messages.at(-1).content[0];
    expect(toolResult.type).toBe("tool_result");
    expect(toolResult.content).toContain("Wayne Enterprises");
  });

  it("limits the assistant to what the person's role allows", async () => {
    await configure();
    ctx.actAs({ roleName: "Staff", permissions: { tasks: { view: true, add: false, edit: false, delete: false, approve: false } } });
    try {
      replies = [use("t1", "create_task", { title: "Nope" }), text("I cannot do that.")];
      const asked = await api("POST", "/api/ai-chat/messages", { text: "add a task" });
      // create_task is not offered to this person, so the model's call comes back as an error and nothing waits
      expect(asked.body.pending).toBeNull();
      const offered = requests[0].tools.map((t: any) => t.name);
      expect(offered).toContain("list_tasks");
      expect(offered).not.toContain("create_task");
      expect(offered).not.toContain("create_invoice");
    } finally { ctx.actAs(null); }
    ctx.actAs({ roleName: "Staff", permissions: {} });
    try { expect((await api("GET", "/api/ai-chat/status")).body.enabled).toBe(false); } finally { ctx.actAs(null); }
  });

  it("keeps one person's conversation from another", async () => {
    await configure();
    replies = [text("private")];
    await api("POST", "/api/ai-chat/messages", { text: "my secret" });
    const { users } = await import("../../shared/schema");
    const [other] = await ctx.db.insert(users).values({ username: "other", email: "o@example.com", passwordHash: "x" }).returning();
    ctx.actAs({ id: other.id });
    try { expect((await api("GET", "/api/ai-chat/current")).body.items).toEqual([]); } finally { ctx.actAs(null); }
  });

  it("drops a message when the provider fails, and reports a clear error", async () => {
    await configure();
    replies = []; // the fake answers 500
    const r = await api("POST", "/api/ai-chat/messages", { text: "hello" });
    expect(r.status).toBe(502);
    expect(r.body.message).toMatch(/AI provider/);
    expect((await api("GET", "/api/ai-chat/current")).body.items).toEqual([]);
  });

  it("limits how many messages one person can send per hour", async () => {
    await configure();
    for (let i = 0; i < 30; i++) { replies = [text("ok")]; expect((await api("POST", "/api/ai-chat/messages", { text: "hi" })).status).toBe(200); }
    replies = [text("ok")];
    expect((await api("POST", "/api/ai-chat/messages", { text: "hi" })).status).toBe(429);
  });

  it("lets only an administrator change the settings", async () => {
    ctx.actAs({ roleName: "Staff" });
    try {
      expect((await configure()).status).toBe(403);
      expect((await api("GET", "/api/settings/ai-chat")).status).toBe(403);
    } finally { ctx.actAs(null); }
  });
});
