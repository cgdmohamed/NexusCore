import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, startApp, TEST_DATABASE_URL } from "./helpers";
import { dayKey } from "../../server/task-insights";

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!TEST_DATABASE_URL)("reports and KPIs (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const monthKeyAgo = (days: number) => dayKey(new Date(Date.now() - days * DAY), "Africa/Cairo").slice(0, 7);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  it("trends: twelve connected months, zeros for empty ones, numbers not strings, newest included", async () => {
    const { invoices, payments, expenses, expenseCategories } = await import("../../shared/schema");
    const client = await createClient(api, "Trend client");
    const me = ctx.currentUserId;
    const [inv] = await ctx.db.insert(invoices).values({ clientId: client.id, title: "t", amount: "9000", paidAmount: "0", status: "sent", invoiceNumber: "TR-1", createdBy: me } as any).returning();
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY);
    await ctx.db.insert(payments).values([
      { invoiceId: inv.id, amount: "1200.50", paymentDate: at(150), paymentMethod: "cash" },
      { invoiceId: inv.id, amount: "800.00", paymentDate: at(60), paymentMethod: "cash" },
      { invoiceId: inv.id, amount: "-100.00", paymentDate: at(60), paymentMethod: "cash", isRefund: true },
      { invoiceId: inv.id, amount: "5000.00", paymentDate: at(60), paymentMethod: "credit_balance" },
    ] as any);
    const [cat] = await ctx.db.insert(expenseCategories).values({ name: "Trend cat" } as any).returning();
    await ctx.db.insert(expenses).values([
      { title: "old", amount: "300.00", categoryId: cat.id, type: "variable", expenseDate: at(60), status: "paid", paidDate: at(60), paymentMethod: "cash", createdBy: me },
      { title: "unpaid", amount: "999.00", categoryId: cat.id, type: "variable", expenseDate: at(60), status: "pending", paymentMethod: "cash", createdBy: me },
    ] as any);

    const r = await api("GET", "/api/analytics/trends?months=12&period=month");
    expect(r.status).toBe(200);
    expect(r.body.points).toHaveLength(12);
    expect(r.body.points.at(-1).period).toBe(monthKeyAgo(0));
    for (const p of r.body.points) {
      expect(typeof p.collected).toBe("number");
      expect(typeof p.spent).toBe("number");
    }
    const m150 = r.body.points.find((p: any) => p.period === monthKeyAgo(150));
    const m60 = r.body.points.find((p: any) => p.period === monthKeyAgo(60));
    expect(m150.collected).toBe(1200.5);
    expect(m60).toMatchObject({ collected: 700, spent: 300, net: 400 }); // refund counted, credit applied and unpaid expense not
    expect(r.body.points.filter((p: any) => p.collected === 0 && p.spent === 0).length).toBeGreaterThan(0);

    const q = await api("GET", "/api/analytics/trends?months=6&period=quarter");
    expect(q.body.granularity).toBe("quarter");
    expect(q.body.points.every((p: any) => /^\d{4}-Q[1-4]$/.test(p.period))).toBe(true);
  });

  it("kpis, comparison and the dashboard agree on revenue and expenses", async () => {
    const dash = await api("GET", "/api/dashboard/overview");
    const kpis = await api("GET", "/api/analytics/kpis");
    expect(kpis.status).toBe(200);
    expect(typeof kpis.body.totalRevenue).toBe("number");
    expect(kpis.body.netProfit).toBeCloseTo(kpis.body.totalRevenue - kpis.body.totalExpenses, 2);
    const thisMonth = dash.body.cashflow.months.at(-1);
    const ranged = await api("GET", `/api/analytics/kpis?startDate=${encodeURIComponent(new Date(Date.now() - 40 * DAY).toISOString())}&endDate=${encodeURIComponent(new Date(Date.now() + DAY).toISOString())}`);
    expect(ranged.body.totalRevenue).toBeGreaterThanOrEqual(thisMonth.collected - 1e-6);

    const p = (d: number) => new Date(Date.now() + d * DAY).toISOString();
    const cmp = await api("GET", `/api/analytics/comparison?period1Start=${encodeURIComponent(p(-30))}&period1End=${encodeURIComponent(p(1))}&period2Start=${encodeURIComponent(p(-61))}&period2End=${encodeURIComponent(p(-30))}`);
    expect(cmp.status).toBe(200);
    expect(typeof cmp.body.period1.revenue).toBe("number");
    expect(cmp.body.changes.revenue).toHaveProperty("percentage");
  });

  it("expenses by category are real categories and respect the dates", async () => {
    const all = await api("GET", "/api/analytics/financial-reports?type=expenses");
    expect(all.status).toBe(200);
    const names = all.body.expensesByCategory.map((c: any) => c.category);
    expect(names).toContain("Trend cat");
    expect(names).not.toContain("General");
    const none = await api("GET", `/api/analytics/financial-reports?type=expenses&startDate=${encodeURIComponent("2001-01-01T00:00:00Z")}&endDate=${encodeURIComponent("2001-02-01T00:00:00Z")}`);
    expect(none.body.expensesByCategory).toEqual([]);
    const pl = await api("GET", "/api/analytics/financial-reports");
    expect(pl.status).toBe(200);
    expect(pl.body.summary.netProfit).toBeCloseTo(pl.body.summary.totalRevenue - pl.body.summary.totalExpenses, 2);
  });

  it("outstanding counts the remaining balance on every issued status, not the invoice total", async () => {
    const { invoices } = await import("../../shared/schema");
    const client = await createClient(api, "Outstanding client");
    const me = ctx.currentUserId;
    const due = (d: number) => new Date(`${dayKey(new Date(Date.now() + d * DAY), "Africa/Cairo")}T00:00:00Z`);
    await ctx.db.insert(invoices).values([
      { clientId: client.id, title: "a", amount: "1000", paidAmount: "400", status: "partially_paid", invoiceNumber: "OS-1", dueDate: due(-20), createdBy: me },
      { clientId: client.id, title: "b", amount: "500", paidAmount: "0", status: "sent", invoiceNumber: "OS-2", dueDate: due(10), createdBy: me },
      { clientId: client.id, title: "c", amount: "700", paidAmount: "0", status: "draft", invoiceNumber: "OS-3", dueDate: due(-5), createdBy: me },
      { clientId: client.id, title: "d", amount: "300", paidAmount: "300", status: "paid", invoiceNumber: "OS-4", dueDate: due(-5), createdBy: me },
    ] as any);
    const r = await api("GET", "/api/analytics/outstanding");
    expect(r.status).toBe(200);
    const mine = r.body.overdueInvoices.filter((o: any) => o.clientName === client.name);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ amount: 600, invoiceNumber: "OS-1" });
    expect(mine[0].daysPastDue).toBeGreaterThanOrEqual(19);
    const debtor = r.body.topDebtors.find((d: any) => d.name === client.name);
    if (debtor) expect(debtor.outstanding).toBe(1100);
    expect(r.body.outstandingTotal).toBeGreaterThanOrEqual(1100);
  });
});
