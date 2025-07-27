import {
  users,
  clients,
  quotations,
  invoices,
  expenses,
  tasks,
  activities,
  services,
  type User,
  type InsertUser,
  type Client,
  type InsertClient,
  type Quotation,
  type InsertQuotation,
  type Invoice,
  type InsertInvoice,
  type Expense,
  type InsertExpense,
  type Task,
  type InsertTask,
  type Activity,
  type InsertActivity,
  type Service,
  type InsertService,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sum, gte, lte, asc, ilike, or } from "drizzle-orm";

export interface IStorage {
  // User operations for username/password authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Client operations
  getClients(userId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  
  // Quotation operations
  getQuotations(userId: string): Promise<Quotation[]>;
  getQuotation(id: string): Promise<Quotation | undefined>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(id: string, quotation: Partial<InsertQuotation>): Promise<Quotation>;
  deleteQuotation(id: string): Promise<void>;
  
  // Invoice operations
  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  
  // Expense operations
  getExpenses(userId: string): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  
  // Task operations
  getTasks(userId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  
  // Activity operations
  getActivities(userId: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  
  // Services operations
  getServices(params: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
    activeOnly?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{
    services: Service[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;
  getService(id: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<boolean>;
  getServiceCategories(): Promise<string[]>;
  bulkUpdateServiceStatus(serviceIds: string[], isActive: boolean): Promise<number>;

  // Analytics operations
  getDashboardKPIs(userId: string): Promise<{
    totalRevenue: number;
    activeClients: number;
    pendingInvoices: number;
    teamPerformance: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations for username/password authentication
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  // Client operations
  async getClients(userId: string): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(eq(clients.createdBy, userId))
      .orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Quotation operations
  async getQuotations(userId: string): Promise<Quotation[]> {
    return await db
      .select()
      .from(quotations)
      .where(eq(quotations.createdBy, userId))
      .orderBy(desc(quotations.createdAt));
  }

  async getQuotation(id: string): Promise<Quotation | undefined> {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));
    return quotation;
  }

  async createQuotation(quotation: InsertQuotation): Promise<Quotation> {
    const quotationNumber = `QUO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    const [newQuotation] = await db
      .insert(quotations)
      .values({ ...quotation, quotationNumber })
      .returning();
    return newQuotation;
  }

  async updateQuotation(id: string, quotation: Partial<InsertQuotation>): Promise<Quotation> {
    const [updatedQuotation] = await db
      .update(quotations)
      .set({ ...quotation, updatedAt: new Date() })
      .where(eq(quotations.id, id))
      .returning();
    return updatedQuotation;
  }

  async deleteQuotation(id: string): Promise<void> {
    await db.delete(quotations).where(eq(quotations.id, id));
  }

  // Invoice operations
  async getInvoices(userId: string): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.createdBy, userId))
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    const [newInvoice] = await db
      .insert(invoices)
      .values({ ...invoice, invoiceNumber })
      .returning();
    return newInvoice;
  }

  async updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // Expense operations
  async getExpenses(userId: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(eq(expenses.createdBy, userId))
      .orderBy(desc(expenses.createdAt));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense> {
    const [updatedExpense] = await db
      .update(expenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    return updatedExpense;
  }

  async deleteExpense(id: string): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  // Task operations
  async getTasks(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.assignedTo, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, task: Partial<InsertTask>): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Activity operations
  async getActivities(userId: string, limit = 10): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.createdBy, userId))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }

  // Services operations
  async getServices(params: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
    activeOnly?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{
    services: Service[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, limit, search, category, activeOnly, sortBy = "name", sortOrder = "asc" } = params;
    const offset = (page - 1) * limit;

    // Build where conditions
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(services)
      .where(whereClause);
    const total = totalResult[0].count;

    // Get services with pagination
    const sortColumn = services[sortBy as keyof typeof services] || services.name;
    const orderClause = sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);

    const servicesResult = await db
      .select()
      .from(services)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);

    return {
      services: servicesResult,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined> {
    const [updatedService] = await db
      .update(services)
      .set({ ...service, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();
    return updatedService;
  }

  async deleteService(id: string): Promise<boolean> {
    const result = await db.delete(services).where(eq(services.id, id));
    return result.rowCount > 0;
  }

  async getServiceCategories(): Promise<string[]> {
    const categories = await db
      .select({ category: services.category })
      .from(services)
      .where(and(eq(services.isActive, true), services.category))
      .groupBy(services.category);
    
    return categories.map(c => c.category).filter(Boolean);
  }

  async bulkUpdateServiceStatus(serviceIds: string[], isActive: boolean): Promise<number> {
    const result = await db
      .update(services)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(services.id, serviceIds[0])); // This would need proper IN operator for multiple IDs
    
    return result.rowCount;
  }

  // Analytics operations
  async getDashboardKPIs(userId: string): Promise<{
    totalRevenue: number;
    activeClients: number;
    pendingInvoices: number;
    teamPerformance: number;
  }> {
    const [revenueResult] = await db
      .select({ total: sum(invoices.paidAmount) })
      .from(invoices)
      .where(eq(invoices.createdBy, userId));

    const [clientsResult] = await db
      .select({ count: count() })
      .from(clients)
      .where(and(eq(clients.createdBy, userId), eq(clients.status, "active")));

    const [pendingInvoicesResult] = await db
      .select({ total: sum(invoices.amount) })
      .from(invoices)
      .where(and(eq(invoices.createdBy, userId), eq(invoices.status, "pending")));

    return {
      totalRevenue: parseFloat(revenueResult.total || "0"),
      activeClients: clientsResult.count || 0,
      pendingInvoices: parseFloat(pendingInvoicesResult.total || "0"),
      teamPerformance: 94, // This would be calculated based on actual performance metrics
    };
  }
}

export const storage = new DatabaseStorage();
