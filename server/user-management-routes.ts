import type { Express } from "express";
import { db, pgError, badRequestFromDbError } from "./db";
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
import { eq, desc, and, like, sql, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import { requireAuth, requireAdmin, requirePermission } from "./auth";
import { logAudit } from "./audit";
import { validatePassword } from "./password-policy";
import { invalidateUserSessions } from "./sessions";

// Role names are how the rest of the app recognises administrators (see requireAdmin).
const ADMIN_ROLE_NAME = "Admin";
const isAdminRoleName = (name: unknown) => typeof name === "string" && name.trim().toLowerCase() === ADMIN_ROLE_NAME.toLowerCase();

async function adminRoleExists(): Promise<boolean> {
  const rows = await db.select({ name: roles.name }).from(roles);
  return rows.some((r) => isAdminRoleName(r.name));
}

// Number of active users holding the Admin role, optionally ignoring one user.
async function countActiveAdmins(excludeUserId?: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(roles.name, ADMIN_ROLE_NAME), eq(users.isActive, true)));
  return rows.filter((r) => r.id !== excludeUserId).length;
}

async function isActiveAdmin(user: { id: string; roleId: string | null; isActive: boolean }): Promise<boolean> {
  if (!user.isActive || !user.roleId) return false;
  const [role] = await db.select({ name: roles.name }).from(roles).where(eq(roles.id, user.roleId));
  return role?.name === ADMIN_ROLE_NAME;
}

// True when removing `user` as an active admin would leave the system without one.
async function isLastActiveAdmin(user: { id: string; roleId: string | null; isActive: boolean }): Promise<boolean> {
  return (await isActiveAdmin(user)) && (await countActiveAdmins(user.id)) === 0;
}

async function roleExists(id: unknown): Promise<boolean> {
  if (typeof id !== "string" || !id) return false;
  const [row] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, id));
  return !!row;
}

async function employeeExists(id: unknown): Promise<boolean> {
  if (typeof id !== "string" || !id) return false;
  const [row] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, id));
  return !!row;
}

