import type { Express, Request, Response } from "express";
import express from "express";
import crypto from "crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { oauthClients, oauthCodes, oauthGrants, oauthTokens } from "@shared/schema";
import { requireAdmin, requireAuth } from "../auth";
import { logAudit } from "../audit";
import {
  ACCESS_PREFIX, ACCESS_TTL_MS, CODE_TTL_MS, REFRESH_PREFIX, REFRESH_TTL_MS,
  authorizationServerMetadata, baseUrlFor, isAllowedRedirectUri, newSecret, protectedResourceMetadata,
  resourceMatches, sha256, validChallenge, verifyPkce,
} from "./core";

export async function runOAuthMigration(): Promise<void> {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS oauth_clients (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), client_id VARCHAR NOT NULL UNIQUE, client_name VARCHAR NOT NULL,
      redirect_uris JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS oauth_grants (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), client_id VARCHAR NOT NULL,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(), last_used_at TIMESTAMP, revoked_at TIMESTAMP)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS oauth_codes (
      code_hash VARCHAR PRIMARY KEY, client_id VARCHAR NOT NULL,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      redirect_uri TEXT NOT NULL, code_challenge VARCHAR NOT NULL, grant_id VARCHAR,
      expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS oauth_tokens (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), token_hash VARCHAR NOT NULL UNIQUE, kind VARCHAR NOT NULL,
      grant_id VARCHAR NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`);
  } catch (err) {
    console.error("⚠️ OAuth migration failed (non-fatal):", err);
  }
}

// Expired codes and tokens carry no value; clear them out now and then
export async function purgeExpiredOAuth(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, cutoff));
  await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, cutoff));
}

let purgeTimer: NodeJS.Timeout | null = null;
export function startOAuthPurge() {
  if (purgeTimer) return;
  purgeTimer = setInterval(() => purgeExpiredOAuth().catch(() => {}), 6 * 60 * 60 * 1000);
  purgeTimer.unref();
}

const oauthError = (res: Response, status: number, error: string, description?: string) =>
  res.status(status).set("Cache-Control", "no-store").json({ error, ...(description ? { error_description: description } : {}) });

// Registration is open by design (RFC 7591), so it is rate limited per address
const regHits = new Map<string, number[]>();
function registrationAllowed(ip: string, now = Date.now()) {
  const recent = (regHits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= 30) { regHits.set(ip, recent); return false; }
  recent.push(now);
  regHits.set(ip, recent);
  return true;
}

async function loadClient(clientId: unknown) {
  if (typeof clientId !== "string" || !clientId) return null;
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId));
  return client ?? null;
}

async function issueTokens(grantId: string) {
  const access = newSecret(ACCESS_PREFIX);
  const refresh = newSecret(REFRESH_PREFIX);
  const now = Date.now();
  await db.insert(oauthTokens).values([
    { tokenHash: access.hash, kind: "access", grantId, expiresAt: new Date(now + ACCESS_TTL_MS) },
    { tokenHash: refresh.hash, kind: "refresh", grantId, expiresAt: new Date(now + REFRESH_TTL_MS) },
  ]);
  return {
    access_token: access.value,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refresh.value,
    scope: "mcp",
  };
}

const revokeGrant = (grantId: string) => db.update(oauthGrants).set({ revokedAt: new Date() }).where(and(eq(oauthGrants.id, grantId), isNull(oauthGrants.revokedAt)));

// Public endpoints: discovery, registration, token and revocation. Mounted before the session and CSRF middleware.
export function registerOAuthRoutes(app: Express) {
  const form = express.urlencoded({ extended: false, limit: "50kb" });

  const protectedResource = (req: Request, res: Response) => res.json(protectedResourceMetadata(baseUrlFor(req as any)));
  app.get("/.well-known/oauth-protected-resource", protectedResource);
  app.get("/.well-known/oauth-protected-resource/mcp", protectedResource);
  const authServer = (req: Request, res: Response) => res.json(authorizationServerMetadata(baseUrlFor(req as any)));
  app.get("/.well-known/oauth-authorization-server", authServer);
  app.get("/.well-known/oauth-authorization-server/mcp", authServer);

  app.post("/oauth/register", async (req: Request, res: Response) => {
    try {
      if (!registrationAllowed(req.ip || "unknown")) return oauthError(res, 429, "temporarily_unavailable", "Too many registrations");
      const body = z.object({
        client_name: z.string().trim().max(120).optional(),
        redirect_uris: z.array(z.string()).min(1).max(10),
      }).passthrough().parse(req.body);
      if (!body.redirect_uris.every((u) => isAllowedRedirectUri(u))) {
        return oauthError(res, 400, "invalid_redirect_uri", "Redirect URI is not on an allowed host");
      }
      const clientId = `nxcl_${crypto.randomBytes(16).toString("base64url")}`;
      const name = body.client_name || "MCP client";
      await db.insert(oauthClients).values({ clientId, clientName: name, redirectUris: body.redirect_uris });
      res.status(201).set("Cache-Control", "no-store").json({
        client_id: clientId,
        client_name: name,
        redirect_uris: body.redirect_uris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        client_id_issued_at: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return oauthError(res, 400, "invalid_client_metadata", "redirect_uris is required");
      console.error("OAuth register failed:", error);
      oauthError(res, 500, "server_error");
    }
  });

  app.post("/oauth/token", form, async (req: Request, res: Response) => {
    try {
      const b = (req.body ?? {}) as Record<string, any>;
      const base = baseUrlFor(req as any);
      if (!resourceMatches(b.resource, base)) return oauthError(res, 400, "invalid_target", "Unknown resource");
      const client = await loadClient(b.client_id);
      if (!client) return oauthError(res, 401, "invalid_client", "Unknown client");

      if (b.grant_type === "authorization_code") {
        if (typeof b.code !== "string" || typeof b.redirect_uri !== "string") return oauthError(res, 400, "invalid_request", "code and redirect_uri are required");
        // Claim the code first so two parallel exchanges cannot both succeed
        const [code] = await db.update(oauthCodes).set({ usedAt: new Date() })
          .where(and(eq(oauthCodes.codeHash, sha256(b.code)), isNull(oauthCodes.usedAt))).returning();
        if (!code || code.expiresAt.getTime() < Date.now()) return oauthError(res, 400, "invalid_grant", "Authorization code is invalid or expired");
        if (code.clientId !== client.clientId || code.redirectUri !== b.redirect_uri) return oauthError(res, 400, "invalid_grant", "Code was issued for a different client or redirect URI");
        if (!verifyPkce(b.code_verifier, code.codeChallenge)) return oauthError(res, 400, "invalid_grant", "PKCE verification failed");
        const [grant] = await db.insert(oauthGrants).values({ clientId: client.clientId, userId: code.userId }).returning();
        return res.set("Cache-Control", "no-store").json(await issueTokens(grant.id));
      }

      if (b.grant_type === "refresh_token") {
        if (typeof b.refresh_token !== "string") return oauthError(res, 400, "invalid_request", "refresh_token is required");
        const hash = sha256(b.refresh_token);
        const [row] = await db.select().from(oauthTokens).where(and(eq(oauthTokens.tokenHash, hash), eq(oauthTokens.kind, "refresh")));
        if (!row) return oauthError(res, 400, "invalid_grant", "Refresh token is invalid");
        const [grant] = await db.select().from(oauthGrants).where(eq(oauthGrants.id, row.grantId));
        if (!grant || grant.revokedAt || grant.clientId !== client.clientId) return oauthError(res, 400, "invalid_grant", "Refresh token is invalid");
        if (row.expiresAt.getTime() < Date.now()) return oauthError(res, 400, "invalid_grant", "Refresh token expired");
        const [claimed] = await db.update(oauthTokens).set({ usedAt: new Date() })
          .where(and(eq(oauthTokens.id, row.id), isNull(oauthTokens.usedAt))).returning({ id: oauthTokens.id });
        if (!claimed) {
          // A rotated token came back: assume it leaked and end the whole connection
          await revokeGrant(grant.id);
          return oauthError(res, 400, "invalid_grant", "Refresh token was already used");
        }
        return res.set("Cache-Control", "no-store").json(await issueTokens(grant.id));
      }

      oauthError(res, 400, "unsupported_grant_type");
    } catch (error) {
      console.error("OAuth token failed:", error);
      oauthError(res, 500, "server_error");
    }
  });

  // RFC 7009: always answers 200, whether or not the token existed
  app.post("/oauth/revoke", form, async (req: Request, res: Response) => {
    try {
      const token = (req.body ?? {}).token;
      if (typeof token === "string" && token) {
        const [row] = await db.select().from(oauthTokens).where(eq(oauthTokens.tokenHash, sha256(token)));
        if (row) await revokeGrant(row.grantId);
      }
    } catch (error) {
      console.error("OAuth revoke failed:", error);
    }
    res.status(200).set("Cache-Control", "no-store").json({});
  });
}

const authorizeParams = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().min(1),
  response_type: z.literal("code"),
  code_challenge: z.string().refine(validChallenge),
  code_challenge_method: z.literal("S256"),
  state: z.string().max(2000).optional(),
  resource: z.string().max(2000).optional(),
});

// Validates an authorization request. Anything wrong here is shown to the person instead of redirecting back to the app.
async function checkAuthorizeRequest(req: any, input: unknown) {
  const parsed = authorizeParams.safeParse(input);
  if (!parsed.success) return { error: "invalid_request" as const };
  const p = parsed.data;
  const client = await loadClient(p.client_id);
  if (!client) return { error: "unknown_client" as const };
  if (!(client.redirectUris as string[]).includes(p.redirect_uri)) return { error: "redirect_mismatch" as const };
  if (!resourceMatches(p.resource, baseUrlFor(req))) return { error: "invalid_resource" as const };
  return { client, params: p };
}

// Consent endpoints use the normal browser session (and CSRF) because the administrator is signed in to the web app
export function registerOAuthConsentRoutes(app: Express) {
  app.get("/api/oauth/authorize-info", requireAuth, async (req: any, res) => {
    try {
      const r = await checkAuthorizeRequest(req, req.query);
      if ("error" in r) return res.status(400).json({ error: r.error });
      res.json({ clientName: r.client.clientName, canApprove: req.user?.roleName === "Admin" });
    } catch (error) {
      console.error("OAuth authorize-info failed:", error);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/oauth/authorize", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const decision = req.body?.decision === "deny" ? "deny" : "allow";
      const r = await checkAuthorizeRequest(req, req.body);
      if ("error" in r) return res.status(400).json({ error: r.error });
      const { client, params } = r;
      const target = new URL(params.redirect_uri);
      if (params.state) target.searchParams.set("state", params.state);

      if (decision === "deny") {
        target.searchParams.set("error", "access_denied");
        return res.json({ redirectUrl: target.toString() });
      }
      const code = newSecret("nxc_code_");
      await db.insert(oauthCodes).values({
        codeHash: code.hash, clientId: client.clientId, userId: req.user.id,
        redirectUri: params.redirect_uri, codeChallenge: params.code_challenge,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });
      await logAudit(req, "approve_oauth_client", "oauth_client", client.clientId, null, { name: client.clientName });
      target.searchParams.set("code", code.value);
      res.json({ redirectUrl: target.toString() });
    } catch (error) {
      console.error("OAuth authorize failed:", error);
      res.status(500).json({ error: "server_error" });
    }
  });
}
