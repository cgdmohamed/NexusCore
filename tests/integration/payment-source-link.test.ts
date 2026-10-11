import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, createInvoice, createPaymentSource, pay, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("client payments and the accounts they land in (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const balance = async (id: string) => parseFloat((await api("GET", `/api/payment-sources/${id}`)).body.currentBalance);
  const transactions = async (id: string) => (await api("GET", `/api/payment-sources/${id}/transactions`)).body as any[];

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  it("adds a collection to the chosen account and logs it", async () => {
    const client = await createClient(api, "SrcPay");
    const inv = await createInvoice(api, client.id, "1000");
    const src = await createPaymentSource(api, "500");

    const r = await pay(api, inv.id, 400, { paymentSourceId: src.id });
    expect(r.status).toBe(201);
    expect(r.body.payment.paymentSourceId).toBe(src.id);
    expect(await balance(src.id)).toBe(900);

    const tx = (await transactions(src.id)).find((t) => t.type === "income");
    expect(tx).toMatchObject({ amount: "400.00", balanceBefore: "500.00", balanceAfter: "900.00", referenceType: "payment", referenceId: r.body.payment.id });

    const listed = (await api("GET", `/api/invoices/${inv.id}/payments`)).body;
    expect(listed[0].paymentSourceName).toBe(src.name);
  });

  it("leaves every balance alone when no account is chosen", async () => {
    const client = await createClient(api, "NoSrc");
    const inv = await createInvoice(api, client.id, "300");
    const src = await createPaymentSource(api, "100", "Untouched");
    expect((await pay(api, inv.id, 300)).status).toBe(201);
    expect(await balance(src.id)).toBe(100);
  });

  it("counts the whole amount received, including an overpayment turned into client credit", async () => {
    const client = await createClient(api, "OverSrc");
    const inv = await createInvoice(api, client.id, "100");
    const src = await createPaymentSource(api, "0", "Over");
    const r = await pay(api, inv.id, 130, { paymentSourceId: src.id, adminApproved: true });
    expect(r.status).toBe(201);
    expect(await balance(src.id)).toBe(130);
  });

  it("refuses an unknown or inactive account without recording the payment", async () => {
    const client = await createClient(api, "BadSrc");
    const inv = await createInvoice(api, client.id, "200");
    const src = await createPaymentSource(api, "50", "Dormant");
    await api("PUT", `/api/payment-sources/${src.id}`, { name: src.name, accountType: "bank", isActive: false });

    expect((await pay(api, inv.id, 50, { paymentSourceId: "00000000-0000-0000-0000-000000000000" })).status).toBe(404);
    expect((await pay(api, inv.id, 50, { paymentSourceId: src.id })).status).toBe(400);
    expect((await api("GET", `/api/invoices/${inv.id}/payments`)).body).toHaveLength(0);
    expect((await api("GET", `/api/invoices/${inv.id}`)).body.paidAmount).toBe("0.00");
  });

  it("does not move money for a payment made from the client's credit", async () => {
    const client = await createClient(api, "CreditSrc");
    const inv = await createInvoice(api, client.id, "100");
    const src = await createPaymentSource(api, "10", "Credit");
    const r = await pay(api, inv.id, 50, { paymentSourceId: src.id, paymentMethod: "credit_balance" });
    expect(r.status).toBe(400);
    expect(await balance(src.id)).toBe(10);
  });

  it("takes a refund out of the account the user chooses", async () => {
    const client = await createClient(api, "RefundSrc");
    const inv = await createInvoice(api, client.id, "500");
    const src = await createPaymentSource(api, "0", "Refunds");
    await pay(api, inv.id, 500, { paymentSourceId: src.id });
    expect(await balance(src.id)).toBe(500);

    const r = await api("POST", `/api/invoices/${inv.id}/refund`, { refundAmount: 120, refundMethod: "bank_transfer", refundSourceId: src.id });
    expect(r.status).toBe(200);
    expect(await balance(src.id)).toBe(380);
    expect((await transactions(src.id)).some((t) => t.type === "client_refund" && t.amount === "120.00")).toBe(true);
  });

  it("takes a credit refund out of the chosen account", async () => {
    const client = await createClient(api, "CreditRefund");
    const inv = await createInvoice(api, client.id, "100");
    const src = await createPaymentSource(api, "1000", "CreditRefunds");
    await pay(api, inv.id, 160, { adminApproved: true }); // 60 becomes credit
    const r = await api("POST", `/api/clients/${client.id}/credit/refund`, { refundAmount: 40, refundMethod: "cash", refundSourceId: src.id });
    expect(r.status).toBe(200);
    expect(await balance(src.id)).toBe(960);
  });

  it("assigns an account to an old payment once, adding its amount a single time", async () => {
    const client = await createClient(api, "Late");
    const inv = await createInvoice(api, client.id, "250");
    const src = await createPaymentSource(api, "10", "Late");
    const payment = (await pay(api, inv.id, 250)).body.payment;

    const [a, b] = await Promise.all([
      api("PATCH", `/api/payments/${payment.id}/source`, { paymentSourceId: src.id }),
      api("PATCH", `/api/payments/${payment.id}/source`, { paymentSourceId: src.id }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await balance(src.id)).toBe(260);
    expect((await api("PATCH", `/api/payments/${payment.id}/source`, { paymentSourceId: src.id })).status).toBe(409);
  });

  it("refuses to delete an account that has client payments on it", async () => {
    const client = await createClient(api, "Keep");
    const inv = await createInvoice(api, client.id, "50");
    const src = await createPaymentSource(api, "0", "Keep");
    await pay(api, inv.id, 50, { paymentSourceId: src.id });
    expect((await api("DELETE", `/api/payment-sources/${src.id}`)).status).toBe(400);
  });
});
