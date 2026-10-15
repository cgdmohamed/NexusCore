import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";

describe.skipIf(!TEST_DATABASE_URL)("In-app AI assistant (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  let replies: any[] = [];
  let requests: any[] = [];
  let responder: ((body: any) => Promise<any[]> | any[]) | null = null;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.VAULT_ENCRYPTION_KEY = "ab".repeat(32);
    ctx = await startApp();
    const { setProviderFetch } = await import("../../server/ai-chat/providers");
    setProviderFetch(async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      if (responder) return { ok: true, status: 200, text: async () => JSON.stringify({ content: await responder!(body) }) };
      const next = replies.shift();
      if (!next) return { ok: false, status: 500, text: async () => "{}" };
      return { ok: true, status: 200, text: async () => JSON.stringify({ content: next }) };
    });
  });
  afterAll(async () => { const { setProviderFetch } = await import("../../server/ai-chat/providers"); setProviderFetch(null); await ctx?.close(); });
  beforeEach(async () => { requests = []; replies = []; responder = null; const { resetAiChatLimits } = await import("../../server/ai-chat/routes"); resetAiChatLimits(); await api("POST", "/api/ai-chat/new"); });

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

  it("shows names, not ids, in the waiting actions", async () => {
    await configure();
    const task = (await api("POST", "/api/tasks", { title: "Prepare the launch checklist" })).body;
    replies = [[...use("a", "update_task", { taskId: task.id, dueDate: "2026-10-23" }), ...use("b", "update_task", { taskId: task.id, priority: "high" })]];
    const r = await api("POST", "/api/ai-chat/messages", { text: "move it" });
    expect(r.body.pending).toHaveLength(2);
    expect(r.body.pending[0].names).toEqual({ taskId: "Prepare the launch checklist" });
    // A person's current conversation shows the same names after a reload
    expect((await api("GET", "/api/ai-chat/current")).body.pending[1].names.taskId).toBe("Prepare the launch checklist");
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

  it("finds 'rosegold' when the model asks for 'rose gold', and the model sees the result, not an error", async () => {
    await configure();
    const { projects, tasks } = await import("../../shared/schema");
    const [p] = await ctx.db.insert(projects).values({ name: "rosegold", status: "active" } as any).returning();
    await ctx.db.insert(tasks).values({ title: "Rosegold shoot", projectId: p.id, status: "pending", createdBy: ctx.currentUserId } as any);
    replies = [use("r1", "list_tasks", { projectName: "rose gold" }), text("لديك مهمة واحدة في المشروع.")];
    const r = await api("POST", "/api/ai-chat/messages", { text: "ما المهام المطلوبة في rosegold؟", language: "ar" });
    expect(r.status).toBe(200);
    const result = requests[1].messages.at(-1).content[0];
    expect(result.type).toBe("tool_result");
    expect(result.is_error).toBeUndefined();
    expect(JSON.parse(result.content)).toMatchObject({ total: 1, hasMore: false, items: [{ title: "Rosegold shoot", project: "rosegold" }] });
    // and the model was told who it is talking to and today's date
    expect(requests[0].system).toContain(ctx.currentUserId);
    expect(requests[0].system).toMatch(/Today is \w+day \d{4}-\d{2}-\d{2}/);
  });

  describe("several conversations at once", () => {
    const lastUserText = (b: any) => { const m = [...b.messages].reverse().find((x: any) => x.role === "user" && typeof x.content === "string"); return m?.content ?? ""; };

    it("keeps conversations apart, runs them in parallel, and lists them newest first", async () => {
      await configure();
      const a = (await api("POST", "/api/ai-chat/chats")).body.chatId;
      const b = (await api("POST", "/api/ai-chat/chats")).body.chatId;
      expect(a).toBeTruthy();
      expect(b).toBe(a); // an untouched empty conversation is reused, not piled up

      const second = (await api("POST", "/api/ai-chat/chats")).body.chatId;
      expect(second).toBe(a);

      // Two conversations answering at the same moment: each waits on the other's gate, so they only finish if truly parallel
      const chat2 = await (async () => {
        responder = (body) => text(`re: ${lastUserText(body)}`);
        const first = await api("POST", `/api/ai-chat/chats/${a}/messages`, { text: "first topic" });
        expect(first.status).toBe(200);
        const fresh = (await api("POST", "/api/ai-chat/chats")).body.chatId;
        expect(fresh).not.toBe(a);
        return fresh as string;
      })();

      let release!: () => void;
      const gate = new Promise<void>((r) => { release = r; });
      let inFlight = 0;
      let peak = 0;
      responder = async (body) => { inFlight++; peak = Math.max(peak, inFlight); await gate; inFlight--; return text(`re: ${lastUserText(body)}`); };
      const pa = api("POST", `/api/ai-chat/chats/${a}/messages`, { text: "follow up A" });
      const pb = api("POST", `/api/ai-chat/chats/${chat2}/messages`, { text: "second topic" });
      await vi.waitFor(() => expect(peak).toBe(2));
      release();
      const [ra, rb] = await Promise.all([pa, pb]);
      expect(ra.status).toBe(200);
      expect(rb.status).toBe(200);
      expect(ra.body.items.map((i: any) => i.text)).toEqual(["first topic", "re: first topic", "follow up A", "re: follow up A"]);
      expect(rb.body.items.map((i: any) => i.text)).toEqual(["second topic", "re: second topic"]);

      const list = (await api("GET", "/api/ai-chat/chats")).body;
      expect(list.map((c: any) => c.title)).toEqual(expect.arrayContaining(["first topic", "second topic"]));
      expect(list.filter((c: any) => [a, chat2].includes(c.id)).every((c: any) => c.awaiting === false)).toBe(true);
      expect((await api("GET", `/api/ai-chat/chats/${a}`)).body.items).toHaveLength(4);
    });

    it("refuses a second request in the same conversation while it is busy, but not in another", async () => {
      await configure();
      const a = (await api("POST", "/api/ai-chat/chats")).body.chatId;
      let release!: () => void;
      const gate = new Promise<void>((r) => { release = r; });
      responder = async () => { await gate; return text("ok"); };
      const slow = api("POST", `/api/ai-chat/chats/${a}/messages`, { text: "slow one" });
      await vi.waitFor(async () => expect(requests.length).toBeGreaterThan(0));
      expect((await api("POST", `/api/ai-chat/chats/${a}/messages`, { text: "again" })).status).toBe(409);
      expect((await api("DELETE", `/api/ai-chat/chats/${a}`)).status).toBe(409);
      release();
      expect((await slow).status).toBe(200);
    });

    it("lets one conversation wait for confirmation while another carries on", async () => {
      await configure();
      const { tasks } = await import("../../shared/schema");
      const before = (await ctx.db.select().from(tasks)).length;
      const a = (await api("POST", "/api/ai-chat/chats")).body.chatId;
      responder = (body) => (lastUserText(body).includes("create") ? use("c1", "create_task", { title: "Waiting task" }) : text("hello"));
      const asked = await api("POST", `/api/ai-chat/chats/${a}/messages`, { text: "create a task" });
      expect(asked.body.pending).toHaveLength(1);

      const b = (await api("POST", "/api/ai-chat/chats")).body.chatId;
      expect(b).not.toBe(a);
      expect((await api("POST", `/api/ai-chat/chats/${b}/messages`, { text: "just chatting" })).body.pending).toBeNull();
      expect((await api("GET", "/api/ai-chat/chats")).body.find((c: any) => c.id === a).awaiting).toBe(true);
      expect((await ctx.db.select().from(tasks)).length).toBe(before);

      // Answering in the other conversation does nothing to this one
      expect((await api("POST", `/api/ai-chat/chats/${b}/confirm`, { approve: true })).status).toBe(409);
      responder = () => text("Done.");
      expect((await api("POST", `/api/ai-chat/chats/${a}/confirm`, { approve: true })).status).toBe(200);
      expect((await ctx.db.select().from(tasks)).length).toBe(before + 1);
    });

    it("hides one person's conversations from everyone else, and lets only the owner delete", async () => {
      await configure();
      const { users, aiChats } = await import("../../shared/schema");
      const [other] = await ctx.db.insert(users).values({ username: `other-${Date.now()}`, email: `o${Date.now()}@x.test`, passwordHash: "x", firstName: "O", lastName: "P" } as any).returning();
      const [theirs] = await ctx.db.insert(aiChats).values({ userId: other.id, messages: [{ role: "user", text: "private" }] as any }).returning();
      expect((await api("GET", `/api/ai-chat/chats/${theirs.id}`)).status).toBe(404);
      expect((await api("POST", `/api/ai-chat/chats/${theirs.id}/messages`, { text: "hi" })).status).toBe(404);
      expect((await api("DELETE", `/api/ai-chat/chats/${theirs.id}`)).status).toBe(404);
      expect((await api("GET", "/api/ai-chat/chats")).body.some((c: any) => c.id === theirs.id)).toBe(false);

      responder = () => text("ok");
      const mine = (await api("POST", "/api/ai-chat/chats")).body.chatId;
      await api("POST", `/api/ai-chat/chats/${mine}/messages`, { text: "mine" });
      expect((await api("DELETE", `/api/ai-chat/chats/${mine}`)).status).toBe(200);
      expect((await api("GET", `/api/ai-chat/chats/${mine}`)).status).toBe(404);
    });

    it("still shares one hourly limit across conversations", async () => {
      await configure();
      responder = () => text("ok");
      const a = (await api("POST", "/api/ai-chat/chats")).body.chatId;
      for (let i = 0; i < 30; i++) expect((await api("POST", `/api/ai-chat/chats/${a}/messages`, { text: `m${i}` })).status).toBe(200);
      const b = (await api("POST", "/api/ai-chat/chats")).body.chatId;
      expect((await api("POST", `/api/ai-chat/chats/${b}/messages`, { text: "one more" })).status).toBe(429);
    });
  });
});
