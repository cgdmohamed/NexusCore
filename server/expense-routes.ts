import type { Express } from "express";
import { eq, desc, and, gte, lte, ilike, or } from "drizzle-orm";
import { db } from "./db";
import { 
  expenses, 
  expenseCategories, 
  expensePayments,
  type Expense,
  type ExpenseCategory,
  type ExpensePayment,
  type InsertExpense,
  type InsertExpenseCategory,
  type InsertExpensePayment
} from "@shared/schema";

export function registerExpenseRoutes(app: Express) {
  // Get all expense categories
  app.get("/api/expense-categories", async (req, res) => {
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
  app.post("/api/expense-categories", async (req, res) => {
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
  app.get("/api/expenses/stats", async (req, res) => {
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

      // Get all expenses in period
      const expenseResults = await db
        .select({
          expense: expenses,
          category: expenseCategories,
        })
        .from(expenses)
        .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .where(
          and(
            gte(expenses.expenseDate, startDate),
            lte(expenses.expenseDate, now)
          )
        );
      
      const allExpenses = Array.isArray(expenseResults) ? expenseResults : [];

      // Calculate statistics
      const totalExpenses = allExpenses.length;
      const totalAmount = allExpenses.reduce((sum, item) => sum + parseFloat(item.expense.amount), 0);
      
      const paidExpenses = allExpenses.filter(item => item.expense.status === "paid");
      const pendingExpenses = allExpenses.filter(item => item.expense.status === "pending");
      const overdueExpenses = allExpenses.filter(item => item.expense.status === "overdue");
      
      const paidAmount = paidExpenses.reduce((sum, item) => sum + parseFloat(item.expense.amount), 0);
      const pendingAmount = pendingExpenses.reduce((sum, item) => sum + parseFloat(item.expense.amount), 0);

      // Category breakdown
      const categoryBreakdown = allExpenses.reduce((acc, item) => {
        const category = item.category;
        const expense = item.expense;
        
        if (!category) return acc;
        
        if (!acc[category.name]) {
          acc[category.name] = {
            name: category.name,
            color: category.color,
            amount: 0,
            count: 0,
          };
        }
        
        acc[category.name].amount += parseFloat(expense.amount);
        acc[category.name].count += 1;
        
        return acc;
      }, {} as Record<string, any>);

      res.json({
        totalExpenses,
        totalAmount,
        paidExpenses: paidExpenses.length,
        paidAmount,
        pendingExpenses: pendingExpenses.length,
        pendingAmount,
        overdueExpenses: overdueExpenses.length,
        categoryBreakdown: Object.values(categoryBreakdown),
      });
    } catch (error) {
      console.error("Error calculating expense statistics:", error);
      res.status(500).json({ message: "Failed to calculate expense statistics" });
    }
  });

  // Get all expenses with filters
  app.get("/api/expenses", async (req, res) => {
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
  app.get("/api/expenses/:id", async (req, res) => {
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
  app.post("/api/expenses", async (req, res) => {
    try {
      const userId = '1'; // Development user ID
      
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
        expenseDate: expenseData.expenseDate.toISOString(),
        createdAt: expenseData.createdAt.toISOString(),
        updatedAt: expenseData.updatedAt.toISOString(),
      });

      // Validate mandatory attachment
      if (!expenseData.attachmentUrl || !expenseData.attachmentType) {
        return res.status(400).json({ 
          message: "Attachment is mandatory for all expense records" 
        });
      }

      const [expense] = await db
        .insert(expenses)
        .values(expenseData)
        .returning();

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
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  // Update expense
  app.put("/api/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = '1'; // Development user ID
      // Convert date fields to Date objects for updates
      const updates = { 
        ...req.body, 
        expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : undefined,
        updatedAt: new Date() 
      };

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
  app.post("/api/expenses/:id/pay", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = '1'; // Development user ID
      const { 
        amount, 
        paymentMethod, 
        paymentReference, 
        attachmentUrl, 
        notes 
      } = req.body;

      // Validate mandatory attachment for payment
      if (!attachmentUrl) {
        return res.status(400).json({ 
          message: "Payment attachment is mandatory" 
        });
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

      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
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

  // Get expense payments history
  app.get("/api/expenses/:id/payments", async (req, res) => {
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
  app.delete("/api/expenses/:id", async (req, res) => {
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