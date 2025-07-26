import type { Express } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { employeeKpis, users, employees } from "@shared/schema";
import { insertEmployeeKpiSchema } from "@shared/schema";
import { isAuthenticated } from "./replitAuth";

export function registerKpiRoutes(app: Express) {
  // Get all KPIs for an employee
  app.get("/api/employees/:employeeId/kpis", isAuthenticated, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { period } = req.query;

      let query = db
        .select({
          id: employeeKpis.id,
          employeeId: employeeKpis.employeeId,
          title: employeeKpis.title,
          description: employeeKpis.description,
          targetValue: employeeKpis.targetValue,
          actualValue: employeeKpis.actualValue,
          evaluationPeriod: employeeKpis.evaluationPeriod,
          status: employeeKpis.status,
          notes: employeeKpis.notes,
          createdAt: employeeKpis.createdAt,
          updatedAt: employeeKpis.updatedAt,
          createdBy: {
            id: users.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          },
        })
        .from(employeeKpis)
        .leftJoin(users, eq(employeeKpis.createdBy, users.id))
        .leftJoin(employees, eq(users.employeeId, employees.id))
        .where(eq(employeeKpis.employeeId, employeeId))
        .orderBy(desc(employeeKpis.createdAt));

      if (period && typeof period === 'string') {
        const periodsQuery = db
          .select({
            id: employeeKpis.id,
            employeeId: employeeKpis.employeeId,
            title: employeeKpis.title,
            description: employeeKpis.description,
            targetValue: employeeKpis.targetValue,
            actualValue: employeeKpis.actualValue,
            evaluationPeriod: employeeKpis.evaluationPeriod,
            status: employeeKpis.status,
            notes: employeeKpis.notes,
            createdAt: employeeKpis.createdAt,
            updatedAt: employeeKpis.updatedAt,
            createdBy: {
              id: users.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(employeeKpis)
          .leftJoin(users, eq(employeeKpis.createdBy, users.id))
          .leftJoin(employees, eq(users.employeeId, employees.id))
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
  app.get("/api/employees/:employeeId/kpi-stats", isAuthenticated, async (req, res) => {
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
  app.post("/api/employees/:employeeId/kpis", isAuthenticated, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const userId = (req.user as any)?.claims?.sub;

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
  app.put("/api/kpis/:kpiId", isAuthenticated, async (req, res) => {
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
  app.delete("/api/kpis/:kpiId", isAuthenticated, async (req, res) => {
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
  app.get("/api/employees/:employeeId/kpi-periods", isAuthenticated, async (req, res) => {
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