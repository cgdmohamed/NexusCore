// One calendar for the dates the company already keeps: task due dates, invoice due dates, quotation expiry and project start/due.
// Everything is read from the existing tables; days are the company's calendar days (APP_TIMEZONE), as YYYY-MM-DD.

import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { requireAuth } from "./auth";
import { APP_TIMEZONE } from "./task-insights";
import { projectHealth, type ProjectHealth } from "./project-health";

export const MAX_RANGE_DAYS = 125;

export type CalendarEventType = "task" | "invoice" | "quotation" | "project";
export const EVENT_TYPES: CalendarEventType[] = ["task", "invoice", "quotation", "project"];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const parseDay = (s: string) => Date.parse(`${s}T00:00:00Z`);

// A range the screens ask for: a month grid, a week, or a few months of timeline. Bounded so one request stays small.
export function parseRange(from: unknown, to: unknown): { from: string; to: string } | { error: string } {
  if (typeof from !== "string" || typeof to !== "string" || !DAY_RE.test(from) || !DAY_RE.test(to) || Number.isNaN(parseDay(from)) || Number.isNaN(parseDay(to))) {
    return { error: "from and to must be dates in the form YYYY-MM-DD." };
  }
  const days = Math.round((parseDay(to) - parseDay(from)) / 86_400_000);
  if (days < 0) return { error: "to must not be before from." };
  if (days + 1 > MAX_RANGE_DAYS) return { error: `Ask for at most ${MAX_RANGE_DAYS} days at a time.` };
  return { from, to };
}

export interface CalendarEvent {
  type: CalendarEventType;
  id: string;
  day: string;
  title: string;
  subtitle?: string;
  status: string;
  state?: "late" | "done" | "open";
  href: string;
  priority?: string;
  assignee?: string;
  amount?: number;
  remaining?: number;
  /** For a project event: which end of the project it marks */
  mark?: "start" | "due";
}

export interface CalendarProject {
  id: string;
  name: string;
  color: string;
  status: string;
  startDay: string | null;
  dueDay: string | null;
  pct: number;
  completed: number;
  total: number;
  overdue: number;
  health: ProjectHealth;
}

const can = (req: any, module: string) => req.user?.permissions?.[module]?.view === true;
const rowsOf = (r: any): any[] => (r.rows ?? r) as any[];
const num = (v: unknown) => Number(v ?? 0) || 0;
const fullName = (f?: string | null, l?: string | null) => [f, l].filter(Boolean).join(" ") || undefined;

