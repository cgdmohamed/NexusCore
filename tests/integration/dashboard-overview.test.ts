import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, createPaymentSource, startApp, TEST_DATABASE_URL } from "./helpers";
import { dayKey } from "../../server/task-insights";

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!TEST_DATABASE_URL)("dashboard overview (integration)", () => {
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

  const dueOn = (offsetDays: number) => new Date(`${dayKey(new Date(Date.now() + offsetDays * DAY), "Africa/Cairo")}T00:00:00Z`);

  it("reports what needs attention, how old the debt is, and money in against money out", async () => {
    const { invoices, payments, expenses, quotations, tasks, expenseCategories } = await import("../../shared/schema");
    const client = await createClient(api, "Debtor");
    const me = ctx.currentUserId;

    const mk = (o: object) => ({ clientId: client.id, title: "t", amount: "1000", paidAmount: "0", status: "sent", createdBy: me, ...o }) as any;
    const [late10, late70] = await ctx.db.insert(invoices).values([
      mk({ invoiceNumber: "OV-1", dueDate: dueOn(-10) }),
      mk({ invoiceNumber: "OV-2", amount: "500", paidAmount: "200", status: "partially_paid", dueDate: dueOn(-70) }),
    ]).returning();
    await ctx.db.insert(invoices).values([
      mk({ invoiceNumber: "OV-3", dueDate: dueOn(15) }),
      mk({ invoiceNumber: "OV-4", status: "draft", dueDate: dueOn(-40) }),
    ]);

    // money in this month: a payment and a smaller refund; money out: one paid expense
    await ctx.db.insert(payments).values([
      { invoiceId: late10.id, amount: "700.00", paymentDate: new Date(), paymentMethod: "cash" },
      { invoiceId: late10.id, amount: "-100.00", paymentDate: new Date(), paymentMethod: "cash", isRefund: true },
      { invoiceId: late10.id, amount: "999.00", paymentDate: new Date(), paymentMethod: "credit_balance" },
    ] as any);
    const [cat] = await ctx.db.insert(expenseCategories).values({ name: "Overview cat" } as any).returning();
    await ctx.db.insert(expenses).values([
      { title: "paid", amount: "250.00", categoryId: cat.id, type: "variable", expenseDate: new Date(), status: "paid", paidDate: new Date(), paymentMethod: "cash", createdBy: me },
      { title: "waiting", amount: "80.00", categoryId: cat.id, type: "variable", expenseDate: new Date(), status: "pending", paymentMethod: "cash", createdBy: me },
    ] as any);
    await ctx.db.insert(quotations).values({ clientId: client.id, title: "soon", status: "sent", amount: "1", validUntil: dueOn(3), quotationNumber: "QO-OVW-1", createdBy: me } as any);
    await ctx.db.insert(tasks).values({ title: "late", status: "pending", assignedTo: me, createdBy: me, dueDate: dueOn(-2) } as any);

    const r = await api("GET", "/api/dashboard/overview");
    expect(r.status).toBe(200);

    const att = Object.fromEntries(r.body.attention.map((a: any) => [a.key, a]));
    expect(att.overdue_invoices).toMatchObject({ count: 2, amount: 1300 });
    expect(att.expiring_quotations.count).toBe(1);
    expect(att.overdue_tasks.count).toBe(1);
    expect(att.pending_expenses).toMatchObject({ count: 1, amount: 80 });
    expect(att.unassigned_payments.count).toBeGreaterThanOrEqual(1);

    const { aging } = r.body;
    expect(aging.buckets.d1_30).toEqual({ count: 1, amount: 1000 });
    expect(aging.buckets.d61_90).toEqual({ count: 1, amount: 300 });
    expect(aging.buckets.notDue.amount).toBe(1000);
    expect(aging.topDebtors[0]).toMatchObject({ name: client.name, outstanding: 2300 });

    const thisMonth = r.body.cashflow.months.at(-1);
    expect(r.body.cashflow.months).toHaveLength(6);
    expect(thisMonth.collected).toBe(600); // 700 received − 100 refunded; credit applied is not money in
    expect(thisMonth.spent).toBe(250);
    expect(thisMonth.net).toBe(350);
    expect(r.body.cashflow.months[0].collected).toBe(0);
  });

  it("leaves out the sections the user may not see", async () => {
    ctx.actAs({ permissions: { tasks: { view: true } } });
    try {
      const r = await api("GET", "/api/dashboard/overview");
      expect(r.status).toBe(200);
      expect(r.body.aging).toBeUndefined();
      expect(r.body.cashflow).toBeUndefined();
      expect(r.body.attention.every((a: any) => a.key === "overdue_tasks")).toBe(true);
    } finally {
      ctx.actAs(null);
    }
  });
});
