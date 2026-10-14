import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";
import { dayKey } from "../../server/task-insights";

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!TEST_DATABASE_URL)("calendar (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const ids: Record<string, string> = {};
  const day = (offset: number) => dayKey(new Date(Date.now() + offset * DAY), "Africa/Cairo");
  const at = (offset: number) => new Date(`${day(offset)}T00:00:00Z`); // how the forms store a date

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
    const { users, clients, tasks, projects, projectMembers, invoices, quotations } = await import("../../shared/schema");
    const me = ctx.currentUserId;
    const [other] = await ctx.db.insert(users).values({ username: "colleague", email: "c@x.test", passwordHash: "x", firstName: "Sara", lastName: "Ali" } as any).returning();
    ids.other = other.id;
    const [client] = await ctx.db.insert(clients).values({ name: "Acme" } as any).returning();
    const [mine, theirs, notMine] = await ctx.db.insert(projects).values([
      { name: "Mine", status: "active", startDate: at(-5), dueDate: at(10), createdBy: me },
      { name: "Theirs", status: "active", startDate: at(-2), dueDate: at(4), createdBy: other.id },
      { name: "Archived", status: "archived", dueDate: at(2), createdBy: me },
    ] as any).returning();
    await ctx.db.insert(projectMembers).values({ projectId: mine.id, userId: me } as any);
    await ctx.db.insert(tasks).values([
      { title: "My open", assignedTo: me, createdBy: me, status: "pending", dueDate: at(1), projectId: mine.id },
      { title: "My late", assignedTo: me, createdBy: me, status: "in_progress", dueDate: at(-1) },
      { title: "My done", assignedTo: me, createdBy: me, status: "completed", dueDate: at(0) },
      { title: "My cancelled", assignedTo: me, createdBy: me, status: "cancelled", dueDate: at(0) },
      { title: "Hers", assignedTo: other.id, createdBy: other.id, status: "pending", dueDate: at(1), projectId: theirs.id },
    ] as any);
    await ctx.db.insert(invoices).values([
      { invoiceNumber: "INV-C-1", clientId: client.id, amount: "1000", paidAmount: "0", status: "sent", dueDate: at(2), createdBy: me },
      { invoiceNumber: "INV-C-2", clientId: client.id, amount: "500", paidAmount: "500", status: "paid", dueDate: at(2), createdBy: me },
      { invoiceNumber: "INV-C-3", clientId: client.id, amount: "700", status: "draft", dueDate: at(2), createdBy: me },
      { invoiceNumber: "INV-C-4", clientId: client.id, amount: "800", paidAmount: "0", status: "sent", dueDate: at(2), createdBy: other.id },
    ] as any);
    await ctx.db.insert(quotations).values([
      { quotationNumber: "Q-C-1", amount: "100", clientId: client.id, title: "Site", status: "sent", validUntil: at(3), createdBy: me },
      { quotationNumber: "Q-C-2", amount: "100", clientId: client.id, title: "Draft", status: "draft", validUntil: at(3), createdBy: me },
      { quotationNumber: "Q-C-3", amount: "100", clientId: client.id, title: "Theirs", status: "sent", validUntil: at(3), createdBy: other.id },
    ] as any);
    void notMine;
  });
  afterAll(async () => { await ctx?.close(); });

  const get = (q: string) => ctx.api("GET", `/api/calendar?from=${day(-10)}&to=${day(15)}&${q}`);
  const titles = (r: any, type: string) => r.body.events.filter((e: any) => e.type === type).map((e: any) => e.title).sort();

  it("shows a person their own dates across all four kinds", async () => {
    const r = await get("scope=me");
    expect(r.status).toBe(200);
    expect(titles(r, "task")).toEqual(["My done", "My late", "My open"]); // not cancelled, not hers
    expect(titles(r, "invoice")).toEqual(["INV-C-1", "INV-C-2"]); // not a draft, not someone else's
    expect(titles(r, "quotation")).toEqual(["Q-C-1"]); // only sent, only theirs
    expect(titles(r, "project")).toEqual(["Mine", "Mine"]); // start and due marks
    expect(r.body.projects.map((p: any) => p.name)).toEqual(["Mine"]); // archived and others' hidden
  });

  it("marks late, done and open, and settled invoices as done", async () => {
    const r = await get("scope=me");
    const state = (type: string, title: string) => r.body.events.find((e: any) => e.type === type && e.title === title).state;
    expect(state("task", "My late")).toBe("late");
    expect(state("task", "My done")).toBe("done");
    expect(state("task", "My open")).toBe("open");
    expect(state("invoice", "INV-C-2")).toBe("done");
    expect(state("invoice", "INV-C-1")).toBe("open");
  });

  it("puts every event on its company calendar day", async () => {
    const r = await get("scope=me");
    const dayOfTitle = (t: string) => r.body.events.find((e: any) => e.title === t).day;
    expect(dayOfTitle("My open")).toBe(day(1));
    expect(dayOfTitle("INV-C-1")).toBe(day(2));
    expect(dayOfTitle("Q-C-1")).toBe(day(3));
  });

  it("gives the administrator the whole team, and only the administrator", async () => {
    const team = await get("scope=team");
    expect(team.status).toBe(200);
    expect(titles(team, "task")).toContain("Hers");
    expect(titles(team, "invoice")).toContain("INV-C-4");
    expect(titles(team, "quotation")).toContain("Q-C-3");
    expect(team.body.projects.map((p: any) => p.name).sort()).toEqual(["Mine", "Theirs"]);
    expect(team.body.events.find((e: any) => e.title === "Hers").assignee).toBe("Sara Ali");

    ctx.actAs({ roleName: "Employee" });
    try {
      expect((await get("scope=team")).status).toBe(403);
      expect((await get("scope=me")).status).toBe(200);
    } finally { ctx.actAs(null); }
  });

  it("shows a person only what their role may view, and honours the type filter", async () => {
    ctx.actAs({ roleName: "Employee", permissions: { tasks: { view: true } } });
    try {
      const r = await get("scope=me");
      expect(r.body.events.every((e: any) => e.type === "task")).toBe(true);
      expect(r.body.projects).toEqual([]);
    } finally { ctx.actAs(null); }
    const only = await get("scope=me&types=invoice,quotation");
    expect([...new Set(only.body.events.map((e: any) => e.type))].sort()).toEqual(["invoice", "quotation"]);
  });

  it("reports progress for the timeline from the same figures as the projects page", async () => {
    const r = await get("scope=me");
    const p = r.body.projects[0];
    expect(p).toMatchObject({ name: "Mine", total: 1, completed: 0, pct: 0 });
    const page = (await ctx.api("GET", "/api/projects")).body.find((x: any) => x.name === "Mine");
    expect(page.taskCounts.total).toBe(p.total);
    expect(page.health).toBe(p.health);
  });

  it("refuses a bad range", async () => {
    expect((await ctx.api("GET", "/api/calendar?from=nope&to=2026-10-01")).status).toBe(400);
    expect((await ctx.api("GET", "/api/calendar?from=2026-01-01&to=2026-12-31")).status).toBe(400);
  });
});
