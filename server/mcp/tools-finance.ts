// MCP tools for clients, quotations and invoices. Everything created here is a draft; issuing, sending and collecting stay in the app.
import { z } from "zod";
import { and, desc, eq, ilike, or, sql, inArray, ne } from "drizzle-orm";
import { db } from "../db";
import { activities, clients, invoiceHistory, invoiceItems, invoices, quotationHistory, quotationItems, quotations } from "@shared/schema";
import { generateInvoiceNumber, generateQuotationNumber, lockNumbering } from "../routes/shared";
import { MAX_MONEY, parseMoney, parsePercent } from "../validation";
import type { ToolDefinition } from "./protocol";
import { ToolError } from "./errors";
import { nameSearchIds, pickByName } from "./names";
import { DEFAULT_PAGE, pageOf, pageProps } from "./paging";

export const MAX_ITEMS = 50;

const like = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const money = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

// ── Pure calculations (the same rules as the app: items route and /recalculate) ──

// A quotation line: quantity × unit price, less its own discount percentage
export function quotationItemTotal(quantity: number, unitPrice: number, discountPercent = 0): number {
  const subtotal = quantity * unitPrice;
  return round2(subtotal - (subtotal * discountPercent) / 100);
}

export interface InvoiceTotals { subtotal: number; taxAmount: number; discountAmount: number; amount: number }

// Same formula as POST /api/invoices/:id/recalculate: tax and discount are both taken on the subtotal
export function invoiceTotals(lineTotals: number[], taxRate = 0, discountRate = 0): InvoiceTotals {
  const subtotal = round2(lineTotals.reduce((s, n) => s + n, 0));
  const taxAmount = round2(subtotal * (taxRate / 100));
  const discountAmount = round2(subtotal * (discountRate / 100));
  return { subtotal, taxAmount, discountAmount, amount: round2(subtotal + taxAmount - discountAmount) };
}

// ── Definitions ──

const clientProps = {
  clientId: { type: "string", description: "client id (from list_clients)" },
  clientName: { type: "string", description: "client name, used when no id is given; must match exactly one" },
};
const dateProp = { type: "string", description: "YYYY-MM-DD" };

