import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addItem, createCategory, createClient, createExpense, createInvoice, createQuotation, pay, startApp, TEST_DATABASE_URL } from "./helpers";

// Policy: clients and invoices are never deleted. Removing a client archives it and keeps every record.
// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("clients are archived, never deleted (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const MISSING = "00000000-0000-0000-0000-000000000000";
  const getClient = async (id: string) => (await api("GET", `/api/clients/${id}`)).body;
  const count = async (table: any, column: any, id: string) => {
    const { eq } = await import("drizzle-orm");
    return (await ctx.db.select().from(table).where(eq(column, id))).length;
  };

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  // A client with a paid invoice, an unpaid invoice, a quotation, credit, a credential and an expense
  async function busyClient(name: string) {
    const client = await createClient(api, name);
    const paid = await createInvoice(api, client.id, "100");
    await pay(api, paid.id, 150, { adminApproved: true }); // 50 credit
    const unpaid = await createInvoice(api, client.id, "40");
    const quotation = await createQuotation(api, client.id);
    await addItem(api, quotation.id, 1, 10);
    await api("POST", `/api/clients/${client.id}/credentials`, { label: "server", type: "server", password: "secret" });
    const category = await createCategory(api);
    await createExpense(api, category.id, { relatedClientId: client.id });
    return { client, paid, unpaid, quotation };
  }

  describe("DELETE /api/clients/:id archives", () => {
    it("keeps the client and every related record", async () => {
      const { client, paid, unpaid, quotation } = await busyClient("Keep Everything");
      const { invoices, payments, quotations, clientCredentials, expenses, clientCreditHistory } = await import("../../shared/schema");

      const r = await api("DELETE", `/api/clients/${client.id}`);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ success: true, archived: true });

      const after = await getClient(client.id);
      expect(after).toMatchObject({ id: client.id, status: "archived", creditBalance: "50.00" });
      expect((await api("GET", `/api/invoices/${paid.id}`)).body).toMatchObject({ status: "paid", paidAmount: "100.00" });
      expect((await api("GET", `/api/invoices/${unpaid.id}`)).status).toBe(200);
      expect((await api("GET", `/api/quotations/${quotation.id}`)).status).toBe(200);
      expect(await count(payments, payments.invoiceId, paid.id)).toBeGreaterThan(0);
      expect(await count(invoices, invoices.clientId, client.id)).toBe(2);
      expect(await count(quotations, quotations.clientId, client.id)).toBe(1);
      expect(await count(clientCredentials, clientCredentials.clientId, client.id)).toBe(1);
      expect(await count(expenses, expenses.relatedClientId, client.id)).toBe(1);
      expect(await count(clientCreditHistory, clientCreditHistory.clientId, client.id)).toBeGreaterThan(0);
    });

    it("works even when other records reference the client (no failed half-delete)", async () => {
      const { client, paid } = await busyClient("Linked");
      expect((await api("DELETE", `/api/clients/${client.id}`)).status).toBe(200);
      expect((await api("GET", `/api/invoices/${paid.id}`)).status).toBe(200);
    });

    it("is idempotent and 404 for unknown clients", async () => {
      const client = await createClient(api, "Twice");
      expect((await api("DELETE", `/api/clients/${client.id}`)).status).toBe(200);
      expect((await api("DELETE", `/api/clients/${client.id}`)).status).toBe(200);
      expect((await getClient(client.id)).status).toBe("archived");
      expect((await api("DELETE", `/api/clients/${MISSING}`)).status).toBe(404);
    });

    it("is recorded in the audit log", async () => {
      const client = await createClient(api, "Audited archive");
      await api("DELETE", `/api/clients/${client.id}`);
      const { auditLogs } = await import("../../shared/schema");
      const { and, eq } = await import("drizzle-orm");
      const rows = await ctx.db.select().from(auditLogs).where(and(eq(auditLogs.entityId, client.id), eq(auditLogs.action, "archive")));
      expect(rows).toHaveLength(1);
      expect(rows[0].oldValues).toMatchObject({ status: "active" });
    });
  });

  describe("restore", () => {
    it("brings an archived client back to active", async () => {
      const client = await createClient(api, "Restore me");
      await api("DELETE", `/api/clients/${client.id}`);
      const r = await api("POST", `/api/clients/${client.id}/restore`);
      expect(r.status).toBe(200);
      expect((await getClient(client.id)).status).toBe("active");
    });

    it("restoring a client that is not archived is a harmless no-op, unknown clients are 404", async () => {
      const client = await createClient(api, "Not archived");
      expect((await api("POST", `/api/clients/${client.id}/restore`)).status).toBe(200);
      expect((await getClient(client.id)).status).toBe("active");
      expect((await api("POST", `/api/clients/${MISSING}/restore`)).status).toBe(404);
    });
  });

  describe("an archived client", () => {
    it("is still listed (so names resolve on old invoices) but flagged by its status", async () => {
      const client = await createClient(api, "Still listed");
      await api("DELETE", `/api/clients/${client.id}`);
      const list = (await api("GET", "/api/clients")).body as any[];
      expect(list.find((c) => c.id === client.id)?.status).toBe("archived");
    });

    it("can be hidden from pickers with ?excludeArchived=true", async () => {
      const keep = await createClient(api, "Visible");
      const gone = await createClient(api, "Hidden");
      await api("DELETE", `/api/clients/${gone.id}`);
      const list = (await api("GET", "/api/clients?excludeArchived=true")).body as any[];
      expect(list.some((c) => c.id === keep.id)).toBe(true);
      expect(list.some((c) => c.id === gone.id)).toBe(false);
    });

    it("cannot get new invoices or quotations, but existing invoices can still be collected", async () => {
      const { client, unpaid, quotation } = await busyClient("Archived billing");
      await api("DELETE", `/api/clients/${client.id}`);

      expect((await api("POST", "/api/invoices", { clientId: client.id, amount: "10" })).status).toBe(409);
      expect((await api("POST", "/api/quotations", { clientId: client.id, title: "new" })).status).toBe(409);
      expect((await api("POST", `/api/quotations/${quotation.id}/convert-to-invoice`)).status).toBe(409);

      // outstanding money can still be received and credit used
      expect((await pay(api, unpaid.id, 40)).status).toBe(201);
      expect((await api("GET", `/api/invoices/${unpaid.id}`)).body.status).toBe("paid");
    });

    it("is not counted in the sidebar client counter", async () => {
      const before = (await api("GET", "/api/sidebar/counters")).body.clients;
      const client = await createClient(api, "Counted");
      expect((await api("GET", "/api/sidebar/counters")).body.clients).toBe(before + 1);
      await api("DELETE", `/api/clients/${client.id}`);
      expect((await api("GET", "/api/sidebar/counters")).body.clients).toBe(before);
    });
  });

  describe("invoices are never deleted", () => {
    it.each(["draft", "paid", "cancelled"])("DELETE /api/invoices/:id is refused for a %s invoice", async (kind) => {
      const client = await createClient(api, `Inv ${kind}`);
      const inv = await createInvoice(api, client.id, "50");
      if (kind === "paid") await pay(api, inv.id, 50);
      if (kind === "cancelled") await api("POST", `/api/invoices/${inv.id}/cancel`);

      const r = await api("DELETE", `/api/invoices/${inv.id}`);
      expect(r.status).toBe(409);
      expect(r.body.message).toMatch(/cancel/i);
      expect((await api("GET", `/api/invoices/${inv.id}`)).status).toBe(200);
    });

    it("a draft invoice created by mistake can be cancelled instead", async () => {
      const client = await createClient(api, "Mistake");
      const inv = await createInvoice(api, client.id, "50");
      expect((await api("POST", `/api/invoices/${inv.id}/cancel`)).status).toBe(200);
      expect((await api("GET", `/api/invoices/${inv.id}`)).body.status).toBe("cancelled");
    });
  });
});
