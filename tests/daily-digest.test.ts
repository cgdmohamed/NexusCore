import { describe, it, expect } from "vitest";
import { buildDigestProjects, buildDigestSections, buildDigest, isDigestTime, localHour } from "../server/daily-digest";

describe("morning digest", () => {
  it("says nothing on an empty day", () => {
    expect(buildDigest({ dueToday: 0, overdue: 0 }, "ar")).toBeNull();
    expect(buildDigest({ dueToday: 0, overdue: 0 }, "en")).toBeNull();
  });

  it("formats Arabic counts with the correct noun forms", () => {
    expect(buildDigest({ dueToday: 1, overdue: 0 }, "ar")!.message).toBe("مهمة واحدة مستحقة اليوم");
    expect(buildDigest({ dueToday: 2, overdue: 0 }, "ar")!.message).toBe("مهمتان مستحقتان اليوم");
    expect(buildDigest({ dueToday: 3, overdue: 1 }, "ar")!.message).toBe("٣ مهام مستحقة اليوم ومهمة واحدة متأخرة");
    expect(buildDigest({ dueToday: 0, overdue: 12 }, "ar")!.message).toBe("١٢ مهمة متأخرة");
  });

  it("formats English counts", () => {
    expect(buildDigest({ dueToday: 3, overdue: 1 }, "en")!.message).toBe("3 tasks due today and 1 overdue");
    expect(buildDigest({ dueToday: 1, overdue: 0 }, "en")!.message).toBe("1 task due today");
  });

  it("sends only in the morning window of the company's time zone", () => {
    const tz = "Africa/Cairo";
    // Cairo is UTC+3 in summer (DST) and UTC+2 in winter
    expect(localHour(new Date("2026-07-01T05:00:00Z"), tz)).toBe(8);
    expect(isDigestTime(new Date("2026-07-01T04:59:00Z"), tz, 8)).toBe(false);
    expect(isDigestTime(new Date("2026-07-01T05:00:00Z"), tz, 8)).toBe(true);
    expect(isDigestTime(new Date("2026-07-01T08:59:00Z"), tz, 8)).toBe(true);
    expect(isDigestTime(new Date("2026-07-01T09:00:00Z"), tz, 8)).toBe(false);
    expect(localHour(new Date("2026-01-15T06:00:00Z"), tz)).toBe(8);
  });
});

describe("evening digest", () => {
  it("says nothing when there is nothing to report", async () => {
    const { buildEveningDigest } = await import("../server/daily-digest");
    expect(buildEveningDigest({ completed: 0, remaining: 0 }, "ar")).toBeNull();
  });

  it("formats finished and remaining counts", async () => {
    const { buildEveningDigest } = await import("../server/daily-digest");
    expect(buildEveningDigest({ completed: 3, remaining: 2 }, "ar")!.message).toBe("أُنجزت ٣ مهام اليوم وتبقّت مهمتان");
    expect(buildEveningDigest({ completed: 0, remaining: 1 }, "ar")!.message).toBe("تبقّت مهمة واحدة");
    expect(buildEveningDigest({ completed: 1, remaining: 0 }, "ar")!.message).toBe("أُنجزت مهمة واحدة اليوم");
    expect(buildEveningDigest({ completed: 4, remaining: 2 }, "en")!.message).toBe("4 tasks completed today and 2 still open");
  });
});

describe("digest preferences", () => {
  it("lets a person override only what they set", async () => {
    const { mergePrefs, DEFAULT_PREFS } = await import("../server/digest-settings");
    const company = { ...DEFAULT_PREFS, eveningHour: 18 };
    expect(mergePrefs(company, null)).toEqual(company);
    expect(mergePrefs(company, { eveningHour: null, morningEnabled: false, morningHour: 9 })).toEqual({ morningEnabled: false, morningHour: 9, eveningEnabled: true, eveningHour: 18 });
    expect(mergePrefs(company, { morningHour: 99 }).morningHour).toBe(6);
  });
});

describe("buildDigestSections", () => {
  const row = (section: any, title: string, extra: object = {}) => ({ section, title, total: 1, ...extra });

  it("lists late work first, with how late, and skips empty sections", () => {
    const out = buildDigestSections(
      [row("due", "B", { project: "P" }), row("late", "A", { dueDay: "2026-10-10" })],
      "2026-10-13",
      "ar",
    );
    expect(out.map((s) => s.key)).toEqual(["late", "due"]);
    expect(out[0].heading).toBe("متأخرة");
    expect(out[0].items[0]).toEqual({ title: "A", meta: "متأخرة ٣ أيام" });
    expect(out[1].items[0]).toEqual({ title: "B", meta: "P" });
  });

  it("caps the list and reports how many were left out", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row("due", `T${i}`, { total: 15 }));
    const [sec] = buildDigestSections(rows, "2026-10-13", "en");
    expect(sec.items).toHaveLength(10);
    expect(sec.more).toBe(5);
    expect(sec.heading).toBe("Due today");
  });
});

describe("buildDigestProjects", () => {
  const now = new Date("2026-10-13T08:00:00Z");
  const row = (name: string, total: number, completed: number, extra: object = {}) => ({ name, dueDate: null, total, completed, overdue: 0, doneToday: 0, ...extra });

  it("computes the percentage from done over all non-cancelled tasks and names the state in Arabic", () => {
    const { projects } = buildDigestProjects([row("A", 10, 6)], "ar", now);
    expect(projects[0]).toMatchObject({ pct: 60, completed: 6, total: 10, health: "on_track", healthLabel: "على المسار" });
  });

  it("handles a project with no tasks and one that is finished", () => {
    const { projects } = buildDigestProjects([row("Empty", 0, 0), row("Done", 4, 4)], "en", now);
    expect(projects.find((p) => p.name === "Empty")).toMatchObject({ pct: 0, health: "no_tasks" });
    expect(projects.find((p) => p.name === "Done")).toMatchObject({ pct: 100, health: "ready_to_close", healthLabel: "Ready to close" });
  });

  it("puts the late and at-risk projects first, then the least finished", () => {
    const { projects } = buildDigestProjects(
      [row("Calm 90", 10, 9), row("Calm 20", 10, 2), row("Late task", 10, 5, { overdue: 2 }), row("Past due", 10, 5, { dueDate: new Date("2026-10-01T00:00:00Z") })],
      "en", now);
    expect(projects.map((p) => p.name)).toEqual(["Past due", "Late task", "Calm 20", "Calm 90"]);
  });

  it("caps the list and counts what was left out", () => {
    const rows = Array.from({ length: 11 }, (_, i) => row(`P${i}`, 10, i));
    const out = buildDigestProjects(rows, "en", now);
    expect(out.projects).toHaveLength(8);
    expect(out.more).toBe(3);
  });
});
