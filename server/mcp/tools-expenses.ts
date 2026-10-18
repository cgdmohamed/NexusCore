// MCP tools for expenses. The assistant can look expenses up and record a new one, always as "pending": a person with the
// approval permission reviews it and pays it from the app. Paying moves money out of a payment source, so it is not offered here.
import { z } from "zod";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { clients, expenseCategories, expenses, projects } from "@shared/schema";
import { notificationService } from "../notification-service";
import { APP_TIMEZONE, dayKey } from "../task-insights";
import type { ToolDefinition } from "./protocol";
import { ToolError } from "./errors";
import { pickByName } from "./names";
import { DEFAULT_PAGE, pageOf, pageProps } from "./paging";
import { assertActive, checkMoney, resolveClient, toDate } from "./tools-finance";

export const PAYMENT_METHODS = ["cash", "bank_transfer", "credit_card", "debit_card", "check"] as const;
const like = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
// tools.ts imports this file, so the project lookup is loaded when it is needed rather than at start-up
const resolveProject = async (id?: string, name?: string) => (await import("./tools")).resolveProject(id, name);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dateProp = { type: "string", description: "YYYY-MM-DD" } as const;

export const EXPENSE_TOOLS: ToolDefinition[] = [
  {
    name: "list_expense_categories", title: "List expense categories",
    description: "The expense categories that can be used, with their ids. Call this to choose a category for create_expense.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_expenses", title: "List expenses",
    description: "List expenses, newest first. Filter by text over title and description, category (id or name), status (pending, paid, overdue, cancelled), project, and a from/to range of expense dates. Returns { total, hasMore, totalAmount, items }: totalAmount is the sum of every match in EGP, not only this page.",
    inputSchema: {
      type: "object",
      properties: { search: { type: "string" }, categoryId: { type: "string" }, categoryName: { type: "string" }, status: { type: "string" }, projectId: { type: "string" }, projectName: { type: "string" }, from: dateProp, to: dateProp, ...pageProps },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_expense", title: "Record expense",
    description: "Record an expense. It is saved as PENDING: someone with approval rights reviews and pays it in the app, so nothing is paid and no account balance changes. Needs a title, an amount in EGP and a category (id or name; use list_expense_categories if unsure, and ask the person rather than guessing). Defaults: today's date, cash, variable. Receipts are attached in the app. Call list_expenses first when this might already be recorded; an identical expense created in the last hour is refused unless allowDuplicate is true.",
    inputSchema: {
      type: "object", required: ["title", "amount"],
      properties: {
        title: { type: "string" }, amount: { type: "number", description: "EGP, above zero" },
        categoryId: { type: "string" }, categoryName: { type: "string", description: "Category name, used when no id is given; must match exactly one" },
        expenseDate: { ...dateProp, description: "YYYY-MM-DD; defaults to today" },
        paymentMethod: { type: "string", enum: [...PAYMENT_METHODS], description: "Defaults to cash" },
        paymentReference: { type: "string", description: "Transfer or cheque number" },
        type: { type: "string", enum: ["variable", "fixed"], description: "Defaults to variable" },
        description: { type: "string" }, notes: { type: "string" }, dueDate: dateProp,
        projectId: { type: "string" }, projectName: { type: "string" }, clientId: { type: "string" }, clientName: { type: "string" },
        allowDuplicate: { type: "boolean" },
      },
    },
  },
];

export const EXPENSE_NEEDS: Record<string, [string, string]> = {
  list_expense_categories: ["expenses", "view"], list_expenses: ["expenses", "view"], create_expense: ["expenses", "add"],
};

const opt = <T extends z.ZodTypeAny>(s: T) => s.optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");

export const expenseSchemas: Record<string, z.ZodTypeAny> = {
  list_expense_categories: z.object({}),
  list_expenses: z.object({
    search: opt(z.string()), categoryId: opt(z.string()), categoryName: opt(z.string()), status: opt(z.string()), projectId: opt(z.string()), projectName: opt(z.string()),
    from: opt(day), to: opt(day), limit: opt(z.number().int().min(1).max(100)), offset: opt(z.number().int().min(0)),
  }),
  create_expense: z.object({
    title: z.string().trim().min(1).max(200), amount: z.number(),
    categoryId: opt(z.string()), categoryName: opt(z.string()), expenseDate: opt(day), paymentMethod: opt(z.enum(PAYMENT_METHODS)), paymentReference: opt(z.string().trim().max(120)),
    type: opt(z.enum(["variable", "fixed"])), description: opt(z.string().trim().max(2000)), notes: opt(z.string().trim().max(2000)), dueDate: opt(day),
    projectId: opt(z.string()), projectName: opt(z.string()), clientId: opt(z.string()), clientName: opt(z.string()), allowDuplicate: opt(z.boolean()),
  }),
};

type Ctx = { userId: string; actor?: string };
type Runner = (args: any, ctx: Ctx) => Promise<unknown>;

// A category by id, or by name (spacing, case and Arabic spelling variants do not matter); otherwise what to tell the model
async function resolveCategory(id?: string, name?: string): Promise<{ id: string; name: string }> {
  const all = await db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.isActive, true));
  if (id) {
    const c = all.find((x) => x.id === id);
    if (!c) throw new ToolError(`No active category with id ${id}. Use list_expense_categories.`);
    return c;
  }
  if (!name) throw new ToolError("Give categoryId or categoryName. Use list_expense_categories to see them, or ask the person which one fits.");
  const found = pickByName(name.trim(), all.map((c) => ({ id: c.id, label: c.name, keys: [c.name] })), "categories", { none: `Available: ${all.map((c) => c.name).join(", ") || "none"}. Ask the person which one to use.`, singular: "category" });
  if ("error" in found) throw new ToolError(found.error);
  return { id: found.picked.id, name: found.picked.label };
}

