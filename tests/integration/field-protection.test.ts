import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addItem, createClient, createInvoice, createQuotation, pay, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("protected fields & invoice consistency (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const invoiceOf = async (id: string) => (await api("GET", `/api/invoices/${id}`)).body;
  const clientOf = async (id: string) => (await api("GET", `/api/clients/${id}`)).body;
  const quotationOf = async (id: string) => (await api("GET", `/api/quotations/${id}`)).body;
  const patchInvoice = (id: string, body: object) => api("PATCH", `/api/invoices/${id}`, body);
  const addInvoiceItem = (invoiceId: string, quantity: number, unitPrice: number) =>
    api("POST", `/api/invoices/${invoiceId}/items`, { name: "Item", quantity, unitPrice });

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  describe("A3 - PATCH /api/invoices/:id", () => {
    it("ignores protected fields but applies the editable ones", async () => {
      const client = await createClient(api, "InvProt");
      const other = await createClient(api, "InvOther");
      const inv = await createInvoice(api, client.id, "100");

      const r = await patchInvoice(inv.id, {
        title: "Renamed",
        notes: "n",
        status: "paid",
        invoiceNumber: "HACK-1",
        amount: "1.00",
        paidAmount: "50",
        clientId: other.id,
        createdBy: "garbage",
        quotationId: "garbage",
      });
      expect(r.status).toBe(200);
      const cur = await invoiceOf(inv.id);
      expect(cur).toMatchObject({ title: "Renamed", notes: "n", status: "draft", invoiceNumber: inv.invoiceNumber, amount: "100.00", paidAmount: "0.00", clientId: client.id });
      expect(cur.createdBy).toBe(inv.createdBy);
      expect(cur.quotationId).toBeNull();
    });

    it("updates description, payment terms and due date", async () => {
      const client = await createClient(api, "InvDue");
      const inv = await createInvoice(api, client.id, "100");
      const r = await patchInvoice(inv.id, { description: "d", paymentTerms: "Net 15", dueDate: "2030-01-15" });
      expect(r.status).toBe(200);
      const cur = await invoiceOf(inv.id);
      expect(cur.description).toBe("d");
      expect(cur.paymentTerms).toBe("Net 15");
      expect(cur.dueDate.startsWith("2030-01-15")).toBe(true);
    });

    it("derives the amount from subtotal, tax and discount", async () => {
      const client = await createClient(api, "InvTax");
      const inv = await createInvoice(api, client.id, "100");
      expect((await patchInvoice(inv.id, { taxRate: "14", taxAmount: "14", discountRate: "10", discountAmount: "10", amount: "9999", subtotal: "9999" })).status).toBe(200);
      const cur = await invoiceOf(inv.id);
      expect(cur).toMatchObject({ subtotal: "100.00", taxAmount: "14.00", discountAmount: "10.00", amount: "104.00" });
    });

    it.each([
      ["negative tax amount", { taxAmount: "-5" }],
      ["text discount amount", { discountAmount: "abc" }],
      ["tax rate above 100", { taxRate: "150" }],
    ])("rejects %s", async (_label, body) => {
      const client = await createClient(api, `InvTaxBad-${_label}`);
      const inv = await createInvoice(api, client.id, "100");
      expect((await patchInvoice(inv.id, body)).status).toBe(400);
      expect((await invoiceOf(inv.id)).amount).toBe("100.00");
    });

    it("returns 404 for an unknown invoice", async () => {
      expect((await patchInvoice("00000000-0000-0000-0000-000000000000", { title: "x" })).status).toBe(404);
    });

    it("does not allow editing the financials of a cancelled invoice", async () => {
      const client = await createClient(api, "InvCancelled");
      const inv = await createInvoice(api, client.id, "100");
      await api("POST", `/api/invoices/${inv.id}/cancel`);
      expect((await patchInvoice(inv.id, { taxAmount: "10" })).status).toBe(409);
      expect((await invoiceOf(inv.id)).amount).toBe("100.00");
    });
  });

  describe("A3 - PATCH /api/quotations/:id", () => {
    it("ignores protected fields but applies the editable ones", async () => {
      const client = await createClient(api, "QProt");
      const other = await createClient(api, "QOther");
      const q = await createQuotation(api, client.id, "Original");
      await addItem(api, q.id, 1, 100);

      const r = await api("PATCH", `/api/quotations/${q.id}`, {
        title: "Renamed",
        notes: "n",
        terms: "t",
        validUntil: "2030-01-15",
        amount: "1.00",
        quotationNumber: "X-1",
        clientId: other.id,
        createdBy: "garbage",
        invoiceId: "garbage",
      });
      expect(r.status).toBe(200);
      const cur = await quotationOf(q.id);
      expect(cur).toMatchObject({ title: "Renamed", notes: "n", terms: "t", amount: "100.00", quotationNumber: q.quotationNumber, clientId: client.id, status: "draft" });
      expect(cur.invoiceId).toBeNull();
      expect(cur.validUntil.startsWith("2030-01-15")).toBe(true);
    });

    it("still enforces the status matrix and recalculates the amount from items on a status change", async () => {
      const client = await createClient(api, "QStatus");
      const q = await createQuotation(api, client.id);
      await addItem(api, q.id, 2, 50);
      expect((await api("PATCH", `/api/quotations/${q.id}`, { status: "invoiced" })).status).toBe(400);
      const r = await api("PATCH", `/api/quotations/${q.id}`, { status: "sent", amount: "1" });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ status: "sent", amount: "100.00" });
    });

    it("returns 404 for an unknown quotation", async () => {
      expect((await api("PATCH", "/api/quotations/00000000-0000-0000-0000-000000000000", { title: "x" })).status).toBe(404);
    });
  });

  describe("A4 - PATCH /api/clients/:id", () => {
    it("cannot change the credit balance directly", async () => {
      const client = await createClient(api, "CreditProt");
      const r = await api("PATCH", `/api/clients/${client.id}`, { name: "Renamed", creditBalance: "99999" });
      expect(r.status).toBe(200);
      const cur = await clientOf(client.id);
      expect(cur.name).toBe("Renamed");
      expect(cur.creditBalance).toBe("0.00");
    });

    it("still edits contact details, status and total value", async () => {
      const client = await createClient(api, "ClientEdit");
      const r = await api("PATCH", `/api/clients/${client.id}`, { phone: "123", city: "Cairo", status: "inactive", totalValue: "250" });
      expect(r.status).toBe(200);
      expect(await clientOf(client.id)).toMatchObject({ phone: "123", city: "Cairo", status: "inactive", totalValue: "250.00" });
    });

    it("rejects an invalid total value instead of storing NaN", async () => {
      const client = await createClient(api, "ClientBadValue");
      expect((await api("PATCH", `/api/clients/${client.id}`, { totalValue: "abc" })).status).toBe(400);
      expect((await api("PATCH", `/api/clients/${client.id}`, { totalValue: "-5" })).status).toBe(400);
      expect((await clientOf(client.id)).totalValue).toBe("0.00");
    });

    it("returns 404 for an unknown client", async () => {
      expect((await api("PATCH", "/api/clients/00000000-0000-0000-0000-000000000000", { name: "x" })).status).toBe(404);
    });
  });

  describe("A5 - apply-credit stays within the invoice's client", () => {
    const withCredit = async (name: string) => {
      const client = await createClient(api, name);
      const donor = await createInvoice(api, client.id, "100");
      await pay(api, donor.id, 150, { adminApproved: true }); // 50 credit
      return client;
    };

    it("rejects applying one client's credit to another client's invoice", async () => {
      const a = await withCredit("CreditA");
      const b = await createClient(api, "CreditB");
      const invB = await createInvoice(api, b.id, "100");
      const r = await api("POST", `/api/invoices/${invB.id}/apply-credit`, { clientId: a.id, creditAmount: 20 });
      expect(r.status).toBe(400);
      expect((await invoiceOf(invB.id)).paidAmount).toBe("0.00");
      expect((await clientOf(a.id)).creditBalance).toBe("50.00");
    });

    it("uses the invoice's own client when clientId is omitted", async () => {
      const a = await withCredit("CreditOmit");
      const inv = await createInvoice(api, a.id, "100");
      const r = await api("POST", `/api/invoices/${inv.id}/apply-credit`, { creditAmount: 20 });
      expect(r.status).toBeLessThan(300);
      expect((await invoiceOf(inv.id)).paidAmount).toBe("20.00");
      expect((await clientOf(a.id)).creditBalance).toBe("30.00");
    });

    it("returns 404 for an unknown invoice", async () => {
      const a = await withCredit("CreditUnknown");
      const r = await api("POST", "/api/invoices/00000000-0000-0000-0000-000000000000/apply-credit", { clientId: a.id, creditAmount: 5 });
      expect(r.status).toBe(404);
      expect((await clientOf(a.id)).creditBalance).toBe("50.00");
    });
  });

  describe("A6 - editing a paid invoice keeps status consistent", () => {
    const paidInvoice = async (name: string) => {
      const client = await createClient(api, name);
      const inv = await createInvoice(api, client.id, "100");
      await pay(api, inv.id, 100);
      expect((await invoiceOf(inv.id)).status).toBe("paid");
      return inv;
    };

    it("raising the total moves a paid invoice back to partially_paid", async () => {
      const inv = await paidInvoice("PaidUp");
      expect((await patchInvoice(inv.id, { taxAmount: "5" })).status).toBe(200);
      const cur = await invoiceOf(inv.id);
      expect(cur).toMatchObject({ amount: "105.00", paidAmount: "100.00", status: "partially_paid" });
    });

    it("lowering the total to the paid amount marks a partially paid invoice paid", async () => {
      const client = await createClient(api, "PaidDown");
      const inv = await createInvoice(api, client.id, "100");
      await pay(api, inv.id, 80);
      expect((await invoiceOf(inv.id)).status).toBe("partially_paid");
      expect((await patchInvoice(inv.id, { discountAmount: "20" })).status).toBe(200);
      expect(await invoiceOf(inv.id)).toMatchObject({ amount: "80.00", status: "paid" });
    });

    it("refuses to lower the total below what was already paid", async () => {
      const inv = await paidInvoice("PaidBelow");
      const r = await patchInvoice(inv.id, { discountAmount: "30" });
      expect(r.status).toBe(400);
      expect(await invoiceOf(inv.id)).toMatchObject({ amount: "100.00", status: "paid" });
    });

    it("applies the same rules to item changes", async () => {
      const client = await createClient(api, "PaidItems");
      const inv = await createInvoice(api, client.id, "0");
      const first = (await addInvoiceItem(inv.id, 1, 100)).body;
      await pay(api, inv.id, 100);

      // adding an item raises the total -> partially_paid
      const extra = (await addInvoiceItem(inv.id, 1, 50)).body;
      expect(await invoiceOf(inv.id)).toMatchObject({ amount: "150.00", status: "partially_paid" });

      // removing it again -> paid
      expect((await api("DELETE", `/api/invoices/${inv.id}/items/${extra.id}`)).status).toBe(200);
      expect(await invoiceOf(inv.id)).toMatchObject({ amount: "100.00", status: "paid" });

      // cannot drop below paid by removing or shrinking the remaining item
      expect((await api("DELETE", `/api/invoices/${inv.id}/items/${first.id}`)).status).toBe(400);
      const shrink = await api("PATCH", `/api/invoices/${inv.id}/items/${first.id}`, { name: "Item", quantity: 1, unitPrice: 10 });
      expect(shrink.status).toBe(400);
      expect(await invoiceOf(inv.id)).toMatchObject({ amount: "100.00", status: "paid" });
      const items = (await api("GET", `/api/invoices/${inv.id}/items`)).body;
      expect(items).toHaveLength(1);
      expect(items[0].unitPrice).toBe("100.00");
    });

    it("does not allow item changes on a cancelled invoice", async () => {
      const client = await createClient(api, "CancelledItems");
      const inv = await createInvoice(api, client.id, "0");
      const item = (await addInvoiceItem(inv.id, 1, 100)).body;
      await api("POST", `/api/invoices/${inv.id}/cancel`);
      expect((await addInvoiceItem(inv.id, 1, 5)).status).toBe(409);
      expect((await api("DELETE", `/api/invoices/${inv.id}/items/${item.id}`)).status).toBe(409);
    });
  });
});
