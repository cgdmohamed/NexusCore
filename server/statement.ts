// Client account statement: a dated ledger of what the client was billed and what they paid.
// Balance = billed - received + refunded out. Positive: the client owes us. Negative: we hold credit for them.
// Everything is computed in whole piastres so long statements do not drift by fractions.

export type StatementEntryKind = "invoice" | "payment" | "refund" | "credit_refund" | "credit_applied";

export interface StatementEntry {
  date: string;
  kind: StatementEntryKind;
  reference: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  method: string | null;
  note: string | null;
  invoiceStatus: string | null;
  debit: number;
  credit: number;
  // Part of a payment that exceeded the invoice and went to the client's credit balance
  overpayment: number;
  balance: number;
}

export interface StatementInput {
  invoices: Array<{ id: string; invoiceNumber: string; amount: string | null; paidAmount: string | null; status: string; invoiceDate: Date | null; createdAt: Date | null; dueDate: Date | null }>;
  payments: Array<{ id: string; invoiceId: string; amount: string | null; overpaymentAmount: string | null; paymentDate: Date; createdAt: Date | null; paymentMethod: string; bankTransferNumber: string | null; refundReference: string | null; isRefund: boolean | null; notes: string | null }>;
  creditRefunds: Array<{ id: string; amount: string | null; createdAt: Date | null; description: string; refundReference: string | null; notes: string | null }>;
  creditBalance: string | null;
  from?: Date | null;
  to?: Date | null;
  now?: Date;
}

const toCents = (v: string | number | null | undefined) => Math.round((parseFloat(String(v ?? "0")) || 0) * 100);
const fromCents = (c: number) => c / 100;

// Same instant ordering inside a day: the bill first, then money in, then money out
const KIND_ORDER: Record<StatementEntryKind, number> = { invoice: 0, payment: 1, credit_applied: 2, refund: 3, credit_refund: 4 };

interface RawEntry extends Omit<StatementEntry, "balance" | "date" | "debit" | "credit" | "overpayment"> {
  at: Date;
  debit: number;
  credit: number;
  overpayment: number;
  tie: number;
}

export function buildStatement(input: StatementInput) {
  const now = input.now ?? new Date();
  const invoiceById = new Map(input.invoices.map((i) => [i.id, i]));
  const raw: RawEntry[] = [];

  for (const inv of input.invoices) {
    // Drafts were never issued to the client
    if (inv.status === "draft") continue;
    const at = inv.invoiceDate ?? inv.createdAt ?? now;
    raw.push({
      at, kind: "invoice", reference: inv.invoiceNumber, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
      method: null, note: null, invoiceStatus: inv.status,
      // A cancelled invoice stays visible but no longer bills the client
      debit: inv.status === "cancelled" ? 0 : toCents(inv.amount), credit: 0, overpayment: 0, tie: at.getTime(),
    });
  }

  for (const p of input.payments) {
    const inv = invoiceById.get(p.invoiceId);
    if (!inv || inv.status === "draft") continue;
    const amount = toCents(p.amount);
    const base = { at: p.paymentDate, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, invoiceStatus: inv.status, note: p.notes, tie: (p.createdAt ?? p.paymentDate).getTime() };
    if (p.isRefund || amount < 0) {
      raw.push({ ...base, kind: "refund", reference: p.refundReference || p.bankTransferNumber || inv.invoiceNumber, method: p.paymentMethod, debit: Math.abs(amount), credit: 0, overpayment: 0 });
    } else if (p.paymentMethod === "credit_balance") {
      // Moves existing credit onto an invoice: the money was already counted when it arrived
      raw.push({ ...base, kind: "credit_applied", reference: inv.invoiceNumber, method: p.paymentMethod, debit: 0, credit: 0, overpayment: 0 });
    } else {
      raw.push({ ...base, kind: "payment", reference: p.bankTransferNumber || inv.invoiceNumber, method: p.paymentMethod, debit: 0, credit: amount, overpayment: toCents(p.overpaymentAmount) });
    }
  }

  for (const r of input.creditRefunds) {
    const at = r.createdAt ?? now;
    raw.push({
      at, kind: "credit_refund", reference: r.refundReference || "", invoiceId: null, invoiceNumber: null, method: null,
      note: r.notes || r.description, invoiceStatus: null, debit: toCents(r.amount), credit: 0, overpayment: 0, tie: at.getTime(),
    });
  }

  raw.sort((a, b) => a.at.getTime() - b.at.getTime() || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.tie - b.tie);

  const fromMs = input.from ? input.from.getTime() : null;
  const toMs = input.to ? input.to.getTime() : null;

  let running = 0;
  let opening = 0;
  const entries: StatementEntry[] = [];
  let billed = 0, received = 0, refunded = 0;

  for (const e of raw) {
    const t = e.at.getTime();
    const net = e.debit - e.credit;
    if (fromMs !== null && t < fromMs) {
      opening += net;
      running += net;
      continue;
    }
    if (toMs !== null && t > toMs) continue;
    running += net;
    if (e.kind === "invoice") billed += e.debit;
    else if (e.kind === "payment") received += e.credit;
    else if (e.kind === "refund" || e.kind === "credit_refund") refunded += e.debit;
    entries.push({
      date: e.at.toISOString(), kind: e.kind, reference: e.reference, invoiceId: e.invoiceId, invoiceNumber: e.invoiceNumber,
      method: e.method, note: e.note, invoiceStatus: e.invoiceStatus,
      debit: fromCents(e.debit), credit: fromCents(e.credit), overpayment: fromCents(e.overpayment), balance: fromCents(running),
    });
  }

  // Position today, whatever period is on screen
  let outstanding = 0;
  let overdue = 0;
  for (const inv of input.invoices) {
    if (inv.status === "draft" || inv.status === "cancelled") continue;
    const remaining = Math.max(0, toCents(inv.amount) - toCents(inv.paidAmount));
    outstanding += remaining;
    if (remaining > 0 && inv.dueDate && inv.dueDate.getTime() < now.getTime()) overdue += remaining;
  }

  return {
    openingBalance: fromCents(opening),
    entries,
    totals: {
      billed: fromCents(billed),
      received: fromCents(received),
      refunded: fromCents(refunded),
      closingBalance: fromCents(running),
    },
    position: {
      outstanding: fromCents(outstanding),
      overdue: fromCents(overdue),
      creditBalance: fromCents(toCents(input.creditBalance)),
    },
  };
}
