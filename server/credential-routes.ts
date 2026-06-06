import type { Express, Request, Response } from "express";
import { db } from "./db";
import { requirePermission } from "./auth";
import { clientCredentials, insertClientCredentialSchema } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { encryptSecret, decryptSecret } from "./crypto-utils";
import type { User } from "@shared/schema";

interface AuthRequest extends Request {
  user?: User & {
    permissions?: Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean; approve: boolean }>;
    roleName?: string;
  };
}

function isAdminOrManager(user: AuthRequest["user"]): boolean {
  const role = user?.role?.toLowerCase();
  const roleName = user?.roleName?.toLowerCase();
  return role === "admin" || role === "manager" || roleName === "admin" || roleName === "manager";
}

function safeDecrypt(encrypted: string | null): string {
  if (!encrypted) return "";
  try {
    return decryptSecret(encrypted);
  } catch {
    return "";
  }
}

const updateCredentialSchema = z.object({
  label: z.string().min(1).optional(),
  type: z.enum(["social", "website", "server", "email", "other"]).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
});

export function registerCredentialRoutes(app: Express) {
  // GET /api/clients/:id/credentials - list credentials for a client
  app.get("/api/clients/:id/credentials", requirePermission("crm", "view"), async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const canManage = isAdminOrManager(req.user);

      const rows = await db
        .select()
        .from(clientCredentials)
        .where(eq(clientCredentials.clientId, id))
        .orderBy(desc(clientCredentials.createdAt));

      const result = rows.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        label: row.label,
        type: row.type,
        username: row.username,
        url: row.url,
        notes: canManage ? row.notes : null,
        hasPassword: !!row.encryptedPassword,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching credentials:", error);
      res.status(500).json({ message: "Failed to fetch credentials" });
    }
  });

  // GET /api/clients/:clientId/credentials/:credId/password - reveal password (admin/manager only)
  app.get("/api/clients/:clientId/credentials/:credId/password", requirePermission("crm", "view"), async (req: any, res: Response) => {
    try {
      if (!isAdminOrManager(req.user)) {
        return res.status(403).json({ message: "Only admins and managers can reveal passwords" });
      }

      const [row] = await db
        .select()
        .from(clientCredentials)
        .where(eq(clientCredentials.id, req.params.credId));

      if (!row || row.clientId !== req.params.clientId) {
        return res.status(404).json({ message: "Credential not found" });
      }

      const password = safeDecrypt(row.encryptedPassword);
      res.json({ password });
    } catch (error) {
      console.error("Error revealing password:", error);
      res.status(500).json({ message: "Failed to reveal password" });
    }
  });

  // POST /api/clients/:id/credentials - create credential (admin/manager only)
  app.post("/api/clients/:id/credentials", requirePermission("crm", "add"), async (req: any, res: Response) => {
    try {
      if (!isAdminOrManager(req.user)) {
        return res.status(403).json({ message: "Only admins and managers can add credentials" });
      }

      const parsed = insertClientCredentialSchema.safeParse({
        ...req.body,
        clientId: req.params.id,
        createdBy: req.user?.id,
      });

      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }

      const { password, ...rest } = parsed.data;
      const encryptedPassword = password ? encryptSecret(password) : null;

      const [created] = await db
        .insert(clientCredentials)
        .values({ ...rest, encryptedPassword })
        .returning();

      res.status(201).json({
        id: created.id,
        clientId: created.clientId,
        label: created.label,
        type: created.type,
        username: created.username,
        url: created.url,
        notes: created.notes,
        hasPassword: !!created.encryptedPassword,
        createdBy: created.createdBy,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      });
    } catch (error) {
      console.error("Error creating credential:", error);
      res.status(500).json({ message: "Failed to create credential" });
    }
  });

  // PATCH /api/clients/:clientId/credentials/:credId - update credential (admin/manager only)
  app.patch("/api/clients/:clientId/credentials/:credId", requirePermission("crm", "edit"), async (req: any, res: Response) => {
    try {
      if (!isAdminOrManager(req.user)) {
        return res.status(403).json({ message: "Only admins and managers can edit credentials" });
      }

      const [existing] = await db
        .select()
        .from(clientCredentials)
        .where(eq(clientCredentials.id, req.params.credId));

      if (!existing || existing.clientId !== req.params.clientId) {
        return res.status(404).json({ message: "Credential not found" });
      }

      const parsed = updateCredentialSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }

      const { password, ...fields } = parsed.data;

      const updateData: Partial<typeof clientCredentials.$inferInsert> & { updatedAt: Date; encryptedPassword?: string | null } = {
        ...fields,
        updatedAt: new Date(),
      };

      if (password !== undefined) {
        updateData.encryptedPassword = password ? encryptSecret(password) : null;
      }

      const [updated] = await db
        .update(clientCredentials)
        .set(updateData)
        .where(eq(clientCredentials.id, req.params.credId))
        .returning();

      res.json({
        id: updated.id,
        clientId: updated.clientId,
        label: updated.label,
        type: updated.type,
        username: updated.username,
        url: updated.url,
        notes: updated.notes,
        hasPassword: !!updated.encryptedPassword,
        createdBy: updated.createdBy,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      console.error("Error updating credential:", error);
      res.status(500).json({ message: "Failed to update credential" });
    }
  });

  // DELETE /api/clients/:clientId/credentials/:credId - delete credential (admin/manager only)
  app.delete("/api/clients/:clientId/credentials/:credId", requirePermission("crm", "delete"), async (req: any, res: Response) => {
    try {
      if (!isAdminOrManager(req.user)) {
        return res.status(403).json({ message: "Only admins and managers can delete credentials" });
      }

      const [existing] = await db
        .select()
        .from(clientCredentials)
        .where(eq(clientCredentials.id, req.params.credId));

      if (!existing || existing.clientId !== req.params.clientId) {
        return res.status(404).json({ message: "Credential not found" });
      }

      await db.delete(clientCredentials).where(eq(clientCredentials.id, req.params.credId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting credential:", error);
      res.status(500).json({ message: "Failed to delete credential" });
    }
  });
}
