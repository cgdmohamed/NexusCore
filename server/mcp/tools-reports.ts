// Read-only report tools. The numbers are worked out here with the same rules as the dashboard, the projects page and the client statement,
// so the assistant quotes them instead of adding up pages of records itself.
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { clientCreditHistory, clients, invoices, payments, projects, tasks } from "@shared/schema";
import { bucketAging } from "../dashboard-overview";
import { projectHealth } from "../project-health";
import { buildStatement } from "../statement";
import { APP_TIMEZONE, dayKey } from "../task-insights";
import type { ToolDefinition } from "./protocol";
import { ToolError } from "./errors";
import { resolveClient } from "./tools-finance";
import { DEFAULT_PAGE, pageOf } from "./paging";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const rowsOf = (r: any): any[] => (r.rows ?? r) as any[];
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");

export const REPORT_TOOLS: ToolDefinition[] = [
  {
    name: "summary_invoices", title: "Invoice summary",
    description: "The money picture in one call: how much is still owed on issued invoices, how much of it is overdue, how old the debts are (not yet due, 1-30, 31-60, 61-90, over 90 days), the biggest debtors, and what was invoiced and collected this month. Amounts in EGP. Use this for 'how much is overdue', 'who owes us' and similar questions instead of adding up list_invoices.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "summary_projects", title: "Project summary",
    description: "Every project with its completion percentage, tasks done out of all (cancelled ones left out), late tasks, due date and state (on_track, at_risk, overdue, ready_to_close, no_tasks). Active projects by default. Worst first. Returns { total, hasMore, items }.",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["active", "on_hold", "completed"] }, limit: { type: "integer", minimum: 1, maximum: 100 }, offset: { type: "integer", minimum: 0 } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "my_day", title: "My day",
    description: "The signed-in person's own work: tasks that are overdue, due today and due in the next 7 days (open tasks assigned to them), each with a total. Use this for 'what do I have today' or 'what is late'.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "client_statement", title: "Client statement",
    description: "A client's account position: billed, received, refunded, what they owe now, what is overdue, their credit balance, and the latest ledger entries. By clientId or clientName; optional from/to (YYYY-MM-DD) for the period. Amounts in EGP.",
    inputSchema: { type: "object", properties: { clientId: { type: "string" }, clientName: { type: "string" }, from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } } },
    annotations: { readOnlyHint: true },
  },
];

export const REPORT_NEEDS: Record<string, [string, string]> = {
  summary_invoices: ["invoices", "view"],
  summary_projects: ["projects", "view"],
  my_day: ["tasks", "view"],
  client_statement: ["invoices", "view"],
};

export const reportSchemas: Record<string, z.ZodTypeAny> = {
  summary_invoices: z.object({}),
  summary_projects: z.object({ status: z.enum(["active", "on_hold", "completed"]).optional(), limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).optional() }),
  my_day: z.object({}),
  client_statement: z.object({ clientId: z.string().optional(), clientName: z.string().optional(), from: day.optional(), to: day.optional() }),
};

type Ctx = { userId: string; actor?: string };
type Runner = (args: any, ctx: Ctx) => Promise<unknown>;

const HEALTH_RANK: Record<string, number> = { overdue: 0, at_risk: 1, ready_to_close: 2, on_track: 3, no_tasks: 4, on_hold: 5, completed: 6 };

