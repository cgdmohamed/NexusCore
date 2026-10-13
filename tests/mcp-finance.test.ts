import { describe, expect, it } from "vitest";
import { invoiceTotals, quotationItemTotal } from "../server/mcp/tools-finance";

describe("quotation and invoice totals", () => {
  it("applies a line discount to a quotation item", () => {
    expect(quotationItemTotal(2, 100)).toBe(200);
    expect(quotationItemTotal(3, 99.99, 10)).toBe(269.97);
    expect(quotationItemTotal(1, 0, 50)).toBe(0);
  });

  it("takes tax and discount on the subtotal, like the app's recalculation", () => {
    expect(invoiceTotals([1000, 500], 14, 10)).toEqual({ subtotal: 1500, taxAmount: 210, discountAmount: 150, amount: 1560 });
    expect(invoiceTotals([100.55], 0, 0)).toEqual({ subtotal: 100.55, taxAmount: 0, discountAmount: 0, amount: 100.55 });
    expect(invoiceTotals([])).toEqual({ subtotal: 0, taxAmount: 0, discountAmount: 0, amount: 0 });
  });
});
