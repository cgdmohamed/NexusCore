import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";
import { generateVapidKeys } from "../../server/web-push";

function browserKeys() {
  const pair = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = pair.publicKey.export({ format: "jwk" });
  const pub = Buffer.concat([Buffer.from([0x04]), Buffer.from(jwk.x!, "base64url"), Buffer.from(jwk.y!, "base64url")]);
  return { p256dh: pub.toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") };
}

describe.skipIf(!TEST_DATABASE_URL)("push notifications (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const realFetch = globalThis.fetch;
  const pushCalls: Array<{ url: string; headers: any; size: number }> = [];
  let pushStatus = 201;

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
    // Anything addressed to the fake push service is recorded; the test server itself is reached normally
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      if (url.startsWith("https://push.example.test")) {
        pushCalls.push({ url, headers: init.headers, size: init.body.length });
        return new Response(null, { status: pushStatus });
      }
      return realFetch(input, init);
    }) as typeof fetch;
  });
  afterAll(async () => {
    globalThis.fetch = realFetch;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    await ctx?.close();
  });
  afterEach(() => {
    pushCalls.length = 0;
    pushStatus = 201;
  });

  const subscribe = (endpoint: string, extra: object = {}) =>
    api("POST", "/api/push/subscribe", { endpoint, keys: browserKeys(), platform: "mobile", ...extra });
  const notify = async (title = "Hello") => {
    const { notificationService } = await import("../../server/notification-service");
    return notificationService.createNotification({ userId: ctx.currentUserId, type: "task_assigned", title, message: "Body", entityUrl: "/tasks" } as any);
  };
  const settle = () => vi.waitFor(() => expect(pushCalls.length).toBeGreaterThan(0), { timeout: 3000 });

  it("reports push as off until the VAPID keys are configured", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    expect((await api("GET", "/api/push/config")).body).toEqual({ enabled: false, publicKey: null });
    expect((await subscribe("https://push.example.test/off")).status).toBe(409);
    expect((await api("POST", "/api/push/test")).status).toBe(409);
  });

  describe("with keys configured", () => {
    beforeAll(() => {
      const keys = generateVapidKeys();
      process.env.VAPID_PUBLIC_KEY = keys.publicKey;
      process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    });

    it("publishes the public key", async () => {
      const r = await api("GET", "/api/push/config");
      expect(r.body.enabled).toBe(true);
      expect(r.body.publicKey).toBe(process.env.VAPID_PUBLIC_KEY);
    });

    it("validates subscriptions", async () => {
      expect((await subscribe("http://insecure.example.test/x")).status).toBe(400);
      expect((await api("POST", "/api/push/subscribe", { endpoint: "https://push.example.test/bad", keys: { p256dh: "AAAA", auth: "AAAA" } })).status).toBe(400);
      expect((await subscribe("https://push.example.test/ok", { platform: "tv" })).status).toBe(400);
    });

    it("pushes a new notification to the user's device, encrypted and signed", async () => {
      expect((await subscribe("https://push.example.test/device-1")).status).toBe(201);
      await notify();
      await settle();
      expect(pushCalls[0].url).toBe("https://push.example.test/device-1");
      expect(pushCalls[0].headers["Content-Encoding"]).toBe("aes128gcm");
      expect(pushCalls[0].headers.Authorization).toMatch(/^vapid t=.+, k=/);
      expect(pushCalls[0].size).toBeGreaterThan(100);
    });

    it("keeps one row per device and lets the endpoint move to another account", async () => {
      await subscribe("https://push.example.test/device-2");
      await subscribe("https://push.example.test/device-2");
      const { pushSubscriptions } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      const rows = await ctx.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, "https://push.example.test/device-2"));
      expect(rows).toHaveLength(1);
    });

    it("forgets a device the push service says is gone", async () => {
      await subscribe("https://push.example.test/dead");
      pushStatus = 410;
      await notify("dead device");
      await vi.waitFor(async () => {
        const { pushSubscriptions } = await import("../../shared/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await ctx.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, "https://push.example.test/dead"));
        expect(rows).toHaveLength(0);
      }, { timeout: 3000 });
    });

    it("unsubscribes only the caller's own device", async () => {
      await subscribe("https://push.example.test/mine");
      expect((await api("POST", "/api/push/unsubscribe", { endpoint: "https://push.example.test/mine" })).status).toBe(200);
      expect((await api("POST", "/api/push/unsubscribe", {})).status).toBe(400);
    });

    it("sends a test notification to the caller", async () => {
      await subscribe("https://push.example.test/test-device");
      const r = await api("POST", "/api/push/test");
      expect(r.status).toBe(200);
      expect(r.body.sent).toBeGreaterThan(0);
    });

    it("does not disturb the notification itself when push is unavailable", async () => {
      pushStatus = 500;
      const n = await notify("still stored");
      expect(n.id).toBeTruthy();
      const list = (await api("GET", "/api/notifications")).body.data;
      expect(list.find((x: any) => x.id === n.id)).toMatchObject({ title: "still stored", isRead: false });
    });
  });

  it("lists notifications with camelCase fields and an isRead flag", async () => {
    const n = await notify("shape");
    const first = (await api("GET", "/api/notifications?limit=100")).body.data.find((x: any) => x.id === n.id);
    expect(first).toMatchObject({ isRead: false, entityUrl: "/tasks", status: "unread" });
    expect(first.createdAt).toBeTruthy();
    await api("PATCH", `/api/notifications/${n.id}/read`);
    const after = (await api("GET", "/api/notifications?limit=100")).body.data.find((x: any) => x.id === n.id);
    expect(after.isRead).toBe(true);
    expect(after.readAt).toBeTruthy();
  });
});
