import { describe, it, expect } from "vitest";
import { buildBurndown, MAX_DAYS } from "../server/burndown";

const d = (s: string) => new Date(`${s}T10:00:00Z`);
const tz = "UTC";

describe("buildBurndown", () => {
  it("returns null for a project without tasks", () => {
    expect(buildBurndown({ tasks: [], startDate: d("2026-10-01"), dueDate: d("2026-10-11") }, d("2026-10-05"), tz)).toBeNull();
    expect(buildBurndown({ tasks: [{ createdAt: d("2026-10-01"), completedDate: null, status: "cancelled" }], startDate: d("2026-10-01"), dueDate: d("2026-10-11") }, d("2026-10-05"), tz)).toBeNull();
  });

  it("draws a straight ideal line and counts what is still open each day", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      createdAt: d("2026-10-01"),
      completedDate: i < 3 ? d("2026-10-03") : null,
      status: i < 3 ? "completed" : "pending",
    }));
    const b = buildBurndown({ tasks, startDate: d("2026-10-01"), dueDate: d("2026-10-11") }, d("2026-10-05"), tz)!;
    expect(b.points).toHaveLength(11);
    expect(b.points[0]).toMatchObject({ date: "2026-10-01", ideal: 10, remaining: 10 });
    expect(b.points[10]).toMatchObject({ date: "2026-10-11", ideal: 0, remaining: null });
    expect(b.points[2].remaining).toBe(7);
    expect(b.points[5].remaining).toBeNull();
    expect(b.remaining).toBe(7);
    expect(b.daysLeft).toBe(6);
    // Four days into a ten-day plan the line expects 6 left; 7 are left
    expect(b.behindBy).toBe(1);
  });

  it("lets scope grow when tasks are added later", () => {
    const tasks = [
      { createdAt: d("2026-10-01"), completedDate: null, status: "pending" },
      { createdAt: d("2026-10-04"), completedDate: null, status: "pending" },
    ];
    const b = buildBurndown({ tasks, startDate: d("2026-10-01"), dueDate: d("2026-10-05") }, d("2026-10-04"), tz)!;
    expect(b.points[0].remaining).toBe(1);
    expect(b.points[3].remaining).toBe(2);
  });

  it("keeps drawing to today when the deadline has passed", () => {
    const tasks = [{ createdAt: d("2026-10-01"), completedDate: null, status: "in_progress" }];
    const b = buildBurndown({ tasks, startDate: d("2026-10-01"), dueDate: d("2026-10-03") }, d("2026-10-06"), tz)!;
    expect(b.points.at(-1)).toMatchObject({ date: "2026-10-06", ideal: 0, remaining: 1 });
    expect(b.daysLeft).toBe(-3);
    expect(b.behindBy).toBe(1);
  });

  it("limits long projects to their final stretch", () => {
    const tasks = [{ createdAt: d("2026-01-01"), completedDate: null, status: "pending" }];
    const b = buildBurndown({ tasks, startDate: d("2026-01-01"), dueDate: d("2026-12-31") }, d("2026-12-01"), tz)!;
    expect(b.points).toHaveLength(MAX_DAYS);
    expect(b.points.at(-1)!.date).toBe("2026-12-31");
  });
});
