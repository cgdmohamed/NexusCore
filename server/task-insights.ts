// Pure helpers behind GET /api/tasks/insights: day buckets in the company's time zone,
// zero-filled series, and the ranking that decides which open tasks matter most.

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Africa/Cairo";

const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-10-09" for the calendar day the instant falls on in the given zone
export function dayKey(d: Date, tz: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// The last `count` calendar days ending today, oldest first
export function lastDays(count: number, now: Date = new Date(), tz: string = APP_TIMEZONE): string[] {
  const days: string[] = [];
  // Stepping by 24h can skip or repeat a day around a clock change, so build from noon on each date
  const today = dayKey(now, tz);
  const [y, m, d] = today.split("-").map(Number);
  const noon = Date.UTC(y, m - 1, d, 12);
  for (let i = count - 1; i >= 0; i--) days.push(new Date(noon - i * DAY_MS).toISOString().slice(0, 10));
  return days;
}

export function fillSeries(days: string[], rows: Array<{ day: string; n: number }>): number[] {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.n)]));
  return days.map((d) => byDay.get(d) ?? 0);
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// Percentage change against the previous period; null when there is nothing to compare with
export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface RankableTask {
  id: string;
  priority: string;
  status: string;
  dueDate: Date | null;
}

const PRIORITY_POINTS: Record<string, number> = { high: 30, medium: 15, low: 5 };

// Higher is more important: priority first, then how late or how close the deadline is
export function taskImportance(t: RankableTask, now: Date = new Date(), tz: string = APP_TIMEZONE): number {
  let score = PRIORITY_POINTS[t.priority] ?? 10;
  if (t.status === "in_progress") score += 5;
  if (t.dueDate) {
    const daysLeft = Math.round((Date.parse(`${dayKey(t.dueDate, "UTC")}T12:00:00Z`) - Date.parse(`${dayKey(now, tz)}T12:00:00Z`)) / DAY_MS);
    if (daysLeft < 0) score += 40 + Math.min(-daysLeft, 10) * 2;
    else if (daysLeft === 0) score += 30;
    else if (daysLeft <= 2) score += 20;
    else if (daysLeft <= 7) score += 10;
  }
  return score;
}

export function rankTopTasks<T extends RankableTask>(tasks: T[], limit: number, now: Date = new Date(), tz: string = APP_TIMEZONE): Array<T & { score: number }> {
  return tasks
    .filter((t) => t.status === "pending" || t.status === "in_progress")
    .map((t) => ({ ...t, score: taskImportance(t, now, tz) }))
    .sort((a, b) => b.score - a.score || (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
    .slice(0, limit);
}
