import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, createInvoice, pay, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("security hardening C1-C5 (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown, h?: Record<string, string>) => ctx.api(m, p, b, h);
  const MISSING = "00000000-0000-0000-0000-000000000000";
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
  const GOOD_PASSWORD = "S3cure-pass-xyz";
  let seq = 0;
  const next = () => ++seq;

  const permissions = Object.fromEntries(
    ["dashboard", "crm", "quotations", "invoices", "expenses", "paymentSources", "services", "projects", "employees", "users", "roles", "tasks", "analytics"].map(
      (m) => [m, { view: true, add: true, edit: true, delete: true, approve: true }],
    ),
  );
  const createRole = (name: string) => api("POST", "/api/roles", { name, description: name, permissions });
  const createUser = async (extra: Record<string, unknown> = {}) => {
    const n = next();
    const r = await api("POST", "/api/users", { username: `sec${n}`, email: `sec${n}@example.com`, password: GOOD_PASSWORD, ...extra });
    if (r.status !== 201) throw new Error(`user create failed: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  };
  const auditRows = async (where: Record<string, string>) => {
    const { auditLogs } = await import("../../shared/schema");
    const { and, eq, desc } = await import("drizzle-orm");
    const conds = Object.entries(where).map(([k, v]) => eq((auditLogs as any)[k], v));
    return ctx.db.select().from(auditLogs).where(and(...conds)).orderBy(desc(auditLogs.createdAt));
  };

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  describe("C1 - uploads", () => {
    const uploadToInvoice = async (file: { name: string; type: string; data: Uint8Array | string }) => {
      const client = await createClient(api, `Up${next()}`);
      const inv = await createInvoice(api, client.id, "10");
      return { inv, res: await ctx.upload(`/api/invoices/${inv.id}/attachments`, file) };
    };

    it("invoice attachments: extension comes from the content type, not the file name", async () => {
      const { inv, res } = await uploadToInvoice({ name: "evil.html", type: "image/png", data: new Uint8Array(PNG) });
      expect(res.status).toBeLessThan(300);
      const attached: string = (await api("GET", `/api/invoices/${inv.id}`)).body.attachments[0];
      expect(attached).toMatch(/\.png$/);
      expect(attached).not.toMatch(/html/);
    });

    it.each([
      ["a type that is not allowed", { name: "x.html", type: "text/html", data: "<b>x</b>" }],
      ["content that does not match the declared image type", { name: "x.png", type: "image/png", data: "<script>alert(1)</script>" }],
      ["content that does not match the declared PDF type", { name: "x.pdf", type: "application/pdf", data: new Uint8Array(PNG) }],
    ])("rejects %s and stores nothing", async (_label, file) => {
      const before = fs.existsSync(path.join(ctx.uploadsDir, "invoices")) ? fs.readdirSync(path.join(ctx.uploadsDir, "invoices")).length : 0;
      const { inv, res } = await uploadToInvoice(file);
      expect(res.status).toBe(400);
      expect((await api("GET", `/api/invoices/${inv.id}`)).body.attachments ?? []).toHaveLength(0);
      const after = fs.existsSync(path.join(ctx.uploadsDir, "invoices")) ? fs.readdirSync(path.join(ctx.uploadsDir, "invoices")).length : 0;
      expect(after).toBe(before);
    });

    it("expense attachments also verify the file signature", async () => {
      const bad = await ctx.upload("/api/expenses/attachments", { name: "x.png", type: "image/png", data: "not really a png" });
      expect(bad.status).toBe(400);
      const ok = await ctx.upload("/api/expenses/attachments", { name: "x.png", type: "image/png", data: new Uint8Array(PNG) });
      expect(ok.status).toBe(201);
    });

    it("serves images inline with nosniff and a locked-down CSP", async () => {
      const up = await ctx.upload("/api/expenses/attachments", { name: "x.png", type: "image/png", data: new Uint8Array(PNG) });
      const raw = await ctx.raw(up.body.url);
      expect(raw.status).toBe(200);
      expect(raw.type).toMatch(/image\/png/);
      expect(raw.headers.get("x-content-type-options")).toBe("nosniff");
      expect(raw.headers.get("content-security-policy")).toMatch(/sandbox/);
      expect(raw.headers.get("content-disposition") ?? "inline").not.toMatch(/attachment/);
    });

    it("serves legacy files with other extensions as downloads, never as pages", async () => {
      fs.mkdirSync(path.join(ctx.uploadsDir, "invoices"), { recursive: true });
      fs.writeFileSync(path.join(ctx.uploadsDir, "invoices", "legacy.html"), "<script>alert(1)</script>");
      const raw = await ctx.raw("/uploads/invoices/legacy.html");
      expect(raw.status).toBe(200);
      expect(raw.type).not.toMatch(/html/);
      expect(raw.headers.get("content-disposition")).toMatch(/attachment/);
      expect(raw.headers.get("x-content-type-options")).toBe("nosniff");
    });
  });

  describe("C2 - backup export", () => {
    const backup = async (qs = "") => api("GET", `/api/settings/backup${qs}`);

    it("leaves out private messages by default and says so", async () => {
      const r = await backup();
      expect(r.status).toBe(200);
      expect(r.body.tables.clients).toBeDefined();
      expect(r.body.tables.messages).toBeUndefined();
      expect(r.body.tables.conversations).toBeUndefined();
      expect(r.body.meta.excludedTables).toEqual(expect.arrayContaining(["messages", "conversations", "conversationParticipants"]));
    });

    it("includes messages only when asked explicitly", async () => {
      const r = await backup("?includeMessages=true");
      expect(r.status).toBe(200);
      expect(r.body.tables.messages).toEqual(expect.any(Array));
      expect(r.body.tables.conversations).toEqual(expect.any(Array));
    });

    it("never exposes password hashes", async () => {
      const r = await backup();
      expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|password_hash/);
    });

    it("records who downloaded it in the audit log", async () => {
      await backup("?includeMessages=true");
      const rows = await auditRows({ action: "backup_download" });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].userId).toBe(ctx.currentUserId);
      expect(JSON.stringify(rows[0].newValues)).toMatch(/includeMessages/);
    });

    it("is restricted to administrators", async () => {
      ctx.actAs({ roleName: "Sales" });
      const r = await backup();
      ctx.actAs(null);
      expect(r.status).toBe(403);
    });
  });

  describe("C3 - administrator role and vault access", () => {
    let adminRole: any;
    beforeAll(async () => {
      const r = await createRole("Admin");
      expect(r.status).toBe(201);
      adminRole = r.body;
    });

    it("does not allow a second role called Admin (any casing)", async () => {
      expect((await createRole("Admin")).status).toBe(409);
      expect((await createRole("  admin ")).status).toBe(409);
    });

    it("does not allow renaming the Admin role or renaming another role to Admin", async () => {
      const rename = await api("PUT", `/api/roles/${adminRole.id}`, { name: "Superusers", description: "x", permissions });
      expect(rename.status).toBe(400);
      const other = (await createRole(`Other${next()}`)).body;
      expect((await api("PUT", `/api/roles/${other.id}`, { name: "ADMIN", description: "x", permissions })).status).toBe(409);
      expect((await api("PUT", `/api/roles/${other.id}`, { name: `Renamed${next()}`, description: "y", permissions })).status).toBe(200);
      // editing the Admin role's other fields is still fine
      expect((await api("PUT", `/api/roles/${adminRole.id}`, { name: "Admin", description: "Full access", permissions })).status).toBe(200);
    });

    it("does not allow deleting the Admin role", async () => {
      expect((await api("DELETE", `/api/roles/${adminRole.id}`)).status).toBe(400);
    });

    describe("client credentials", () => {
      let clientId: string;
      let credentialId: string;
      beforeAll(async () => {
        clientId = (await createClient(api, "Vault client")).id;
        const created = await api("POST", `/api/clients/${clientId}/credentials`, { label: "server", type: "server", username: "root", password: "hunter2" });
        expect(created.status).toBe(201);
        credentialId = created.body.id;
      });

      it("a legacy users.role value of 'manager' no longer grants vault access", async () => {
        ctx.actAs({ roleName: "Sales", role: "manager" });
        const reveal = await api("GET", `/api/clients/${clientId}/credentials/${credentialId}/password`);
        const create = await api("POST", `/api/clients/${clientId}/credentials`, { label: "x", type: "other" });
        ctx.actAs(null);
        expect(reveal.status).toBe(403);
        expect(create.status).toBe(403);
      });

      it("managers and admins can reveal, and every reveal is audited", async () => {
        ctx.actAs({ roleName: "Manager" });
        const r = await api("GET", `/api/clients/${clientId}/credentials/${credentialId}/password`, undefined, { "x-forwarded-for": "198.51.100.7", "user-agent": "vault-test" });
        ctx.actAs(null);
        expect(r.status).toBe(200);
        expect(r.body.password).toBe("hunter2");
        const rows = await auditRows({ action: "reveal_password", entityId: credentialId });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ entityType: "client_credential", ipAddress: "198.51.100.7", userAgent: "vault-test" });
        expect(JSON.stringify(rows[0])).not.toContain("hunter2");
      });

      it("a failed or forbidden reveal is not audited as a reveal", async () => {
        const before = (await auditRows({ action: "reveal_password" })).length;
        await api("GET", `/api/clients/${clientId}/credentials/${MISSING}/password`);
        ctx.actAs({ roleName: "Sales" });
        await api("GET", `/api/clients/${clientId}/credentials/${credentialId}/password`);
        ctx.actAs(null);
        expect((await auditRows({ action: "reveal_password" })).length).toBe(before);
      });
    });
  });

  describe("C4 - passwords and sessions", () => {
    const sessions = async (userId: string) => {
      const r = await ctx.db.execute((await import("drizzle-orm")).sql`SELECT sid FROM sessions WHERE sess->'passport'->>'user' = ${userId}`);
      return r.rows.map((x: any) => x.sid as string);
    };
    const addSession = async (sid: string, userId: string) => {
      const { sql } = await import("drizzle-orm");
      await ctx.db.execute(sql`INSERT INTO sessions (sid, sess, expire) VALUES (${sid}, ${JSON.stringify({ passport: { user: userId } })}::jsonb, now() + interval '1 day')`);
    };

    it.each([
      ["shorter than 8 characters", "Ab1"],
      ["without a digit", "onlyletterspassword"],
      ["without a letter", "123456789012"],
      ["a very common password", "Password123"],
      ["a very common password (digits)", "12345678"],
    ])("creating a user rejects a password that is %s", async (_l, password) => {
      const n = next();
      const r = await api("POST", "/api/users", { username: `weak${n}`, email: `weak${n}@example.com`, password });
      expect(r.status).toBe(400);
      expect(r.body.message).toMatch(/password/i);
    });

    it("rejects a password that contains the username", async () => {
      const r = await api("POST", "/api/users", { username: "mohamed", email: "m@example.com", password: "mohamed-2026" });
      expect(r.status).toBe(400);
    });

    it("accepts a reasonable password", async () => {
      const user = await createUser();
      expect(user.id).toBeTruthy();
    });

    it("change-password enforces the policy, then ends the user's other sessions", async () => {
      const user = await createUser();
      await addSession(`s-${next()}`, user.id);
      await addSession(`s-${next()}`, user.id);
      const other = await createUser();
      await addSession(`s-${next()}`, other.id);

      ctx.actAs({ id: user.id });
      const weak = await api("POST", `/api/users/${user.id}/change-password`, { currentPassword: GOOD_PASSWORD, newPassword: "weakpass" });
      expect(weak.status).toBe(400);
      expect((await sessions(user.id)).length).toBe(2); // untouched by a failed attempt

      const ok = await api("POST", `/api/users/${user.id}/change-password`, { currentPassword: GOOD_PASSWORD, newPassword: "An0ther-good-one" });
      ctx.actAs(null);
      expect(ok.status).toBe(200);
      expect(await sessions(user.id)).toHaveLength(0);
      expect(await sessions(other.id)).toHaveLength(1);
    });

    it("an administrator setting a password applies the policy and ends that user's sessions", async () => {
      const user = await createUser();
      await addSession(`s-${next()}`, user.id);
      expect((await api("PUT", `/api/users/${user.id}`, { password: "weakpass" })).status).toBe(400);
      expect((await sessions(user.id)).length).toBe(1);
      expect((await api("PUT", `/api/users/${user.id}`, { password: "Brand-new-pass9" })).status).toBe(200);
      expect(await sessions(user.id)).toHaveLength(0);
    });

    it("deactivating a user ends their sessions", async () => {
      const user = await createUser();
      await addSession(`s-${next()}`, user.id);
      expect((await api("PUT", `/api/users/${user.id}/deactivate`)).status).toBe(200);
      expect(await sessions(user.id)).toHaveLength(0);
    });

    it("invalidateUserSessions can keep the current session", async () => {
      const { invalidateUserSessions } = await import("../../server/sessions");
      const user = await createUser();
      await addSession("keep-me", user.id);
      await addSession("drop-me", user.id);
      await invalidateUserSessions(user.id, "keep-me");
      expect(await sessions(user.id)).toEqual(["keep-me"]);
    });
  });

  describe("C5 - audit log", () => {
    it("records the real client IP and user agent", async () => {
      const user = await createUser();
      await api("PUT", `/api/users/${user.id}`, { email: `changed${next()}@example.com` }, { "x-forwarded-for": "203.0.113.9", "user-agent": "audit-test/1.0" });
      const rows = await auditRows({ action: "update", entityId: user.id });
      expect(rows[0]).toMatchObject({ ipAddress: "203.0.113.9", userAgent: "audit-test/1.0" });
    });

    it("caps and sanitises the page size", async () => {
      const { auditLogs } = await import("../../shared/schema");
      await ctx.db.insert(auditLogs).values(Array.from({ length: 210 }, (_, i) => ({ userId: ctx.currentUserId, action: "bulk", entityType: "test", entityId: String(i) })));
      expect((await api("GET", "/api/audit-logs?limit=100000")).body).toHaveLength(200);
      expect((await api("GET", "/api/audit-logs?limit=abc")).body).toHaveLength(50);
      expect((await api("GET", "/api/audit-logs?limit=-5")).body).toHaveLength(50);
      expect((await api("GET", "/api/audit-logs?limit=3")).body).toHaveLength(3);
    });

    it("covers payments, refunds, cancellations, credit use and client archiving", async () => {
      const client = await createClient(api, "Audited");
      const inv = await createInvoice(api, client.id, "100");
      await pay(api, inv.id, 150, { adminApproved: true });
      await api("POST", `/api/invoices/${inv.id}/refund`, { refundAmount: 10, refundMethod: "cash" });
      const second = await createInvoice(api, client.id, "50");
      await api("POST", `/api/invoices/${second.id}/apply-credit`, { creditAmount: 20 });
      const third = await createInvoice(api, client.id, "20");
      await api("POST", `/api/invoices/${third.id}/cancel`);

      const actionsFor = async (entityId: string) => (await auditRows({ entityId })).map((r) => r.action).sort();
      expect(await actionsFor(inv.id)).toEqual(expect.arrayContaining(["payment", "refund"]));
      expect(await actionsFor(second.id)).toContain("apply_credit");
      expect(await actionsFor(third.id)).toContain("cancel");

      const payRow = (await auditRows({ entityId: inv.id, action: "payment" }))[0];
      expect(payRow.newValues).toMatchObject({ amount: 150 });

      const gone = await createClient(api, "ToDelete");
      expect((await api("DELETE", `/api/clients/${gone.id}`)).status).toBe(200);
      expect(await actionsFor(gone.id)).toContain("archive");
    });

    it("covers expense payment and rejection", async () => {
      const { createCategory, createExpense } = await import("./helpers");
      const category = await createCategory(api);
      const a = await createExpense(api, category.id);
      const b = await createExpense(api, category.id);
      await api("POST", `/api/expenses/${a.id}/pay`, { paymentMethod: "cash" });
      await api("POST", `/api/expenses/${b.id}/reject`, { rejectionReason: "no" });
      expect((await auditRows({ entityId: a.id })).map((r) => r.action)).toContain("pay");
      expect((await auditRows({ entityId: b.id })).map((r) => r.action)).toContain("reject");
    });
  });
});
