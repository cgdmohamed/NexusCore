import type { Express } from "express";
import { desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { apiTokens, oauthClients, oauthGrants, roles, users } from "@shared/schema";
import { requireAdmin, requireAuth } from "./auth";
import { logAudit } from "./audit";
import { ASSISTANT_ROLE, ASSISTANT_USERNAME, ensureAssistantAccount, generateToken } from "./mcp/tokens";

// Administrators manage the assistant's access tokens here
export function registerAiAccessRoutes(app: Express) {
  const baseUrl = (req: any) => (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");

  app.get("/api/settings/ai-access", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const [assistant] = await db.select({ id: users.id, roleId: users.roleId }).from(users).where(eq(users.username, ASSISTANT_USERNAME));
      const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, ASSISTANT_ROLE));
      const tokens = assistant
        ? await db.select({ id: apiTokens.id, name: apiTokens.name, prefix: apiTokens.prefix, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt, revokedAt: apiTokens.revokedAt })
            .from(apiTokens).where(eq(apiTokens.userId, assistant.id)).orderBy(desc(apiTokens.createdAt))
        : [];
      const connections = await db.select({
          id: oauthGrants.id, clientName: oauthClients.clientName, approvedBy: users.username,
          approverFirstName: users.firstName, approverLastName: users.lastName,
          createdAt: oauthGrants.createdAt, lastUsedAt: oauthGrants.lastUsedAt,
        }).from(oauthGrants)
        .innerJoin(users, eq(users.id, oauthGrants.userId))
        .leftJoin(oauthClients, eq(oauthClients.clientId, oauthGrants.clientId))
        .where(isNull(oauthGrants.revokedAt)).orderBy(desc(oauthGrants.createdAt));
      res.json({ mcpUrl: `${baseUrl(req)}/mcp`, assistant: assistant ? { id: assistant.id, roleId: role?.id ?? assistant.roleId } : null, tokens, connections });
    } catch (error) {
      console.error("Error loading AI access:", error);
      res.status(500).json({ message: "Failed to load AI access" });
    }
  });

  app.post("/api/settings/ai-access/tokens", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
      const assistant = await ensureAssistantAccount(req.user.id);
      const { token, hash, prefix } = generateToken();
      const [row] = await db.insert(apiTokens).values({ userId: assistant.id, name, tokenHash: hash, prefix, createdBy: req.user.id }).returning();
      await logAudit(req, "create_api_token", "api_token", row.id, null, { name });
      // The only time the token itself is ever returned
      res.status(201).json({ id: row.id, name: row.name, prefix, token, roleId: assistant.roleId });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "A name for the token is required" });
      console.error("Error creating API token:", error);
      res.status(500).json({ message: "Failed to create token" });
    }
  });

  // A connected app (OAuth grant): revoking it ends its access and refresh tokens at once
  app.delete("/api/settings/ai-access/connections/:id", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const [row] = await db.update(oauthGrants).set({ revokedAt: new Date() })
        .where(eq(oauthGrants.id, req.params.id)).returning({ id: oauthGrants.id });
      if (!row) return res.status(404).json({ message: "Connection not found" });
      await logAudit(req, "revoke_oauth_grant", "oauth_grant", row.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking OAuth connection:", error);
      res.status(500).json({ message: "Failed to revoke connection" });
    }
  });

  app.delete("/api/settings/ai-access/tokens/:id", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const [row] = await db.update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, req.params.id)).returning({ id: apiTokens.id });
      if (!row) return res.status(404).json({ message: "Token not found" });
      await logAudit(req, "revoke_api_token", "api_token", row.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking API token:", error);
      res.status(500).json({ message: "Failed to revoke token" });
    }
  });
}