export const FINANCE_TOOLS: ToolDefinition[] = [
  {
    name: "list_clients", title: "List clients",
    description: "Search clients by name, email or phone; names match without regard to spaces, case or Arabic spelling variants. Archived clients are hidden unless includeArchived is true. Returns { total, hasMore, items }. Call this before create_client to avoid duplicates.",
    inputSchema: { type: "object", properties: { search: { type: "string" }, includeArchived: { type: "boolean" }, ...pageProps } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_client", title: "Create client",
    description: "Add a client. Refuses when a client with the same name already exists unless allowDuplicate is true.",
    inputSchema: {
      type: "object", required: ["name"],
      properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, city: { type: "string" }, country: { type: "string" }, allowDuplicate: { type: "boolean" } },
    },
  },
  {
    name: "list_quotations", title: "List quotations",
    description: "List quotations, newest first. Filter by client, status (draft, sent, accepted, rejected, expired, invoiced) or text over number and title. Amounts are in EGP. Returns { total, hasMore, items }.",
    inputSchema: { type: "object", properties: { ...clientProps, status: { type: "string" }, search: { type: "string" }, ...pageProps } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_quotation", title: "Get quotation",
    description: "Read one quotation with its line items, by id or by number (for example QUO-2026-0007).",
    inputSchema: { type: "object", properties: { quotationId: { type: "string" }, number: { type: "string" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_quotation", title: "Create quotation",
    description: `Create a DRAFT quotation with line items (at most ${MAX_ITEMS}). Totals are calculated by the server in EGP; each item may carry its own discountPercent. The quotation is not sent to the client.`,
    inputSchema: {
      type: "object", required: ["title", "items"],
      properties: {
        ...clientProps, title: { type: "string" }, description: { type: "string" }, validUntil: dateProp, notes: { type: "string" }, terms: { type: "string" },
        items: {
          type: "array", minItems: 1, maxItems: MAX_ITEMS,
          items: { type: "object", required: ["description", "quantity", "unitPrice"], properties: { description: { type: "string" }, quantity: { type: "number", exclusiveMinimum: 0 }, unitPrice: { type: "number", minimum: 0, description: "EGP" }, discountPercent: { type: "number", minimum: 0, maximum: 100 } } },
        },
      },
    },
  },
  {
    name: "list_invoices", title: "List invoices",
    description: "List invoices, newest first, with total, paid and remaining amounts in EGP. Filter by client, status (draft, sent, partially_paid, paid, overdue, cancelled) or text over number and title; status 'overdue' means issued, still owed and past its due date. Returns { total, hasMore, totalRemaining, items }: totalRemaining is what is still owed across every match, not only this page.",
    inputSchema: { type: "object", properties: { ...clientProps, status: { type: "string" }, search: { type: "string" }, ...pageProps } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_invoice", title: "Get invoice",
    description: "Read one invoice with its line items and balance, by id or by number (for example INV-2026-0012).",
    inputSchema: { type: "object", properties: { invoiceId: { type: "string" }, number: { type: "string" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_invoice", title: "Create invoice",
    description: `Create a DRAFT invoice with line items (at most ${MAX_ITEMS}). taxRate and discountRate are percentages of the subtotal. Totals are calculated by the server in EGP. The invoice is not issued; a person issues it in the app.`,
    inputSchema: {
      type: "object", required: ["title", "items"],
      properties: {
        ...clientProps, title: { type: "string" }, description: { type: "string" }, dueDate: { ...dateProp, description: "YYYY-MM-DD; defaults to 30 days from today" },
        notes: { type: "string" }, paymentTerms: { type: "string" },
        taxRate: { type: "number", minimum: 0, maximum: 100 }, discountRate: { type: "number", minimum: 0, maximum: 100 },
        items: {
          type: "array", minItems: 1, maxItems: MAX_ITEMS,
          items: { type: "object", required: ["name", "quantity", "unitPrice"], properties: { name: { type: "string" }, description: { type: "string" }, quantity: { type: "number", exclusiveMinimum: 0 }, unitPrice: { type: "number", minimum: 0, description: "EGP" } } },
        },
      },
    },
  },
];

export const FINANCE_NEEDS: Record<string, [string, string]> = {
  list_clients: ["crm", "view"], create_client: ["crm", "add"],
  list_quotations: ["quotations", "view"], get_quotation: ["quotations", "view"], create_quotation: ["quotations", "add"],
  list_invoices: ["invoices", "view"], get_invoice: ["invoices", "view"], create_invoice: ["invoices", "add"],
};

const opt = <T extends z.ZodTypeAny>(s: T) => s.optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");
const clientRef = { clientId: opt(z.string()), clientName: opt(z.string()) };
const limit = opt(z.number().int().min(1).max(100));
const offset = opt(z.number().int().min(0));
const qty = z.number().positive();
const price = z.number().min(0);

export const financeSchemas: Record<string, z.ZodTypeAny> = {
  list_clients: z.object({ search: opt(z.string()), includeArchived: opt(z.boolean()), limit, offset }),
  create_client: z.object({ name: z.string().trim().min(1), email: opt(z.string().trim().email()), phone: opt(z.string().trim()), city: opt(z.string().trim()), country: opt(z.string().trim()), allowDuplicate: opt(z.boolean()) }),
  list_quotations: z.object({ ...clientRef, status: opt(z.string()), search: opt(z.string()), limit, offset }),
  get_quotation: z.object({ quotationId: opt(z.string()), number: opt(z.string()) }),
  create_quotation: z.object({
    ...clientRef, title: z.string().trim().min(1), description: opt(z.string()), validUntil: opt(day), notes: opt(z.string()), terms: opt(z.string()),
    items: z.array(z.object({ description: z.string().trim().min(1), quantity: qty, unitPrice: price, discountPercent: opt(z.number().min(0).max(100)) })).min(1).max(MAX_ITEMS),
  }),
  list_invoices: z.object({ ...clientRef, status: opt(z.string()), search: opt(z.string()), limit, offset }),
  get_invoice: z.object({ invoiceId: opt(z.string()), number: opt(z.string()) }),
  create_invoice: z.object({
    ...clientRef, title: z.string().trim().min(1), description: opt(z.string()), dueDate: opt(day), notes: opt(z.string()), paymentTerms: opt(z.string()),
    taxRate: opt(z.number().min(0).max(100)), discountRate: opt(z.number().min(0).max(100)),
    items: z.array(z.object({ name: z.string().trim().min(1), description: opt(z.string()), quantity: qty, unitPrice: price })).min(1).max(MAX_ITEMS),
  }),
};

// ── Helpers ──

export const toDate = (d: string) => {
  const date = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new ToolError(`Invalid date: ${d}`);
  return date;
};

type ClientRow = { id: string; name: string; status: string };

// A client by id, or by name when exactly one matches; otherwise the candidates are listed so the model can choose
export async function resolveClient(id?: string, name?: string): Promise<ClientRow> {
  if (!id && !name) throw new ToolError("Give clientId or clientName.");
  if (id) {
    const [c] = await db.select({ id: clients.id, name: clients.name, status: clients.status }).from(clients).where(eq(clients.id, id));
    if (!c) throw new ToolError(`No client with id ${id}. Use list_clients to find the right one.`);
    return c;
  }
  const q = name!.trim();
  const all = await db.select({ id: clients.id, name: clients.name, status: clients.status }).from(clients);
  const found = pickByName(q, all.map((c) => ({ id: c.id, label: c.name, keys: [c.name] })), "clients", { none: "Use list_clients to search, or create_client to add one." });
  if ("error" in found) throw new ToolError(found.error);
  return all.find((c) => c.id === found.picked.id)!;
}

export function assertActive(c: ClientRow, what: string) {
  if (c.status === "archived") throw new ToolError(`Client "${c.name}" is archived. Restore it in the app before creating a new ${what}.`);
}

export function checkMoney(label: string, value: number, allowZero = true) {
  if (parseMoney(value, { allowZero }) === null) throw new ToolError(`${label} is not a valid amount (must be ${allowZero ? "zero or more" : "above zero"} and at most ${MAX_MONEY.toLocaleString("en-US")}).`);
}

type Ctx = { userId: string; actor?: string };
type Runner = (args: any, ctx: Ctx) => Promise<unknown>;

export const record = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (error) { console.error("MCP: could not write the activity or history entry:", error); } };

export const financeRunners: Record<string, Runner> = {
  async list_clients({ search, includeArchived, limit: lim = DEFAULT_PAGE, offset = 0 }) {
    // Names are compared without regard to spaces, case or Arabic spelling variants; email and phone still match as written
    const named = search ? nameSearchIds(search, (await db.select({ id: clients.id, name: clients.name }).from(clients)).map((c) => ({ id: c.id, label: c.name, keys: [c.name] }))) : null;
    const where = and(
      includeArchived ? undefined : ne(clients.status, "archived"),
      search ? or(named?.length ? inArray(clients.id, named) : undefined, ilike(clients.email, like(search)), ilike(clients.phone, like(search))) : undefined,
    );
    const [{ n }] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(clients).where(where);
    const rows = await db.select().from(clients).where(where).orderBy(desc(clients.createdAt)).limit(lim).offset(offset);
    return pageOf(Number(n), rows.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, city: c.city, status: c.status })), offset);
  },

  async create_client(a, { userId }) {
    if (!a.allowDuplicate) {
      const same = await db.select({ id: clients.id, name: clients.name }).from(clients).where(sql`lower(${clients.name}) = ${a.name.toLowerCase()}`).limit(3);
      if (same.length) throw new ToolError(`A client named "${same[0].name}" already exists (id ${same[0].id}). Use it, or repeat with allowDuplicate: true if this is a different client.`);
    }
    const [c] = await db.insert(clients).values({ name: a.name, email: a.email ?? null, phone: a.phone ?? null, city: a.city ?? null, country: a.country ?? null, status: "active", totalValue: "0", createdBy: userId }).returning();
    await record(() => db.insert(activities).values({ type: "client_added", title: "New Client Added", description: `Client "${c.name}" was added to the system`, entityType: "client", entityId: c.id, createdBy: userId }));
    return { id: c.id, name: c.name, email: c.email, phone: c.phone, city: c.city, status: c.status };
  },

  async list_quotations(a) {
    const client = a.clientId || a.clientName ? await resolveClient(a.clientId, a.clientName) : null;
    const where = and(
      client ? eq(quotations.clientId, client.id) : undefined,
      a.status ? eq(quotations.status, a.status) : undefined,
      a.search ? or(ilike(quotations.quotationNumber, like(a.search)), ilike(quotations.title, like(a.search))) : undefined,
    );
    const [{ n }] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(quotations).where(where);
    const rows = await db.select({ q: quotations, clientName: clients.name }).from(quotations).leftJoin(clients, eq(clients.id, quotations.clientId)).where(where)
      .orderBy(desc(quotations.createdAt)).limit(a.limit ?? DEFAULT_PAGE).offset(a.offset ?? 0);
    return pageOf(Number(n), rows.map((r) => ({ id: r.q.id, number: r.q.quotationNumber, title: r.q.title, client: r.clientName, status: r.q.status, amount: money(r.q.amount), validUntil: iso(r.q.validUntil), createdAt: iso(r.q.createdAt) })), a.offset ?? 0);
  },

  async get_quotation({ quotationId, number }) {
    if (!quotationId && !number) throw new ToolError("Give quotationId or number.");
    const [row] = await db.select({ q: quotations, clientName: clients.name }).from(quotations).leftJoin(clients, eq(clients.id, quotations.clientId))
      .where(quotationId ? eq(quotations.id, quotationId) : eq(quotations.quotationNumber, number!));
    if (!row) throw new ToolError("No such quotation. Use list_quotations to find it.");
    const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, row.q.id));
    return {
      id: row.q.id, number: row.q.quotationNumber, title: row.q.title, description: row.q.description, client: row.clientName, clientId: row.q.clientId, status: row.q.status,
      subtotal: money(row.q.subtotal), discountAmount: money(row.q.discountAmount), amount: money(row.q.amount), validUntil: iso(row.q.validUntil), notes: row.q.notes, terms: row.q.terms,
      items: items.map((i) => ({ description: i.description, quantity: money(i.quantity), unitPrice: money(i.unitPrice), discountPercent: money(i.discount), total: money(i.totalPrice) })),
    };
  },

  async create_quotation(a, { userId, actor }) {
    const client = await resolveClient(a.clientId, a.clientName);
    assertActive(client, "quotation");
    const lines = a.items.map((i: any, n: number) => {
      checkMoney(`Item ${n + 1} unit price`, i.unitPrice);
      checkMoney(`Item ${n + 1} quantity`, i.quantity, false);
      const total = quotationItemTotal(i.quantity, i.unitPrice, i.discountPercent ?? 0);
      checkMoney(`Item ${n + 1} total`, total);
      return { ...i, total };
    });
    const total = round2(lines.reduce((s: number, l: any) => s + l.total, 0));
    const subtotal = round2(lines.reduce((s: number, l: any) => s + l.quantity * l.unitPrice, 0));
    checkMoney("Quotation total", total);
    checkMoney("Quotation subtotal", subtotal);
    const discountAmount = round2(subtotal - total);
    const discountRate = subtotal > 0 ? round2((discountAmount / subtotal) * 100) : 0;

    const created = await db.transaction(async (tx) => {
      await lockNumbering(tx, "quotation_number");
      const quotationNumber = await generateQuotationNumber(tx);
      const [q] = await tx.insert(quotations).values({
        quotationNumber, clientId: client.id, title: a.title, description: a.description ?? null, status: "draft",
        amount: total.toFixed(2), subtotal: subtotal.toFixed(2), discountAmount: discountAmount.toFixed(2), discountRate: discountRate.toFixed(2),
        validUntil: a.validUntil ? toDate(a.validUntil) : null, notes: a.notes ?? null, terms: a.terms ?? null, createdBy: userId,
      }).returning();
      await tx.insert(quotationItems).values(lines.map((l: any) => ({
        quotationId: q.id, description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPrice), totalPrice: l.total.toFixed(2), discount: String(l.discountPercent ?? 0),
      })));
      await tx.insert(quotationHistory).values({ quotationId: q.id, event: `Quotation ${quotationNumber} created through the AI assistant`, actor: actor ?? "AI assistant" });
      return q;
    });
    await record(() => db.insert(activities).values({ type: "quotation_sent", title: "Quotation Created", description: `Quotation ${created.quotationNumber} was created`, entityType: "quotation", entityId: created.id, createdBy: userId }));
    return { id: created.id, number: created.quotationNumber, client: client.name, status: "draft", subtotal, discountAmount, total, items: lines.length, path: `/quotations/${created.id}` };
  },

  async list_invoices(a) {
    const client = a.clientId || a.clientName ? await resolveClient(a.clientId, a.clientName) : null;
    // "overdue" is not a stored status: it is an issued invoice with money still owed whose due date has passed
    const statusCond = a.status === "overdue"
      ? sql`${invoices.status} NOT IN ('draft','cancelled','paid','refunded','partially_refunded') AND ${invoices.dueDate} < date_trunc('day', now()) AND (${invoices.amount} - COALESCE(${invoices.paidAmount}, 0)) > 0`
      : a.status ? eq(invoices.status, a.status) : undefined;
    const where = and(
      client ? eq(invoices.clientId, client.id) : undefined,
      statusCond,
      a.search ? or(ilike(invoices.invoiceNumber, like(a.search)), ilike(invoices.title, like(a.search))) : undefined,
    );
    const [{ n, owed }] = await db.select({ n: sql<number>`COUNT(*)::int`, owed: sql<string>`COALESCE(SUM(${invoices.amount} - COALESCE(${invoices.paidAmount}, 0)), 0)` }).from(invoices).where(where);
    const rows = await db.select({ i: invoices, clientName: clients.name }).from(invoices).leftJoin(clients, eq(clients.id, invoices.clientId)).where(where)
      .orderBy(desc(invoices.createdAt)).limit(a.limit ?? DEFAULT_PAGE).offset(a.offset ?? 0);
    const page = pageOf(Number(n), rows.map((r) => ({ id: r.i.id, number: r.i.invoiceNumber, title: r.i.title, client: r.clientName, status: r.i.status, amount: money(r.i.amount), paid: money(r.i.paidAmount), remaining: round2(money(r.i.amount) - money(r.i.paidAmount)), dueDate: iso(r.i.dueDate) })), a.offset ?? 0);
    // The balance across everything the filter matches, not only this page
    return { ...page, totalRemaining: round2(Number(owed)) };
  },

  async get_invoice({ invoiceId, number }) {
    if (!invoiceId && !number) throw new ToolError("Give invoiceId or number.");
    const [row] = await db.select({ i: invoices, clientName: clients.name }).from(invoices).leftJoin(clients, eq(clients.id, invoices.clientId))
      .where(invoiceId ? eq(invoices.id, invoiceId) : eq(invoices.invoiceNumber, number!));
    if (!row) throw new ToolError("No such invoice. Use list_invoices to find it.");
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, row.i.id));
    const i = row.i;
    return {
      id: i.id, number: i.invoiceNumber, title: i.title, description: i.description, client: row.clientName, clientId: i.clientId, status: i.status,
      subtotal: money(i.subtotal), taxRate: money(i.taxRate), taxAmount: money(i.taxAmount), discountRate: money(i.discountRate), discountAmount: money(i.discountAmount),
      amount: money(i.amount), paid: money(i.paidAmount), remaining: round2(money(i.amount) - money(i.paidAmount)), dueDate: iso(i.dueDate), notes: i.notes, paymentTerms: i.paymentTerms,
      items: items.map((t) => ({ name: t.name, description: t.description, quantity: money(t.quantity), unitPrice: money(t.unitPrice), total: money(t.totalPrice) })),
    };
  },

  async create_invoice(a, { userId, actor }) {
    const client = await resolveClient(a.clientId, a.clientName);
    assertActive(client, "invoice");
    const lines = a.items.map((i: any, n: number) => {
      checkMoney(`Item ${n + 1} unit price`, i.unitPrice);
      checkMoney(`Item ${n + 1} quantity`, i.quantity, false);
      const total = round2(i.quantity * i.unitPrice);
      checkMoney(`Item ${n + 1} total`, total);
      return { ...i, total };
    });
    const taxRate = a.taxRate ?? 0;
    const discountRate = a.discountRate ?? 0;
    if (parsePercent(taxRate) === null || parsePercent(discountRate) === null) throw new ToolError("taxRate and discountRate must be between 0 and 100.");
    const t = invoiceTotals(lines.map((l: any) => l.total), taxRate, discountRate);
    for (const [label, v] of Object.entries(t)) checkMoney(`Invoice ${label}`, v);
    if (t.amount < 0) throw new ToolError("The discount is larger than the invoice total.");

    const created = await db.transaction(async (tx) => {
      await lockNumbering(tx, "invoice_number");
      const invoiceNumber = await generateInvoiceNumber(tx);
      const [inv] = await tx.insert(invoices).values({
        invoiceNumber, clientId: client.id, quotationId: null, title: a.title, description: a.description ?? null,
        amount: t.amount.toFixed(2), subtotal: t.subtotal.toFixed(2), taxRate: String(taxRate), taxAmount: t.taxAmount.toFixed(2),
        discountRate: String(discountRate), discountAmount: t.discountAmount.toFixed(2), paidAmount: "0", status: "draft", invoiceDate: new Date(),
        dueDate: a.dueDate ? toDate(a.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), notes: a.notes ?? null, paymentTerms: a.paymentTerms ?? null, createdBy: userId,
      }).returning();
      await tx.insert(invoiceItems).values(lines.map((l: any) => ({
        invoiceId: inv.id, serviceId: null, name: l.name, description: l.description ?? null, quantity: String(l.quantity), unitPrice: String(l.unitPrice), totalPrice: l.total.toFixed(2),
      })));
      await tx.insert(invoiceHistory).values({ invoiceId: inv.id, event: `Invoice ${invoiceNumber} created through the AI assistant`, actor: actor ?? "AI assistant" });
      return inv;
    });
    return { id: created.id, number: created.invoiceNumber, client: client.name, status: "draft", ...t, items: lines.length, path: `/invoices/${created.id}` };
  },
};
