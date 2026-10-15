import { z } from "zod";
import { and, eq, ilike, inArray, or, sql, desc } from "drizzle-orm";
import { db } from "../db";
import { clients, projectMembers, projects, tasks, users } from "@shared/schema";
import { notificationService } from "../notification-service";
import { logAudit } from "../audit";
import type { ToolDefinition, ToolResult } from "./protocol";

import { ToolError } from "./errors";
import { FINANCE_NEEDS, FINANCE_TOOLS, financeRunners, financeSchemas } from "./tools-finance";
import { nameSearchIds, pickByName, type Named } from "./names";
import { DEFAULT_PAGE, pageOf, pageProps } from "./paging";

export const INSTRUCTIONS =
  "Company task, project, client, quotation and invoice tools. Look people, projects and clients up with the list tools before using their ids; " +
  "a name is accepted too and must match exactly one record. Search before creating, so nothing is duplicated. Dates are YYYY-MM-DD. " +
  "Priorities are low, medium or high. Statuses are pending, in_progress, completed or cancelled. " +
  "Amounts are in EGP. Quotations and invoices are always created as drafts; a person issues or sends them in the app.";

const idProps = (kind: string) => ({
  [`${kind}Id`]: { type: "string", description: `${kind} id (from the list tools)` },
  [`${kind}Name`]: { type: "string", description: `${kind} name, used when no id is given; must match exactly one` },
});

