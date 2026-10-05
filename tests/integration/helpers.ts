import express from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const ALL = { view: true, add: true, edit: true, delete: true, approve: true };
export const fullPermissions = new Proxy({}, { get: () => ALL }) as Record<string, typeof ALL>;

export async function startApp() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.SESSION_SECRET ||= "test";

  const { db, pool } = await import("../../server/db");
  const { users } = await import("../../shared/schema");
  const { setupDatabaseRoutes } = await import("../../server/database-routes");

  // Build the schema from the committed migrations (also verifies they apply to an empty DB).
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await migrate(db, { migrationsFolder: "drizzle" });

  const [user] = await db
    .insert(users)
    .values({ username: "tester", email: "tester@example.com", passwordHash: "x" })
    .returning();

  const app = express();
  app.use(express.json());
  // Stand-in for passport: every request is an authenticated user with all permissions.
  app.use((req: any, _res, next) => {
    req.user = { id: user.id, email: user.email, isActive: true, roleName: "Admin", permissions: fullPermissions };
    req.isAuthenticated = () => true;
    next();
  });
  setupDatabaseRoutes(app as any);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function api(method: string, path: string, body?: unknown) {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json" },
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

  return {
    api,
    db,
    async close() {
      await new Promise((r) => server.close(r));
      await pool.end();
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