export function registerCalendarRoutes(app: Express) {
  app.get("/api/calendar", requireAuth, async (req: any, res) => {
    try {
      const range = parseRange(req.query.from, req.query.to);
      if ("error" in range) return res.status(400).json({ message: range.error });

      // A person sees their own calendar; the administrator may look at the whole team's
      const wantsTeam = req.query.scope === "team";
      if (wantsTeam && req.user?.roleName !== "Admin") return res.status(403).json({ message: "Only an administrator can see the team's calendar." });
      const scope = wantsTeam ? "team" : "me";
      const me = req.user.id as string;
      const tz = APP_TIMEZONE;

      const types = typeof req.query.types === "string" && req.query.types
        ? EVENT_TYPES.filter((t) => (req.query.types as string).split(",").includes(t))
        : EVENT_TYPES;

      // Midnight (company time) of the first day, as the UTC timestamp the columns store; the end is exclusive
      const start = sql`((${range.from}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
      const end = sql`(((${range.to}::date + 1)::timestamp) AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
      const dayOf = (col: ReturnType<typeof sql>) => sql`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;
      const todayRow = rowsOf(await db.execute(sql`SELECT to_char(NOW() AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS d`));
      const today: string = todayRow[0].d;

      const events: CalendarEvent[] = [];
      let projects: CalendarProject[] = [];

      if (types.includes("task") && can(req, "tasks")) {
        const mine = scope === "me" ? sql`AND t.assigned_to = ${me}` : sql``;
        const rows = rowsOf(await db.execute(sql`
          SELECT t.id, t.title, t.status, t.priority, ${dayOf(sql`t.due_date`)} AS day, p.name AS project, u.first_name, u.last_name
          FROM tasks t
          LEFT JOIN projects p ON p.id = t.project_id
          LEFT JOIN users u ON u.id = t.assigned_to
          WHERE t.due_date >= ${start} AND t.due_date < ${end} AND t.status <> 'cancelled' ${mine}
          ORDER BY t.due_date, t.title
        `));
        for (const r of rows) {
          const done = r.status === "completed";
          events.push({
            type: "task", id: r.id, day: r.day, title: r.title, status: r.status, priority: r.priority,
            state: done ? "done" : r.day < today ? "late" : "open",
            subtitle: [r.project, scope === "team" ? fullName(r.first_name, r.last_name) : null].filter(Boolean).join(" · ") || undefined,
            assignee: fullName(r.first_name, r.last_name), href: "/tasks",
          });
        }
      }

      if (types.includes("invoice") && can(req, "invoices")) {
        const mine = scope === "me" ? sql`AND i.created_by = ${me}` : sql``;
        const rows = rowsOf(await db.execute(sql`
          SELECT i.id, i.invoice_number, i.status, i.amount, i.paid_amount, ${dayOf(sql`i.due_date`)} AS day, c.name AS client
          FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
          WHERE i.due_date >= ${start} AND i.due_date < ${end} AND i.status NOT IN ('draft','cancelled') ${mine}
          ORDER BY i.due_date, i.invoice_number
        `));
        for (const r of rows) {
          const remaining = Math.max(0, num(r.amount) - num(r.paid_amount));
          const settled = remaining <= 0 || r.status === "paid" || r.status === "refunded";
          events.push({
            type: "invoice", id: r.id, day: r.day, title: r.invoice_number, subtitle: r.client ?? undefined, status: r.status,
            state: settled ? "done" : r.day < today ? "late" : "open",
            amount: num(r.amount), remaining, href: `/invoices/${r.id}`,
          });
        }
      }

      if (types.includes("quotation") && can(req, "quotations")) {
        const mine = scope === "me" ? sql`AND q.created_by = ${me}` : sql``;
        const rows = rowsOf(await db.execute(sql`
          SELECT q.id, q.quotation_number, q.title, q.status, ${dayOf(sql`q.valid_until`)} AS day, c.name AS client
          FROM quotations q LEFT JOIN clients c ON c.id = q.client_id
          WHERE q.valid_until >= ${start} AND q.valid_until < ${end} AND q.status = 'sent' ${mine}
          ORDER BY q.valid_until, q.quotation_number
        `));
        for (const r of rows) {
          events.push({
            type: "quotation", id: r.id, day: r.day, title: r.quotation_number, subtitle: [r.client, r.title].filter(Boolean).join(" · ") || undefined,
            status: r.status, state: r.day < today ? "late" : "open", href: `/quotations/${r.id}`,
          });
        }
      }

      if (types.includes("project") && can(req, "projects")) {
        // Projects that overlap the range, not archived. A person sees those they belong to or hold tasks in.
        const visible = scope === "me"
          ? sql`AND (EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ${me})
                     OR EXISTS (SELECT 1 FROM tasks tt WHERE tt.project_id = p.id AND tt.assigned_to = ${me}))`
          : sql``;
        const rows = rowsOf(await db.execute(sql`
          SELECT p.id, p.name, p.color, p.status, p.due_date,
                 ${dayOf(sql`p.start_date`)} AS start_day, ${dayOf(sql`p.due_date`)} AS due_day,
                 COALESCE(s.total, 0) AS total, COALESCE(s.completed, 0) AS completed, COALESCE(s.overdue, 0) AS overdue
          FROM projects p
          LEFT JOIN (
            SELECT project_id,
                   COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS total,
                   COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                   COUNT(*) FILTER (WHERE status IN ('pending','in_progress') AND due_date < ((${today}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC')::int AS overdue
            FROM tasks WHERE project_id IS NOT NULL GROUP BY project_id
          ) s ON s.project_id = p.id
          WHERE p.status <> 'archived' ${visible}
            AND (p.start_date IS NOT NULL OR p.due_date IS NOT NULL)
            AND COALESCE(p.start_date, p.due_date) < ${end}
            AND COALESCE(p.due_date, p.start_date) >= ${start}
          ORDER BY COALESCE(p.start_date, p.due_date), p.name
        `));
        projects = rows.map((r) => {
          const total = num(r.total);
          const completed = num(r.completed);
          return {
            id: r.id, name: r.name, color: r.color || "#3b82f6", status: r.status,
            startDay: r.start_day ?? null, dueDay: r.due_day ?? null,
            pct: total > 0 ? Math.round((completed / total) * 100) : 0, completed, total, overdue: num(r.overdue),
            health: projectHealth({ status: r.status, dueDate: r.due_date ? new Date(r.due_date) : null, total, completed, overdueTasks: num(r.overdue) }),
          };
        });
        for (const p of projects) {
          const inRange = (d: string | null) => !!d && d >= range.from && d <= range.to;
          const late = p.status === "active" && !!p.dueDay && p.dueDay < today && p.health !== "completed";
          if (inRange(p.dueDay)) events.push({ type: "project", mark: "due", id: p.id, day: p.dueDay!, title: p.name, status: p.status, state: p.status === "completed" ? "done" : late ? "late" : "open", href: `/projects/${p.id}` });
          if (inRange(p.startDay) && p.startDay !== p.dueDay) events.push({ type: "project", mark: "start", id: p.id, day: p.startDay!, title: p.name, status: p.status, state: "open", href: `/projects/${p.id}` });
        }
      }

      events.sort((a, b) => a.day.localeCompare(b.day) || a.type.localeCompare(b.type) || a.title.localeCompare(b.title));
      res.json({ from: range.from, to: range.to, scope, today, events, projects });
    } catch (error) {
      console.error("Error loading the calendar:", error);
      res.status(500).json({ message: "Failed to load the calendar" });
    }
  });
}
