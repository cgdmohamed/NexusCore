import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addItem, createClient, createInvoice, createQuotation, pay, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("monetary input validation (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const invoiceOf = async (id: string) => (await api("GET", `/api/invoices/${id}`)).body;
  const clientOf = async (id: string) => (await api("GET", `/api/clients/${id}`)).body;
  const quotationOf = async (id: string) => (await api("GET", `/api/quotations/${id}`)).body;

  const BAD_AMOUNTS: Array<[string, unknown]> = [
    ["text", "abc"],
    ["negative", -40],
    ["negative string", "-40"],
    ["zero", 0],
    ["empty string", ""],
    ["missing", undefined],
    ["null", null],
    ["Infinity", "Infinity"],
    ["exceeds numeric(10,2)", 1e12],
  ];

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  describe("invoice payments", () => {
    it.each(BAD_AMOUNTS)("rejects a %s payment amount and leaves the invoice untouched", async (_label, amount) => {
      const client = await createClient(api, "PayBad");
      const inv = await createInvoice(api, client.id, "100");
      const r = await pay(api, inv.id, amount as number);
      expect(r.status).toBe(400);

      const cur = await invoiceOf(inv.id);
      expect(cur.paidAmount).toBe("0.00");
      expect(cur.status).toBe("draft");
      const { db } = ctx;
      const { payments } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      expect(await db.select().from(payments).where(eq(payments.invoiceId, inv.id))).toHaveLength(0);
    });

    it("rejects a missing or invalid payment date and a missing method", async () => {
      const client = await createClient(api, "PayDate");
      const inv = await createInvoice(api, client.id, "100");
      const base = { amount: 10, paymentMethod: "cash", paymentDate: new Date().toISOString() };
      expect((await api("POST", `/api/invoices/${inv.id}/payments`, { ...base, paymentDate: undefined })).status).toBe(400);
      expect((await api("POST", `/api/invoices/${inv.id}/payments`, { ...base, paymentDate: "nope" })).status).toBe(400);
      expect((await api("POST", `/api/invoices/${inv.id}/payments`, { ...base, paymentMethod: undefined })).status).toBe(400);
      expect((await invoiceOf(inv.id)).paidAmount).toBe("0.00");
    });

    it("still accepts valid amounts, including numeric strings and decimals", async () => {
      const client = await createClient(api, "PayOk");
      const inv = await createInvoice(api, client.id, "100");
      expect((await pay(api, inv.id, "50.5")).status).toBe(201);
      expect((await pay(api, inv.id, 0.25)).status).toBe(201);
      expect((await invoiceOf(inv.id)).paidAmount).toBe("50.75");
    });
  });

  describe("apply client credit", () => {
    const setup = async (name: string) => {
      const client = await createClient(api, name);
      const donor = await createInvoice(api, client.id, "100");
      await pay(api, donor.id, 150, { adminApproved: true }); // 50 credit
      const target = await createInvoice(api, client.id, "100");
      return { client, target };
    };

    it.each(BAD_AMOUNTS.filter(([l]) => l !== "exceeds numeric(10,2)"))(
      "rejects a %s credit amount without changing the invoice or the credit balance",
      async (_label, creditAmount) => {
        const { client, target } = await setup(`Credit-${_label}`);
        const r = await api("POST", `/api/invoices/${target.id}/apply-credit`, { clientId: client.id, creditAmount });
        expect(r.status).toBe(400);
        expect((await invoiceOf(target.id)).paidAmount).toBe("0.00");
        expect((await clientOf(client.id)).creditBalance).toBe("50.00");
      },
    );

    it("still applies a valid credit amount", async () => {
      const { client, target } = await setup("CreditOk");
      const r = await api("POST", `/api/invoices/${target.id}/apply-credit`, { clientId: client.id, creditAmount: 20 });
      expect(r.status).toBeLessThan(300);
      expect((await invoiceOf(target.id)).paidAmount).toBe("20.00");
      expect((await clientOf(client.id)).creditBalance).toBe("30.00");
    });
  });

  describe("invoice creation", () => {
    it.each([
      ["negative amount", { amount: "-50" }],
      ["text amount", { amount: "abc" }],
      ["negative subtotal", { amount: "10", subtotal: "-5" }],
      ["negative tax amount", { amount: "10", taxAmount: "-5" }],
      ["negative discount amount", { amount: "10", discountAmount: "-5" }],
      ["tax rate above 100", { amount: "10", taxRate: "101" }],
      ["negative discount rate", { amount: "10", discountRate: "-1" }],
      ["amount above numeric(10,2)", { amount: "1e12" }],
    ])("rejects %s", async (_label, body) => {
      const client = await createClient(api, `InvBad-${_label}`);
      const r = await api("POST", "/api/invoices", { clientId: client.id, ...body });
      expect(r.status).toBe(400);
    });

    it("still creates invoices with no amount (draft to be filled with items) or a valid amount", async () => {
      const client = await createClient(api, "InvOk");
      const empty = await api("POST", "/api/invoices", { clientId: client.id });
      expect(empty.status).toBe(201);
      expect(empty.body.amount).toBe("0.00");
      const full = await api("POST", "/api/invoices", { clientId: client.id, amount: "123.45", taxRate: "14" });
      expect(full.status).toBe(201);
      expect(full.body.amount).toBe("123.45");
    });
  });

  describe("invoice items", () => {
    const add = (invoiceId: string, body: object) =>
      api("POST", `/api/invoices/${invoiceId}/items`, { name: "Item", ...body });

    it.each([
      ["zero quantity", { quantity: "0", unitPrice: "10" }],
      ["negative quantity", { quantity: "-1", unitPrice: "10" }],
      ["text quantity", { quantity: "abc", unitPrice: "10" }],
      ["missing quantity", { unitPrice: "10" }],
      ["negative unit price", { quantity: "1", unitPrice: "-5" }],
      ["text unit price", { quantity: "1", unitPrice: "abc" }],
      ["missing unit price", { quantity: "1" }],
    ])("rejects an item with %s and leaves invoice totals untouched", async (_label, body) => {
      const client = await createClient(api, `ItemBad-${_label}`);
      const inv = await createInvoice(api, client.id, "0");
      expect((await add(inv.id, { quantity: "2", unitPrice: "50" })).status).toBe(201); // baseline 100
      const r = await add(inv.id, body);
      expect(r.status).toBe(400);
      const cur = await invoiceOf(inv.id);
      expect(cur.subtotal).toBe("100.00");
      expect(cur.amount).toBe("100.00");
    });

    it("rejects invalid values when editing an item", async () => {
      const client = await createClient(api, "ItemEdit");
      const inv = await createInvoice(api, client.id, "0");
      const item = (await add(inv.id, { quantity: "2", unitPrice: "50" })).body;
      for (const body of [{ quantity: "abc", unitPrice: "10" }, { quantity: "1", unitPrice: "-1" }, { quantity: "0", unitPrice: "1" }]) {
        const r = await api("PATCH", `/api/invoices/${inv.id}/items/${item.id}`, { name: "Item", ...body });
        expect(r.status).toBe(400);
      }
      expect((await invoiceOf(inv.id)).amount).toBe("100.00");
    });

    it("accepts a zero unit price (included items) and valid edits", async () => {
      const client = await createClient(api, "ItemOk");
      const inv = await createInvoice(api, client.id, "0");
      expect((await add(inv.id, { quantity: "1", unitPrice: "0" })).status).toBe(201);
      const item = (await add(inv.id, { quantity: "3", unitPrice: "10" })).body;
      const r = await api("PATCH", `/api/invoices/${inv.id}/items/${item.id}`, { name: "Item", quantity: "4", unitPrice: "10" });
      expect(r.status).toBe(200);
      expect((await invoiceOf(inv.id)).amount).toBe("40.00");
    });
  });

  describe("quotation items", () => {
    it.each([
      ["zero quantity", { quantity: "0", unitPrice: "10", totalPrice: "0" }],
      ["negative quantity", { quantity: "-1", unitPrice: "10", totalPrice: "-10" }],
      ["text quantity", { quantity: "abc", unitPrice: "10", totalPrice: "10" }],
      ["negative unit price", { quantity: "1", unitPrice: "-10", totalPrice: "-10" }],
      ["negative total price", { quantity: "1", unitPrice: "10", totalPrice: "-10" }],
      ["text total price", { quantity: "1", unitPrice: "10", totalPrice: "abc" }],
      ["discount above 100", { quantity: "1", unitPrice: "10", totalPrice: "10", discount: "150" }],
      ["negative discount", { quantity: "1", unitPrice: "10", totalPrice: "10", discount: "-5" }],
    ])("rejects an item with %s and leaves the quotation untouched", async (_label, body) => {
      const client = await createClient(api, `QItemBad-${_label}`);
      const q = await createQuotation(api, client.id);
      expect((await addItem(api, q.id, 2, 50)).status).toBe(201); // baseline 100
      const r = await api("POST", `/api/quotations/${q.id}/items`, { description: "x", ...body });
      expect(r.status).toBe(400);
      const cur = await quotationOf(q.id);
      expect(cur.amount).toBe("100.00");
      expect(cur.subtotal).toBe("100.00");
    });

    it("rejects invalid values when editing an item", async () => {
      const client = await createClient(api, "QItemEdit");
      const q = await createQuotation(api, client.id);
      const item = (await addItem(api, q.id, 2, 50)).body;
      for (const body of [{ quantity: "abc", unitPrice: "10" }, { quantity: "1", unitPrice: "-1" }, { quantity: "0", unitPrice: "1" }, { quantity: "1", unitPrice: "1", discount: "101" }]) {
        const r = await api("PATCH", `/api/quotations/${q.id}/items/${item.id}`, { description: "x", ...body });
        expect(r.status).toBe(400);
      }
      expect((await quotationOf(q.id)).amount).toBe("100.00");
    });
  });
});
