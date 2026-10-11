// Behind GET /api/dashboard/overview: what needs attention, how old the money owed is, and money in against money out.
// The bucketing and series helpers are pure so they can be tested without a database.

import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { requireAuth } from "./auth";
import { APP_TIMEZONE, dayKey } from "./task-insights";

const DAY_MS = 24 * 60 * 60 * 1000;

export const AGING_KEYS = ["notDue", "d1_30", "d31_60", "d61_90", "d90plus"] as const;
export type AgingKey = (typeof AGING_KEYS)[number];

export interface AgingInvoice {
  clientId: string | null;
  clientName?: string | null;
  status: string;
  amount: string | number | null;
  paidAmount: string | number | null;
  dueDate: Date | string | null;
}

const num = (v: string | number | null | undefined) => {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

// Whole calendar days from `from` to `to` ("YYYY-MM-DD" keys)
const diffDays = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);

export function ageBucket(daysPastDue: number): AgingKey {
  if (daysPastDue <= 0) return "notDue";
  if (daysPastDue <= 30) return "d1_30";
  if (daysPastDue <= 60) return "d31_60";
  if (daysPastDue <= 90) return "d61_90";
  return "d90plus";
}

export interface AgingResult {
  buckets: Record<AgingKey, { count: number; amount: number }>;
  total: number;
  overdueCount: number;
  overdueAmount: number;
  topDebtors: { clientId: string | null; name: string; outstanding: number; oldestDaysPastDue: number }[];
}

// Money still owed on issued invoices, by how long it has been past due. Drafts and cancelled invoices were never billed.
export function bucketAging(invoices: AgingInvoice[], now: Date = new Date(), tz: string = APP_TIMEZONE, topN = 5): AgingResult {
  const today = dayKey(now, tz);
  const buckets = Object.fromEntries(AGING_KEYS.map((k) => [k, { count: 0, amount: 0 }])) as AgingResult["buckets"];
  const byClient = new Map<string, { clientId: string | null; name: string; outstanding: number; oldest: number }>();
  let total = 0, overdueCount = 0, overdueAmount = 0;

  for (const inv of invoices) {
    if (inv.status === "draft" || inv.status === "cancelled") continue;
    const remaining = Math.max(0, num(inv.amount) - num(inv.paidAmount));
    if (remaining <= 0) continue;
    // Due dates are stored as the UTC midnight of the calendar day
    const days = inv.dueDate ? diffDays(new Date(inv.dueDate).toISOString().slice(0, 10), today) : 0;
    const key = ageBucket(days);
    buckets[key].count++;
    buckets[key].amount += remaining;
    total += remaining;
    if (days > 0) { overdueCount++; overdueAmount += remaining; }

    const id = inv.clientId ?? "";
    const entry = byClient.get(id) ?? { clientId: inv.clientId, name: inv.clientName || "—", outstanding: 0, oldest: 0 };
    entry.outstanding += remaining;
    entry.oldest = Math.max(entry.oldest, days);
    byClient.set(id, entry);
  }

  for (const k of AGING_KEYS) buckets[k].amount = round2(buckets[k].amount);
  const topDebtors = Array.from(byClient.values())
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, topN)
    .map((d) => ({ clientId: d.clientId, name: d.name, outstanding: round2(d.outstanding), oldestDaysPastDue: Math.max(0, d.oldest) }));
  return { buckets, total: round2(total), overdueCount, overdueAmount: round2(overdueAmount), topDebtors };
}

