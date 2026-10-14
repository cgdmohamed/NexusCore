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
  // A moment today (UTC clock) that falls inside the morning (06:00) or evening (17:00) window in Cairo, winter and summer
  const at = (hhmm: string) => new Date(`${dayKey(new Date(), "Africa/Cairo")}T${hhmm}:00Z`);
  const ago = (days: number) => new Date(Date.now() - days * DAY);

  it("sends each person one digest per day, however many workers run it", async () => {
    const { tasks, notifications } = await import("../../shared/schema");
    const { runDailyDigest, runDigestMigrations } = await import("../../server/daily-digest");
    const { notificationService } = await import("../../server/notification-service");
    const sent: any[] = [];
    const spy = vi.spyOn(notificationService as any, "sendEmail").mockImplementation(async (p: any) => { sent.push(p); });
    const me = ctx.currentUserId;
    await runDigestMigrations(); // idempotent on a database that already has the objects
    const t = (extra: object) => ({ title: "t", assignedTo: me, createdBy: me, ...extra }) as any;
    await ctx.db.insert(tasks).values([
      t({ title: "Due A", status: "pending", dueDate: dueOn(0) }),
      t({ title: "Due B", status: "in_progress", dueDate: dueOn(0) }),
      t({ title: "Late C", status: "pending", dueDate: dueOn(-2) }),
      t({ title: "Done D", status: "completed", dueDate: dueOn(-2), completedDate: new Date() }),
      t({ title: "Future E", status: "pending", dueDate: dueOn(3) }),
    ]);

    const [a, b] = await Promise.all([runDailyDigest(at("06:30")), runDailyDigest(at("06:30"))]);
    expect(a.sent + b.sent).toBe(1);

    const rows = (await ctx.db.select().from(notifications)).filter((n: any) => n.type === "daily_digest");
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe("مهمتان مستحقتان اليوم ومهمة واحدة متأخرة");
    expect(rows[0].entityUrl).toBe("/tasks");

    // The notification carries the tasks themselves, late first, and nothing that is not due or late
    const meta = typeof rows[0].metadata === "string" ? JSON.parse(rows[0].metadata) : (rows[0].metadata as any);
    expect(meta.lang).toBe("ar");
    expect(meta.sections.map((x: any) => x.key)).toEqual(["late", "due"]);
    expect(meta.sections[0].items.map((i: any) => i.title)).toEqual(["Late C"]);
    expect(meta.sections[0].items[0].meta).toContain("متأخرة يومين");
    expect(meta.sections[1].items.map((i: any) => i.title).sort()).toEqual(["Due A", "Due B"]);

    // ...and so does the email, in the digest's language
    const mail = sent.find((m) => m.subject === rows[0].title);
    expect(mail).toBeTruthy();
    for (const title of ["Late C", "Due A", "Due B"]) expect(mail.bodyHtml).toContain(title);
    expect(mail.bodyHtml).not.toContain("Future E");
    expect(mail.bodyHtml).toContain('dir="rtl"');
    expect(mail.bodyHtml).toContain("وصلك هذا الإشعار");
    expect(mail.bodyText).toContain("- Late C");
    spy.mockRestore();

    expect((await runDailyDigest(at("06:30"))).sent).toBe(0);
  });

  it("sends the evening summary of finished and still-open work, and respects switches and hours", async () => {
    const { tasks, notifications } = await import("../../shared/schema");
    const { runDailyDigest } = await import("../../server/daily-digest");
    const me = ctx.currentUserId;
    await ctx.db.delete(tasks);
    const { sql } = await import("drizzle-orm");
    await ctx.db.execute(sql`DELETE FROM notification_logs`);
    await ctx.db.delete(notifications);
    await ctx.db.execute(sql`DELETE FROM digest_log`);
    const t = (extra: object) => ({ title: "t", assignedTo: me, createdBy: me, ...extra }) as any;
    await ctx.db.insert(tasks).values([
      t({ status: "completed", dueDate: dueOn(0), completedDate: at("12:00") }),
      t({ status: "completed", dueDate: dueOn(-1), completedDate: at("12:30") }),
      t({ status: "completed", dueDate: dueOn(-3), completedDate: ago(2) }), // finished earlier, not counted
      t({ status: "pending", dueDate: dueOn(0) }),
      t({ status: "in_progress", dueDate: dueOn(-1) }),
      t({ status: "pending", dueDate: dueOn(4) }), // not due yet, not counted
    ]);

    // Not yet 17:00: nothing goes out
    expect((await runDailyDigest(at("12:00"), "Africa/Cairo", "evening")).sent).toBe(0);

    // This person switches the evening summary off
    expect((await ctx.api("PUT", "/api/settings/digest/me", { morningEnabled: null, morningHour: null, eveningEnabled: false, eveningHour: null })).status).toBe(200);
    expect((await runDailyDigest(at("15:30"), "Africa/Cairo", "evening")).sent).toBe(0);

    // Back on, but the company moves it to 21:00 and then to 17:00 again
    await ctx.api("PUT", "/api/settings/digest/me", { morningEnabled: null, morningHour: null, eveningEnabled: null, eveningHour: null });
    expect((await ctx.api("PUT", "/api/settings/digest/company", { morningEnabled: true, morningHour: 6, eveningEnabled: true, eveningHour: 22 })).status).toBe(200);
    expect((await runDailyDigest(at("15:30"), "Africa/Cairo", "evening")).sent).toBe(0);
    await ctx.api("PUT", "/api/settings/digest/company", { morningEnabled: true, morningHour: 6, eveningEnabled: true, eveningHour: 17 });

    const sent = await runDailyDigest(at("15:30"), "Africa/Cairo", "evening");
    expect(sent.sent).toBe(1);
    expect((await runDailyDigest(at("15:30"), "Africa/Cairo", "evening")).sent).toBe(0); // once per day

    const rows = (await ctx.db.select().from(notifications)).filter((n: any) => n.type === "daily_digest");
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe("أُنجزت مهمتان اليوم وتبقّت مهمتان");
    expect((rows[0].metadata as any).kind).toBe("evening");

    // The morning summary still goes out the same day (its own ledger key)
    expect((await runDailyDigest(at("06:30"))).sent).toBe(1);
  });

  it("still sends today's summaries when the server was not running at the usual hour", async () => {
    const { tasks, notifications } = await import("../../shared/schema");
    const { runDailyDigest } = await import("../../server/daily-digest");
    const { sql } = await import("drizzle-orm");
    const me = ctx.currentUserId;
    await ctx.db.delete(tasks);
    await ctx.db.execute(sql`DELETE FROM notification_logs`);
    await ctx.db.delete(notifications);
    await ctx.db.execute(sql`DELETE FROM digest_log`);
    await ctx.db.insert(tasks).values({ title: "t", assignedTo: me, createdBy: me, status: "pending", dueDate: dueOn(0) } as any);

    // Before 06:00 nothing; at 14:00-15:00 UTC (late afternoon in Cairo) the morning summary is still owed, once
    expect((await runDailyDigest(at("02:00"))).sent).toBe(0);
    expect((await runDailyDigest(at("11:00"))).sent).toBe(1);
    expect((await runDailyDigest(at("11:30"))).sent).toBe(0);
    // Once the evening one is due the morning one is no longer sent, and the evening one goes out even late at night
    await ctx.db.execute(sql`DELETE FROM digest_log`);
    expect((await runDailyDigest(at("15:30"))).sent).toBe(0);
    expect((await runDailyDigest(at("19:30"), "Africa/Cairo", "evening")).sent).toBe(1);
  });

  it("lets only an administrator change the company defaults, and validates hours", async () => {
    const got = (await ctx.api("GET", "/api/settings/digest")).body;
    expect(got.effective).toEqual({ morningEnabled: true, morningHour: 6, eveningEnabled: true, eveningHour: 17 });
    expect(got.canEditCompany).toBe(true);
    expect((await ctx.api("PUT", "/api/settings/digest/me", { morningEnabled: null, morningHour: 24, eveningEnabled: null, eveningHour: null })).status).toBe(400);
    ctx.actAs({ roleName: "Staff" });
    try {
      expect((await ctx.api("PUT", "/api/settings/digest/company", { morningEnabled: false, morningHour: 6, eveningEnabled: false, eveningHour: 17 })).status).toBe(403);
      expect((await ctx.api("GET", "/api/settings/digest")).body.canEditCompany).toBe(false);
    } finally { ctx.actAs(null); }
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
