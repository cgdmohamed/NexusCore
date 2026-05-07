import type { Express } from "express";
import { eq, desc, and, gte, lte, ilike, or, sql } from "drizzle-orm";
import { db } from "./db";
import { 
  expenses, 
  expenseCategories, 
  expensePayments,
  paymentSources,
  paymentSourceTransactions,
  type Expense,
  type ExpenseCategory,
  type ExpensePayment,
  type InsertExpense,
  type InsertExpenseCategory,
  type InsertExpensePayment,
  type InsertPaymentSourceTransaction
} from "@shared/schema";
import { requireAuth, requirePermission } from "./auth";
import { notificationService } from "./notification-service";

// Helper function to handle payment source transactions
async function handlePaymentSourceTransaction(
  paymentSourceId: string, 
  amount: string, 
  expenseId: string, 
  expenseTitle: string, 
  userId: string
) {
  // Get current payment source balance
  const [paymentSource] = await db
    .select()
    .from(paymentSources)
    .where(eq(paymentSources.id, paymentSourceId));

  if (!paymentSource) {
    throw new Error("Payment source not found");
  }

  const balanceBefore = paymentSource.currentBalance ?? "0";
  const expenseAmount = parseFloat(amount);

  // Update payment source balance using DB arithmetic to preserve decimal precision
  const [updatedSource] = await db
    .update(paymentSources)
    .set({ 
      currentBalance: sql`${paymentSources.currentBalance} - ${expenseAmount}::numeric`,
      updatedAt: new Date()
    })
    .where(eq(paymentSources.id, paymentSourceId))
    .returning();

  const balanceAfter = updatedSource?.currentBalance ?? (parseFloat(balanceBefore) - expenseAmount).toFixed(2);

  // Create transaction record
  await db.insert(paymentSourceTransactions).values({
    paymentSourceId,
    type: "expense",
    amount: expenseAmount.toFixed(2),
    description: `Expense payment: ${expenseTitle}`,
    referenceId: expenseId,
    referenceType: "expense",
    balanceBefore,
    balanceAfter,
    createdBy: userId,
  });
}

