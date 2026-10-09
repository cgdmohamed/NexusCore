import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, createInvoice, pay, startApp, TEST_DATABASE_URL } from "./helpers";

describe.skipIf(!TEST_DATABASE_URL)("client account statement (integration)", () => {
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

  it("matches what the client really owes after payments, credit, refunds and cancellation", async () => {
    const client = await createClient(api, "Ledger");

    // Fully paid with an approved overpayment of 200 -> credit balance 200
    const a = await createInvoice(api, client.id, "1000");
    expect((await pay(api, a.id, 1200, { adminApproved: true })).status).toBe(201);
    // Part of the credit goes onto another invoice
    const b = await createInvoice(api, client.id, "500");
    expect((await api("POST", `/api/invoices/${b.id}/apply-credit`, { creditAmount: 150 })).status).toBe(200);
    // Part of the remaining credit is handed back
    expect((await api("POST", `/api/clients/${client.id}/credit/refund`, { refundAmount: 20, refundMethod: "cash" })).status).toBe(200);
    // Paid, then partly refunded
    const e = await createInvoice(api, client.id, "400");
    expect((await pay(api, e.id, 400)).status).toBe(201);
    expect((await api("POST", `/api/invoices/${e.id}/refund`, { refundAmount: 100, refundMethod: "cash" })).status).toBe(200);
    // Never issued, and voided: neither bills the client
    await createInvoice(api, client.id, "300");
    const voided = await createInvoice(api, client.id, "999");
    expect((await api("POST", `/api/invoices/${voided.id}/cancel`)).status).toBe(200);

    const r = await api("GET", `/api/clients/${client.id}/statement`);
    expect(r.status).toBe(200);
    const s = r.body;
    expect(s.client.name).toBe("Ledger");
    expect(s.company.name).toBeTruthy();
    expect(s.entries.some((x: any) => x.kind === "credit_applied")).toBe(true);
    expect(s.entries.filter((x: any) => x.invoiceNumber === voided.invoiceNumber)[0]).toMatchObject({ debit: 0 });

    // What the client owes = invoices still open (350 on b, 100 on e) minus the 30 credit still held
    expect(s.position).toMatchObject({ outstanding: 450, creditBalance: 30 });
    expect(s.totals.closingBalance).toBe(420);
    expect(s.totals.closingBalance).toBe(s.position.outstanding - s.position.creditBalance);
    // The running balance of the last row is the closing balance
    expect(s.entries[s.entries.length - 1].balance).toBe(s.totals.closingBalance);
  });

  it("filters by period and keeps the opening balance", async () => {
    const client = await createClient(api, "Period");
    const inv = await createInvoice(api, client.id, "100");
    await api("PATCH", `/api/invoices/${inv.id}/status`, { status: "sent" });

    const future = await api("GET", `/api/clients/${client.id}/statement?from=2099-01-01&to=2099-12-31`);
    expect(future.status).toBe(200);
    expect(future.body.entries).toHaveLength(0);
    expect(future.body.openingBalance).toBe(100);
    expect(future.body.totals.closingBalance).toBe(100);
  });

  it("rejects bad dates and unknown clients", async () => {
    const client = await createClient(api, "Validation");
    expect((await api("GET", `/api/clients/${client.id}/statement?from=yesterday`)).status).toBe(400);
    expect((await api("GET", `/api/clients/${client.id}/statement?from=2026-02-01&to=2026-01-01`)).status).toBe(400);
    expect((await api("GET", "/api/clients/00000000-0000-0000-0000-000000000000/statement")).status).toBe(404);
  });
});
