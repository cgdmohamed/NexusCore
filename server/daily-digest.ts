// Morning digest: one push notification per person, per day, summarising what is due today and what is late.
// The pure helpers (when to send, what to say) are separate from the scheduler so they can be tested with a fixed clock.

import { sql } from "drizzle-orm";
import { db } from "./db";
import { APP_TIMEZONE, dayKey } from "./task-insights";
import { notificationService } from "./notification-service";
import { logger } from "./logger";

export const DIGEST_HOUR = Math.min(23, Math.max(0, parseInt(process.env.DIGEST_HOUR || "8", 10) || 8));
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
}

interface DigestRow {
  user_id: string;
  due_today: number;
  overdue: number;
}

// Per assignee: open tasks due today and open tasks already late, in the company's calendar
async function loadCounts(today: string, tz: string): Promise<DigestRow[]> {
  const startOfToday = sql`((${today}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
  const result = await db.execute(sql`
    SELECT t.assigned_to AS user_id,
           COUNT(*) FILTER (WHERE t.due_date >= ${startOfToday} AND t.due_date < (${startOfToday}) + interval '1 day')::int AS due_today,
           COUNT(*) FILTER (WHERE t.due_date < ${startOfToday})::int AS overdue
    FROM tasks t
    JOIN users u ON u.id = t.assigned_to AND u.is_active = true
    WHERE t.assigned_to IS NOT NULL AND t.status IN ('pending','in_progress') AND t.due_date IS NOT NULL
    GROUP BY t.assigned_to
  `);
  const rows = ((result as any).rows ?? result) as any[];
  return rows
    .filter((r) => Number(r.due_today) > 0 || Number(r.overdue) > 0)
    .map((r) => ({ user_id: r.user_id, due_today: Number(r.due_today), overdue: Number(r.overdue) }));
}

// The interface language is a per-browser choice and is not stored on the server, so the digest uses the company default
const DEFAULT_LANGUAGE: DigestLanguage = process.env.DIGEST_LANGUAGE === "en" ? "en" : "ar";

// Claims the day for this user. Exactly one process wins, which keeps PM2 cluster workers from sending duplicates.
async function claimDay(userId: string, day: string): Promise<boolean> {
  const result = await db.execute(sql`
    INSERT INTO digest_log (user_id, day) VALUES (${userId}, ${day})
    ON CONFLICT (user_id, day) DO NOTHING
    RETURNING user_id
  `);
  const rows = ((result as any).rows ?? result) as any[];
  return rows.length > 0;
}

export interface DigestRunSummary { considered: number; sent: number; skipped: number }

export async function runDailyDigest(now: Date = new Date(), tz: string = APP_TIMEZONE): Promise<DigestRunSummary> {
  const summary: DigestRunSummary = { considered: 0, sent: 0, skipped: 0 };
  const today = dayKey(now, tz);
  const rows = await loadCounts(today, tz);

  for (const row of rows) {
    summary.considered++;
    const digest = buildDigest({ dueToday: row.due_today, overdue: row.overdue }, DEFAULT_LANGUAGE);
    if (!digest) { summary.skipped++; continue; }
    try {
      if (!(await claimDay(row.user_id, today))) { summary.skipped++; continue; }
      await notificationService.createNotification({
        userId: row.user_id,
        type: "daily_digest",
        title: digest.title,
        message: digest.message,
        priority: row.overdue > 0 ? "high" : "medium",
        entityUrl: "/tasks",
        metadata: { day: today, dueToday: row.due_today, overdue: row.overdue },
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
    if (!isDigestTime(new Date())) return;
    runDailyDigest().catch((err) => logger.warn(`Daily digest run failed: ${err instanceof Error ? err.message : err}`));
  };
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref();
  setTimeout(tick, 30_000).unref();
}