export const TOOLS: ToolDefinition[] = [
  {
    name: "list_users", title: "List users",
    description: "List active people who can be assigned work. Optional search over name, username and email (spaces and Arabic spelling variants do not matter). Returns { total, hasMore, items }.",
    inputSchema: { type: "object", properties: { search: { type: "string" }, ...pageProps } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_projects", title: "List projects",
    description: "List projects with their status, dates and number of open tasks. The search matches names without regard to spaces, hyphens or case, so 'rose gold' finds 'rosegold'. Returns { total, hasMore, items }; read the next page with offset when hasMore is true.",
    inputSchema: { type: "object", properties: { search: { type: "string" }, status: { type: "string", enum: ["active", "on_hold", "completed", "archived"] }, ...pageProps } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_project", title: "Create project",
    description: "Open a new project.",
    inputSchema: {
      type: "object", required: ["name"],
      properties: {
        name: { type: "string" }, description: { type: "string" },
        status: { type: "string", enum: ["active", "on_hold"] },
        startDate: { type: "string", description: "YYYY-MM-DD" }, dueDate: { type: "string", description: "YYYY-MM-DD" },
        clientId: { type: "string" }, color: { type: "string", description: "#rrggbb" },
      },
    },
  },
  {
    name: "add_project_member", title: "Add project member",
    description: "Add a person to a project team (or change their role there).",
    inputSchema: { type: "object", properties: { ...idProps("project"), ...idProps("user"), role: { type: "string", enum: ["lead", "member"] } } },
  },
  {
    name: "list_tasks", title: "List tasks",
    description: "List tasks, newest first. Filter by assignee, project (by id or name), status or text; overdue=true keeps open tasks past their due date. Returns { total, hasMore, items }: say the total, and never total up numbers from a page when hasMore is true.",
    inputSchema: { type: "object", properties: { ...idProps("assignee"), ...idProps("project"), status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] }, search: { type: "string" }, overdue: { type: "boolean" }, ...pageProps } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_task", title: "Get task",
    description: "Read one task with its assignee and project.",
    inputSchema: { type: "object", required: ["taskId"], properties: { taskId: { type: "string" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_task", title: "Create task",
    description: "Create a task, optionally in a project and assigned to someone (who is notified).",
    inputSchema: {
      type: "object", required: ["title"],
      properties: {
        title: { type: "string" }, description: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        dueDate: { type: "string", description: "YYYY-MM-DD" },
        ...idProps("assignee"), ...idProps("project"),
      },
    },
  },
  {
    name: "assign_task", title: "Assign task",
    description: "Give a task to a person (replacing the current assignee). They are notified.",
    inputSchema: { type: "object", required: ["taskId"], properties: { taskId: { type: "string" }, ...idProps("assignee") } },
  },
  {
    name: "update_task", title: "Update task",
    description: "Change a task's status, priority, due date, title or description. An empty dueDate clears the date.",
    inputSchema: {
      type: "object", required: ["taskId"],
      properties: {
        taskId: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        dueDate: { type: "string", description: "YYYY-MM-DD, or empty to clear" },
        title: { type: "string" }, description: { type: "string" },
      },
    },
  },
  ...FINANCE_TOOLS,
];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");
const toDate = (d: string) => {
  const date = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new ToolError(`Invalid date: ${d}`);
  return date;
};
const opt = <T extends z.ZodTypeAny>(s: T) => s.optional();
const priority = z.enum(["low", "medium", "high"]);
const status = z.enum(["pending", "in_progress", "completed", "cancelled"]);

const schemas: Record<string, z.ZodTypeAny> = {
  ...financeSchemas,
  list_users: z.object({ search: opt(z.string()), limit: opt(z.number().int().min(1).max(100)), offset: opt(z.number().int().min(0)) }),
  list_projects: z.object({ search: opt(z.string()), status: opt(z.enum(["active", "on_hold", "completed", "archived"])), limit: opt(z.number().int().min(1).max(100)), offset: opt(z.number().int().min(0)) }),
  create_project: z.object({ name: z.string().trim().min(1), description: opt(z.string()), status: opt(z.enum(["active", "on_hold"])), startDate: opt(day), dueDate: opt(day), clientId: opt(z.string()), color: opt(z.string().regex(/^#[0-9a-fA-F]{6}$/)) }),
  add_project_member: z.object({ projectId: opt(z.string()), projectName: opt(z.string()), userId: opt(z.string()), userName: opt(z.string()), role: opt(z.enum(["lead", "member"])) }),
  list_tasks: z.object({ assigneeId: opt(z.string()), assigneeName: opt(z.string()), projectId: opt(z.string()), projectName: opt(z.string()), status: opt(status), search: opt(z.string()), overdue: opt(z.boolean()), limit: opt(z.number().int().min(1).max(100)), offset: opt(z.number().int().min(0)) }),
  get_task: z.object({ taskId: z.string().min(1) }),
  create_task: z.object({ title: z.string().trim().min(1), description: opt(z.string()), priority: opt(priority), dueDate: opt(day), assigneeId: opt(z.string()), assigneeName: opt(z.string()), projectId: opt(z.string()), projectName: opt(z.string()) }),
  assign_task: z.object({ taskId: z.string().min(1), assigneeId: opt(z.string()), assigneeName: opt(z.string()) }),
  update_task: z.object({ taskId: z.string().min(1), status: opt(status), priority: opt(priority), dueDate: opt(z.union([day, z.literal("")])), title: opt(z.string().trim().min(1)), description: opt(z.string()) }),
};

const NEEDS: Record<string, [string, string]> = {
  ...FINANCE_NEEDS,
  list_users: ["tasks", "view"], list_projects: ["projects", "view"], create_project: ["projects", "add"], add_project_member: ["projects", "edit"],
  list_tasks: ["tasks", "view"], get_task: ["tasks", "view"], create_task: ["tasks", "add"], assign_task: ["tasks", "edit"], update_task: ["tasks", "edit"],
};

const fullName = (u: { firstName?: string | null; lastName?: string | null; username?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "";

const like = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// A person by id, or by name when exactly one active user matches; otherwise the candidates are listed so the model can choose
export async function resolveUser(id?: string, name?: string): Promise<{ id: string; name: string } | null> {
  if (!id && !name) return null;
  if (id) {
    const [u] = await db.select().from(users).where(and(eq(users.id, id), eq(users.isActive, true)));
    if (!u) throw new ToolError(`No active user with id ${id}. Use list_users to find the right person.`);
    return { id: u.id, name: fullName(u) };
  }
  const q = name!.trim();
  const all = await db.select().from(users).where(eq(users.isActive, true));
  const rows: Named[] = all.filter((u) => u.username !== "ai-assistant").map((u) => ({ id: u.id, label: fullName(u), keys: [fullName(u), u.username, u.email ?? "", u.firstName ?? "", u.lastName ?? ""].filter(Boolean) }));
  const found = pickByName(q, rows, "people", { none: "Use list_users to see who is available.", singular: "person" });
  if ("error" in found) throw new ToolError(found.error);
  return { id: found.picked.id, name: found.picked.label };
}

export async function resolveProject(id?: string, name?: string): Promise<{ id: string; name: string } | null> {
  if (!id && !name) return null;
  if (id) {
    const [p] = await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, id));
    if (!p) throw new ToolError(`No project with id ${id}. Use list_projects to find it.`);
    return p;
  }
  const q = name!.trim();
  const all = await db.select({ id: projects.id, name: projects.name }).from(projects);
  const found = pickByName(q, all.map((p) => ({ id: p.id, label: p.name, keys: [p.name] })), "projects", { none: "Use list_projects to see them." });
  if ("error" in found) throw new ToolError(found.error);
  return { id: found.picked.id, name: found.picked.label };
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function taskView(taskId: string) {
  const [row] = await db
    .select({ t: tasks, assigneeFirst: users.firstName, assigneeLast: users.lastName, assigneeUsername: users.username, projectName: projects.name })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assignedTo))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId));
  if (!row) throw new ToolError(`No task with id ${taskId}.`);
  return {
    id: row.t.id, title: row.t.title, description: row.t.description, status: row.t.status, priority: row.t.priority,
    dueDate: iso(row.t.dueDate), completedDate: iso(row.t.completedDate),
    assignee: row.t.assignedTo ? { id: row.t.assignedTo, name: fullName({ firstName: row.assigneeFirst, lastName: row.assigneeLast, username: row.assigneeUsername }) } : null,
    project: row.t.projectId ? { id: row.t.projectId, name: row.projectName } : null,
  };
}

async function notifyAssigned(taskId: string, assigneeId: string, byUserId: string, title: string) {
  if (assigneeId === byUserId) return;
  try { await notificationService.notifyTaskAssigned(taskId, assigneeId, byUserId, title); }
  catch (error) { console.error("MCP: task assignment notification failed:", error); }
}

type Runner = (args: any, ctx: { userId: string; actor?: string }) => Promise<unknown>;

const RUNNERS: Record<string, Runner> = {
  ...financeRunners,
  async list_users({ search, limit = DEFAULT_PAGE, offset = 0 }) {
    const all = (await db.select().from(users).where(eq(users.isActive, true))).filter((u) => u.username !== "ai-assistant");
    let people = all;
    if (search) {
      const ids = new Set(nameSearchIds(search, all.map((u) => ({ id: u.id, label: fullName(u), keys: [fullName(u), u.username, u.email ?? "", u.firstName ?? "", u.lastName ?? ""].filter(Boolean) }))));
      people = all.filter((u) => ids.has(u.id));
    }
    return pageOf(people.length, people.slice(offset, offset + limit).map((u) => ({ id: u.id, name: fullName(u), username: u.username, role: u.role })), offset);
  },

  async list_projects({ search, status: st, limit = DEFAULT_PAGE, offset = 0 }) {
    // The text is compared without regard to spaces, hyphens, case or Arabic spelling variants
    const named = search ? nameSearchIds(search, (await db.select({ id: projects.id, name: projects.name }).from(projects)).map((p) => ({ id: p.id, label: p.name, keys: [p.name] }))) : null;
    const where = and(named ? (named.length ? inArray(projects.id, named) : sql`false`) : undefined, st ? eq(projects.status, st) : undefined);
    const [{ n }] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(projects).where(where);
    const rows = await db.select().from(projects).where(where).orderBy(desc(projects.createdAt)).limit(limit).offset(offset);
    const ids = rows.map((p) => p.id);
    const open = ids.length
      ? await db.select({ projectId: tasks.projectId, n: sql<number>`COUNT(*)::int` }).from(tasks).where(and(inArray(tasks.projectId, ids), inArray(tasks.status, ["pending", "in_progress"]))).groupBy(tasks.projectId)
      : [];
    const openBy = new Map(open.map((o) => [o.projectId, Number(o.n)]));
    return pageOf(Number(n), rows.map((p) => ({ id: p.id, name: p.name, status: p.status, startDate: iso(p.startDate), dueDate: iso(p.dueDate), openTasks: openBy.get(p.id) ?? 0 })), offset);
  },

  async create_project(a, { userId }) {
    if (a.clientId) {
      const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, a.clientId));
      if (!c) throw new ToolError(`No client with id ${a.clientId}.`);
    }
    const [p] = await db.insert(projects).values({
      name: a.name, description: a.description ?? null, status: a.status ?? "active", color: a.color ?? "#3b82f6",
      clientId: a.clientId ?? null, startDate: a.startDate ? toDate(a.startDate) : null, dueDate: a.dueDate ? toDate(a.dueDate) : null, createdBy: userId,
    }).returning();
    return { id: p.id, name: p.name, status: p.status, startDate: iso(p.startDate), dueDate: iso(p.dueDate) };
  },

  async add_project_member(a) {
    const project = await resolveProject(a.projectId, a.projectName);
    const user = await resolveUser(a.userId, a.userName);
    if (!project) throw new ToolError("Give projectId or projectName.");
    if (!user) throw new ToolError("Give userId or userName.");
    await db.insert(projectMembers).values({ projectId: project.id, userId: user.id, role: a.role ?? "member" })
      .onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.userId], set: { role: a.role ?? "member" } });
    return { project, user, role: a.role ?? "member" };
  },

  async list_tasks(a) {
    const assignee = await resolveUser(a.assigneeId, a.assigneeName);
    const project = await resolveProject(a.projectId, a.projectName);
    const conds = [
      assignee ? eq(tasks.assignedTo, assignee.id) : undefined,
      project ? eq(tasks.projectId, project.id) : undefined,
      a.status ? eq(tasks.status, a.status) : undefined,
      a.search ? or(ilike(tasks.title, like(a.search)), ilike(tasks.description, like(a.search))) : undefined,
      a.overdue ? sql`${tasks.status} IN ('pending','in_progress') AND ${tasks.dueDate} < date_trunc('day', now())` : undefined,
    ];
    const where = and(...conds);
    const [{ n }] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(tasks).where(where);
    const rows = await db
      .select({ t: tasks, first: users.firstName, last: users.lastName, username: users.username, projectName: projects.name })
      .from(tasks).leftJoin(users, eq(users.id, tasks.assignedTo)).leftJoin(projects, eq(projects.id, tasks.projectId))
      .where(where).orderBy(desc(tasks.createdAt)).limit(a.limit ?? DEFAULT_PAGE).offset(a.offset ?? 0);
    return pageOf(Number(n), rows.map((r) => ({
      id: r.t.id, title: r.t.title, status: r.t.status, priority: r.t.priority, dueDate: iso(r.t.dueDate),
      assignee: r.t.assignedTo ? fullName({ firstName: r.first, lastName: r.last, username: r.username }) : null,
      project: r.projectName ?? null,
    })), a.offset ?? 0);
  },

  async get_task({ taskId }) { return taskView(taskId); },

  async create_task(a, { userId }) {
    const assignee = await resolveUser(a.assigneeId, a.assigneeName);
    const project = await resolveProject(a.projectId, a.projectName);
    const [t] = await db.insert(tasks).values({
      title: a.title, description: a.description ?? null, priority: a.priority ?? "medium", status: "pending",
      dueDate: a.dueDate ? toDate(a.dueDate) : null, assignedTo: assignee?.id ?? null, projectId: project?.id ?? null, createdBy: userId,
    }).returning();
    if (assignee) await notifyAssigned(t.id, assignee.id, userId, t.title);
    return taskView(t.id);
  },

  async assign_task(a, { userId }) {
    const assignee = await resolveUser(a.assigneeId, a.assigneeName);
    if (!assignee) throw new ToolError("Give assigneeId or assigneeName.");
    const [t] = await db.update(tasks).set({ assignedTo: assignee.id, updatedAt: new Date() }).where(eq(tasks.id, a.taskId)).returning();
    if (!t) throw new ToolError(`No task with id ${a.taskId}.`);
    await notifyAssigned(t.id, assignee.id, userId, t.title);
    return taskView(t.id);
  },

  async update_task(a) {
    const [current] = await db.select().from(tasks).where(eq(tasks.id, a.taskId));
    if (!current) throw new ToolError(`No task with id ${a.taskId}.`);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (a.title !== undefined) set.title = a.title;
    if (a.description !== undefined) set.description = a.description;
    if (a.priority !== undefined) set.priority = a.priority;
    if (a.dueDate !== undefined) set.dueDate = a.dueDate === "" ? null : toDate(a.dueDate);
    if (a.status !== undefined) {
      set.status = a.status;
      // Same rule as the app: completing stamps the date, moving away from completed clears it
      if (a.status === "completed" && current.status !== "completed") set.completedDate = new Date();
      if (a.status !== "completed" && current.completedDate) set.completedDate = null;
    }
    await db.update(tasks).set(set).where(eq(tasks.id, a.taskId));
    return taskView(a.taskId);
  },
};

