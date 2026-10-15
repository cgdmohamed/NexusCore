import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";

describe.skipIf(!TEST_DATABASE_URL)("MCP clients, quotations and invoices (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  let token = "";
  let roleId = "";
  let nextId = 1;

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
    const created = await ctx.api("POST", "/api/settings/ai-access/tokens", { name: "finance" });
    token = created.body.token;
    roleId = created.body.roleId;
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
  const grant = async (modules: string[]) => {
    const { roles } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const none = { view: false, add: false, edit: false, delete: false, approve: false };
    const all = { view: true, add: true, edit: false, delete: false, approve: false };
    const perms: Record<string, unknown> = { tasks: all, projects: all };
    for (const m of ["crm", "quotations", "invoices"]) perms[m] = modules.includes(m) ? all : none;
    await ctx.db.update(roles).set({ permissions: perms } as any).where(eq(roles.id, roleId));
  };
  const toolNames = async () => (await rpc("tools/list")).result.tools.map((t: any) => t.name) as string[];

  it("shows the finance tools only to a role that has the permissions", async () => {
    await grant([]);
    expect(await toolNames()).not.toContain("create_invoice");
    expect((await call("create_invoice", {})).text).toMatch(/Permission denied/);
    await grant(["crm"]);
    const names = await toolNames();
    expect(names).toContain("create_client");
    expect(names).not.toContain("create_invoice");
    await grant(["crm", "quotations", "invoices"]);
    expect(await toolNames()).toEqual(expect.arrayContaining(["list_clients", "create_client", "create_quotation", "get_quotation", "create_invoice", "get_invoice", "list_invoices"]));
  });

  it("creates a client once, and refuses a duplicate name", async () => {
    const a = await call("create_client", { name: "Acme Trading", email: "info@acme.test", phone: "0100" });
    expect(a.data.name).toBe("Acme Trading");
    expect((await call("create_client", { name: "acme trading" })).text).toMatch(/already exists/);
    expect((await call("create_client", { name: "Acme Trading", allowDuplicate: true })).isError).toBe(false);
    expect((await call("list_clients", { search: "acme" })).data.items.length).toBe(2);
  });

  it("creates a draft quotation with discounted lines and reads it back", async () => {
    await call("create_client", { name: "Globex" });
    const q = await call("create_quotation", {
      clientName: "Globex", title: "Website", validUntil: "2026-12-31",
      items: [{ description: "Design", quantity: 2, unitPrice: 1000 }, { description: "Hosting", quantity: 1, unitPrice: 500, discountPercent: 10 }],
    });
    expect(q.isError).toBe(false);
    expect(q.data.status).toBe("draft");
    expect(q.data.number).toMatch(/^QUO-\d{4}-\d{4}$/);
    expect(q.data.total).toBe(2450);
    expect(q.data.subtotal).toBe(2500);
    const got = (await call("get_quotation", { number: q.data.number })).data;
    expect(got.items).toHaveLength(2);
    expect(got.amount).toBe(2450);
    expect(got.client).toBe("Globex");
    // The app reads the same record
    const viaApi = (await ctx.api("GET", `/api/quotations/${q.data.id}`)).body;
    expect(Number(viaApi.amount)).toBe(2450);
    expect((await call("list_quotations", { clientName: "Globex" })).data.items[0].number).toBe(q.data.number);
  });

  it("creates a draft invoice whose totals match the app's recalculation", async () => {
    const inv = await call("create_invoice", {
      clientName: "Globex", title: "Retainer", taxRate: 14, discountRate: 10,
      items: [{ name: "Consulting", quantity: 10, unitPrice: 150 }, { name: "Setup", quantity: 1, unitPrice: 500.5 }],
    });
    expect(inv.isError).toBe(false);
    expect(inv.data.status).toBe("draft");
    const before = (await call("get_invoice", { invoiceId: inv.data.id })).data;
    const re = (await ctx.api("POST", `/api/invoices/${inv.data.id}/recalculate`)).body.invoice;
    expect(Number(re.amount)).toBe(before.amount);
    expect(Number(re.subtotal)).toBe(before.subtotal);
    expect(Number(re.taxAmount)).toBe(before.taxAmount);
    expect(Number(re.discountAmount)).toBe(before.discountAmount);
    expect(re.status).toBe("draft");
    const list = (await call("list_invoices", { clientName: "Globex", status: "draft" })).data.items;
    expect(list[0]).toMatchObject({ number: inv.data.number, remaining: before.amount });
  });

  it("refuses ambiguous, unknown and archived clients, and bad numbers, without leaving anything behind", async () => {
    await call("create_client", { name: "Initech North" });
    await call("create_client", { name: "Initech South" });
    const amb = await call("create_invoice", { clientName: "Initech", title: "x", items: [{ name: "a", quantity: 1, unitPrice: 1 }] });
    expect(amb.text).toMatch(/matches 2 clients/);
    expect((await call("create_invoice", { clientName: "Nobody Inc", title: "x", items: [{ name: "a", quantity: 1, unitPrice: 1 }] })).text).toMatch(/No client matches/);

    const { clients, invoices } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const [north] = await ctx.db.select().from(clients).where(eq(clients.name, "Initech North"));
    await ctx.db.update(clients).set({ status: "archived" }).where(eq(clients.id, north.id));
    expect((await call("create_quotation", { clientId: north.id, title: "x", items: [{ description: "a", quantity: 1, unitPrice: 1 }] })).text).toMatch(/archived/);

    const before = (await ctx.db.select().from(invoices)).length;
    expect((await call("create_invoice", { clientName: "Globex", title: "x", items: [{ name: "a", quantity: 0, unitPrice: 5 }] })).text).toMatch(/Invalid arguments/);
    expect((await call("create_invoice", { clientName: "Globex", title: "x", items: [{ name: "a", quantity: 1, unitPrice: -5 }] })).text).toMatch(/Invalid arguments/);
    expect((await call("create_invoice", { clientName: "Globex", title: "x", items: [{ name: "a", quantity: 1, unitPrice: 1e12 }] })).isError).toBe(true);
    expect((await call("create_invoice", { clientName: "Globex", title: "x", items: [] })).text).toMatch(/Invalid arguments/);
    expect((await ctx.db.select().from(invoices)).length).toBe(before);
  });

  it("finds clients across spacing and spelling, and totals what is owed across all matches", async () => {
    const { invoices, clients } = await import("../../shared/schema");
    const [c] = await ctx.db.insert(clients).values({ name: "Blue-Ocean Resort", status: "active" } as any).returning();
    const past = new Date(Date.now() - 5 * 86_400_000);
    const future = new Date(Date.now() + 5 * 86_400_000);
    await ctx.db.insert(invoices).values([
      { invoiceNumber: "INV-N-1", clientId: c.id, amount: "1000", paidAmount: "250", status: "partially_paid", dueDate: past },
      { invoiceNumber: "INV-N-2", clientId: c.id, amount: "400", paidAmount: "0", status: "sent", dueDate: past },
      { invoiceNumber: "INV-N-3", clientId: c.id, amount: "900", paidAmount: "0", status: "sent", dueDate: future },
      { invoiceNumber: "INV-N-4", clientId: c.id, amount: "300", paidAmount: "300", status: "paid", dueDate: past },
      { invoiceNumber: "INV-N-5", clientId: c.id, amount: "700", paidAmount: "0", status: "draft", dueDate: past },
    ] as any);
    expect((await call("list_clients", { search: "blue ocean" })).data.items.map((x: any) => x.name)).toEqual(["Blue-Ocean Resort"]);
    const late = (await call("list_invoices", { clientName: "blueocean resort", status: "overdue", limit: 1 })).data;
    expect(late).toMatchObject({ total: 2, returned: 1, hasMore: true, totalRemaining: 1150 }); // 750 + 400, across both pages
  });
});
