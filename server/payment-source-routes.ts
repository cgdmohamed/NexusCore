import type { Express } from "express";
import { db } from "./db";
import { requirePermission } from "./auth";
import { 
  paymentSources, 
  paymentSourceTransactions, 
  expenses,
  payments,
  insertPaymentSourceSchema, 
  insertPaymentSourceTransactionSchema,
  type PaymentSource,
  type PaymentSourceTransaction,
  type InsertPaymentSource,
  type InsertPaymentSourceTransaction
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { ZodError } from "zod";

export function registerPaymentSourceRoutes(app: Express) {
  // Get all payment sources
  app.get("/api/payment-sources", requirePermission("paymentSources", "view"), async (req, res) => {
    try {
      const sources = await db
        .select()
        .from(paymentSources)
        .orderBy(desc(paymentSources.createdAt));
      
      res.json(sources);
    } catch (error) {
      console.error("Error fetching payment sources:", error);
      res.status(500).json({ message: "Failed to fetch payment sources" });
    }
  });

  // Get payment source statistics
  app.get("/api/payment-sources/stats", requirePermission("paymentSources", "view"), async (req, res) => {
    try {
      const { period = "month" } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "quarter":
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Get total sources and balances
      const sourcesData = await db
        .select({
          totalSources: sql<number>`COUNT(*)`,
          totalBalance: sql<number>`SUM(CAST(${paymentSources.currentBalance} AS DECIMAL))`,
          activeSources: sql<number>`SUM(CASE WHEN ${paymentSources.isActive} THEN 1 ELSE 0 END)`,
        })
        .from(paymentSources);

      // Get expenses by payment source for the period
      const expensesBySource = await db
        .select({
          paymentSourceId: expenses.paymentSourceId,
          totalSpent: sql<number>`SUM(CAST(${expenses.amount} AS DECIMAL))`,
          expenseCount: sql<number>`COUNT(*)`,
        })
        .from(expenses)
        .where(
          and(
            gte(expenses.expenseDate, startDate),
            lte(expenses.expenseDate, now),
            eq(expenses.status, "approved")
          )
        )
        .groupBy(expenses.paymentSourceId);

      const stats = sourcesData[0] || { totalSources: 0, totalBalance: 0, activeSources: 0 };

      res.json({
        ...stats,
        expensesBySource,
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      });
    } catch (error) {
      console.error("Error fetching payment source stats:", error);
      res.status(500).json({ message: "Failed to fetch payment source statistics" });
    }
  });

  // Get payment source by ID
  app.get("/api/payment-sources/:id", requirePermission("paymentSources", "view"), async (req, res) => {
    try {
      const { id } = req.params;
      
      const [source] = await db
        .select()
        .from(paymentSources)
        .where(eq(paymentSources.id, id));

      if (!source) {
        return res.status(404).json({ message: "Payment source not found" });
      }

      res.json(source);
    } catch (error) {
      console.error("Error fetching payment source:", error);
      res.status(500).json({ message: "Failed to fetch payment source" });
    }
  });

  // Create payment source
  app.post("/api/payment-sources", requirePermission("paymentSources", "add"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const validatedData = insertPaymentSourceSchema.parse(req.body);
      
      const [newSource] = await db
        .insert(paymentSources)
        .values({
          ...validatedData,
          currentBalance: validatedData.initialBalance || "0",
        })
        .returning();

      // Create initial transaction if there's an initial balance
      if (validatedData.initialBalance && parseFloat(validatedData.initialBalance) !== 0) {
        await db.insert(paymentSourceTransactions).values({
          paymentSourceId: newSource.id,
          type: "adjustment",
          amount: validatedData.initialBalance,
          description: "Initial balance setup",
          referenceType: "manual_adjustment",
          balanceBefore: "0",
          balanceAfter: validatedData.initialBalance,
          createdBy: userId,
        });
      }

      res.status(201).json(newSource);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid payment source data", errors: error.errors });
      }
      console.error("Error creating payment source:", error);
      res.status(500).json({ message: "Failed to create payment source" });
    }
  });

  // Update payment source
  app.put("/api/payment-sources/:id", requirePermission("paymentSources", "edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertPaymentSourceSchema.parse(req.body);

      const [updatedSource] = await db
        .update(paymentSources)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(paymentSources.id, id))
        .returning();

      if (!updatedSource) {
        return res.status(404).json({ message: "Payment source not found" });
      }

      res.json(updatedSource);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid payment source data", errors: error.errors });
      }
      console.error("Error updating payment source:", error);
      res.status(500).json({ message: "Failed to update payment source" });
    }
  });

  // Adjust balance (manual adjustment)
  app.post("/api/payment-sources/:id/adjust-balance", requirePermission("paymentSources", "approve"), async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, description, type = "adjustment" } = req.body;
      const userId = (req.user as any)?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (!amount || !description) {
        return res.status(400).json({ message: "Amount and description are required" });
      }

      // Get current source
      const [source] = await db
        .select()
        .from(paymentSources)
        .where(eq(paymentSources.id, id));

      if (!source) {
        return res.status(404).json({ message: "Payment source not found" });
      }

      const balanceBefore = source.currentBalance ?? "0";
      const adjustmentAmount = parseFloat(amount);
      if (!Number.isFinite(adjustmentAmount)) {
        // NaN would be stored as a NaN numeric and corrupt the balance
        return res.status(400).json({ message: "Amount must be a valid number" });
      }

      // Update balance using DB arithmetic to preserve decimal precision
      const [updatedSource] = await db
        .update(paymentSources)
        .set({
          currentBalance: sql`${paymentSources.currentBalance} + ${adjustmentAmount}::numeric`,
          updatedAt: new Date(),
        })
        .where(eq(paymentSources.id, id))
        .returning();

      const balanceAfter = updatedSource?.currentBalance ?? (parseFloat(balanceBefore) + adjustmentAmount).toFixed(2);

      // Create transaction record
      await db.insert(paymentSourceTransactions).values({
        paymentSourceId: id,
        type,
        amount: adjustmentAmount.toFixed(2),
        description,
        referenceType: "manual_adjustment",
        balanceBefore,
        balanceAfter,
        createdBy: userId,
      });

      res.json(updatedSource);
    } catch (error) {
      console.error("Error adjusting balance:", error);
      res.status(500).json({ message: "Failed to adjust balance" });
    }
  });

  // Make one account the default (the only one): it receives client payments when no account is chosen
  app.post("/api/payment-sources/:id/default", requirePermission("paymentSources", "edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const outcome = await db.transaction(async (tx) => {
        const [source] = await tx.select().from(paymentSources).where(eq(paymentSources.id, id)).for("update");
        if (!source) return { status: 404, message: "Payment source not found" };
        if (source.isActive === false) return { status: 400, message: "An inactive account cannot be the default." };
        await tx.update(paymentSources).set({ isDefault: false, updatedAt: new Date() }).where(sql`${paymentSources.isDefault} = true AND ${paymentSources.id} <> ${id}`);
        const [updated] = await tx.update(paymentSources).set({ isDefault: true, updatedAt: new Date() }).where(eq(paymentSources.id, id)).returning();
        return { status: 200, source: updated };
      });
      if (outcome.status !== 200) return res.status(outcome.status).json({ message: (outcome as any).message });
      res.json((outcome as any).source);
    } catch (error) {
      console.error("Error setting default payment source:", error);
      res.status(500).json({ message: "Failed to set the default account" });
    }
  });

  // Take the default mark off (client payments then go to no account unless one is chosen)
  app.delete("/api/payment-sources/:id/default", requirePermission("paymentSources", "edit"), async (req, res) => {
    try {
      const [updated] = await db.update(paymentSources).set({ isDefault: false, updatedAt: new Date() }).where(eq(paymentSources.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Payment source not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error clearing default payment source:", error);
      res.status(500).json({ message: "Failed to clear the default account" });
    }
  });

  // Delete payment source
  app.delete("/api/payment-sources/:id", requirePermission("paymentSources", "delete"), async (req, res) => {
    try {
      const { id } = req.params;

      // Check if source has associated expenses
      const [expenseCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(expenses)
        .where(eq(expenses.paymentSourceId, id));

      if (expenseCount.count > 0) {
        return res.status(400).json({ 
          message: "Cannot delete payment source with associated expenses. Please remove or reassign expenses first." 
        });
      }

      // Collections and refunds that point at the account keep their history, so it cannot go
      const [paymentCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(payments)
        .where(eq(payments.paymentSourceId, id));
      if (Number(paymentCount.count) > 0) {
        return res.status(400).json({
          message: "Cannot delete payment source with client payments recorded on it. Deactivate it instead.",
        });
      }

      const [deletedSource] = await db
        .delete(paymentSources)
        .where(eq(paymentSources.id, id))
        .returning();

      if (!deletedSource) {
        return res.status(404).json({ message: "Payment source not found" });
      }

      res.json({ message: "Payment source deleted successfully" });
    } catch (error) {
      console.error("Error deleting payment source:", error);
      res.status(500).json({ message: "Failed to delete payment source" });
    }
  });

  // Get payment source transactions
  app.get("/api/payment-sources/:id/transactions", requirePermission("paymentSources", "view"), async (req, res) => {
    try {
      const { id } = req.params;
      
      const transactions = await db
        .select()
        .from(paymentSourceTransactions)
        .where(eq(paymentSourceTransactions.paymentSourceId, id))
        .orderBy(desc(paymentSourceTransactions.createdAt));

      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Get expenses by payment source
  app.get("/api/payment-sources/:id/expenses", requirePermission("paymentSources", "view"), async (req, res) => {
    try {
      const { id } = req.params;
      
      const sourceExpenses = await db
        .select()
        .from(expenses)
        .where(eq(expenses.paymentSourceId, id))
        .orderBy(desc(expenses.expenseDate));

      res.json(sourceExpenses);
    } catch (error) {
      console.error("Error fetching payment source expenses:", error);
      res.status(500).json({ message: "Failed to fetch payment source expenses" });
    }
  });
}
