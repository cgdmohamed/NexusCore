import type { Express, Request } from "express";
import { db } from "./db";
import { projects, tasks, users, clients, expenses, insertProjectSchema } from "@shared/schema";
import { eq, count, sql, and, isNull, ne, inArray } from "drizzle-orm";
import { projectHealth, startOfDay } from "./project-health";
import { buildBurndown } from "./burndown";
import { z } from "zod";
import { requirePermission } from "./auth";
import { logger } from "./logger";

interface ProjectMemberInfo {
  userId: string;
  name: string;
  role: string;
}

interface MemberJoinRow {
  project_id: string;
  user_id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}

const projectInputSchema = insertProjectSchema.extend({
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

async function runProjectMigrations(): Promise<void> {
  try {
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='start_date') THEN
          ALTER TABLE projects ADD COLUMN start_date TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='due_date') THEN
          ALTER TABLE projects ADD COLUMN due_date TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='budget') THEN
          ALTER TABLE projects ADD COLUMN budget NUMERIC;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='completed_at') THEN
          ALTER TABLE projects ADD COLUMN completed_at TIMESTAMP;
        END IF;
      END $$;
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_members (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR NOT NULL DEFAULT 'member',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(project_id, user_id)
      );
    `);
    logger.info("✅ Project migrations completed");
  } catch (err) {
    console.error("⚠️ Project migrations failed (non-fatal):", err);
  }
}

async function getMembersForProjects(projectIds: string[]): Promise<Map<string, ProjectMemberInfo[]>> {
  if (projectIds.length === 0) return new Map();

  try {
    const idList = sql.join(projectIds.map(id => sql`${id}`), sql`, `);
    const result = await db.execute(sql`
      SELECT pm.project_id, pm.user_id, pm.role,
             u.first_name, u.last_name, u.username
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id IN (${idList})
    `);

    const memberMap = new Map<string, ProjectMemberInfo[]>();
    for (const row of result.rows as unknown as MemberJoinRow[]) {
      const name = row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}`
        : row.username ?? row.user_id;
      if (!memberMap.has(row.project_id)) memberMap.set(row.project_id, []);
      memberMap.get(row.project_id)!.push({ userId: row.user_id, name, role: row.role });
    }
    return memberMap;
  } catch (err) {
    console.error("⚠️ getMembersForProjects failed (non-fatal):", err);
    return new Map();
  }
}

function getUserId(req: Request): string {
  const user = req.user as (Express.User & { claims?: { sub?: string } }) | undefined;
  return user?.claims?.sub ?? user?.id ?? "";
}

