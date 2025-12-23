import type { Express } from "express";
import { db } from "./db";
import { 
  users, 
  employees, 
  roles, 
  auditLogs,
  insertUserSchema,
  insertEmployeeSchema,
  insertRoleSchema,
  insertAuditLogSchema,
  type User,
  type Employee,
  type Role,
  type InsertUser,
  type InsertEmployee,
  type InsertRole
} from "@shared/schema";
import { eq, desc, and, like, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

// Development middleware - uses actual admin user ID for FK constraints
const devAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    req.user = {
      id: '8742bebf-9138-4247-85c8-fd2cb70e7d78',
      claims: {
        sub: '8742bebf-9138-4247-85c8-fd2cb70e7d78',
        email: 'admin@company.com'
      }
    };
  }
  next();
};

// Helper function to log audit actions
async function logAudit(
  userId: string, 
  action: string, 
  entityType: string, 
  entityId: string, 
  oldValues?: any, 
  newValues?: any
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType,
      entityId,
      oldValues: oldValues || null,
      newValues: newValues || null,
      ipAddress: "127.0.0.1", // In real app, get from request
      userAgent: "Development",
    });
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
}

export function registerUserManagementRoutes(app: Express) {
  
  // ========== ROLES MANAGEMENT ==========
  
  // Get all roles
  app.get("/api/roles", devAuth, async (req, res) => {
    try {
      const rolesList = await db
        .select()
        .from(roles)
        .orderBy(desc(roles.createdAt));
      
      res.json(rolesList);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // Get role by ID
  app.get("/api/roles/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [role] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, id));
      
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  // Create role
  app.post("/api/roles", devAuth, async (req, res) => {
    try {
      const validatedData = insertRoleSchema.parse(req.body);
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';
      
      const [newRole] = await db
        .insert(roles)
        .values({
          ...validatedData,
          createdBy: userId,
        })
        .returning();
      
      await logAudit(userId, 'create', 'role', newRole.id, null, newRole);
      
      res.status(201).json(newRole);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  // Update role
  app.put("/api/roles/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertRoleSchema.parse(req.body);
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';
      
      // Get old values for audit
      const [oldRole] = await db.select().from(roles).where(eq(roles.id, id));
      
      const [updatedRole] = await db
        .update(roles)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(roles.id, id))
        .returning();
      
      if (!updatedRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      await logAudit(userId, 'update', 'role', id, oldRole, updatedRole);
      
      res.json(updatedRole);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Delete role
  app.delete("/api/roles/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';
      
      // Check if role is in use
      const [roleInUse] = await db.select().from(users).where(eq(users.roleId, id));
      if (roleInUse) {
        return res.status(400).json({ message: "Cannot delete role that is assigned to users" });
      }
      
      // Get role for audit
      const [oldRole] = await db.select().from(roles).where(eq(roles.id, id));
      
      const [deletedRole] = await db
        .delete(roles)
        .where(eq(roles.id, id))
        .returning();
      
      if (!deletedRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      await logAudit(userId, 'delete', 'role', id, oldRole, null);
      
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // ========== EMPLOYEES MANAGEMENT ==========
  
  // Get all employees
  app.get("/api/employees", devAuth, async (req, res) => {
    try {
      const { search, department, status } = req.query;
      
      let query = db
        .select({
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
          hasUserAccount: sql<boolean>`false`, // Simplified for now
        })
        .from(employees);
      
      if (search) {
        query = query.where(
          sql`LOWER(${employees.firstName} || ' ' || ${employees.lastName}) LIKE LOWER(${'%' + search + '%'})`
        );
      }
      
      if (department) {
        query = query.where(eq(employees.department, department as any));
      }
      
      if (status) {
        query = query.where(eq(employees.status, status as any));
      }
      
      const employeesList = await query.orderBy(desc(employees.createdAt));
      
      res.json(employeesList);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  // Get employee by ID
  app.get("/api/employees/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, id));
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      res.json(employee);
    } catch (error) {
      console.error("Error fetching employee:", error);
      res.status(500).json({ message: "Failed to fetch employee" });
    }
  });

  // Create employee
  app.post("/api/employees", devAuth, async (req, res) => {
    try {
      const body = req.body;
      // Transform date strings to Date objects
      const dataToValidate = {
        ...body,
        hiringDate: body.hiringDate ? new Date(body.hiringDate) : null,
      };
      const validatedData = insertEmployeeSchema.parse(dataToValidate);
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';
      
      const [newEmployee] = await db
        .insert(employees)
        .values({
          ...validatedData,
          createdBy: userId,
        })
        .returning();
      
      await logAudit(userId, 'create', 'employee', newEmployee.id, null, newEmployee);
      
      res.status(201).json(newEmployee);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  // Update employee
  app.put("/api/employees/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      // Transform date strings to Date objects
      const dataToValidate = {
        ...body,
        hiringDate: body.hiringDate ? new Date(body.hiringDate) : null,
      };
      const validatedData = insertEmployeeSchema.parse(dataToValidate);
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';
      
      // Get old values for audit
      const [oldEmployee] = await db.select().from(employees).where(eq(employees.id, id));
      
      const [updatedEmployee] = await db
        .update(employees)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, id))
        .returning();
      
      if (!updatedEmployee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      await logAudit(userId, 'update', 'employee', id, oldEmployee, updatedEmployee);
      
      res.json(updatedEmployee);
    } catch (error) {
      console.error("Error updating employee:", error);
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  // ========== USERS MANAGEMENT ==========
  
  // Get all users
  app.get("/api/users", devAuth, async (req, res) => {
    try {
      const usersList = await db
        .select({
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
            profileImage: employees.profileImage,
          },
          role: {
            id: roles.id,
            name: roles.name,
            permissions: roles.permissions,
          },
        })
        .from(users)
        .innerJoin(employees, eq(users.employeeId, employees.id))
        .innerJoin(roles, eq(users.roleId, roles.id))
        .orderBy(desc(users.createdAt));
      
      res.json(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get specific user by ID
  app.get("/api/users/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await db
        .select({
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
            profileImage: employees.profileImage,
          },
          role: {
            id: roles.id,
            name: roles.name,
            permissions: roles.permissions,
          },
        })
        .from(users)
        .leftJoin(employees, eq(users.employeeId, employees.id))
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, id));

      if (!user.length) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user[0]);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create user
  app.post("/api/users", devAuth, async (req, res) => {
    try {
      const { password, ...userData } = req.body;
      const userId = req.user?.claims?.sub || req.user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';
      
      // Note: Password handling skipped since database doesn't have password_hash column
      // In production, this would need proper password handling
      
      const validatedData = insertUserSchema.parse(userData);
      
      const [newUser] = await db
        .insert(users)
        .values({
          ...validatedData,
          createdBy: userId,
        })
        .returning();
      
      await logAudit(userId, 'create', 'user', newUser.id, null, newUser);
      
      // Return user data
      const userResponse = newUser;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user
  app.put("/api/users/:id", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { password, firstName, lastName, phone, jobTitle, department, profileImageUrl, ...userData } = req.body;
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';
      
      // First, get the user to find the employee ID
      const [user] = await db.select().from(users).where(eq(users.id, id));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      let updateData: any = userData;
      
      // Note: Password hash field doesn't exist in current database structure
      // In production, this would need proper password handling
      
      // Get old values for audit
      const oldUserSafe = user;
      
      const [updatedUser] = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update employee information if employee exists and employee data is provided
      if (user.employeeId && (firstName || lastName || phone || jobTitle || department || profileImageUrl !== undefined)) {
        await db
          .update(employees)
          .set({
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phone && { phone }),
            ...(jobTitle && { jobTitle }),
            ...(department && { department }),
            ...(profileImageUrl !== undefined && { profileImage: profileImageUrl }),
            updatedAt: new Date(),
          })
          .where(eq(employees.id, user.employeeId));
      }
      
      const updatedUserSafe = updatedUser;
      await logAudit(userId, 'update', 'user', id, oldUserSafe, updatedUserSafe);
      
      res.json(updatedUserSafe);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Deactivate user
  app.put("/api/users/:id/deactivate", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';
      
      const [updatedUser] = await db
        .update(users)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      await logAudit(userId, 'deactivate', 'user', id, null, { isActive: false });
      
      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ message: "Failed to deactivate user" });
    }
  });

  // Get audit logs
  app.get("/api/audit-logs", devAuth, async (req, res) => {
    try {
      const { entityType, entityId, limit = 50 } = req.query;
      
      let query = db
        .select({
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
              lastName: employees.lastName,
            },
          },
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .leftJoin(employees, eq(users.employeeId, employees.id));
      
      if (entityType) {
        query = query.where(eq(auditLogs.entityType, entityType as string));
      }
      
      if (entityId) {
        query = query.where(eq(auditLogs.entityId, entityId as string));
      }
      
      const logs = await query
        .orderBy(desc(auditLogs.createdAt))
        .limit(parseInt(limit as string));
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Get user management statistics
  app.get("/api/user-management/stats", devAuth, async (req, res) => {
    try {
      const [
        totalEmployees,
        activeEmployees,
        totalUsers,
        activeUsers,
        totalRoles
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(employees),
        db.select({ count: sql<number>`count(*)::int` }).from(employees).where(eq(employees.status, 'active')),
        db.select({ count: sql<number>`count(*)::int` }).from(users),
        db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.isActive, true)),
        db.select({ count: sql<number>`count(*)::int` }).from(roles).where(eq(roles.isActive, true))
      ]);
      
      const totalEmpCount = parseInt(String(totalEmployees[0]?.count)) || 0;
      const totalUserCount = parseInt(String(totalUsers[0]?.count)) || 0;
      
      res.json({
        totalEmployees: totalEmpCount,
        activeEmployees: parseInt(String(activeEmployees[0]?.count)) || 0,
        totalUsers: totalUserCount,
        activeUsers: parseInt(String(activeUsers[0]?.count)) || 0,
        totalRoles: parseInt(String(totalRoles[0]?.count)) || 0,
        employeesWithoutAccounts: Math.max(0, totalEmpCount - totalUserCount),
      });
    } catch (error) {
      console.error("Error fetching user management stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Change user password
  app.post("/api/users/:id/change-password", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';

      // For this demo, we'll skip password validation
      // In production, you'd verify the current password and hash the new one
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await db
        .update(users)
        .set({ 
          passwordHash: hashedPassword,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));

      await logAudit(userId, 'password_change', 'user', id, null, { passwordChanged: true });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
}