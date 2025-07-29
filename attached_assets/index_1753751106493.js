var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import "dotenv/config";
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import bcrypt from "bcrypt";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  activities: () => activities,
  activitiesRelations: () => activitiesRelations,
  auditLogs: () => auditLogs,
  auditLogsRelations: () => auditLogsRelations,
  clientCreditHistory: () => clientCreditHistory,
  clientNotes: () => clientNotes,
  clientNotesRelations: () => clientNotesRelations,
  clients: () => clients,
  clientsRelations: () => clientsRelations,
  departmentEnum: () => departmentEnum,
  emailTemplates: () => emailTemplates,
  emailTemplatesRelations: () => emailTemplatesRelations,
  employeeKpis: () => employeeKpis,
  employeeKpisRelations: () => employeeKpisRelations,
  employeeStatusEnum: () => employeeStatusEnum,
  employees: () => employees,
  employeesRelations: () => employeesRelations,
  expenseCategories: () => expenseCategories,
  expenseCategoriesRelations: () => expenseCategoriesRelations,
  expensePayments: () => expensePayments,
  expensePaymentsRelations: () => expensePaymentsRelations,
  expenses: () => expenses,
  expensesRelations: () => expensesRelations,
  insertActivitySchema: () => insertActivitySchema,
  insertAuditLogSchema: () => insertAuditLogSchema,
  insertClientSchema: () => insertClientSchema,
  insertEmployeeKpiSchema: () => insertEmployeeKpiSchema,
  insertEmployeeSchema: () => insertEmployeeSchema,
  insertInvoiceSchema: () => insertInvoiceSchema,
  insertPaymentSourceSchema: () => insertPaymentSourceSchema,
  insertPaymentSourceTransactionSchema: () => insertPaymentSourceTransactionSchema,
  insertQuotationSchema: () => insertQuotationSchema,
  insertRoleSchema: () => insertRoleSchema,
  insertServiceSchema: () => insertServiceSchema,
  insertTaskSchema: () => insertTaskSchema,
  insertUserSchema: () => insertUserSchema,
  invoiceItems: () => invoiceItems,
  invoiceItemsRelations: () => invoiceItemsRelations,
  invoices: () => invoices,
  invoicesRelations: () => invoicesRelations,
  kpiStatusEnum: () => kpiStatusEnum,
  notificationLogs: () => notificationLogs,
  notificationLogsRelations: () => notificationLogsRelations,
  notificationPriorityEnum: () => notificationPriorityEnum,
  notificationSettings: () => notificationSettings,
  notificationSettingsRelations: () => notificationSettingsRelations,
  notificationStatusEnum: () => notificationStatusEnum,
  notificationTypeEnum: () => notificationTypeEnum,
  notifications: () => notifications,
  notificationsRelations: () => notificationsRelations,
  paymentSourceTransactions: () => paymentSourceTransactions,
  paymentSourceTransactionsRelations: () => paymentSourceTransactionsRelations,
  paymentSources: () => paymentSources,
  paymentSourcesRelations: () => paymentSourcesRelations,
  payments: () => payments,
  paymentsRelations: () => paymentsRelations,
  quotationItems: () => quotationItems,
  quotationItemsRelations: () => quotationItemsRelations,
  quotations: () => quotations,
  quotationsRelations: () => quotationsRelations,
  roles: () => roles,
  rolesRelations: () => rolesRelations,
  services: () => services,
  servicesRelations: () => servicesRelations,
  sessions: () => sessions,
  taskActivityLog: () => taskActivityLog,
  taskComments: () => taskComments,
  taskDependencies: () => taskDependencies,
  tasks: () => tasks,
  tasksRelations: () => tasksRelations,
  updateServiceSchema: () => updateServiceSchema,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  varchar,
  timestamp,
  decimal,
  boolean,
  pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var departmentEnum = pgEnum("department", ["operations", "finance", "hr", "sales", "management", "it", "marketing"]);
var employeeStatusEnum = pgEnum("employee_status", ["active", "inactive", "terminated", "on_leave"]);
var roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").notNull(),
  // JSON object with module permissions
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by")
});
var employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").unique(),
  phone: varchar("phone"),
  jobTitle: varchar("job_title"),
  department: departmentEnum("department").notNull(),
  hiringDate: timestamp("hiring_date"),
  status: employeeStatusEnum("status").notNull().default("active"),
  profileImage: text("profile_image"),
  // Base64 encoded image data
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by")
});
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  email: varchar("email").notNull().unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role"),
  department: varchar("department"),
  employeeId: varchar("employee_id").references(() => employees.id),
  roleId: varchar("role_id").references(() => roles.id),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  emailNotifications: boolean("email_notifications").default(true),
  inAppNotifications: boolean("in_app_notifications").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var kpiStatusEnum = pgEnum("kpi_status", ["on_track", "below_target", "exceeded", "not_evaluated"]);
var employeeKpis = pgTable("employee_kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  targetValue: varchar("target_value"),
  // Flexible string to accommodate different types
  actualValue: varchar("actual_value"),
  evaluationPeriod: varchar("evaluation_period").notNull(),
  // e.g., "July 2025", "Q2 2025", "Jan 1 - Mar 31, 2025"
  status: kpiStatusEnum("status").notNull().default("not_evaluated"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(),
  // create, update, delete, approve, etc.
  entityType: varchar("entity_type").notNull(),
  // user, employee, role, client, etc.
  entityId: varchar("entity_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow()
});
var clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  city: varchar("city"),
  country: varchar("country"),
  status: varchar("status").notNull().default("active"),
  // active, inactive, pending
  totalValue: decimal("total_value", { precision: 10, scale: 2 }).default("0"),
  creditBalance: decimal("credit_balance", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var quotations = pgTable("quotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationNumber: varchar("quotation_number").notNull().unique(),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default("draft"),
  // draft, sent, accepted, rejected, expired, invoiced
  validUntil: timestamp("valid_until"),
  notes: text("notes"),
  // Internal notes
  terms: text("terms"),
  // Terms and conditions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number").notNull().unique(),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  quotationId: varchar("quotation_id").references(() => quotations.id),
  title: text("title").default("Invoice"),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  discountRate: decimal("discount_rate", { precision: 5, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status").notNull().default("draft"),
  // draft, sent, paid, partially_paid, overdue, cancelled, refunded, partially_refunded
  invoiceDate: timestamp("invoice_date").defaultNow(),
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id).notNull(),
  serviceId: varchar("service_id").references(() => services.id),
  name: text("name").notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  overpaymentAmount: decimal("overpayment_amount", { precision: 10, scale: 2 }).default("0"),
  isOverpayment: boolean("is_overpayment").default(false),
  adminApproved: boolean("admin_approved").default(false),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: varchar("payment_method").notNull(),
  // cash, bank_transfer, credit_card, check, other, credit_balance
  bankTransferNumber: varchar("bank_transfer_number"),
  attachmentUrl: varchar("attachment_url"),
  notes: text("notes"),
  // Refund fields
  isRefund: boolean("is_refund").default(false),
  refundReference: varchar("refund_reference"),
  originalPaymentId: varchar("original_payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id)
});
var clientCreditHistory = pgTable("client_credit_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  type: varchar("type").notNull(),
  // credit_added, credit_used, credit_refunded, credit_applied
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  relatedInvoiceId: varchar("related_invoice_id").references(() => invoices.id),
  relatedPaymentId: varchar("related_payment_id").references(() => payments.id),
  description: text("description").notNull(),
  notes: text("notes"),
  refundReference: varchar("refund_reference"),
  previousBalance: decimal("previous_balance", { precision: 10, scale: 2 }).notNull(),
  newBalance: decimal("new_balance", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  priority: varchar("priority").notNull().default("medium"),
  // low, medium, high
  status: varchar("status").notNull().default("pending"),
  // pending, in_progress, completed, cancelled
  dueDate: timestamp("due_date"),
  completedDate: timestamp("completed_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id)
});
var taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  comment: text("comment").notNull(),
  attachments: text("attachments").array(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id).notNull()
});
var taskDependencies = pgTable("task_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  dependsOnTaskId: varchar("depends_on_task_id").references(() => tasks.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id).notNull()
});
var taskActivityLog = pgTable("task_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  action: varchar("action").notNull(),
  // created, assigned, status_changed, updated, commented, etc.
  oldValue: text("old_value"),
  newValue: text("new_value"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id).notNull()
});
var activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(),
  // invoice_paid, client_added, quotation_sent, etc.
  title: text("title").notNull(),
  description: text("description"),
  entityType: varchar("entity_type"),
  // client, invoice, quotation, etc.
  entityId: varchar("entity_id"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var rolesRelations = relations(roles, ({ one, many }) => ({
  users: many(users),
  createdBy: one(users, {
    fields: [roles.createdBy],
    references: [users.id]
  })
}));
var employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.id],
    references: [users.employeeId]
  }),
  createdBy: one(users, {
    fields: [employees.createdBy],
    references: [users.id]
  }),
  kpis: many(employeeKpis)
}));
var employeeKpisRelations = relations(employeeKpis, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeKpis.employeeId],
    references: [employees.id]
  }),
  createdBy: one(users, {
    fields: [employeeKpis.createdBy],
    references: [users.id]
  })
}));
var usersRelations = relations(users, ({ one, many }) => ({
  employee: one(employees, {
    fields: [users.employeeId],
    references: [employees.id]
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id]
  }),
  clients: many(clients),
  quotations: many(quotations),
  invoices: many(invoices),
  expenses: many(expenses),
  tasks: many(tasks),
  activities: many(activities),
  auditLogs: many(auditLogs)
}));
var auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
}));
var clientsRelations = relations(clients, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [clients.createdBy],
    references: [users.id]
  }),
  quotations: many(quotations),
  invoices: many(invoices)
}));
var quotationsRelations = relations(quotations, ({ one, many }) => ({
  client: one(clients, {
    fields: [quotations.clientId],
    references: [clients.id]
  }),
  createdBy: one(users, {
    fields: [quotations.createdBy],
    references: [users.id]
  }),
  invoices: many(invoices)
}));
var invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id]
  }),
  quotation: one(quotations, {
    fields: [invoices.quotationId],
    references: [quotations.id]
  }),
  createdBy: one(users, {
    fields: [invoices.createdBy],
    references: [users.id]
  }),
  items: many(invoiceItems),
  payments: many(payments)
}));
var invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id]
  }),
  service: one(services, {
    fields: [invoiceItems.serviceId],
    references: [services.id]
  })
}));
var paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id]
  }),
  createdBy: one(users, {
    fields: [payments.createdBy],
    references: [users.id]
  })
}));
var tasksRelations = relations(tasks, ({ one }) => ({
  assignedTo: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id]
  }),
  createdBy: one(users, {
    fields: [tasks.createdBy],
    references: [users.id]
  })
}));
var activitiesRelations = relations(activities, ({ one }) => ({
  createdBy: one(users, {
    fields: [activities.createdBy],
    references: [users.id]
  })
}));
var insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true
});
var insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true
});
var insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalValue: true
});
var insertQuotationSchema = createInsertSchema(quotations).omit({
  id: true,
  quotationNumber: true,
  createdAt: true,
  updatedAt: true
});
var insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  invoiceNumber: true,
  createdAt: true,
  updatedAt: true,
  paidAmount: true
});
var insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedDate: true
});
var insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true
});
var insertEmployeeKpiSchema = createInsertSchema(employeeKpis).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var paymentSources = pgTable("payment_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: varchar("description"),
  accountType: varchar("account_type").notNull().default("bank"),
  // cash, bank, wallet
  currency: varchar("currency").default("USD"),
  initialBalance: varchar("initial_balance").default("0"),
  currentBalance: varchar("current_balance").default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var paymentSourceTransactions = pgTable("payment_source_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentSourceId: varchar("payment_source_id").notNull().references(() => paymentSources.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(),
  // expense, income, adjustment
  amount: varchar("amount").notNull(),
  description: varchar("description"),
  referenceId: varchar("reference_id"),
  // expense ID, income ID, etc.
  referenceType: varchar("reference_type"),
  // "expense", "income", "manual_adjustment"
  balanceBefore: varchar("balance_before").notNull(),
  balanceAfter: varchar("balance_after").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var paymentSourcesRelations = relations(paymentSources, ({ many }) => ({
  transactions: many(paymentSourceTransactions),
  expenses: many(expenses)
}));
var paymentSourceTransactionsRelations = relations(paymentSourceTransactions, ({ one }) => ({
  paymentSource: one(paymentSources, {
    fields: [paymentSourceTransactions.paymentSourceId],
    references: [paymentSources.id]
  }),
  createdByUser: one(users, {
    fields: [paymentSourceTransactions.createdBy],
    references: [users.id]
  })
}));
var insertPaymentSourceSchema = createInsertSchema(paymentSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertPaymentSourceTransactionSchema = createInsertSchema(paymentSourceTransactions).omit({
  id: true,
  createdAt: true
});
var quotationItems = pgTable("quotation_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: varchar("quotation_id").references(() => quotations.id),
  serviceId: varchar("service_id").references(() => services.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow()
});
var services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  defaultPrice: decimal("default_price", { precision: 10, scale: 2 }),
  category: varchar("category"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});
var clientNotes = pgTable("client_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  note: text("note").notNull(),
  type: varchar("type").notNull().default("note"),
  // note, call, meeting, email
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var insertServiceSchema = createInsertSchema(services);
var updateServiceSchema = insertServiceSchema.partial().extend({
  id: z.string()
});
var quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id]
  }),
  service: one(services, {
    fields: [quotationItems.serviceId],
    references: [services.id]
  })
}));
var servicesRelations = relations(services, ({ many }) => ({
  quotationItems: many(quotationItems)
}));
var clientNotesRelations = relations(clientNotes, ({ one }) => ({
  client: one(clients, {
    fields: [clientNotes.clientId],
    references: [clients.id]
  }),
  createdBy: one(users, {
    fields: [clientNotes.createdBy],
    references: [users.id]
  })
}));
var expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  color: varchar("color").default("#3B82F6"),
  // Hex color for UI display
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  categoryId: varchar("category_id").references(() => expenseCategories.id).notNull(),
  type: varchar("type").notNull(),
  // 'fixed', 'variable'
  frequency: varchar("frequency"),
  // 'monthly', 'quarterly', 'yearly' - only for fixed expenses
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  expenseDate: timestamp("expense_date").notNull(),
  paymentMethod: varchar("payment_method").notNull(),
  // cash, bank_transfer, credit_card, check
  paymentReference: varchar("payment_reference"),
  // reference number for bank transfers, check numbers, etc.
  status: varchar("status").notNull().default("pending"),
  // pending, paid, overdue, cancelled
  paidDate: timestamp("paid_date"),
  attachmentUrl: varchar("attachment_url").notNull(),
  // Mandatory attachment
  attachmentType: varchar("attachment_type").notNull(),
  // receipt, invoice, bank_statement, photo
  notes: text("notes"),
  // Optional project/client linking for internal reporting
  relatedProjectId: varchar("related_project_id"),
  relatedClientId: varchar("related_client_id").references(() => clients.id),
  // Recurring expense tracking
  isRecurring: boolean("is_recurring").default(false),
  parentExpenseId: varchar("parent_expense_id").references(() => expenses.id),
  // Payment source tracking
  paymentSourceId: varchar("payment_source_id").references(() => paymentSources.id),
  nextDueDate: timestamp("next_due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var expensePayments = pgTable("expense_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id").references(() => expenses.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: varchar("payment_method").notNull(),
  paymentReference: varchar("payment_reference"),
  attachmentUrl: varchar("attachment_url").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var insertExpenseCategorySchema = createInsertSchema(expenseCategories);
var insertExpenseSchema = createInsertSchema(expenses);
var insertExpensePaymentSchema = createInsertSchema(expensePayments);
var expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenses: many(expenses)
}));
var expensesRelations = relations(expenses, ({ one, many }) => ({
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id]
  }),
  relatedClient: one(clients, {
    fields: [expenses.relatedClientId],
    references: [clients.id]
  }),
  createdBy: one(users, {
    fields: [expenses.createdBy],
    references: [users.id]
  }),
  parentExpense: one(expenses, {
    fields: [expenses.parentExpenseId],
    references: [expenses.id]
  }),
  childExpenses: many(expenses),
  payments: many(expensePayments),
  paymentSource: one(paymentSources, {
    fields: [expenses.paymentSourceId],
    references: [paymentSources.id]
  })
}));
var expensePaymentsRelations = relations(expensePayments, ({ one }) => ({
  expense: one(expenses, {
    fields: [expensePayments.expenseId],
    references: [expenses.id]
  }),
  createdBy: one(users, {
    fields: [expensePayments.createdBy],
    references: [users.id]
  })
}));
var notificationTypeEnum = pgEnum("notification_type", [
  "task_assigned",
  "task_updated",
  "task_completed",
  "task_overdue",
  "expense_submitted",
  "expense_approved",
  "expense_rejected",
  "expense_paid",
  "invoice_created",
  "invoice_updated",
  "invoice_paid",
  "invoice_overdue",
  "quotation_created",
  "quotation_sent",
  "quotation_accepted",
  "quotation_rejected",
  "quotation_expired",
  "kpi_assigned",
  "kpi_updated",
  "kpi_reviewed",
  "client_added",
  "client_updated",
  "client_status_changed",
  "payment_received",
  "payment_failed",
  "payment_refunded",
  "user_added",
  "user_updated",
  "user_deactivated",
  "system_maintenance",
  "system_backup",
  "system_alert"
]);
var notificationStatusEnum = pgEnum("notification_status", ["unread", "read", "archived"]);
var notificationPriorityEnum = pgEnum("notification_priority", ["low", "medium", "high", "urgent"]);
var notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  status: notificationStatusEnum("status").notNull().default("unread"),
  priority: notificationPriorityEnum("priority").notNull().default("medium"),
  // Link to related entity
  entityType: varchar("entity_type"),
  // task, expense, invoice, quotation, kpi, client, etc.
  entityId: varchar("entity_id"),
  entityUrl: varchar("entity_url"),
  // Direct link to the entity page
  // Metadata
  metadata: jsonb("metadata"),
  // Additional data like amounts, names, etc.
  // Email tracking
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  emailError: text("email_error"),
  // Timing
  scheduledFor: timestamp("scheduled_for"),
  // For future notifications
  expiresAt: timestamp("expires_at"),
  // Auto-archive after this date
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  notificationType: notificationTypeEnum("notification_type").notNull(),
  inAppEnabled: boolean("in_app_enabled").default(true),
  emailEnabled: boolean("email_enabled").default(true),
  pushEnabled: boolean("push_enabled").default(false),
  // Scheduling preferences
  emailDigest: boolean("email_digest").default(false),
  // Bundle emails
  digestFrequency: varchar("digest_frequency").default("daily"),
  // daily, weekly, instant
  quietStart: varchar("quiet_start").default("22:00"),
  // Do not send notifications after this time
  quietEnd: varchar("quiet_end").default("08:00"),
  // Resume notifications after this time
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationType: notificationTypeEnum("notification_type").notNull().unique(),
  name: varchar("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text").notNull(),
  variables: jsonb("variables"),
  // Available template variables
  isActive: boolean("is_active").default(true),
  language: varchar("language").default("en"),
  // en, ar
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id)
});
var notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationId: varchar("notification_id").references(() => notifications.id).notNull(),
  action: varchar("action").notNull(),
  // sent, delivered, read, failed, clicked
  channel: varchar("channel").notNull(),
  // in_app, email, push
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  // Email provider response, click tracking, etc.
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertNotificationSchema = createInsertSchema(notifications);
var insertNotificationSettingsSchema = createInsertSchema(notificationSettings);
var insertEmailTemplateSchema = createInsertSchema(emailTemplates);
var insertNotificationLogSchema = createInsertSchema(notificationLogs);
var notificationsRelations = relations(notifications, ({ one, many }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  }),
  createdBy: one(users, {
    fields: [notifications.createdBy],
    references: [users.id]
  }),
  logs: many(notificationLogs)
}));
var notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, {
    fields: [notificationSettings.userId],
    references: [users.id]
  })
}));
var emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id]
  })
}));
var notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationLogs.notificationId],
    references: [notifications.id]
  })
}));

