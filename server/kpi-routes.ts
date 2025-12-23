import type { Express } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { employeeKpis, employees } from "@shared/schema";
import { insertEmployeeKpiSchema } from "@shared/schema";

// Simple dev auth middleware - uses actual admin user ID for FK constraints
const devAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    req.user = { id: '8742bebf-9138-4247-85c8-fd2cb70e7d78', claims: { sub: '8742bebf-9138-4247-85c8-fd2cb70e7d78' } };
  }
  next();
};

export function registerKpiRoutes(app: Express) {
  // Get all KPIs for an employee
  app.get("/api/employees/:employeeId/kpis", devAuth, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { period } = req.query;

      let query = db
        .select()
        .from(employeeKpis)
        .where(eq(employeeKpis.employeeId, employeeId))
        .orderBy(desc(employeeKpis.createdAt));

      if (period && typeof period === 'string') {
        const periodsQuery = db
          .select()
          .from(employeeKpis)
          .where(
            and(
              eq(employeeKpis.employeeId, employeeId),
              eq(employeeKpis.evaluationPeriod, period)
            )
          )
          .orderBy(desc(employeeKpis.createdAt));
        
        const periodResults = await periodsQuery;
        return res.json(periodResults);
      }

      const kpis = await query;
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching employee KPIs:", error);
      res.status(500).json({ message: "Failed to fetch employee KPIs" });
    }
  });

  // Get KPI statistics for an employee
  app.get("/api/employees/:employeeId/kpi-stats", devAuth, async (req, res) => {
    try {
      const { employeeId } = req.params;

      const allKpis = await db
        .select()
        .from(employeeKpis)
        .where(eq(employeeKpis.employeeId, employeeId));

      const stats = {
        total: allKpis.length,
        onTrack: allKpis.filter(k => k.status === 'on_track').length,
        belowTarget: allKpis.filter(k => k.status === 'below_target').length,
        exceeded: allKpis.filter(k => k.status === 'exceeded').length,
        notEvaluated: allKpis.filter(k => k.status === 'not_evaluated').length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching KPI statistics:", error);
      res.status(500).json({ message: "Failed to fetch KPI statistics" });
    }
  });

  // Create a new KPI
  app.post("/api/employees/:employeeId/kpis", devAuth, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id || '8742bebf-9138-4247-85c8-fd2cb70e7d78';

      const validatedData = insertEmployeeKpiSchema.parse({
        ...req.body,
        employeeId,
        createdBy: userId,
      });

      const [newKpi] = await db
        .insert(employeeKpis)
        .values(validatedData)
        .returning();

      res.status(201).json(newKpi);
    } catch (error) {
      console.error("Error creating KPI:", error);
      res.status(400).json({ message: "Failed to create KPI" });
    }
  });

  // Update a KPI
  app.put("/api/kpis/:kpiId", devAuth, async (req, res) => {
    try {
      const { kpiId } = req.params;

      const validatedData = insertEmployeeKpiSchema.partial().parse(req.body);

      const [updatedKpi] = await db
        .update(employeeKpis)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(employeeKpis.id, kpiId))
        .returning();

      if (!updatedKpi) {
        return res.status(404).json({ message: "KPI not found" });
      }

      res.json(updatedKpi);
    } catch (error) {
      console.error("Error updating KPI:", error);
      res.status(400).json({ message: "Failed to update KPI" });
    }
  });

  // Delete a KPI
  app.delete("/api/kpis/:kpiId", devAuth, async (req, res) => {
    try {
      const { kpiId } = req.params;

      const [deletedKpi] = await db
        .delete(employeeKpis)
        .where(eq(employeeKpis.id, kpiId))
        .returning();

      if (!deletedKpi) {
        return res.status(404).json({ message: "KPI not found" });
      }

      res.json({ message: "KPI deleted successfully" });
    } catch (error) {
      console.error("Error deleting KPI:", error);
      res.status(500).json({ message: "Failed to delete KPI" });
    }
  });

  // Get unique evaluation periods for an employee
  app.get("/api/employees/:employeeId/kpi-periods", devAuth, async (req, res) => {
    try {
      const { employeeId } = req.params;

      const periods = await db
        .selectDistinct({ evaluationPeriod: employeeKpis.evaluationPeriod })
        .from(employeeKpis)
        .where(eq(employeeKpis.employeeId, employeeId))
        .orderBy(desc(employeeKpis.evaluationPeriod));

      res.json(periods.map(p => p.evaluationPeriod));
    } catch (error) {
      console.error("Error fetching evaluation periods:", error);
      res.status(500).json({ message: "Failed to fetch evaluation periods" });
    }
  });
}