import crypto from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { apiTokens, oauthGrants, oauthTokens, roles, users } from "@shared/schema";
import { storage } from "../storage";

export const TOKEN_PREFIX = "nxc_";
export const ASSISTANT_USERNAME = "ai-assistant";
export const ASSISTANT_ROLE = "AI Assistant";

// Existing databases were created before access tokens existed, so the table is added at startup (idempotent)
export async function runApiTokensMigration(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        token_hash VARCHAR NOT NULL UNIQUE,
        prefix VARCHAR NOT NULL,
        created_by VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP,
        revoked_at TIMESTAMP
      )
    `);
  } catch (err) {
    console.error("⚠️ API tokens migration failed (non-fatal):", err);
  }
}

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export function generateToken() {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), prefix: token.slice(0, TOKEN_PREFIX.length + 6) };
}

export function bearerFrom(header: unknown): string | null {
  if (typeof header !== "string") return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m && (m[1].startsWith(TOKEN_PREFIX) || m[1].startsWith("nxo_")) ? m[1] : null;
}

// Per-token request budget: a runaway loop in a model client should not hammer the database
const WINDOW_MS = 60_000;
export const RATE_LIMIT = 120;
const hits = new Map<string, number[]>();
export function withinRate(tokenId: string, now = Date.now(), limit = RATE_LIMIT): boolean {
  const recent = (hits.get(tokenId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) { hits.set(tokenId, recent); return false; }
  recent.push(now);
  hits.set(tokenId, recent);
  return true;
}
export const resetRateLimits = () => hits.clear();

const lastTouched = new Map<string, number>();

export async function authenticateBearer(header: unknown) {
  const token = bearerFrom(header);
  if (!token) return null;
  if (token.startsWith("nxo_")) return authenticateOAuth(token);
  const [row] = await db.select().from(apiTokens).where(and(eq(apiTokens.tokenHash, hashToken(token)), isNull(apiTokens.revokedAt)));
  if (!row) return null;
  const user = await storage.getUser(row.userId);
  if (!user || user.isActive === false) return null;

  const now = Date.now();
  if (now - (lastTouched.get(row.id) ?? 0) > 60_000) {
    lastTouched.set(row.id, now);
    db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id)).catch(() => {});
  }
  return { user, tokenId: row.id };
}

// Access token issued through OAuth: acts as the administrator who approved the connection
async function authenticateOAuth(token: string) {
  const [row] = await db.select({ id: oauthTokens.id, expiresAt: oauthTokens.expiresAt, grantId: oauthGrants.id, userId: oauthGrants.userId })
    .from(oauthTokens)
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
    .where(and(eq(oauthTokens.tokenHash, hashToken(token)), eq(oauthTokens.kind, "access"), isNull(oauthGrants.revokedAt)));
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  const user = await storage.getUser(row.userId);
  if (!user || user.isActive === false) return null;

  const now = Date.now();
  if (now - (lastTouched.get(row.grantId) ?? 0) > 60_000) {
    lastTouched.set(row.grantId, now);
    db.update(oauthGrants).set({ lastUsedAt: new Date() }).where(eq(oauthGrants.id, row.grantId)).catch(() => {});
  }
  return { user, tokenId: row.grantId };
}

const MODULES = ["dashboard", "crm", "quotations", "invoices", "expenses", "paymentSources", "services", "projects", "employees", "users", "roles", "tasks", "analytics", "auditLogs"];

// What the assistant may do until an administrator changes the role: tasks and projects, nothing else
export function assistantPermissions() {
  const none = { view: false, add: false, edit: false, delete: false, approve: false };
  const perms: Record<string, typeof none> = Object.fromEntries(MODULES.map((m) => [m, { ...none }]));
  perms.tasks = { ...none, view: true, add: true, edit: true };
  perms.projects = { ...none, view: true, add: true, edit: true };
  return perms;
}

// The service account the assistant acts as. Created once, idempotent; it has no password that can be used to sign in.
export async function ensureAssistantAccount(createdBy?: string) {
  let [role] = await db.select().from(roles).where(eq(roles.name, ASSISTANT_ROLE));
  if (!role) {
    [role] = await db.insert(roles).values({
      name: ASSISTANT_ROLE,
      description: "Service account used by AI assistants through MCP. Limit what it may do here.",
      permissions: assistantPermissions(),
      createdBy,
    } as any).onConflictDoNothing().returning();
    if (!role) [role] = await db.select().from(roles).where(eq(roles.name, ASSISTANT_ROLE));
  }
  let [user] = await db.select().from(users).where(eq(users.username, ASSISTANT_USERNAME));
  if (!user) {
    [user] = await db.insert(users).values({
      username: ASSISTANT_USERNAME,
      email: "ai-assistant@system.invalid",
      // Not a bcrypt hash, so no password can ever match it
      passwordHash: `!disabled!${crypto.randomBytes(24).toString("hex")}`,
      firstName: "المساعد",
      lastName: "الذكي",
      role: ASSISTANT_ROLE,
      roleId: role.id,
      isActive: true,
      emailNotifications: false,
    }).onConflictDoNothing().returning();
    if (!user) [user] = await db.select().from(users).where(eq(users.username, ASSISTANT_USERNAME));
  } else if (!user.roleId) {
    await db.update(users).set({ roleId: role.id, role: ASSISTANT_ROLE }).where(eq(users.id, user.id));
  }
  return user;
}