export const expenseRunners: Record<string, Runner> = {
  async list_expense_categories() {
    const rows = await db.select().from(expenseCategories).where(eq(expenseCategories.isActive, true)).orderBy(expenseCategories.name);
    return rows.map((c) => ({ id: c.id, name: c.name, description: c.description }));
  },

  async list_expenses(a) {
    const category = a.categoryId || a.categoryName ? await resolveCategory(a.categoryId, a.categoryName) : null;
    const project = a.projectId || a.projectName ? await resolveProject(a.projectId, a.projectName) : null;
    const tz = APP_TIMEZONE;
    const start = (d: string) => sql`((${d}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
    const where = and(
      category ? eq(expenses.categoryId, category.id) : undefined,
      project ? eq(expenses.relatedProjectId, project.id) : undefined,
      a.status ? eq(expenses.status, a.status) : undefined,
      a.search ? or(ilike(expenses.title, like(a.search)), ilike(expenses.description, like(a.search))) : undefined,
      a.from ? gte(expenses.expenseDate, sql`${start(a.from)}`) : undefined,
      a.to ? sql`${expenses.expenseDate} < (${start(a.to)}) + interval '1 day'` : undefined,
    );
    const [{ n, total }] = await db.select({ n: sql<number>`COUNT(*)::int`, total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses).where(where);
    const rows = await db.select({ e: expenses, category: expenseCategories.name, project: projects.name })
      .from(expenses).leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId)).leftJoin(projects, eq(projects.id, expenses.relatedProjectId))
      .where(where).orderBy(desc(expenses.expenseDate), desc(expenses.createdAt)).limit(a.limit ?? DEFAULT_PAGE).offset(a.offset ?? 0);
    const page = pageOf(Number(n), rows.map((r) => ({
      id: r.e.id, title: r.e.title, amount: Number(r.e.amount), category: r.category, status: r.e.status, expenseDate: iso(r.e.expenseDate),
      paymentMethod: r.e.paymentMethod, project: r.project ?? null,
    })), a.offset ?? 0);
    return { ...page, totalAmount: round2(Number(total)) };
  },

  async create_expense(a, { userId }) {
    checkMoney("amount", a.amount, false);
    const category = await resolveCategory(a.categoryId, a.categoryName);
    const project = a.projectId || a.projectName ? await resolveProject(a.projectId, a.projectName) : null;
    let client: { id: string; name: string } | null = null;
    if (a.clientId || a.clientName) {
      const c = await resolveClient(a.clientId, a.clientName);
      assertActive(c, "expense");
      client = { id: c.id, name: c.name };
    }
    const today = dayKey(new Date(), APP_TIMEZONE);
    const expenseDate = toDate(a.expenseDate ?? today);
    const amount = round2(a.amount);

    // A retry after a timeout must not record the same expense twice
    if (!a.allowDuplicate) {
      const [same] = await db.select({ id: expenses.id }).from(expenses).where(and(
        eq(expenses.createdBy, userId), eq(expenses.title, a.title), eq(expenses.amount, amount.toFixed(2)), eq(expenses.expenseDate, expenseDate),
        sql`${expenses.createdAt} > now() - interval '1 hour'`,
      )).limit(1);
      if (same) throw new ToolError(`This expense was just recorded (id ${same.id}). Nothing was added. Repeat with allowDuplicate: true only if it is a different one.`);
    }

    const [e] = await db.insert(expenses).values({
      title: a.title, description: a.description ?? null, amount: amount.toFixed(2), categoryId: category.id, type: a.type ?? "variable",
      expenseDate, dueDate: a.dueDate ? toDate(a.dueDate) : null, paymentMethod: a.paymentMethod ?? "cash", paymentReference: a.paymentReference ?? null,
      status: "pending", notes: a.notes ?? null, relatedProjectId: project?.id ?? null, relatedClientId: client?.id ?? null,
      isRecurring: false, createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    }).returning();

    // Whoever approves expenses hears about it, as with an expense entered in the app; a failed notice never undoes the record
    try { await notificationService.notifyExpenseSubmitted(e.id, userId, e.title, Number(e.amount)); }
    catch (error) { console.error("MCP: expense submitted notification failed:", error); }

    return { id: e.id, title: e.title, amount, category: category.name, expenseDate: iso(e.expenseDate), paymentMethod: e.paymentMethod, status: "pending", project: project?.name ?? null, client: client?.name ?? null, note: "Saved as pending; it is paid and approved in the app.", path: `/expenses/${e.id}` };
  },
};
