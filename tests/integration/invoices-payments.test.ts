import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, createInvoice, pay, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires a PostgreSQL database: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("invoices & payments (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);

  beforeAll(async () => {
    
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  describe("invoice creation", () => {
    it("creates a draft invoice with a unique, sequential-looking number", async () => {
      const client = await createClient(api, "Creation");
      const a = await createInvoice(api, client.id, "250");
      const b = await createInvoice(api, client.id, "250");
      expect(a.status).toBe("draft");
      expect(a.paidAmount).toBe("0.00");
      expect(a.invoiceNumber).toBeTruthy();
      expect(a.invoiceNumber).not.toBe(b.invoiceNumber);
    });

    it("generates distinct numbers under concurrent creation", async () => {
      const client = await createClient(api, "Concurrent");
      const results = await Promise.all(Array.from({ length: 8 }, () => api("POST", "/api/invoices", { clientId: client.id, amount: "10" })));
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(new Set(results.map((r) => r.body.invoiceNumber)).size).toBe(8);
    });

    it("records history on creation", async () => {
      const client = await createClient(api, "History");
      const inv = await createInvoice(api, client.id);
      const { db } = ctx;
      const { invoiceHistory } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      const rows = await db.select().from(invoiceHistory).where(eq(invoiceHistory.invoiceId, inv.id));
      expect(rows.some((r) => r.event.includes("created"))).toBe(true);
    });

    it("returns 404 for an unknown invoice", async () => {
      const r = await api("GET", "/api/invoices/00000000-0000-0000-0000-000000000000");
      expect(r.status).toBe(404);
    });
  });

  describe("payments", () => {
    it("partial payment -> partially_paid, full payment -> paid", async () => {
      const client = await createClient(api, "Partial");
      const inv = await createInvoice(api, client.id, "1000");

      const p1 = await pay(api, inv.id, 400);
      expect(p1.status).toBe(201);
      let cur = (await api("GET", `/api/invoices/${inv.id}`)).body;
      expect(cur.status).toBe("partially_paid");
      expect(cur.paidAmount).toBe("400.00");

      const p2 = await pay(api, inv.id, 600);
      expect(p2.status).toBe(201);
      cur = (await api("GET", `/api/invoices/${inv.id}`)).body;
      expect(cur.status).toBe("paid");
      expect(cur.paidAmount).toBe("1000.00");
      expect(cur.paidDate).toBeTruthy();
    });

    it("rejects an overpayment that is not admin-approved and changes nothing", async () => {
      const client = await createClient(api, "Over");
      const inv = await createInvoice(api, client.id, "100");
      const r = await pay(api, inv.id, 150);
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("OVERPAYMENT_DETECTED");
      expect(r.body.details.overpaymentAmount).toBe(50);
      const cur = (await api("GET", `/api/invoices/${inv.id}`)).body;
      expect(cur.paidAmount).toBe("0.00");
      expect(cur.status).toBe("draft");
    });

    it("admin-approved overpayment caps the invoice and credits the client", async () => {
      const client = await createClient(api, "Credit");
      const inv = await createInvoice(api, client.id, "100");
      const r = await pay(api, inv.id, 150, { adminApproved: true });
      expect(r.status).toBe(201);
      expect(r.body.overpaymentHandled).toBe(true);
      expect(r.body.creditAdded).toBe(50);

      const cur = (await api("GET", `/api/invoices/${inv.id}`)).body;
      expect(cur.status).toBe("paid");
      expect(cur.paidAmount).toBe("100.00");

      const { db } = ctx;
      const { clients } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select().from(clients).where(eq(clients.id, client.id));
      expect(row.creditBalance).toBe("50.00");
      expect(row.totalValue).toBe("100.00");
    });

    it("returns 404 when paying an unknown invoice", async () => {
      const r = await pay(api, "00000000-0000-0000-0000-000000000000", 10);
      expect(r.status).toBe(404);
    });

    it("refuses payments on a cancelled invoice", async () => {
      const client = await createClient(api, "Cancelled");
      const inv = await createInvoice(api, client.id, "100");
      expect((await api("POST", `/api/invoices/${inv.id}/cancel`)).status).toBe(200);
      const r = await pay(api, inv.id, 10);
      expect(r.status).toBe(400);
    });
  });

  describe("apply client credit", () => {
    it("consumes credit against another invoice and updates both balances", async () => {
      const client = await createClient(api, "UseCredit");
      const first = await createInvoice(api, client.id, "100");
      await pay(api, first.id, 150, { adminApproved: true }); // 50 credit

      const second = await createInvoice(api, client.id, "80");
      const r = await api("POST", `/api/invoices/${second.id}/apply-credit`, { clientId: client.id, creditAmount: 30 });
      expect(r.status).toBeLessThan(300);

      const cur = (await api("GET", `/api/invoices/${second.id}`)).body;
      expect(cur.paidAmount).toBe("30.00");
      expect(cur.status).toBe("partially_paid");

      const { db } = ctx;
      const { clients } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select().from(clients).where(eq(clients.id, client.id));
      expect(row.creditBalance).toBe("20.00");
    });

    it("rejects using more credit than the client has", async () => {
      const client = await createClient(api, "NoCredit");
      const inv = await createInvoice(api, client.id, "100");
      const r = await api("POST", `/api/invoices/${inv.id}/apply-credit`, { clientId: client.id, creditAmount: 10 });
      expect(r.status).toBe(400);
      expect(r.body.message).toMatch(/Insufficient credit/);
    });
  });

  describe("refunds", () => {
    it("partial refund -> partially_refunded; full refund -> refunded", async () => {
      const client = await createClient(api, "Refund");
      const inv = await createInvoice(api, client.id, "200");
      await pay(api, inv.id, 200);

      const r1 = await api("POST", `/api/invoices/${inv.id}/refund`, { refundAmount: 50, refundMethod: "cash" });
      expect(r1.status).toBe(200);
      expect(r1.body.newStatus).toBe("partially_refunded");
      expect(parseFloat(r1.body.newPaidAmount)).toBe(150);

      const r2 = await api("POST", `/api/invoices/${inv.id}/refund`, { refundAmount: 150, refundMethod: "cash" });
      expect(r2.body.newStatus).toBe("refunded");
      const cur = (await api("GET", `/api/invoices/${inv.id}`)).body;
      expect(parseFloat(cur.paidAmount)).toBe(0);
    });

    it("rejects invalid and excessive refunds", async () => {
      const client = await createClient(api, "BadRefund");
      const inv = await createInvoice(api, client.id, "100");
      await pay(api, inv.id, 100);
      expect((await api("POST", `/api/invoices/${inv.id}/refund`, { refundAmount: 0 })).status).toBe(400);
      expect((await api("POST", `/api/invoices/${inv.id}/refund`, { refundAmount: 101 })).status).toBe(400);
      expect((await api("GET", `/api/invoices/${inv.id}`)).body.paidAmount).toBe("100.00");
    });
  });

  describe("cancellation", () => {
    it("cancels an unpaid invoice and rejects a second cancel", async () => {
      const client = await createClient(api, "Cancel");
      const inv = await createInvoice(api, client.id);
      const r = await api("POST", `/api/invoices/${inv.id}/cancel`);
      expect(r.status).toBe(200);
      expect(r.body.status).toBe("cancelled");
      expect((await api("POST", `/api/invoices/${inv.id}/cancel`)).status).toBe(400);
    });

    it("blocks cancelling a paid invoice", async () => {
      const client = await createClient(api, "CancelPaid");
      const inv = await createInvoice(api, client.id, "100");
      await pay(api, inv.id, 100);
      const r = await api("POST", `/api/invoices/${inv.id}/cancel`);
      expect(r.status).toBe(400);
      expect((await api("GET", `/api/invoices/${inv.id}`)).body.status).toBe("paid");
    });
  });
});