export async function registerProjectRoutes(app: Express): Promise<void> {
  await runProjectMigrations();

  app.get("/api/projects", requirePermission("projects", "view"), async (req, res) => {
    try {
      // Newest first inside each status; the page sorts further for its own views
      const allProjects = await db.select().from(projects).orderBy(sql`${projects.createdAt} DESC NULLS LAST, ${projects.name}`);
      const ids = allProjects.map((p) => p.id);
      const allClients = await db.select({ id: clients.id, name: clients.name }).from(clients);
      const clientMap = new Map(allClients.map(c => [c.id, c]));
      const membersMap = await getMembersForProjects(ids);

      // One query each for task counts, late tasks and spend, instead of one set per project
      const taskStats = ids.length
        ? await db.select({ projectId: tasks.projectId, status: tasks.status, count: count() })
            .from(tasks).where(inArray(tasks.projectId, ids)).groupBy(tasks.projectId, tasks.status)
        : [];
      const lateStats = ids.length
        ? await db.select({ projectId: tasks.projectId, count: count() })
            .from(tasks)
            .where(and(inArray(tasks.projectId, ids), inArray(tasks.status, ["pending", "in_progress"]), sql`${tasks.dueDate} < ${startOfDay(new Date())}`))
            .groupBy(tasks.projectId)
        : [];
      const spendStats = ids.length
        ? await db.select({ projectId: expenses.relatedProjectId, total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
            .from(expenses)
            .where(and(inArray(expenses.relatedProjectId, ids), ne(expenses.status, "cancelled"), isNull(expenses.rejectedAt)))
            .groupBy(expenses.relatedProjectId)
        : [];

      const countsByProject = new Map<string, { pending: number; in_progress: number; completed: number; cancelled: number; total: number }>();
      for (const stat of taskStats) {
        if (!stat.projectId) continue;
        const counts = countsByProject.get(stat.projectId) ?? { pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 };
        const status = stat.status as keyof typeof counts;
        if (status in counts && status !== "total") {
          counts[status] = Number(stat.count);
          if (status !== "cancelled") counts.total += Number(stat.count);
        }
        countsByProject.set(stat.projectId, counts);
      }
      const lateByProject = new Map(lateStats.map((r) => [r.projectId, Number(r.count)]));
      const spendByProject = new Map(spendStats.map((r) => [r.projectId, parseFloat(r.total || "0")]));

      const projectsWithCounts = allProjects.map((project) => {
        const counts = countsByProject.get(project.id) ?? { pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 };
        const overdueTasks = lateByProject.get(project.id) ?? 0;
        const client = project.clientId ? clientMap.get(project.clientId) : null;
        return {
          ...project,
          taskCounts: counts,
          overdueTasks,
          spent: spendByProject.get(project.id) ?? 0,
          health: projectHealth({ status: project.status, dueDate: project.dueDate, total: counts.total, completed: counts.completed, overdueTasks }),
          clientName: client?.name ?? null,
          members: membersMap.get(project.id) ?? [],
        };
      });

      res.json(projectsWithCounts);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", requirePermission("projects", "add"), async (req, res) => {
    try {
      const { completedAt: _ignoredInput, ...rawBody } = req.body ?? {};
      const validatedData = projectInputSchema.parse(rawBody);
      const userId = getUserId(req);

      const [newProject] = await db
        .insert(projects)
        .values({ ...validatedData, completedAt: validatedData.status === "completed" ? new Date() : null, createdBy: userId })
        .returning();

      res.status(201).json({
        ...newProject,
        taskCounts: { pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 },
        overdueTasks: 0,
        spent: 0,
        health: projectHealth({ status: newProject.status, dueDate: newProject.dueDate, total: 0, completed: 0, overdueTasks: 0 }),
        clientName: null,
        members: [],
      });
    } catch (error) {
      console.error("Error creating project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // The open project whose deadline is nearest: upcoming first, otherwise the one that slipped most recently.
  // Registered before /api/projects/:id so "burndown" is not read as an id.
  app.get("/api/projects/burndown/nearest", requirePermission("projects", "view"), async (_req, res) => {
    try {
      const open = await db.select().from(projects)
        .where(and(eq(projects.status, "active"), isNull(projects.completedAt), sql`${projects.dueDate} IS NOT NULL`));
      const today = startOfDay(new Date());
      const upcoming = open.filter((p) => p.dueDate! >= today).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
      const late = open.filter((p) => p.dueDate! < today).sort((a, b) => b.dueDate!.getTime() - a.dueDate!.getTime());

      for (const project of [...upcoming, ...late]) {
        const projectTasks = await db.select({ createdAt: tasks.createdAt, completedDate: tasks.completedDate, status: tasks.status })
          .from(tasks).where(eq(tasks.projectId, project.id));
        const burndown = buildBurndown({
          tasks: projectTasks,
          startDate: project.startDate ?? project.createdAt ?? new Date(),
          dueDate: project.dueDate!,
        });
        if (burndown) return res.json({ project: { id: project.id, name: project.name }, burndown });
      }
      res.json({ project: null, burndown: null });
    } catch (error) {
      logger.error("Error building project burndown:", error);
      res.status(500).json({ message: "Failed to build burndown" });
    }
  });

  app.get("/api/projects/:id", requirePermission("projects", "view"), async (req, res) => {
    try {
      const { id } = req.params;
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      if (!project) return res.status(404).json({ message: "Project not found" });

      const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, id));
      const allUsers = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
      }).from(users);
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const enrichedTasks = projectTasks.map(task => {
        const assignee = task.assignedTo ? userMap.get(task.assignedTo) : null;
        return {
          ...task,
          assigneeName: assignee
            ? (assignee.firstName && assignee.lastName
                ? `${assignee.firstName} ${assignee.lastName}`
                : assignee.username ?? task.assignedTo)
            : null,
        };
      });

      let clientName: string | null = null;
      if (project.clientId) {
        const [client] = await db
          .select({ id: clients.id, name: clients.name })
          .from(clients)
          .where(eq(clients.id, project.clientId));
        clientName = client?.name ?? null;
      }

      const membersMap = await getMembersForProjects([id]);

      res.json({ ...project, tasks: enrichedTasks, clientName, members: membersMap.get(id) ?? [] });
    } catch (error) {
      console.error("Error fetching project details:", error);
      res.status(500).json({ message: "Failed to fetch project details" });
    }
  });

  app.put("/api/projects/:id", requirePermission("projects", "edit"), async (req, res) => {
    try {
      const { id } = req.params;
      // completedAt is never taken from the client: it follows the status change below
      const { completedAt: _ignoredInput, ...rawBody } = req.body ?? {};
      const validatedData = projectInputSchema.partial().parse(rawBody);

      const [current] = await db.select({ status: projects.status }).from(projects).where(eq(projects.id, id));
      if (!current) return res.status(404).json({ message: "Project not found" });

      const changes: Record<string, unknown> = { ...validatedData };
      if (validatedData.status && validatedData.status !== current.status) {
        if (validatedData.status === "completed") changes.completedAt = new Date();
        else if (current.status === "completed") changes.completedAt = null;
      }

      const [updatedProject] = await db
        .update(projects)
        .set(changes)
        .where(eq(projects.id, id))
        .returning();

      if (!updatedProject) return res.status(404).json({ message: "Project not found" });
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", requirePermission("projects", "delete"), async (req, res) => {
    try {
      const { id } = req.params;
      // A project that has history is archived, not deleted: its tasks and spend would lose their context
      const [taskRow] = await db.select({ n: count() }).from(tasks).where(eq(tasks.projectId, id));
      const [expenseRow] = await db.select({ n: count() }).from(expenses).where(eq(expenses.relatedProjectId, id));
      if (Number(taskRow?.n ?? 0) > 0 || Number(expenseRow?.n ?? 0) > 0) {
        return res.status(409).json({ message: "This project has tasks or expenses. Archive it instead of deleting it." });
      }
      const [deletedProject] = await db.delete(projects).where(eq(projects.id, id)).returning();
      if (!deletedProject) return res.status(404).json({ message: "Project not found" });
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.post("/api/projects/:id/members", requirePermission("projects", "edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const bodySchema = z.object({ userId: z.string(), role: z.enum(["lead", "member"]).default("member") });
      const { userId, role } = bodySchema.parse(req.body);

      const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id));
      if (!project) return res.status(404).json({ message: "Project not found" });

      const [user] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username })
        .from(users)
        .where(eq(users.id, userId));
      if (!user) return res.status(400).json({ message: "User not found" });

      await db.execute(sql`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (${id}, ${userId}, ${role})
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `);

      const name = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.username ?? userId;

      res.status(201).json({ userId, name, role } satisfies ProjectMemberInfo);
    } catch (error) {
      console.error("Error adding project member:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  app.delete("/api/projects/:id/members/:userId", requirePermission("projects", "edit"), async (req, res) => {
    try {
      const { id, userId } = req.params;
      await db.execute(sql`
        DELETE FROM project_members WHERE project_id = ${id} AND user_id = ${userId}
      `);
      res.json({ message: "Member removed" });
    } catch (error) {
      console.error("Error removing project member:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });
}