export function registerUserManagementRoutes(app: Express) {
  
  // ========== ROLES MANAGEMENT ==========
  
  // Get all roles with user counts
  app.get("/api/roles", requirePermission("roles", "view"), async (req, res) => {
    try {
      const rolesList = await db
        .select()
        .from(roles)
        .orderBy(desc(roles.createdAt));

      // Get user counts per role
      const userCounts = await db
        .select({ roleId: users.roleId, count: sql<number>`count(*)::int` })
        .from(users)
        .where(sql`${users.roleId} IS NOT NULL`)
        .groupBy(users.roleId);

      const countMap: Record<string, number> = {};
      for (const row of userCounts) {
        if (row.roleId) countMap[row.roleId] = row.count;
      }

      const rolesWithCount = rolesList.map(role => ({
        ...role,
        userCount: countMap[role.id] ?? 0,
      }));

      res.json(rolesWithCount);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // Get users assigned to a specific role
  app.get("/api/roles/:id/users", requirePermission("roles", "view"), async (req, res) => {
    try {
      const { id } = req.params;
      const assignedUsers = await db
        .select({
          id: users.id,
          email: users.email,
          isActive: users.isActive,
          employeeId: users.employeeId,
        })
        .from(users)
        .where(eq(users.roleId, id));

      // Attach employee names
      const employeeIds = assignedUsers.map(u => u.employeeId).filter((id): id is string => id !== null && id !== undefined);
      type EmpRecord = { id: string; firstName: string; lastName: string; profileImage: string | null };
      const employeeMap: Record<string, EmpRecord> = {};
      if (employeeIds.length > 0) {
        const emps = await db
          .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName, profileImage: employees.profileImage })
          .from(employees)
          .where(inArray(employees.id, employeeIds));
        for (const emp of emps) employeeMap[emp.id] = emp;
      }

      const result = assignedUsers.map(u => ({
        ...u,
        employee: u.employeeId ? employeeMap[u.employeeId] : null,
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching role users:", error);
      res.status(500).json({ message: "Failed to fetch role users" });
    }
  });

  // Get role by ID
  app.get("/api/roles/:id", requirePermission("roles", "view"), async (req, res) => {
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
  app.post("/api/roles", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertRoleSchema.parse(req.body);
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // "Admin" is how administrators are recognised, so there can only ever be one such role
      if (isAdminRoleName(validatedData.name) && (await adminRoleExists())) {
        return res.status(409).json({ message: "An Admin role already exists." });
      }
      
      const [newRole] = await db
        .insert(roles)
        .values({
          ...validatedData,
          createdBy: userId,
        })
        .returning();
      
      await logAudit(req, 'create', 'role', newRole.id, null, newRole);
      
      res.status(201).json(newRole);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  // Update role
  app.put("/api/roles/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertRoleSchema.parse(req.body);
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      // Get old values for audit
      const [oldRole] = await db.select().from(roles).where(eq(roles.id, id));
      if (!oldRole) {
        return res.status(404).json({ message: "Role not found" });
      }

      // The Admin role keeps its name, and no other role may take it
      if (isAdminRoleName(oldRole.name) && validatedData.name !== oldRole.name) {
        return res.status(400).json({ message: "The Admin role cannot be renamed." });
      }
      if (!isAdminRoleName(oldRole.name) && isAdminRoleName(validatedData.name)) {
        return res.status(409).json({ message: "The name Admin is reserved for the administrator role." });
      }
      
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
      
      await logAudit(req, 'update', 'role', id, oldRole, updatedRole);
      
      res.json(updatedRole);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Delete role
  app.delete("/api/roles/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const [roleToDelete] = await db.select().from(roles).where(eq(roles.id, id));
      if (roleToDelete && isAdminRoleName(roleToDelete.name)) {
        return res.status(400).json({ message: "The Admin role cannot be deleted." });
      }

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
      
      await logAudit(req, 'delete', 'role', id, oldRole, null);
      
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // ========== EMPLOYEES MANAGEMENT ==========
  
  // Get all employees
  app.get("/api/employees", requirePermission("employees", "view"), async (req, res) => {
    try {
      const { search, department, status } = req.query;
      
      const conditions = [];
      
      if (typeof search === "string" && search.trim()) {
        conditions.push(
          sql`LOWER(${employees.firstName} || ' ' || ${employees.lastName}) LIKE LOWER(${'%' + search + '%'})`
        );
      }
      
      if (department) {
        conditions.push(eq(employees.department, department as any));
      }
      
      if (status) {
        conditions.push(eq(employees.status, status as any));
      }
      
      const employeesList = await db
        .select()
        .from(employees)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(employees.createdAt));
      
      // Get all user accounts to check which employees have linked users
      const allUsers = await db.select({ employeeId: users.employeeId }).from(users).where(sql`${users.employeeId} IS NOT NULL`);
      const linkedEmployeeIds = new Set(allUsers.map(u => u.employeeId));
      
      // Add hasUserAccount flag to each employee
      const employeesWithUserStatus = employeesList.map(emp => ({
        ...emp,
        hasUserAccount: linkedEmployeeIds.has(emp.id)
      }));
      
      res.json(employeesWithUserStatus);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  // Get employee by ID
  app.get("/api/employees/:id", requirePermission("employees", "view"), async (req, res) => {
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
  app.post("/api/employees", requireAdmin, async (req, res) => {
    try {
      const body = req.body;
      // Transform date strings to Date objects
      const dataToValidate = {
        ...body,
        hiringDate: body.hiringDate ? new Date(body.hiringDate) : null,
      };
      const validatedData = insertEmployeeSchema.parse(dataToValidate);
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const [newEmployee] = await db
        .insert(employees)
        .values({
          ...validatedData,
          createdBy: userId,
        })
        .returning();
      
      await logAudit(req, 'create', 'employee', newEmployee.id, null, newEmployee);
      
      res.status(201).json(newEmployee);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  // Update employee
  app.put("/api/employees/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      // Transform date strings to Date objects
      const dataToValidate = {
        ...body,
        hiringDate: body.hiringDate ? new Date(body.hiringDate) : null,
      };
      const validatedData = insertEmployeeSchema.parse(dataToValidate);
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
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
      
      await logAudit(req, 'update', 'employee', id, oldEmployee, updatedEmployee);
      
      res.json(updatedEmployee);
    } catch (error) {
      console.error("Error updating employee:", error);
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  // Delete employee
  app.delete("/api/employees/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      // Get employee for audit
      const [employee] = await db.select().from(employees).where(eq(employees.id, id));
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Check if employee has an associated user account
      const [userAccount] = await db.select().from(users).where(eq(users.employeeId, id));
      if (userAccount) {
        if (userAccount.id === userId) {
          return res.status(400).json({ message: "You cannot delete the employee record of your own account." });
        }
        if (await isLastActiveAdmin(userAccount)) {
          return res.status(409).json({ message: "This is the last active administrator and cannot be deleted." });
        }
      }

      try {
        await db.transaction(async (tx) => {
          if (userAccount) await tx.delete(users).where(eq(users.employeeId, id));
          await tx.delete(employees).where(eq(employees.id, id));
        });
      } catch (deleteError) {
        if (pgError(deleteError)?.code === "23503") {
          return res.status(409).json({
            message: "This employee's account has related records (clients, invoices, tasks...). Deactivate the user instead of deleting.",
          });
        }
        throw deleteError;
      }

      await logAudit(req, 'delete', 'employee', id, employee, null);
      
      res.json({ success: true, message: "Employee deleted successfully" });
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // ========== USERS MANAGEMENT ==========
  
  // Get all users
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const usersList = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          employeeId: users.employeeId,
          roleId: users.roleId,
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
        .leftJoin(employees, eq(users.employeeId, employees.id))
        .leftJoin(roles, eq(users.roleId, roles.id))
        .orderBy(desc(users.createdAt));
      
      res.json(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get specific user by ID
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const requester = (req as any).user;
      if (requester?.id !== id && requester?.roleName !== "Admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const user = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          employeeId: users.employeeId,
          roleId: users.roleId,
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
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { password, confirmPassword, ...userData } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      if (typeof userData.username !== "string" || !userData.username.trim() || typeof userData.email !== "string" || !userData.email.trim()) {
        return res.status(400).json({ message: "Username and email are required" });
      }

      // Password is required for new users
      const passwordProblem = validatePassword(password, [userData.username, userData.email]);
      if (passwordProblem) {
        return res.status(400).json({ message: passwordProblem });
      }

      if (userData.roleId && !(await roleExists(userData.roleId))) {
        return res.status(400).json({ message: "Role not found" });
      }
      if (userData.employeeId && !(await employeeExists(userData.employeeId))) {
        return res.status(400).json({ message: "Employee not found" });
      }
      
      // Hash the password
      const passwordHash = await bcrypt.hash(password, 10);
      
      const [newUser] = await db
        .insert(users)
        .values({
          username: userData.username,
          email: userData.email,
          passwordHash,
          employeeId: userData.employeeId,
          roleId: userData.roleId,
          isActive: userData.isActive ?? true,
          mustChangePassword: userData.mustChangePassword ?? true,
        })
        .returning();
      
      await logAudit(req, 'create', 'user', newUser.id, null, { ...newUser, passwordHash: '[REDACTED]' });
      
      // Return user data without password hash
      const { passwordHash: _, ...userResponse } = newUser;
      res.status(201).json(userResponse);
    } catch (error: any) {
      console.error("Error creating user:", error);
      const badRequest = badRequestFromDbError(error);
      if (badRequest) return res.status(400).json({ message: badRequest });
      const pgErr = pgError(error);
      if (pgErr.code === '23505') {
        // Unique constraint violation
        if (pgErr.constraint?.includes('username')) {
          return res.status(400).json({ message: "Username already exists" });
        }
        if (pgErr.constraint?.includes('email')) {
          return res.status(400).json({ message: "Email already exists" });
        }
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user
  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { password, confirmPassword, firstName, lastName, phone, jobTitle, department, profileImageUrl, ...userData } = req.body;
      const authUserId = (req as any).user?.id;
      if (!authUserId) return res.status(401).json({ message: "Unauthorized" });
      
      // First, get the user to find the employee ID
      const [existingUser] = await db.select().from(users).where(eq(users.id, id));
      
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (userData.roleId && userData.roleId !== existingUser.roleId && !(await roleExists(userData.roleId))) {
        return res.status(400).json({ message: "Role not found" });
      }
      if (userData.employeeId && userData.employeeId !== existingUser.employeeId && !(await employeeExists(userData.employeeId))) {
        return res.status(400).json({ message: "Employee not found" });
      }

      // The system must always keep one active administrator, and nobody locks themselves out
      const nextActive = userData.isActive ?? existingUser.isActive;
      const nextRoleId = userData.roleId === undefined ? existingUser.roleId : userData.roleId;
      if (id === authUserId && existingUser.isActive && nextActive === false) {
        return res.status(400).json({ message: "You cannot deactivate your own account." });
      }
      const staysActiveAdmin = await isActiveAdmin({ id, roleId: nextRoleId ?? null, isActive: nextActive });
      if (!staysActiveAdmin && (await isLastActiveAdmin(existingUser))) {
        return res.status(409).json({ message: "This is the last active administrator. Another active administrator is required first." });
      }
      
      // Build update data
      const updateData: any = {
        email: userData.email,
        employeeId: userData.employeeId,
        roleId: userData.roleId,
        isActive: userData.isActive,
        mustChangePassword: userData.mustChangePassword,
        updatedAt: new Date(),
      };
      
      // If username is provided, update it
      if (userData.username) {
        updateData.username = userData.username;
      }
      
      // Hash new password if provided
      if (password !== undefined && password !== null && password !== "") {
        const passwordProblem = validatePassword(password, [userData.username ?? existingUser.username, userData.email ?? existingUser.email]);
        if (passwordProblem) {
          return res.status(400).json({ message: passwordProblem });
        }
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }
      
      // Get old values for audit
      const { passwordHash: oldHash, ...oldUserSafe } = existingUser;
      
      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update employee information if employee exists and employee data is provided
      if (existingUser.employeeId && (firstName || lastName || phone || jobTitle || department || profileImageUrl !== undefined)) {
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
          .where(eq(employees.id, existingUser.employeeId));
      }
      
      // A new password or a deactivation ends the user's existing logins
      if (updateData.passwordHash || updatedUser.isActive === false) {
        await invalidateUserSessions(id, id === authUserId ? (req as any).sessionID : null);
      }

      const { passwordHash: newHash, ...updatedUserSafe } = updatedUser;
      await logAudit(req, 'update', 'user', id, oldUserSafe, updatedUserSafe);
      
      res.json(updatedUserSafe);
    } catch (error: any) {
      console.error("Error updating user:", error);
      const badRequest = badRequestFromDbError(error);
      if (badRequest) return res.status(400).json({ message: badRequest });
      const pgErr = pgError(error);
      if (pgErr.code === '23505') {
        if (pgErr.constraint?.includes('username')) {
          return res.status(400).json({ message: "Username already exists" });
        }
        if (pgErr.constraint?.includes('email')) {
          return res.status(400).json({ message: "Email already exists" });
        }
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Deactivate user
  app.put("/api/users/:id/deactivate", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const [target] = await db.select().from(users).where(eq(users.id, id));
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }
      if (id === userId) {
        return res.status(400).json({ message: "You cannot deactivate your own account." });
      }
      if (await isLastActiveAdmin(target)) {
        return res.status(409).json({ message: "This is the last active administrator and cannot be deactivated." });
      }

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
      
      await invalidateUserSessions(id);
      await logAudit(req, 'deactivate', 'user', id, null, { isActive: false });
      
      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ message: "Failed to deactivate user" });
    }
  });

  // Get audit logs
  app.get("/api/audit-logs", requireAdmin, async (req, res) => {
    try {
      const { entityType, entityId, limit } = req.query;
      const requested = parseInt(limit as string, 10);
      const pageSize = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 200) : 50;
      
      let query = db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          oldValues: auditLogs.oldValues,
          newValues: auditLogs.newValues,
          createdAt: auditLogs.createdAt,
          userId: users.id,
          userEmail: users.email,
          userFirstName: employees.firstName,
          userLastName: employees.lastName,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .leftJoin(employees, eq(users.employeeId, employees.id));
      
      const filters = [];
      if (entityType) filters.push(eq(auditLogs.entityType, entityType as string));
      if (entityId) filters.push(eq(auditLogs.entityId, entityId as string));
      
      const rows = await query
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize);

      const logs = rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        oldValues: row.oldValues,
        newValues: row.newValues,
        createdAt: row.createdAt,
        user: {
          id: row.userId,
          email: row.userEmail,
          employee: {
            firstName: row.userFirstName,
            lastName: row.userLastName,
          },
        },
      }));
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Get user management statistics
  app.get("/api/user-management/stats", requirePermission("users", "view"), async (req, res) => {
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
  app.post("/api/users/:id/change-password", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      if (id !== userId) {
        return res.status(403).json({ message: "You can only change your own password" });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and a new password are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const passwordProblem = validatePassword(newPassword, [user.username, user.email]);
      if (passwordProblem) {
        return res.status(400).json({ message: passwordProblem });
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await db
        .update(users)
        .set({ 
          passwordHash: hashedPassword,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));

      // Other devices must sign in again; this one stays signed in
      await invalidateUserSessions(id, (req as any).sessionID);
      await logAudit(req, 'password_change', 'user', id, null, { passwordChanged: true });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
}
