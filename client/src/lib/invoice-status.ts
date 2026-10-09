// One definition of "receivable" and "overdue" for every screen (sidebar badge, dashboard, lists, detail).
// Drafts were never issued to the client and cancelled invoices no longer bill them, so neither counts.

export interface InvoiceLike {
  status: string;
  amount?: string | number | null;
  paidAmount?: string | number | null;
  dueDate?: string | Date | null;
}

const num = (v: string | number | null | undefined) => {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

export const isReceivable = (inv: InvoiceLike) => inv.status !== "draft" && inv.status !== "cancelled";

export const remainingOf = (inv: InvoiceLike) => Math.max(0, num(inv.amount) - num(inv.paidAmount));

// Overdue from the day after the due date, while something is still unpaid
export function isInvoiceOverdue(inv: InvoiceLike, now: Date = new Date()): boolean {
  if (!isReceivable(inv) || !inv.dueDate || remainingOf(inv) <= 0) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(inv.dueDate).getTime() < startOfToday.getTime();
}

export function receivableTotals(list: InvoiceLike[]) {
  let billed = 0, paid = 0;
  for (const inv of list) {
    if (!isReceivable(inv)) continue;
    billed += num(inv.amount);
    paid += num(inv.paidAmount);
  }
  return { billed, paid, outstanding: list.filter(isReceivable).reduce((s, inv) => s + remainingOf(inv), 0) };
}
