// Calendar arithmetic on plain YYYY-MM-DD day keys (the company's calendar days), so no time zone can move an event to another day.

const MS = 86_400_000;
const parse = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (day: string, n: number) => fmt(parse(day) + n * MS);
export const daysBetween = (from: string, to: string) => Math.round((parse(to) - parse(from)) / MS);
/** 0 = Sunday … 6 = Saturday */
export const weekdayOf = (day: string) => new Date(parse(day)).getUTCDay();
export const monthOf = (day: string) => day.slice(0, 7);
export const startOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
export const addMonths = (day: string, n: number) => {
  const d = new Date(parse(startOfMonth(day)));
  d.setUTCMonth(d.getUTCMonth() + n);
  return fmt(d.getTime());
};
export const endOfMonth = (day: string) => addDays(addMonths(day, 1), -1);

export function startOfWeek(day: string, weekStart: number): string {
  return addDays(day, -((weekdayOf(day) - weekStart + 7) % 7));
}

/** The days of a week, first day first */
export const weekDays = (day: string, weekStart: number) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day, weekStart), i));

/** Whole weeks that cover the month, so the grid has no ragged edges (35 or 42 days) */
export function monthGrid(day: string, weekStart: number): string[] {
  const first = startOfWeek(startOfMonth(day), weekStart);
  const last = endOfMonth(day);
  const count = Math.ceil((daysBetween(first, last) + 1) / 7) * 7;
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

export function groupByDay<T extends { day: string }>(events: T[]): Map<string, T[]> {
  const by = new Map<string, T[]>();
  for (const e of events) {
    const list = by.get(e.day);
    if (list) list.push(e); else by.set(e.day, [e]);
  }
  return by;
}

export interface Bar { left: number; width: number; startsBefore: boolean; endsAfter: boolean }

/** Where a project's bar sits on a timeline running from `from` to `to`, as percentages of the width. A project with one date is a one-day bar. */
export function barFor(start: string | null, due: string | null, from: string, to: string): Bar | null {
  const s = start ?? due;
  const e = due ?? start;
  if (!s || !e) return null;
  const [lo, hi] = s <= e ? [s, e] : [e, s];
  if (hi < from || lo > to) return null;
  const total = daysBetween(from, to) + 1;
  const first = lo < from ? from : lo;
  const last = hi > to ? to : hi;
  return {
    left: (daysBetween(from, first) / total) * 100,
    width: ((daysBetween(first, last) + 1) / total) * 100,
    startsBefore: lo < from,
    endsAfter: hi > to,
  };
}

/** The range one screen needs: the whole grid of a month, a week, or the month for the timeline */
export function rangeFor(view: "month" | "week" | "timeline", day: string, weekStart: number): { from: string; to: string } {
  if (view === "week") { const d = weekDays(day, weekStart); return { from: d[0], to: d[6] }; }
  if (view === "timeline") return { from: startOfMonth(day), to: endOfMonth(day) };
  const g = monthGrid(day, weekStart);
  return { from: g[0], to: g[g.length - 1] };
}
