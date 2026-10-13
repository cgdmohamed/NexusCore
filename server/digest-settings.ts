// Who gets the two daily task summaries, and when. The company sets the defaults and each person may override them.
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { requireAdmin, requireAuth } from "./auth";

export interface DigestPrefs {
  morningEnabled: boolean;
  morningHour: number;
  eveningEnabled: boolean;
  eveningHour: number;
}
// Per-person overrides: null means "follow the company setting"
export type DigestOverrides = { [K in keyof DigestPrefs]: DigestPrefs[K] | null };

export const DEFAULT_PREFS: DigestPrefs = { morningEnabled: true, morningHour: 6, eveningEnabled: true, eveningHour: 17 };

const hour = (v: unknown, fallback: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23 ? v : fallback);
const flag = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function mergePrefs(base: DigestPrefs, over?: Partial<DigestOverrides> | null): DigestPrefs {
  return {
    morningEnabled: flag(over?.morningEnabled, base.morningEnabled),
    morningHour: hour(over?.morningHour, base.morningHour),
    eveningEnabled: flag(over?.eveningEnabled, base.eveningEnabled),
    eveningHour: hour(over?.eveningHour, base.eveningHour),
  };
}

const COMPANY = "company";

export async function runDigestSettingsMigration(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS digest_preferences (
        scope VARCHAR PRIMARY KEY,
        morning_enabled BOOLEAN,
        morning_hour INTEGER,
        evening_enabled BOOLEAN,
        evening_hour INTEGER,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.error("⚠️ Digest settings migration failed (non-fatal):", err);
  }
}

const toOverrides = (r: any): DigestOverrides => ({
  morningEnabled: r?.morning_enabled ?? null,
  morningHour: r?.morning_hour ?? null,
  eveningEnabled: r?.evening_enabled ?? null,
  eveningHour: r?.evening_hour ?? null,
});

// Company defaults and every person's overrides in one read
export async function loadAllPrefs(): Promise<{ company: DigestPrefs; byUser: Map<string, DigestOverrides> }> {
  const result = await db.execute(sql`SELECT * FROM digest_preferences`);
  const rows = ((result as any).rows ?? result) as any[];
  const byUser = new Map<string, DigestOverrides>();
  let company = DEFAULT_PREFS;
  for (const r of rows) {
    if (r.scope === COMPANY) company = mergePrefs(DEFAULT_PREFS, toOverrides(r));
    else byUser.set(r.scope, toOverrides(r));
  }
  return { company, byUser };
}

async function save(scope: string, v: DigestOverrides) {
  await db.execute(sql`
    INSERT INTO digest_preferences (scope, morning_enabled, morning_hour, evening_enabled, evening_hour, updated_at)
    VALUES (${scope}, ${v.morningEnabled}, ${v.morningHour}, ${v.eveningEnabled}, ${v.eveningHour}, NOW())
    ON CONFLICT (scope) DO UPDATE SET morning_enabled = EXCLUDED.morning_enabled, morning_hour = EXCLUDED.morning_hour,
      evening_enabled = EXCLUDED.evening_enabled, evening_hour = EXCLUDED.evening_hour, updated_at = NOW()
  `);
}

const hourField = z.number().int().min(0).max(23);
const overrideSchema = z.object({
  morningEnabled: z.boolean().nullable(),
  morningHour: hourField.nullable(),
  eveningEnabled: z.boolean().nullable(),
  eveningHour: hourField.nullable(),
});
const companySchema = z.object({
  morningEnabled: z.boolean(), morningHour: hourField, eveningEnabled: z.boolean(), eveningHour: hourField,
});

export function registerDigestSettingsRoutes(app: Express) {
  app.get("/api/settings/digest", requireAuth, async (req: any, res) => {
    try {
      const { company, byUser } = await loadAllPrefs();
      const mine = byUser.get(req.user.id) ?? { morningEnabled: null, morningHour: null, eveningEnabled: null, eveningHour: null };
      res.json({ company, mine, effective: mergePrefs(company, mine), canEditCompany: req.user.roleName === "Admin" });
    } catch (error) {
      console.error("Error loading digest settings:", error);
      res.status(500).json({ message: "Failed to load digest settings" });
    }
  });

  app.put("/api/settings/digest/me", requireAuth, async (req: any, res) => {
    try {
      const body = overrideSchema.parse(req.body);
      await save(req.user.id, body);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid digest settings" });
      console.error("Error saving digest settings:", error);
      res.status(500).json({ message: "Failed to save digest settings" });
    }
  });

  app.put("/api/settings/digest/company", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const body = companySchema.parse(req.body);
      await save(COMPANY, body);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid digest settings" });
      console.error("Error saving company digest settings:", error);
      res.status(500).json({ message: "Failed to save digest settings" });
    }
  });
}
