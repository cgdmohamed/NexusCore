import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCategory, createClient, createExpense, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("expense statistics & filters (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
  const list = async (qs = "") => (await api("GET", `/api/expenses${qs}`)).body as any[];
  const titles = (rows: any[]) => rows.map((r) => r.title).sort();

  let food: any, rent: any, travel: any, client: any;

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
    food = await createCategory(api, "Food");
    rent = await createCategory(api, "Rent");
    travel = await createCategory(api, "Travel");
    client = await createClient(api, "Reporting");

    // title, category, amount, status, days ago, extra
    await createExpense(api, food.id, { title: "Lunch", amount: "100.00", status: "paid", expenseDate: daysAgo(2) });
    await createExpense(api, food.id, { title: "Groceries", amount: "50.50", status: "pending", expenseDate: daysAgo(20), description: "Weekly shopping" });
    await createExpense(api, rent.id, { title: "Office rent", amount: "300.00", status: "overdue", expenseDate: daysAgo(60) });
    await createExpense(api, rent.id, { title: "Old rent", amount: "25.00", status: "pending", expenseDate: daysAgo(400) });
    await createExpense(api, travel.id, {
      title: "100% cotton uniforms",
      amount: "10.00",
      status: "pending",
      type: "variable",
      expenseDate: daysAgo(3),
      relatedClientId: client.id,
    });
  });
  afterAll(async () => {
    await ctx?.close();
  });

  describe("GET /api/expenses/stats", () => {
    const stats = async (period?: string) => (await api("GET", `/api/expenses/stats${period ? `?period=${period}` : ""}`)).body;

    it("week: only the last 7 days", async () => {
      const s = await stats("week");
      expect(s).toMatchObject({ totalExpenses: 2, totalAmount: 110, paidExpenses: 1, paidAmount: 100, pendingExpenses: 1, pendingAmount: 10, overdueExpenses: 0 });
    });

    it("month (default): last month, pending and paid split", async () => {
      const s = await stats();
      expect(s).toMatchObject({ totalExpenses: 3, totalAmount: 160.5, paidAmount: 100, pendingExpenses: 2, pendingAmount: 60.5 });
      expect(await stats("month")).toEqual(s);
    });

    it("quarter: includes the overdue expense from 60 days ago", async () => {
      const s = await stats("quarter");
      expect(s).toMatchObject({ totalExpenses: 4, totalAmount: 460.5, overdueExpenses: 1 });
    });

    it("year: excludes the expense from 400 days ago", async () => {
      const s = await stats("year");
      expect(s.totalExpenses).toBe(4);
      expect(s.totalAmount).toBe(460.5);
    });

    it("breaks totals down by category with exact amounts", async () => {
      const s = await stats("quarter");
      const byName = Object.fromEntries(s.categoryBreakdown.map((c: any) => [c.name, c]));
      expect(byName.Food).toMatchObject({ amount: 150.5, count: 2 });
      expect(byName.Rent).toMatchObject({ amount: 300, count: 1 });
      expect(byName.Travel).toMatchObject({ amount: 10, count: 1 });
      expect(byName.Food.color).toBeTruthy();
    });

    it("rejects an unknown period instead of silently returning zeros", async () => {
      expect((await api("GET", "/api/expenses/stats?period=decade")).status).toBe(400);
    });
  });

  describe("GET /api/expenses filters", () => {
    it("returns everything, newest first, with the category attached", async () => {
      const rows = await list();
      expect(rows).toHaveLength(5);
      expect(rows[0].title).toBe("100% cotton uniforms"); // created last
      expect(rows.find((r) => r.title === "Lunch").category.name).toBe("Food");
    });

    it("filters by status", async () => {
      expect(titles(await list("?status=pending"))).toEqual(["100% cotton uniforms", "Groceries", "Old rent"]);
      expect(titles(await list("?status=overdue"))).toEqual(["Office rent"]);
    });

    it("filters by type and category", async () => {
      expect(titles(await list("?type=variable"))).toEqual(["100% cotton uniforms"]);
      expect(titles(await list(`?categoryId=${rent.id}`))).toEqual(["Office rent", "Old rent"]);
    });

    it("filters by related client", async () => {
      expect(titles(await list(`?clientId=${client.id}`))).toEqual(["100% cotton uniforms"]);
    });

    it("filters by date range (inclusive bounds)", async () => {
      const start = encodeURIComponent(daysAgo(25));
      const end = encodeURIComponent(daysAgo(1));
      expect(titles(await list(`?startDate=${start}&endDate=${end}`))).toEqual(["100% cotton uniforms", "Groceries", "Lunch"]);
      expect(titles(await list(`?startDate=${encodeURIComponent(daysAgo(25))}`))).toEqual(["100% cotton uniforms", "Groceries", "Lunch"]);
      expect(titles(await list(`?endDate=${encodeURIComponent(daysAgo(100))}`))).toEqual(["Old rent"]);
    });

    it("searches title and description, case-insensitively", async () => {
      expect(titles(await list("?search=LUNCH"))).toEqual(["Lunch"]);
      expect(titles(await list("?search=shopping"))).toEqual(["Groceries"]);
    });

    it("treats % and _ in the search text literally", async () => {
      expect(titles(await list(`?search=${encodeURIComponent("%")}`))).toEqual(["100% cotton uniforms"]);
      expect(await list(`?search=${encodeURIComponent("_")}`)).toHaveLength(0);
    });

    it("combines filters with AND", async () => {
      expect(titles(await list(`?categoryId=${food.id}&status=paid`))).toEqual(["Lunch"]);
      expect(await list(`?categoryId=${travel.id}&status=paid`)).toHaveLength(0);
    });

    it("accepts a repeated parameter as a list of values", async () => {
      const r = await api("GET", "/api/expenses?status=paid&status=overdue");
      expect(r.status).toBe(200);
      expect(titles(r.body)).toEqual(["Lunch", "Office rent"]);
    });

    it("rejects an invalid date with a client error, not a 500", async () => {
      expect((await api("GET", "/api/expenses?startDate=not-a-date")).status).toBe(400);
      expect((await api("GET", "/api/expenses?endDate=not-a-date")).status).toBe(400);
    });

    it("returns an empty list when nothing matches", async () => {
      expect(await list("?status=cancelled")).toEqual([]);
    });
  });
});
