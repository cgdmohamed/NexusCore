import type { Express } from "express";
import { db } from "../db";
import { uploadsRoot, setUploadHeaders } from "../uploads";

import { requireAuth, requirePermission } from "../auth";
import { clients, tasks, expenses, quotations, invoices, services, employees, activities, taskActivityLog } from "@shared/schema";
import { eq, sql, count, ne, desc } from "drizzle-orm";

import path from "path";
import fs from "fs";

// Dashboard counters, activity feed, services and uploaded files
export function registerMiscRoutes(app: Express) {

  app.patch('/api/tasks/:id/status', requirePermission("tasks", "edit"), async (req, res) => {
    try {
      const updateData: any = { 
        status: req.body.status, 
        updatedAt: new Date() 
      };
      
      if (req.body.status === 'completed') {
        updateData.completedDate = new Date();
      }

      const [updatedTask] = await db.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, req.params.id))
        .returning();
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ message: "Failed to update task status" });
    }
  });

  app.patch('/api/expenses/:id/status', requirePermission("expenses", "edit"), async (req: any, res) => {
    try {
      const newStatus = req.body.status;

      // "rejected" transitions must go through the dedicated reject endpoint
      // which enforces requirePermission('expenses','approve') and captures the reason.
      if (newStatus === 'rejected') {
        return res.status(403).json({
          message: "Use POST /api/expenses/:id/reject to reject an expense."
        });
      }

      // Approve/paid transitions also require approve permission
      const approvalStatuses = ['approved', 'paid'];
      if (approvalStatuses.includes(newStatus)) {
        const user = req.user;
        const userPerms = user?.permissions as Record<string, any> | undefined;
        const canApprove = user?.role === 'admin' ||
          userPerms?.expenses?.approve === true;
        if (!canApprove) {
          return res.status(403).json({ message: "You do not have permission to approve expenses." });
        }
      }

      const [updatedExpense] = await db.update(expenses)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(expenses.id, req.params.id))
        .returning();
      res.json(updatedExpense);
    } catch (error) {
      console.error("Error updating expense status:", error);
      res.status(500).json({ message: "Failed to update expense status" });
    }
  });

  // Sidebar counters endpoint
  app.get('/api/sidebar/counters', requirePermission("dashboard", "view"), async (req, res) => {
    try {
      const [clientsResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(clients).where(ne(clients.status, "archived"));
      const [quotationsResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(quotations);
      const [invoicesResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices);
      const [expensesResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(expenses);
      const [employeesResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(employees);
      const [tasksResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(tasks);
      
      const counters = {
        clients: Number(clientsResult?.count || 0),
        quotations: Number(quotationsResult?.count || 0),
        invoices: Number(invoicesResult?.count || 0),
        expenses: Number(expensesResult?.count || 0),
        employees: Number(employeesResult?.count || 0),
        tasks: Number(tasksResult?.count || 0),
      };
      
      res.json(counters);
    } catch (error) {
      console.error("Error fetching sidebar counters:", error);
      res.status(500).json({ message: "Failed to fetch counters" });
    }
  });

  // Dashboard KPIs - real database data
  app.get('/api/dashboard/kpis', requirePermission("dashboard", "view"), async (req, res) => {
    try {
      // Total Revenue from invoices (exclude cancelled)
      const [revenueResult] = await db.select({ 
        total: sql<number>`COALESCE(SUM(CAST(${invoices.paidAmount} AS DECIMAL)), 0)` 
      }).from(invoices).where(ne(invoices.status, 'cancelled'));

      // Pending invoices amount — all unpaid balances excluding cancelled invoices
      const [pendingResult] = await db.select({ 
        total: sql<number>`COALESCE(SUM(GREATEST(CAST(${invoices.amount} AS DECIMAL) - CAST(${invoices.paidAmount} AS DECIMAL), 0)), 0)` 
      }).from(invoices).where(ne(invoices.status, 'cancelled'));

      // Total Expenses (approved)
      const [expensesResult] = await db.select({ 
        total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)` 
      }).from(expenses).where(eq(expenses.status, 'approved'));

      // Active clients count
      const [activeClientsResult] = await db.select({ 
        count: count() 
      }).from(clients).where(eq(clients.status, 'active'));

      // Quotation stats
      const [totalQuotationsResult] = await db.select({ count: count() }).from(quotations);
      const [acceptedQuotationsResult] = await db.select({ count: count() }).from(quotations).where(eq(quotations.status, 'accepted'));
      const [pendingQuotationsResult] = await db.select({ count: count() }).from(quotations).where(eq(quotations.status, 'pending'));

      // Invoice stats
      const [totalInvoicesResult] = await db.select({ count: count() }).from(invoices);
      const [paidInvoicesResult] = await db.select({ count: count() }).from(invoices).where(eq(invoices.status, 'paid'));
      const [pendingInvoicesResult] = await db.select({ count: count() }).from(invoices).where(eq(invoices.status, 'pending'));
      const [overdueInvoicesResult] = await db.select({ count: count() }).from(invoices).where(eq(invoices.status, 'overdue'));

      // Task stats
      const [totalTasksResult] = await db.select({ count: count() }).from(tasks);
      const [completedTasksResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'completed'));
      const [inProgressTasksResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'in_progress'));
      const [pendingTasksResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'pending'));

      const totalRevenue = parseFloat(revenueResult?.total?.toString() || '0');
      const totalExpenses = parseFloat(expensesResult?.total?.toString() || '0');
      const pendingAmount = parseFloat(pendingResult?.total?.toString() || '0');

      res.json({
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        pendingRevenue: pendingAmount,
        activeClients: activeClientsResult?.count || 0,
        quotations: {
          total: totalQuotationsResult?.count || 0,
          accepted: acceptedQuotationsResult?.count || 0,
          pending: pendingQuotationsResult?.count || 0,
          conversionRate: totalQuotationsResult?.count > 0 
            ? ((acceptedQuotationsResult?.count || 0) / totalQuotationsResult.count * 100).toFixed(1)
            : 0
        },
        invoices: {
          total: totalInvoicesResult?.count || 0,
          paid: paidInvoicesResult?.count || 0,
          pending: pendingInvoicesResult?.count || 0,
          overdue: overdueInvoicesResult?.count || 0
        },
        tasks: {
          total: totalTasksResult?.count || 0,
          completed: completedTasksResult?.count || 0,
          inProgress: inProgressTasksResult?.count || 0,
          pending: pendingTasksResult?.count || 0
        }
      });
    } catch (error) {
      console.error("Error fetching dashboard KPIs:", error);
      res.status(500).json({ message: "Failed to fetch dashboard KPIs" });
    }
  });

  // User activity feed - combines task activity log + general activities
  app.get('/api/users/:id/activity', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Only the user themselves or an admin/manager may view activity
      const requestingUser = req.user;
      const isSelf = requestingUser?.id === id || requestingUser?.claims?.sub === id;
      const isPrivileged = ['admin', 'manager'].includes(requestingUser?.role);
      if (!isSelf && !isPrivileged) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get task activity entries created by this user
      const taskActivity = await db
        .select({
          id: taskActivityLog.id,
          action: taskActivityLog.action,
          notes: taskActivityLog.notes,
          newValue: taskActivityLog.newValue,
          oldValue: taskActivityLog.oldValue,
          createdAt: taskActivityLog.createdAt,
          taskId: taskActivityLog.taskId,
          taskTitle: tasks.title,
        })
        .from(taskActivityLog)
        .leftJoin(tasks, eq(taskActivityLog.taskId, tasks.id))
        .where(eq(taskActivityLog.createdBy, id))
        .orderBy(desc(taskActivityLog.createdAt))
        .limit(30);

      // Get general activities created by this user
      const generalActivity = await db
        .select()
        .from(activities)
        .where(eq(activities.createdBy, id))
        .orderBy(desc(activities.createdAt))
        .limit(20);

      // Merge and sort by date
      const combined = [
        ...taskActivity.map(a => ({ ...a, source: 'task' })),
        ...generalActivity.map(a => ({ ...a, source: 'general' })),
      ].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
       .slice(0, 40);

      res.json(combined);
    } catch (error) {
      console.error("Error fetching user activity:", error);
      res.status(500).json({ message: "Failed to fetch user activity" });
    }
  });

  // Services Management Routes
  app.get('/api/services', requirePermission("services", "view"), async (req: any, res) => {
    try {
      const servicesList = await db.select().from(services).where(eq(services.isActive, true));
      res.json(servicesList);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  // Initialize Default Services
  app.post('/api/services/initialize', requirePermission("services", "add"), async (req: any, res) => {
    try {
      const existingServices = await db.select().from(services);
      if (existingServices.length === 0) {
        const defaultServices = [
          { name: 'Web Design', description: 'Custom website design', defaultPrice: '2500.00', category: 'web-design' },
          { name: 'Web Development', description: 'Full-stack web development', defaultPrice: '5000.00', category: 'development' },
          { name: 'Mobile App Development', description: 'iOS and Android app development', defaultPrice: '8000.00', category: 'development' },
          { name: 'SEO Optimization', description: 'Search engine optimization services', defaultPrice: '1500.00', category: 'marketing' },
          { name: 'Digital Marketing', description: 'Comprehensive digital marketing campaign', defaultPrice: '3000.00', category: 'marketing' },
          { name: 'Business Consulting', description: 'Strategic business consultation', defaultPrice: '200.00', category: 'consulting' },
          { name: 'UI/UX Design', description: 'User interface and experience design', defaultPrice: '1800.00', category: 'web-design' },
          { name: 'E-commerce Solution', description: 'Complete e-commerce platform setup', defaultPrice: '6000.00', category: 'development' },
        ];

        await db.insert(services).values(defaultServices);
        res.json({ message: 'Default services initialized' });
      } else {
        res.json({ message: 'Services already exist' });
      }
    } catch (error) {
      console.error("Error initializing services:", error);
      res.status(500).json({ message: "Failed to initialize services" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', requireAuth, (req, res, next) => {
    const root = uploadsRoot();
    const filePath = path.resolve(root, '.' + path.sep + decodeURIComponent(req.path));
    if (!filePath.startsWith(root + path.sep)) {
      return res.status(400).json({ message: "Invalid path" });
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      setUploadHeaders(res, filePath);
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  });
}
