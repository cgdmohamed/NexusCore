import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";

async function seed() {
  console.log("\n=== Database Reset & Seed ===\n");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "NOT SET");
  
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set. Check your .env file.");
    process.exit(1);
  }

  const { db } = await import("./db");
  const { sql } = await import("drizzle-orm");
  const schema = await import("@shared/schema");
  const { roles, employees, users, expenseCategories, paymentSources } = schema;

  try {
    console.log("Clearing database...");
    
    const tablesToClear = [
      'session',
      'notifications', 'notification_logs', 'notification_settings', 'email_templates',
      'task_activity_log', 'task_dependencies', 'task_comments', 'tasks', 'activities',
      'expense_payments', 'expenses', 'expense_categories', 'payments', 'invoice_items',
      'invoices', 'quotation_items', 'quotations', 'client_notes', 'client_credit_history',
      'clients', 'payment_source_transactions', 'payment_sources', 'services',
      'audit_logs', 'employee_kpis', 'users', 'employees', 'roles'
    ];
    
    // Drop session table and its index to avoid conflicts on app restart
    try {
      await db.execute(sql.raw(`DROP INDEX IF EXISTS "IDX_session_expire"`));
      await db.execute(sql.raw(`DROP TABLE IF EXISTS session CASCADE`));
      console.log("Dropped session table and index (will be recreated on app start)");
    } catch (e) {
      console.log("Session cleanup note:", (e as Error).message);
    }
    
    for (const table of tablesToClear) {
      try {
        await db.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE`));
      } catch (e: any) {
        if (!e.message?.includes('does not exist')) {
          console.log(`Note: Table ${table} - ${e.code || 'skipped'}`);
        }
      }
    }
    
    console.log("Database cleared!");

    console.log("Seeding roles...");
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
        },
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
        },
      },
      {
        name: "Finance",
        description: "Finance department access",
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
        },
      },
      {
        name: "Sales",
        description: "Sales team access",
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
        },
      },
      {
        name: "Employee",
        description: "Basic employee access",
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
        },
      }
    ];

    const createdRoles = await db.insert(roles).values(defaultRoles).returning();
    console.log(`Created ${createdRoles.length} roles`);

    const adminRole = createdRoles.find(r => r.name === "Admin");
    if (!adminRole) throw new Error("Admin role not found");

    console.log("Seeding expense categories...");
    const categories = [
      { name: "Office Supplies", description: "Stationery, equipment, and general office materials", color: "#059669", isActive: true },
      { name: "Travel", description: "Business trips, transportation, and accommodation", color: "#DC2626", isActive: true },
      { name: "Marketing", description: "Advertising, promotions, and marketing campaigns", color: "#7C3AED", isActive: true },
      { name: "Utilities", description: "Electricity, water, internet, and phone bills", color: "#EA580C", isActive: true },
      { name: "Equipment", description: "Computer hardware, software, and technical equipment", color: "#1D4ED8", isActive: true },
      { name: "Professional Services", description: "Legal, accounting, consulting, and other professional fees", color: "#BE185D", isActive: true },
      { name: "Rent", description: "Office space, storage, and property rental", color: "#0D9488", isActive: true },
      { name: "Maintenance", description: "Repairs, cleaning, and facility maintenance", color: "#B45309", isActive: true },
      { name: "Insurance", description: "Business insurance, health insurance, and other coverage", color: "#7E22CE", isActive: true },
      { name: "Software Subscriptions", description: "Monthly/yearly software licenses and SaaS tools", color: "#0891B2", isActive: true },
    ];

    const createdCategories = await db.insert(expenseCategories).values(categories).returning();
    console.log(`Created ${createdCategories.length} expense categories`);

    console.log("Seeding payment sources...");
    const sources = [
      {
        name: "Main Business Account",
        accountType: "bank_account",
        accountNumber: "****1234",
        bankName: "Commercial International Bank (CIB)",
        initialBalance: "50000",
        currentBalance: "50000",
        isActive: true,
      },
      {
        name: "Petty Cash",
        accountType: "cash",
        initialBalance: "5000",
        currentBalance: "5000",
        isActive: true,
      },
      {
        name: "Corporate Credit Card",
        accountType: "credit_card",
        accountNumber: "****5678",
        bankName: "National Bank of Egypt",
        initialBalance: "0",
        currentBalance: "0",
        creditLimit: "25000",
        isActive: true,
      },
    ];

    const createdSources = await db.insert(paymentSources).values(sources).returning();
    console.log(`Created ${createdSources.length} payment sources`);

    console.log("Seeding admin user...");
    const adminEmployee = await db.insert(employees).values({
      firstName: "System",
      lastName: "Administrator",
      email: "admin@company.com",
      phone: "+20-100-000-0001",
      jobTitle: "System Administrator",
      department: "operations",
      hiringDate: new Date("2024-01-01"),
      status: "active",
    }).returning();

    const passwordHash = await bcrypt.hash("admin123", 10);
    
    await db.insert(users).values({
      username: "admin",
      email: "admin@company.com",
      passwordHash,
      employeeId: adminEmployee[0].id,
      roleId: adminRole.id,
      isActive: true,
      mustChangePassword: false,
    });

    console.log("\n=== Seed Complete ===");
    console.log("\nLogin credentials:");
    console.log("  Email: admin@company.com");
    console.log("  Password: admin123");
    console.log("");
    
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

seed();
