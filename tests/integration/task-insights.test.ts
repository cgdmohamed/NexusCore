import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";
import { dayKey } from "../../server/task-insights";

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!TEST_DATABASE_URL)("task insights (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  // Due dates are stored as midnight UTC of the calendar day, like the forms do
  const dueOn = (offsetDays: number) => new Date(`${dayKey(new Date(Date.now() + offsetDays * DAY), "Africa/Cairo")}T00:00:00Z`);
  const ago = (days: number) => new Date(Date.now() - days * DAY);

  it("summarises workload, throughput and punctuality, and ranks the tasks that matter", async () => {
    const { tasks, users } = await import("../../shared/schema");
    const me = ctx.currentUserId;
    const [other] = await ctx.db.insert(users).values({ username: "teammate", email: "teammate@example.com", passwordHash: "x", firstName: "Sara", lastName: "Finance" }).returning();
    const t = (extra: object) => ({ title: "t", assignedTo: me, createdBy: me, ...extra }) as any;

    await ctx.db.insert(tasks).values([
      t({ title: "Overdue high", priority: "high", status: "pending", dueDate: dueOn(-3) }),
      t({ title: "Due today", priority: "medium", status: "in_progress", dueDate: dueOn(0) }),
      t({ title: "No date", priority: "low", status: "pending" }),
      t({ title: "Done on time", status: "completed", dueDate: dueOn(0), completedDate: new Date(), createdAt: ago(2) }),
      t({ title: "Done late", status: "completed", dueDate: dueOn(-5), completedDate: ago(2), createdAt: ago(6) }),
      t({ title: "Done last period", status: "completed", completedDate: ago(20), createdAt: ago(25) }),
      t({ title: "Cancelled", status: "cancelled", dueDate: dueOn(-9) }),
      t({ title: "Theirs", assignedTo: other.id, priority: "high", status: "pending", dueDate: dueOn(-1) }),
    ]);

    const r = await api("GET", "/api/tasks/insights?scope=me&days=14");
    expect(r.status).toBe(200);
    const s = r.body;
    expect(s.scope).toBe("me");
    expect(s.totals).toMatchObject({ open: 3, pending: 2, inProgress: 1, overdue: 1, dueToday: 1, completed: 2, previousCompleted: 1 });
    expect(s.priorities).toEqual({ high: 1, medium: 1, low: 1 });
    expect(s.daily).toHaveLength(14);
    expect(s.daily.reduce((a: number, d: any) => a + d.completed, 0)).toBe(2);
    expect(s.daily[13].date).toBe(dayKey(new Date(), "Africa/Cairo"));
    expect(s.productivity).toMatchObject({ perDay: 0.1, previousPerDay: 0.1, changePct: 100, onTimeRate: 50, onTimeSample: 2 });
    expect(s.productivity.avgCompletionHours).toBeGreaterThan(0);
    expect(s.topTasks.map((x: any) => x.title)).toEqual(["Overdue high", "Due today", "No date"]);
    expect(s.workload).toEqual([]);

    const team = (await api("GET", "/api/tasks/insights?scope=team&days=14")).body;
    expect(team.totals.open).toBeGreaterThanOrEqual(4);
    expect(team.topTasks.map((x: any) => x.title)).toContain("Theirs");
    expect(team.workload.find((w: any) => w.name === "Sara Finance").n).toBe(1);
  });

  it("keeps the period between a week and a month", async () => {
    expect((await api("GET", "/api/tasks/insights?days=3")).body.days).toBe(7);
    expect((await api("GET", "/api/tasks/insights?days=90")).body.days).toBe(30);
    expect((await api("GET", "/api/tasks/insights")).body.days).toBe(14);
  });
});
