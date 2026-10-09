import { describe, expect, it } from "vitest";
import { formatCurrency } from "../client/src/lib/currency";

describe("formatCurrency", () => {
  it("appends the currency symbol", () => {
    expect(formatCurrency(1500)).toMatch(/1.?500\u00A0ج\.م$/);
  });

  it("shows two decimals only when needed", () => {
    expect(formatCurrency(10)).toBe("10\u00A0ج.م");
    expect(formatCurrency(10.5)).toBe("10.50\u00A0ج.م");
  });

  it("treats invalid strings as zero", () => {
    expect(formatCurrency("abc")).toBe("0\u00A0ج.م");
  });
});