// "2026-05" … "2026-10": the last `count` months ending with the current one
export function lastMonths(count: number, now: Date = new Date(), tz: string = APP_TIMEZONE): string[] {
  const [y, m] = dayKey(now, tz).split("-").map(Number);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    months.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`);
  }
  return months;
}

export interface MonthRow { month: string; collected?: number | string | null; spent?: number | string | null }

export function fillMonths(months: string[], rows: MonthRow[]) {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return months.map((month) => {
    const row = byMonth.get(month);
    const collected = round2(num(row?.collected));
    const spent = round2(num(row?.spent));
    return { month, collected, spent, net: round2(collected - spent) };
  });
}

export interface AttentionItem { key: string; count: number; amount?: number; href: string; secondary?: number }

const can = (req: any, module: string, action: string) => req.user?.permissions?.[module]?.[action] === true;

export function registerDashboardOverviewRoutes(app: Express) {
  app.get("/api/dashboard/overview", requireAuth, async (req: any, res) => {
    try {
      const tz = APP_TIMEZONE;
      const now = new Date();
      const today = dayKey(now, tz);
      const startOfToday = sql`((${today}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
      const rowsOf = (r: any): any[] => (r.rows ?? r) as any[];
      const attention: AttentionItem[] = [];
      let aging: AgingResult | undefined;
      let cashflow: { months: ReturnType<typeof fillMonths>; hasSpent: boolean; hasCollected: boolean } | undefined;

      const canInvoices = can(req, "invoices", "view");
      if (canInvoices) {
        const invoiceRows = rowsOf(await db.execute(sql`
          SELECT i.client_id, c.name AS client_name, i.status, i.amount, i.paid_amount, i.due_date
          FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
          WHERE i.status NOT IN ('draft','cancelled')
        `));
        aging = bucketAging(invoiceRows.map((r) => ({
          clientId: r.client_id, clientName: r.client_name, status: r.status, amount: r.amount, paidAmount: r.paid_amount, dueDate: r.due_date,
        })), now, tz);
        if (aging.overdueCount > 0) attention.push({ key: "overdue_invoices", count: aging.overdueCount, amount: aging.overdueAmount, href: "/invoices" });
      }

      if (can(req, "quotations", "view")) {
        const [row] = rowsOf(await db.execute(sql`
          SELECT COUNT(*)::int AS n FROM quotations
          WHERE status = 'sent' AND valid_until IS NOT NULL
            AND valid_until >= ${startOfToday} AND valid_until < (${startOfToday}) + interval '8 days'
        `));
        if (Number(row?.n) > 0) attention.push({ key: "expiring_quotations", count: Number(row.n), href: "/quotations" });
      }

      if (can(req, "paymentSources", "view")) {
        const [row] = rowsOf(await db.execute(sql`
          SELECT COUNT(*)::int AS n, COALESCE(SUM(amount::numeric), 0) AS total FROM payments
          WHERE payment_source_id IS NULL AND payment_method <> 'credit_balance' AND amount::numeric > 0
        `));
        if (Number(row?.n) > 0) attention.push({ key: "unassigned_payments", count: Number(row.n), amount: round2(num(row.total)), href: "/payment-sources" });
      }

      if (can(req, "tasks", "view")) {
        const [row] = rowsOf(await db.execute(sql`
          SELECT COUNT(*) FILTER (WHERE assigned_to = ${req.user.id})::int AS mine, COUNT(*)::int AS team
          FROM tasks WHERE status IN ('pending','in_progress') AND due_date < ${startOfToday}
        `));
        const mine = Number(row?.mine ?? 0);
        const team = can(req, "tasks", "approve") ? Number(row?.team ?? 0) : 0;
        if (mine > 0 || team > 0) attention.push({ key: "overdue_tasks", count: mine, secondary: team > mine ? team : undefined, href: "/tasks" });
      }

      if (can(req, "expenses", "approve")) {
        const [row] = rowsOf(await db.execute(sql`
          SELECT COUNT(*)::int AS n, COALESCE(SUM(amount::numeric), 0) AS total FROM expenses
          WHERE status = 'pending' AND rejected_at IS NULL
        `));
        if (Number(row?.n) > 0) attention.push({ key: "pending_expenses", count: Number(row.n), amount: round2(num(row.total)), href: "/expenses" });
      }

      const canSpent = can(req, "expenses", "view");
      if (canInvoices || canSpent) {
        const months = lastMonths(6, now, tz);
        const monthOf = (col: any) => sql`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM')`;
        const rows: MonthRow[] = [];
        if (canInvoices) {
          const collected = rowsOf(await db.execute(sql`
            SELECT ${monthOf(sql`payment_date`)} AS month, SUM(amount::numeric) AS total
            FROM payments WHERE payment_method <> 'credit_balance'
            GROUP BY 1
          `));
          for (const r of collected) rows.push({ month: r.month, collected: r.total });
        }
        const spentByMonth = new Map<string, number>();
        if (canSpent) {
          const spent = rowsOf(await db.execute(sql`
            SELECT ${monthOf(sql`COALESCE(paid_date, expense_date)`)} AS month, SUM(amount::numeric) AS total
            FROM expenses WHERE status = 'paid' GROUP BY 1
          `));
          for (const r of spent) spentByMonth.set(r.month, num(r.total));
        }
        const merged = new Map<string, MonthRow>();
        for (const r of rows) merged.set(r.month, { ...r });
        spentByMonth.forEach((total, month) => merged.set(month, { ...(merged.get(month) ?? { month }), spent: total }));
        cashflow = { months: fillMonths(months, Array.from(merged.values())), hasSpent: canSpent, hasCollected: canInvoices };
      }

      res.json({ generatedAt: now.toISOString(), timezone: tz, attention, aging, cashflow });
    } catch (error) {
      console.error("Error building dashboard overview:", error);
      res.status(500).json({ message: "Failed to build dashboard overview" });
    }
  });
}
