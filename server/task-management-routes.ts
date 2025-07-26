import type { Express } from "express";
import { db } from "./db";
import { 
  tasks, 
  taskComments, 
  taskDependencies, 
  taskActivityLog,
  clients,
  users,
  employees
} from "@shared/schema";
import { eq, desc, and, or, gte, lte, count, sql, ilike } from "drizzle-orm";
import { z } from "zod";

// Development auth middleware
const devAuth = (req: any, res: any, next: any) => {
  req.user = { claims: { sub: '1' } };
  next();
};

// Task creation schema - simplified for existing database
const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
});

// Comment creation schema
const createCommentSchema = z.object({
  comment: z.string().min(1, "Comment is required"),
  attachments: z.array(z.string()).optional(),
});

export function registerTaskManagementRoutes(app: Express) {
  
  // Get all tasks with advanced filtering
  app.get("/api/tasks", devAuth, async (req, res) => {
    try {
      const {
        status,
        priority,
        assignedTo,
        createdBy,
        assignedBy,
        category,
        department,
        linkedClientId,
        linkedProjectId,
        billable,
        dueAfter,
        dueBefore,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        limit = '50',
        offset = '0',
        myTasks // Special filter for current user's tasks
      } = req.query;

      const userId = req.user?.claims?.sub || '1';
      
      // Simple query for existing tasks table
      const allTasks = await db.select().from(tasks);

      // Filter tasks based on search criteria
      let filteredTasks = allTasks;

      if (search) {
        filteredTasks = filteredTasks.filter(task => 
          task.title.toLowerCase().includes(search.toLowerCase()) ||
          (task.description && task.description.toLowerCase().includes(search.toLowerCase()))
        );
      }

      if (status) {
        filteredTasks = filteredTasks.filter(task => task.status === status);
      }

      if (priority) {
        filteredTasks = filteredTasks.filter(task => task.priority === priority);
      }

      if (myTasks === 'true') {
        filteredTasks = filteredTasks.filter(task => task.assignedTo === userId);
      }

      // Sort tasks
      filteredTasks.sort((a, b) => {
        if (sortOrder === 'desc') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      // Apply pagination
      const start = parseInt(offset as string);
      const end = start + parseInt(limit as string);
      const paginatedTasks = filteredTasks.slice(start, end);

      res.json(paginatedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get task statistics for dashboard
  app.get("/api/tasks/stats", devAuth, async (req, res) => {
    try {
      const { assignedTo, department } = req.query;
      const userId = req.user?.claims?.sub || '1';

      let baseConditions = [];
      
      // If requesting personal stats
      if (assignedTo === 'me') {
        baseConditions.push(eq(tasks.assignedTo, userId));
      } else if (assignedTo) {
        baseConditions.push(eq(tasks.assignedTo, assignedTo as string));
      }

      if (department) {
        baseConditions.push(eq(tasks.departmentId, department as string));
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

  // Get single task with full details
  app.get("/api/tasks/:id", devAuth, async (req, res) => {
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
          assignedByUser: {
            id: users.id,
            email: users.email,
          },
          assignedByEmployee: {
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
          client: {
            id: clients.id,
            name: clients.name,
            email: clients.email,
          }
        })
        .from(tasks)
        .leftJoin(users, eq(tasks.assignedTo, users.id))
        .leftJoin(employees, eq(users.employeeId, employees.id))
        .leftJoin(users.as('assignedByUsers'), eq(tasks.assignedBy, users.id))
        .leftJoin(employees.as('assignedByEmployees'), eq(users.employeeId, employees.id))
        .leftJoin(clients, eq(tasks.linkedClientId, clients.id))
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
        assignedByUser: task.assignedByUser,
        assignedByEmployee: task.assignedByEmployee,
        client: task.client,
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
  app.post("/api/tasks", devAuth, async (req, res) => {
    try {
      const validatedData = createTaskSchema.parse(req.body);
      const userId = req.user?.claims?.sub || '1';

      const taskData = {
        title: validatedData.title,
        description: validatedData.description || null,
        priority: validatedData.priority,
        status: validatedData.status,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        assignedTo: validatedData.assignedTo || null,
        createdBy: userId,
      };

      const [newTask] = await db
        .insert(tasks)
        .values(taskData)
        .returning();

      res.status(201).json(newTask);
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Update task
  app.put("/api/tasks/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = createTaskSchema.partial().parse(req.body);
      const userId = req.user?.claims?.sub || '1';

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
      
      updateData.updatedAt = new Date();
      
      // Auto-set completion date if status changed to completed
      if (validatedData.status === 'completed' && currentTask.status !== 'completed') {
        updateData.completedDate = new Date();
      }

      const [updatedTask] = await db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, id))
        .returning();

      // Log significant changes
      const significantFields = ['status', 'priority', 'assignedTo', 'dueDate', 'progressPercentage'];
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
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub || '1';

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
  app.post("/api/tasks/:id/comments", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = createCommentSchema.parse(req.body);
      const userId = req.user?.claims?.sub || '1';

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

  // Get task performance metrics
  app.get("/api/tasks/performance", devAuth, async (req, res) => {
    try {
      const { assignedTo, department, startDate, endDate } = req.query;

      let conditions = [];
      
      if (assignedTo) {
        conditions.push(eq(tasks.assignedTo, assignedTo as string));
      }

      if (department) {
        conditions.push(eq(tasks.departmentId, department as string));
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
}