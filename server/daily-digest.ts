// Morning digest: one push notification per person, per day, summarising what is due today and what is late.
// The pure helpers (when to send, what to say) are separate from the scheduler so they can be tested with a fixed clock.

import { sql } from "drizzle-orm";
import { db } from "./db";
import { APP_TIMEZONE, dayKey } from "./task-insights";
import { notificationService } from "./notification-service";
import { logger } from "./logger";
import { loadAllPrefs, mergePrefs, runDigestSettingsMigration } from "./digest-settings";

export const DIGEST_HOUR = Math.min(23, Math.max(0, parseInt(process.env.DIGEST_HOUR || "6", 10) || 6));
// A server that restarts at noon should not send a "good morning" summary
export const DIGEST_WINDOW_HOURS = 4;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export type DigestLanguage = "ar" | "en";

export interface DigestCounts {
  dueToday: number;
  overdue: number;
}

// Hour of day (0-23) in the company's zone
export function localHour(now: Date, tz: string = APP_TIMEZONE): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(now);
  return parseInt(hour, 10) % 24;
}

// True from the digest hour until the end of the window, so a restart shortly after 8:00 still delivers it
export function isDigestTime(now: Date, tz: string = APP_TIMEZONE, hour: number = DIGEST_HOUR): boolean {
  const h = localHour(now, tz);
  return h >= hour && h < hour + DIGEST_WINDOW_HOURS;
}

// Delivery window for a person's summary. It opens at their hour and stays open, so a server that was down or deployed
// later in the day still sends today's summary once (the ledger prevents a second one). The morning one closes when the
// evening one opens, and the evening one stays open until midnight.
export function inDeliveryWindow(now: Date, tz: string, from: number, to: number): boolean {
  const h = localHour(now, tz);
  return h >= from && h < to;
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arNumber = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

// Arabic counted nouns: 1 and 2 use singular/dual forms, 3-10 the plural, 11+ the singular accusative
function arTasks(n: number): string {
  if (n === 1) return "مهمة واحدة";
  if (n === 2) return "مهمتان";
  if (n >= 3 && n <= 10) return `${arNumber(n)} مهام`;
  return `${arNumber(n)} مهمة`;
}

function arTasksFor(n: number, kind: "due" | "late"): string {
  if (kind === "due") return n === 1 ? "مهمة واحدة مستحقة اليوم" : n === 2 ? "مهمتان مستحقتان اليوم" : `${arTasks(n)} مستحقة اليوم`;
  return n === 1 ? "مهمة واحدة متأخرة" : n === 2 ? "مهمتان متأخرتان" : `${arTasks(n)} متأخرة`;
}

export interface DigestItem { title: string; meta: string }
export interface DigestSection { key: "due" | "late" | "done" | "open"; heading: string; items: DigestItem[]; more: number }

const HEADINGS: Record<DigestLanguage, Record<DigestSection["key"], string>> = {
  ar: { due: "مستحقة اليوم", late: "متأخرة", done: "أُنجزت اليوم", open: "متبقية" },
  en: { due: "Due today", late: "Overdue", done: "Completed today", open: "Still open" },
};
export const DIGEST_ITEMS_PER_SECTION = 10;

export interface DigestTaskRow {
  section: DigestSection["key"];
  title: string;
  project?: string | null;
  dueDay?: string | null; // YYYY-MM-DD in the company's calendar
  total: number; // all tasks in this section for the user, for the "and N more" line
}

function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
}

// Turns the per-user task rows into the sections shown in the email. Pure, so ordering and wording are testable.
export function buildDigestSections(rows: DigestTaskRow[], today: string, language: DigestLanguage): DigestSection[] {
  const order: DigestSection["key"][] = ["late", "due", "done", "open"];
  const sections: DigestSection[] = [];
  for (const key of order) {
    const mine = rows.filter((r) => r.section === key);
    if (mine.length === 0) continue;
    const items = mine.slice(0, DIGEST_ITEMS_PER_SECTION).map((r) => {
      const bits: string[] = [];
      if (r.project) bits.push(r.project);
      if ((key === "late" || key === "open") && r.dueDay) {
        const late = daysBetween(r.dueDay, today);
        if (late > 0) bits.push(language === "ar" ? `متأخرة ${late === 1 ? "يوماً واحداً" : late === 2 ? "يومين" : late <= 10 ? `${arNumber(late)} أيام` : `${arNumber(late)} يوماً`}` : `${late}d late`);
      }
      return { title: r.title, meta: bits.join(" · ") };
    });
    const total = Math.max(mine[0].total, mine.length);
    sections.push({ key, heading: HEADINGS[language][key], items, more: Math.max(0, total - items.length) });
  }
  return sections;
}

export interface EveningCounts {
  completed: number;
  remaining: number;
}

