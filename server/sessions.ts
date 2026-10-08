import { pool } from "./db";

/**
 * Ends every stored login session of a user (e.g. after a password change or deactivation).
 * `exceptSid` keeps the session that made the request, so the person stays signed in.
 */
export async function invalidateUserSessions(userId: string, exceptSid?: string | null): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM sessions WHERE sess->'passport'->>'user' = $1 AND ($2::text IS NULL OR sid <> $2::text)`,
      [userId, exceptSid ?? null],
    );
  } catch (error) {
    console.error("Failed to invalidate user sessions:", error);
  }
}
