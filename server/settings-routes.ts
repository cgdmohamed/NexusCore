import type { Express } from "express";
import { requireAuth, requireAdmin } from "./auth";
import { db } from "./db";
import {
  roles, employees, users, employeeKpis, clients, quotations, quotationItems,
  invoices, invoiceItems, payments, clientCreditHistory, tasks, projects,
  taskComments, taskDependencies, taskActivityLog, activities, paymentSources,
  paymentSourceTransactions, services, clientNotes, expenseCategories, expenses,
  expensePayments, notifications, notificationSettings, emailTemplates,
  conversations, conversationParticipants, messages,
} from "@shared/schema";
import { count } from "drizzle-orm";

export function registerSettingsRoutes(app: Express) {

  app.get("/api/settings/system-info", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [
        [{ userCount }],
        [{ employeeCount }],
        [{ clientCount }],
        [{ invoiceCount }],
        [{ taskCount }],
        [{ notifCount }],
      ] = await Promise.all([
        db.select({ userCount: count() }).from(users),
        db.select({ employeeCount: count() }).from(employees),
        db.select({ clientCount: count() }).from(clients),
        db.select({ invoiceCount: count() }).from(invoices),
        db.select({ taskCount: count() }).from(tasks),
        db.select({ notifCount: count() }).from(notifications),
      ]);

      const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

      res.json({
        success: true,
        data: {
          stats: {
            users: Number(userCount),
            employees: Number(employeeCount),
            clients: Number(clientCount),
            invoices: Number(invoiceCount),
            tasks: Number(taskCount),
            notifications: Number(notifCount),
          },
          system: {
            nodeVersion: process.version,
            uptime: Math.floor(process.uptime()),
            memoryUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            memoryTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            environment: process.env.NODE_ENV || "development",
          },
          smtp: {
            configured: smtpConfigured,
            host: smtpConfigured ? (process.env.SMTP_HOST || "smtp.gmail.com") : null,
            from: smtpConfigured ? (process.env.SMTP_FROM || process.env.SMTP_USER || null) : null,
          },
          company: {
            name: process.env.COMPANY_NAME || "Creative Code Nexus",
            email: process.env.COMPANY_EMAIL || "",
            phone: process.env.COMPANY_PHONE || "",
            address: process.env.COMPANY_ADDRESS || "",
            vatNumber: process.env.COMPANY_VAT_NUMBER || "",
            regNumber: process.env.COMPANY_REGISTRATION_NUMBER || "",
          },
        },
      });
    } catch (error) {
      console.error("Failed to fetch system info:", error);
      res.status(500).json({ success: false, message: "Failed to fetch system info" });
    }
  });

  app.get("/api/settings/backup", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [
        rolesData, employeesData, usersData, employeeKpisData,
        clientsData, quotationsData, quotationItemsData,
        invoicesData, invoiceItemsData, paymentsData, clientCreditHistoryData,
        tasksData, projectsData, taskCommentsData, taskDependenciesData,
        taskActivityLogData, activitiesData, paymentSourcesData,
        paymentSourceTransactionsData, servicesData, clientNotesData,
        expenseCategoriesData, expensesData, expensePaymentsData,
        notificationsData, notificationSettingsData, emailTemplatesData,
        conversationsData, conversationParticipantsData, messagesData,
      ] = await Promise.all([
        db.select().from(roles),
        db.select().from(employees),
        db.select({ id: users.id, username: users.username, email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role, department: users.department, isActive: users.isActive, createdAt: users.createdAt }).from(users),
        db.select().from(employeeKpis),
        db.select().from(clients),
        db.select().from(quotations),
        db.select().from(quotationItems),
        db.select().from(invoices),
        db.select().from(invoiceItems),
        db.select().from(payments),
        db.select().from(clientCreditHistory),
        db.select().from(tasks),
        db.select().from(projects),
        db.select().from(taskComments),
        db.select().from(taskDependencies),
        db.select().from(taskActivityLog),
        db.select().from(activities),
        db.select().from(paymentSources),
        db.select().from(paymentSourceTransactions),
        db.select().from(services),
        db.select().from(clientNotes),
        db.select().from(expenseCategories),
        db.select().from(expenses),
        db.select().from(expensePayments),
        db.select().from(notifications),
        db.select().from(notificationSettings),
        db.select().from(emailTemplates),
        db.select().from(conversations),
        db.select().from(conversationParticipants),
        db.select().from(messages),
      ]);

      const backup = {
        meta: {
          exportedAt: new Date().toISOString(),
          exportedBy: (req.user as any)?.email || "unknown",
          appVersion: process.env.npm_package_version || "1.0.0",
          company: process.env.COMPANY_NAME || "Creative Code Nexus",
          note: "Sensitive fields (passwords, sessions, reset tokens) are excluded from this export.",
        },
        tables: {
          roles: rolesData,
          employees: employeesData,
          users: usersData,
          employeeKpis: employeeKpisData,
          clients: clientsData,
          quotations: quotationsData,
          quotationItems: quotationItemsData,
          invoices: invoicesData,
          invoiceItems: invoiceItemsData,
          payments: paymentsData,
          clientCreditHistory: clientCreditHistoryData,
          tasks: tasksData,
          projects: projectsData,
          taskComments: taskCommentsData,
          taskDependencies: taskDependenciesData,
          taskActivityLog: taskActivityLogData,
          activities: activitiesData,
          paymentSources: paymentSourcesData,
          paymentSourceTransactions: paymentSourceTransactionsData,
          services: servicesData,
          clientNotes: clientNotesData,
          expenseCategories: expenseCategoriesData,
          expenses: expensesData,
          expensePayments: expensePaymentsData,
          notifications: notificationsData,
          notificationSettings: notificationSettingsData,
          emailTemplates: emailTemplatesData,
          conversations: conversationsData,
          conversationParticipants: conversationParticipantsData,
          messages: messagesData,
        },
      };

      const filename = `backup-${new Date().toISOString().split("T")[0]}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify(backup, null, 2));
    } catch (error) {
      console.error("Database backup failed:", error);
      res.status(500).json({ success: false, message: "Failed to generate database backup" });
    }
  });
}
