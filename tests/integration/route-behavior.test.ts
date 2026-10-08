import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCategory, createClient, createInvoice, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("route behaviour: reachability, client errors, admin safety, attachments (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const MISSING = "00000000-0000-0000-0000-000000000000";
  let seq = 0;
  const next = () => ++seq;

  const permissions = Object.fromEntries(
    ["dashboard", "crm", "quotations", "invoices", "expenses", "paymentSources", "services", "projects", "employees", "users", "roles", "tasks", "analytics"].map(
      (m) => [m, { view: true, add: true, edit: true, delete: true, approve: true }],
    ),
  );
  const createRole = async (name: string) => (await api("POST", "/api/roles", { name, description: name, permissions })).body;
  const createEmployee = async (label = "Emp") => {
    const n = next();
    const r = await api("POST", "/api/employees", {
      firstName: label,
      lastName: String(n),
      email: `${label.toLowerCase()}${n}@example.com`,
      jobTitle: "Dev",
      department: "operations",
      hiringDate: new Date().toISOString(),
    });
    if (r.status !== 201) throw new Error(`employee create failed: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  };
  const createUser = async (extra: Record<string, unknown> = {}) => {
    const n = next();
    const r = await api("POST", "/api/users", { username: `user${n}`, email: `user${n}@example.com`, password: "S3cure-pass-xyz", ...extra });
    if (r.status !== 201) throw new Error(`user create failed: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  };

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  describe("B1 - routes that were shadowed by /:id", () => {
    it("GET /api/tasks/performance returns metrics", async () => {
      await api("POST", "/api/tasks", { title: "Perf task" });
      const r = await api("GET", "/api/tasks/performance");
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ totalTasks: expect.anything(), priorityDistribution: expect.any(Array) });
    });

    it("GET /api/services/categories returns the category list", async () => {
      await api("POST", "/api/services", { name: "Hosting", category: "Infra", price: "10.00" });
      const r = await api("GET", "/api/services/categories");
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    it("the :id routes still work for real ids and return 404 for unknown ones", async () => {
      const t = (await api("POST", "/api/tasks", { title: "Real task" })).body;
      expect((await api("GET", `/api/tasks/${t.id}`)).status).toBe(200);
      expect((await api("GET", `/api/tasks/${MISSING}`)).status).toBe(404);
      expect((await api("GET", `/api/services/${MISSING}`)).status).toBe(404);
    });
  });

  describe("B2 - deleting an employee", () => {
    it("deletes an employee together with a user account that has no history", async () => {
      const emp = await createEmployee("Plain");
      const user = await createUser({ employeeId: emp.id });
      expect((await api("DELETE", `/api/employees/${emp.id}`)).status).toBe(200);
      expect((await api("GET", `/api/employees/${emp.id}`)).status).toBe(404);
      expect((await api("GET", `/api/users/${user.id}`)).status).toBe(404);
    });

    it("refuses with 409 and changes nothing when the user account has created records", async () => {
      const emp = await createEmployee("Busy");
      const user = await createUser({ employeeId: emp.id });
      ctx.actAs({ id: user.id });
      await createClient(api, "Created by busy user");
      ctx.actAs(null);

      const r = await api("DELETE", `/api/employees/${emp.id}`);
      expect(r.status).toBe(409);
      expect(r.body.message).toMatch(/deactivate/i);
      expect((await api("GET", `/api/employees/${emp.id}`)).status).toBe(200);
      expect((await api("GET", `/api/users/${user.id}`)).status).toBe(200);
    });

    it("refuses to delete the employee behind the signed-in account", async () => {
      const emp = await createEmployee("Self");
      const user = await createUser({ employeeId: emp.id });
      ctx.actAs({ id: user.id });
      const r = await api("DELETE", `/api/employees/${emp.id}`);
      ctx.actAs(null);
      expect(r.status).toBe(400);
      expect((await api("GET", `/api/employees/${emp.id}`)).status).toBe(200);
    });

    it("returns 404 for an unknown employee", async () => {
      expect((await api("DELETE", `/api/employees/${MISSING}`)).status).toBe(404);
    });
  });

  describe("B3 - invalid input is a client error, not a 500", () => {
    it.each([
      ["no name", {}],
      ["blank name", { name: "   " }],
    ])("POST /api/clients with %s returns 400", async (_l, body) => {
      expect((await api("POST", "/api/clients", body)).status).toBe(400);
    });

    it("POST /api/invoices needs an existing client", async () => {
      expect((await api("POST", "/api/invoices", { amount: "5" })).status).toBe(400);
      expect((await api("POST", "/api/invoices", { clientId: MISSING, amount: "5" })).status).toBe(400);
    });

    it("POST /api/quotations needs a title and an existing client", async () => {
      const client = await createClient(api, "QClient");
      expect((await api("POST", "/api/quotations", { title: "x" })).status).toBe(400);
      expect((await api("POST", "/api/quotations", { clientId: client.id })).status).toBe(400);
      expect((await api("POST", "/api/quotations", { clientId: MISSING, title: "x" })).status).toBe(400);
    });

    it("POST /api/users rejects unknown roles and employees and missing fields", async () => {
      const n = next();
      const base = { username: `bad${n}`, email: `bad${n}@example.com`, password: "S3cure-pass-xyz" };
      expect((await api("POST", "/api/users", { ...base, roleId: MISSING })).status).toBe(400);
      expect((await api("POST", "/api/users", { ...base, employeeId: MISSING })).status).toBe(400);
      expect((await api("POST", "/api/users", { password: "S3cure-pass-xyz" })).status).toBe(400);
    });

    it("POST /api/tasks rejects an unknown assignee or project", async () => {
      expect((await api("POST", "/api/tasks", { title: "x", assignedTo: MISSING })).status).toBe(400);
      expect((await api("POST", "/api/tasks", { title: "x", projectId: MISSING })).status).toBe(400);
    });

    it("POST /api/conversations rejects an unknown participant", async () => {
      expect((await api("POST", "/api/conversations", { participantId: MISSING })).status).toBe(400);
    });

    it("valid requests still succeed", async () => {
      const client = await createClient(api, "Valid");
      expect((await createInvoice(api, client.id, "10")).status).toBe("draft");
      const emp = await createEmployee("Valid");
      const role = await createRole(`Role ${next()}`);
      const user = await createUser({ employeeId: emp.id, roleId: role.id });
      expect((await api("POST", "/api/tasks", { title: "ok", assignedTo: user.id })).status).toBe(201);
      expect((await api("POST", "/api/conversations", { participantId: user.id })).status).toBe(201);
    });
  });

  describe("B4 - the system must keep an active admin", () => {
    // The admin role is recognised by name, like requireAdmin does.
    let adminRole: any;
    beforeAll(async () => {
      adminRole = await createRole("Admin");
    });
    const adminUser = async () => createUser({ roleId: adminRole.id });
    const deactivate = (id: string) => api("PUT", `/api/users/${id}/deactivate`);

    it("an admin cannot deactivate their own account", async () => {
      const a = await adminUser();
      await adminUser(); // a second admin exists, so only the self-rule applies
      ctx.actAs({ id: a.id });
      const r = await deactivate(a.id);
      ctx.actAs(null);
      expect(r.status).toBe(400);
      expect((await api("GET", `/api/users/${a.id}`)).body.isActive).toBe(true);
    });

    it("the last active admin cannot be deactivated, edited away, or have their employee deleted", async () => {
      // make `only` the single active admin
      const emp = await createEmployee("Only");
      const only = await createUser({ roleId: adminRole.id, employeeId: emp.id });
      const users = (await api("GET", "/api/users")).body as any[];
      for (const u of users.filter((x) => x.role?.name === "Admin" && x.id !== only.id && x.isActive)) {
        expect((await api("PUT", `/api/users/${u.id}`, { isActive: false, roleId: u.roleId })).status).toBe(200);
      }

      expect((await deactivate(only.id)).status).toBe(409);
      expect((await api("PUT", `/api/users/${only.id}`, { isActive: false, roleId: adminRole.id })).status).toBe(409);
      const other = await createRole(`Other ${next()}`);
      expect((await api("PUT", `/api/users/${only.id}`, { isActive: true, roleId: other.id })).status).toBe(409);
      expect((await api("DELETE", `/api/employees/${emp.id}`)).status).toBe(409);
      const cur = (await api("GET", `/api/users/${only.id}`)).body;
      expect(cur).toMatchObject({ isActive: true, roleId: adminRole.id });
    });

    it("an admin can be deactivated once another active admin exists", async () => {
      const a = await adminUser();
      await adminUser();
      expect((await deactivate(a.id)).status).toBe(200);
      expect((await api("GET", `/api/users/${a.id}`)).body.isActive).toBe(false);
    });

    it("non-admin users are unaffected", async () => {
      const role = await createRole(`Staff ${next()}`);
      const u = await createUser({ roleId: role.id });
      expect((await deactivate(u.id)).status).toBe(200);
      expect((await deactivate(MISSING)).status).toBe(404);
    });
  });

  describe("B5 - expense attachments", () => {
    const png = { name: "receipt.png", type: "image/png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]) };
    const expenseBody = async (extra: object = {}) => ({
      title: "With file",
      amount: "10.00",
      categoryId: (await createCategory(api)).id,
      type: "variable",
      expenseDate: new Date().toISOString(),
      paymentMethod: "cash",
      ...extra,
    });

    it("stores an image and returns a URL that can be downloaded", async () => {
      const r = await ctx.upload("/api/expenses/attachments", png);
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ type: "receipt" });
      expect(r.body.url).toMatch(/^\/uploads\/expenses\/[\w.-]+\.png$/);
      const file = await ctx.raw(r.body.url);
      expect(file.status).toBe(200);
      expect(file.type).toMatch(/image\/png/);
      expect([...file.body]).toEqual([...png.data]);
    });

    it("classifies a PDF as an invoice document", async () => {
      const r = await ctx.upload("/api/expenses/attachments", { name: "bill.pdf", type: "application/pdf", data: "%PDF-1.4" });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ type: "invoice" });
      expect(r.body.url).toMatch(/\.pdf$/);
    });

    it("derives the extension from the content type, never from the supplied file name", async () => {
      const r = await ctx.upload("/api/expenses/attachments", { name: "evil.html", type: "image/png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 60, 115]) });
      expect(r.status).toBe(201);
      expect(r.body.url).toMatch(/\.png$/);
      expect(r.body.url).not.toMatch(/html/);
    });

    it("rejects other file types, a missing file and oversized files", async () => {
      expect((await ctx.upload("/api/expenses/attachments", { name: "x.html", type: "text/html", data: "<b>x</b>" })).status).toBe(400);
      expect((await ctx.upload("/api/expenses/attachments", null)).status).toBe(400);
      const big = new Uint8Array(5 * 1024 * 1024 + 10);
      expect((await ctx.upload("/api/expenses/attachments", { name: "big.png", type: "image/png", data: big })).status).toBe(400);
      const stored = fs.existsSync(path.join(ctx.uploadsDir, "expenses")) ? fs.readdirSync(path.join(ctx.uploadsDir, "expenses")) : [];
      expect(stored.some((f) => f.includes("big"))).toBe(false);
    });

    it("deleting an invoice attachment only ever removes files attached to that invoice inside uploads", async () => {
      const client = await createClient(api, "AttachClient");
      const inv = await createInvoice(api, client.id, "10");
      const up = await ctx.upload(`/api/invoices/${inv.id}/attachments`, { name: "a.png", type: "image/png", data: png.data });
      expect(up.status).toBeLessThan(300);
      const attached: string = (await api("GET", `/api/invoices/${inv.id}`)).body.attachments[0];
      const onDisk = path.join(ctx.uploadsDir, attached.replace(/^\/uploads\//, ""));
      expect(fs.existsSync(onDisk)).toBe(true);

      // A file elsewhere in the project must survive a crafted delete request
      const sentinel = path.join(process.cwd(), "tests", ".sentinel-keep-me");
      fs.writeFileSync(sentinel, "keep");
      try {
        for (const attachmentPath of ["/tests/.sentinel-keep-me", "/../tests/.sentinel-keep-me", "/uploads/../tests/.sentinel-keep-me"]) {
          const r = await api("DELETE", `/api/invoices/${inv.id}/attachments`, { attachmentPath });
          expect(r.status).toBe(404);
          expect(fs.existsSync(sentinel)).toBe(true);
        }
      } finally {
        fs.rmSync(sentinel, { force: true });
      }

      // The legitimate attachment can still be removed
      const ok = await api("DELETE", `/api/invoices/${inv.id}/attachments`, { attachmentPath: attached });
      expect(ok.status).toBe(200);
      expect(fs.existsSync(onDisk)).toBe(false);
    });

    it("keeps editing expenses whose legacy attachment value is left unchanged", async () => {
      const { expenses } = await import("../../shared/schema");
      const [legacy] = await ctx.db
        .insert(expenses)
        .values({
          title: "Legacy",
          amount: "5.00",
          categoryId: (await createCategory(api)).id,
          type: "variable",
          expenseDate: new Date(),
          paymentMethod: "cash",
          attachmentUrl: "/uploads/My Receipt (1).png",
        })
        .returning();
      const same = await api("PUT", `/api/expenses/${legacy.id}`, { title: "Legacy renamed", attachmentUrl: "/uploads/My Receipt (1).png" });
      expect(same.status).toBe(200);
      expect(same.body.title).toBe("Legacy renamed");
      expect((await api("PUT", `/api/expenses/${legacy.id}`, { attachmentUrl: "/uploads/Other File.png" })).status).toBe(400);
    });

    it("only accepts stored upload paths as an expense attachment URL", async () => {
      expect((await api("POST", "/api/expenses", await expenseBody({ attachmentUrl: "javascript:alert(1)" }))).status).toBe(400);
      expect((await api("POST", "/api/expenses", await expenseBody({ attachmentUrl: "https://evil.example/x.png" }))).status).toBe(400);

      const up = await ctx.upload("/api/expenses/attachments", png);
      const created = await api("POST", "/api/expenses", await expenseBody({ attachmentUrl: up.body.url, attachmentType: up.body.type }));
      expect(created.status).toBe(201);
      expect((await api("GET", `/api/expenses/${created.body.id}`)).body.attachmentUrl).toBe(up.body.url);

      const bad = await api("PUT", `/api/expenses/${created.body.id}`, { attachmentUrl: "javascript:alert(1)" });
      expect(bad.status).toBe(400);
      expect((await api("GET", `/api/expenses/${created.body.id}`)).body.attachmentUrl).toBe(up.body.url);
    });
  });
});
