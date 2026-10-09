import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const ALL = { view: true, add: true, edit: true, delete: true, approve: true };
export const fullPermissions = new Proxy({}, { get: () => ALL }) as Record<string, typeof ALL>;

export async function startApp() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.SESSION_SECRET ||= "test";
  // Uploaded files go to a throw-away directory instead of the project's ./uploads
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-uploads-"));
  process.env.UPLOADS_DIR = uploadsDir;

  const { db, pool } = await import("../../server/db");
  const { users } = await import("../../shared/schema");
  const { setupDatabaseRoutes } = await import("../../server/database-routes");
  const { registerExpenseRoutes } = await import("../../server/expense-routes");
  const { registerPaymentSourceRoutes } = await import("../../server/payment-source-routes");

  // Build the schema from the committed migrations (also verifies they apply to an empty DB).
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await migrate(db, { migrationsFolder: "drizzle" });

  const [user] = await db
    .insert(users)
    .values({ username: "tester", email: "tester@example.com", passwordHash: "x" })
    .returning();

  const { registerTaskManagementRoutes } = await import("../../server/task-management-routes");
  const { registerServicesRoutes } = await import("../../server/services-routes");
  const { registerUserManagementRoutes } = await import("../../server/user-management-routes");
  const { registerMessagingRoutes } = await import("../../server/messaging-routes");
  const { registerSettingsRoutes } = await import("../../server/settings-routes");
  const { registerCredentialRoutes } = await import("../../server/credential-routes");
  const { registerNotificationRoutes } = await import("../../server/notification-routes");
  const { registerProjectRoutes } = await import("../../server/project-routes");
  const { registerPushRoutes } = await import("../../server/push-routes");

  const app = express();
  app.set("trust proxy", 1); // same as production, so req.ip honours X-Forwarded-For
  app.use(express.json({ limit: "10mb" })); // same as production
  // Stand-in for passport: every request is an authenticated user with all permissions.
  // Tests can switch the acting user with `actAs({ id })` and restore it with `actAs(null)`.
  let acting: Record<string, unknown> | null = null;
  app.use((req: any, _res, next) => {
    req.user = { id: user.id, email: user.email, isActive: true, roleName: "Admin", permissions: fullPermissions, ...(acting ?? {}) };
    req.isAuthenticated = () => true;
    next();
  });
  setupDatabaseRoutes(app as any);
  registerExpenseRoutes(app as any);
  registerPaymentSourceRoutes(app as any);
  registerTaskManagementRoutes(app as any);
  registerServicesRoutes(app as any);
  registerUserManagementRoutes(app as any);
  registerMessagingRoutes(app as any);
  registerSettingsRoutes(app as any);
  registerCredentialRoutes(app as any);
  registerNotificationRoutes(app as any);
  await registerProjectRoutes(app as any);
  await registerPushRoutes(app as any);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function api(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }

  async function upload(path: string, file: { name: string; type: string; data: Uint8Array | string } | null, field = "file") {
    const form = new FormData();
    if (file) form.append(field, new Blob([file.data as BlobPart], { type: file.type }), file.name);
    const res = await fetch(base + path, { method: "POST", body: form });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }

  async function raw(path: string) {
    const res = await fetch(base + path);
    return { status: res.status, type: res.headers.get("content-type"), headers: res.headers, body: Buffer.from(await res.arrayBuffer()) };
  }

  return {
    api,
    upload,
    raw,
    base,
    db,
    uploadsDir,
    currentUserId: user.id as string,
    actAs: (u: Record<string, unknown> | null) => {
      acting = u;
    },
    async close() {
      await new Promise((r) => server.close(r));
      await pool.end();
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    },
  };
}

export async function createClient(api: (m: string, p: string, b?: unknown) => Promise<any>, name = "Acme") {
  const r = await api("POST", "/api/clients", { name, email: `${name.toLowerCase()}@example.com` });
  if (r.status !== 201 && r.status !== 200) throw new Error(`client create failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

export async function createInvoice(
  api: (m: string, p: string, b?: unknown) => Promise<any>,
  clientId: string,
  amount = "1000",
) {
  const r = await api("POST", "/api/invoices", { clientId, amount, title: "Test invoice" });
  if (r.status !== 201) throw new Error(`invoice create failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

export const pay = (api: any, invoiceId: string, amount: number, extra: object = {}) =>
  api("POST", `/api/invoices/${invoiceId}/payments`, {
    amount,
    paymentDate: new Date().toISOString(),
    paymentMethod: "cash",
    ...extra,
  });

export async function createQuotation(
  api: (m: string, p: string, b?: unknown) => Promise<any>,
  clientId: string,
  title = "Test quotation",
) {
  const r = await api("POST", "/api/quotations", { clientId, title });
  if (r.status !== 201) throw new Error(`quotation create failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

export const addItem = (
  api: any,
  quotationId: string,
  quantity: number,
  unitPrice: number,
  opts: { discountPercent?: number; description?: string } = {},
) => {
  const gross = quantity * unitPrice;
  const total = gross - (gross * (opts.discountPercent ?? 0)) / 100;
  return api("POST", `/api/quotations/${quotationId}/items`, {
    description: opts.description ?? "Service",
    quantity: String(quantity),
    unitPrice: String(unitPrice),
    totalPrice: total.toFixed(2),
    discount: String(opts.discountPercent ?? 0),
  });
};

type Api = (m: string, p: string, b?: unknown, h?: Record<string, string>) => Promise<any>;

export async function createPaymentSource(api: Api, initialBalance = "1000", name = "Main bank") {
  const r = await api("POST", "/api/payment-sources", { name, accountType: "bank", currency: "EGP", initialBalance });
  if (r.status !== 201) throw new Error(`payment source create failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

export async function createCategory(api: Api, name = `Category ${Math.random().toString(36).slice(2, 8)}`) {
  const r = await api("POST", "/api/expense-categories", { name });
  if (r.status !== 201) throw new Error(`category create failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

export async function createExpense(api: Api, categoryId: string, overrides: Record<string, unknown> = {}) {
  const r = await api("POST", "/api/expenses", {
    title: "Office rent",
    amount: "200.00",
    categoryId,
    type: "fixed",
    expenseDate: new Date().toISOString(),
    paymentMethod: "bank_transfer",
    ...overrides,
  });
  if (r.status !== 201) throw new Error(`expense create failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
