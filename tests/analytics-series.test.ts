import { describe, it, expect } from "vitest";
import { alignToQuarters, buildSeries, monthRange, quarterOf, summarizeSeries, trailingMonths } from "../server/analytics-series";

describe("monthRange", () => {
  it("lists every month, across a year boundary", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("keeps only the newest months when the range is longer than the cap", () => {
    expect(monthRange("2020-01", "2026-03", 3)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
});

describe("trailingMonths", () => {
  const now = new Date("2026-10-18T10:00:00Z");
  it("ends at the current month and defaults to 12", () => {
    const m = trailingMonths(12, now, "UTC");
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-11");
    expect(m.at(-1)).toBe("2026-10");
  });
  it("clamps to 3..36", () => {
    expect(trailingMonths(1, now, "UTC")).toHaveLength(3);
    expect(trailingMonths(99, now, "UTC")).toHaveLength(36);
  });
});

describe("buildSeries", () => {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04"];
  it("fills months without money with zeros and turns numeric strings into numbers", () => {
    const s = buildSeries(months, { "2026-01": "1000.50", "2026-04": 250 }, { "2026-02": "400" });
    expect(s).toEqual([
      { period: "2026-01", collected: 1000.5, spent: 0, net: 1000.5 },
      { period: "2026-02", collected: 0, spent: 400, net: -400 },
      { period: "2026-03", collected: 0, spent: 0, net: 0 },
      { period: "2026-04", collected: 250, spent: 0, net: 250 },
    ]);
  });
  it("sums whole quarters and widens a window that starts mid-quarter", () => {
    expect(alignToQuarters(["2026-02", "2026-03", "2026-04"])).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    const s = buildSeries(["2026-02", "2026-03", "2026-04"], { "2026-01": 100, "2026-02": 100, "2026-03": 100, "2026-04": 50 }, { "2026-04": 20 }, "quarter");
    expect(s).toEqual([
      { period: "2026-Q1", collected: 300, spent: 0, net: 300 },
      { period: "2026-Q2", collected: 50, spent: 20, net: 30 },
    ]);
    expect(quarterOf("2026-12")).toBe("2026-Q4");
  });
});

describe("summarizeSeries", () => {
  it("totals, averages over every period (zeros included) and finds the best month", () => {
    const s = summarizeSeries(buildSeries(["2026-01", "2026-02", "2026-03"], { "2026-01": 300, "2026-03": 900 }, { "2026-02": 150 }));
    expect(s).toMatchObject({ collected: 1200, spent: 150, net: 1050, averageCollected: 400, averageSpent: 50, bestPeriod: { period: "2026-03", collected: 900 } });
  });
  it("has no best period when nothing was collected", () => {
    expect(summarizeSeries(buildSeries(["2026-01"], {}, {})).bestPeriod).toBeNull();
  });
});
