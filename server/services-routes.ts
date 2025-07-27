import type { Express } from "express";
import { z } from "zod";
import { eq, desc, asc, and, ilike, or } from "drizzle-orm";
import { storage } from "./storage";
import { insertServiceSchema, updateServiceSchema, type Service, type InsertService } from "@shared/schema";

export function registerServicesRoutes(app: Express) {
  // Get all services with pagination and filtering
  app.get("/api/services", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || "";
      const category = req.query.category as string || "";
      const activeOnly = req.query.activeOnly === "true";
      const sortBy = req.query.sortBy as string || "name";
      const sortOrder = req.query.sortOrder as string || "asc";

      const result = await storage.getServices({
        page,
        limit,
        search,
        category,
        activeOnly,
        sortBy,
        sortOrder,
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  // Get service by ID
  app.get("/api/services/:id", async (req, res) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({ error: "Failed to fetch service" });
    }
  });

  // Create new service
  app.post("/api/services", async (req, res) => {
    try {
      const validatedData = insertServiceSchema.parse(req.body);
      const userId = (req.user as any)?.id;

      const service = await storage.createService(validatedData);

      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid service data", details: error.errors });
      }
      console.error("Error creating service:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  // Update service
  app.put("/api/services/:id", async (req, res) => {
    try {
      const validatedData = updateServiceSchema.parse({
        id: req.params.id,
        ...req.body,
      });

      const service = await storage.updateService(validatedData.id, validatedData);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      res.json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid service data", details: error.errors });
      }
      console.error("Error updating service:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  // Delete service
  app.delete("/api/services/:id", async (req, res) => {
    try {
      const success = await storage.deleteService(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  // Get service categories
  app.get("/api/services/categories", async (req, res) => {
    try {
      const categories = await storage.getServiceCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching service categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Bulk activate/deactivate services
  app.patch("/api/services/bulk-status", async (req, res) => {
    try {
      const { serviceIds, isActive } = req.body;
      
      if (!Array.isArray(serviceIds) || typeof isActive !== "boolean") {
        return res.status(400).json({ error: "Invalid bulk update data" });
      }

      const result = await storage.bulkUpdateServiceStatus(serviceIds, isActive);
      res.json({ success: true, updatedCount: result });
    } catch (error) {
      console.error("Error bulk updating services:", error);
      res.status(500).json({ error: "Failed to bulk update services" });
    }
  });
}