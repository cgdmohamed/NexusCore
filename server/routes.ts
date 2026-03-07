import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import { notificationService } from "./notification-service";
import { setupDatabaseRoutes } from "./database-routes";
import { registerExpenseRoutes } from "./expense-routes";
import { registerPaymentSourceRoutes } from "./payment-source-routes";
import { registerUserManagementRoutes } from "./user-management-routes";
import { registerKpiRoutes } from "./kpi-routes";
import { registerAnalyticsRoutes } from "./analytics-routes";
import { registerTaskManagementRoutes } from "./task-management-routes";
import { registerProjectRoutes } from "./project-routes";
import { registerServicesRoutes } from "./services-routes";
import { seedUserData } from "./seed-user-data";
import { db } from "./db";
import { users } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint (no auth required)
  app.get('/api/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // Configuration endpoint (no auth required)
  app.get('/api/config', (req, res) => {
    res.json({
      companyName: process.env.COMPANY_NAME || 'Creative Code Nexus',
      companyTagline: process.env.COMPANY_TAGLINE || 'Digital Solutions & Innovation'
    });
  });

  // Readiness check (includes database connectivity)
  app.get('/api/ready', async (req, res) => {
    try {
      // Test database connection
      await db.select().from(users).limit(1);
      res.status(200).json({ 
        status: 'ready', 
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({ 
        status: 'not ready', 
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Authentication setup
  try {
    await setupAuth(app);
    
    // Auth endpoint for user data
    app.get("/api/user", (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json(req.user);
    });
  } catch (authError) {
    console.error("Authentication setup failed:", authError);
    throw authError;
  }

  // User management data seeding
  try {
    await seedUserData();
  } catch (error) {
    console.error("User data seeding failed:", error);
  }

  // Register all module routes
  setupDatabaseRoutes(app);
  registerExpenseRoutes(app);
  registerPaymentSourceRoutes(app);
  registerUserManagementRoutes(app);
  registerKpiRoutes(app);
  registerAnalyticsRoutes(app);
  registerTaskManagementRoutes(app);
  registerProjectRoutes(app);
  registerServicesRoutes(app);

  // Activities endpoint
  app.get('/api/activities', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const activities = await storage.getActivities(userId, 20);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      res.status(500).json({ message: 'Failed to fetch activities' });
    }
  });

  // Notification endpoints
  app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await notificationService.getUserNotifications(userId, page, limit, unreadOnly);
      res.json({
        success: true,
        data: result.notifications,
        pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
        unreadCount: result.unreadCount
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
  });

  app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

      const unreadCount = await notificationService.getUnreadCount(userId);
      res.json({ success: true, data: { unreadCount } });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

      await notificationService.markAsRead(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}