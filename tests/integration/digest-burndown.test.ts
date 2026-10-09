import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";
import { dayKey } from "../../server/task-insights";

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!TEST_DATABASE_URL)("morning digest and project burndown (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  const dueOn = (offsetDays: number) => new Date(`${dayKey(new Date(Date.now() + offsetDays * DAY), "Africa/Cairo")}T00:00:00Z`);
  const ago = (days: number) => new Date(Date.now() - days * DAY);

  it("sends each person one digest per day, however many workers run it", async () => {
    const { tasks, notifications } = await import("../../shared/schema");
    const { runDailyDigest, runDigestMigrations } = await import("../../server/daily-digest");
    const me = ctx.currentUserId;
    await runDigestMigrations(); // idempotent on a database that already has the objects
    const t = (extra: object) => ({ title: "t", assignedTo: me, createdBy: me, ...extra }) as any;
    await ctx.db.insert(tasks).values([
      t({ status: "pending", dueDate: dueOn(0) }),
      t({ status: "in_progress", dueDate: dueOn(0) }),
      t({ status: "pending", dueDate: dueOn(-2) }),
      t({ status: "completed", dueDate: dueOn(-2), completedDate: new Date() }),
      t({ status: "pending", dueDate: dueOn(3) }),
    ]);

    const [a, b] = await Promise.all([runDailyDigest(), runDailyDigest()]);
    expect(a.sent + b.sent).toBe(1);

    const rows = (await ctx.db.select().from(notifications)).filter((n: any) => n.type === "daily_digest");
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe("مهمتان مستحقتان اليوم ومهمة واحدة متأخرة");
    expect(rows[0].entityUrl).toBe("/tasks");

    expect((await runDailyDigest()).sent).toBe(0);
  });

  it("returns the burndown of the open project with the nearest deadline", async () => {
    const { projects, tasks } = await import("../../shared/schema");
    const me = ctx.currentUserId;
    const [far] = await ctx.db.insert(projects).values({ name: "Far", dueDate: dueOn(30), startDate: ago(5) } as any).returning();
    const [near] = await ctx.db.insert(projects).values({ name: "Near", dueDate: dueOn(4), startDate: ago(6) } as any).returning();
    await ctx.db.insert(projects).values({ name: "Done", dueDate: dueOn(1), completedAt: new Date() } as any);
    await ctx.db.insert(projects).values({ name: "Empty", dueDate: dueOn(2) } as any);
    const t = (extra: object) => ({ title: "t", assignedTo: me, createdBy: me, ...extra }) as any;
    await ctx.db.insert(tasks).values([
      t({ projectId: far.id, status: "pending", createdAt: ago(5) }),
      t({ projectId: near.id, status: "completed", createdAt: ago(6), completedDate: ago(1) }),
      t({ projectId: near.id, status: "pending", createdAt: ago(6) }),
      t({ projectId: near.id, status: "pending", createdAt: ago(6) }),
    ]);

    const res = await ctx.api("GET", "/api/projects/burndown/nearest");
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe("Near");
    const b = res.body.burndown;
    expect(b.total).toBe(3);
    expect(b.remaining).toBe(2);
    expect(b.daysLeft).toBe(4);
    expect(b.points[0].remaining).toBe(3);
    expect(b.points.at(-1).ideal).toBe(0);
  });
});
