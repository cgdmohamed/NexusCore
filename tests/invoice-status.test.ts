import { describe, expect, it } from "vitest";
import { checkManualStatusChange } from "../server/invoice-status";

const inv = (status: string, paidAmount = "0.00") => ({ status, paidAmount });

describe("checkManualStatusChange", () => {
  it("lets a draft be issued and an unpaid sent invoice go back to draft", () => {
    expect(checkManualStatusChange({ current: inv("draft"), target: "sent", paymentCount: 0 })).toEqual({ ok: true, status: "sent" });
    expect(checkManualStatusChange({ current: inv("sent"), target: "draft", paymentCount: 0 })).toEqual({ ok: true, status: "draft" });
  });
  it("refuses statuses that only payments, refunds or cancelling may set", () => {
    for (const target of ["paid", "partially_paid", "refunded", "partially_refunded", "overdue", "nonsense", 7, undefined]) {
      const r = checkManualStatusChange({ current: inv("sent"), target, paymentCount: 0 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.httpStatus).toBe(400);
    }
    const cancel = checkManualStatusChange({ current: inv("sent"), target: "cancelled", paymentCount: 0 });
    expect(cancel.ok === false && cancel.message).toMatch(/cancel action/);
  });
  it("never changes a cancelled invoice", () => {
    const r = checkManualStatusChange({ current: inv("cancelled"), target: "sent", paymentCount: 0 });
    expect(r).toMatchObject({ ok: false, httpStatus: 409 });
  });
  it("leaves an invoice with payments to follow them", () => {
    expect(checkManualStatusChange({ current: inv("partially_paid", "40.00"), target: "draft", paymentCount: 1 })).toMatchObject({ ok: false, httpStatus: 409 });
    expect(checkManualStatusChange({ current: inv("sent", "0"), target: "draft", paymentCount: 2 })).toMatchObject({ ok: false, httpStatus: 409 });
  });
});
