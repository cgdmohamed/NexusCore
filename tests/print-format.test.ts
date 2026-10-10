import { describe, it, expect } from "vitest";
import { formatDisplay, isIncludedItem, snapshotCompany, statusStyle, STATUS_STYLES } from "../client/src/lib/print-format";

describe("print formatting", () => {
  it("writes amounts with the currency symbol in the usual place", () => {
    expect(formatDisplay(1234.5, "USD")).toBe("$1,234.50");
    expect(formatDisplay(1234.5, "SAR")).toBe("1,234.50 ر.س");
    expect(formatDisplay(0, "EGP")).toBe("0.00 ج.م");
  });

  it("shows unpriced items as included", () => {
    expect(isIncludedItem({ isIncluded: true })).toBe(true);
    expect(isIncludedItem({ displayUnitPrice: "0", displayTotalPrice: "0.00", discount: "0" })).toBe(true);
    expect(isIncludedItem({ displayUnitPrice: "5", displayTotalPrice: "5", discount: "0" })).toBe(false);
    expect(isIncludedItem({ displayUnitPrice: "0", displayTotalPrice: "0", discount: "100" })).toBe(false);
  });

  it("reads the company from new and old snapshots", () => {
    expect(snapshotCompany({ company: { name: "Acme", vatNumber: "1" } })).toEqual({ name: "Acme", vatNumber: "1" });
    expect(snapshotCompany({ companyName: "Old", companyPhone: "123" })).toMatchObject({ name: "Old", phone: "123" });
    expect(snapshotCompany({}).name).toBeTruthy();
  });

  it("has a style for every status used by invoices and quotations", () => {
    for (const s of ["paid", "partially_paid", "sent", "draft", "overdue", "cancelled", "refunded", "partially_refunded", "accepted", "rejected", "expired", "invoiced"]) {
      expect(STATUS_STYLES[s]).toBeTruthy();
    }
    expect(statusStyle("nonsense")).toBe(STATUS_STYLES.draft);
  });
});
