import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCategory, createExpense, createPaymentSource, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("expenses (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const getExpense = async (id: string) => (await api("GET", `/api/expenses/${id}`)).body;
  const balanceOf = async (id: string) => (await api("GET", `/api/payment-sources/${id}`)).body.currentBalance;
  const pay = (id: string, extra: object = {}) =>
    api("POST", `/api/expenses/${id}/pay`, { paymentMethod: "bank_transfer", paymentReference: "REF-1", ...extra });
  let categoryId: string;

  beforeAll(async () => {
    
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
    categoryId = (await createCategory(api, "General")).id;
  });
  afterAll(async () => {
    await ctx?.close();
  });

  describe("categories and creation", () => {
    it("lists active categories", async () => {
      const cat = await createCategory(api, "Zzz listed");
      const list = (await api("GET", "/api/expense-categories")).body;
      expect(list.some((c: any) => c.id === cat.id)).toBe(true);
    });

    it("creates a pending expense that does not move any balance", async () => {
      const src = await createPaymentSource(api, "1000");
      const e = await createExpense(api, categoryId, { paymentSourceId: src.id });
      expect(e.status).toBe("pending");
      expect(await balanceOf(src.id)).toBe("1000.00");
    });

    it("an expense created as paid deducts from its payment source and logs a transaction", async () => {
      const src = await createPaymentSource(api, "1000");
      const e = await createExpense(api, categoryId, { paymentSourceId: src.id, status: "paid", amount: "250.75" });
      expect(await balanceOf(src.id)).toBe("749.25");
      const tx = (await api("GET", `/api/payment-sources/${src.id}/transactions`)).body;
      const row = tx.find((t: any) => t.referenceId === e.id);
      expect(row).toMatchObject({ type: "expense", amount: "250.75", balanceBefore: "1000.00", balanceAfter: "749.25" });
    });

    it("returns 404 for an unknown expense", async () => {
      expect((await api("GET", "/api/expenses/00000000-0000-0000-0000-000000000000")).status).toBe(404);
    });
  });

  describe("paying", () => {
    it("marks the expense paid, records a payment and deducts the source once", async () => {
      const src = await createPaymentSource(api, "1000");
      const e = await createExpense(api, categoryId, { paymentSourceId: src.id, amount: "200.00" });

      const r = await pay(e.id);
      expect(r.status).toBe(200);
      expect(r.body.expense.status).toBe("paid");
      expect(r.body.payment.amount).toBe("200.00");
      expect(await balanceOf(src.id)).toBe("800.00");

      const payments = (await api("GET", `/api/expenses/${e.id}/payments`)).body;
      expect(payments).toHaveLength(1);
    });

    it("works for an expense without a payment source", async () => {
      const e = await createExpense(api, categoryId);
      expect((await pay(e.id)).status).toBe(200);
      expect((await getExpense(e.id)).status).toBe("paid");
    });

    it("does not charge the payment source twice when paid twice", async () => {
      const src = await createPaymentSource(api, "1000");
      const e = await createExpense(api, categoryId, { paymentSourceId: src.id, amount: "200.00" });
      expect((await pay(e.id)).status).toBe(200);
      const second = await pay(e.id);
      expect(second.status).toBe(409);
      expect(await balanceOf(src.id)).toBe("800.00");
      expect((await api("GET", `/api/expenses/${e.id}/payments`)).body).toHaveLength(1);
    });

    it("does not pay a rejected expense", async () => {
      const src = await createPaymentSource(api, "1000");
      const e = await createExpense(api, categoryId, { paymentSourceId: src.id });
      expect((await api("POST", `/api/expenses/${e.id}/reject`, { rejectionReason: "No budget" })).status).toBe(200);
      expect((await pay(e.id)).status).toBe(409);
      expect(await balanceOf(src.id)).toBe("1000.00");
    });

    it("returns 404 when paying an unknown expense", async () => {
      expect((await pay("00000000-0000-0000-0000-000000000000")).status).toBe(404);
    });

    it("a recurring expense goes back to pending with the next due date after payment", async () => {
      const due = new Date("2026-01-31T00:00:00Z");
      const e = await createExpense(api, categoryId, {
        isRecurring: true,
        frequency: "monthly",
        dueDate: due.toISOString(),
      });
      const r = await pay(e.id);
      expect(r.status).toBe(200);
      const cur = await getExpense(e.id);
      expect(cur.status).toBe("pending");
      expect(new Date(cur.nextDueDate).getTime()).toBeGreaterThan(due.getTime());
      expect((await api("GET", `/api/expenses/${e.id}/payments`)).body).toHaveLength(1);
    });
  });

  describe("rejecting", () => {
    it("requires a reason", async () => {
      const e = await createExpense(api, categoryId);
      expect((await api("POST", `/api/expenses/${e.id}/reject`, {})).status).toBe(400);
      expect((await api("POST", `/api/expenses/${e.id}/reject`, { rejectionReason: "   " })).status).toBe(400);
      expect((await getExpense(e.id)).status).toBe("pending");
    });

    it("rejects a pending expense and stores reason, actor and time", async () => {
      const e = await createExpense(api, categoryId);
      const r = await api("POST", `/api/expenses/${e.id}/reject`, { rejectionReason: "Duplicate" });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ status: "rejected", rejectionReason: "Duplicate" });
      expect(r.body.rejectedBy).toBeTruthy();
      expect(r.body.rejectedAt).toBeTruthy();
    });

    it("cannot reject a paid or already rejected expense", async () => {
      const paid = await createExpense(api, categoryId);
      await pay(paid.id);
      expect((await api("POST", `/api/expenses/${paid.id}/reject`, { rejectionReason: "x" })).status).toBe(400);

      const rejected = await createExpense(api, categoryId);
      await api("POST", `/api/expenses/${rejected.id}/reject`, { rejectionReason: "x" });
      expect((await api("POST", `/api/expenses/${rejected.id}/reject`, { rejectionReason: "y" })).status).toBe(400);
    });
  });

  describe("update and delete", () => {
    it("updates editable fields", async () => {
      const e = await createExpense(api, categoryId);
      const r = await api("PUT", `/api/expenses/${e.id}`, { title: "Renamed", notes: "n" });
      expect(r.status).toBe(200);
      expect(r.body.title).toBe("Renamed");
    });

    it("returns 404 when updating an unknown expense", async () => {
      expect((await api("PUT", "/api/expenses/00000000-0000-0000-0000-000000000000", { title: "x" })).status).toBe(404);
    });

    it("does not let a plain update mark an expense paid (bypassing balance deduction)", async () => {
      const src = await createPaymentSource(api, "1000");
      const e = await createExpense(api, categoryId, { paymentSourceId: src.id });
      await api("PUT", `/api/expenses/${e.id}`, { status: "paid" });
      const cur = await getExpense(e.id);
      // either the status change is refused, or the balance is charged consistently
      if (cur.status === "paid") expect(await balanceOf(src.id)).toBe("800.00");
      else expect(await balanceOf(src.id)).toBe("1000.00");
    });

    it("deletes an expense together with its payments", async () => {
      const e = await createExpense(api, categoryId);
      await pay(e.id);
      expect((await api("DELETE", `/api/expenses/${e.id}`)).status).toBe(200);
      expect((await api("GET", `/api/expenses/${e.id}`)).status).toBe(404);
      expect((await api("GET", `/api/expenses/${e.id}/payments`)).body).toHaveLength(0);
    });

    it("returns 404 when deleting an unknown expense", async () => {
      expect((await api("DELETE", "/api/expenses/00000000-0000-0000-0000-000000000000")).status).toBe(404);
    });
  });
});
