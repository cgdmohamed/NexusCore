import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCategory, createExpense, createPaymentSource, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("payment sources (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const getSource = async (id: string) => (await api("GET", `/api/payment-sources/${id}`)).body;
  const adjust = (id: string, amount: number | string, description = "Manual", extra: object = {}) =>
    api("POST", `/api/payment-sources/${id}/adjust-balance`, { amount, description, ...extra });

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  describe("creation", () => {
    it("sets the current balance to the initial balance and logs an initial transaction", async () => {
      const src = await createPaymentSource(api, "1500.50");
      expect(src.initialBalance).toBe("1500.50");
      expect(src.currentBalance).toBe("1500.50");

      const tx = (await api("GET", `/api/payment-sources/${src.id}/transactions`)).body;
      expect(tx).toHaveLength(1);
      expect(tx[0]).toMatchObject({ type: "adjustment", amount: "1500.50", balanceBefore: "0.00", balanceAfter: "1500.50" });
    });

    it("defaults to a zero balance with no transactions", async () => {
      const r = await api("POST", "/api/payment-sources", { name: "Empty", accountType: "cash" });
      expect(r.status).toBe(201);
      expect(r.body.currentBalance).toBe("0.00");
      expect((await api("GET", `/api/payment-sources/${r.body.id}/transactions`)).body).toHaveLength(0);
    });

    it("rejects an invalid payload with a client error, not a 500", async () => {
      const r = await api("POST", "/api/payment-sources", { accountType: "bank" }); // name missing
      expect(r.status).toBe(400);
    });

    it("returns 404 for an unknown source", async () => {
      expect((await api("GET", "/api/payment-sources/00000000-0000-0000-0000-000000000000")).status).toBe(404);
    });
  });

  describe("manual balance adjustment", () => {
    it("adds and subtracts with exact decimal arithmetic and records each transaction", async () => {
      const src = await createPaymentSource(api, "100.10");
      expect((await adjust(src.id, 0.2)).status).toBe(200);
      const r = await adjust(src.id, -50.05);
      expect(r.status).toBe(200);
      expect(r.body.currentBalance).toBe("50.25");

      const tx = (await api("GET", `/api/payment-sources/${src.id}/transactions`)).body;
      expect(tx).toHaveLength(3);
      const last = tx.find((t: any) => t.amount === "-50.05");
      expect(last).toMatchObject({ balanceBefore: "100.30", balanceAfter: "50.25", referenceType: "manual_adjustment" });
    });

    it("requires an amount and a description", async () => {
      const src = await createPaymentSource(api, "10");
      expect((await api("POST", `/api/payment-sources/${src.id}/adjust-balance`, { description: "x" })).status).toBe(400);
      expect((await api("POST", `/api/payment-sources/${src.id}/adjust-balance`, { amount: 5 })).status).toBe(400);
      expect((await getSource(src.id)).currentBalance).toBe("10.00");
    });

    it("returns 404 for an unknown source", async () => {
      expect((await adjust("00000000-0000-0000-0000-000000000000", 5)).status).toBe(404);
    });

    it("rejects a non-numeric amount without changing the balance", async () => {
      const src = await createPaymentSource(api, "10");
      const r = await adjust(src.id, "abc");
      expect(r.status).toBe(400);
      expect((await getSource(src.id)).currentBalance).toBe("10.00");
    });
  });

  describe("update and delete", () => {
    it("updates metadata without touching the balance", async () => {
      const src = await createPaymentSource(api, "300");
      const r = await api("PUT", `/api/payment-sources/${src.id}`, { name: "Renamed", accountType: "wallet" });
      expect(r.status).toBe(200);
      expect(r.body.name).toBe("Renamed");
      expect(r.body.currentBalance).toBe("300.00");
    });

    it("deletes a source together with its transactions", async () => {
      const src = await createPaymentSource(api, "50");
      expect((await api("DELETE", `/api/payment-sources/${src.id}`)).status).toBe(200);
      expect((await api("GET", `/api/payment-sources/${src.id}`)).status).toBe(404);
    });

    it("refuses to delete a source that has expenses", async () => {
      const src = await createPaymentSource(api, "500");
      const cat = await createCategory(api);
      await createExpense(api, cat.id, { paymentSourceId: src.id });
      const r = await api("DELETE", `/api/payment-sources/${src.id}`);
      expect(r.status).toBe(400);
      expect((await api("GET", `/api/payment-sources/${src.id}`)).status).toBe(200);
    });

    it("returns 404 when deleting an unknown source", async () => {
      expect((await api("DELETE", "/api/payment-sources/00000000-0000-0000-0000-000000000000")).status).toBe(404);
    });
  });

  describe("expenses by source", () => {
    it("lists only the expenses linked to the source", async () => {
      const a = await createPaymentSource(api, "500", "A");
      const b = await createPaymentSource(api, "500", "B");
      const cat = await createCategory(api);
      await createExpense(api, cat.id, { paymentSourceId: a.id, title: "for A" });
      await createExpense(api, cat.id, { paymentSourceId: b.id, title: "for B" });
      const list = (await api("GET", `/api/payment-sources/${a.id}/expenses`)).body;
      expect(list.map((e: any) => e.title)).toEqual(["for A"]);
    });
  });
});
