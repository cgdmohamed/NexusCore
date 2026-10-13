// Removing people: delete outright when nothing refers to them, otherwise archive so history stays intact.
import { sql, eq, inArray } from "drizzle-orm";
import { db, pgError } from "./db";
import { employees, users } from "@shared/schema";
import { invalidateUserSessions } from "./sessions";

export type RemovalMode = "deleted" | "archived";

// Existing databases get the columns at startup (idempotent)
export async function runArchiveMigration(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
  } catch (err) {
    console.error("⚠️ Archive migration failed (non-fatal):", err);
  }
}

// Personal, throw-away rows that should not stop a deletion: notifications they received, their settings and reset tokens
async function clearEphemeral(tx: any, userIds: string[]) {
  if (userIds.length === 0) return;
  const ids = sql.join(userIds.map((i) => sql`${i}`), sql`, `);
  await tx.execute(sql`DELETE FROM notification_logs WHERE notification_id IN (SELECT id FROM notifications WHERE user_id IN (${ids}))`);
  await tx.execute(sql`DELETE FROM notifications WHERE user_id IN (${ids})`);
  await tx.execute(sql`DELETE FROM notification_settings WHERE user_id IN (${ids})`);
  await tx.execute(sql`DELETE FROM password_reset_tokens WHERE user_id IN (${ids})`);
}

// Deletes the accounts and/or the employee record. If anything still refers to them (clients, invoices, tasks, audit
// entries...), nothing is deleted and they are archived instead: hidden, unable to sign in, history untouched.
export async function removePerson(input: { userIds: string[]; employeeId?: string | null }): Promise<RemovalMode> {
  const { userIds, employeeId } = input;
  try {
    await db.transaction(async (tx) => {
      await clearEphemeral(tx, userIds);
      if (userIds.length) await tx.delete(users).where(inArray(users.id, userIds));
      if (employeeId) await tx.delete(employees).where(eq(employees.id, employeeId));
    });
    // Their summary preferences have no foreign key; tidy up on a best-effort basis
    if (userIds.length) await db.execute(sql`DELETE FROM digest_preferences WHERE scope IN (${sql.join(userIds.map((i) => sql`${i}`), sql`, `)})`).catch(() => {});
    return "deleted";
  } catch (error) {
    if (pgError(error)?.code !== "23503") throw error;
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    if (userIds.length) await tx.update(users).set({ isActive: false, archivedAt: now, updatedAt: now }).where(inArray(users.id, userIds));
    if (employeeId) await tx.update(employees).set({ status: "inactive", archivedAt: now, updatedAt: now }).where(eq(employees.id, employeeId));
  });
  await Promise.all(userIds.map((id) => invalidateUserSessions(id)));
  return "archived";
}
