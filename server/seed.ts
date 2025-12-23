import dotenv from "dotenv";
dotenv.config();

import { db } from "./db";
import { 
  roles, 
  employees, 
  users, 
  expenseCategories,
  paymentSources
} from "@shared/schema";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";

async function clearDatabase() {
  console.log("Clearing database...");
  
  await db.execute(sql`TRUNCATE TABLE session CASCADE`);
  await db.execute(sql`TRUNCATE TABLE notifications CASCADE`);
  await db.execute(sql`TRUNCATE TABLE activity_logs CASCADE`);
  await db.execute(sql`TRUNCATE TABLE tasks CASCADE`);
  await db.execute(sql`TRUNCATE TABLE invoice_payments CASCADE`);
  await db.execute(sql`TRUNCATE TABLE invoice_items CASCADE`);
  await db.execute(sql`TRUNCATE TABLE invoices CASCADE`);
  await db.execute(sql`TRUNCATE TABLE quotation_items CASCADE`);
  await db.execute(sql`TRUNCATE TABLE quotations CASCADE`);
  await db.execute(sql`TRUNCATE TABLE expenses CASCADE`);
  await db.execute(sql`TRUNCATE TABLE payment_source_transactions CASCADE`);
  await db.execute(sql`TRUNCATE TABLE payment_sources CASCADE`);
  await db.execute(sql`TRUNCATE TABLE expense_categories CASCADE`);
  await db.execute(sql`TRUNCATE TABLE client_notes CASCADE`);
  await db.execute(sql`TRUNCATE TABLE clients CASCADE`);
  await db.execute(sql`TRUNCATE TABLE services CASCADE`);
  await db.execute(sql`TRUNCATE TABLE users CASCADE`);
  await db.execute(sql`TRUNCATE TABLE employees CASCADE`);
  await db.execute(sql`TRUNCATE TABLE roles CASCADE`);
  
  console.log("Database cleared!");
}

async function seedRoles() {
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
  return createdRoles;
}

async function seedExpenseCategories() {
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

  const created = await db.insert(expenseCategories).values(categories).returning();
  console.log(`Created ${created.length} expense categories`);
  return created;
}

async function seedPaymentSources() {
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

  const created = await db.insert(paymentSources).values(sources).returning();
  console.log(`Created ${created.length} payment sources`);
  return created;
}

async function seedAdminUser(adminRoleId: string) {
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
    email: "admin@company.com",
    passwordHash,
    employeeId: adminEmployee[0].id,
    roleId: adminRoleId,
    isActive: true,
    mustChangePassword: false,
  });

  console.log("Admin user created: admin@company.com / admin123");
}

async function seed() {
  try {
    console.log("\n=== Database Reset & Seed ===\n");
    
    await clearDatabase();
    
    const createdRoles = await seedRoles();
    const adminRole = createdRoles.find(r => r.name === "Admin");
    
    if (!adminRole) throw new Error("Admin role not found");
    
    await seedExpenseCategories();
    await seedPaymentSources();
    await seedAdminUser(adminRole.id);
    
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
