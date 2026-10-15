import type { Express } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { aiChats, aiSettings } from "@shared/schema";
import { requireAdmin, requireAuth } from "../auth";
import { decryptSecret, encryptSecret } from "../crypto-utils";
import { logAudit } from "../audit";
import { APP_TIMEZONE, dayKey } from "../task-insights";
import { createToolkit } from "../mcp/tools";
import { resolveNames } from "./names";
import { buildSystemPrompt, chatTitle, resolvePending, sendMessage, toView, type ChatState } from "./agent";
import { createProvider, DEFAULT_MODELS, ProviderError, type ProviderKind } from "./providers";

const MAX_TEXT = 2000;
const HOURLY_LIMIT = 30;

export async function runAiChatMigration(): Promise<void> {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ai_settings (
      id VARCHAR PRIMARY KEY DEFAULT 'default', provider VARCHAR NOT NULL DEFAULT 'anthropic', model VARCHAR, api_key_enc TEXT,
      enabled BOOLEAN NOT NULL DEFAULT TRUE, updated_by VARCHAR, updated_at TIMESTAMP DEFAULT NOW())`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ai_chats (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb, pending JSONB, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ai_chats_user_idx ON ai_chats (user_id, updated_at)`);
  } catch (err) {
    console.error("⚠️ AI chat migration failed (non-fatal):", err);
  }
}

export interface ChatSettings { provider: ProviderKind; model: string; apiKey: string | null; enabled: boolean; source: "database" | "environment" | "none" }

// The key the administrator saved, or the server's environment as a fallback
export async function loadSettings(): Promise<ChatSettings> {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, "default"));
  if (row?.apiKeyEnc) {
    try {
      const provider: ProviderKind = row.provider === "openai" ? "openai" : "anthropic";
      return { provider, model: row.model || DEFAULT_MODELS[provider], apiKey: decryptSecret(row.apiKeyEnc), enabled: row.enabled, source: "database" };
    } catch { /* an unreadable key is treated as not configured */ }
  }
  const envAnthropic = process.env.ANTHROPIC_API_KEY;
  const envOpenAI = process.env.OPENAI_API_KEY;
  const provider: ProviderKind = process.env.AI_CHAT_PROVIDER === "openai" || (!envAnthropic && !!envOpenAI) ? "openai" : "anthropic";
  const apiKey = (provider === "openai" ? envOpenAI : envAnthropic) || null;
  return { provider, model: row?.model || process.env.AI_CHAT_MODEL || DEFAULT_MODELS[provider], apiKey, enabled: row?.enabled ?? true, source: apiKey ? "environment" : "none" };
}

const hits = new Map<string, number[]>();
function withinHourlyLimit(userId: string, now = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= HOURLY_LIMIT) { hits.set(userId, recent); return false; }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}
export const resetAiChatLimits = () => hits.clear();

const busy = new Set<string>();

