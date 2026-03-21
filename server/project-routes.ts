import type { Express, Request } from "express";
import { db } from "./db";
import { projects, tasks, users, clients, insertProjectSchema } from "@shared/schema";
import { eq, count, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "./auth";

interface MemberRow {
  project_id: string;
  user_id: string;
  role: string;
}

interface ProjectMemberInfo {
  userId: string;
  name: string;
  role: string;
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
    console.log("✅ Project migrations completed");
  } catch (err) {
    console.error("⚠️ Project migration error:", err);
  }
}

async function getMembersForProjects(projectIds: string[]): Promise<Map<string, ProjectMemberInfo[]>> {
  if (projectIds.length === 0) return new Map();

  const allUsers = await db.select({
    id: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    username: users.username,
  }).from(users);
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  const result = await db.execute(sql`
    SELECT project_id, user_id, role FROM project_members
    WHERE project_id = ANY(${projectIds})
  `);

  const memberMap = new Map<string, ProjectMemberInfo[]>();
  for (const row of result.rows as MemberRow[]) {
    const u = userMap.get(row.user_id);
    const name = u
      ? (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username ?? row.user_id)
      : row.user_id;
    if (!memberMap.has(row.project_id)) memberMap.set(row.project_id, []);
    memberMap.get(row.project_id)!.push({ userId: row.user_id, name, role: row.role });
  }
  return memberMap;
}

function getUserId(req: Request): string {
  const user = req.user;
  return user?.id ?? "";
}

export async function registerProjectRoutes(app: Express): Promise<void> {
  await runProjectMigrations();

  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const allProjects = await db.select().from(projects);
      const allClients = await db.select({ id: clients.id, name: clients.name }).from(clients);
      const clientMap = new Map(allClients.map(c => [c.id, c]));
      const membersMap = await getMembersForProjects(allProjects.map(p => p.id));

      const projectsWithCounts = await Promise.all(
        allProjects.map(async (project) => {
          const taskStats = await db
            .select({ status: tasks.status, count: count() })
            .from(tasks)
            .where(eq(tasks.projectId, project.id))
            .groupBy(tasks.status);

          const counts = { pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 };
          taskStats.forEach((stat) => {
            const status = stat.status as keyof typeof counts;
            if (status in counts) {
              counts[status] = Number(stat.count);
              counts.total += Number(stat.count);
            }
          });

          const client = project.clientId ? clientMap.get(project.clientId) : null;
          return {
            ...project,
            taskCounts: counts,
            clientName: client?.name ?? null,
            members: membersMap.get(project.id) ?? [],
          };
        })
      );

      res.json(projectsWithCounts);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const validatedData = projectInputSchema.parse(req.body);
      const userId = getUserId(req);

      const [newProject] = await db
        .insert(projects)
        .values({ ...validatedData, createdBy: userId })
        .returning();

      res.status(201).json({
        ...newProject,
        taskCounts: { pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 },
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

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
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

  app.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = projectInputSchema.partial().parse(req.body);

      const [updatedProject] = await db
        .update(projects)
        .set(validatedData)
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

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await db.update(tasks).set({ projectId: null }).where(eq(tasks.projectId, id));
      const [deletedProject] = await db.delete(projects).where(eq(projects.id, id)).returning();
      if (!deletedProject) return res.status(404).json({ message: "Project not found" });
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.post("/api/projects/:id/members", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const bodySchema = z.object({ userId: z.string(), role: z.enum(["lead", "member"]).default("member") });
      const { userId, role } = bodySchema.parse(req.body);

      const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id));
      if (!project) return res.status(404).json({ message: "Project not found" });

      await db.execute(sql`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (${id}, ${userId}, ${role})
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `);

      const [user] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username })
        .from(users)
        .where(eq(users.id, userId));

      const name = user
        ? (user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.username ?? userId)
        : userId;

      res.status(201).json({ userId, name, role } satisfies ProjectMemberInfo);
    } catch (error) {
      console.error("Error adding project member:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  app.delete("/api/projects/:id/members/:userId", requireAuth, async (req, res) => {
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
