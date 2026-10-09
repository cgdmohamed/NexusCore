import { describe, expect, it } from "vitest";
import { buildStatement } from "../server/statement";

const d = (s: string) => new Date(`${s}T10:00:00Z`);
const inv = (id: string, amount: string, paid: string, status: string, date: string, due?: string) => ({
  id, invoiceNumber: `INV-${id}`, amount, paidAmount: paid, status, invoiceDate: d(date), createdAt: d(date), dueDate: due ? d(due) : null,
});
const pay = (id: string, invoiceId: string, amount: string, date: string, extra: object = {}) => ({
  id, invoiceId, amount, overpaymentAmount: "0", paymentDate: d(date), createdAt: d(date), paymentMethod: "cash",
  bankTransferNumber: null, refundReference: null, isRefund: false, notes: null, ...extra,
});

describe("buildStatement", () => {
  it("runs a balance through bills, payments and refunds in date order", () => {
    const s = buildStatement({
      invoices: [inv("a", "1000", "1000", "paid", "2026-01-01"), inv("b", "500", "100", "partially_refunded", "2026-01-05")],
      payments: [
        pay("p1", "a", "1000", "2026-01-02"),
        pay("p2", "b", "300", "2026-01-06"),
        pay("p3", "b", "-200", "2026-01-07", { isRefund: true }),
      ],
      creditRefunds: [],
      creditBalance: "0",
    });
    expect(s.entries.map((e) => [e.kind, e.balance])).toEqual([
      ["invoice", 1000], ["payment", 0], ["invoice", 500], ["payment", 200], ["refund", 400],
    ]);
    expect(s.totals).toEqual({ billed: 1500, received: 1300, refunded: 200, closingBalance: 400 });
  });

  it("leaves drafts out and shows cancelled invoices without billing them", () => {
    const s = buildStatement({
      invoices: [inv("d", "900", "0", "draft", "2026-02-01"), inv("c", "700", "0", "cancelled", "2026-02-02")],
      payments: [], creditRefunds: [], creditBalance: "0",
    });
    expect(s.entries).toHaveLength(1);
    expect(s.entries[0]).toMatchObject({ kind: "invoice", invoiceStatus: "cancelled", debit: 0, balance: 0 });
    expect(s.position.outstanding).toBe(0);
  });

  it("records an overpayment as money received and lets applied credit move nothing", () => {
    const s = buildStatement({
      invoices: [inv("a", "100", "100", "paid", "2026-03-01"), inv("b", "80", "50", "partially_paid", "2026-03-02")],
      payments: [
        pay("p1", "a", "300", "2026-03-03", { overpaymentAmount: "200" }),
        pay("p2", "b", "50", "2026-03-04", { paymentMethod: "credit_balance" }),
      ],
      creditRefunds: [],
      creditBalance: "150",
    });
    expect(s.entries.map((e) => e.kind)).toEqual(["invoice", "invoice", "payment", "credit_applied"]);
    expect(s.entries[2]).toMatchObject({ credit: 300, overpayment: 200 });
    expect(s.totals.closingBalance).toBe(-120);
    // outstanding (30) - credit held (150)
    expect(s.totals.closingBalance).toBe(s.position.outstanding - s.position.creditBalance);
  });

  it("carries the balance before the start date as the opening balance", () => {
    const s = buildStatement({
      invoices: [inv("a", "100", "0", "sent", "2026-01-01"), inv("b", "50", "0", "sent", "2026-02-01")],
      payments: [pay("p1", "a", "40", "2026-01-15")],
      creditRefunds: [],
      creditBalance: "0",
      from: d("2026-02-01"),
      to: new Date("2026-02-28T23:59:59.999Z"),
    });
    expect(s.openingBalance).toBe(60);
    expect(s.entries).toHaveLength(1);
    expect(s.entries[0].balance).toBe(110);
    expect(s.totals.closingBalance).toBe(110);
  });

  it("separates overdue amounts from what is merely outstanding", () => {
    const s = buildStatement({
      invoices: [inv("a", "100", "0", "sent", "2026-01-01", "2026-01-10"), inv("b", "50", "0", "sent", "2026-01-01", "2026-12-31")],
      payments: [], creditRefunds: [], creditBalance: "0", now: d("2026-06-01"),
    });
    expect(s.position).toMatchObject({ outstanding: 150, overdue: 100 });
  });

  it("does not drift on cents", () => {
    const s = buildStatement({
      invoices: [inv("a", "0.10", "0", "sent", "2026-01-01"), inv("b", "0.20", "0", "sent", "2026-01-02")],
      payments: [], creditRefunds: [], creditBalance: "0",
    });
    expect(s.totals.closingBalance).toBe(0.3);
  });
});