const userName = (u: any) => [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "the user";

async function currentChat(userId: string) {
  const [chat] = await db.select().from(aiChats).where(eq(aiChats.userId, userId)).orderBy(desc(aiChats.updatedAt)).limit(1);
  return chat ?? null;
}

async function ownChat(userId: string, id: string) {
  const [chat] = await db.select().from(aiChats).where(and(eq(aiChats.id, id), eq(aiChats.userId, userId))).limit(1);
  return chat ?? null;
}

// A person starts a new conversation without losing the others; an untouched empty one is reused rather than piled up
async function startChat(userId: string): Promise<string> {
  // A conversation that is answering its first message looks empty until it finishes, so it is never the one reused
  const candidates = await db.execute(sql`
    SELECT id FROM ai_chats WHERE user_id = ${userId} AND pending IS NULL AND jsonb_array_length(messages) = 0 ORDER BY updated_at DESC LIMIT 5`);
  const free = (((candidates as any).rows ?? candidates) as any[]).find((r) => !busy.has(r.id));
  if (free) {
    await db.update(aiChats).set({ updatedAt: new Date() }).where(eq(aiChats.id, free.id));
    return free.id;
  }
  return persist(null, userId, { messages: [], pending: null });
}

// The view of a conversation, with the waiting actions' ids turned into names
async function viewOf(state: ChatState) {
  const view = toView(state);
  if (view.pending?.length) {
    const names = await resolveNames(view.pending);
    for (const p of view.pending) if (names[p.id]) p.names = names[p.id];
  }
  return view;
}

const stateOf = (chat: { messages: unknown; pending: unknown } | null): ChatState => ({
  messages: ((chat?.messages as any[]) ?? []) as ChatState["messages"],
  pending: (chat?.pending as ChatState["pending"]) ?? null,
});

async function persist(chatId: string | null, userId: string, state: ChatState): Promise<string> {
  if (chatId) {
    await db.update(aiChats).set({ messages: state.messages as any, pending: state.pending as any, updatedAt: new Date() }).where(eq(aiChats.id, chatId));
    return chatId;
  }
  const [created] = await db.insert(aiChats).values({ userId, messages: state.messages as any, pending: state.pending as any }).returning({ id: aiChats.id });
  return created.id;
}

export function registerAiChatRoutes(app: Express) {
  // ── Administrator: provider, model and key ──
  app.get("/api/settings/ai-chat", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const s = await loadSettings();
      res.json({ provider: s.provider, model: s.model, enabled: s.enabled, hasKey: !!s.apiKey, keyLast4: s.apiKey ? s.apiKey.slice(-4) : null, source: s.source, defaults: DEFAULT_MODELS });
    } catch (error) {
      console.error("Error loading AI chat settings:", error);
      res.status(500).json({ message: "Failed to load settings" });
    }
  });

  app.put("/api/settings/ai-chat", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const body = z.object({
        provider: z.enum(["anthropic", "openai"]), model: z.string().trim().max(120).optional(),
        apiKey: z.string().trim().max(400).optional(), enabled: z.boolean(),
      }).parse(req.body);
      const [existing] = await db.select().from(aiSettings).where(eq(aiSettings.id, "default"));
      const apiKeyEnc = body.apiKey ? encryptSecret(body.apiKey) : existing?.apiKeyEnc ?? null;
      const values = { provider: body.provider, model: body.model || null, apiKeyEnc, enabled: body.enabled, updatedBy: req.user.id, updatedAt: new Date() };
      await db.insert(aiSettings).values({ id: "default", ...values }).onConflictDoUpdate({ target: aiSettings.id, set: values });
      await logAudit(req, "update_ai_chat_settings", "ai_settings", "default", null, { provider: body.provider, model: body.model, enabled: body.enabled, keyChanged: !!body.apiKey });
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid settings" });
      console.error("Error saving AI chat settings:", error);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  app.post("/api/settings/ai-chat/test", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const s = await loadSettings();
      if (!s.apiKey) return res.json({ ok: false, message: "No API key is set." });
      await createProvider(s.provider, s.apiKey, s.model).complete({ system: "Reply with the single word OK.", messages: [{ role: "user", text: "ping" }], tools: [] });
      res.json({ ok: true });
    } catch (error) {
      res.json({ ok: false, message: error instanceof ProviderError ? error.message : "The test failed." });
    }
  });

  // ── The person chatting ──
  app.get("/api/ai-chat/status", requireAuth, async (req: any, res) => {
    try {
      const s = await loadSettings();
      const tools = createToolkit(req, { source: "chat" }).tools;
      res.json({ enabled: s.enabled && !!s.apiKey && tools.length > 0 });
    } catch (error) {
      console.error("Error loading AI chat status:", error);
      res.json({ enabled: false });
    }
  });

  app.get("/api/ai-chat/current", requireAuth, async (req: any, res) => {
    try {
      const chat = await currentChat(req.user.id);
      res.json({ chatId: chat?.id ?? null, ...(await viewOf(stateOf(chat))) });
    } catch (error) {
      console.error("Error loading the AI chat:", error);
      res.status(500).json({ message: "Failed to load the conversation" });
    }
  });

  app.post("/api/ai-chat/new", requireAuth, async (req: any, res) => {
    try {
      await startChat(req.user.id);
      res.json({ chatId: null, items: [], pending: null });
    } catch (error) {
      console.error("Error starting a new AI chat:", error);
      res.status(500).json({ message: "Failed to start a new conversation" });
    }
  });

  // ── Several conversations at once: each has its own history and its own busy lock ──
  app.get("/api/ai-chat/chats", requireAuth, async (req: any, res) => {
    try {
      const result = await db.execute(sql`
        SELECT c.id, c.updated_at, (c.pending IS NOT NULL) AS awaiting,
               (SELECT m->>'text' FROM jsonb_array_elements(c.messages) m WHERE m->>'role' = 'user' LIMIT 1) AS first_text
        FROM ai_chats c
        WHERE c.user_id = ${req.user.id} AND jsonb_array_length(c.messages) > 0
        ORDER BY c.updated_at DESC LIMIT 50`);
      const rows = ((result as any).rows ?? result) as any[];
      res.json(rows.map((r) => ({ id: r.id, title: chatTitle(r.first_text), updatedAt: r.updated_at, awaiting: !!r.awaiting })));
    } catch (error) {
      console.error("Error listing AI chats:", error);
      res.status(500).json({ message: "Failed to load the conversations" });
    }
  });

  app.post("/api/ai-chat/chats", requireAuth, async (req: any, res) => {
    try {
      res.json({ chatId: await startChat(req.user.id), items: [], pending: null });
    } catch (error) {
      console.error("Error starting an AI chat:", error);
      res.status(500).json({ message: "Failed to start a new conversation" });
    }
  });

  app.get("/api/ai-chat/chats/:id", requireAuth, async (req: any, res) => {
    try {
      const chat = await ownChat(req.user.id, req.params.id);
      if (!chat) return res.status(404).json({ message: "Conversation not found" });
      res.json({ chatId: chat.id, ...(await viewOf(stateOf(chat))) });
    } catch (error) {
      console.error("Error loading the AI chat:", error);
      res.status(500).json({ message: "Failed to load the conversation" });
    }
  });

  app.delete("/api/ai-chat/chats/:id", requireAuth, async (req: any, res) => {
    try {
      const chat = await ownChat(req.user.id, req.params.id);
      if (!chat) return res.status(404).json({ message: "Conversation not found" });
      if (busy.has(chat.id)) return res.status(409).json({ message: "The assistant is still working on this conversation." });
      await db.delete(aiChats).where(eq(aiChats.id, chat.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting the AI chat:", error);
      res.status(500).json({ message: "Failed to delete the conversation" });
    }
  });

  // One turn: used for both a new message and the answer to a confirmation.
  // Without a chat id it works on the latest conversation (older clients); with one, on that conversation only.
  async function turn(req: any, res: any, action: "message" | "confirm", chatId?: string) {
    const userId = req.user.id;
    const chat = chatId ? await ownChat(userId, chatId) : await currentChat(userId);
    if (chatId && !chat) return res.status(404).json({ message: "Conversation not found" });
    const state = stateOf(chat);
    const key = chat?.id ?? `new:${userId}`;
    if (busy.has(key)) return res.status(409).json({ message: "The assistant is still working on your last request." });

    const parsed = action === "message"
      ? z.object({ text: z.string().trim().min(1).max(MAX_TEXT), language: z.enum(["ar", "en"]).optional() }).safeParse(req.body)
      : z.object({ approve: z.boolean(), language: z.enum(["ar", "en"]).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: action === "message" ? `Write a message of up to ${MAX_TEXT} characters.` : "Say whether to approve." });
    if (action === "message" && state.pending) return res.status(409).json({ message: "Confirm or cancel the waiting action first." });
    if (action === "confirm" && !state.pending) return res.status(409).json({ message: "Nothing is waiting for confirmation." });

    const settings = await loadSettings();
    if (!settings.enabled || !settings.apiKey) return res.status(503).json({ code: "not_configured", message: "The assistant is not set up yet. Ask an administrator." });
    const toolkit = createToolkit(req, { source: "chat" });
    if (toolkit.tools.length === 0) return res.status(403).json({ message: "Your role has no permissions the assistant can use." });
    if (!withinHourlyLimit(userId)) return res.status(429).json({ message: "You have reached the hourly limit for assistant messages. Try again later." });

    const language = (parsed.data as any).language ?? "ar";
    const system = buildSystemPrompt({ name: userName(req.user), language, today: dayKey(new Date(), APP_TIMEZONE), userId: userId, role: req.user?.roleName, tools: toolkit.tools.map((t) => t.name) });
    const provider = createProvider(settings.provider, settings.apiKey, settings.model);
    const deps = { provider, toolkit, system };

    busy.add(key);
    const snapshot = state.messages.length;
    try {
      if (action === "message") await sendMessage(state, (parsed.data as any).text, deps);
      else await resolvePending(state, (parsed.data as any).approve, deps);
      const chatId = await persist(chat?.id ?? null, userId, state);
      res.json({ chatId, ...(await viewOf(state)) });
    } catch (error) {
      const message = error instanceof ProviderError ? error.message : "The assistant could not answer.";
      if (!(error instanceof ProviderError)) console.error("AI chat failed:", error);
      if (action === "message") {
        // Nothing that changes data runs before confirmation, so the message can simply be dropped and retyped
        state.messages.length = snapshot;
        return res.status(error instanceof ProviderError ? error.status : 500).json({ message });
      }
      // The confirmed action already ran: keep that on record even though the follow-up failed
      const chatId = await persist(chat?.id ?? null, userId, state);
      res.status(error instanceof ProviderError ? error.status : 500).json({ message, chatId, ...(await viewOf(state)) });
    } finally {
      busy.delete(key);
    }
  }

  app.post("/api/ai-chat/messages", requireAuth, (req, res) => { turn(req, res, "message").catch((e) => { console.error(e); res.status(500).json({ message: "The assistant could not answer." }); }); });
  app.post("/api/ai-chat/chats/:id/messages", requireAuth, (req, res) => { turn(req, res, "message", req.params.id).catch((e) => { console.error(e); res.status(500).json({ message: "The assistant could not answer." }); }); });
  app.post("/api/ai-chat/chats/:id/confirm", requireAuth, (req, res) => { turn(req, res, "confirm", req.params.id).catch((e) => { console.error(e); res.status(500).json({ message: "The assistant could not answer." }); }); });
  app.post("/api/ai-chat/confirm", requireAuth, (req, res) => { turn(req, res, "confirm").catch((e) => { console.error(e); res.status(500).json({ message: "The assistant could not answer." }); }); });
}
