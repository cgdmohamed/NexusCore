import { describe, expect, it } from "vitest";
import { changePct, dayKey, fillSeries, lastDays, rankTopTasks, sum, taskImportance } from "../server/task-insights";

const now = new Date("2026-10-09T10:00:00Z"); // 13:00 in Cairo
const task = (id: string, priority: string, dueDate: string | null, status = "pending") => ({ id, priority, status, dueDate: dueDate ? new Date(`${dueDate}T00:00:00Z`) : null });

describe("day buckets", () => {
  it("names the calendar day in the company's time zone", () => {
    expect(dayKey(new Date("2026-10-09T22:30:00Z"), "Africa/Cairo")).toBe("2026-10-10"); // already tomorrow in Cairo
    expect(dayKey(new Date("2026-10-09T22:30:00Z"), "UTC")).toBe("2026-10-09");
  });
  it("lists the last days oldest first, ending today", () => {
    expect(lastDays(3, now, "Africa/Cairo")).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]);
    expect(lastDays(2, new Date("2026-10-09T22:30:00Z"), "Africa/Cairo")).toEqual(["2026-10-09", "2026-10-10"]);
  });
  it("fills days without activity with zero", () => {
    expect(fillSeries(["a", "b", "c"], [{ day: "b", n: 4 }])).toEqual([0, 4, 0]);
    expect(sum([1, 2, 3])).toBe(6);
  });
  it("does not skip or repeat a day across a month boundary", () => {
    expect(lastDays(3, new Date("2026-11-01T09:00:00Z"), "Africa/Cairo")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});

describe("changePct", () => {
  it("compares with the previous period, and says nothing when it was zero", () => {
    expect(changePct(15, 10)).toBe(50);
    expect(changePct(5, 10)).toBe(-50);
    expect(changePct(3, 0)).toBeNull();
    expect(changePct(0, 0)).toBeNull();
  });
});

describe("task importance", () => {
  it("ranks overdue above due today above upcoming, with priority as the base", () => {
    const overdue = taskImportance(task("a", "medium", "2026-10-05"), now);
    const today = taskImportance(task("b", "medium", "2026-10-09"), now);
    const soon = taskImportance(task("c", "medium", "2026-10-11"), now);
    const later = taskImportance(task("d", "medium", "2026-11-20"), now);
    expect(overdue).toBeGreaterThan(today);
    expect(today).toBeGreaterThan(soon);
    expect(soon).toBeGreaterThan(later);
    expect(taskImportance(task("e", "high", null), now)).toBeGreaterThan(taskImportance(task("f", "low", null), now));
  });
  it("lets a long-overdue low priority task outrank a fresh high priority one", () => {
    expect(taskImportance(task("a", "low", "2026-09-20"), now)).toBeGreaterThan(taskImportance(task("b", "high", "2026-11-30"), now));
  });
});

describe("rankTopTasks", () => {
  it("keeps only open tasks, most important first, up to the limit", () => {
    const top = rankTopTasks([
      task("done", "high", "2026-10-01", "completed"),
      task("cancelled", "high", "2026-10-01", "cancelled"),
      task("late", "low", "2026-10-01"),
      task("today", "high", "2026-10-09"),
      task("plain", "medium", null),
    ], 2, now);
    expect(top.map((t) => t.id)).toEqual(["late", "today"]);
  });
  it("breaks ties by the nearer deadline", () => {
    const top = rankTopTasks([task("b", "medium", "2026-10-20"), task("a", "medium", "2026-10-19")], 2, now);
    expect(top[0].id).toBe("a");
  });
});
