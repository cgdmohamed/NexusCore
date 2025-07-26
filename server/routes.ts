import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./replitAuth";
import { setupDatabaseRoutes } from "./database-routes";
import { registerExpenseRoutes } from "./expense-routes";
import { registerPaymentSourceRoutes } from "./payment-source-routes";
import { registerUserManagementRoutes } from "./user-management-routes";
import { registerKpiRoutes } from "./kpi-routes";
import { registerAnalyticsRoutes } from "./analytics-routes";
import { registerTaskManagementRoutes } from "./task-management-routes";
import { seedUserData } from "./seed-user-data";
import { db } from "./db";
import { clients, tasks, expenses, quotations, invoices, activities } from "@shared/schema";
import { sql } from "drizzle-orm";
import {
  insertClientSchema,
  insertQuotationSchema,
  insertInvoiceSchema,
  insertExpenseSchema,
  insertTaskSchema,
  insertActivitySchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  try {
    if (process.env.NODE_ENV === 'development') {
      // Development bypass - create a test user
      console.log("Setting up development auth bypass...");
      
      // Create a test user for development
      app.get('/api/auth/user', async (req, res) => {
        const testUser = {
          id: '1',
          email: 'test@company.com',
          firstName: 'Test',
          lastName: 'User',
          profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100',
          role: 'admin',
          department: 'operations',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        res.json(testUser);
      });
    } else {
      await setupAuth(app);
      
      // Auth routes
      app.get('/api/auth/user', async (req: any, res) => {
        try {
          const userId = req.user.claims.sub;
          const user = await storage.getUser(userId);
          res.json(user);
        } catch (error) {
          console.error("Error fetching user:", error);
          res.status(500).json({ message: "Failed to fetch user" });
        }
      });
    }
  } catch (authError) {
    console.error("Auth setup failed, using development bypass:", authError);
    
    // Fallback to development auth if setup fails
    app.get('/api/auth/user', async (req, res) => {
      const testUser = {
        id: '1',
        email: 'test@company.com',
        firstName: 'Test',
        lastName: 'User',
        profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100',
        role: 'admin',
        department: 'operations',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      res.json(testUser);
    });
  }

  // Dashboard KPIs
  app.get('/api/dashboard/kpis', async (req: any, res) => {
    try {
      // Calculate real KPIs from database
      const clientsResult = await db.execute(sql`SELECT COUNT(*) as count FROM clients WHERE status = 'active'`);
      const totalRevenueResult = await db.execute(sql`SELECT COALESCE(SUM(paid_amount::numeric), 0) as total FROM invoices`);
      const pendingRevenueResult = await db.execute(sql`SELECT COALESCE(SUM((amount::numeric - paid_amount::numeric)), 0) as total FROM invoices WHERE status IN ('pending', 'partially_paid', 'overdue')`);
      const tasksResult = await db.execute(sql`SELECT COUNT(*) as completed, (SELECT COUNT(*) FROM tasks) as total FROM tasks WHERE status = 'completed'`);
      
      const activeClients = clientsResult[0]?.count || 0;
      const totalRevenue = totalRevenueResult[0]?.total || 0;
      const pendingInvoices = pendingRevenueResult[0]?.total || 0;
      const teamPerformance = tasksResult[0]?.total > 0 ? Math.round((tasksResult[0]?.completed / tasksResult[0]?.total) * 100) : 0;

      const kpis = {
        totalRevenue: parseFloat(totalRevenue.toString()),
        activeClients: parseInt(activeClients.toString()),
        pendingInvoices: parseFloat(pendingInvoices.toString()),
        teamPerformance
      };
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      // Fallback to basic data if database queries fail
      const kpis = {
        totalRevenue: 0,
        activeClients: 0,
        pendingInvoices: 0,
        teamPerformance: 0
      };
      res.json(kpis);
    }
  });

  // Setup database routes for all CRUD operations
  setupDatabaseRoutes(app);
  registerExpenseRoutes(app);
  registerPaymentSourceRoutes(app);
  registerUserManagementRoutes(app);
  registerKpiRoutes(app);
  registerAnalyticsRoutes(app);
  registerTaskManagementRoutes(app);

  // Seed user management data
  try {
    await seedUserData();
  } catch (error) {
    console.error("Failed to seed user data:", error);
  }

  app.get('/api/clients/:id', async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post('/api/clients', async (req: any, res) => {
    try {
      const clientData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        city: req.body.city,
        country: req.body.country,
        status: req.body.status || 'active',
        totalValue: req.body.totalValue || '0',
        createdBy: '1', // Use development user ID
      };

      const [newClient] = await db.insert(clients).values(clientData).returning();
      res.status(201).json(newClient);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.put('/api/clients/:id', async (req, res) => {
    try {
      const clientData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, clientData);
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Quotation routes
  app.get('/api/quotations', async (req: any, res) => {
    try {
      // Return mock data for development
      const quotations = [
        {
          id: '1',
          quotationNumber: 'QUO-2024-001',
          title: 'Website Development Project',
          clientId: '1',
          amount: '15000',
          status: 'pending',
          validUntil: new Date('2024-02-15'),
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: '2',
          quotationNumber: 'QUO-2024-002',
          title: 'Mobile App Development',
          clientId: '2',
          amount: '25000',
          status: 'approved',
          validUntil: new Date('2024-03-01'),
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20')
        }
      ];
      res.json(quotations);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  // Quotation creation is handled by database-routes.ts

  // Invoice routes
  app.get('/api/invoices', async (req: any, res) => {
    try {
      // Return mock data for development
      const invoices = [
        {
          id: '1',
          invoiceNumber: 'INV-2024-001',
          clientId: '1',
          amount: '15000',
          paidAmount: '15000',
          status: 'paid',
          dueDate: new Date('2024-02-15'),
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-30')
        },
        {
          id: '2',
          invoiceNumber: 'INV-2024-002',
          clientId: '2',
          amount: '25000',
          paidAmount: '12500',
          status: 'partially_paid',
          dueDate: new Date('2024-03-01'),
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-25')
        }
      ];
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post('/api/invoices', async (req: any, res) => {
    try {
      // Mock invoice creation for development
      const newInvoice = {
        id: Date.now().toString(),
        invoiceNumber: `INV-2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        clientId: req.body.clientId || '1',
        amount: req.body.amount || '0',
        paidAmount: '0',
        status: 'pending',
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.status(201).json(newInvoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Expense routes
  app.get('/api/expenses', async (req: any, res) => {
    try {
      // Return mock data for development
      const expenses = [
        {
          id: '1',
          title: 'Office Supplies',
          category: 'office',
          amount: '450',
          description: 'Printer paper, pens, and stationery',
          status: 'approved',
          receiptUrl: null,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-16')
        },
        {
          id: '2',
          title: 'Client Meeting Dinner',
          category: 'travel',
          amount: '180',
          description: 'Business dinner with potential client',
          status: 'pending',
          receiptUrl: null,
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20')
        }
      ];
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post('/api/expenses', async (req: any, res) => {
    try {
      // Mock expense creation for development
      const newExpense = {
        id: Date.now().toString(),
        title: req.body.title || 'New Expense',
        category: req.body.category || 'office',
        amount: req.body.amount || '0',
        description: req.body.description || '',
        status: 'pending',
        receiptUrl: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.status(201).json(newExpense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  // Task routes
  app.get('/api/tasks', async (req: any, res) => {
    try {
      // Return mock data for development
      const tasks = [
        {
          id: '1',
          title: 'Update website content',
          description: 'Review and update the homepage content',
          assignedTo: '1',
          status: 'pending',
          priority: 'high',
          dueDate: new Date('2024-02-15'),
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: '2',
          title: 'Prepare client presentation',
          description: 'Create slides for next weeks client meeting',
          assignedTo: '2',
          status: 'in_progress',
          priority: 'medium',
          dueDate: new Date('2024-02-10'),
          createdAt: new Date('2024-01-18'),
          updatedAt: new Date('2024-01-20')
        },
        {
          id: '3',
          title: 'Code review',
          description: 'Review pull request for new feature',
          assignedTo: '1',
          status: 'completed',
          priority: 'low',
          dueDate: new Date('2024-01-25'),
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-25')
        }
      ];
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post('/api/tasks', async (req: any, res) => {
    try {
      // Mock task creation for development
      const newTask = {
        id: Date.now().toString(),
        title: req.body.title || 'New Task',
        description: req.body.description || '',
        assignedTo: '1',
        status: 'pending',
        priority: req.body.priority || 'medium',
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.status(201).json(newTask);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.put('/api/tasks/:id', async (req: any, res) => {
    try {
      // Mock task update for development
      const updatedTask = {
        id: req.params.id,
        title: req.body.title || 'Updated Task',
        description: req.body.description || '',
        assignedTo: req.body.assignedTo || '1',
        status: req.body.status || 'pending',
        priority: req.body.priority || 'medium',
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(),
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date()
      };
      
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Activity routes
  app.get('/api/activities', async (req: any, res) => {
    try {
      // Fetch real activities from database
      const activitiesResult = await db.execute(
        sql`SELECT id, type, title, description, entity_type as "entityType", entity_id as "entityId", created_by as "createdBy", created_at as "createdAt" 
            FROM activities 
            ORDER BY created_at DESC 
            LIMIT 10`
      );
      
      // Transform the data to match expected format
      const transformedActivities = Array.from(activitiesResult).map((activity: any) => ({
        ...activity,
        createdAt: new Date(activity.createdAt).toISOString(),
        updatedAt: new Date(activity.createdAt).toISOString() // Use createdAt as updatedAt since we don't have updatedAt column
      }));
      
      res.json(transformedActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      // Fallback to empty array instead of mock data
      res.json([]);
    }
  });





  const httpServer = createServer(app);
  return httpServer;
}
