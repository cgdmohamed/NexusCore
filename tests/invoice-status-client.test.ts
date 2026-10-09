import { describe, expect, it } from "vitest";
import { isInvoiceOverdue, isReceivable, receivableTotals } from "../client/src/lib/invoice-status";

const now = new Date("2026-10-09T15:00:00");
const inv = (status: string, amount: string, paidAmount: string, dueDate: string | null) => ({ status, amount, paidAmount, dueDate });

describe("invoice status helpers", () => {
  it("treats drafts and cancelled invoices as not receivable", () => {
    expect(isReceivable(inv("draft", "100", "0", null))).toBe(false);
    expect(isReceivable(inv("cancelled", "100", "0", null))).toBe(false);
    expect(isReceivable(inv("sent", "100", "0", null))).toBe(true);
  });

  it("is overdue from the day after the due date while something is unpaid", () => {
    expect(isInvoiceOverdue(inv("sent", "100", "0", "2026-10-08T00:00:00"), now)).toBe(true);
    expect(isInvoiceOverdue(inv("partially_paid", "100", "40", "2026-10-01T00:00:00"), now)).toBe(true);
    expect(isInvoiceOverdue(inv("sent", "100", "0", "2026-10-09T09:00:00"), now)).toBe(false);
    expect(isInvoiceOverdue(inv("sent", "100", "0", "2026-10-20T00:00:00"), now)).toBe(false);
  });

  it("is never overdue when paid, a draft, cancelled or without a due date", () => {
    expect(isInvoiceOverdue(inv("paid", "100", "100", "2026-01-01T00:00:00"), now)).toBe(false);
    expect(isInvoiceOverdue(inv("draft", "100", "0", "2026-01-01T00:00:00"), now)).toBe(false);
    expect(isInvoiceOverdue(inv("cancelled", "100", "0", "2026-01-01T00:00:00"), now)).toBe(false);
    expect(isInvoiceOverdue(inv("sent", "100", "0", null), now)).toBe(false);
  });

  it("totals only what the client was actually billed", () => {
    const totals = receivableTotals([
      inv("sent", "100", "0", null), inv("partially_paid", "200", "50", null), inv("paid", "300", "300", null),
      inv("draft", "999", "0", null), inv("cancelled", "888", "0", null),
    ]);
    expect(totals).toEqual({ billed: 600, paid: 350, outstanding: 250 });
  });
});
