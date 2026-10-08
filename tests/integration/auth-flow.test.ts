import bcrypt from "bcrypt";
import crypto from "crypto";
import express from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TEST_DATABASE_URL } from "./helpers";

// Exercises the real passport/session/CSRF stack (server/auth.ts) against PostgreSQL.
// WARNING: the public schema of TEST_DATABASE_URL is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("authentication flow (integration)", () => {
  let server: Server;
  let base: string;
  let db: any;
  let pool: any;
  let schema: typeof import("../../shared/schema");
  const PASSWORD = "Start-pass-42";
  let seq = 0;

  // Minimal cookie-aware client; every request pretends to arrive over HTTPS from the proxy.
  class Client {
    cookie = "";
    csrf = "";
    async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      const res = await fetch(base + path, {
        method,
        headers: {
          "content-type": "application/json",
          "x-forwarded-proto": "https",
          "x-forwarded-for": "198.51.100.20",
          ...(this.cookie ? { cookie: this.cookie } : {}),
          ...(this.csrf ? { "x-csrf-token": this.csrf } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.getSetCookie?.() ?? [];
      const sid = set.find((c) => c.startsWith("connect.sid="));
      if (sid) this.cookie = sid.split(";")[0];
      const text = await res.text();
      let json: any;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = text;
      }
      return { status: res.status, body: json };
    }
    async login(username: string, password = PASSWORD) {
      const r = await this.req("POST", "/api/login", { username, password });
      if (r.status === 200) this.csrf = r.body.csrfToken;
      return r;
    }
  }

  const createUser = async (extra: Record<string, unknown> = {}) => {
    const n = ++seq;
    const [user] = await db
      .insert(schema.users)
      .values({ username: `flow${n}`, email: `flow${n}@example.com`, passwordHash: await bcrypt.hash(PASSWORD, 4), ...extra })
      .returning();
    return user;
  };

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.SESSION_SECRET = "auth-flow-test-secret";
    ({ db, pool } = await import("../../server/db"));
    schema = await import("../../shared/schema");
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, { migrationsFolder: "drizzle" });

    const { setupAuth } = await import("../../server/auth");
    const { registerUserManagementRoutes } = await import("../../server/user-management-routes");
    const app = express();
    app.use(express.json());
    await setupAuth(app);
    registerUserManagementRoutes(app as any);
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server?.close();
    await pool?.end();
  });

  it("logs in, keeps the session, and logs out", async () => {
    const user = await createUser();
    const c = new Client();
    expect((await c.req("GET", "/api/user")).status).toBe(401);
    const login = await c.login(user.username);
    expect(login.status).toBe(200);
    expect(login.body.passwordHash).toBeUndefined();
    expect((await c.req("GET", "/api/user")).body.username).toBe(user.username);
    expect((await c.req("POST", "/api/logout")).status).toBe(200);
    expect((await c.req("GET", "/api/user")).status).toBe(401);
  });

  it("rejects wrong passwords and disabled accounts", async () => {
    const user = await createUser();
    const off = await createUser({ isActive: false });
    expect((await new Client().login(user.username, "wrong-pass-1")).status).toBe(401);
    expect((await new Client().login(off.username)).status).toBe(401);
    expect((await new Client().login("nobody-here")).status).toBe(401);
  });

  it("throttles repeated failed logins and lets a correct login through for other accounts", async () => {
    const victim = await createUser();
    const bystander = await createUser();
    for (let i = 0; i < 10; i++) expect((await new Client().login(victim.username, `wrong-${i}-pass`)).status).toBe(401);
    const blocked = await new Client().login(victim.username);
    expect(blocked.status).toBe(429);
    expect((await new Client().login(bystander.username)).status).toBe(200);
  });

  it("changing the password ends the user's other sessions but keeps the current one", async () => {
    const user = await createUser();
    const here = new Client();
    const elsewhere = new Client();
    await here.login(user.username);
    await elsewhere.login(user.username);
    expect((await elsewhere.req("GET", "/api/user")).status).toBe(200);

    const weak = await here.req("POST", `/api/users/${user.id}/change-password`, { currentPassword: PASSWORD, newPassword: "short1" });
    expect(weak.status).toBe(400);
    expect((await elsewhere.req("GET", "/api/user")).status).toBe(200);

    const ok = await here.req("POST", `/api/users/${user.id}/change-password`, { currentPassword: PASSWORD, newPassword: "Brand-new-pass-7" });
    expect(ok.status).toBe(200);
    expect((await here.req("GET", "/api/user")).status).toBe(200);
    expect((await elsewhere.req("GET", "/api/user")).status).toBe(401);
    expect((await new Client().login(user.username, "Brand-new-pass-7")).status).toBe(200);
    expect((await new Client().login(user.username, PASSWORD)).status).toBe(401);
  });

  describe("password reset", () => {
    const issueToken = async (userId: string) => {
      const token = crypto.randomBytes(24).toString("hex");
      await db.insert(schema.passwordResetTokens).values({
        userId,
        token: crypto.createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      return token;
    };

    it("applies the password policy, signs every device out, and works only once", async () => {
      const user = await createUser();
      const a = new Client();
      const b = new Client();
      await a.login(user.username);
      await b.login(user.username);
      const token = await issueToken(user.id);
      const anon = new Client();

      expect((await anon.req("POST", "/api/reset-password", { token, newPassword: "short" })).status).toBe(400);
      expect((await anon.req("POST", "/api/reset-password", { token, newPassword: "onlyletterspassword" })).status).toBe(400);
      expect((await a.req("GET", "/api/user")).status).toBe(200); // a rejected reset changes nothing

      const ok = await anon.req("POST", "/api/reset-password", { token, newPassword: "Recovered-pass-5" });
      expect(ok.status).toBe(200);
      expect((await a.req("GET", "/api/user")).status).toBe(401);
      expect((await b.req("GET", "/api/user")).status).toBe(401);
      expect((await anon.req("POST", "/api/reset-password", { token, newPassword: "Another-pass-55" })).status).toBe(400);
      expect((await new Client().login(user.username, "Recovered-pass-5")).status).toBe(200);
    });
  });

  describe("administrator actions", () => {
    it("deactivating a user ends their session immediately", async () => {
      const adminRole = (await db.insert(schema.roles).values({ name: "Admin", description: "x", permissions: {} }).returning())[0];
      const admin = await createUser({ roleId: adminRole.id });
      const victim = await createUser();
      const adminClient = new Client();
      const victimClient = new Client();
      await adminClient.login(admin.username);
      await victimClient.login(victim.username);
      expect((await victimClient.req("GET", "/api/user")).status).toBe(200);

      expect((await adminClient.req("PUT", `/api/users/${victim.id}/deactivate`)).status).toBe(200);
      expect((await victimClient.req("GET", "/api/user")).status).toBe(401);
      expect((await new Client().login(victim.username)).status).toBe(401);
    });
  });

  it("public registration is disabled unless explicitly enabled, and then enforces the policy", async () => {
    const c = new Client();
    const body = { username: "newcomer", email: "newcomer@example.com", password: "Valid-pass-88" };
    expect((await c.req("POST", "/api/register", body)).status).toBe(403);
    process.env.ALLOW_PUBLIC_REGISTRATION = "true";
    try {
      expect((await c.req("POST", "/api/register", { ...body, password: "abc12" })).status).toBe(400);
      expect((await c.req("POST", "/api/register", { ...body, password: "newcomer-2026" })).status).toBe(400);
    } finally {
      delete process.env.ALLOW_PUBLIC_REGISTRATION;
    }
  });
});
