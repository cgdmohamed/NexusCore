import { describe, expect, it } from "vitest";
import { projectHealth } from "../server/project-health";

const now = new Date("2026-10-09T09:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86400000);
const base = { status: "active", dueDate: null as Date | null, total: 10, completed: 4, overdueTasks: 0, now };

describe("projectHealth", () => {
  it("follows the stored status for completed, archived and on-hold projects", () => {
    for (const status of ["completed", "archived", "on_hold"]) {
      expect(projectHealth({ ...base, status, dueDate: day(-30), total: 0 })).toBe(status);
    }
  });
  it("flags an active project whose tasks are all done as ready to close", () => {
    expect(projectHealth({ ...base, total: 5, completed: 5, dueDate: day(-3) })).toBe("ready_to_close");
  });
  it("is overdue after the due date but not on the due date itself", () => {
    expect(projectHealth({ ...base, dueDate: day(-2) })).toBe("overdue");
    expect(projectHealth({ ...base, dueDate: new Date("2026-10-09T20:00:00Z") })).not.toBe("overdue");
  });
  it("is at risk with late tasks, or close to the deadline with little done", () => {
    expect(projectHealth({ ...base, overdueTasks: 1, dueDate: day(60) })).toBe("at_risk");
    expect(projectHealth({ ...base, dueDate: day(5), completed: 3 })).toBe("at_risk");
    expect(projectHealth({ ...base, dueDate: day(5), completed: 9 })).toBe("on_track");
  });
  it("tells a project with no tasks apart from a stalled one", () => {
    expect(projectHealth({ ...base, total: 0, completed: 0 })).toBe("no_tasks");
    expect(projectHealth({ ...base, total: 0, completed: 0, dueDate: day(-1) })).toBe("overdue");
  });
  it("is on track otherwise", () => {
    expect(projectHealth({ ...base, dueDate: day(40) })).toBe("on_track");
  });
});
