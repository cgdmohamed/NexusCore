// Pure helpers for the Overview screen: wording decisions, due-date labels and money snapshots.
import { isInvoiceOverdue, isReceivable, remainingOf, type InvoiceLike } from "@/lib/invoice-status";

export type Greeting = "morning" | "afternoon" | "evening";

export function greetingFor(hour: number): Greeting {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const localDay = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in the device's zone

export type DueKind = "overdue" | "today" | "soon" | "later" | "none";

// Due dates are stored as the calendar day (midnight UTC), so their date part is read in UTC
export function dueInfo(dueDate: string | null | undefined, now: Date = new Date()): { kind: DueKind; days: number } {
  if (!dueDate) return { kind: "none", days: 0 };
  const due = Date.parse(`${new Date(dueDate).toISOString().slice(0, 10)}T12:00:00Z`);
  const today = Date.parse(`${localDay(now)}T12:00:00Z`);
  const days = Math.round((due - today) / DAY_MS);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "today", days: 0 };
  return { kind: days <= 7 ? "soon" : "later", days };
}

// Hours become days once they are long enough to read better that way
export function durationLabel(hours: number | null): { value: number; unit: "hours" | "days" } | null {
  if (hours === null || !Number.isFinite(hours)) return null;
  return hours >= 24 ? { value: Math.round((hours / 24) * 10) / 10, unit: "days" } : { value: Math.round(hours * 10) / 10, unit: "hours" };
}

export function receivablesSnapshot(invoices: InvoiceLike[], now: Date = new Date()) {
  let outstanding = 0, overdue = 0, overdueCount = 0;
  for (const inv of invoices) {
    if (!isReceivable(inv)) continue;
    const left = remainingOf(inv);
    outstanding += left;
    if (isInvoiceOverdue(inv, now)) {
      overdue += left;
      overdueCount += 1;
    }
  }
  return { outstanding, overdue, overdueCount };
}

export function maxOf(values: number[]): number {
  return values.reduce((m, v) => (v > m ? v : m), 0);
}
