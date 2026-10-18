import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";
import { dayKey } from "../../server/task-insights";

describe.skipIf(!TEST_DATABASE_URL)("MCP expense tools (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  let token = "";
  let roleId = "";
  let serviceUserId = "";
  let nextId = 1;
  let notified: any[][] = [];
  const ids: Record<string, string> = {};

  const grant = async (perms: Record<string, boolean>) => {
    const { roles } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const full = { view: true, add: true, edit: false, delete: false, approve: false };
    const none = { view: false, add: false, edit: false, delete: false, approve: false };
    const p: Record<string, unknown> = { tasks: full, projects: full, crm: full, expenses: none };
    for (const [k, v] of Object.entries(perms)) p[k] = v ? full : none;
    await ctx.db.update(roles).set({ permissions: p } as any).where(eq(roles.id, roleId));
  };

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
    const created = await ctx.api("POST", "/api/settings/ai-access/tokens", { name: "expenses" });
    token = created.body.token;
    roleId = created.body.roleId;
    const { users, expenseCategories, projects, clients, paymentSources } = await import("../../shared/schema");
    [{ id: serviceUserId }] = (await ctx.db.select().from(users)).filter((u: any) => u.username === "ai-assistant");
    const [rent, travel] = await ctx.db.insert(expenseCategories).values([{ name: "Office Rent" }, { name: "Travel & Transport" }, { name: "Retired", isActive: false }] as any).returning();
    ids.rent = rent.id; ids.travel = travel.id;
    const [p] = await ctx.db.insert(projects).values({ name: "rosegold", status: "active" } as any).returning();
    ids.project = p.id;
    const [old] = await ctx.db.insert(clients).values({ name: "Old Client", status: "archived" } as any).returning();
    ids.archived = old.id;
    const [src] = await ctx.db.insert(paymentSources).values({ name: "Cash box", type: "cash", initialBalance: "1000", currentBalance: "1000" } as any).returning();
    ids.source = src.id;
    const { notificationService } = await import("../../server/notification-service");
    vi.spyOn(notificationService, "notifyExpenseSubmitted").mockImplementation(async (...args: any[]) => { notified.push(args); });
    await grant({ expenses: true });
  });
  afterAll(async () => { await ctx?.close(); });

  const rpc = async (method: string, params?: unknown) => {
    const res = await fetch(`${ctx.base}/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }) });
    return res.json();
  };
  const call = async (name: string, args: unknown = {}) => {
    const r = await rpc("tools/call", { name, arguments: args });
    const text = r.result.content[0].text as string;
    return { isError: !!r.result.isError, text, data: r.result.isError ? null : JSON.parse(text) };
  };
  const today = () => dayKey(new Date(), "Africa/Cairo");

  it("records an expense as pending, with the category found by a differently spelled name, and moves no money", async () => {
    notified = [];
    const r = await call("create_expense", { title: "October rent", amount: 5000, categoryName: "office-rent", paymentMethod: "bank_transfer", paymentReference: "TR-77", projectName: "rose gold" });
    expect(r.isError, r.text).toBe(false);
    expect(r.data).toMatchObject({ title: "October rent", amount: 5000, category: "Office Rent", status: "pending", paymentMethod: "bank_transfer", project: "rosegold", expenseDate: today() });
    expect(r.data.path).toBe(`/expenses/${r.data.id}`);

    const { expenses, paymentSources, expensePayments } = await import("../../shared/schema");
    const [row] = (await ctx.db.select().from(expenses)).filter((e: any) => e.id === r.data.id);
    expect(row).toMatchObject({ status: "pending", categoryId: ids.rent, type: "variable", isRecurring: false, relatedProjectId: ids.project, createdBy: serviceUserId, paymentSourceId: null, paidDate: null });
    expect(Number(row.amount)).toBe(5000);
    expect(row.paymentReference).toBe("TR-77");
    const [src] = (await ctx.db.select().from(paymentSources)).filter((s: any) => s.id === ids.source);
    expect(Number(src.currentBalance)).toBe(1000); // nothing was paid
    expect((await ctx.db.select().from(expensePayments)).length).toBe(0);
    expect(notified).toHaveLength(1); // the approvers are told, as for an expense entered in the app
    expect(notified[0].slice(0, 2)).toEqual([r.data.id, serviceUserId]);
  });

  it("shows up in the app's own list and can then be paid there", async () => {
    const created = await call("create_expense", { title: "Taxi", amount: 85.5, categoryId: ids.travel, expenseDate: "2026-10-10" });
    const page = (await ctx.api("GET", "/api/expenses")).body;
    const list = Array.isArray(page) ? page : page.expenses ?? page.items ?? [];
    expect(list.some((e: any) => e.id === created.data.id && e.status === "pending")).toBe(true);
    const paid = await ctx.api("POST", `/api/expenses/${created.data.id}/pay`, { paymentSourceId: ids.source, paymentMethod: "cash" });
    expect(paid.status).toBeLessThan(300);
  });

  it("refuses a category that is not there with a 'did you mean', and never guesses", async () => {
    const { expenses } = await import("../../shared/schema");
    const before = (await ctx.db.select().from(expenses)).length;
    const close = await call("create_expense", { title: "x", amount: 10, categoryName: "Ofice Rent" });
    expect(close.isError).toBe(true);
    expect(close.text).toMatch(/Did you mean: Office Rent/);
    const none = await call("create_expense", { title: "x", amount: 10, categoryName: "Entertainment" });
    expect(none.text).toMatch(/Available: .*Office Rent.*Travel/);
    expect((await call("create_expense", { title: "x", amount: 10 })).text).toMatch(/categoryId or categoryName/);
    expect((await call("create_expense", { title: "x", amount: 10, categoryName: "Retired" })).isError).toBe(true); // inactive categories are not offered
    expect((await ctx.db.select().from(expenses)).length).toBe(before);
  });

  it("rejects bad amounts, bad dates and archived clients without leaving anything behind", async () => {
    const { expenses } = await import("../../shared/schema");
    const before = (await ctx.db.select().from(expenses)).length;
    for (const amount of [0, -5, 1e12]) expect((await call("create_expense", { title: "bad", amount, categoryId: ids.rent })).isError, String(amount)).toBe(true);
    expect((await call("create_expense", { title: "bad", amount: 5, categoryId: ids.rent, expenseDate: "10/10/2026" })).isError).toBe(true);
    expect((await call("create_expense", { title: "bad", amount: 5, categoryId: ids.rent, clientId: ids.archived })).text).toMatch(/archived/);
    expect((await call("create_expense", { title: "bad", amount: 5, categoryId: ids.rent, paymentMethod: "bitcoin" })).isError).toBe(true);
    expect((await ctx.db.select().from(expenses)).length).toBe(before);
  });

  it("does not record the same expense twice on a retry, unless told it is a different one", async () => {
    const args = { title: "Courier", amount: 120, categoryId: ids.travel, expenseDate: "2026-10-12" };
    const first = await call("create_expense", args);
    expect(first.isError).toBe(false);
    const again = await call("create_expense", args);
    expect(again.isError).toBe(true);
    expect(again.text).toContain(first.data.id);
    expect((await call("create_expense", { ...args, allowDuplicate: true })).isError).toBe(false);
  });

  it("lists expenses with the total across every page, filters, and a spelling-tolerant category", async () => {
    const { expenses, expensePayments, paymentSourceTransactions } = await import("../../shared/schema");
    await ctx.db.delete(paymentSourceTransactions);
    await ctx.db.delete(expensePayments);
    await ctx.db.delete(expenses);
    for (const [title, amount, date, cat] of [["A", 100, "2026-09-30", ids.rent], ["B", 200, "2026-10-05", ids.rent], ["C", 300, "2026-10-20", ids.travel], ["D", 50, "2026-10-21", ids.travel]] as const) {
      expect((await call("create_expense", { title, amount, expenseDate: date, categoryId: cat, allowDuplicate: true })).isError).toBe(false);
    }
    const all = (await call("list_expenses", { limit: 2 })).data;
    expect(all).toMatchObject({ total: 4, returned: 2, hasMore: true, totalAmount: 650 });
    expect(all.items.map((i: any) => i.title)).toEqual(["D", "C"]); // newest first
    const october = (await call("list_expenses", { from: "2026-10-01", to: "2026-10-21" })).data;
    expect(october).toMatchObject({ total: 3, totalAmount: 550 });
    expect((await call("list_expenses", { categoryName: "travel and transport" })).isError).toBe(true); // "and" is not "&": offered back, not guessed
    expect((await call("list_expenses", { categoryName: "travel-transport" })).data.total).toBe(2);
    expect((await call("list_expenses", { search: "b" })).data.items.map((i: any) => i.title)).toContain("B");
    expect((await call("list_expense_categories")).data.map((c: any) => c.name)).toEqual(["Office Rent", "Travel & Transport"]);
  });

  it("is hidden from a role without the expenses permission, and writing needs 'add'", async () => {
    await grant({ expenses: false });
    const names = (await rpc("tools/list")).result.tools.map((t: any) => t.name);
    for (const n of ["create_expense", "list_expenses", "list_expense_categories"]) expect(names).not.toContain(n);
    expect((await call("create_expense", { title: "x", amount: 1, categoryId: ids.rent })).text).toMatch(/Permission denied/);

    const { roles } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    await ctx.db.update(roles).set({ permissions: { tasks: { view: true }, projects: { view: true }, expenses: { view: true, add: false } } } as any).where(eq(roles.id, roleId));
    const viewOnly = (await rpc("tools/list")).result.tools.map((t: any) => t.name);
    expect(viewOnly).toContain("list_expenses");
    expect(viewOnly).not.toContain("create_expense");
    expect(((await rpc("tools/list")).result.tools.find((t: any) => t.name === "list_expenses")).annotations.readOnlyHint).toBe(true);
    await grant({ expenses: true });
  });
});
