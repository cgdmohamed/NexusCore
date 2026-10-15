import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";
import { dayKey } from "../../server/task-insights";

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!TEST_DATABASE_URL)("MCP report tools (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  let token = "";
  let roleId = "";
  let serviceUserId = "";
  let nextId = 1;
  const day = (o: number) => dayKey(new Date(Date.now() + o * DAY), "Africa/Cairo");
  const at = (o: number) => new Date(`${day(o)}T00:00:00Z`);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
    const created = await ctx.api("POST", "/api/settings/ai-access/tokens", { name: "reports" });
    token = created.body.token;
    roleId = created.body.roleId;
    const { users, roles } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    [{ id: serviceUserId }] = (await ctx.db.select().from(users)).filter((u: any) => u.username === "ai-assistant");
    const all = { view: true, add: false, edit: false, delete: false, approve: false };
    await ctx.db.update(roles).set({ permissions: { tasks: all, projects: all, crm: all, invoices: all } } as any).where(eq(roles.id, roleId));
  });
  afterAll(async () => { await ctx?.close(); });

  const call = async (name: string, args: unknown = {}) => {
    const res = await fetch(`${ctx.base}/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } }) });
    const r = await res.json();
    const text = r.result.content[0].text as string;
    return { isError: !!r.result.isError, text, data: r.result.isError ? null : JSON.parse(text) };
  };

  it("summarises what is owed, what is overdue, how old it is and who owes it", async () => {
    const { clients, invoices } = await import("../../shared/schema");
    const [a, b] = await ctx.db.insert(clients).values([{ name: "Debtor A", status: "active" }, { name: "Debtor B", status: "active" }] as any).returning();
    await ctx.db.insert(invoices).values([
      { invoiceNumber: "R-1", clientId: a.id, amount: "1000", paidAmount: "250", status: "partially_paid", dueDate: at(-5), invoiceDate: new Date() },   // 750 owed, 5 days late
      { invoiceNumber: "R-2", clientId: a.id, amount: "400", paidAmount: "0", status: "sent", dueDate: at(-40), invoiceDate: new Date() },              // 400 owed, 40 days late
      { invoiceNumber: "R-3", clientId: b.id, amount: "900", paidAmount: "0", status: "sent", dueDate: at(10), invoiceDate: new Date() },               // not yet due
      { invoiceNumber: "R-4", clientId: b.id, amount: "300", paidAmount: "300", status: "paid", dueDate: at(-3), invoiceDate: new Date() },             // settled
      { invoiceNumber: "R-5", clientId: b.id, amount: "700", status: "draft", dueDate: at(-3) },                                                       // never issued
    ] as any);

    const r = (await call("summary_invoices")).data;
    expect(r.outstanding.total).toBe(2050);
    expect(r.overdue).toEqual({ count: 2, amount: 1150 });
    expect(r.aging.d1_30).toEqual({ count: 1, amount: 750 });
    expect(r.aging.d31_60).toEqual({ count: 1, amount: 400 });
    expect(r.aging.notDue).toEqual({ count: 1, amount: 900 });
    expect(r.topDebtors[0]).toMatchObject({ client: "Debtor A", outstanding: 1150 });
    expect(r.thisMonth.invoiced.count).toBeGreaterThanOrEqual(4); // issued this month, never the draft
  });

  it("reports project progress with the same figures and state as the projects page, worst first", async () => {
    const { projects, tasks } = await import("../../shared/schema");
    const [late, calm, empty, paused] = await ctx.db.insert(projects).values([
      { name: "Report Late", status: "active", dueDate: at(-3) }, { name: "Report Calm", status: "active", dueDate: at(30) },
      { name: "Report Empty", status: "active" }, { name: "Report Paused", status: "on_hold" },
    ] as any).returning();
    const t = (extra: object) => ({ title: "t", createdBy: ctx.currentUserId, ...extra }) as any;
    await ctx.db.insert(tasks).values([
      t({ projectId: late.id, status: "completed" }), t({ projectId: late.id, status: "pending", dueDate: at(-1) }), t({ projectId: late.id, status: "cancelled" }),
      t({ projectId: calm.id, status: "completed" }), t({ projectId: calm.id, status: "completed" }), t({ projectId: calm.id, status: "in_progress", dueDate: at(5) }), t({ projectId: calm.id, status: "pending" }),
      t({ projectId: paused.id, status: "pending" }),
    ]);

    const r = (await call("summary_projects")).data;
    const names = r.items.map((p: any) => p.name);
    expect(names).not.toContain("Report Paused"); // active by default
    expect(names.indexOf("Report Late")).toBeLessThan(names.indexOf("Report Calm")); // overdue before on track
    const get = (n: string) => r.items.find((p: any) => p.name === n);
    expect(get("Report Late")).toMatchObject({ state: "overdue", percentComplete: 50, tasksDone: 1, tasksTotal: 2, lateTasks: 1 });
    expect(get("Report Calm")).toMatchObject({ state: "on_track", percentComplete: 50, tasksDone: 2, tasksTotal: 4 });
    expect(get("Report Empty")).toMatchObject({ state: "no_tasks", percentComplete: 0, tasksTotal: 0 });
    expect((await call("summary_projects", { status: "on_hold" })).data.items.map((p: any) => p.name)).toContain("Report Paused");

    const page = (await ctx.api("GET", "/api/projects")).body;
    for (const n of ["Report Late", "Report Calm", "Report Empty"]) {
      const p = page.find((x: any) => x.name === n);
      expect(get(n).tasksTotal).toBe(p.taskCounts.total);
      expect(get(n).state).toBe(p.health);
    }
  });

  it("lists the signed-in person's own work by lateness", async () => {
    const { tasks } = await import("../../shared/schema");
    const t = (title: string, extra: object) => ({ title, assignedTo: serviceUserId, createdBy: ctx.currentUserId, ...extra }) as any;
    await ctx.db.insert(tasks).values([
      t("Mine late", { status: "pending", dueDate: at(-2) }), t("Mine today", { status: "in_progress", dueDate: at(0) }),
      t("Mine soon", { status: "pending", dueDate: at(3) }), t("Mine far", { status: "pending", dueDate: at(20) }),
      t("Mine done", { status: "completed", dueDate: at(0) }), t("Mine no date", { status: "pending" }),
      { title: "Someone else's", assignedTo: ctx.currentUserId, createdBy: ctx.currentUserId, status: "pending", dueDate: at(0) },
    ]);
    const r = (await call("my_day")).data;
    expect(r.today).toBe(day(0));
    expect(r.overdue.items.map((i: any) => i.title)).toEqual(["Mine late"]);
    expect(r.dueToday.items.map((i: any) => i.title)).toEqual(["Mine today"]);
    expect(r.next7Days.items.map((i: any) => i.title)).toEqual(["Mine soon"]);
    expect(r.overdue.total + r.dueToday.total + r.next7Days.total).toBe(3);
  });

  it("gives a client's account position by name, tolerant of spelling", async () => {
    const r = await call("client_statement", { clientName: "debtor-a" });
    expect(r.isError).toBe(false);
    expect(r.data.client.name).toBe("Debtor A");
    expect(r.data.position).toMatchObject({ outstanding: 1150, overdue: 1150 });
    expect(r.data.totals.billed).toBe(1400);
    expect(r.data.latestEntries.length).toBeGreaterThan(0);
    expect((await call("client_statement", { clientName: "nobody at all" })).isError).toBe(true);
    expect((await call("client_statement", { clientName: "Debtor A", from: "2026-10-05", to: "2026-10-01" })).isError).toBe(true);
  });

  it("is read-only and hidden from a role without the permission", async () => {
    const { roles } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const none = { view: false, add: false, edit: false, delete: false, approve: false };
    await ctx.db.update(roles).set({ permissions: { tasks: { ...none, view: true }, projects: none, crm: none, invoices: none } } as any).where(eq(roles.id, roleId));
    const res = await fetch(`${ctx.base}/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 999, method: "tools/list" }) });
    const tools = (await res.json()).result.tools as any[];
    const names = tools.map((t) => t.name);
    expect(names).toContain("my_day");
    for (const hidden of ["summary_invoices", "summary_projects", "client_statement"]) expect(names).not.toContain(hidden);
    expect(tools.filter((t) => ["my_day", "summary_invoices"].includes(t.name)).every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
    expect((await call("summary_invoices")).text).toMatch(/Permission denied/);
  });
});