export function registerExpenseRoutes(app: Express) {
  // Get all expense categories
  app.get("/api/expense-categories", requireAuth, async (req, res) => {
    try {
      const categories = await db
        .select()
        .from(expenseCategories)
        .where(eq(expenseCategories.isActive, true))
        .orderBy(expenseCategories.name);
      
      res.json(categories);
    } catch (error) {
      console.error("Error fetching expense categories:", error);
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });

  // Create expense category
  app.post("/api/expense-categories", requireAuth, async (req, res) => {
    try {
      const categoryData: InsertExpenseCategory = req.body;
      
      const [category] = await db
        .insert(expenseCategories)
        .values(categoryData)
        .returning();
      
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating expense category:", error);
      res.status(500).json({ message: "Failed to create expense category" });
    }
  });

  // Get expense statistics (must be before parameterized routes)
  app.get("/api/expenses/stats", requireAuth, async (req, res) => {
    try {
      const { period = "month" } = req.query;
      
      // Calculate date range based on period
      const now = new Date();
      let startDate = new Date();
      
      switch (period) {
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          startDate.setMonth(now.getMonth() - 3);
          break;
        case "year":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      const periodFilter = and(
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, now)
      );

      // Use DB-level aggregates for financial totals to avoid float drift
      const [totals] = await db.select({
        totalExpenses: sql<number>`COUNT(*)`,
        totalAmount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      }).from(expenses).where(periodFilter);

      const [paidTotals] = await db.select({
        paidExpenses: sql<number>`COUNT(*)`,
        paidAmount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      }).from(expenses).where(and(periodFilter, eq(expenses.status, "paid")));

      const [pendingTotals] = await db.select({
        pendingExpenses: sql<number>`COUNT(*)`,
        pendingAmount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      }).from(expenses).where(and(periodFilter, eq(expenses.status, "pending")));

      const [overdueCount] = await db.select({
        overdueExpenses: sql<number>`COUNT(*)`,
      }).from(expenses).where(and(periodFilter, eq(expenses.status, "overdue")));

      // Category breakdown using DB-level GROUP BY and SUM
      const categoryRows = await db.select({
        name: expenseCategories.name,
        color: expenseCategories.color,
        amount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
        .from(expenses)
        .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .where(periodFilter)
        .groupBy(expenseCategories.id, expenseCategories.name, expenseCategories.color);

      const categoryBreakdown = categoryRows.map(row => ({
        name: row.name,
        color: row.color,
        amount: parseFloat(row.amount),
        count: Number(row.count),
      }));

      res.json({
        totalExpenses: Number(totals?.totalExpenses || 0),
        totalAmount: parseFloat(totals?.totalAmount || '0'),
        paidExpenses: Number(paidTotals?.paidExpenses || 0),
        paidAmount: parseFloat(paidTotals?.paidAmount || '0'),
        pendingExpenses: Number(pendingTotals?.pendingExpenses || 0),
        pendingAmount: parseFloat(pendingTotals?.pendingAmount || '0'),
        overdueExpenses: Number(overdueCount?.overdueExpenses || 0),
        categoryBreakdown,
      });
    } catch (error) {
      console.error("Error calculating expense statistics:", error);
      res.status(500).json({ message: "Failed to calculate expense statistics" });
    }
  });

  // Get all expenses with filters
  app.get("/api/expenses", requireAuth, async (req, res) => {
    try {
      const {
        type,
        categoryId,
        status,
        startDate,
        endDate,
        search,
        clientId,
      } = req.query;

      let baseQuery = db
        .select({
          expense: expenses,
          category: expenseCategories,
        })
        .from(expenses)
        .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id));

      // Apply filters
      const conditions = [];

      if (type) {
        conditions.push(eq(expenses.type, type as string));
      }

      if (categoryId) {
        conditions.push(eq(expenses.categoryId, categoryId as string));
      }

      if (status) {
        conditions.push(eq(expenses.status, status as string));
      }

      if (clientId) {
        conditions.push(eq(expenses.relatedClientId, clientId as string));
      }

      if (startDate) {
        conditions.push(gte(expenses.expenseDate, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(expenses.expenseDate, new Date(endDate as string)));
      }

      if (search) {
        conditions.push(
          or(
            ilike(expenses.title, `%${search}%`),
            ilike(expenses.description, `%${search}%`)
          )
        );
      }

      let query = baseQuery;
      if (conditions.length > 0) {
        query = baseQuery.where(and(...conditions));
      }

      const results = await query.orderBy(desc(expenses.createdAt));

      // Transform results to include category info
      const expensesWithCategories = results.map(result => ({
        ...result.expense,
        category: result.category,
      }));

      res.json(expensesWithCategories);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Get expense by ID
  app.get("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const [result] = await db
        .select({
          expense: expenses,
          category: expenseCategories,
        })
        .from(expenses)
        .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .where(eq(expenses.id, id));

      if (!result) {
        return res.status(404).json({ message: "Expense not found" });
      }

      const expenseWithCategory = {
        ...result.expense,
        category: result.category,
      };

      res.json(expenseWithCategory);
    } catch (error) {
      console.error("Error fetching expense:", error);
      res.status(500).json({ message: "Failed to fetch expense" });
    }
  });

  // Create expense
  app.post("/api/expenses", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log("Received expense payload:", JSON.stringify(req.body, null, 2));
      
      // Convert date strings to Date objects
      const expenseData: InsertExpense = {
        ...req.body,
        expenseDate: new Date(req.body.expenseDate),
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log("Final expense data for DB (dates converted):", {
        ...expenseData,
        expenseDate: expenseData.expenseDate?.toISOString(),
        createdAt: expenseData.createdAt?.toISOString(),
        updatedAt: expenseData.updatedAt?.toISOString(),
      });

      // Attachment is optional - no validation required

      const [expense] = await db
        .insert(expenses)
        .values(expenseData)
        .returning();

      // If expense is marked as paid on creation or has a payment source, handle payment source transaction
      if (expense.status === "paid" && expense.paymentSourceId) {
        await handlePaymentSourceTransaction(expense.paymentSourceId, expense.amount, expense.id, expense.title, userId);
      }

      // If it's a recurring expense, create the first payment record
      if (expense.isRecurring && expense.status === "paid") {
        await db.insert(expensePayments).values({
          expenseId: expense.id,
          amount: expense.amount,
          paymentDate: expense.paidDate || new Date(),
          paymentMethod: expense.paymentMethod,
          paymentReference: expense.paymentReference,
          attachmentUrl: expense.attachmentUrl,
          notes: `Initial payment for recurring expense: ${expense.title}`,
          createdBy: userId,
        });
      }

      res.status(201).json(expense);

      // Notify managers/admins about new expense submission (non-blocking)
      if (expense.status === 'pending') {
        try {
          await notificationService.notifyExpenseSubmitted(
            expense.id,
            userId,
            expense.title,
            parseFloat(expense.amount)
          );
        } catch (notifyError) {
          console.error('Error sending expense submitted notification:', notifyError);
        }
      }
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  // Update expense
  app.put("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      console.log("Received expense update payload:", JSON.stringify(req.body, null, 2));
      
      // Convert date fields to Date objects for updates
      const updates = { 
        ...req.body, 
        expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : undefined,
        updatedAt: new Date() 
      };
      
      console.log("Final update data for DB (dates converted):", {
        ...updates,
        expenseDate: updates.expenseDate?.toISOString(),
        updatedAt: updates.updatedAt?.toISOString(),
      });

      const [expense] = await db
        .update(expenses)
        .set(updates)
        .where(eq(expenses.id, id))
        .returning();

      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      res.json(expense);
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });

  // Mark expense as paid
  app.post("/api/expenses/:id/pay", requirePermission('expenses', 'approve'), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { 
        amount, 
        paymentMethod, 
        paymentReference, 
        attachmentUrl, 
        notes 
      } = req.body;

      // Get the expense first to check payment source
      const [existingExpense] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, id));

      if (!existingExpense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      // Update expense status
      const [expense] = await db
        .update(expenses)
        .set({ 
          status: "paid", 
          paidDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, id))
        .returning();

      // Handle payment source transaction if payment source is linked
      if (expense.paymentSourceId) {
        await handlePaymentSourceTransaction(
          expense.paymentSourceId, 
          expense.amount, 
          expense.id, 
          expense.title, 
          userId
        );
      }

      // Create payment record
      const [payment] = await db
        .insert(expensePayments)
        .values({
          expenseId: id,
          amount: amount || expense.amount,
          paymentDate: new Date(),
          paymentMethod,
          paymentReference,
          attachmentUrl,
          notes,
          createdBy: userId,
        })
        .returning();

      // For recurring expenses, schedule next payment
      if (expense.isRecurring && expense.frequency) {
        let nextDueDate = new Date(expense.dueDate || new Date());
        
        switch (expense.frequency) {
          case "monthly":
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            break;
          case "quarterly":
            nextDueDate.setMonth(nextDueDate.getMonth() + 3);
            break;
          case "yearly":
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
            break;
        }

        await db
          .update(expenses)
          .set({ 
            nextDueDate,
            status: "pending", // Reset status for next payment
            updatedAt: new Date(),
          })
          .where(eq(expenses.id, id));
      }

      res.json({ expense, payment });
    } catch (error) {
      console.error("Error processing expense payment:", error);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // Reject expense (manager/admin only)
  app.post("/api/expenses/:id/reject", requirePermission('expenses', 'approve'), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const rejectionReason = req.body.rejectionReason?.trim();
      if (!rejectionReason) {
        return res.status(400).json({ message: "A rejection reason is required." });
      }

      const [existingExpense] = await db.select().from(expenses).where(eq(expenses.id, id));
      if (!existingExpense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      const rejectableStatuses = ['pending', 'approved'];
      if (!rejectableStatuses.includes(existingExpense.status)) {
        return res.status(400).json({
          message: `Cannot reject an expense with status "${existingExpense.status}".`,
        });
      }

      const [expense] = await db
        .update(expenses)
        .set({
          status: "rejected",
          rejectionReason,
          rejectedBy: userId,
          rejectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, id))
        .returning();

      res.json(expense);

      // Notify the submitter (non-blocking)
      if (existingExpense.createdBy && existingExpense.createdBy !== userId) {
        try {
          await notificationService.createNotification({
            userId: existingExpense.createdBy,
            type: "expense_rejected",
            title: "Expense Rejected",
            message: `Your expense "${existingExpense.title}" has been rejected. Reason: ${rejectionReason}`,
            priority: "high",
            entityType: "expense",
            entityId: id,
            entityUrl: `/expenses/${id}`,
            metadata: { rejectionReason, rejectedBy: userId },
            createdBy: userId,
          });
        } catch (notifyError) {
          console.error("Error sending expense rejected notification:", notifyError);
        }
      }
    } catch (error) {
      console.error("Error rejecting expense:", error);
      res.status(500).json({ message: "Failed to reject expense" });
    }
  });

  // Get expense payments history
  app.get("/api/expenses/:id/payments", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const payments = await db
        .select()
        .from(expensePayments)
        .where(eq(expensePayments.expenseId, id))
        .orderBy(desc(expensePayments.paymentDate));

      res.json(payments);
    } catch (error) {
      console.error("Error fetching expense payments:", error);
      res.status(500).json({ message: "Failed to fetch expense payments" });
    }
  });

  // Delete expense
  app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Delete related payments first
      await db.delete(expensePayments).where(eq(expensePayments.expenseId, id));
      
      // Delete expense
      const [expense] = await db
        .delete(expenses)
        .where(eq(expenses.id, id))
        .returning();

      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });
}