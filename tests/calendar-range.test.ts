import { describe, expect, it } from "vitest";
import { MAX_RANGE_DAYS, parseRange } from "../server/calendar";

describe("parseRange", () => {
  it("accepts a month grid and returns the same days", () => {
    expect(parseRange("2026-10-01", "2026-11-11")).toEqual({ from: "2026-10-01", to: "2026-11-11" });
  });
  it("accepts a single day", () => {
    expect(parseRange("2026-10-13", "2026-10-13")).toEqual({ from: "2026-10-13", to: "2026-10-13" });
  });
  it("rejects missing, malformed and impossible dates", () => {
    for (const [a, b] of [[undefined, "2026-10-01"], ["2026-10-01", undefined], ["10/01/2026", "2026-10-02"], ["2026-13-40", "2026-10-02"], ["2026-10-01;drop", "2026-10-02"]]) {
      expect("error" in parseRange(a, b)).toBe(true);
    }
  });
  it("rejects a range that runs backwards or is too long", () => {
    expect("error" in parseRange("2026-10-05", "2026-10-01")).toBe(true);
    expect("error" in parseRange("2026-01-01", "2026-12-31")).toBe(true);
    const edge = new Date(Date.parse("2026-01-01T00:00:00Z") + (MAX_RANGE_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
    expect("error" in parseRange("2026-01-01", edge)).toBe(false);
  });
});
