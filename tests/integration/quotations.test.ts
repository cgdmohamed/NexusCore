import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addItem, createClient, createQuotation, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("quotations (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const getQuotation = async (id: string) => (await api("GET", `/api/quotations/${id}`)).body;
  const setStatus = (id: string, status: string) => api("PATCH", `/api/quotations/${id}/status`, { status });

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  describe("creation", () => {
    it("creates an empty draft with a QUO-<year>- number", async () => {
      const client = await createClient(api, "QCreate");
      const q = await createQuotation(api, client.id);
      expect(q.status).toBe("draft");
      expect(q.amount).toBe("0.00");
      expect(q.quotationNumber).toMatch(new RegExp(`^QUO-${new Date().getFullYear()}-\\d{4}$`));
    });

    it("generates distinct numbers under concurrent creation", async () => {
      const client = await createClient(api, "QConcurrent");
      const results = await Promise.all(
        Array.from({ length: 8 }, () => api("POST", "/api/quotations", { clientId: client.id, title: "x" })),
      );
      expect(results.map((r) => r.status)).toEqual(Array(8).fill(201));
      expect(new Set(results.map((r) => r.body.quotationNumber)).size).toBe(8);
    });

    it("records creation history", async () => {
      const client = await createClient(api, "QHistory");
      const q = await createQuotation(api, client.id);
      const history = (await api("GET", `/api/quotations/${q.id}/history`)).body;
      expect(history.some((h: any) => h.event.includes("created"))).toBe(true);
    });

    it("returns 404 for an unknown quotation", async () => {
      expect((await api("GET", "/api/quotations/00000000-0000-0000-0000-000000000000")).status).toBe(404);
    });
  });

  describe("items and totals", () => {
    it("recalculates subtotal, discount and total as items are added", async () => {
      const client = await createClient(api, "QItems");
      const q = await createQuotation(api, client.id);

      expect((await addItem(api, q.id, 2, 100)).status).toBe(201); // 200
      expect((await addItem(api, q.id, 1, 100, { discountPercent: 10 })).status).toBe(201); // 90 of 100

      const cur = await getQuotation(q.id);
      expect(cur.subtotal).toBe("300.00");
      expect(cur.amount).toBe("290.00");
      expect(cur.discountAmount).toBe("10.00");
    });

    it("recalculates when an item is edited and when it is deleted", async () => {
      const client = await createClient(api, "QEdit");
      const q = await createQuotation(api, client.id);
      const a = (await addItem(api, q.id, 1, 100)).body;
      await addItem(api, q.id, 1, 50);

      const patch = await api("PATCH", `/api/quotations/${q.id}/items/${a.id}`, {
        quantity: "3",
        unitPrice: "100",
        totalPrice: "300",
      });
      expect(patch.status).toBe(200);
      expect((await getQuotation(q.id)).amount).toBe("350.00");

      expect((await api("DELETE", `/api/quotations/${q.id}/items/${a.id}`)).status).toBe(200);
      const cur = await getQuotation(q.id);
      expect(cur.amount).toBe("50.00");
      expect(cur.subtotal).toBe("50.00");
    });

    it("locks items once the quotation is accepted", async () => {
      const client = await createClient(api, "QLock");
      const q = await createQuotation(api, client.id);
      const item = (await addItem(api, q.id, 1, 100)).body;
      expect((await setStatus(q.id, "accepted")).status).toBe(200);

      expect((await addItem(api, q.id, 1, 10)).status).toBe(409);
      expect((await api("PATCH", `/api/quotations/${q.id}/items/${item.id}`, { quantity: "2" })).status).toBe(409);
      expect((await api("DELETE", `/api/quotations/${q.id}/items/${item.id}`)).status).toBe(409);
      expect((await getQuotation(q.id)).amount).toBe("100.00");
    });
  });

  describe("status transitions", () => {
    it("allows draft -> sent -> accepted and records history", async () => {
      const client = await createClient(api, "QFlow");
      const q = await createQuotation(api, client.id);
      expect((await setStatus(q.id, "sent")).status).toBe(200);
      const r = await setStatus(q.id, "accepted");
      expect(r.status).toBe(200);
      expect(r.body.status).toBe("accepted");
      const history = (await api("GET", `/api/quotations/${q.id}/history`)).body;
      expect(history.some((h: any) => h.event.includes("accepted"))).toBe(true);
    });

    it.each([
      ["draft", "invoiced"],
      ["draft", "draft"],
      ["draft", "bogus"],
    ])("rejects %s -> %s", async (_from, to) => {
      const client = await createClient(api, "QBad");
      const q = await createQuotation(api, client.id);
      const r = await setStatus(q.id, to);
      expect(r.status).toBe(400);
      expect((await getQuotation(q.id)).status).toBe("draft");
    });

    it("only allows an accepted quotation to move to rejected", async () => {
      const client = await createClient(api, "QAccepted");
      const q = await createQuotation(api, client.id);
      await setStatus(q.id, "accepted");
      expect((await setStatus(q.id, "sent")).status).toBe(400);
      expect((await setStatus(q.id, "rejected")).status).toBe(200);
    });

    it("enforces the same matrix through PATCH /api/quotations/:id", async () => {
      const client = await createClient(api, "QPatch");
      const q = await createQuotation(api, client.id);
      expect((await api("PATCH", `/api/quotations/${q.id}`, { status: "invoiced" })).status).toBe(400);
      expect((await api("PATCH", `/api/quotations/${q.id}`, { status: "sent" })).status).toBe(200);
    });
  });

  describe("convert to invoice", () => {
    it("creates an invoice with copied items and totals, and marks the quotation invoiced", async () => {
      const client = await createClient(api, "QConvert");
      const q = await createQuotation(api, client.id, "Website");
      await addItem(api, q.id, 2, 100, { description: "Design" }); // 200
      await addItem(api, q.id, 1, 100, { description: "Hosting", discountPercent: 10 }); // 90
      await setStatus(q.id, "accepted");

      const r = await api("POST", `/api/quotations/${q.id}/convert-to-invoice`);
      expect(r.status).toBe(201);
      expect(r.body.invoice.amount).toBe("290.00");
      expect(r.body.invoice.subtotal).toBe("300.00");
      expect(r.body.invoice.quotationId).toBe(q.id);
      expect(r.body.invoice.clientId).toBe(client.id);
      expect(r.body.items.map((i: any) => i.description).sort()).toEqual(["Design", "Hosting"]);

      const cur = await getQuotation(q.id);
      expect(cur.status).toBe("invoiced");
      expect(cur.invoiceId).toBe(r.body.invoice.id);

      // invoiced is terminal
      expect((await setStatus(q.id, "rejected")).status).toBe(400);
    });

    it("returns 404 for an unknown quotation", async () => {
      const r = await api("POST", "/api/quotations/00000000-0000-0000-0000-000000000000/convert-to-invoice");
      expect(r.status).toBe(404);
    });

    it("does not create a second invoice when the quotation was already converted", async () => {
      const client = await createClient(api, "QTwice");
      const q = await createQuotation(api, client.id);
      await addItem(api, q.id, 1, 100);
      await setStatus(q.id, "accepted");
      expect((await api("POST", `/api/quotations/${q.id}/convert-to-invoice`)).status).toBe(201);

      const second = await api("POST", `/api/quotations/${q.id}/convert-to-invoice`);
      expect(second.status).toBe(409);

      const { db } = ctx;
      const { invoices } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      const rows = await db.select().from(invoices).where(eq(invoices.quotationId, q.id));
      expect(rows).toHaveLength(1);
    });
  });

  describe("deletion", () => {
    it("deletes a quotation together with its items", async () => {
      const client = await createClient(api, "QDelete");
      const q = await createQuotation(api, client.id);
      await addItem(api, q.id, 1, 100);
      expect((await api("DELETE", `/api/quotations/${q.id}`)).status).toBe(200);
      expect((await api("GET", `/api/quotations/${q.id}`)).status).toBe(404);

      const { db } = ctx;
      const { quotationItems } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      expect(await db.select().from(quotationItems).where(eq(quotationItems.quotationId, q.id))).toHaveLength(0);
    });

    it("returns 404 when deleting an unknown quotation", async () => {
      expect((await api("DELETE", "/api/quotations/00000000-0000-0000-0000-000000000000")).status).toBe(404);
    });
  });

  describe("print snapshot", () => {
    it("does not take item discounts off a second time", async () => {
      const client = await createClient(api, "QPrint");
      const q = await createQuotation(api, client.id);
      await addItem(api, q.id, 1, 42240, { discountPercent: 20 });
      await addItem(api, q.id, 1, 33000);
      await addItem(api, q.id, 1, 14520, { discountPercent: 100 });

      const net = 33792 + 33000; // what the page shows as subtotal and total
      expect(parseFloat((await getQuotation(q.id)).amount)).toBe(net);

      const printed = await api("POST", `/api/quotations/${q.id}/print`, { displayCurrency: "SAR", exchangeRate: "13.2" });
      expect(printed.status).toBe(200);
      const record = (await api("GET", `/api/quotation-print-records/${printed.body.printRecordId}`)).body;
      const snap = record.printSnapshotJson ?? record.snapshot ?? record;
      expect(parseFloat(snap.egpSubtotal)).toBe(net);
      expect(parseFloat(snap.egpDiscountAmount)).toBe(0);
      expect(parseFloat(snap.egpTotal)).toBe(net);
      expect(parseFloat(snap.displayTotal)).toBeCloseTo(net / 13.2, 2);
    });

    it("prints an invoice converted from a discounted quotation with the invoice's own total", async () => {
      const client = await createClient(api, "QPrintInvoice");
      const q = await createQuotation(api, client.id);
      await addItem(api, q.id, 1, 1000, { discountPercent: 20 });
      await addItem(api, q.id, 1, 500);
      expect((await setStatus(q.id, "sent")).status).toBe(200);
      expect((await setStatus(q.id, "accepted")).status).toBe(200);
      const converted = await api("POST", `/api/quotations/${q.id}/convert-to-invoice`);
      expect(converted.status).toBe(201);
      const invoice = converted.body.invoice ?? converted.body;

      const printed = await api("POST", `/api/invoices/${invoice.id}/print`, { displayCurrency: "USD", exchangeRate: "50" });
      expect(printed.status).toBe(200);
      const record = (await api("GET", `/api/invoice-print-records/${printed.body.printRecordId}`)).body;
      const snap = record.printSnapshotJson ?? record.snapshot ?? record;
      expect(parseFloat(snap.egpTotal)).toBe(parseFloat(invoice.amount));
      expect(parseFloat(snap.egpTotal)).toBe(1300);
      expect(parseFloat(snap.displayTotal)).toBe(26);
    });
  });
});
