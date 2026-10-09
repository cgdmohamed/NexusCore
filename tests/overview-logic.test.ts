import { describe, expect, it } from "vitest";
import { dueInfo, durationLabel, greetingFor, receivablesSnapshot } from "../client/src/mobile/overview-logic";

describe("greetingFor", () => {
  it("follows the hour of the day", () => {
    expect(greetingFor(6)).toBe("morning");
    expect(greetingFor(12)).toBe("afternoon");
    expect(greetingFor(17)).toBe("afternoon");
    expect(greetingFor(18)).toBe("evening");
    expect(greetingFor(23)).toBe("evening");
  });
});

describe("dueInfo", () => {
  const now = new Date(2026, 9, 9, 13, 0); // 9 Oct 2026, local
  it("reads the stored calendar day", () => {
    expect(dueInfo("2026-10-06T00:00:00.000Z", now)).toEqual({ kind: "overdue", days: 3 });
    expect(dueInfo("2026-10-09T00:00:00.000Z", now)).toEqual({ kind: "today", days: 0 });
    expect(dueInfo("2026-10-11T00:00:00.000Z", now)).toEqual({ kind: "soon", days: 2 });
    expect(dueInfo("2026-10-30T00:00:00.000Z", now)).toEqual({ kind: "later", days: 21 });
    expect(dueInfo(null, now)).toEqual({ kind: "none", days: 0 });
  });
});

describe("durationLabel", () => {
  it("switches from hours to days at a day", () => {
    expect(durationLabel(5.26)).toEqual({ value: 5.3, unit: "hours" });
    expect(durationLabel(36)).toEqual({ value: 1.5, unit: "days" });
    expect(durationLabel(null)).toBeNull();
  });
});

describe("receivablesSnapshot", () => {
  it("adds up what is still owed and how much of it is late, ignoring drafts and cancelled invoices", () => {
    const now = new Date(2026, 9, 9);
    const snap = receivablesSnapshot([
      { status: "sent", amount: "1000", paidAmount: "0", dueDate: "2026-10-01T00:00:00Z" },
      { status: "partially_paid", amount: "500", paidAmount: "200", dueDate: "2026-10-30T00:00:00Z" },
      { status: "paid", amount: "300", paidAmount: "300", dueDate: "2026-09-01T00:00:00Z" },
      { status: "draft", amount: "999", paidAmount: "0", dueDate: "2026-01-01T00:00:00Z" },
      { status: "cancelled", amount: "888", paidAmount: "0", dueDate: "2026-01-01T00:00:00Z" },
    ], now);
    expect(snap).toEqual({ outstanding: 1300, overdue: 1000, overdueCount: 1 });
  });
});
