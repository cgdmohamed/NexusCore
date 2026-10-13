import { db } from "./db";
import { pushSubscriptions } from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { sendPush, vapidFromEnv, type PushOptions, type PushResult } from "./web-push";
import { logger } from "./logger";
import { APP_TIMEZONE, dayKey } from "./task-insights";

export interface PushMessage {
  type: string;
  title: string;
  message: string;
  entityUrl?: string | null;
  notificationId?: string;
}

// The same notification opens a different screen in the phone app than on the desktop site
export function pushUrlFor(entityUrl: string | null | undefined, platform: string): string {
  if (platform !== "mobile") return entityUrl || "/notifications";
  const path = entityUrl || "";
  if (path.startsWith("/messages")) return "/m/messages";
  if (path.startsWith("/tasks")) return "/m/tasks";
  if (path.startsWith("/projects")) return "/m/projects";
  if (path.startsWith("/clients")) return "/m/clients";
  return "/m/alerts";
}

export interface BadgeCounts { total: number; notifications: number; tasks: number }

// What the home-screen icon shows: unread notifications (a new message is one of them) plus the person's open tasks
// that are due today or already late. The same figure travels with every push and is served to the open app.
export async function badgeCounts(userId: string, now: Date = new Date(), tz: string = APP_TIMEZONE): Promise<BadgeCounts | undefined> {
  try {
    const today = dayKey(now, tz);
    const startOfToday = sql`((${today}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
    const result = await db.execute(sql`
      SELECT (SELECT COUNT(*) FROM notifications WHERE user_id = ${userId} AND status = 'unread')::int AS notifications,
             (SELECT COUNT(*) FROM tasks WHERE assigned_to = ${userId} AND status IN ('pending','in_progress')
                AND due_date IS NOT NULL AND due_date < (${startOfToday}) + interval '1 day')::int AS tasks
    `);
    const row = (((result as any).rows ?? result) as any[])[0];
    const notifications = Number(row?.notifications ?? 0);
    const tasks = Number(row?.tasks ?? 0);
    return { total: notifications + tasks, notifications, tasks };
  } catch (error) {
    logger.warn(`Could not count items for the app badge: ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
}

export const unreadTotal = async (userId: string): Promise<number | undefined> => (await badgeCounts(userId))?.total;

export function buildPushPayload(message: PushMessage, platform: string, badge?: number) {
  return {
    title: message.title,
    body: message.message,
    url: pushUrlFor(message.entityUrl, platform),
    tag: message.notificationId ? `n-${message.notificationId}` : `t-${message.type}`,
    type: message.type,
    ...(badge !== undefined ? { badge } : {}),
  };
}

export interface PushSummary { sent: number; failed: number; removed: number }

// Sends one notification to every device the user has enabled. Devices the browser reports as gone are forgotten.
export async function pushToUser(userId: string, message: PushMessage, options: PushOptions = {}): Promise<PushSummary> {
  const summary: PushSummary = { sent: 0, failed: 0, removed: 0 };
  const config = vapidFromEnv();
  if (!config) return summary;

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (subs.length === 0) return summary;
  const badge = await unreadTotal(userId);

  const results = await Promise.all(
    subs.map(async (sub): Promise<[string, PushResult]> => [
      sub.id,
      await sendPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, buildPushPayload(message, sub.platform, badge), config, {
        urgency: message.type === "direct_message" ? "high" : "normal",
        ...options,
      }),
    ]),
  );

  const gone = results.filter(([, r]) => r === "gone").map(([id]) => id);
  summary.sent = results.filter(([, r]) => r === "sent").length;
  summary.failed = results.filter(([, r]) => r === "failed").length;
  if (gone.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    summary.removed = gone.length;
  }
  const delivered = results.filter(([, r]) => r === "sent").map(([id]) => id);
  if (delivered.length > 0) {
    await db.update(pushSubscriptions).set({ lastUsedAt: new Date() }).where(inArray(pushSubscriptions.id, delivered));
  }
  if (summary.failed > 0) logger.warn?.(`Push: ${summary.failed} delivery attempt(s) failed for user ${userId}`);
  return summary;
}