// Evening wrap-up: what was finished today and what is still open. Silent when there is nothing to say.
export function buildEveningDigest(counts: EveningCounts, language: DigestLanguage): { title: string; message: string } | null {
  const { completed, remaining } = counts;
  if (completed <= 0 && remaining <= 0) return null;

  if (language === "ar") {
    const parts: string[] = [];
    if (completed > 0) parts.push(`أُنجزت ${arTasks(completed)} اليوم`);
    if (remaining > 0) parts.push(`تبقّت ${arTasks(remaining)}`);
    return { title: "ملخص نهاية اليوم", message: parts.join(" و") };
  }

  const parts: string[] = [];
  if (completed > 0) parts.push(`${plural(completed, "task", "tasks")} completed today`);
  if (remaining > 0) parts.push(`${remaining} still open`);
  return { title: "End of day summary", message: parts.join(" and ") };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Returns null when there is nothing to report, so nobody is nudged for an empty day
export function buildDigest(counts: DigestCounts, language: DigestLanguage): { title: string; message: string } | null {
  const { dueToday, overdue } = counts;
  if (dueToday <= 0 && overdue <= 0) return null;

  if (language === "ar") {
    const parts: string[] = [];
    if (dueToday > 0) parts.push(arTasksFor(dueToday, "due"));
    if (overdue > 0) parts.push(arTasksFor(overdue, "late"));
    return { title: "الملخص الصباحي", message: parts.join(" و") };
  }

  const parts: string[] = [];
  if (dueToday > 0) parts.push(`${plural(dueToday, "task", "tasks")} due today`);
  if (overdue > 0) parts.push(`${overdue} overdue`);
  return { title: "Morning summary", message: parts.join(" and ") };
}

// Existing databases need the enum value and the once-per-day ledger; both are idempotent
export async function runDigestMigrations(): Promise<void> {
  try {
    await db.execute(sql`ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'daily_digest'`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS digest_log (
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, day)
      );
    `);
  } catch (err) {
    console.error("⚠️ Digest migrations failed (non-fatal):", err);
  }
  await runDigestSettingsMigration();
}

export type DigestKind = "morning" | "evening";

interface DigestRow {
  user_id: string;
  a: number; // morning: due today; evening: completed today
  b: number; // morning: overdue; evening: still open (due today or earlier)
}

// Per assignee, in the company's calendar. Morning: due today and late. Evening: finished today and still open.
async function loadCounts(kind: DigestKind, today: string, tz: string): Promise<DigestRow[]> {
  const startOfToday = sql`((${today}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
  const result = kind === "morning"
    ? await db.execute(sql`
        SELECT t.assigned_to AS user_id,
               COUNT(*) FILTER (WHERE t.due_date >= ${startOfToday} AND t.due_date < (${startOfToday}) + interval '1 day')::int AS a,
               COUNT(*) FILTER (WHERE t.due_date < ${startOfToday})::int AS b
        FROM tasks t
        JOIN users u ON u.id = t.assigned_to AND u.is_active = true
        WHERE t.assigned_to IS NOT NULL AND t.status IN ('pending','in_progress') AND t.due_date IS NOT NULL
        GROUP BY t.assigned_to
      `)
    : await db.execute(sql`
        SELECT t.assigned_to AS user_id,
               COUNT(*) FILTER (WHERE t.status = 'completed' AND t.completed_date >= ${startOfToday} AND t.completed_date < (${startOfToday}) + interval '1 day')::int AS a,
               COUNT(*) FILTER (WHERE t.status IN ('pending','in_progress') AND t.due_date IS NOT NULL AND t.due_date < (${startOfToday}) + interval '1 day')::int AS b
        FROM tasks t
        JOIN users u ON u.id = t.assigned_to AND u.is_active = true
        WHERE t.assigned_to IS NOT NULL
        GROUP BY t.assigned_to
      `);
  const rows = ((result as any).rows ?? result) as any[];
  return rows
    .filter((r) => Number(r.a) > 0 || Number(r.b) > 0)
    .map((r) => ({ user_id: r.user_id, a: Number(r.a), b: Number(r.b) }));
}

// The tasks behind the numbers, so the summary says which ones and not only how many. The same conditions as loadCounts.
async function loadItems(kind: DigestKind, today: string, tz: string): Promise<Map<string, DigestTaskRow[]>> {
  const startOfToday = sql`((${today}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
  const endOfToday = sql`(${startOfToday}) + interval '1 day'`;
  const section = kind === "morning"
    ? sql`CASE WHEN t.due_date < ${startOfToday} THEN 'late' ELSE 'due' END`
    : sql`CASE WHEN t.status = 'completed' THEN 'done' ELSE 'open' END`;
  const where = kind === "morning"
    ? sql`t.status IN ('pending','in_progress') AND t.due_date IS NOT NULL AND t.due_date < ${endOfToday}`
    : sql`(t.status = 'completed' AND t.completed_date >= ${startOfToday} AND t.completed_date < ${endOfToday})
          OR (t.status IN ('pending','in_progress') AND t.due_date IS NOT NULL AND t.due_date < ${endOfToday})`;
  const result = await db.execute(sql`
    SELECT user_id, section, title, project, due_day, total FROM (
      SELECT t.assigned_to AS user_id, ${section} AS section, t.title AS title, p.name AS project,
             to_char((t.due_date AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS due_day,
             COUNT(*) OVER (PARTITION BY t.assigned_to, ${section})::int AS total,
             ROW_NUMBER() OVER (
               PARTITION BY t.assigned_to, ${section}
               ORDER BY t.due_date ASC NULLS LAST,
                        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                        t.created_at ASC
             ) AS rn
      FROM tasks t
      JOIN users u ON u.id = t.assigned_to AND u.is_active = true
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.assigned_to IS NOT NULL AND (${where})
    ) x WHERE rn <= ${DIGEST_ITEMS_PER_SECTION}
    ORDER BY user_id, rn
  `);
  const rows = ((result as any).rows ?? result) as any[];
  const byUser = new Map<string, DigestTaskRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push({ section: r.section, title: r.title, project: r.project, dueDay: r.due_day, total: Number(r.total) });
    byUser.set(r.user_id, list);
  }
  return byUser;
}

// The interface language is a per-browser choice and is not stored on the server, so the digest uses the company default
const DEFAULT_LANGUAGE: DigestLanguage = process.env.DIGEST_LANGUAGE === "en" ? "en" : "ar";

// Claims the day for this user. Exactly one process wins, which keeps PM2 cluster workers from sending duplicates.
// The evening summary shares the ledger under its own key.
async function claimDay(userId: string, key: string): Promise<boolean> {
  const result = await db.execute(sql`
    INSERT INTO digest_log (user_id, day) VALUES (${userId}, ${key})
    ON CONFLICT (user_id, day) DO NOTHING
    RETURNING user_id
  `);
  const rows = ((result as any).rows ?? result) as any[];
  return rows.length > 0;
}

export interface DigestRunSummary { considered: number; sent: number; skipped: number }

// Sends one kind of summary to everyone whose own (or the company's) time has come and who has not switched it off
export async function runDailyDigest(now: Date = new Date(), tz: string = APP_TIMEZONE, kind: DigestKind = "morning"): Promise<DigestRunSummary> {
  const summary: DigestRunSummary = { considered: 0, sent: 0, skipped: 0 };
  const today = dayKey(now, tz);
  const [rows, prefs, items] = await Promise.all([loadCounts(kind, today, tz), loadAllPrefs(), loadItems(kind, today, tz)]);

  for (const row of rows) {
    summary.considered++;
    const mine = mergePrefs(prefs.company, prefs.byUser.get(row.user_id));
    const enabled = kind === "morning" ? mine.morningEnabled : mine.eveningEnabled;
    const hour = kind === "morning" ? mine.morningHour : mine.eveningHour;
    const until = kind === "evening" ? 24 : mine.eveningHour > hour ? mine.eveningHour : hour + DIGEST_WINDOW_HOURS;
    if (!enabled || !inDeliveryWindow(now, tz, hour, until)) { summary.skipped++; continue; }

    const digest = kind === "morning"
      ? buildDigest({ dueToday: row.a, overdue: row.b }, DEFAULT_LANGUAGE)
      : buildEveningDigest({ completed: row.a, remaining: row.b }, DEFAULT_LANGUAGE);
    if (!digest) { summary.skipped++; continue; }
    try {
      if (!(await claimDay(row.user_id, kind === "morning" ? today : `${today}#pm`))) { summary.skipped++; continue; }
      await notificationService.createNotification({
        userId: row.user_id,
        type: "daily_digest",
        title: digest.title,
        message: digest.message,
        priority: kind === "morning" && row.b > 0 ? "high" : "medium",
        entityUrl: "/tasks",
        metadata: {
          ...(kind === "morning"
            ? { kind, day: today, dueToday: row.a, overdue: row.b }
            : { kind, day: today, completed: row.a, remaining: row.b }),
          lang: DEFAULT_LANGUAGE,
          sections: buildDigestSections(items.get(row.user_id) ?? [], today, DEFAULT_LANGUAGE),
        },
      });
      summary.sent++;
    } catch (err) {
      summary.skipped++;
      logger.warn(`Daily digest failed for a user: ${err instanceof Error ? err.message : err}`);
    }
  }
  return summary;
}

let timer: NodeJS.Timeout | null = null;

// Every worker checks on a timer; the ledger decides which one actually sends
export function startDailyDigest(): void {
  if (timer || process.env.DIGEST_DISABLED === "true") return;
  const tick = () => {
    for (const kind of ["morning", "evening"] as const) {
      runDailyDigest(new Date(), APP_TIMEZONE, kind).catch((err) => logger.warn(`Daily digest (${kind}) failed: ${err instanceof Error ? err.message : err}`));
    }
  };
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref();
  setTimeout(tick, 30_000).unref();
}
