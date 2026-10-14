import { describe, expect, it } from "vitest";
import { addDays, addMonths, barFor, endOfMonth, groupByDay, monthGrid, rangeFor, startOfWeek, weekDays } from "../client/src/lib/calendar-logic";

describe("calendar arithmetic", () => {
  it("steps over month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-01");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
  });

  it("finds the start of a week for Saturday-first and Sunday-first weeks", () => {
    // 2026-10-14 is a Wednesday
    expect(startOfWeek("2026-10-14", 6)).toBe("2026-10-10");
    expect(startOfWeek("2026-10-14", 0)).toBe("2026-10-11");
    expect(startOfWeek("2026-10-10", 6)).toBe("2026-10-10");
    expect(weekDays("2026-10-14", 6)).toHaveLength(7);
    expect(weekDays("2026-10-14", 6)[6]).toBe("2026-10-16");
  });

  it("builds a month grid of whole weeks that contains the month", () => {
    const g = monthGrid("2026-10-14", 6);
    expect(g.length % 7).toBe(0);
    expect(g[0]).toBe("2026-09-26");
    expect(g).toContain("2026-10-01");
    expect(g).toContain("2026-10-31");
    expect(g[g.length - 1]).toBe("2026-11-06");
    // February 2027 starting on a Monday, Sunday-first: five weeks
    expect(monthGrid("2027-02-01", 0)).toHaveLength(35);
  });

  it("groups events by day", () => {
    const by = groupByDay([{ day: "2026-10-01", id: 1 }, { day: "2026-10-01", id: 2 }, { day: "2026-10-02", id: 3 }]);
    expect(by.get("2026-10-01")).toHaveLength(2);
    expect(by.get("2026-10-03")).toBeUndefined();
  });

  it("places project bars on a timeline and clips them", () => {
    const bar = barFor("2026-10-11", "2026-10-20", "2026-10-01", "2026-10-30")!;
    expect(bar.left).toBeCloseTo((10 / 30) * 100);
    expect(bar.width).toBeCloseTo((10 / 30) * 100);
    expect(bar).toMatchObject({ startsBefore: false, endsAfter: false });
    expect(barFor("2026-09-01", "2026-10-10", "2026-10-01", "2026-10-30")).toMatchObject({ left: 0, startsBefore: true, endsAfter: false });
    expect(barFor("2026-10-25", "2026-12-01", "2026-10-01", "2026-10-30")).toMatchObject({ endsAfter: true });
    expect(barFor("2026-11-02", "2026-11-09", "2026-10-01", "2026-10-30")).toBeNull();
    expect(barFor(null, null, "2026-10-01", "2026-10-30")).toBeNull();
    expect(barFor(null, "2026-10-05", "2026-10-01", "2026-10-30")!.width).toBeCloseTo((1 / 30) * 100);
  });

  it("asks the server for exactly what the screen shows", () => {
    expect(rangeFor("week", "2026-10-14", 6)).toEqual({ from: "2026-10-10", to: "2026-10-16" });
    expect(rangeFor("timeline", "2026-10-14", 6)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    const m = rangeFor("month", "2026-10-14", 6);
    expect(m.from).toBe("2026-09-26");
    expect(m.to).toBe("2026-11-06");
  });
});
