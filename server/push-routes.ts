import type { Express } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { pushSubscriptions } from "@shared/schema";
import { requireAuth } from "./auth";
import { vapidFromEnv } from "./web-push";
import { pushToUser } from "./push-service";

// Existing databases were created before this table existed, so it is added at startup (idempotent)
async function runPushMigrations(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        platform VARCHAR NOT NULL DEFAULT 'desktop',
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP
      );
    `);
  } catch (err) {
    console.error("⚠️ Push migrations failed (non-fatal):", err);
  }
}

const keyLength = (bytes: number) => (v: string) => Buffer.from(v, "base64url").length === bytes;

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048).refine((u) => u.startsWith("https://"), "Endpoint must use https"),
  keys: z.object({
    p256dh: z.string().refine(keyLength(65), "Invalid public key"),
    auth: z.string().refine(keyLength(16), "Invalid auth secret"),
  }),
  platform: z.enum(["desktop", "mobile"]).default("desktop"),
});

export async function registerPushRoutes(app: Express): Promise<void> {
  await runPushMigrations();

  // Tells the browser whether push is available and which key to subscribe with
  app.get("/api/push/config", requireAuth, (_req, res) => {
    const vapid = vapidFromEnv();
    res.json({ enabled: !!vapid, publicKey: vapid?.publicKey ?? null });
  });

  app.post("/api/push/subscribe", requireAuth, async (req: any, res) => {
    try {
      if (!vapidFromEnv()) return res.status(409).json({ message: "Push notifications are not configured on the server." });
      const body = subscribeSchema.parse(req.body);
      const values = {
        userId: req.user.id as string,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        platform: body.platform,
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300) || null,
      };
      // A device belongs to whoever is signed in on it now
      await db.insert(pushSubscriptions).values(values).onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: values.userId, p256dh: values.p256dh, auth: values.auth, platform: values.platform, userAgent: values.userAgent },
      });
      res.status(201).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid subscription", errors: error.errors });
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", requireAuth, async (req: any, res) => {
    try {
      const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
      if (!endpoint) return res.status(400).json({ message: "endpoint is required" });
      await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, req.user.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing push subscription:", error);
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  // Lets a person check that their own devices receive notifications
  app.post("/api/push/test", requireAuth, async (req: any, res) => {
    try {
      if (!vapidFromEnv()) return res.status(409).json({ message: "Push notifications are not configured on the server." });
      const summary = await pushToUser(req.user.id, {
        type: "system_announcement",
        title: "Creative Code Nexus",
        message: "Push notifications are working on this device.",
        entityUrl: "/notifications",
      });
      res.json({ success: true, ...summary });
    } catch (error) {
      console.error("Error sending test push:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });
}
