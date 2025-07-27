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
import { sql, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
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
          id: 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
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

      // Development logout route
      app.post('/api/auth/logout', async (req: any, res: any) => {
        // Clear any session data
        if (req.session) {
          req.session.destroy((err: any) => {
            if (err) {
              console.error('Session destruction error:', err);
            }
          });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully', redirect: true });
      });
    } else {
      const { isAuthenticated } = await setupAuth(app);
      
      // Auth routes
      app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
        try {
          const userId = req.user.claims.sub;
          const user = await storage.getUser(userId);
          res.json(user);
        } catch (error) {
          console.error("Error fetching user:", error);
          res.status(500).json({ message: "Failed to fetch user" });
        }
      });

      // Enhanced logout with audit logging
      app.post('/api/auth/logout', isAuthenticated, async (req: any, res) => {
        try {
          const userId = req.user?.claims?.sub;
          const userAgent = req.headers['user-agent'];
          const ipAddress = req.ip || req.connection.remoteAddress;
          
          // Log logout activity
          if (userId) {
            try {
              await storage.logActivity({
                id: require('nanoid').nanoid(),
                userId,
                type: 'logout',
                description: 'User logged out',
                metadata: {
                  userAgent,
                  ipAddress,
                  timestamp: new Date().toISOString()
                },
                timestamp: new Date()
              });
            } catch (logError) {
              console.error('Failed to log logout activity:', logError);
            }
          }
          
          // Clear session and redirect to OIDC logout
          req.logout(() => {
            res.json({ success: true, message: 'Logged out successfully' });
          });
        } catch (error) {
          console.error("Logout error:", error);
          res.status(500).json({ message: "Failed to logout" });
        }
      });
    }
  } catch (authError) {
    console.error("Auth setup failed, using development bypass:", authError);
    
    // Fallback to development auth if setup fails
    app.get('/api/auth/user', async (req, res) => {
      const testUser = {
        id: 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
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

    // Fallback logout route
    app.post('/api/auth/logout', async (req, res) => {
      res.json({ success: true, message: 'Logged out successfully (fallback mode)' });
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
        createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0', // Use actual user ID
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

  app.delete('/api/clients/:id', async (req: any, res) => {
    try {
      const clientId = req.params.id;
      
      // Check if client exists first
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Delete all related data in proper order to avoid foreign key constraints
      
      // 1. Delete payment records first (they reference invoices)
      await db.execute(
        sql`DELETE FROM payments WHERE invoice_id IN (
          SELECT id FROM invoices WHERE client_id = ${clientId}
        )`
      );

      // 2. Delete invoice items (they reference invoices)
      await db.execute(
        sql`DELETE FROM invoice_items WHERE invoice_id IN (
          SELECT id FROM invoices WHERE client_id = ${clientId}
        )`
      );

      // 3. Delete quotation items (they reference quotations)
      await db.execute(
        sql`DELETE FROM quotation_items WHERE quotation_id IN (
          SELECT id FROM quotations WHERE client_id = ${clientId}
        )`
      );

      // 4. Delete client credit history
      await db.execute(
        sql`DELETE FROM client_credit_history WHERE client_id = ${clientId}`
      );

      // 5. Delete invoices
      await db.execute(
        sql`DELETE FROM invoices WHERE client_id = ${clientId}`
      );

      // 6. Delete quotations
      await db.execute(
        sql`DELETE FROM quotations WHERE client_id = ${clientId}`
      );

      // 7. Delete client notes
      await db.execute(
        sql`DELETE FROM client_notes WHERE client_id = ${clientId}`
      );

      // 8. Delete activities related to this client
      await db.execute(
        sql`DELETE FROM activities WHERE entity_type = 'client' AND entity_id = ${clientId}`
      );

      // 9. Finally delete the client
      await db.execute(
        sql`DELETE FROM clients WHERE id = ${clientId}`
      );

      // Log the deletion activity
      try {
        await db.execute(
          sql`INSERT INTO activities (id, type, title, description, entity_type, entity_id, created_by, created_at)
              VALUES (
                ${randomUUID()},
                'client_deleted',
                'Client Deleted',
                ${`Client "${client.name}" and all related data have been permanently deleted`},
                'system',
                ${clientId},
                ${req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0'},
                ${new Date().toISOString()}
              )`
        );
      } catch (activityError) {
        console.error('Failed to log deletion activity:', activityError);
        // Don't fail the deletion if activity logging fails
      }

      res.json({ 
        success: true, 
        message: `Client "${client.name}" and all related data have been permanently deleted` 
      });
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ error: 'Failed to delete client and related data' });
    }
  });

  // Quotation routes - handled by database-routes.ts

  // Quotation creation is handled by database-routes.ts

  // Invoice routes - handled by database-routes.ts

  // Expense routes - handled by expense-routes.ts

  // Task routes - handled by task-management-routes.ts

  // Task creation and updates - handled by task-management-routes.ts

  // Notification routes for navbar
  app.get('/api/notifications', async (req: any, res) => {
    try {
      // Mock notifications data - in real app, this would be a database table
      const notifications = [
        {
          id: '1',
          type: 'invoice.paid',
          title: 'Invoice INV-2024-001 paid',
          message: 'Payment of $1,500 received from TechCorp Solutions',
          isRead: false,
          createdAt: new Date().toISOString(),
          userId: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
        },
        {
          id: '2',
          type: 'client.added',
          title: 'New client registered',
          message: 'TechCorp Solutions has been added to CRM',
          isRead: false,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          userId: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
        },
        {
          id: '3',
          type: 'task.assigned',
          title: 'Task assigned',
          message: 'Website redesign project has been assigned to you',
          isRead: true,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          userId: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
        },
        {
          id: '4',
          type: 'quotation.accepted',
          title: 'Quotation accepted',
          message: 'Quotation QUO-2024-005 has been accepted by client',
          isRead: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          userId: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
        },
      ];

      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', async (req: any, res) => {
    try {
      // In real app, this would update the database
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  app.patch('/api/notifications/mark-all-read', async (req: any, res) => {
    try {
      // In real app, this would update all notifications for the user
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
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
