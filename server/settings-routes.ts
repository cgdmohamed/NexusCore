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
import { logAudit } from "./audit";

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

  // Data export (JSON). This is NOT a restorable database backup — use pg_dump for that.
  // Private messages are excluded unless explicitly requested, and every download is audited.
  app.get("/api/settings/backup", requireAuth, requireAdmin, async (req, res) => {
    try {
      const includeMessages = req.query.includeMessages === "true";

      const tables: Record<string, () => Promise<unknown[]>> = {
        roles: () => db.select().from(roles),
        employees: () => db.select().from(employees),
        users: () => db.select({ id: users.id, username: users.username, email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role, department: users.department, isActive: users.isActive, createdAt: users.createdAt }).from(users),
        employeeKpis: () => db.select().from(employeeKpis),
        clients: () => db.select().from(clients),
        quotations: () => db.select().from(quotations),
        quotationItems: () => db.select().from(quotationItems),
        invoices: () => db.select().from(invoices),
        invoiceItems: () => db.select().from(invoiceItems),
        payments: () => db.select().from(payments),
        clientCreditHistory: () => db.select().from(clientCreditHistory),
        tasks: () => db.select().from(tasks),
        projects: () => db.select().from(projects),
        taskComments: () => db.select().from(taskComments),
        taskDependencies: () => db.select().from(taskDependencies),
        taskActivityLog: () => db.select().from(taskActivityLog),
        activities: () => db.select().from(activities),
        paymentSources: () => db.select().from(paymentSources),
        paymentSourceTransactions: () => db.select().from(paymentSourceTransactions),
        services: () => db.select().from(services),
        clientNotes: () => db.select().from(clientNotes),
        expenseCategories: () => db.select().from(expenseCategories),
        expenses: () => db.select().from(expenses),
        expensePayments: () => db.select().from(expensePayments),
        notifications: () => db.select().from(notifications),
        notificationSettings: () => db.select().from(notificationSettings),
        emailTemplates: () => db.select().from(emailTemplates),
      };
      const privateTables: Record<string, () => Promise<unknown[]>> = {
        conversations: () => db.select().from(conversations),
        conversationParticipants: () => db.select().from(conversationParticipants),
        messages: () => db.select().from(messages),
      };
      const included = includeMessages ? { ...tables, ...privateTables } : tables;
      const excludedTables = [...(includeMessages ? [] : Object.keys(privateTables)), "client_credentials", "audit_logs", "sessions", "password_reset_tokens", "uploads (files)"];

      await logAudit(req, "backup_download", "system", null, null, { includeMessages, tables: Object.keys(included).length });

      const meta = {
        exportedAt: new Date().toISOString(),
        exportedBy: (req.user as any)?.email || "unknown",
        appVersion: process.env.npm_package_version || "1.0.0",
        company: process.env.COMPANY_NAME || "Creative Code Nexus",
        note: "Data export only, not a restorable backup. Sensitive fields (passwords, sessions, reset tokens, vault credentials) and uploaded files are excluded. Use pg_dump for real backups.",
        excludedTables,
      };

      const filename = `backup-${new Date().toISOString().split("T")[0]}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      // Stream one table at a time so the whole database is never held in memory at once
      res.write(`{"meta":${JSON.stringify(meta)},"tables":{`);
      let first = true;
      for (const [name, load] of Object.entries(included)) {
        res.write(`${first ? "" : ","}${JSON.stringify(name)}:${JSON.stringify(await load())}`);
        first = false;
      }
      res.end("}}");
    } catch (error) {
      console.error("Database backup failed:", error);
      if (res.headersSent) return res.destroy();
      res.status(500).json({ success: false, message: "Failed to generate database backup" });
    }
  });
}