// server/db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, desc, and, count, sum, asc, ilike, or } from "drizzle-orm";
var DatabaseStorage = class {
  // User operations for username/password authentication
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async getAllUsers() {
    return await db.select().from(users);
  }
  async createUser(userData) {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  // Client operations
  async getClients(userId) {
    return await db.select().from(clients).where(eq(clients.createdBy, userId)).orderBy(desc(clients.createdAt));
  }
  async getClient(id) {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }
  async createClient(client) {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }
  async updateClient(id, client) {
    const [updatedClient] = await db.update(clients).set({ ...client, updatedAt: /* @__PURE__ */ new Date() }).where(eq(clients.id, id)).returning();
    return updatedClient;
  }
  async deleteClient(id) {
    await db.delete(clients).where(eq(clients.id, id));
  }
  // Quotation operations
  async getQuotations(userId) {
    return await db.select().from(quotations).where(eq(quotations.createdBy, userId)).orderBy(desc(quotations.createdAt));
  }
  async getQuotation(id) {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));
    return quotation;
  }
  async createQuotation(quotation) {
    const quotationNumber = `QUO-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`;
    const [newQuotation] = await db.insert(quotations).values({ ...quotation, quotationNumber }).returning();
    return newQuotation;
  }
  async updateQuotation(id, quotation) {
    const [updatedQuotation] = await db.update(quotations).set({ ...quotation, updatedAt: /* @__PURE__ */ new Date() }).where(eq(quotations.id, id)).returning();
    return updatedQuotation;
  }
  async deleteQuotation(id) {
    await db.delete(quotations).where(eq(quotations.id, id));
  }
  // Invoice operations
  async getInvoices(userId) {
    return await db.select().from(invoices).where(eq(invoices.createdBy, userId)).orderBy(desc(invoices.createdAt));
  }
  async getInvoice(id) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }
  async createInvoice(invoice) {
    const invoiceNumber = `INV-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`;
    const [newInvoice] = await db.insert(invoices).values({ ...invoice, invoiceNumber }).returning();
    return newInvoice;
  }
  async updateInvoice(id, invoice) {
    const [updatedInvoice] = await db.update(invoices).set({ ...invoice, updatedAt: /* @__PURE__ */ new Date() }).where(eq(invoices.id, id)).returning();
    return updatedInvoice;
  }
  async deleteInvoice(id) {
    await db.delete(invoices).where(eq(invoices.id, id));
  }
  // Expense operations
  async getExpenses(userId) {
    return await db.select().from(expenses).where(eq(expenses.createdBy, userId)).orderBy(desc(expenses.createdAt));
  }
  async getExpense(id) {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }
  async createExpense(expense) {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }
  async updateExpense(id, expense) {
    const [updatedExpense] = await db.update(expenses).set({ ...expense, updatedAt: /* @__PURE__ */ new Date() }).where(eq(expenses.id, id)).returning();
    return updatedExpense;
  }
  async deleteExpense(id) {
    await db.delete(expenses).where(eq(expenses.id, id));
  }
  // Task operations
  async getTasks(userId) {
    return await db.select().from(tasks).where(eq(tasks.assignedTo, userId)).orderBy(desc(tasks.createdAt));
  }
  async getTask(id) {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }
  async createTask(task) {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }
  async updateTask(id, task) {
    const [updatedTask] = await db.update(tasks).set({ ...task, updatedAt: /* @__PURE__ */ new Date() }).where(eq(tasks.id, id)).returning();
    return updatedTask;
  }
  async deleteTask(id) {
    await db.delete(tasks).where(eq(tasks.id, id));
  }
  // Activity operations
  async getActivities(userId, limit = 10) {
    return await db.select().from(activities).where(eq(activities.createdBy, userId)).orderBy(desc(activities.createdAt)).limit(limit);
  }
  async createActivity(activity) {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }
  // Services operations
  async getServices(params) {
    const { page, limit, search, category, activeOnly, sortBy = "name", sortOrder = "asc" } = params;
    const offset = (page - 1) * limit;
    const conditions = [];
    if (activeOnly) {
      conditions.push(eq(services.isActive, true));
    }
    if (search) {
      conditions.push(
        or(
          ilike(services.name, `%${search}%`),
          ilike(services.description, `%${search}%`)
        )
      );
    }
    if (category) {
      conditions.push(eq(services.category, category));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : void 0;
    const totalResult = await db.select({ count: count() }).from(services).where(whereClause);
    const total = totalResult[0].count;
    const sortColumn = services[sortBy] || services.name;
    const orderClause = sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);
    const servicesResult = await db.select().from(services).where(whereClause).orderBy(orderClause).limit(limit).offset(offset);
    return {
      services: servicesResult,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
  async getService(id) {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }
  async createService(service) {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }
  async updateService(id, service) {
    const [updatedService] = await db.update(services).set({ ...service, updatedAt: /* @__PURE__ */ new Date() }).where(eq(services.id, id)).returning();
    return updatedService;
  }
  async deleteService(id) {
    const result = await db.delete(services).where(eq(services.id, id));
    return result.rowCount > 0;
  }
  async getServiceCategories() {
    const categories = await db.select({ category: services.category }).from(services).where(and(eq(services.isActive, true), services.category)).groupBy(services.category);
    return categories.map((c) => c.category).filter(Boolean);
  }
  async bulkUpdateServiceStatus(serviceIds, isActive) {
    const result = await db.update(services).set({ isActive, updatedAt: /* @__PURE__ */ new Date() }).where(eq(services.id, serviceIds[0]));
    return result.rowCount;
  }
  // Analytics operations
  async getDashboardKPIs(userId) {
    const [revenueResult] = await db.select({ total: sum(invoices.paidAmount) }).from(invoices).where(eq(invoices.createdBy, userId));
    const [clientsResult] = await db.select({ count: count() }).from(clients).where(and(eq(clients.createdBy, userId), eq(clients.status, "active")));
    const [pendingInvoicesResult] = await db.select({ total: sum(invoices.amount) }).from(invoices).where(and(eq(invoices.createdBy, userId), eq(invoices.status, "pending")));
    return {
      totalRevenue: parseFloat(revenueResult.total || "0"),
      activeClients: clientsResult.count || 0,
      pendingInvoices: parseFloat(pendingInvoicesResult.total || "0"),
      teamPerformance: 94
      // This would be calculated based on actual performance metrics
    };
  }
};
var storage = new DatabaseStorage();

// server/auth.ts
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}
async function comparePasswords(supplied, stored) {
  return await bcrypt.compare(supplied, stored);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "your-super-secret-session-key-change-this-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1e3
      // 24 hours
    }
  };
  app2.set("trust proxy", 1);
  app2.use(session(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !user.passwordHash) {
          return done(null, false, { message: "Invalid username or password" });
        }
        const isValid = await comparePasswords(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: "Invalid username or password" });
        }
        const { passwordHash, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        const { passwordHash, ...userWithoutPassword } = user;
        done(null, userWithoutPassword);
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, email, firstName, lastName } = req.body;
      if (!username || !password || !email) {
        return res.status(400).json({ message: "Username, password, and email are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email,
        firstName: firstName || "",
        lastName: lastName || "",
        passwordHash: hashedPassword,
        role: "user",
        // Default role
        department: "operations",
        // Default department
        isActive: true
      });
      const { passwordHash, ...userWithoutPassword } = user;
      req.login(userWithoutPassword, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });
  app2.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err2) => {
        if (err2) return next(err2);
        res.json(user);
      });
    })(req, res, next);
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err2) => {
        if (err2) return next(err2);
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out successfully" });
      });
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
}
function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// server/database-routes.ts
import { eq as eq2, sql as sql2 } from "drizzle-orm";
function setupDatabaseRoutes(app2) {
  app2.patch("/api/clients/:id/status", async (req, res) => {
    try {
      const [updatedClient] = await db.update(clients).set({ status: req.body.status, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(clients.id, req.params.id)).returning();
      res.json(updatedClient);
    } catch (error) {
      console.error("Error updating client status:", error);
      res.status(500).json({ message: "Failed to update client status" });
    }
  });
  app2.patch("/api/tasks/:id/status", async (req, res) => {
    try {
      const updateData = {
        status: req.body.status,
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (req.body.status === "completed") {
        updateData.completedDate = /* @__PURE__ */ new Date();
      }
      const [updatedTask] = await db.update(tasks).set(updateData).where(eq2(tasks.id, req.params.id)).returning();
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ message: "Failed to update task status" });
    }
  });
  app2.patch("/api/expenses/:id/status", async (req, res) => {
    try {
      const [updatedExpense] = await db.update(expenses).set({ status: req.body.status, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(expenses.id, req.params.id)).returning();
      res.json(updatedExpense);
    } catch (error) {
      console.error("Error updating expense status:", error);
      res.status(500).json({ message: "Failed to update expense status" });
    }
  });
  app2.patch("/api/quotations/:id/status", async (req, res) => {
    try {
      const [updatedQuotation] = await db.update(quotations).set({ status: req.body.status, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(quotations.id, req.params.id)).returning();
      res.json(updatedQuotation);
    } catch (error) {
      console.error("Error updating quotation status:", error);
      res.status(500).json({ message: "Failed to update quotation status" });
    }
  });
  app2.patch("/api/invoices/:id/status", async (req, res) => {
    try {
      const updateData = {
        status: req.body.status,
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (req.body.status === "paid") {
        updateData.paidDate = /* @__PURE__ */ new Date();
        updateData.paidAmount = updateData.amount;
      }
      const [updatedInvoice] = await db.update(invoices).set(updateData).where(eq2(invoices.id, req.params.id)).returning();
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });
  app2.get("/api/sidebar/counters", async (req, res) => {
    try {
      const clientsCount = await db.execute(sql2`SELECT COUNT(*) as count FROM clients`);
      const quotationsCount = await db.execute(sql2`SELECT COUNT(*) as count FROM quotations`);
      const invoicesCount = await db.execute(sql2`SELECT COUNT(*) as count FROM invoices`);
      const expensesCount = await db.execute(sql2`SELECT COUNT(*) as count FROM expenses`);
      const employeesCount = await db.execute(sql2`SELECT COUNT(*) as count FROM employees`);
      const tasksCount = await db.execute(sql2`SELECT COUNT(*) as count FROM tasks`);
      const counters = {
        clients: parseInt(clientsCount[0]?.count?.toString() || "0"),
        quotations: parseInt(quotationsCount[0]?.count?.toString() || "0"),
        invoices: parseInt(invoicesCount[0]?.count?.toString() || "0"),
        expenses: parseInt(expensesCount[0]?.count?.toString() || "0"),
        employees: parseInt(employeesCount[0]?.count?.toString() || "0"),
        tasks: parseInt(tasksCount[0]?.count?.toString() || "0")
      };
      res.json(counters);
    } catch (error) {
      console.error("Error fetching sidebar counters:", error);
      res.status(500).json({ message: "Failed to fetch counters" });
    }
  });
  app2.get("/api/clients", async (req, res) => {
    try {
      const clientsData = await db.select().from(clients);
      res.json(clientsData);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });
  app2.post("/api/clients", async (req, res) => {
    try {
      const userId = req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0";
      const clientData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        city: req.body.city,
        country: req.body.country,
        status: req.body.status || "active",
        totalValue: req.body.totalValue || "0",
        createdBy: userId
      };
      const [newClient] = await db.insert(clients).values(clientData).returning();
      res.status(201).json(newClient);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });
  app2.get("/api/quotations", async (req, res) => {
    try {
      const quotationsData = await db.select().from(quotations);
      res.json(quotationsData);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });
  app2.post("/api/quotations", async (req, res) => {
    try {
      const userId = req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0";
      const quotationData = {
        quotationNumber: `QUO-2024-${String(Math.floor(Math.random() * 1e3)).padStart(3, "0")}`,
        clientId: req.body.clientId,
        title: req.body.title,
        description: req.body.description,
        amount: 0,
        // Start with 0, will be calculated from items
        status: "draft",
        validUntil: req.body.validUntil ? new Date(req.body.validUntil) : null,
        notes: req.body.notes || null,
        terms: req.body.terms || null,
        createdBy: userId
      };
      const [newQuotation] = await db.insert(quotations).values(quotationData).returning();
      res.status(201).json(newQuotation);
    } catch (error) {
      console.error("Error creating quotation:", error);
      res.status(500).json({ message: "Failed to create quotation" });
    }
  });
  app2.get("/api/invoices", async (req, res) => {
    try {
      const invoicesData = await db.select().from(invoices);
      res.json(invoicesData);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });
  app2.post("/api/invoices", async (req, res) => {
    try {
      const invoiceData = {
        invoiceNumber: `INV-2025-${String(Math.floor(Math.random() * 1e3)).padStart(3, "0")}`,
        clientId: req.body.clientId,
        quotationId: req.body.quotationId || null,
        title: req.body.title || "New Invoice",
        description: req.body.description || null,
        amount: req.body.amount || "0",
        subtotal: req.body.subtotal || req.body.amount || "0",
        taxRate: req.body.taxRate || "0",
        taxAmount: req.body.taxAmount || "0",
        discountRate: req.body.discountRate || "0",
        discountAmount: req.body.discountAmount || "0",
        paidAmount: "0",
        status: "draft",
        invoiceDate: /* @__PURE__ */ new Date(),
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3),
        notes: req.body.notes || null,
        paymentTerms: req.body.paymentTerms || null,
        createdBy: req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0"
      };
      const [newInvoice] = await db.insert(invoices).values(invoiceData).returning();
      res.status(201).json(newInvoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });
  app2.get("/api/invoices/:id", async (req, res) => {
    try {
      const [invoice] = await db.select().from(invoices).where(eq2(invoices.id, req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });
  app2.patch("/api/invoices/:id", async (req, res) => {
    try {
      const updateData = { ...req.body, updatedAt: /* @__PURE__ */ new Date() };
      const [updatedInvoice] = await db.update(invoices).set(updateData).where(eq2(invoices.id, req.params.id)).returning();
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });
  app2.get("/api/invoices/:id/items", async (req, res) => {
    try {
      const items = await db.select().from(invoiceItems).where(eq2(invoiceItems.invoiceId, req.params.id));
      res.json(items);
    } catch (error) {
      console.error("Error fetching invoice items:", error);
      res.status(500).json({ message: "Failed to fetch invoice items" });
    }
  });
  app2.post("/api/invoices/:id/items", async (req, res) => {
    try {
      const itemData = {
        invoiceId: req.params.id,
        serviceId: req.body.serviceId || null,
        name: req.body.name,
        description: req.body.description || null,
        quantity: req.body.quantity,
        unitPrice: req.body.unitPrice,
        totalPrice: (parseFloat(req.body.quantity) * parseFloat(req.body.unitPrice)).toFixed(2)
      };
      const [newItem] = await db.insert(invoiceItems).values(itemData).returning();
      const items = await db.select().from(invoiceItems).where(eq2(invoiceItems.invoiceId, req.params.id));
      const subtotal = items.reduce((sum3, item) => sum3 + parseFloat(item.totalPrice), 0);
      await db.update(invoices).set({
        subtotal: subtotal.toFixed(2),
        amount: subtotal.toFixed(2),
        // For now, assume no tax/discount
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(invoices.id, req.params.id));
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating invoice item:", error);
      res.status(500).json({ message: "Failed to create invoice item" });
    }
  });
  app2.delete("/api/invoices/:invoiceId/items/:itemId", async (req, res) => {
    try {
      await db.delete(invoiceItems).where(eq2(invoiceItems.id, req.params.itemId));
      const items = await db.select().from(invoiceItems).where(eq2(invoiceItems.invoiceId, req.params.invoiceId));
      const subtotal = items.reduce((sum3, item) => sum3 + parseFloat(item.totalPrice), 0);
      await db.update(invoices).set({
        subtotal: subtotal.toFixed(2),
        amount: subtotal.toFixed(2),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(invoices.id, req.params.invoiceId));
      res.json({ message: "Invoice item deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice item:", error);
      res.status(500).json({ message: "Failed to delete invoice item" });
    }
  });
  app2.get("/api/invoices/:id/payments", async (req, res) => {
    try {
      const paymentRecords = await db.select().from(payments).where(eq2(payments.invoiceId, req.params.id));
      res.json(paymentRecords);
    } catch (error) {
      console.error("Error fetching payment records:", error);
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });
  app2.post("/api/invoices/:id/payments", async (req, res) => {
    try {
      const paymentAmount = parseFloat(req.body.amount);
      const isAdminApproved = req.body.adminApproved || false;
      const [invoice] = await db.select().from(invoices).where(eq2(invoices.id, req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const currentPayments = await db.select().from(payments).where(eq2(payments.invoiceId, req.params.id));
      const currentPaidAmount = currentPayments.reduce((sum3, payment) => sum3 + parseFloat(payment.amount), 0);
      const invoiceAmount = parseFloat(invoice.amount);
      const remainingAmount = invoiceAmount - currentPaidAmount;
      const overpaymentAmount = Math.max(0, paymentAmount - remainingAmount);
      const isOverpayment = overpaymentAmount > 0;
      if (isOverpayment && !isAdminApproved) {
        return res.status(400).json({
          error: "OVERPAYMENT_DETECTED",
          message: `Payment amount ($${paymentAmount}) exceeds remaining balance ($${remainingAmount}). Overpayment of $${overpaymentAmount} detected.`,
          details: {
            paymentAmount,
            remainingAmount,
            overpaymentAmount,
            invoiceAmount,
            currentPaidAmount
          }
        });
      }
      const paymentData = {
        invoiceId: req.params.id,
        amount: paymentAmount.toFixed(2),
        overpaymentAmount: overpaymentAmount.toFixed(2),
        isOverpayment,
        adminApproved: isOverpayment && isAdminApproved,
        paymentDate: new Date(req.body.paymentDate),
        paymentMethod: req.body.paymentMethod,
        bankTransferNumber: req.body.bankTransferNumber || null,
        attachmentUrl: req.body.attachmentUrl || null,
        notes: req.body.notes || null,
        createdBy: req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0",
        approvedBy: isOverpayment && isAdminApproved ? req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0" : null
      };
      const [newPayment] = await db.insert(payments).values(paymentData).returning();
      const newTotalPaid = currentPaidAmount + paymentAmount;
      const actualInvoicePayment = Math.min(paymentAmount, remainingAmount);
      const newInvoicePaidAmount = currentPaidAmount + actualInvoicePayment;
      let newStatus = invoice.status;
      let paidDate = invoice.paidDate;
      if (newInvoicePaidAmount >= invoiceAmount) {
        newStatus = "paid";
        paidDate = /* @__PURE__ */ new Date();
      } else if (newInvoicePaidAmount > 0) {
        newStatus = "partially_paid";
      }
      await db.update(invoices).set({
        paidAmount: newInvoicePaidAmount.toFixed(2),
        status: newStatus,
        paidDate,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(invoices.id, req.params.id));
      if (isOverpayment && isAdminApproved) {
        const [client] = await db.select().from(clients).where(eq2(clients.id, invoice.clientId));
        const previousCreditBalance = parseFloat(client.creditBalance || "0");
        const newCreditBalance = previousCreditBalance + overpaymentAmount;
        await db.update(clients).set({
          creditBalance: newCreditBalance.toFixed(2),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(clients.id, invoice.clientId));
        await db.insert(clientCreditHistory).values({
          clientId: invoice.clientId,
          type: "credit_added",
          amount: overpaymentAmount.toFixed(2),
          relatedInvoiceId: invoice.id,
          relatedPaymentId: newPayment.id,
          description: `Overpayment credit from invoice ${invoice.invoiceNumber}`,
          notes: `Payment amount: $${paymentAmount}, Invoice balance: $${remainingAmount}`,
          previousBalance: previousCreditBalance.toFixed(2),
          newBalance: newCreditBalance.toFixed(2),
          createdBy: req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0"
        });
      }
      res.status(201).json({
        payment: newPayment,
        overpaymentHandled: isOverpayment && isAdminApproved,
        creditAdded: isOverpayment && isAdminApproved ? overpaymentAmount : 0
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });
  app2.post("/api/invoices/:id/refund", async (req, res) => {
    try {
      const { refundAmount, refundMethod, refundReference, notes } = req.body;
      const refundAmountNum = parseFloat(refundAmount);
      if (!refundAmountNum || refundAmountNum <= 0) {
        return res.status(400).json({ message: "Invalid refund amount" });
      }
      const [invoice] = await db.select().from(invoices).where(eq2(invoices.id, req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const paidAmount = parseFloat(invoice.paidAmount || "0");
      if (refundAmountNum > paidAmount) {
        return res.status(400).json({
          message: `Refund amount (${refundAmountNum}) cannot exceed paid amount (${paidAmount})`
        });
      }
      const refundPayment = await db.insert(payments).values({
        invoiceId: req.params.id,
        amount: (-Math.abs(refundAmountNum)).toString(),
        paymentDate: /* @__PURE__ */ new Date(),
        paymentMethod: refundMethod || "bank_transfer",
        bankTransferNumber: refundReference,
        notes: notes || `Partial refund: ${refundAmountNum}`,
        isRefund: true,
        refundReference,
        createdBy: "1"
      }).returning().then((rows) => rows[0]);
      const newPaidAmount = paidAmount - refundAmountNum;
      const invoiceAmount = parseFloat(invoice.amount || "0");
      let newStatus = invoice.status;
      if (newPaidAmount <= 0) {
        newStatus = "refunded";
      } else if (newPaidAmount < invoiceAmount) {
        newStatus = "partially_refunded";
      }
      await db.update(invoices).set({
        paidAmount: newPaidAmount.toString(),
        status: newStatus,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(invoices.id, req.params.id));
      res.json({
        success: true,
        refundAmount: refundAmountNum,
        refundPayment,
        newPaidAmount,
        newStatus,
        message: `Successfully processed refund of ${refundAmountNum}. Invoice status updated to ${newStatus}.`
      });
    } catch (error) {
      console.error("Error processing refund:", error);
      res.status(500).json({ message: "Failed to process refund" });
    }
  });
  app2.post("/api/clients/:clientId/credit/refund", async (req, res) => {
    try {
      const { refundAmount, refundMethod, refundReference, notes } = req.body;
      const refundAmountNum = parseFloat(refundAmount);
      if (!refundAmountNum || refundAmountNum <= 0) {
        return res.status(400).json({ message: "Invalid refund amount" });
      }
      const [client] = await db.select().from(clients).where(eq2(clients.id, req.params.clientId));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      const availableCredit = parseFloat(client.creditBalance || "0");
      if (refundAmountNum > availableCredit) {
        return res.status(400).json({
          message: `Refund amount (${refundAmountNum}) cannot exceed available credit (${availableCredit})`
        });
      }
      const newCreditBalance = availableCredit - refundAmountNum;
      await db.update(clients).set({
        creditBalance: newCreditBalance.toFixed(2),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(clients.id, req.params.clientId));
      await db.insert(clientCreditHistory).values({
        clientId: req.params.clientId,
        type: "credit_refunded",
        amount: refundAmountNum.toFixed(2),
        description: `Credit refunded via ${refundMethod}${refundReference ? ` - Ref: ${refundReference}` : ""}`,
        notes: notes || `Credit balance refunded to client`,
        refundReference,
        previousBalance: availableCredit.toFixed(2),
        newBalance: newCreditBalance.toFixed(2),
        createdBy: req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0"
      });
      res.json({
        success: true,
        refundAmount: refundAmountNum,
        refundMethod,
        refundReference,
        newCreditBalance,
        message: `Successfully processed credit refund of ${refundAmountNum}`
      });
    } catch (error) {
      console.error("Error processing credit refund:", error);
      res.status(500).json({ message: "Failed to process credit refund" });
    }
  });
  app2.get("/api/clients/:id/credit", async (req, res) => {
    try {
      const [client] = await db.select().from(clients).where(eq2(clients.id, req.params.id));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      const creditHistory = await db.select().from(clientCreditHistory).where(eq2(clientCreditHistory.clientId, req.params.id)).orderBy(sql2`${clientCreditHistory.createdAt} DESC`);
      res.json({
        currentBalance: parseFloat(client.creditBalance || "0"),
        history: creditHistory
      });
    } catch (error) {
      console.error("Error fetching client credit:", error);
      res.status(500).json({ message: "Failed to fetch client credit" });
    }
  });
  app2.post("/api/invoices/:invoiceId/apply-credit", async (req, res) => {
    try {
      const { clientId, creditAmount } = req.body;
      const creditAmountNum = parseFloat(creditAmount);
      const [client] = await db.select().from(clients).where(eq2(clients.id, clientId));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      const currentCreditBalance = parseFloat(client.creditBalance || "0");
      if (creditAmountNum > currentCreditBalance) {
        return res.status(400).json({
          message: "Insufficient credit balance",
          availableCredit: currentCreditBalance,
          requestedCredit: creditAmountNum
        });
      }
      const [invoice] = await db.select().from(invoices).where(eq2(invoices.id, req.params.invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const currentPayments = await db.select().from(payments).where(eq2(payments.invoiceId, req.params.invoiceId));
      const currentPaidAmount = currentPayments.reduce((sum3, payment) => sum3 + parseFloat(payment.amount), 0);
      const remainingAmount = parseFloat(invoice.amount) - currentPaidAmount;
      const actualCreditUsed = Math.min(creditAmountNum, remainingAmount);
      const creditPayment = {
        invoiceId: req.params.invoiceId,
        amount: actualCreditUsed.toFixed(2),
        overpaymentAmount: "0",
        isOverpayment: false,
        adminApproved: true,
        paymentDate: /* @__PURE__ */ new Date(),
        paymentMethod: "credit_balance",
        bankTransferNumber: null,
        attachmentUrl: null,
        notes: `Applied client credit balance: $${actualCreditUsed}`,
        createdBy: req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0",
        approvedBy: req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0"
      };
      const [newPayment] = await db.insert(payments).values(creditPayment).returning();
      const newCreditBalance = currentCreditBalance - actualCreditUsed;
      await db.update(clients).set({
        creditBalance: newCreditBalance.toFixed(2),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(clients.id, clientId));
      await db.insert(clientCreditHistory).values({
        clientId,
        type: "credit_used",
        amount: actualCreditUsed.toFixed(2),
        relatedInvoiceId: invoice.id,
        relatedPaymentId: newPayment.id,
        description: `Credit applied to invoice ${invoice.invoiceNumber}`,
        notes: `Credit balance applied to outstanding invoice`,
        previousBalance: currentCreditBalance.toFixed(2),
        newBalance: newCreditBalance.toFixed(2),
        createdBy: req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0"
      });
      const newPaidAmount = currentPaidAmount + actualCreditUsed;
      let newStatus = invoice.status;
      let paidDate = invoice.paidDate;
      if (newPaidAmount >= parseFloat(invoice.amount)) {
        newStatus = "paid";
        paidDate = /* @__PURE__ */ new Date();
      } else if (newPaidAmount > 0) {
        newStatus = "partially_paid";
      }
      await db.update(invoices).set({
        paidAmount: newPaidAmount.toFixed(2),
        status: newStatus,
        paidDate,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(invoices.id, req.params.invoiceId));
      res.json({
        payment: newPayment,
        creditUsed: actualCreditUsed,
        remainingCredit: newCreditBalance
      });
    } catch (error) {
      console.error("Error applying credit:", error);
      res.status(500).json({ message: "Failed to apply credit" });
    }
  });
  app2.get("/api/clients/:id", async (req, res) => {
    try {
      const [client] = await db.select().from(clients).where(eq2(clients.id, req.params.id));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });
  app2.patch("/api/clients/:id", async (req, res) => {
    try {
      const [updatedClient] = await db.update(clients).set({ ...req.body, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(clients.id, req.params.id)).returning();
      res.json(updatedClient);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });
  app2.get("/api/clients/:id/quotations", async (req, res) => {
    try {
      const clientQuotations = await db.select().from(quotations).where(eq2(quotations.clientId, req.params.id));
      res.json(clientQuotations);
    } catch (error) {
      console.error("Error fetching client quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });
  app2.get("/api/clients/:id/invoices", async (req, res) => {
    try {
      const clientInvoices = await db.select().from(invoices).where(eq2(invoices.clientId, req.params.id));
      res.json(clientInvoices);
    } catch (error) {
      console.error("Error fetching client invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });
  app2.get("/api/clients/:id/notes", async (req, res) => {
    try {
      const clientNotesList = await db.select().from(clientNotes).where(eq2(clientNotes.clientId, req.params.id));
      res.json(clientNotesList);
    } catch (error) {
      console.error("Error fetching client notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });
  app2.post("/api/clients/:id/notes", async (req, res) => {
    try {
      const noteData = {
        clientId: req.params.id,
        note: req.body.note,
        type: req.body.type || "note",
        createdBy: req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0"
      };
      const [newNote] = await db.insert(clientNotes).values(noteData).returning();
      res.status(201).json(newNote);
    } catch (error) {
      console.error("Error creating client note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });
  app2.get("/api/services", async (req, res) => {
    try {
      const servicesList = await db.select().from(services).where(eq2(services.isActive, true));
      res.json(servicesList);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });
  app2.post("/api/services/initialize", async (req, res) => {
    try {
      const existingServices = await db.select().from(services);
      if (existingServices.length === 0) {
        const defaultServices = [
          { name: "Web Design", description: "Custom website design", defaultPrice: "2500.00", category: "web-design" },
          { name: "Web Development", description: "Full-stack web development", defaultPrice: "5000.00", category: "development" },
          { name: "Mobile App Development", description: "iOS and Android app development", defaultPrice: "8000.00", category: "development" },
          { name: "SEO Optimization", description: "Search engine optimization services", defaultPrice: "1500.00", category: "marketing" },
          { name: "Digital Marketing", description: "Comprehensive digital marketing campaign", defaultPrice: "3000.00", category: "marketing" },
          { name: "Business Consulting", description: "Strategic business consultation", defaultPrice: "200.00", category: "consulting" },
          { name: "UI/UX Design", description: "User interface and experience design", defaultPrice: "1800.00", category: "web-design" },
          { name: "E-commerce Solution", description: "Complete e-commerce platform setup", defaultPrice: "6000.00", category: "development" }
        ];
        await db.insert(services).values(defaultServices);
        res.json({ message: "Default services initialized" });
      } else {
        res.json({ message: "Services already exist" });
      }
    } catch (error) {
      console.error("Error initializing services:", error);
      res.status(500).json({ message: "Failed to initialize services" });
    }
  });
  app2.get("/api/quotations/:id/items", async (req, res) => {
    try {
      const items = await db.select().from(quotationItems).where(eq2(quotationItems.quotationId, req.params.id));
      res.json(items);
    } catch (error) {
      console.error("Error fetching quotation items:", error);
      res.status(500).json({ message: "Failed to fetch quotation items" });
    }
  });
  app2.post("/api/quotations/:id/items", async (req, res) => {
    try {
      const itemData = {
        quotationId: req.params.id,
        serviceId: req.body.serviceId,
        description: req.body.description,
        quantity: req.body.quantity,
        unitPrice: req.body.unitPrice,
        totalPrice: req.body.totalPrice,
        discount: req.body.discount || "0.00"
      };
      const [newItem] = await db.insert(quotationItems).values(itemData).returning();
      const allItems = await db.select().from(quotationItems).where(eq2(quotationItems.quotationId, req.params.id));
      const totalAmount = allItems.reduce((sum3, item) => sum3 + parseFloat(item.totalPrice), 0);
      await db.update(quotations).set({ amount: totalAmount.toFixed(2), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(quotations.id, req.params.id));
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating quotation item:", error);
      res.status(500).json({ message: "Failed to create quotation item" });
    }
  });
  app2.get("/api/quotations/:id", async (req, res) => {
    try {
      const [quotation] = await db.select().from(quotations).where(eq2(quotations.id, req.params.id));
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      res.json(quotation);
    } catch (error) {
      console.error("Error fetching quotation:", error);
      res.status(500).json({ message: "Failed to fetch quotation" });
    }
  });
  app2.patch("/api/quotations/:id", async (req, res) => {
    try {
      const updateData = { ...req.body, updatedAt: /* @__PURE__ */ new Date() };
      if (req.body.status && !req.body.amount) {
        const items = await db.select().from(quotationItems).where(eq2(quotationItems.quotationId, req.params.id));
        const totalAmount = items.reduce((sum3, item) => sum3 + parseFloat(item.totalPrice), 0);
        updateData.amount = totalAmount.toFixed(2);
      }
      const [updatedQuotation] = await db.update(quotations).set(updateData).where(eq2(quotations.id, req.params.id)).returning();
      res.json(updatedQuotation);
    } catch (error) {
      console.error("Error updating quotation:", error);
      res.status(500).json({ message: "Failed to update quotation" });
    }
  });
  app2.post("/api/quotations/:id/convert-to-invoice", async (req, res) => {
    try {
      const [quotation] = await db.select().from(quotations).where(eq2(quotations.id, req.params.id));
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      const items = await db.select().from(quotationItems).where(eq2(quotationItems.quotationId, req.params.id));
      const totalAmount = items.reduce((sum3, item) => sum3 + parseFloat(item.totalPrice), 0);
      const invoiceData = {
        invoiceNumber: `INV-2024-${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`,
        clientId: quotation.clientId,
        quotationId: quotation.id,
        amount: totalAmount.toFixed(2),
        paidAmount: "0.00",
        status: "pending",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3),
        // 30 days from now
        createdBy: req.user?.id || "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0"
      };
      const [newInvoice] = await db.insert(invoices).values(invoiceData).returning();
      await db.update(quotations).set({ status: "invoiced", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(quotations.id, req.params.id));
      res.status(201).json({ invoice: newInvoice, message: "Quotation converted to invoice successfully" });
    } catch (error) {
      console.error("Error converting quotation to invoice:", error);
      res.status(500).json({ message: "Failed to convert quotation to invoice" });
    }
  });
  app2.get("/api/quotations/:id/export-pdf", async (req, res) => {
    try {
      const [quotation] = await db.select().from(quotations).where(eq2(quotations.id, req.params.id));
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      const [client] = await db.select().from(clients).where(eq2(clients.id, quotation.clientId));
      const items = await db.select().from(quotationItems).where(eq2(quotationItems.quotationId, req.params.id));
      const totalAmount = items.reduce((sum3, item) => sum3 + parseFloat(item.totalPrice), 0);
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Quotation ${quotation.quotationNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 40px; }
            .company-info { margin-bottom: 30px; }
            .client-info { margin-bottom: 30px; }
            .quotation-details { margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>QUOTATION</h1>
            <p>Quotation Number: ${quotation.quotationNumber}</p>
          </div>
          
          <div class="company-info">
            <h3>CompanyOS</h3>
            <p>123 Business Street<br>
            Business City, BC 12345<br>
            Phone: (555) 123-4567<br>
            Email: info@companyos.com</p>
          </div>
          
          <div class="client-info">
            <h3>Bill To:</h3>
            <p><strong>${client?.name || "N/A"}</strong><br>
            ${client?.email || ""}<br>
            ${client?.phone || ""}<br>
            ${client?.city || ""}, ${client?.country || ""}</p>
          </div>
          
          <div class="quotation-details">
            <p><strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString()}</p>
            <p><strong>Valid Until:</strong> ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "N/A"}</p>
            <p><strong>Status:</strong> ${quotation.status.toUpperCase()}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>$${parseFloat(item.unitPrice).toFixed(2)}</td>
                  <td>${parseFloat(item.discount).toFixed(1)}%</td>
                  <td>$${parseFloat(item.totalPrice).toFixed(2)}</td>
                </tr>
              `).join("")}
              <tr class="total-row">
                <td colspan="4"><strong>TOTAL</strong></td>
                <td><strong>$${totalAmount.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p><strong>Terms & Conditions:</strong></p>
            <p>Payment due within 30 days of quotation acceptance. All prices are in USD. This quotation is valid for 30 days from the date of issue.</p>
            <br>
            <p>Thank you for your business!</p>
          </div>
        </body>
        </html>
      `;
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Disposition", `inline; filename="quotation-${quotation.quotationNumber}.html"`);
      res.send(htmlContent);
    } catch (error) {
      console.error("Error exporting quotation:", error);
      res.status(500).json({ message: "Failed to export quotation" });
    }
  });
  app2.delete("/api/quotations/:id/items/:itemId", async (req, res) => {
    try {
      await db.delete(quotationItems).where(eq2(quotationItems.id, req.params.itemId));
      res.json({ message: "Item deleted successfully" });
    } catch (error) {
      console.error("Error deleting quotation item:", error);
      res.status(500).json({ message: "Failed to delete quotation item" });
    }
  });
}

// server/expense-routes.ts
import { eq as eq3, desc as desc2, and as and2, gte as gte2, lte as lte2, ilike as ilike2, or as or2 } from "drizzle-orm";
async function handlePaymentSourceTransaction(paymentSourceId, amount, expenseId, expenseTitle, userId) {
  const [paymentSource] = await db.select().from(paymentSources).where(eq3(paymentSources.id, paymentSourceId));
  if (!paymentSource) {
    throw new Error("Payment source not found");
  }
  const balanceBefore = parseFloat(paymentSource.currentBalance || "0");
  const expenseAmount = parseFloat(amount);
  const balanceAfter = balanceBefore - expenseAmount;
  await db.update(paymentSources).set({
    currentBalance: balanceAfter.toString(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq3(paymentSources.id, paymentSourceId));
  await db.insert(paymentSourceTransactions).values({
    paymentSourceId,
    type: "expense",
    amount: expenseAmount.toString(),
    description: `Expense payment: ${expenseTitle}`,
    referenceId: expenseId,
    referenceType: "expense",
    balanceBefore: balanceBefore.toString(),
    balanceAfter: balanceAfter.toString(),
    createdBy: userId
  });
}
function registerExpenseRoutes(app2) {
  app2.get("/api/expense-categories", async (req, res) => {
    try {
      const categories = await db.select().from(expenseCategories).where(eq3(expenseCategories.isActive, true)).orderBy(expenseCategories.name);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching expense categories:", error);
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });
  app2.post("/api/expense-categories", async (req, res) => {
    try {
      const categoryData = req.body;
      const [category] = await db.insert(expenseCategories).values(categoryData).returning();
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating expense category:", error);
      res.status(500).json({ message: "Failed to create expense category" });
    }
  });
  app2.get("/api/expenses/stats", async (req, res) => {
    try {
      const { period = "month" } = req.query;
      const now = /* @__PURE__ */ new Date();
      let startDate = /* @__PURE__ */ new Date();
      switch (period) {
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          startDate.setMonth(now.getMonth() - 3);
          break;
        case "year":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      const expenseResults = await db.select({
        expense: expenses,
        category: expenseCategories
      }).from(expenses).leftJoin(expenseCategories, eq3(expenses.categoryId, expenseCategories.id)).where(
        and2(
          gte2(expenses.expenseDate, startDate),
          lte2(expenses.expenseDate, now)
        )
      );
      const allExpenses = Array.isArray(expenseResults) ? expenseResults : [];
      const totalExpenses = allExpenses.length;
      const totalAmount = allExpenses.reduce((sum3, item) => sum3 + parseFloat(item.expense.amount), 0);
      const paidExpenses = allExpenses.filter((item) => item.expense.status === "paid");
      const pendingExpenses = allExpenses.filter((item) => item.expense.status === "pending");
      const overdueExpenses = allExpenses.filter((item) => item.expense.status === "overdue");
      const paidAmount = paidExpenses.reduce((sum3, item) => sum3 + parseFloat(item.expense.amount), 0);
      const pendingAmount = pendingExpenses.reduce((sum3, item) => sum3 + parseFloat(item.expense.amount), 0);
      const categoryBreakdown = allExpenses.reduce((acc, item) => {
        const category = item.category;
        const expense = item.expense;
        if (!category) return acc;
        if (!acc[category.name]) {
          acc[category.name] = {
            name: category.name,
            color: category.color,
            amount: 0,
            count: 0
          };
        }
        acc[category.name].amount += parseFloat(expense.amount);
        acc[category.name].count += 1;
        return acc;
      }, {});
      res.json({
        totalExpenses,
        totalAmount,
        paidExpenses: paidExpenses.length,
        paidAmount,
        pendingExpenses: pendingExpenses.length,
        pendingAmount,
        overdueExpenses: overdueExpenses.length,
        categoryBreakdown: Object.values(categoryBreakdown)
      });
    } catch (error) {
      console.error("Error calculating expense statistics:", error);
      res.status(500).json({ message: "Failed to calculate expense statistics" });
    }
  });
  app2.get("/api/expenses", async (req, res) => {
    try {
      const {
        type,
        categoryId,
        status,
        startDate,
        endDate,
        search,
        clientId
      } = req.query;
      let baseQuery = db.select({
        expense: expenses,
        category: expenseCategories
      }).from(expenses).leftJoin(expenseCategories, eq3(expenses.categoryId, expenseCategories.id));
      const conditions = [];
      if (type) {
        conditions.push(eq3(expenses.type, type));
      }
      if (categoryId) {
        conditions.push(eq3(expenses.categoryId, categoryId));
      }
      if (status) {
        conditions.push(eq3(expenses.status, status));
      }
      if (clientId) {
        conditions.push(eq3(expenses.relatedClientId, clientId));
      }
      if (startDate) {
        conditions.push(gte2(expenses.expenseDate, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte2(expenses.expenseDate, new Date(endDate)));
      }
      if (search) {
        conditions.push(
          or2(
            ilike2(expenses.title, `%${search}%`),
            ilike2(expenses.description, `%${search}%`)
          )
        );
      }
      let query = baseQuery;
      if (conditions.length > 0) {
        query = baseQuery.where(and2(...conditions));
      }
      const results = await query.orderBy(desc2(expenses.createdAt));
      const expensesWithCategories = results.map((result) => ({
        ...result.expense,
        category: result.category
      }));
      res.json(expensesWithCategories);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });
  app2.get("/api/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [result] = await db.select({
        expense: expenses,
        category: expenseCategories
      }).from(expenses).leftJoin(expenseCategories, eq3(expenses.categoryId, expenseCategories.id)).where(eq3(expenses.id, id));
      if (!result) {
        return res.status(404).json({ message: "Expense not found" });
      }
      const expenseWithCategory = {
        ...result.expense,
        category: result.category
      };
      res.json(expenseWithCategory);
    } catch (error) {
      console.error("Error fetching expense:", error);
      res.status(500).json({ message: "Failed to fetch expense" });
    }
  });
  app2.post("/api/expenses", async (req, res) => {
    try {
      const userId = "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0";
      console.log("Received expense payload:", JSON.stringify(req.body, null, 2));
      const expenseData = {
        ...req.body,
        expenseDate: new Date(req.body.expenseDate),
        createdBy: userId,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
      console.log("Final expense data for DB (dates converted):", {
        ...expenseData,
        expenseDate: expenseData.expenseDate?.toISOString(),
        createdAt: expenseData.createdAt?.toISOString(),
        updatedAt: expenseData.updatedAt?.toISOString()
      });
      if (!expenseData.attachmentUrl || !expenseData.attachmentType) {
        return res.status(400).json({
          message: "Attachment is mandatory for all expense records"
        });
      }
      const [expense] = await db.insert(expenses).values(expenseData).returning();
      if (expense.status === "paid" && expense.paymentSourceId) {
        await handlePaymentSourceTransaction(expense.paymentSourceId, expense.amount, expense.id, expense.title, userId);
      }
      if (expense.isRecurring && expense.status === "paid") {
        await db.insert(expensePayments).values({
          expenseId: expense.id,
          amount: expense.amount,
          paymentDate: expense.paidDate || /* @__PURE__ */ new Date(),
          paymentMethod: expense.paymentMethod,
          paymentReference: expense.paymentReference,
          attachmentUrl: expense.attachmentUrl,
          notes: `Initial payment for recurring expense: ${expense.title}`,
          createdBy: userId
        });
      }
      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });
  app2.put("/api/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0";
      console.log("Received expense update payload:", JSON.stringify(req.body, null, 2));
      const updates = {
        ...req.body,
        expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : void 0,
        updatedAt: /* @__PURE__ */ new Date()
      };
      console.log("Final update data for DB (dates converted):", {
        ...updates,
        expenseDate: updates.expenseDate?.toISOString(),
        updatedAt: updates.updatedAt?.toISOString()
      });
      const [expense] = await db.update(expenses).set(updates).where(eq3(expenses.id, id)).returning();
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });
  app2.post("/api/expenses/:id/pay", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0";
      const {
        amount,
        paymentMethod,
        paymentReference,
        attachmentUrl,
        notes
      } = req.body;
      if (!attachmentUrl) {
        return res.status(400).json({
          message: "Payment attachment is mandatory"
        });
      }
      const [existingExpense] = await db.select().from(expenses).where(eq3(expenses.id, id));
      if (!existingExpense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      const [expense] = await db.update(expenses).set({
        status: "paid",
        paidDate: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(expenses.id, id)).returning();
      if (expense.paymentSourceId) {
        await handlePaymentSourceTransaction(
          expense.paymentSourceId,
          expense.amount,
          expense.id,
          expense.title,
          userId
        );
      }
      const [payment] = await db.insert(expensePayments).values({
        expenseId: id,
        amount: amount || expense.amount,
        paymentDate: /* @__PURE__ */ new Date(),
        paymentMethod,
        paymentReference,
        attachmentUrl,
        notes,
        createdBy: userId
      }).returning();
      if (expense.isRecurring && expense.frequency) {
        let nextDueDate = new Date(expense.dueDate || /* @__PURE__ */ new Date());
        switch (expense.frequency) {
          case "monthly":
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            break;
          case "quarterly":
            nextDueDate.setMonth(nextDueDate.getMonth() + 3);
            break;
          case "yearly":
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
            break;
        }
        await db.update(expenses).set({
          nextDueDate,
          status: "pending",
          // Reset status for next payment
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq3(expenses.id, id));
      }
      res.json({ expense, payment });
    } catch (error) {
      console.error("Error processing expense payment:", error);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });
  app2.get("/api/expenses/:id/payments", async (req, res) => {
    try {
      const { id } = req.params;
      const payments3 = await db.select().from(expensePayments).where(eq3(expensePayments.expenseId, id)).orderBy(desc2(expensePayments.paymentDate));
      res.json(payments3);
    } catch (error) {
      console.error("Error fetching expense payments:", error);
      res.status(500).json({ message: "Failed to fetch expense payments" });
    }
  });
  app2.delete("/api/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(expensePayments).where(eq3(expensePayments.expenseId, id));
      const [expense] = await db.delete(expenses).where(eq3(expenses.id, id)).returning();
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });
}

// server/payment-source-routes.ts
import { eq as eq4, desc as desc3, and as and3, gte as gte3, lte as lte3, sql as sql3 } from "drizzle-orm";
var devAuth = (req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    req.user = {
      claims: {
        sub: "1",
        email: "test@company.com"
      }
    };
  }
  next();
};
function registerPaymentSourceRoutes(app2) {
  app2.get("/api/payment-sources", devAuth, async (req, res) => {
    try {
      const sources = await db.select().from(paymentSources).orderBy(desc3(paymentSources.createdAt));
      res.json(sources);
    } catch (error) {
      console.error("Error fetching payment sources:", error);
      res.status(500).json({ message: "Failed to fetch payment sources" });
    }
  });
  app2.get("/api/payment-sources/stats", devAuth, async (req, res) => {
    try {
      const { period = "month" } = req.query;
      const now = /* @__PURE__ */ new Date();
      let startDate;
      switch (period) {
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "quarter":
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      const sourcesData = await db.select({
        totalSources: sql3`COUNT(*)`,
        totalBalance: sql3`SUM(CAST(${paymentSources.currentBalance} AS DECIMAL))`,
        activeSources: sql3`SUM(CASE WHEN ${paymentSources.isActive} THEN 1 ELSE 0 END)`
      }).from(paymentSources);
      const expensesBySource = await db.select({
        paymentSourceId: expenses.paymentSourceId,
        totalSpent: sql3`SUM(CAST(${expenses.amount} AS DECIMAL))`,
        expenseCount: sql3`COUNT(*)`
      }).from(expenses).where(
        and3(
          gte3(expenses.expenseDate, startDate),
          lte3(expenses.expenseDate, now),
          eq4(expenses.status, "approved")
        )
      ).groupBy(expenses.paymentSourceId);
      const stats = sourcesData[0] || { totalSources: 0, totalBalance: 0, activeSources: 0 };
      res.json({
        ...stats,
        expensesBySource,
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      });
    } catch (error) {
      console.error("Error fetching payment source stats:", error);
      res.status(500).json({ message: "Failed to fetch payment source statistics" });
    }
  });
  app2.get("/api/payment-sources/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [source] = await db.select().from(paymentSources).where(eq4(paymentSources.id, id));
      if (!source) {
        return res.status(404).json({ message: "Payment source not found" });
      }
      res.json(source);
    } catch (error) {
      console.error("Error fetching payment source:", error);
      res.status(500).json({ message: "Failed to fetch payment source" });
    }
  });
  app2.post("/api/payment-sources", devAuth, async (req, res) => {
    try {
      const validatedData = insertPaymentSourceSchema.parse(req.body);
      const [newSource] = await db.insert(paymentSources).values({
        ...validatedData,
        currentBalance: validatedData.initialBalance || "0"
      }).returning();
      if (validatedData.initialBalance && parseFloat(validatedData.initialBalance) !== 0) {
        await db.insert(paymentSourceTransactions).values({
          paymentSourceId: newSource.id,
          type: "adjustment",
          amount: validatedData.initialBalance,
          description: "Initial balance setup",
          referenceType: "manual_adjustment",
          balanceBefore: "0",
          balanceAfter: validatedData.initialBalance,
          createdBy: req.user?.claims?.sub
        });
      }
      res.status(201).json(newSource);
    } catch (error) {
      console.error("Error creating payment source:", error);
      res.status(500).json({ message: "Failed to create payment source" });
    }
  });
  app2.put("/api/payment-sources/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertPaymentSourceSchema.parse(req.body);
      const [updatedSource] = await db.update(paymentSources).set({
        ...validatedData,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(paymentSources.id, id)).returning();
      if (!updatedSource) {
        return res.status(404).json({ message: "Payment source not found" });
      }
      res.json(updatedSource);
    } catch (error) {
      console.error("Error updating payment source:", error);
      res.status(500).json({ message: "Failed to update payment source" });
    }
  });
  app2.post("/api/payment-sources/:id/adjust-balance", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, description, type = "adjustment" } = req.body;
      if (!amount || !description) {
        return res.status(400).json({ message: "Amount and description are required" });
      }
      const [source] = await db.select().from(paymentSources).where(eq4(paymentSources.id, id));
      if (!source) {
        return res.status(404).json({ message: "Payment source not found" });
      }
      const currentBalance = parseFloat(source.currentBalance);
      const adjustmentAmount = parseFloat(amount);
      const newBalance = currentBalance + adjustmentAmount;
      const [updatedSource] = await db.update(paymentSources).set({
        currentBalance: newBalance.toString(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(paymentSources.id, id)).returning();
      await db.insert(paymentSourceTransactions).values({
        paymentSourceId: id,
        type,
        amount,
        description,
        referenceType: "manual_adjustment",
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        createdBy: req.user?.claims?.sub
      });
      res.json(updatedSource);
    } catch (error) {
      console.error("Error adjusting balance:", error);
      res.status(500).json({ message: "Failed to adjust balance" });
    }
  });
  app2.delete("/api/payment-sources/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [expenseCount] = await db.select({ count: sql3`COUNT(*)` }).from(expenses).where(eq4(expenses.paymentSourceId, id));
      if (expenseCount.count > 0) {
        return res.status(400).json({
          message: "Cannot delete payment source with associated expenses. Please remove or reassign expenses first."
        });
      }
      const [deletedSource] = await db.delete(paymentSources).where(eq4(paymentSources.id, id)).returning();
      if (!deletedSource) {
        return res.status(404).json({ message: "Payment source not found" });
      }
      res.json({ message: "Payment source deleted successfully" });
    } catch (error) {
      console.error("Error deleting payment source:", error);
      res.status(500).json({ message: "Failed to delete payment source" });
    }
  });
  app2.get("/api/payment-sources/:id/transactions", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const transactions = await db.select().from(paymentSourceTransactions).where(eq4(paymentSourceTransactions.paymentSourceId, id)).orderBy(desc3(paymentSourceTransactions.createdAt));
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  app2.get("/api/payment-sources/:id/expenses", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const sourceExpenses = await db.select().from(expenses).where(eq4(expenses.paymentSourceId, id)).orderBy(desc3(expenses.expenseDate));
      res.json(sourceExpenses);
    } catch (error) {
      console.error("Error fetching payment source expenses:", error);
      res.status(500).json({ message: "Failed to fetch payment source expenses" });
    }
  });
}

// server/user-management-routes.ts
import { eq as eq5, desc as desc4, sql as sql4 } from "drizzle-orm";
import bcrypt2 from "bcrypt";
var devAuth2 = (req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    req.user = {
      id: "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0",
      claims: {
        sub: "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0",
        email: "test@company.com"
      }
    };
  }
  next();
};
async function logAudit(userId, action, entityType, entityId, oldValues, newValues) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType,
      entityId,
      oldValues: oldValues || null,
      newValues: newValues || null,
      ipAddress: "127.0.0.1",
      // In real app, get from request
      userAgent: "Development"
    });
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
}
function registerUserManagementRoutes(app2) {
  app2.get("/api/roles", devAuth2, async (req, res) => {
    try {
      const rolesList = await db.select().from(roles).orderBy(desc4(roles.createdAt));
      res.json(rolesList);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });
  app2.get("/api/roles/:id", devAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const [role] = await db.select().from(roles).where(eq5(roles.id, id));
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });
  app2.post("/api/roles", devAuth2, async (req, res) => {
    try {
      const validatedData = insertRoleSchema.parse(req.body);
      const userId = req.user?.claims?.sub || "1";
      const [newRole] = await db.insert(roles).values({
        ...validatedData,
        createdBy: userId
      }).returning();
      await logAudit(userId, "create", "role", newRole.id, null, newRole);
      res.status(201).json(newRole);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });
  app2.put("/api/roles/:id", devAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertRoleSchema.parse(req.body);
      const userId = req.user?.claims?.sub || "1";
      const [oldRole] = await db.select().from(roles).where(eq5(roles.id, id));
      const [updatedRole] = await db.update(roles).set({
        ...validatedData,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq5(roles.id, id)).returning();
      if (!updatedRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      await logAudit(userId, "update", "role", id, oldRole, updatedRole);
      res.json(updatedRole);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });
  app2.delete("/api/roles/:id", devAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub || "1";
      const [roleInUse] = await db.select().from(users).where(eq5(users.roleId, id));
      if (roleInUse) {
        return res.status(400).json({ message: "Cannot delete role that is assigned to users" });
      }
      const [oldRole] = await db.select().from(roles).where(eq5(roles.id, id));
      const [deletedRole] = await db.delete(roles).where(eq5(roles.id, id)).returning();
      if (!deletedRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      await logAudit(userId, "delete", "role", id, oldRole, null);
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });
  app2.get("/api/employees", devAuth2, async (req, res) => {
    try {
      const { search, department, status } = req.query;
      let query = db.select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
        phone: employees.phone,
        jobTitle: employees.jobTitle,
        department: employees.department,
        hiringDate: employees.hiringDate,
        status: employees.status,
        profileImage: employees.profileImage,
        notes: employees.notes,
        createdAt: employees.createdAt,
        hasUserAccount: sql4`false`
        // Simplified for now
      }).from(employees);
      if (search) {
        query = query.where(
          sql4`LOWER(${employees.firstName} || ' ' || ${employees.lastName}) LIKE LOWER(${"%" + search + "%"})`
        );
      }
      if (department) {
        query = query.where(eq5(employees.department, department));
      }
      if (status) {
        query = query.where(eq5(employees.status, status));
      }
      const employeesList = await query.orderBy(desc4(employees.createdAt));
      res.json(employeesList);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });
  app2.get("/api/employees/:id", devAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const [employee] = await db.select().from(employees).where(eq5(employees.id, id));
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error fetching employee:", error);
      res.status(500).json({ message: "Failed to fetch employee" });
    }
  });
  app2.post("/api/employees", devAuth2, async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      const userId = req.user?.claims?.sub || "1";
      const [newEmployee] = await db.insert(employees).values({
        ...validatedData,
        createdBy: userId
      }).returning();
      await logAudit(userId, "create", "employee", newEmployee.id, null, newEmployee);
      res.status(201).json(newEmployee);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "Failed to create employee" });
    }
  });
  app2.put("/api/employees/:id", devAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertEmployeeSchema.parse(req.body);
      const userId = req.user?.claims?.sub || "1";
      const [oldEmployee] = await db.select().from(employees).where(eq5(employees.id, id));
      const [updatedEmployee] = await db.update(employees).set({
        ...validatedData,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq5(employees.id, id)).returning();
      if (!updatedEmployee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      await logAudit(userId, "update", "employee", id, oldEmployee, updatedEmployee);
      res.json(updatedEmployee);
    } catch (error) {
      console.error("Error updating employee:", error);
      res.status(500).json({ message: "Failed to update employee" });
    }
  });
  app2.get("/api/users", devAuth2, async (req, res) => {
    try {
      const usersList = await db.select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        mustChangePassword: users.mustChangePassword,
        createdAt: users.createdAt,
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          department: employees.department,
          jobTitle: employees.jobTitle,
          profileImage: employees.profileImage
        },
        role: {
          id: roles.id,
          name: roles.name,
          permissions: roles.permissions
        }
      }).from(users).innerJoin(employees, eq5(users.employeeId, employees.id)).innerJoin(roles, eq5(users.roleId, roles.id)).orderBy(desc4(users.createdAt));
      res.json(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.get("/api/users/:id", devAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await db.select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        mustChangePassword: users.mustChangePassword,
        createdAt: users.createdAt,
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          department: employees.department,
          jobTitle: employees.jobTitle,
          phone: employees.phone,
          profileImage: employees.profileImage
        },
        role: {
          id: roles.id,
          name: roles.name,
          permissions: roles.permissions
        }
      }).from(users).leftJoin(employees, eq5(users.employeeId, employees.id)).leftJoin(roles, eq5(users.roleId, roles.id)).where(eq5(users.id, id));
      if (!user.length) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user[0]);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app2.post("/api/users", devAuth2, async (req, res) => {
    try {
      const { password, ...userData } = req.body;
      const userId = req.user?.claims?.sub || "1";
      const validatedData = insertUserSchema.parse(userData);
      const [newUser] = await db.insert(users).values({
        ...validatedData,
        createdBy: userId
      }).returning();
      await logAudit(userId, "create", "user", newUser.id, null, newUser);
      const userResponse = newUser;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  app2.put("/api/users/:id", devAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const { password, firstName, lastName, phone, jobTitle, department, profileImageUrl, ...userData } = req.body;
      const userId = req.user?.claims?.sub || "1";
      const [user] = await db.select().from(users).where(eq5(users.id, id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      let updateData = userData;
      const oldUserSafe = user;
      const [updatedUser] = await db.update(users).set({
        ...updateData,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq5(users.id, id)).returning();
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.employeeId && (firstName || lastName || phone || jobTitle || department || profileImageUrl !== void 0)) {
        await db.update(employees).set({
          ...firstName && { firstName },
          ...lastName && { lastName },
          ...phone && { phone },
          ...jobTitle && { jobTitle },
          ...department && { department },
          ...profileImageUrl !== void 0 && { profileImage: profileImageUrl },
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq5(employees.id, user.employeeId));
      }
      const updatedUserSafe = updatedUser;
      await logAudit(userId, "update", "user", id, oldUserSafe, updatedUserSafe);
      res.json(updatedUserSafe);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  app2.put("/api/users/:id/deactivate", devAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub || "1";
      const [updatedUser] = await db.update(users).set({
        isActive: false,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq5(users.id, id)).returning();
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      await logAudit(userId, "deactivate", "user", id, null, { isActive: false });
      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ message: "Failed to deactivate user" });
    }
  });
  app2.get("/api/audit-logs", devAuth2, async (req, res) => {
    try {
      const { entityType, entityId, limit = 50 } = req.query;
      let query = db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        createdAt: auditLogs.createdAt,
        user: {
          id: users.id,
          email: users.email,
          employee: {
            firstName: employees.firstName,
            lastName: employees.lastName
          }
        }
      }).from(auditLogs).leftJoin(users, eq5(auditLogs.userId, users.id)).leftJoin(employees, eq5(users.employeeId, employees.id));
      if (entityType) {
        query = query.where(eq5(auditLogs.entityType, entityType));
      }
      if (entityId) {
        query = query.where(eq5(auditLogs.entityId, entityId));
      }
      const logs = await query.orderBy(desc4(auditLogs.createdAt)).limit(parseInt(limit));
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });
  app2.get("/api/user-management/stats", devAuth2, async (req, res) => {
    try {
      const [
        totalEmployees,
        activeEmployees,
        totalUsers,
        activeUsers,
        totalRoles
      ] = await Promise.all([
        db.select({ count: sql4`count(*)::int` }).from(employees),
        db.select({ count: sql4`count(*)::int` }).from(employees).where(eq5(employees.status, "active")),
        db.select({ count: sql4`count(*)::int` }).from(users),
        db.select({ count: sql4`count(*)::int` }).from(users).where(eq5(users.isActive, true)),
        db.select({ count: sql4`count(*)::int` }).from(roles).where(eq5(roles.isActive, true))
      ]);
      const totalEmpCount = parseInt(String(totalEmployees[0]?.count)) || 0;
      const totalUserCount = parseInt(String(totalUsers[0]?.count)) || 0;
      res.json({
        totalEmployees: totalEmpCount,
        activeEmployees: parseInt(String(activeEmployees[0]?.count)) || 0,
        totalUsers: totalUserCount,
        activeUsers: parseInt(String(activeUsers[0]?.count)) || 0,
        totalRoles: parseInt(String(totalRoles[0]?.count)) || 0,
        employeesWithoutAccounts: Math.max(0, totalEmpCount - totalUserCount)
      });
    } catch (error) {
      console.error("Error fetching user management stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });
  app2.post("/api/users/:id/change-password", devAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.claims?.sub || "1";
      const hashedPassword = await bcrypt2.hash(newPassword, 10);
      await db.update(users).set({
        passwordHash: hashedPassword,
        mustChangePassword: false,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq5(users.id, id));
      await logAudit(userId, "password_change", "user", id, null, { passwordChanged: true });
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
}

// server/kpi-routes.ts
import { eq as eq6, and as and5, desc as desc5 } from "drizzle-orm";
var devAuth3 = (req, res, next) => {
  req.user = { claims: { sub: "1" } };
  next();
};
function registerKpiRoutes(app2) {
  app2.get("/api/employees/:employeeId/kpis", devAuth3, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { period } = req.query;
      let query = db.select().from(employeeKpis).where(eq6(employeeKpis.employeeId, employeeId)).orderBy(desc5(employeeKpis.createdAt));
      if (period && typeof period === "string") {
        const periodsQuery = db.select().from(employeeKpis).where(
          and5(
            eq6(employeeKpis.employeeId, employeeId),
            eq6(employeeKpis.evaluationPeriod, period)
          )
        ).orderBy(desc5(employeeKpis.createdAt));
        const periodResults = await periodsQuery;
        return res.json(periodResults);
      }
      const kpis = await query;
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching employee KPIs:", error);
      res.status(500).json({ message: "Failed to fetch employee KPIs" });
    }
  });
  app2.get("/api/employees/:employeeId/kpi-stats", devAuth3, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const allKpis = await db.select().from(employeeKpis).where(eq6(employeeKpis.employeeId, employeeId));
      const stats = {
        total: allKpis.length,
        onTrack: allKpis.filter((k) => k.status === "on_track").length,
        belowTarget: allKpis.filter((k) => k.status === "below_target").length,
        exceeded: allKpis.filter((k) => k.status === "exceeded").length,
        notEvaluated: allKpis.filter((k) => k.status === "not_evaluated").length
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching KPI statistics:", error);
      res.status(500).json({ message: "Failed to fetch KPI statistics" });
    }
  });
  app2.post("/api/employees/:employeeId/kpis", devAuth3, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const userId = req.user?.claims?.sub;
      const validatedData = insertEmployeeKpiSchema.parse({
        ...req.body,
        employeeId,
        createdBy: userId
      });
      const [newKpi] = await db.insert(employeeKpis).values(validatedData).returning();
      res.status(201).json(newKpi);
    } catch (error) {
      console.error("Error creating KPI:", error);
      res.status(400).json({ message: "Failed to create KPI" });
    }
  });
  app2.put("/api/kpis/:kpiId", devAuth3, async (req, res) => {
    try {
      const { kpiId } = req.params;
      const validatedData = insertEmployeeKpiSchema.partial().parse(req.body);
      const [updatedKpi] = await db.update(employeeKpis).set({
        ...validatedData,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq6(employeeKpis.id, kpiId)).returning();
      if (!updatedKpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      res.json(updatedKpi);
    } catch (error) {
      console.error("Error updating KPI:", error);
      res.status(400).json({ message: "Failed to update KPI" });
    }
  });
  app2.delete("/api/kpis/:kpiId", devAuth3, async (req, res) => {
    try {
      const { kpiId } = req.params;
      const [deletedKpi] = await db.delete(employeeKpis).where(eq6(employeeKpis.id, kpiId)).returning();
      if (!deletedKpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      res.json({ message: "KPI deleted successfully" });
    } catch (error) {
      console.error("Error deleting KPI:", error);
      res.status(500).json({ message: "Failed to delete KPI" });
    }
  });
  app2.get("/api/employees/:employeeId/kpi-periods", devAuth3, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const periods = await db.selectDistinct({ evaluationPeriod: employeeKpis.evaluationPeriod }).from(employeeKpis).where(eq6(employeeKpis.employeeId, employeeId)).orderBy(desc5(employeeKpis.evaluationPeriod));
      res.json(periods.map((p) => p.evaluationPeriod));
    } catch (error) {
      console.error("Error fetching evaluation periods:", error);
      res.status(500).json({ message: "Failed to fetch evaluation periods" });
    }
  });
}

// server/analytics-routes.ts
import { eq as eq7, gte as gte4, lte as lte4, and as and6, count as count2, desc as desc6, sql as sql5 } from "drizzle-orm";
var devAuth4 = (req, res, next) => {
  req.user = {
    id: "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0",
    claims: { sub: "ab376fce-7111-44a1-8e2a-a3bc6f01e4a0" }
  };
  next();
};
function registerAnalyticsRoutes(app2) {
  app2.get("/api/analytics/kpis", devAuth4, async (req, res) => {
    try {
      const { startDate, endDate, period = "month" } = req.query;
      let dateFilter = void 0;
      if (startDate && endDate) {
        dateFilter = and6(
          gte4(invoices.createdAt, new Date(startDate)),
          lte4(invoices.createdAt, new Date(endDate))
        );
      }
      const revenueResult = await db.select({
        totalRevenue: sql5`COALESCE(SUM(CAST(${invoices.paidAmount} AS DECIMAL)), 0)`
      }).from(invoices);
      const expenseResult = await db.select({
        totalExpenses: sql5`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`
      }).from(expenses).where(eq7(expenses.status, "approved"));
      const newClientsResult = await db.select({
        newClients: count2()
      }).from(clients);
      const invoiceStatusResult = await db.select({
        status: invoices.status,
        count: count2(),
        totalAmount: sql5`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`
      }).from(invoices).groupBy(invoices.status);
      const quotationStatsResult = await db.select({
        status: quotations.status,
        count: count2(),
        totalValue: sql5`COALESCE(SUM(CAST(${quotations.amount} AS DECIMAL)), 0)`
      }).from(quotations).groupBy(quotations.status);
      const completedTasksResult = await db.select({
        completedTasks: count2()
      }).from(tasks).where(eq7(tasks.status, "completed"));
      const totalRevenue = parseFloat(revenueResult[0]?.totalrevenue || "0");
      const totalExpenses = expenseResult[0]?.totalexpenses || 0;
      const netProfit = totalRevenue - totalExpenses;
      const newClients = newClientsResult[0]?.newClients || 0;
      const completedTasks = completedTasksResult[0]?.completedTasks || 0;
      const invoiceBreakdown = invoiceStatusResult.reduce((acc, item) => {
        acc[item.status] = {
          count: item.count,
          amount: item.totalAmount
        };
        return acc;
      }, {});
      const quotationBreakdown = quotationStatsResult.reduce((acc, item) => {
        acc[item.status] = {
          count: item.count,
          value: item.totalValue
        };
        return acc;
      }, {});
      const totalQuotations = quotationStatsResult.reduce((sum3, item) => sum3 + item.count, 0);
      const acceptedQuotations = quotationBreakdown.accepted?.count || 0;
      const conversionRate = totalQuotations > 0 ? acceptedQuotations / totalQuotations * 100 : 0;
      res.json({
        totalRevenue,
        totalExpenses,
        netProfit,
        newClients,
        completedTasks,
        invoiceBreakdown,
        quotationBreakdown,
        conversionRate,
        profitMargin: totalRevenue > 0 ? netProfit / totalRevenue * 100 : 0
      });
    } catch (error) {
      console.error("Error fetching analytics KPIs:", error);
      res.status(500).json({ message: "Failed to fetch analytics KPIs" });
    }
  });
  app2.get("/api/analytics/financial-reports", devAuth4, async (req, res) => {
    try {
      const { startDate, endDate, type = "summary" } = req.query;
      let dateFilter = sql5`1=1`;
      if (startDate && endDate) {
        dateFilter = and6(
          gte4(invoices.createdAt, new Date(startDate)),
          lte4(invoices.createdAt, new Date(endDate))
        );
      }
      if (type === "income") {
        const incomeData = await db.select({
          month: sql5`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`,
          revenue: sql5`SUM(CAST(${invoices.amount} AS DECIMAL))`,
          invoiceCount: count2()
        }).from(invoices).where(and6(
          eq7(invoices.status, "paid"),
          dateFilter
        )).groupBy(sql5`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`).orderBy(sql5`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`);
        res.json({ incomeData });
      } else if (type === "expenses") {
        const expenseData = await db.select({
          category: sql5`'General'`,
          totalAmount: sql5`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
          count: count2()
        }).from(expenses).where(eq7(expenses.status, "approved"));
        const expensesByCategory = expenseData.map((row) => ({
          category: row.category,
          totalAmount: parseFloat(row.totalAmount?.toString() || "0"),
          count: parseInt(row.count?.toString() || "0")
        }));
        res.json({ expensesByCategory, expensesByMonth: [] });
      } else {
        const revenue = await db.select({
          totalRevenue: sql5`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`
        }).from(invoices).where(and6(
          eq7(invoices.status, "paid"),
          dateFilter
        ));
        const expenseTotal = await db.select({
          totalExpenses: sql5`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`
        }).from(expenses).where(and6(
          eq7(expenses.status, "approved"),
          dateFilter
        ));
        const totalRevenue = revenue[0]?.totalRevenue || 0;
        const totalExpenses = expenseTotal[0]?.totalExpenses || 0;
        res.json({
          summary: {
            totalRevenue,
            totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            profitMargin: totalRevenue > 0 ? (totalRevenue - totalExpenses) / totalRevenue * 100 : 0
          }
        });
      }
    } catch (error) {
      console.error("Error fetching financial reports:", error);
      res.status(500).json({ message: "Failed to fetch financial reports" });
    }
  });
  app2.get("/api/analytics/trends", devAuth4, async (req, res) => {
    try {
      const { period = "month", metric = "revenue" } = req.query;
      const groupByClause = period === "quarter" ? sql5`TO_CHAR(${invoices.createdAt}, 'YYYY-Q')` : sql5`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`;
      if (metric === "revenue") {
        const trendData = await db.select({
          period: groupByClause,
          value: sql5`SUM(CAST(${invoices.amount} AS DECIMAL))`,
          count: count2()
        }).from(invoices).where(eq7(invoices.status, "paid")).groupBy(groupByClause).orderBy(groupByClause).limit(12);
        res.json({ trends: trendData, metric: "revenue" });
      } else if (metric === "expenses") {
        const expenseGroupBy = period === "quarter" ? sql5`TO_CHAR(${expenses.createdAt}, 'YYYY-Q')` : sql5`TO_CHAR(${expenses.createdAt}, 'YYYY-MM')`;
        const trendData = await db.select({
          period: expenseGroupBy,
          value: sql5`SUM(CAST(${expenses.amount} AS DECIMAL))`,
          count: count2()
        }).from(expenses).where(eq7(expenses.status, "approved")).groupBy(expenseGroupBy).orderBy(expenseGroupBy).limit(12);
        res.json({ trends: trendData, metric: "expenses" });
      } else if (metric === "clients") {
        const clientGroupBy = period === "quarter" ? sql5`TO_CHAR(${clients.createdAt}, 'YYYY-Q')` : sql5`TO_CHAR(${clients.createdAt}, 'YYYY-MM')`;
        const trendData = await db.select({
          period: clientGroupBy,
          value: count2(),
          count: count2()
        }).from(clients).groupBy(clientGroupBy).orderBy(clientGroupBy).limit(12);
        res.json({ trends: trendData, metric: "clients" });
      }
    } catch (error) {
      console.error("Error fetching trend analysis:", error);
      res.status(500).json({ message: "Failed to fetch trend analysis" });
    }
  });
  app2.get("/api/analytics/comparison", devAuth4, async (req, res) => {
    try {
      const { period1Start, period1End, period2Start, period2End } = req.query;
      if (!period1Start || !period1End || !period2Start || !period2End) {
        return res.status(400).json({ message: "All period dates are required" });
      }
      const getMetricsForPeriod = async (startDate, endDate) => {
        const dateFilter = and6(
          gte4(invoices.createdAt, new Date(startDate)),
          lte4(invoices.createdAt, new Date(endDate))
        );
        const revenue = await db.select({
          total: sql5`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`
        }).from(invoices).where(and6(eq7(invoices.status, "paid"), dateFilter));
        const expenseFilter = and6(
          gte4(expenses.createdAt, new Date(startDate)),
          lte4(expenses.createdAt, new Date(endDate))
        );
        const expenseTotal = await db.select({
          total: sql5`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`
        }).from(expenses).where(and6(eq7(expenses.status, "approved"), expenseFilter));
        const clientFilter = and6(
          gte4(clients.createdAt, new Date(startDate)),
          lte4(clients.createdAt, new Date(endDate))
        );
        const newClients = await db.select({ count: count2() }).from(clients).where(clientFilter);
        const taskFilter = and6(
          gte4(tasks.createdAt, new Date(startDate)),
          lte4(tasks.createdAt, new Date(endDate))
        );
        const completedTasks = await db.select({ count: count2() }).from(tasks).where(and6(eq7(tasks.status, "completed"), taskFilter));
        return {
          revenue: revenue[0]?.total || 0,
          expenses: expenseTotal[0]?.total || 0,
          newClients: newClients[0]?.count || 0,
          completedTasks: completedTasks[0]?.count || 0
        };
      };
      const period1Metrics = await getMetricsForPeriod(period1Start, period1End);
      const period2Metrics = await getMetricsForPeriod(period2Start, period2End);
      const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return (current - previous) / previous * 100;
      };
      const comparison = {
        period1: period1Metrics,
        period2: period2Metrics,
        changes: {
          revenue: {
            absolute: period1Metrics.revenue - period2Metrics.revenue,
            percentage: calculateChange(period1Metrics.revenue, period2Metrics.revenue)
          },
          expenses: {
            absolute: period1Metrics.expenses - period2Metrics.expenses,
            percentage: calculateChange(period1Metrics.expenses, period2Metrics.expenses)
          },
          profit: {
            absolute: period1Metrics.revenue - period1Metrics.expenses - (period2Metrics.revenue - period2Metrics.expenses),
            percentage: calculateChange(
              period1Metrics.revenue - period1Metrics.expenses,
              period2Metrics.revenue - period2Metrics.expenses
            )
          },
          newClients: {
            absolute: period1Metrics.newClients - period2Metrics.newClients,
            percentage: calculateChange(period1Metrics.newClients, period2Metrics.newClients)
          },
          completedTasks: {
            absolute: period1Metrics.completedTasks - period2Metrics.completedTasks,
            percentage: calculateChange(period1Metrics.completedTasks, period2Metrics.completedTasks)
          }
        }
      };
      res.json(comparison);
    } catch (error) {
      console.error("Error fetching period comparison:", error);
      res.status(500).json({ message: "Failed to fetch period comparison" });
    }
  });
  app2.get("/api/analytics/outstanding", devAuth4, async (req, res) => {
    try {
      const receivables = await db.select({
        id: invoices.id,
        clientId: invoices.clientId,
        amount: invoices.amount,
        status: invoices.status,
        dueDate: invoices.dueDate,
        createdAt: invoices.createdAt
      }).from(invoices).where(sql5`${invoices.status} IN ('pending', 'partial')`).orderBy(desc6(invoices.createdAt));
      const outstandingTotal = await db.select({
        total: sql5`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`
      }).from(invoices).where(sql5`${invoices.status} IN ('pending', 'partial')`);
      const overdueInvoices = await db.select({
        id: invoices.id,
        clientId: invoices.clientId,
        amount: invoices.amount,
        dueDate: invoices.dueDate,
        daysPastDue: sql5`EXTRACT(DAY FROM NOW() - ${invoices.dueDate})`
      }).from(invoices).where(
        and6(
          sql5`${invoices.status} IN ('pending', 'partial')`,
          sql5`${invoices.dueDate} < NOW()`
        )
      ).orderBy(sql5`EXTRACT(DAY FROM NOW() - ${invoices.dueDate}) DESC`);
      res.json({
        receivables,
        outstandingTotal: outstandingTotal[0]?.total || 0,
        overdueInvoices,
        overdueCount: overdueInvoices.length
      });
    } catch (error) {
      console.error("Error fetching outstanding data:", error);
      res.status(500).json({ message: "Failed to fetch outstanding data" });
    }
  });
}

// server/task-management-routes.ts
import { eq as eq8, desc as desc7, and as and7, gte as gte5, lte as lte5, count as count3, sql as sql6 } from "drizzle-orm";
import { z as z2 } from "zod";
var devAuth5 = (req, res, next) => {
  req.user = { claims: { sub: "1" } };
  next();
};
var createTaskSchema = z2.object({
  title: z2.string().min(1, "Title is required"),
  description: z2.string().optional(),
  priority: z2.enum(["low", "medium", "high"]).default("medium"),
  status: z2.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  dueDate: z2.string().optional(),
  assignedTo: z2.string().optional()
});
var createCommentSchema = z2.object({
  comment: z2.string().min(1, "Comment is required"),
  attachments: z2.array(z2.string()).optional()
});
function registerTaskManagementRoutes(app2) {
  app2.get("/api/tasks", devAuth5, async (req, res) => {
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
        sortBy = "createdAt",
        sortOrder = "desc",
        limit = "50",
        offset = "0",
        myTasks
        // Special filter for current user's tasks
      } = req.query;
      const userId = req.user?.claims?.sub || "1";
      const allTasks = await db.select().from(tasks);
      let filteredTasks = allTasks;
      if (search) {
        filteredTasks = filteredTasks.filter(
          (task) => task.title.toLowerCase().includes(search.toLowerCase()) || task.description && task.description.toLowerCase().includes(search.toLowerCase())
        );
      }
      if (status) {
        filteredTasks = filteredTasks.filter((task) => task.status === status);
      }
      if (priority) {
        filteredTasks = filteredTasks.filter((task) => task.priority === priority);
      }
      if (myTasks === "true") {
        filteredTasks = filteredTasks.filter((task) => task.assignedTo === userId);
      }
      filteredTasks.sort((a, b) => {
        if (sortOrder === "desc") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      const start = parseInt(offset);
      const end = start + parseInt(limit);
      const paginatedTasks = filteredTasks.slice(start, end);
      res.json(paginatedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });
  app2.get("/api/tasks/stats", devAuth5, async (req, res) => {
    try {
      const { assignedTo, department } = req.query;
      const userId = req.user?.claims?.sub || "1";
      let baseConditions = [];
      if (assignedTo === "me") {
        baseConditions.push(eq8(tasks.assignedTo, userId));
      } else if (assignedTo) {
        baseConditions.push(eq8(tasks.assignedTo, assignedTo));
      }
      if (department) {
        baseConditions.push(eq8(tasks.departmentId, department));
      }
      const statusCounts = await db.select({
        status: tasks.status,
        count: count3()
      }).from(tasks).where(baseConditions.length > 0 ? and7(...baseConditions) : void 0).groupBy(tasks.status);
      const priorityCounts = await db.select({
        priority: tasks.priority,
        count: count3()
      }).from(tasks).where(baseConditions.length > 0 ? and7(...baseConditions) : void 0).groupBy(tasks.priority);
      const overdueTasks = await db.select({ count: count3() }).from(tasks).where(
        baseConditions.length > 0 ? and7(...baseConditions, sql6`${tasks.dueDate} < NOW() AND ${tasks.status} != 'completed'`) : sql6`${tasks.dueDate} < NOW() AND ${tasks.status} != 'completed'`
      );
      const completedThisMonth = await db.select({ count: count3() }).from(tasks).where(
        baseConditions.length > 0 ? and7(
          ...baseConditions,
          eq8(tasks.status, "completed"),
          sql6`${tasks.completedDate} >= date_trunc('month', CURRENT_DATE)`
        ) : and7(
          eq8(tasks.status, "completed"),
          sql6`${tasks.completedDate} >= date_trunc('month', CURRENT_DATE)`
        )
      );
      const totalTasks = await db.select({ count: count3() }).from(tasks).where(baseConditions.length > 0 ? and7(...baseConditions) : void 0);
      res.json({
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {}),
        priorityBreakdown: priorityCounts.reduce((acc, item) => {
          acc[item.priority] = item.count;
          return acc;
        }, {}),
        overdueTasks: overdueTasks[0]?.count || 0,
        completedThisMonth: completedThisMonth[0]?.count || 0,
        totalTasks: totalTasks[0]?.count || 0
      });
    } catch (error) {
      console.error("Error fetching task stats:", error);
      res.status(500).json({ message: "Failed to fetch task statistics" });
    }
  });
  app2.get("/api/tasks/:id", devAuth5, async (req, res) => {
    try {
      const { id } = req.params;
      const [task] = await db.select({
        task: tasks,
        assignedToUser: {
          id: users.id,
          email: users.email
        },
        assignedToEmployee: {
          firstName: employees.firstName,
          lastName: employees.lastName,
          jobTitle: employees.jobTitle
        },
        assignedByUser: {
          id: users.id,
          email: users.email
        },
        assignedByEmployee: {
          firstName: employees.firstName,
          lastName: employees.lastName
        },
        client: {
          id: clients.id,
          name: clients.name,
          email: clients.email
        }
      }).from(tasks).leftJoin(users, eq8(tasks.assignedTo, users.id)).leftJoin(employees, eq8(users.employeeId, employees.id)).leftJoin(users.as("assignedByUsers"), eq8(tasks.assignedBy, users.id)).leftJoin(employees.as("assignedByEmployees"), eq8(users.employeeId, employees.id)).leftJoin(clients, eq8(tasks.linkedClientId, clients.id)).where(eq8(tasks.id, id));
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      const comments = await db.select({
        comment: taskComments,
        user: {
          id: users.id,
          email: users.email
        },
        employee: {
          firstName: employees.firstName,
          lastName: employees.lastName
        }
      }).from(taskComments).leftJoin(users, eq8(taskComments.createdBy, users.id)).leftJoin(employees, eq8(users.employeeId, employees.id)).where(eq8(taskComments.taskId, id)).orderBy(desc7(taskComments.createdAt));
      const dependencies = await db.select({
        dependency: taskDependencies,
        dependentTask: {
          id: tasks.id,
          title: tasks.title,
          status: tasks.status
        }
      }).from(taskDependencies).leftJoin(tasks, eq8(taskDependencies.dependsOnTaskId, tasks.id)).where(eq8(taskDependencies.taskId, id));
      const activityLog = await db.select({
        log: taskActivityLog,
        user: {
          id: users.id,
          email: users.email
        },
        employee: {
          firstName: employees.firstName,
          lastName: employees.lastName
        }
      }).from(taskActivityLog).leftJoin(users, eq8(taskActivityLog.createdBy, users.id)).leftJoin(employees, eq8(users.employeeId, employees.id)).where(eq8(taskActivityLog.taskId, id)).orderBy(desc7(taskActivityLog.createdAt)).limit(20);
      res.json({
        ...task.task,
        assignedToUser: task.assignedToUser,
        assignedToEmployee: task.assignedToEmployee,
        assignedByUser: task.assignedByUser,
        assignedByEmployee: task.assignedByEmployee,
        client: task.client,
        comments: comments.map((c) => ({
          ...c.comment,
          user: c.user,
          employee: c.employee
        })),
        dependencies: dependencies.map((d) => ({
          ...d.dependency,
          dependentTask: d.dependentTask
        })),
        activityLog: activityLog.map((a) => ({
          ...a.log,
          user: a.user,
          employee: a.employee
        }))
      });
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });
  app2.post("/api/tasks", devAuth5, async (req, res) => {
    try {
      const validatedData = createTaskSchema.parse(req.body);
      const userId = req.user?.claims?.sub || "1";
      const taskData = {
        title: validatedData.title,
        description: validatedData.description || null,
        priority: validatedData.priority,
        status: validatedData.status,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        assignedTo: validatedData.assignedTo || null,
        createdBy: userId
      };
      const [newTask] = await db.insert(tasks).values(taskData).returning();
      res.status(201).json(newTask);
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create task" });
    }
  });
  app2.put("/api/tasks/:id", devAuth5, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = createTaskSchema.partial().parse(req.body);
      const userId = req.user?.claims?.sub || "1";
      const [currentTask] = await db.select().from(tasks).where(eq8(tasks.id, id));
      if (!currentTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      const updateData = {};
      if (validatedData.title) updateData.title = validatedData.title;
      if (validatedData.description !== void 0) updateData.description = validatedData.description;
      if (validatedData.priority) updateData.priority = validatedData.priority;
      if (validatedData.status) updateData.status = validatedData.status;
      if (validatedData.dueDate) updateData.dueDate = new Date(validatedData.dueDate);
      if (validatedData.assignedTo !== void 0) updateData.assignedTo = validatedData.assignedTo;
      updateData.updatedAt = /* @__PURE__ */ new Date();
      if (validatedData.status === "completed" && currentTask.status !== "completed") {
        updateData.completedDate = /* @__PURE__ */ new Date();
      }
      const [updatedTask] = await db.update(tasks).set(updateData).where(eq8(tasks.id, id)).returning();
      const significantFields = ["status", "priority", "assignedTo", "dueDate", "progressPercentage"];
      for (const field of significantFields) {
        if (validatedData[field] !== void 0 && validatedData[field] !== currentTask[field]) {
          await db.insert(taskActivityLog).values({
            taskId: id,
            action: "field_updated",
            oldValue: currentTask[field]?.toString() || null,
            newValue: validatedData[field]?.toString() || null,
            notes: `${field} updated`,
            createdBy: userId
          });
        }
      }
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update task" });
    }
  });
  app2.delete("/api/tasks/:id", devAuth5, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub || "1";
      const [existingTask] = await db.select().from(tasks).where(eq8(tasks.id, id));
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      await db.delete(taskComments).where(eq8(taskComments.taskId, id));
      await db.delete(taskDependencies).where(eq8(taskDependencies.taskId, id));
      await db.delete(taskActivityLog).where(eq8(taskActivityLog.taskId, id));
      await db.delete(tasks).where(eq8(tasks.id, id));
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });
  app2.post("/api/tasks/:id/comments", devAuth5, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = createCommentSchema.parse(req.body);
      const userId = req.user?.claims?.sub || "1";
      const [existingTask] = await db.select().from(tasks).where(eq8(tasks.id, id));
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      const [newComment] = await db.insert(taskComments).values({
        taskId: id,
        comment: validatedData.comment,
        attachments: validatedData.attachments || [],
        createdBy: userId
      }).returning();
      await db.insert(taskActivityLog).values({
        taskId: id,
        action: "commented",
        newValue: validatedData.comment,
        notes: "Comment added to task",
        createdBy: userId
      });
      res.status(201).json(newComment);
    } catch (error) {
      console.error("Error adding comment:", error);
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add comment" });
    }
  });
  app2.get("/api/tasks/performance", devAuth5, async (req, res) => {
    try {
      const { assignedTo, department, startDate, endDate } = req.query;
      let conditions = [];
      if (assignedTo) {
        conditions.push(eq8(tasks.assignedTo, assignedTo));
      }
      if (department) {
        conditions.push(eq8(tasks.departmentId, department));
      }
      if (startDate) {
        conditions.push(gte5(tasks.createdAt, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte5(tasks.createdAt, new Date(endDate)));
      }
      const completionMetrics = await db.select({
        total: count3(),
        completed: sql6`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        onTime: sql6`SUM(CASE WHEN status = 'completed' AND completed_date <= due_date THEN 1 ELSE 0 END)`,
        overdue: sql6`SUM(CASE WHEN due_date < NOW() AND status != 'completed' THEN 1 ELSE 0 END)`
      }).from(tasks).where(conditions.length > 0 ? and7(...conditions) : void 0);
      const avgCompletionTime = await db.select({
        avgDays: sql6`AVG(EXTRACT(DAY FROM completed_date - created_at))`
      }).from(tasks).where(
        conditions.length > 0 ? and7(...conditions, eq8(tasks.status, "completed")) : eq8(tasks.status, "completed")
      );
      const priorityDistribution = await db.select({
        priority: tasks.priority,
        count: count3(),
        completedCount: sql6`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`
      }).from(tasks).where(conditions.length > 0 ? and7(...conditions) : void 0).groupBy(tasks.priority);
      const metrics = completionMetrics[0];
      const completionRate = metrics.total > 0 ? metrics.completed / metrics.total * 100 : 0;
      const onTimeRate = metrics.completed > 0 ? metrics.onTime / metrics.completed * 100 : 0;
      res.json({
        totalTasks: metrics.total,
        completedTasks: metrics.completed,
        overdueTasks: metrics.overdue,
        completionRate: Math.round(completionRate * 100) / 100,
        onTimeCompletionRate: Math.round(onTimeRate * 100) / 100,
        averageCompletionDays: Math.round((avgCompletionTime[0]?.avgDays || 0) * 100) / 100,
        priorityDistribution: priorityDistribution.map((p) => ({
          priority: p.priority,
          total: p.count,
          completed: p.completedCount,
          completionRate: p.count > 0 ? Math.round(p.completedCount / p.count * 1e4) / 100 : 0
        }))
      });
    } catch (error) {
      console.error("Error fetching task performance:", error);
      res.status(500).json({ message: "Failed to fetch task performance metrics" });
    }
  });
}

// server/seed-user-data.ts
import bcrypt3 from "bcrypt";
async function seedUserData() {
  try {
    const existingRoles = await db.select().from(roles).limit(1);
    if (existingRoles.length > 0) {
      return;
    }
    const defaultRoles = [
      {
        name: "Admin",
        description: "Full system access with all permissions",
        permissions: {
          dashboard: { view: true, add: true, edit: true, delete: true, approve: true },
          crm: { view: true, add: true, edit: true, delete: true, approve: true },
          quotations: { view: true, add: true, edit: true, delete: true, approve: true },
          invoices: { view: true, add: true, edit: true, delete: true, approve: true },
          expenses: { view: true, add: true, edit: true, delete: true, approve: true },
          paymentSources: { view: true, add: true, edit: true, delete: true, approve: true },
          employees: { view: true, add: true, edit: true, delete: true, approve: true },
          users: { view: true, add: true, edit: true, delete: true, approve: true },
          roles: { view: true, add: true, edit: true, delete: true, approve: true },
          tasks: { view: true, add: true, edit: true, delete: true, approve: true },
          analytics: { view: true, add: true, edit: true, delete: true, approve: true },
          auditLogs: { view: true, add: false, edit: false, delete: false, approve: false }
        }
      },
      {
        name: "Manager",
        description: "Management level access with approval permissions",
        permissions: {
          dashboard: { view: true, add: false, edit: false, delete: false, approve: false },
          crm: { view: true, add: true, edit: true, delete: false, approve: true },
          quotations: { view: true, add: true, edit: true, delete: false, approve: true },
          invoices: { view: true, add: true, edit: true, delete: false, approve: true },
          expenses: { view: true, add: true, edit: true, delete: false, approve: true },
          paymentSources: { view: true, add: false, edit: false, delete: false, approve: false },
          employees: { view: true, add: false, edit: true, delete: false, approve: false },
          users: { view: true, add: false, edit: false, delete: false, approve: false },
          roles: { view: true, add: false, edit: false, delete: false, approve: false },
          tasks: { view: true, add: true, edit: true, delete: false, approve: true },
          analytics: { view: true, add: false, edit: false, delete: false, approve: false },
          auditLogs: { view: true, add: false, edit: false, delete: false, approve: false }
        }
      },
      {
        name: "Finance",
        description: "Finance department access with invoice and expense management",
        permissions: {
          dashboard: { view: true, add: false, edit: false, delete: false, approve: false },
          crm: { view: true, add: false, edit: false, delete: false, approve: false },
          quotations: { view: true, add: false, edit: true, delete: false, approve: false },
          invoices: { view: true, add: true, edit: true, delete: false, approve: true },
          expenses: { view: true, add: true, edit: true, delete: false, approve: true },
          paymentSources: { view: true, add: true, edit: true, delete: false, approve: true },
          employees: { view: true, add: false, edit: false, delete: false, approve: false },
          users: { view: false, add: false, edit: false, delete: false, approve: false },
          roles: { view: false, add: false, edit: false, delete: false, approve: false },
          tasks: { view: true, add: true, edit: true, delete: false, approve: false },
          analytics: { view: true, add: false, edit: false, delete: false, approve: false },
          auditLogs: { view: true, add: false, edit: false, delete: false, approve: false }
        }
      },
      {
        name: "Sales",
        description: "Sales team access for CRM and quotation management",
        permissions: {
          dashboard: { view: true, add: false, edit: false, delete: false, approve: false },
          crm: { view: true, add: true, edit: true, delete: false, approve: false },
          quotations: { view: true, add: true, edit: true, delete: false, approve: false },
          invoices: { view: true, add: false, edit: false, delete: false, approve: false },
          expenses: { view: true, add: true, edit: true, delete: false, approve: false },
          paymentSources: { view: false, add: false, edit: false, delete: false, approve: false },
          employees: { view: true, add: false, edit: false, delete: false, approve: false },
          users: { view: false, add: false, edit: false, delete: false, approve: false },
          roles: { view: false, add: false, edit: false, delete: false, approve: false },
          tasks: { view: true, add: true, edit: true, delete: false, approve: false },
          analytics: { view: true, add: false, edit: false, delete: false, approve: false },
          auditLogs: { view: false, add: false, edit: false, delete: false, approve: false }
        }
      },
      {
        name: "HR",
        description: "Human Resources access for employee management",
        permissions: {
          dashboard: { view: true, add: false, edit: false, delete: false, approve: false },
          crm: { view: true, add: false, edit: false, delete: false, approve: false },
          quotations: { view: false, add: false, edit: false, delete: false, approve: false },
          invoices: { view: false, add: false, edit: false, delete: false, approve: false },
          expenses: { view: true, add: true, edit: true, delete: false, approve: true },
          paymentSources: { view: false, add: false, edit: false, delete: false, approve: false },
          employees: { view: true, add: true, edit: true, delete: false, approve: true },
          users: { view: true, add: true, edit: true, delete: false, approve: false },
          roles: { view: true, add: false, edit: false, delete: false, approve: false },
          tasks: { view: true, add: true, edit: true, delete: false, approve: false },
          analytics: { view: true, add: false, edit: false, delete: false, approve: false },
          auditLogs: { view: true, add: false, edit: false, delete: false, approve: false }
        }
      },
      {
        name: "Employee",
        description: "Basic employee access for limited operations",
        permissions: {
          dashboard: { view: true, add: false, edit: false, delete: false, approve: false },
          crm: { view: true, add: false, edit: false, delete: false, approve: false },
          quotations: { view: true, add: false, edit: false, delete: false, approve: false },
          invoices: { view: true, add: false, edit: false, delete: false, approve: false },
          expenses: { view: true, add: true, edit: true, delete: false, approve: false },
          paymentSources: { view: false, add: false, edit: false, delete: false, approve: false },
          employees: { view: true, add: false, edit: false, delete: false, approve: false },
          users: { view: false, add: false, edit: false, delete: false, approve: false },
          roles: { view: false, add: false, edit: false, delete: false, approve: false },
          tasks: { view: true, add: false, edit: true, delete: false, approve: false },
          analytics: { view: false, add: false, edit: false, delete: false, approve: false },
          auditLogs: { view: false, add: false, edit: false, delete: false, approve: false }
        }
      }
    ];
    const createdRoles = await db.insert(roles).values(defaultRoles).returning();
    console.log(`Created ${createdRoles.length} default roles`);
    const adminRole = createdRoles.find((r) => r.name === "Admin");
    const managerRole = createdRoles.find((r) => r.name === "Manager");
    const financeRole = createdRoles.find((r) => r.name === "Finance");
    if (!adminRole) throw new Error("Admin role not found");
    const defaultEmployees = [
      {
        firstName: "Test",
        lastName: "User",
        email: "test@company.com",
        phone: "+1-555-0001",
        jobTitle: "System Administrator",
        department: "operations",
        hiringDate: /* @__PURE__ */ new Date("2024-01-01"),
        status: "active",
        profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"
      },
      {
        firstName: "System",
        lastName: "Administrator",
        email: "admin@company.com",
        phone: "+1-555-0002",
        jobTitle: "System Administrator",
        department: "operations",
        hiringDate: /* @__PURE__ */ new Date("2024-01-01"),
        status: "active"
      },
      {
        firstName: "John",
        lastName: "Manager",
        email: "john.manager@company.com",
        phone: "+1-555-0002",
        jobTitle: "Operations Manager",
        department: "management",
        hiringDate: /* @__PURE__ */ new Date("2024-01-01"),
        status: "active"
      },
      {
        firstName: "Sarah",
        lastName: "Finance",
        email: "sarah.finance@company.com",
        phone: "+1-555-0003",
        jobTitle: "Finance Manager",
        department: "finance",
        hiringDate: /* @__PURE__ */ new Date("2024-01-01"),
        status: "active"
      }
    ];
    const createdEmployees = await db.insert(employees).values(defaultEmployees).returning();
    console.log(`Created ${createdEmployees.length} default employees`);
    const adminEmployee = createdEmployees.find((e) => e.email === "admin@company.com");
    const managerEmployee = createdEmployees.find((e) => e.email === "john.manager@company.com");
    const financeEmployee = createdEmployees.find((e) => e.email === "sarah.finance@company.com");
    if (!adminEmployee || !managerEmployee || !financeEmployee) {
      throw new Error("Required employees not found");
    }
    const defaultPassword = await bcrypt3.hash("admin123", 10);
    const defaultUsers = [
      {
        email: "test@company.com",
        passwordHash: defaultPassword,
        employeeId: testEmployee.id,
        roleId: adminRole.id,
        isActive: true,
        mustChangePassword: false
        // Don't force password change for test user
      },
      {
        email: "admin@company.com",
        passwordHash: defaultPassword,
        employeeId: adminEmployee.id,
        roleId: adminRole.id,
        isActive: true,
        mustChangePassword: true
      },
      {
        email: "john.manager@company.com",
        passwordHash: defaultPassword,
        employeeId: managerEmployee.id,
        roleId: managerRole?.id || adminRole.id,
        isActive: true,
        mustChangePassword: true
      },
      {
        email: "sarah.finance@company.com",
        passwordHash: defaultPassword,
        employeeId: financeEmployee.id,
        roleId: financeRole?.id || adminRole.id,
        isActive: true,
        mustChangePassword: true
      }
    ];
    const createdUsers = await db.insert(users).values(defaultUsers).returning();
    console.log(`Created ${createdUsers.length} default users`);
    console.log("User management seed data created successfully!");
    console.log("Default credentials:");
    console.log("- admin@company.com / admin123 (Admin)");
    console.log("- john.manager@company.com / admin123 (Manager)");
    console.log("- sarah.finance@company.com / admin123 (Finance)");
    console.log("Note: All users must change password on first login");
  } catch (error) {
    console.error("Error seeding user management data:", error);
    throw error;
  }
}

// server/routes.ts
async function registerRoutes(app2) {
  app2.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || "1.0.0"
    });
  });
  app2.get("/api/config", (req, res) => {
    res.json({
      companyName: process.env.COMPANY_NAME || "CompanyOS",
      companyTagline: process.env.COMPANY_TAGLINE || "Enterprise Management Platform"
    });
  });
  app2.get("/api/ready", async (req, res) => {
    try {
      await db.select().from(users).limit(1);
      res.status(200).json({
        status: "ready",
        database: "connected",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: "not ready",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  try {
    await setupAuth(app2);
    app2.get("/api/user", (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json(req.user);
    });
  } catch (authError) {
    console.error("Authentication setup failed:", authError);
    throw authError;
  }
  try {
    await seedUserData();
  } catch (error) {
    console.error("User data seeding failed:", error);
  }
  setupDatabaseRoutes(app2);
  registerExpenseRoutes(app2);
  registerPaymentSourceRoutes(app2);
  registerUserManagementRoutes(app2);
  registerKpiRoutes(app2);
  registerAnalyticsRoutes(app2);
  registerTaskManagementRoutes(app2);
  app2.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      res.json({ success: true, data: [] });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ success: false, error: "Failed to fetch notifications" });
    }
  });
  app2.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      res.json({ success: true, data: { unreadCount: 0 } });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ success: false, error: "Failed to fetch unread count" });
    }
  });
  app2.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ success: false, error: "Failed to mark notification as read" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
async function setupProductionMiddleware() {
  if (process.env.NODE_ENV === "production") {
    const { default: helmet } = await import("helmet");
    const { default: compression } = await import("compression");
    const { default: cors } = await import("cors");
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "wss:", "https:"]
        }
      }
    }));
    app.use(compression());
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5000"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"]
    }));
  }
}
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: false, limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  await setupProductionMiddleware();
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
