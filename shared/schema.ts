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
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Enums
export const departmentEnum = pgEnum("department", ["operations", "finance", "hr", "sales", "management", "it", "marketing"]);
export const employeeStatusEnum = pgEnum("employee_status", ["active", "inactive", "terminated", "on_leave"]);

// Roles table for dynamic role management
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").notNull(), // JSON object with module permissions
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
});

// Employees table for comprehensive employee management
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").unique(),
  phone: varchar("phone"),
  jobTitle: varchar("job_title"),
  department: departmentEnum("department").notNull(),
  hiringDate: timestamp("hiring_date"),
  status: employeeStatusEnum("status").notNull().default("active"),
  profileImage: text("profile_image"), // Base64 encoded image data
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
});

// Users table for system access - matching actual database structure
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

// KPI status enum
export const kpiStatusEnum = pgEnum("kpi_status", ["on_track", "below_target", "exceeded", "not_evaluated"]);

// Employee KPIs table
export const employeeKpis = pgTable("employee_kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  targetValue: varchar("target_value"), // Flexible string to accommodate different types
  actualValue: varchar("actual_value"),
  evaluationPeriod: varchar("evaluation_period").notNull(), // e.g., "July 2025", "Q2 2025", "Jan 1 - Mar 31, 2025"
  status: kpiStatusEnum("status").notNull().default("not_evaluated"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit log for tracking user actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(), // create, update, delete, approve, etc.
  entityType: varchar("entity_type").notNull(), // user, employee, role, client, etc.
  entityId: varchar("entity_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  city: varchar("city"),
  country: varchar("country"),
  status: varchar("status").notNull().default("active"), // active, inactive, pending
  totalValue: decimal("total_value", { precision: 10, scale: 2 }).default("0"),
  creditBalance: decimal("credit_balance", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Quotations table
export const quotations = pgTable("quotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationNumber: varchar("quotation_number").notNull().unique(),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default("draft"), // draft, sent, accepted, rejected, expired, invoiced
  validUntil: timestamp("valid_until"),
  notes: text("notes"), // Internal notes
  terms: text("terms"), // Terms and conditions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Invoices table
export const invoices = pgTable("invoices", {
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
  status: varchar("status").notNull().default("draft"), // draft, sent, paid, partially_paid, overdue, cancelled, refunded, partially_refunded
  invoiceDate: timestamp("invoice_date").defaultNow(),
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Invoice Items table
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id).notNull(),
  serviceId: varchar("service_id").references(() => services.id),
  name: text("name").notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment Records table
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  overpaymentAmount: decimal("overpayment_amount", { precision: 10, scale: 2 }).default("0"),
  isOverpayment: boolean("is_overpayment").default(false),
  adminApproved: boolean("admin_approved").default(false),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: varchar("payment_method").notNull(), // cash, bank_transfer, credit_card, check, other, credit_balance
  bankTransferNumber: varchar("bank_transfer_number"),
  attachmentUrl: varchar("attachment_url"),
  notes: text("notes"),
  // Refund fields
  isRefund: boolean("is_refund").default(false),
  refundReference: varchar("refund_reference"),
  originalPaymentId: varchar("original_payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
});

// Client Credit Balance History
export const clientCreditHistory = pgTable("client_credit_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  type: varchar("type").notNull(), // credit_added, credit_used, credit_refunded, credit_applied
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  relatedInvoiceId: varchar("related_invoice_id").references(() => invoices.id),
  relatedPaymentId: varchar("related_payment_id").references(() => payments.id),
  description: text("description").notNull(),
  notes: text("notes"),
  refundReference: varchar("refund_reference"),
  previousBalance: decimal("previous_balance", { precision: 10, scale: 2 }).notNull(),
  newBalance: decimal("new_balance", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});



// Tasks table - Basic structure matching actual database
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  priority: varchar("priority").notNull().default("medium"), // low, medium, high
  status: varchar("status").notNull().default("pending"), // pending, in_progress, completed, cancelled
  dueDate: timestamp("due_date"),
  completedDate: timestamp("completed_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
});

// Task Comments table for internal collaboration
export const taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  comment: text("comment").notNull(),
  attachments: text("attachments").array(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
});

// Task Dependencies table for workflow control
export const taskDependencies = pgTable("task_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  dependsOnTaskId: varchar("depends_on_task_id").references(() => tasks.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
});

// Task Activity Log for tracking changes
export const taskActivityLog = pgTable("task_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  action: varchar("action").notNull(), // created, assigned, status_changed, updated, commented, etc.
  oldValue: text("old_value"),
  newValue: text("new_value"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
});

// Activities table for tracking system activities
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // invoice_paid, client_added, quotation_sent, etc.
  title: text("title").notNull(),
  description: text("description"),
  entityType: varchar("entity_type"), // client, invoice, quotation, etc.
  entityId: varchar("entity_id"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Relations
export const rolesRelations = relations(roles, ({ one, many }) => ({
  users: many(users),
  createdBy: one(users, {
    fields: [roles.createdBy],
    references: [users.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.id],
    references: [users.employeeId],
  }),
  createdBy: one(users, {
    fields: [employees.createdBy],
    references: [users.id],
  }),
  kpis: many(employeeKpis),
}));

export const employeeKpisRelations = relations(employeeKpis, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeKpis.employeeId],
    references: [employees.id],
  }),
  createdBy: one(users, {
    fields: [employeeKpis.createdBy],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  employee: one(employees, {
    fields: [users.employeeId],
    references: [employees.id],
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  clients: many(clients),
  quotations: many(quotations),
  invoices: many(invoices),
  expenses: many(expenses),
  tasks: many(tasks),
  activities: many(activities),
  auditLogs: many(auditLogs),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [clients.createdBy],
    references: [users.id],
  }),
  quotations: many(quotations),
  invoices: many(invoices),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  client: one(clients, {
    fields: [quotations.clientId],
    references: [clients.id],
  }),
  createdBy: one(users, {
    fields: [quotations.createdBy],
    references: [users.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  quotation: one(quotations, {
    fields: [invoices.quotationId],
    references: [quotations.id],
  }),
  createdBy: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  service: one(services, {
    fields: [invoiceItems.serviceId],
    references: [services.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  createdBy: one(users, {
    fields: [payments.createdBy],
    references: [users.id],
  }),
}));



export const tasksRelations = relations(tasks, ({ one }) => ({
  assignedTo: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  createdBy: one(users, {
    fields: [activities.createdBy],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalValue: true,
});

export const insertQuotationSchema = createInsertSchema(quotations).omit({
  id: true,
  quotationNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  invoiceNumber: true,
  createdAt: true,
  updatedAt: true,
  paidAmount: true,
});



export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedDate: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertEmployeeKpiSchema = createInsertSchema(employeeKpis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;

export type EmployeeKpi = typeof employeeKpis.$inferSelect;
export type InsertEmployeeKpi = z.infer<typeof insertEmployeeKpiSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Payment Sources table for managing company financial accounts
export const paymentSources = pgTable("payment_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: varchar("description"),
  accountType: varchar("account_type").notNull().default("bank"), // cash, bank, wallet
  currency: varchar("currency").default("USD"),
  initialBalance: varchar("initial_balance").default("0"),
  currentBalance: varchar("current_balance").default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PaymentSource = typeof paymentSources.$inferSelect;
export type InsertPaymentSource = typeof paymentSources.$inferInsert;

// Payment Source Transactions table for tracking all balance changes
export const paymentSourceTransactions = pgTable("payment_source_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentSourceId: varchar("payment_source_id").notNull().references(() => paymentSources.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // expense, income, adjustment
  amount: varchar("amount").notNull(),
  description: varchar("description"),
  referenceId: varchar("reference_id"), // expense ID, income ID, etc.
  referenceType: varchar("reference_type"), // "expense", "income", "manual_adjustment"
  balanceBefore: varchar("balance_before").notNull(),
  balanceAfter: varchar("balance_after").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export type PaymentSourceTransaction = typeof paymentSourceTransactions.$inferSelect;
export type InsertPaymentSourceTransaction = typeof paymentSourceTransactions.$inferInsert;

// Relations for Payment Sources
export const paymentSourcesRelations = relations(paymentSources, ({ many }) => ({
  transactions: many(paymentSourceTransactions),
  expenses: many(expenses),
}));

export const paymentSourceTransactionsRelations = relations(paymentSourceTransactions, ({ one }) => ({
  paymentSource: one(paymentSources, {
    fields: [paymentSourceTransactions.paymentSourceId],
    references: [paymentSources.id],
  }),
  createdByUser: one(users, {
    fields: [paymentSourceTransactions.createdBy],
    references: [users.id],
  }),
}));

export const insertPaymentSourceSchema = createInsertSchema(paymentSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSourceTransactionSchema = createInsertSchema(paymentSourceTransactions).omit({
  id: true,
  createdAt: true,
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export type ClientCreditHistory = typeof clientCreditHistory.$inferSelect;
export type InsertClientCreditHistory = typeof clientCreditHistory.$inferInsert;

// Quotation line items
export const quotationItems = pgTable("quotation_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: varchar("quotation_id").references(() => quotations.id),
  serviceId: varchar("service_id").references(() => services.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Services & Offerings table
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  defaultPrice: decimal("default_price", { precision: 10, scale: 2 }),
  category: varchar("category"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Client notes/activities
export const clientNotes = pgTable("client_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  note: text("note").notNull(),
  type: varchar("type").notNull().default("note"), // note, call, meeting, email
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = typeof quotationItems.$inferInsert;
export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;
export const insertServiceSchema = createInsertSchema(services);
export const updateServiceSchema = insertServiceSchema.partial().extend({
  id: z.string()
});
export type ClientNote = typeof clientNotes.$inferSelect;
export type InsertClientNote = typeof clientNotes.$inferInsert;

// Add relations for new tables
export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id],
  }),
  service: one(services, {
    fields: [quotationItems.serviceId],
    references: [services.id],
  }),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  quotationItems: many(quotationItems),
}));

export const clientNotesRelations = relations(clientNotes, ({ one }) => ({
  client: one(clients, {
    fields: [clientNotes.clientId],
    references: [clients.id],
  }),
  createdBy: one(users, {
    fields: [clientNotes.createdBy],
    references: [users.id],
  }),
}));

// Expense Categories table
export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  color: varchar("color").default("#3B82F6"), // Hex color for UI display
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  categoryId: varchar("category_id").references(() => expenseCategories.id).notNull(),
  type: varchar("type").notNull(), // 'fixed', 'variable'
  frequency: varchar("frequency"), // 'monthly', 'quarterly', 'yearly' - only for fixed expenses
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  expenseDate: timestamp("expense_date").notNull(),
  paymentMethod: varchar("payment_method").notNull(), // cash, bank_transfer, credit_card, check
  paymentReference: varchar("payment_reference"), // reference number for bank transfers, check numbers, etc.
  status: varchar("status").notNull().default("pending"), // pending, paid, overdue, cancelled
  paidDate: timestamp("paid_date"),
  attachmentUrl: varchar("attachment_url").notNull(), // Mandatory attachment
  attachmentType: varchar("attachment_type").notNull(), // receipt, invoice, bank_statement, photo
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
  createdBy: varchar("created_by").references(() => users.id),
});

// Expense Payments table (for tracking payment history of recurring expenses)
export const expensePayments = pgTable("expense_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id").references(() => expenses.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: varchar("payment_method").notNull(),
  paymentReference: varchar("payment_reference"),
  attachmentUrl: varchar("attachment_url").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Schema validation
const insertExpenseCategorySchema = createInsertSchema(expenseCategories);
const insertExpenseSchema = createInsertSchema(expenses);
const insertExpensePaymentSchema = createInsertSchema(expensePayments);

export type InsertUser = z.infer<typeof insertUserSchema>;

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type ExpensePayment = typeof expensePayments.$inferSelect;
export type InsertExpensePayment = z.infer<typeof insertExpensePaymentSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// Add relations for expense tables
export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  relatedClient: one(clients, {
    fields: [expenses.relatedClientId],
    references: [clients.id],
  }),
  createdBy: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
  }),
  parentExpense: one(expenses, {
    fields: [expenses.parentExpenseId],
    references: [expenses.id],
  }),
  childExpenses: many(expenses),
  payments: many(expensePayments),
  paymentSource: one(paymentSources, {
    fields: [expenses.paymentSourceId],
    references: [paymentSources.id],
  }),
}));

export const expensePaymentsRelations = relations(expensePayments, ({ one }) => ({
  expense: one(expenses, {
    fields: [expensePayments.expenseId],
    references: [expenses.id],
  }),
  createdBy: one(users, {
    fields: [expensePayments.createdBy],
    references: [users.id],
  }),
}));

// Notification system enums
export const notificationTypeEnum = pgEnum("notification_type", [
  "task_assigned", "task_updated", "task_completed", "task_overdue",
  "expense_submitted", "expense_approved", "expense_rejected", "expense_paid",
  "invoice_created", "invoice_updated", "invoice_paid", "invoice_overdue",
  "quotation_created", "quotation_sent", "quotation_accepted", "quotation_rejected", "quotation_expired",
  "kpi_assigned", "kpi_updated", "kpi_reviewed",
  "client_added", "client_updated", "client_status_changed",
  "payment_received", "payment_failed", "payment_refunded",
  "user_added", "user_updated", "user_deactivated",
  "system_maintenance", "system_backup", "system_alert"
]);

export const notificationStatusEnum = pgEnum("notification_status", ["unread", "read", "archived"]);
export const notificationPriorityEnum = pgEnum("notification_priority", ["low", "medium", "high", "urgent"]);

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  status: notificationStatusEnum("status").notNull().default("unread"),
  priority: notificationPriorityEnum("priority").notNull().default("medium"),
  // Link to related entity
  entityType: varchar("entity_type"), // task, expense, invoice, quotation, kpi, client, etc.
  entityId: varchar("entity_id"),
  entityUrl: varchar("entity_url"), // Direct link to the entity page
  // Metadata
  metadata: jsonb("metadata"), // Additional data like amounts, names, etc.
  // Email tracking
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  emailError: text("email_error"),
  // Timing
  scheduledFor: timestamp("scheduled_for"), // For future notifications
  expiresAt: timestamp("expires_at"), // Auto-archive after this date
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Notification settings per user and notification type
export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  notificationType: notificationTypeEnum("notification_type").notNull(),
  inAppEnabled: boolean("in_app_enabled").default(true),
  emailEnabled: boolean("email_enabled").default(true),
  pushEnabled: boolean("push_enabled").default(false),
  // Scheduling preferences
  emailDigest: boolean("email_digest").default(false), // Bundle emails
  digestFrequency: varchar("digest_frequency").default("daily"), // daily, weekly, instant
  quietStart: varchar("quiet_start").default("22:00"), // Do not send notifications after this time
  quietEnd: varchar("quiet_end").default("08:00"), // Resume notifications after this time
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email templates for different notification types
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationType: notificationTypeEnum("notification_type").notNull().unique(),
  name: varchar("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text").notNull(),
  variables: jsonb("variables"), // Available template variables
  isActive: boolean("is_active").default(true),
  language: varchar("language").default("en"), // en, ar
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Notification audit log
export const notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationId: varchar("notification_id").references(() => notifications.id).notNull(),
  action: varchar("action").notNull(), // sent, delivered, read, failed, clicked
  channel: varchar("channel").notNull(), // in_app, email, push
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // Email provider response, click tracking, etc.
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema validation for notification tables
const insertNotificationSchema = createInsertSchema(notifications);
const insertNotificationSettingsSchema = createInsertSchema(notificationSettings);
const insertEmailTemplateSchema = createInsertSchema(emailTemplates);
const insertNotificationLogSchema = createInsertSchema(notificationLogs);

// Types for notification tables
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;

// Relations for notification tables
export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [notifications.createdBy],
    references: [users.id],
  }),
  logs: many(notificationLogs),
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, {
    fields: [notificationSettings.userId],
    references: [users.id],
  }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationLogs.notificationId],
    references: [notifications.id],
  }),
}));
