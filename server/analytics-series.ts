// Money in and out for the reports page, built the same way as the dashboard cash-flow chart:
// "collected" is what payments actually brought in (refunds are negative payments), by payment date;
// "spent" is paid expenses by the day they were paid. The helpers that shape the series are pure so they
// can be tested without a database.

import { sql } from "drizzle-orm";
import { db } from "./db";
import { APP_TIMEZONE } from "./task-insights";
import { lastMonths } from "./dashboard-overview";

export type Granularity = "month" | "quarter";

export interface SeriesPoint { period: string; collected: number; spent: number; net: number }

const num = (v: string | number | null | undefined) => {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const rowsOf = (r: any): any[] => (r.rows ?? r) as any[];

const monthIndex = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
};
const monthKey = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

// Every "YYYY-MM" from `from` to `to`, newest `cap` months at most
export function monthRange(from: string, to: string, cap = 36): string[] {
  let a = monthIndex(from);
  const b = monthIndex(to);
  if (b - a + 1 > cap) a = b - cap + 1;
  const out: string[] = [];
  for (let i = a; i <= b; i++) out.push(monthKey(i));
  return out;
}

// The last `count` calendar months of the company, oldest first
export function trailingMonths(count: number, now: Date = new Date(), tz: string = APP_TIMEZONE): string[] {
  return lastMonths(Math.min(Math.max(Math.floor(count) || 12, 3), 36), now, tz);
}

export const quarterOf = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
};

// Quarters are whole: a window that starts mid-quarter is widened back to the first month of that quarter
export function alignToQuarters(months: string[]): string[] {
  if (months.length === 0) return months;
  const [y, m] = months[0].split("-").map(Number);
  const firstOfQuarter = monthKey(y * 12 + (Math.floor((m - 1) / 3) * 3));
  return monthRange(firstOfQuarter, months[months.length - 1], 48);
}

// One point per month (or quarter), with months that had no money filled with zeros so the line never
// joins two months that are far apart
export function buildSeries(
  months: string[],
  collected: Record<string, number | string>,
  spent: Record<string, number | string>,
  granularity: Granularity = "month",
): SeriesPoint[] {
  const periods = granularity === "quarter" ? alignToQuarters(months) : months;
  const acc = new Map<string, { collected: number; spent: number }>();
  for (const month of periods) {
    const key = granularity === "quarter" ? quarterOf(month) : month;
    const cur = acc.get(key) ?? { collected: 0, spent: 0 };
    cur.collected += num(collected[month]);
    cur.spent += num(spent[month]);
    acc.set(key, cur);
  }
  return Array.from(acc, ([period, v]) => {
    const c = round2(v.collected);
    const s = round2(v.spent);
    return { period, collected: c, spent: s, net: round2(c - s) };
  });
}

export function summarizeSeries(points: SeriesPoint[]) {
  const collected = round2(points.reduce((s, p) => s + p.collected, 0));
  const spent = round2(points.reduce((s, p) => s + p.spent, 0));
  const best = points.reduce<SeriesPoint | null>((b, p) => (p.collected > 0 && (!b || p.collected > b.collected) ? p : b), null);
  const n = points.length || 1;
  return {
    collected,
    spent,
    net: round2(collected - spent),
    averageCollected: round2(collected / n),
    averageSpent: round2(spent / n),
    bestPeriod: best ? { period: best.period, collected: best.collected } : null,
  };
}

const monthOf = (col: any, tz: string) => sql`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM')`;

const between = (col: any, from?: Date | null, to?: Date | null) => sql`${from ? sql`AND ${col} >= ${from.toISOString()}::timestamp` : sql``} ${to ? sql`AND ${col} <= ${to.toISOString()}::timestamp` : sql``}`;

const PAID_ON = sql`COALESCE(e.paid_date, e.expense_date)`;

export async function monthlyCollected(tz: string = APP_TIMEZONE): Promise<Record<string, number>> {
  const rows = rowsOf(await db.execute(sql`
    SELECT ${monthOf(sql`payment_date`, tz)} AS month, SUM(amount::numeric) AS total
    FROM payments WHERE payment_method <> 'credit_balance' GROUP BY 1
  `));
  return Object.fromEntries(rows.map((r) => [r.month, num(r.total)]));
}

export async function monthlySpent(tz: string = APP_TIMEZONE): Promise<Record<string, number>> {
  const rows = rowsOf(await db.execute(sql`
    SELECT ${monthOf(PAID_ON, tz)} AS month, SUM(e.amount::numeric) AS total
    FROM expenses e WHERE e.status = 'paid' GROUP BY 1
  `));
  return Object.fromEntries(rows.map((r) => [r.month, num(r.total)]));
}

export async function collectedTotal(from?: Date | null, to?: Date | null): Promise<number> {
  const [row] = rowsOf(await db.execute(sql`
    SELECT COALESCE(SUM(amount::numeric), 0) AS total FROM payments
    WHERE payment_method <> 'credit_balance' ${between(sql`payment_date`, from, to)}
  `));
  return round2(num(row?.total));
}

export async function spentTotal(from?: Date | null, to?: Date | null): Promise<number> {
  const [row] = rowsOf(await db.execute(sql`
    SELECT COALESCE(SUM(e.amount::numeric), 0) AS total FROM expenses e
    WHERE e.status = 'paid' ${between(PAID_ON, from, to)}
  `));
  return round2(num(row?.total));
}

export async function spentByCategory(from?: Date | null, to?: Date | null) {
  const rows = rowsOf(await db.execute(sql`
    SELECT c.name AS category, SUM(e.amount::numeric) AS total, COUNT(*)::int AS n
    FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE e.status = 'paid' ${between(PAID_ON, from, to)}
    GROUP BY c.name ORDER BY total DESC
  `));
  return rows.map((r) => ({ category: r.category ?? "—", totalAmount: round2(num(r.total)), count: Number(r.n) }));
}

export const parseRange = (startDate: unknown, endDate: unknown) => {
  const s = typeof startDate === "string" ? new Date(startDate) : null;
  const e = typeof endDate === "string" ? new Date(endDate) : null;
  const ok = (d: Date | null) => (d && !Number.isNaN(d.getTime()) ? d : null);
  const from = ok(s);
  const to = ok(e);
  return from && to ? { from, to } : { from: null, to: null };
};