export function createToolkit(req: any, opts: { source?: string } = {}) {
  const user = req.user;
  const can = (module: string, action: string) => user?.permissions?.[module]?.[action] === true;

  async function callTool(name: string, rawArgs: unknown): Promise<ToolResult> {
    const text = (value: unknown, isError = false): ToolResult => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }], ...(isError ? { isError: true } : {}) });
    const run = RUNNERS[name];
    const schema = schemas[name];
    const [module, action] = NEEDS[name];
    if (!run || !schema) return text(`Unknown tool: ${name}`, true);
    if (!can(module, action)) return text(`Permission denied: this account cannot ${action} ${module}. An administrator can change that in Team & Roles.`, true);

    const parsed = schema.safeParse(rawArgs ?? {});
    if (!parsed.success) return text(`Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`, true);

    try {
      const result = await run(parsed.data, { userId: user.id, actor: user.email || user.username });
      await logAudit(req, `${opts.source ?? "mcp"}:${name}`, "mcp", (result as any)?.id ?? null, null, parsed.data);
      return text(result);
    } catch (error) {
      if (error instanceof ToolError) return text(error.message, true);
      console.error(`MCP tool ${name} failed:`, error);
      return text("The action failed. Nothing was changed, or the change could not be confirmed; check with the get or list tools before retrying.", true);
    }
  }

  return { knownToolNames: TOOLS.map((t) => t.name), tools: TOOLS.filter((t) => { const [m, a] = NEEDS[t.name]; return can(m, a); }), callTool };
}
