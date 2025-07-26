import type { Express } from "express";
import { db } from "./db";
import { 
  paymentSources, 
  paymentSourceTransactions, 
  expenses,
  insertPaymentSourceSchema, 
  insertPaymentSourceTransactionSchema,
  type PaymentSource,
  type PaymentSourceTransaction,
  type InsertPaymentSource,
  type InsertPaymentSourceTransaction
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
// Development middleware that bypasses authentication
const devAuth = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === 'development') {
    // Mock user for development
    req.user = {
      claims: {
        sub: '1',
        email: 'test@company.com'
      }
    };
  }
  next();
};

export function registerPaymentSourceRoutes(app: Express) {
  // Get all payment sources
  app.get("/api/payment-sources", devAuth, async (req, res) => {
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
  app.get("/api/payment-sources/stats", devAuth, async (req, res) => {
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
  app.get("/api/payment-sources/:id", devAuth, async (req, res) => {
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
  app.post("/api/payment-sources", devAuth, async (req, res) => {
    try {
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
          createdBy: (req.user as any)?.claims?.sub,
        });
      }

      res.status(201).json(newSource);
    } catch (error) {
      console.error("Error creating payment source:", error);
      res.status(500).json({ message: "Failed to create payment source" });
    }
  });

  // Update payment source
  app.put("/api/payment-sources/:id", devAuth, async (req, res) => {
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
      console.error("Error updating payment source:", error);
      res.status(500).json({ message: "Failed to update payment source" });
    }
  });

  // Adjust balance (manual adjustment)
  app.post("/api/payment-sources/:id/adjust-balance", devAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, description, type = "adjustment" } = req.body;

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

      const currentBalance = parseFloat(source.currentBalance);
      const adjustmentAmount = parseFloat(amount);
      const newBalance = currentBalance + adjustmentAmount;

      // Update balance
      const [updatedSource] = await db
        .update(paymentSources)
        .set({
          currentBalance: newBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(paymentSources.id, id))
        .returning();

      // Create transaction record
      await db.insert(paymentSourceTransactions).values({
        paymentSourceId: id,
        type,
        amount: amount,
        description,
        referenceType: "manual_adjustment",
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        createdBy: (req.user as any)?.claims?.sub,
      });

      res.json(updatedSource);
    } catch (error) {
      console.error("Error adjusting balance:", error);
      res.status(500).json({ message: "Failed to adjust balance" });
    }
  });

  // Delete payment source
  app.delete("/api/payment-sources/:id", devAuth, async (req, res) => {
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
  app.get("/api/payment-sources/:id/transactions", devAuth, async (req, res) => {
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
  app.get("/api/payment-sources/:id/expenses", devAuth, async (req, res) => {
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