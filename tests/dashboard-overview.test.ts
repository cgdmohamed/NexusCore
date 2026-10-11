import { describe, it, expect } from "vitest";
import { ageBucket, bucketAging, fillMonths, lastMonths } from "../server/dashboard-overview";

const now = new Date("2026-10-11T09:00:00Z");
const tz = "UTC";
const due = (iso: string) => new Date(`${iso}T00:00:00Z`);
const inv = (over: Partial<Parameters<typeof bucketAging>[0][number]>) => ({
  clientId: "c1", clientName: "Acme", status: "sent", amount: "1000", paidAmount: "0", dueDate: due("2026-10-01"), ...over,
});

describe("ageBucket", () => {
  it("puts the boundaries in the right bucket", () => {
    expect(ageBucket(-5)).toBe("notDue");
    expect(ageBucket(0)).toBe("notDue");
    expect(ageBucket(1)).toBe("d1_30");
    expect(ageBucket(30)).toBe("d1_30");
    expect(ageBucket(31)).toBe("d31_60");
    expect(ageBucket(60)).toBe("d31_60");
    expect(ageBucket(61)).toBe("d61_90");
    expect(ageBucket(90)).toBe("d61_90");
    expect(ageBucket(91)).toBe("d90plus");
  });
});

describe("bucketAging", () => {
  it("counts only what is still owed on issued invoices", () => {
    const r = bucketAging([
      inv({ dueDate: due("2026-10-01") }),                       // 10 days late, 1000
      inv({ amount: "500", paidAmount: "200", dueDate: due("2026-08-01") }), // 71 days late, 300 left
      inv({ dueDate: due("2026-10-20") }),                       // not due yet
      inv({ status: "draft" }),
      inv({ status: "cancelled" }),
      inv({ status: "paid", paidAmount: "1000" }),
      inv({ dueDate: null }),                                    // no due date: not due
    ], now, tz);
    expect(r.buckets.d1_30).toEqual({ count: 1, amount: 1000 });
    expect(r.buckets.d61_90).toEqual({ count: 1, amount: 300 });
    expect(r.buckets.notDue).toEqual({ count: 2, amount: 2000 });
    expect(r.total).toBe(3300);
    expect(r.overdueCount).toBe(2);
    expect(r.overdueAmount).toBe(1300);
  });

  it("ranks the biggest debtors with their oldest delay", () => {
    const r = bucketAging([
      inv({ clientId: "a", clientName: "Small", amount: "100" }),
      inv({ clientId: "b", clientName: "Big", amount: "900", dueDate: due("2026-07-01") }),
      inv({ clientId: "b", clientName: "Big", amount: "400", dueDate: due("2026-10-05") }),
    ], now, tz, 2);
    expect(r.topDebtors).toHaveLength(2);
    expect(r.topDebtors[0]).toEqual({ clientId: "b", name: "Big", outstanding: 1300, oldestDaysPastDue: 102 });
    expect(r.topDebtors[1].name).toBe("Small");
  });

  it("is empty with nothing owed", () => {
    const r = bucketAging([], now, tz);
    expect(r.total).toBe(0);
    expect(r.topDebtors).toEqual([]);
  });
});

describe("month series", () => {
  it("lists the last months across a year boundary", () => {
    expect(lastMonths(4, new Date("2026-02-10T00:00:00Z"), tz)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(lastMonths(1, now, tz)).toEqual(["2026-10"]);
  });

  it("fills missing months with zeros and computes the net", () => {
    const out = fillMonths(["2026-08", "2026-09", "2026-10"], [
      { month: "2026-09", collected: "1500.5", spent: "400" },
      { month: "2026-10", collected: 200 },
    ]);
    expect(out).toEqual([
      { month: "2026-08", collected: 0, spent: 0, net: 0 },
      { month: "2026-09", collected: 1500.5, spent: 400, net: 1100.5 },
      { month: "2026-10", collected: 200, spent: 0, net: 200 },
    ]);
  });
});
