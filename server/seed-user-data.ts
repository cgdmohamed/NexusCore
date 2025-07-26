import { db } from "./db";
import { roles, employees, users } from "@shared/schema";
import bcrypt from "bcrypt";

export async function seedUserData() {
  try {
    console.log("Seeding user management data...");

    // Check if data already exists
    const existingRoles = await db.select().from(roles).limit(1);
    if (existingRoles.length > 0) {
      console.log("User management data already exists, skipping seed.");
      return;
    }

    // Create default roles with permissions
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
        },
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
        },
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
        },
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
        },
      }
    ];

    const createdRoles = await db.insert(roles).values(defaultRoles).returning();
    console.log(`Created ${createdRoles.length} default roles`);

    // Find admin role
    const adminRole = createdRoles.find(r => r.name === "Admin");
    const managerRole = createdRoles.find(r => r.name === "Manager");
    const financeRole = createdRoles.find(r => r.name === "Finance");

    if (!adminRole) throw new Error("Admin role not found");

    // Create default employees
    const defaultEmployees = [
      {
        firstName: "Test",
        lastName: "User",
        email: "test@company.com",
        phone: "+1-555-0001",
        jobTitle: "System Administrator",  
        department: "operations" as const,
        hiringDate: new Date("2024-01-01"),
        status: "active" as const,
        profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100",
      },
      {
        firstName: "System",
        lastName: "Administrator",
        email: "admin@company.com",
        phone: "+1-555-0002",
        jobTitle: "System Administrator",
        department: "operations" as const,
        hiringDate: new Date("2024-01-01"),
        status: "active" as const,
      },
      {
        firstName: "John",
        lastName: "Manager",
        email: "john.manager@company.com",
        phone: "+1-555-0002",
        jobTitle: "Operations Manager",
        department: "management" as const,
        hiringDate: new Date("2024-01-01"),
        status: "active" as const,
      },
      {
        firstName: "Sarah",
        lastName: "Finance",
        email: "sarah.finance@company.com",
        phone: "+1-555-0003",
        jobTitle: "Finance Manager",
        department: "finance" as const,
        hiringDate: new Date("2024-01-01"),
        status: "active" as const,
      }
    ];

    const createdEmployees = await db.insert(employees).values(defaultEmployees).returning();
    console.log(`Created ${createdEmployees.length} default employees`);

    // Create default users with system access
    const testEmployee = createdEmployees.find(e => e.email === "test@company.com");
    const adminEmployee = createdEmployees.find(e => e.email === "admin@company.com");
    const managerEmployee = createdEmployees.find(e => e.email === "john.manager@company.com");
    const financeEmployee = createdEmployees.find(e => e.email === "sarah.finance@company.com");

    if (!testEmployee || !adminEmployee || !managerEmployee || !financeEmployee) {
      throw new Error("Required employees not found");
    }

    const defaultPassword = await bcrypt.hash("admin123", 10);

    const defaultUsers = [
      {
        email: "test@company.com",
        passwordHash: defaultPassword,
        employeeId: testEmployee.id,
        roleId: adminRole.id,
        isActive: true,
        mustChangePassword: false, // Don't force password change for test user
      },
      {
        email: "admin@company.com",
        passwordHash: defaultPassword,
        employeeId: adminEmployee.id,
        roleId: adminRole.id,
        isActive: true,
        mustChangePassword: true,
      },
      {
        email: "john.manager@company.com",
        passwordHash: defaultPassword,
        employeeId: managerEmployee.id,
        roleId: managerRole?.id || adminRole.id,
        isActive: true,
        mustChangePassword: true,
      },
      {
        email: "sarah.finance@company.com",
        passwordHash: defaultPassword,
        employeeId: financeEmployee.id,
        roleId: financeRole?.id || adminRole.id,
        isActive: true,
        mustChangePassword: true,
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