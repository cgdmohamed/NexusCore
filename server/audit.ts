import { db } from "./db";
import { auditLogs } from "@shared/schema";

/**
 * Writes an audit-log entry for the signed-in user of `req`, with the caller's real IP
 * (honours `trust proxy`) and user agent. Never throws: auditing must not break the action itself.
 */
export async function logAudit(
  req: any,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues?: unknown,
  newValues?: unknown,
) {
  try {
    await db.insert(auditLogs).values({
      userId: req?.user?.id ?? null,
      action,
      entityType,
      entityId,
      oldValues: (oldValues ?? null) as any,
      newValues: (newValues ?? null) as any,
      ipAddress: req?.ip ?? null,
      userAgent: (typeof req?.get === "function" ? req.get("user-agent") : req?.headers?.["user-agent"]) ?? null,
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
