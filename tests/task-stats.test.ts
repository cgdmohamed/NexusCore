import { describe, expect, it } from "vitest";
import { activeTeamSize, completionRate, openTasks } from "../client/src/lib/task-stats";

describe("activeTeamSize", () => {
  it("leaves out terminated and inactive employees but keeps people on leave", () => {
    expect(activeTeamSize([{ status: "active" }, { status: "terminated" }, { status: "inactive" }, { status: "on_leave" }, { status: "active" }])).toBe(3);
  });
  it("counts an employee with no status as active and copes with no data", () => {
    expect(activeTeamSize([{}, { status: null }])).toBe(2);
    expect(activeTeamSize(undefined)).toBe(0);
  });
});

describe("task figures", () => {
  const stats = { totalTasks: 12, statusBreakdown: { pending: 3, in_progress: 2, completed: 5, cancelled: 2 } };
  it("counts open tasks as pending plus in progress", () => {
    expect(openTasks(stats)).toBe(5);
    expect(openTasks(undefined)).toBe(0);
  });
  it("leaves cancelled tasks out of the completion rate", () => {
    expect(completionRate(stats)).toBe(50); // 5 of 10
    expect(completionRate({ totalTasks: 2, statusBreakdown: { cancelled: 2 } })).toBe(0);
    expect(completionRate(undefined)).toBe(0);
  });
});
