import type { Express } from "express";
import { db, badRequestFromDbError } from "./db";
import { 
  tasks, 
  taskComments, 
  taskDependencies, 
  taskActivityLog,
  users,
  employees
} from "@shared/schema";
import { eq, desc, asc, and, gte, lte, count, sql, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { notificationService } from "./notification-service";
import { requirePermission } from "./auth";

// Task creation schema - simplified for existing database
const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
  projectId: z.string().optional().nullable(),
});

// Comment creation schema
const createCommentSchema = z.object({
  comment: z.string().min(1, "Comment is required"),
  attachments: z.array(z.string()).optional(),
});

export function registerTaskManagementRoutes(app: Express) {
  
  // Get all tasks with advanced filtering
  app.get("/api/tasks", requirePermission("tasks", "view"), async (req, res) => {
    try {
      const { status, priority, assignedTo, createdBy, search, sortOrder, myTasks } = req.query;

      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // Pagination: default 50 rows, at most 200, never negative
      const requestedLimit = parseInt(req.query.limit as string, 10);
      const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 200) : 50;
      const requestedOffset = parseInt(req.query.offset as string, 10);
      const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;

      // Filters are applied by the database, so only the requested page is ever loaded
      const conditions = [];
      if (typeof status === "string" && status) conditions.push(eq(tasks.status, status));
      if (typeof priority === "string" && priority) conditions.push(eq(tasks.priority, priority));
      if (typeof assignedTo === "string" && assignedTo) conditions.push(eq(tasks.assignedTo, assignedTo));
      if (typeof createdBy === "string" && createdBy) conditions.push(eq(tasks.createdBy, createdBy));
      if (myTasks === "true") conditions.push(eq(tasks.assignedTo, userId));
      if (typeof search === "string" && search.trim()) {
        // LIKE wildcards in the user's text are matched literally
        const pattern = `%${search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        conditions.push(or(ilike(tasks.title, pattern), ilike(tasks.description, pattern)));
      }

      const direction = sortOrder === "asc" ? asc : desc;
      const rows = await db
        .select({
          task: tasks,
          assigneeFirstName: users.firstName,
          assigneeLastName: users.lastName,
          assigneeUsername: users.username,
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assignedTo, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(direction(tasks.createdAt), direction(tasks.id))
        .limit(limit)
        .offset(offset);

      res.json(
        rows.map(({ task, assigneeFirstName, assigneeLastName, assigneeUsername }) => ({
          ...task,
          assigneeName: task.assignedTo
            ? assigneeFirstName && assigneeLastName
              ? `${assigneeFirstName} ${assigneeLastName}`
              : assigneeUsername || task.assignedTo
            : null,
        })),
      );
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get task statistics for dashboard
  app.get("/api/tasks/stats", requirePermission("tasks", "view"), async (req, res) => {
    try {
      const { assignedTo } = req.query;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      let baseConditions = [];
      
      // If requesting personal stats
      if (assignedTo === 'me') {
        baseConditions.push(eq(tasks.assignedTo, userId));
      } else if (assignedTo) {
        baseConditions.push(eq(tasks.assignedTo, assignedTo as string));
      }

      // Get task counts by status
      const statusCounts = await db
        .select({
          status: tasks.status,
          count: count()
        })
        .from(tasks)
        .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
        .groupBy(tasks.status);

      // Get priority distribution
      const priorityCounts = await db
        .select({
          priority: tasks.priority,
          count: count()
        })
        .from(tasks)
        .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
        .groupBy(tasks.priority);

      // Get overdue tasks count
      const overdueTasks = await db
        .select({ count: count() })
        .from(tasks)
        .where(
          baseConditions.length > 0 
            ? and(...baseConditions, sql`${tasks.dueDate} < NOW() AND ${tasks.status} != 'completed'`)
            : sql`${tasks.dueDate} < NOW() AND ${tasks.status} != 'completed'`
        );

      // Get completed this month
      const completedThisMonth = await db
        .select({ count: count() })
        .from(tasks)
        .where(
          baseConditions.length > 0 
            ? and(
                ...baseConditions,
                eq(tasks.status, 'completed'),
                sql`${tasks.completedDate} >= date_trunc('month', CURRENT_DATE)`
              )
            : and(
                eq(tasks.status, 'completed'),
                sql`${tasks.completedDate} >= date_trunc('month', CURRENT_DATE)`
              )
        );

      // Simple task counts for basic stats
      const totalTasks = await db
        .select({ count: count() })
        .from(tasks)
        .where(baseConditions.length > 0 ? and(...baseConditions) : undefined);

      res.json({
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {} as Record<string, number>),
        priorityBreakdown: priorityCounts.reduce((acc, item) => {
          acc[item.priority] = item.count;
          return acc;
        }, {} as Record<string, number>),
        overdueTasks: overdueTasks[0]?.count || 0,
        completedThisMonth: completedThisMonth[0]?.count || 0,
        totalTasks: totalTasks[0]?.count || 0,
      });
    } catch (error) {
      console.error("Error fetching task stats:", error);
      res.status(500).json({ message: "Failed to fetch task statistics" });
    }
  });

  // Get task performance metrics
  app.get("/api/tasks/performance", requirePermission("tasks", "view"), async (req, res) => {
    try {
      const { assignedTo, startDate, endDate } = req.query;

      let conditions = [];
      
      if (assignedTo) {
        conditions.push(eq(tasks.assignedTo, assignedTo as string));
      }

      if (startDate) {
        conditions.push(gte(tasks.createdAt, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(tasks.createdAt, new Date(endDate as string)));
      }

      // Get completion metrics
      const completionMetrics = await db
        .select({
          total: count(),
          completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
          onTime: sql<number>`SUM(CASE WHEN status = 'completed' AND completed_date <= due_date THEN 1 ELSE 0 END)`,
          overdue: sql<number>`SUM(CASE WHEN due_date < NOW() AND status != 'completed' THEN 1 ELSE 0 END)`,
        })
        .from(tasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Get average completion time
      const avgCompletionTime = await db
        .select({
          avgDays: sql<number>`AVG(EXTRACT(DAY FROM completed_date - created_at))`
        })
        .from(tasks)
        .where(
          conditions.length > 0 
            ? and(...conditions, eq(tasks.status, 'completed'))
            : eq(tasks.status, 'completed')
        );

      // Get priority distribution
      const priorityDistribution = await db
        .select({
          priority: tasks.priority,
          count: count(),
          completedCount: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        })
        .from(tasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(tasks.priority);

      const metrics = completionMetrics[0];
      const completionRate = metrics.total > 0 ? (metrics.completed / metrics.total) * 100 : 0;
      const onTimeRate = metrics.completed > 0 ? (metrics.onTime / metrics.completed) * 100 : 0;

      res.json({
        totalTasks: metrics.total,
        completedTasks: metrics.completed,
        overdueTasks: metrics.overdue,
        completionRate: Math.round(completionRate * 100) / 100,
        onTimeCompletionRate: Math.round(onTimeRate * 100) / 100,
        averageCompletionDays: Math.round((avgCompletionTime[0]?.avgDays || 0) * 100) / 100,
        priorityDistribution: priorityDistribution.map(p => ({
          priority: p.priority,
          total: p.count,
          completed: p.completedCount,
          completionRate: p.count > 0 ? Math.round((p.completedCount / p.count) * 10000) / 100 : 0,
        })),
      });
    } catch (error) {
      console.error("Error fetching task performance:", error);
      res.status(500).json({ message: "Failed to fetch task performance metrics" });
    }
  });

  // Get single task with full details
  app.get("/api/tasks/:id", requirePermission("tasks", "view"), async (req, res) => {
    try {
      const { id } = req.params;

      const [task] = await db
        .select({
          task: tasks,
          assignedToUser: {
            id: users.id,
            email: users.email,
          },
          assignedToEmployee: {
            firstName: employees.firstName,
            lastName: employees.lastName,
            jobTitle: employees.jobTitle,
          },
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assignedTo, users.id))
        .leftJoin(employees, eq(users.employeeId, employees.id))
        .where(eq(tasks.id, id));

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Get task comments
      const comments = await db
        .select({
          comment: taskComments,
          user: {
            id: users.id,
            email: users.email,
          },
          employee: {
            firstName: employees.firstName,
            lastName: employees.lastName,
          }
        })
        .from(taskComments)
        .leftJoin(users, eq(taskComments.createdBy, users.id))
        .leftJoin(employees, eq(users.employeeId, employees.id))
        .where(eq(taskComments.taskId, id))
        .orderBy(desc(taskComments.createdAt));

      // Get task dependencies
      const dependencies = await db
        .select({
          dependency: taskDependencies,
          dependentTask: {
            id: tasks.id,
            title: tasks.title,
            status: tasks.status,
          }
        })
        .from(taskDependencies)
        .leftJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
        .where(eq(taskDependencies.taskId, id));

      // Get activity log
      const activityLog = await db
        .select({
          log: taskActivityLog,
          user: {
            id: users.id,
            email: users.email,
          },
          employee: {
            firstName: employees.firstName,
            lastName: employees.lastName,
          }
        })
        .from(taskActivityLog)
        .leftJoin(users, eq(taskActivityLog.createdBy, users.id))
        .leftJoin(employees, eq(users.employeeId, employees.id))
        .where(eq(taskActivityLog.taskId, id))
        .orderBy(desc(taskActivityLog.createdAt))
        .limit(20);

      res.json({
        ...task.task,
        assignedToUser: task.assignedToUser,
        assignedToEmployee: task.assignedToEmployee,
        comments: comments.map(c => ({
          ...c.comment,
          user: c.user,
          employee: c.employee,
        })),
        dependencies: dependencies.map(d => ({
          ...d.dependency,
          dependentTask: d.dependentTask,
        })),
        activityLog: activityLog.map(a => ({
          ...a.log,
          user: a.user,
          employee: a.employee,
        })),
      });
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Create new task
  app.post("/api/tasks", requirePermission("tasks", "add"), async (req, res) => {
    try {
      const validatedData = createTaskSchema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const taskData = {
        title: validatedData.title,
        description: validatedData.description || null,
        priority: validatedData.priority,
        status: validatedData.status,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        assignedTo: validatedData.assignedTo || null,
        projectId: validatedData.projectId || null,
        createdBy: userId,
      };

      const [newTask] = await db
        .insert(tasks)
        .values(taskData)
        .returning();

      // Send email notification if task is assigned to someone
      if (newTask.assignedTo && newTask.assignedTo !== userId) {
        try {
          await notificationService.notifyTaskAssigned(
            newTask.id,
            newTask.assignedTo,
            userId,
            newTask.title
          );
        } catch (notifyError) {
          console.error("Failed to send task assignment notification:", notifyError);
        }
      }

      res.status(201).json(newTask);
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      const badRequest = badRequestFromDbError(error);
      if (badRequest) return res.status(400).json({ message: badRequest });
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Update task
  app.put("/api/tasks/:id", requirePermission("tasks", "edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = createTaskSchema.partial().parse(req.body);
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // Get current task for activity logging
      const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (!currentTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      const updateData: any = {};
      if (validatedData.title) updateData.title = validatedData.title;
      if (validatedData.description !== undefined) updateData.description = validatedData.description;
      if (validatedData.priority) updateData.priority = validatedData.priority;
      if (validatedData.status) updateData.status = validatedData.status;
      if (validatedData.dueDate) updateData.dueDate = new Date(validatedData.dueDate);
      if (validatedData.assignedTo !== undefined) updateData.assignedTo = validatedData.assignedTo;
      if (validatedData.projectId !== undefined) updateData.projectId = validatedData.projectId;
      
      updateData.updatedAt = new Date();
      
      // Auto-set completion date if status changed to completed
      if (validatedData.status === 'completed' && currentTask.status !== 'completed') {
        updateData.completedDate = new Date();
      }
      // Clear completedDate when task is moved away from completed
      if (validatedData.status && validatedData.status !== 'completed' && currentTask.completedDate) {
        updateData.completedDate = null;
      }

      const [updatedTask] = await db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, id))
        .returning();

      // Send email notification if task is reassigned to a different user
      if (validatedData.assignedTo && 
          validatedData.assignedTo !== currentTask.assignedTo && 
          validatedData.assignedTo !== userId) {
        try {
          await notificationService.notifyTaskAssigned(
            id,
            validatedData.assignedTo,
            userId,
            updatedTask.title
          );
        } catch (notifyError) {
          console.error("Failed to send task assignment notification:", notifyError);
        }
      }

      // Log significant changes
      const significantFields = ['status', 'priority', 'assignedTo', 'dueDate'] as const;
      for (const field of significantFields) {
        if (validatedData[field] !== undefined && validatedData[field] !== currentTask[field]) {
          await db.insert(taskActivityLog).values({
            taskId: id,
            action: 'field_updated',
            oldValue: currentTask[field]?.toString() || null,
            newValue: validatedData[field]?.toString() || null,
            notes: `${field} updated`,
            createdBy: userId,
          });
        }
      }

      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      const badRequest = badRequestFromDbError(error);
      if (badRequest) return res.status(400).json({ message: badRequest });
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", requirePermission("tasks", "delete"), async (req, res) => {
    try {
      const { id } = req.params;

      // Check if task exists
      const [existingTask] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Delete related records first
      await db.delete(taskComments).where(eq(taskComments.taskId, id));
      await db.delete(taskDependencies).where(eq(taskDependencies.taskId, id));
      await db.delete(taskActivityLog).where(eq(taskActivityLog.taskId, id));
      
      // Delete the task
      await db.delete(tasks).where(eq(tasks.id, id));

      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Add comment to task
  app.post("/api/tasks/:id/comments", requirePermission("tasks", "edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = createCommentSchema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // Check if task exists
      const [existingTask] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      const [newComment] = await db
        .insert(taskComments)
        .values({
          taskId: id,
          comment: validatedData.comment,
          attachments: validatedData.attachments || [],
          createdBy: userId,
        })
        .returning();

      // Log comment addition
      await db.insert(taskActivityLog).values({
        taskId: id,
        action: 'commented',
        newValue: validatedData.comment,
        notes: 'Comment added to task',
        createdBy: userId,
      });

      res.status(201).json(newComment);
    } catch (error) {
      console.error("Error adding comment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Add dependency to a task
  app.post("/api/tasks/:id/dependencies", requirePermission("tasks", "edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const { dependsOnTaskId } = req.body;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      if (!dependsOnTaskId) {
        return res.status(400).json({ message: "dependsOnTaskId is required" });
      }
      if (id === dependsOnTaskId) {
        return res.status(400).json({ message: "A task cannot depend on itself" });
      }

      const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (!task) return res.status(404).json({ message: "Task not found" });

      const [depTask] = await db.select().from(tasks).where(eq(tasks.id, dependsOnTaskId));
      if (!depTask) return res.status(404).json({ message: "Dependency task not found" });

      const existing = await db.select().from(taskDependencies)
        .where(and(eq(taskDependencies.taskId, id), eq(taskDependencies.dependsOnTaskId, dependsOnTaskId)));
      if (existing.length > 0) {
        return res.status(409).json({ message: "Dependency already exists" });
      }

      const [dep] = await db.insert(taskDependencies).values({
        taskId: id,
        dependsOnTaskId,
        createdBy: userId,
      }).returning();

      res.status(201).json(dep);
    } catch (error) {
      console.error("Error adding task dependency:", error);
      res.status(500).json({ message: "Failed to add task dependency" });
    }
  });

  // Remove a dependency from a task
  app.delete("/api/tasks/:id/dependencies/:dependsOnId", requirePermission("tasks", "edit"), async (req, res) => {
    try {
      const { id, dependsOnId } = req.params;
      await db.delete(taskDependencies)
        .where(and(eq(taskDependencies.taskId, id), eq(taskDependencies.dependsOnTaskId, dependsOnId)));
      res.json({ message: "Dependency removed" });
    } catch (error) {
      console.error("Error removing task dependency:", error);
      res.status(500).json({ message: "Failed to remove task dependency" });
    }
  });
}