export const reportRunners: Record<string, Runner> = {
  async summary_invoices() {
    const tz = APP_TIMEZONE;
    const now = new Date();
    const issued = await db.select({
      clientId: invoices.clientId, clientName: clients.name, status: invoices.status, amount: invoices.amount, paidAmount: invoices.paidAmount, dueDate: invoices.dueDate,
    }).from(invoices).leftJoin(clients, eq(clients.id, invoices.clientId)).where(sql`${invoices.status} NOT IN ('draft','cancelled')`);
    const aging = bucketAging(issued, now, tz, 5);

    const month = dayKey(now, tz).slice(0, 7);
    const monthOf = (col: any) => sql`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM')`;
    const [billed] = rowsOf(await db.execute(sql`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount::numeric), 0) AS total FROM invoices WHERE status NOT IN ('draft','cancelled') AND ${monthOf(sql`COALESCE(invoice_date, created_at)`)} = ${month}`));
    const [collected] = rowsOf(await db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0) AS total FROM payments WHERE payment_method <> 'credit_balance' AND ${monthOf(sql`payment_date`)} = ${month}`));
    const buckets = Object.fromEntries(Object.entries(aging.buckets).map(([k, v]) => [k, { count: v.count, amount: round2(v.amount) }]));
    return {
      currency: "EGP",
      outstanding: { total: round2(aging.total), invoices: Object.values(aging.buckets).reduce((n, b) => n + b.count, 0) },
      overdue: { count: aging.overdueCount, amount: round2(aging.overdueAmount) },
      aging: buckets,
      topDebtors: aging.topDebtors.map((d) => ({ clientId: d.clientId, client: d.name, outstanding: round2(d.outstanding), oldestDaysPastDue: d.oldestDaysPastDue })),
      thisMonth: { month, invoiced: { count: Number(billed.n), amount: round2(Number(billed.total)) }, collected: round2(Number(collected.total)) },
    };
  },

  async summary_projects({ status = "active", limit = DEFAULT_PAGE, offset = 0 }) {
    const startOfToday = sql`((${dayKey(new Date(), APP_TIMEZONE)}::date)::timestamp AT TIME ZONE ${APP_TIMEZONE}) AT TIME ZONE 'UTC'`;
    const rows = await db.select().from(projects).where(eq(projects.status, status));
    const ids = rows.map((p) => p.id);
    const stats = ids.length
      ? rowsOf(await db.execute(sql`
          SELECT project_id,
                 COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS total,
                 COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                 COUNT(*) FILTER (WHERE status IN ('pending','in_progress') AND due_date < ${startOfToday})::int AS overdue
          FROM tasks WHERE project_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) GROUP BY project_id`))
      : [];
    const by = new Map(stats.map((r) => [r.project_id, r]));
    const items = rows.map((p) => {
      const s = by.get(p.id);
      const total = Number(s?.total ?? 0), completed = Number(s?.completed ?? 0), overdue = Number(s?.overdue ?? 0);
      const health = projectHealth({ status: p.status, dueDate: p.dueDate, total, completed, overdueTasks: overdue });
      return { id: p.id, name: p.name, status: p.status, state: health, percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0, tasksDone: completed, tasksTotal: total, lateTasks: overdue, startDate: iso(p.startDate), dueDate: iso(p.dueDate) };
    }).sort((a, b) => (HEALTH_RANK[a.state] ?? 9) - (HEALTH_RANK[b.state] ?? 9) || a.percentComplete - b.percentComplete || a.name.localeCompare(b.name));
    return pageOf(items.length, items.slice(offset, offset + limit), offset);
  },

  async my_day(_args, { userId }) {
    const today = dayKey(new Date(), APP_TIMEZONE);
    const startOfToday = sql`((${today}::date)::timestamp AT TIME ZONE ${APP_TIMEZONE}) AT TIME ZONE 'UTC'`;
    const bucket = sql`CASE WHEN t.due_date < ${startOfToday} THEN 'overdue' WHEN t.due_date < (${startOfToday}) + interval '1 day' THEN 'today' ELSE 'next7' END`;
    const rows = rowsOf(await db.execute(sql`
      SELECT * FROM (
        SELECT t.id, t.title, t.status, t.priority, p.name AS project,
               to_char((t.due_date AT TIME ZONE 'UTC') AT TIME ZONE ${APP_TIMEZONE}, 'YYYY-MM-DD') AS due,
               ${bucket} AS bucket,
               COUNT(*) OVER (PARTITION BY ${bucket})::int AS total,
               ROW_NUMBER() OVER (PARTITION BY ${bucket} ORDER BY t.due_date, CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.title) AS rn
        FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.assigned_to = ${userId} AND t.status IN ('pending','in_progress') AND t.due_date IS NOT NULL
          AND t.due_date < (${startOfToday}) + interval '8 days'
      ) x WHERE rn <= 15 ORDER BY bucket, rn`));
    const pick = (b: string) => {
      const mine = rows.filter((r) => r.bucket === b);
      return { total: mine[0] ? Number(mine[0].total) : 0, shown: mine.length, items: mine.map((r) => ({ id: r.id, title: r.title, status: r.status, priority: r.priority, project: r.project ?? null, dueDate: r.due })) };
    };
    return { today, overdue: pick("overdue"), dueToday: pick("today"), next7Days: pick("next7") };
  },

  async client_statement(a) {
    const client = await resolveClient(a.clientId, a.clientName);
    const from = a.from ? new Date(`${a.from}T00:00:00.000Z`) : null;
    const to = a.to ? new Date(`${a.to}T23:59:59.999Z`) : null;
    if (from && to && from > to) throw new ToolError("from must not be after to.");
    const [row] = await db.select().from(clients).where(eq(clients.id, client.id));
    const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, client.id));
    const ids = clientInvoices.map((i) => i.id);
    const clientPayments = ids.length ? await db.select().from(payments).where(inArray(payments.invoiceId, ids)) : [];
    const creditRefunds = await db.select().from(clientCreditHistory).where(and(eq(clientCreditHistory.clientId, client.id), eq(clientCreditHistory.type, "credit_refunded")));
    const st = buildStatement({ invoices: clientInvoices, payments: clientPayments, creditRefunds, creditBalance: row?.creditBalance ?? null, from, to });
    return {
      currency: "EGP", client: { id: client.id, name: client.name },
      period: { from: a.from ?? null, to: a.to ?? null },
      openingBalance: st.openingBalance, totals: st.totals, position: st.position,
      entryCount: st.entries.length,
      latestEntries: st.entries.slice(-15).reverse().map((e) => ({ date: e.date.slice(0, 10), kind: e.kind, reference: e.reference, invoice: e.invoiceNumber, debit: e.debit, credit: e.credit, balance: e.balance })),
    };
  },
};
