import type { Express } from "express";
import { db } from "./db";
import { projects, tasks, users, insertProjectSchema } from "@shared/schema";
import { eq, count } from "drizzle-orm";
import { z } from "zod";

// Development auth middleware - matches task-management-routes.ts pattern
const devAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    req.user = { id: '8742bebf-9138-4247-85c8-fd2cb70e7d78', claims: { sub: '8742bebf-9138-4247-85c8-fd2cb70e7d78' } };
  }
  next();
};

export function registerProjectRoutes(app: Express) {
  // GET /api/projects — list all projects with task counts
  app.get("/api/projects", devAuth, async (req, res) => {
    try {
      const allProjects = await db.select().from(projects);
      
      const projectsWithCounts = await Promise.all(
        allProjects.map(async (project) => {
          const taskStats = await db
            .select({
              status: tasks.status,
              count: count(),
            })
            .from(tasks)
            .where(eq(tasks.projectId, project.id))
            .groupBy(tasks.status);

          const counts = {
            pending: 0,
            in_progress: 0,
            completed: 0,
            cancelled: 0,
            total: 0,
          };

          taskStats.forEach((stat) => {
            const status = stat.status as keyof typeof counts;
            if (status in counts) {
              counts[status] = Number(stat.count);
              counts.total += Number(stat.count);
            }
          });

          return {
            ...project,
            taskCounts: counts,
          };
        })
      );

      res.json(projectsWithCounts);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // POST /api/projects — create project
  app.post("/api/projects", devAuth, async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const userId = req.user?.claims?.sub || req.user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';

      const [newProject] = await db
        .insert(projects)
        .values({
          ...validatedData,
          createdBy: userId,
        })
        .returning();

      res.status(201).json(newProject);
    } catch (error) {
      console.error("Error creating project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // GET /api/projects/:id — get project details + tasks
  app.get("/api/projects/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id));

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const projectTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, id));

      // Get all users for assignee lookup (pattern from task-management-routes.ts)
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
                : assignee.username || task.assignedTo)
            : null,
        };
      });

      res.json({
        ...project,
        tasks: enrichedTasks,
      });
    } catch (error) {
      console.error("Error fetching project details:", error);
      res.status(500).json({ message: "Failed to fetch project details" });
    }
  });

  // PUT /api/projects/:id — update project
  app.put("/api/projects/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertProjectSchema.partial().parse(req.body);

      const [updatedProject] = await db
        .update(projects)
        .set(validatedData)
        .where(eq(projects.id, id))
        .returning();

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // DELETE /api/projects/:id
  app.delete("/api/projects/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // First set tasks.projectId = null for all tasks in project
      await db
        .update(tasks)
        .set({ projectId: null })
        .where(eq(tasks.projectId, id));

      // Then delete project
      const [deletedProject] = await db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning();

      if (!deletedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });
}
