import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";

describe.skipIf(!TEST_DATABASE_URL)("MCP endpoint (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  let token = "";
  let tokenId = "";
  let resetRateLimits: () => void = () => {};
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
    ({ resetRateLimits } = await import("../../server/mcp/tokens"));
    const created = await api("POST", "/api/settings/ai-access/tokens", { name: "test client" });
    expect(created.status).toBe(201);
    token = created.body.token;
    tokenId = created.body.id;
  });
  afterAll(async () => {
    await ctx?.close();
  });

  let nextId = 1;
  const rpc = async (method: string, params?: unknown, bearer: string | null = token) => {
    const res = await fetch(`${ctx.base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const call = async (name: string, args: unknown = {}) => {
    const r = await rpc("tools/call", { name, arguments: args });
    const result = r.body.result;
    const text = result.content[0].text as string;
    return { isError: !!result.isError, text, data: result.isError ? null : JSON.parse(text) };
  };
  const addUser = async (username: string, firstName: string, lastName: string) => {
    const { users } = await import("../../shared/schema");
    const [u] = await ctx.db.insert(users).values({ username, email: `${username}@example.com`, passwordHash: "x", firstName, lastName }).returning();
    return u;
  };

  it("sets up a service account that cannot sign in, and never stores the token", async () => {
    const { users, apiTokens } = await import("../../shared/schema");
    const [assistant] = (await ctx.db.select().from(users)).filter((u: any) => u.username === "ai-assistant");
    expect(assistant.passwordHash.startsWith("!disabled!")).toBe(true);
    expect(assistant.role).toBe("AI Assistant");
    const rows = await ctx.db.select().from(apiTokens);
    expect(rows.some((r: any) => r.tokenHash === token || r.tokenHash.includes(token))).toBe(false);
    const listed = (await api("GET", "/api/settings/ai-access")).body;
    expect(listed.tokens[0].prefix).toBe(token.slice(0, listed.tokens[0].prefix.length));
    expect(JSON.stringify(listed)).not.toContain(token);
    expect(listed.mcpUrl).toMatch(/\/mcp$/);
  });

  it("rejects a missing or wrong token", async () => {
    expect((await rpc("ping", undefined, null)).status).toBe(401);
    expect((await rpc("ping", undefined, "nxc_notarealtoken")).status).toBe(401);
    expect((await rpc("ping")).status).toBe(200);
  });

  it("answers initialize and lists the tools the account may use", async () => {
    const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    expect(init.body.result.serverInfo.name).toBe("nexuscore");
    const list = await rpc("tools/list");
    expect(list.body.result.tools.map((t: any) => t.name).sort()).toEqual([
      "add_project_member", "assign_task", "create_project", "create_task", "get_task", "list_projects", "list_tasks", "list_users", "update_task",
    ]);
    const notice = await fetch(`${ctx.base}/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
    expect(notice.status).toBe(202);
    expect((await fetch(`${ctx.base}/mcp`)).status).toBe(405);
  });

  it("creates a project, adds a person to it, and creates a task assigned by name that notifies them", async () => {
    const sara = await addUser("sara.m", "Sara", "Mostafa");
    const project = await call("create_project", { name: "Website relaunch", dueDate: "2026-12-01" });
    expect(project.data).toMatchObject({ name: "Website relaunch", status: "active", dueDate: "2026-12-01" });

    const member = await call("add_project_member", { projectName: "Website relaunch", userName: "Sara Mostafa", role: "lead" });
    expect(member.data.user.id).toBe(sara.id);

    const task = await call("create_task", { title: "Design the home page", priority: "high", dueDate: "2026-11-10", assigneeName: "Sara", projectName: "Website relaunch" });
    expect(task.isError).toBe(false);
    expect(task.data).toMatchObject({ title: "Design the home page", priority: "high", status: "pending", dueDate: "2026-11-10" });
    expect(task.data.assignee).toEqual({ id: sara.id, name: "Sara Mostafa" });
    expect(task.data.project.id).toBe(project.data.id);

    const { notifications } = await import("../../shared/schema");
    const mine = (await ctx.db.select().from(notifications)).filter((n: any) => n.userId === sara.id && n.type === "task_assigned");
    expect(mine).toHaveLength(1);
    expect(mine[0].message).toContain("Design the home page");

    const listed = await call("list_tasks", { assigneeId: sara.id });
    expect(listed.data.map((t: any) => t.title)).toEqual(["Design the home page"]);
    expect((await call("list_projects", { search: "relaunch" })).data[0].openTasks).toBe(1);
  });

  it("reassigns a task and tells the new assignee", async () => {
    const omar = await addUser("omar.k", "Omar", "Khaled");
    const task = await call("create_task", { title: "Write copy" });
    expect(task.data.assignee).toBeNull();
    const assigned = await call("assign_task", { taskId: task.data.id, assigneeId: omar.id });
    expect(assigned.data.assignee.id).toBe(omar.id);
    const { notifications } = await import("../../shared/schema");
    expect((await ctx.db.select().from(notifications)).filter((n: any) => n.userId === omar.id && n.type === "task_assigned")).toHaveLength(1);
  });

  it("stamps the completion date like the app does, and clears it when reopened", async () => {
    const task = await call("create_task", { title: "Ship it" });
    const done = await call("update_task", { taskId: task.data.id, status: "completed" });
    expect(done.data.status).toBe("completed");
    expect(done.data.completedDate).toBe(new Date().toISOString().slice(0, 10));
    const reopened = await call("update_task", { taskId: task.data.id, status: "in_progress", dueDate: "2026-12-24" });
    expect(reopened.data).toMatchObject({ status: "in_progress", completedDate: null, dueDate: "2026-12-24" });
    expect((await call("update_task", { taskId: task.data.id, dueDate: "" })).data.dueDate).toBeNull();
  });

  it("asks which person when a name matches several, instead of guessing", async () => {
    const a = await addUser("dina.a", "Dina", "Adel");
    await addUser("dina.b", "Dina", "Badr");
    const r = await call("create_task", { title: "Needs an owner", assigneeName: "Dina" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("matches 2 people");
    expect(r.text).toContain(a.id);
    expect((await call("create_task", { title: "Nobody", assigneeName: "Zzzz" })).text).toContain("No active user matches");
    // nothing was created by the failed calls
    expect((await call("list_tasks", { search: "Needs an owner" })).data).toHaveLength(0);
  });

  it("explains bad input in a way a model can fix", async () => {
    const r = await call("create_task", { title: "x", dueDate: "tomorrow" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("YYYY-MM-DD");
    expect((await call("get_task", { taskId: "00000000-0000-0000-0000-000000000000" })).isError).toBe(true);
  });

  it("follows the role: without permission to add projects the tool is hidden and refused", async () => {
    const { roles } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const [role] = await ctx.db.select().from(roles).where(eq(roles.name, "AI Assistant"));
    const perms = { ...(role.permissions as any), projects: { view: true, add: false, edit: true, delete: false, approve: false } };
    await ctx.db.update(roles).set({ permissions: perms }).where(eq(roles.id, role.id));
    try {
      const names = (await rpc("tools/list")).body.result.tools.map((t: any) => t.name);
      expect(names).not.toContain("create_project");
      const denied = await call("create_project", { name: "Not allowed" });
      expect(denied.isError).toBe(true);
      expect(denied.text).toContain("Permission denied");
      expect((await call("list_projects", { search: "Not allowed" })).data).toHaveLength(0);
    } finally {
      await ctx.db.update(roles).set({ permissions: role.permissions }).where(eq(roles.id, role.id));
    }
  });

  it("limits how fast one token can call", async () => {
    resetRateLimits();
    let last = 200;
    for (let i = 0; i < 125 && last === 200; i++) last = (await rpc("ping")).status;
    expect(last).toBe(429);
    resetRateLimits();
  });

  it("stops working the moment the token is revoked", async () => {
    resetRateLimits();
    expect((await api("DELETE", `/api/settings/ai-access/tokens/${tokenId}`)).status).toBe(200);
    expect((await rpc("ping")).status).toBe(401);
    expect((await api("DELETE", "/api/settings/ai-access/tokens/00000000-0000-0000-0000-000000000000")).status).toBe(404);
  });
});
