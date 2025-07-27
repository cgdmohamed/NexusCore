import type { Express } from "express";
import { db } from "./db";
import { 
  invoices, 
  payments, 
  expenses, 
  clients, 
  quotations, 
  tasks, 
  users,
  employees 
} from "@shared/schema";
import { eq, gte, lte, and, sum, count, desc, sql } from "drizzle-orm";

const devAuth = (req: any, res: any, next: any) => {
  req.user = { 
    id: 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
    claims: { sub: 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0' } 
  };
  next();
};

export function registerAnalyticsRoutes(app: Express) {
  
  // Company KPIs - High-level performance indicators
  app.get("/api/analytics/kpis", devAuth, async (req, res) => {
    try {
      const { startDate, endDate, period = 'month' } = req.query;
      
      let dateFilter = sql`1=1`;
      if (startDate && endDate) {
        dateFilter = and(
          gte(invoices.createdAt, new Date(startDate as string)),
          lte(invoices.createdAt, new Date(endDate as string))
        );
      }

      // Total Revenue from paid invoices
      const revenueResult = await db.execute(
        sql`SELECT COALESCE(SUM(paid_amount::numeric), 0) as totalRevenue FROM invoices WHERE 1=1`
      );

      // Total Expenses  
      const expenseResult = await db.execute(
        sql`SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as totalExpenses FROM expenses WHERE status = 'approved'`
      );

      // New Clients
      const newClientsResult = await db
        .select({ 
          newClients: count() 
        })
        .from(clients)
        .where(dateFilter as any);

      // Invoice Status Breakdown
      const invoiceStatusResult = await db
        .select({
          status: invoices.status,
          count: count(),
          totalAmount: sql<number>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`
        })
        .from(invoices)
        .where(dateFilter as any)
        .groupBy(invoices.status);

      // Quotation Conversion Rate
      const quotationStatsResult = await db
        .select({
          status: quotations.status,
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(CAST(${quotations.amount} AS DECIMAL)), 0)`
        })
        .from(quotations)
        .where(dateFilter as any)
        .groupBy(quotations.status);

      // Completed Tasks
      const completedTasksResult = await db
        .select({ 
          completedTasks: count() 
        })
        .from(tasks)
        .where(and(
          eq(tasks.status, 'completed'),
          dateFilter as any
        ));

      const totalRevenue = parseFloat(revenueResult[0]?.totalrevenue || '0');
      const totalExpenses = expenseResult[0]?.totalexpenses || 0;
      const netProfit = totalRevenue - totalExpenses;
      const newClients = newClientsResult[0]?.newClients || 0;
      const completedTasks = completedTasksResult[0]?.completedTasks || 0;

      // Format invoice status breakdown
      const invoiceBreakdown = invoiceStatusResult.reduce((acc, item) => {
        acc[item.status] = {
          count: item.count,
          amount: item.totalAmount
        };
        return acc;
      }, {} as Record<string, { count: number; amount: number }>);

      // Format quotation stats
      const quotationBreakdown = quotationStatsResult.reduce((acc, item) => {
        acc[item.status] = {
          count: item.count,
          value: item.totalValue
        };
        return acc;
      }, {} as Record<string, { count: number; value: number }>);

      // Calculate conversion rate
      const totalQuotations = quotationStatsResult.reduce((sum, item) => sum + item.count, 0);
      const acceptedQuotations = quotationBreakdown.accepted?.count || 0;
      const conversionRate = totalQuotations > 0 ? (acceptedQuotations / totalQuotations) * 100 : 0;

      res.json({
        totalRevenue,
        totalExpenses,
        netProfit,
        newClients,
        completedTasks,
        invoiceBreakdown,
        quotationBreakdown,
        conversionRate,
        profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
      });

    } catch (error) {
      console.error("Error fetching analytics KPIs:", error);
      res.status(500).json({ message: "Failed to fetch analytics KPIs" });
    }
  });

  // Financial Reports - Detailed breakdown
  app.get("/api/analytics/financial-reports", devAuth, async (req, res) => {
    try {
      const { startDate, endDate, type = 'summary' } = req.query;
      
      let dateFilter: any = sql`1=1`;
      if (startDate && endDate) {
        dateFilter = and(
          gte(invoices.createdAt, new Date(startDate as string)),
          lte(invoices.createdAt, new Date(endDate as string))
        );
      }

      if (type === 'income') {
        // Income Summary
        const incomeData = await db
          .select({
            month: sql<string>`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`,
            revenue: sql<number>`SUM(CAST(${invoices.amount} AS DECIMAL))`,
            invoiceCount: count()
          })
          .from(invoices)
          .where(and(
            eq(invoices.status, 'paid'),
            dateFilter as any
          ))
          .groupBy(sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`);

        res.json({ incomeData });

      } else if (type === 'expenses') {
        // Simple expense summary
        const expenseData = await db.execute(
          sql`
            SELECT 
              'General' as category,
              SUM(CAST(amount AS DECIMAL)) as totalAmount,
              COUNT(*) as count
            FROM expenses 
            WHERE status = 'approved'
          `
        );

        const expensesByCategory = expenseData.map(row => ({
          category: row.category,
          totalAmount: parseFloat(row.totalAmount?.toString() || '0'),
          count: parseInt(row.count?.toString() || '0')
        }));

        res.json({ expensesByCategory, expensesByMonth: [] });

      } else {
        // P&L Summary
        const revenue = await db
          .select({ 
            totalRevenue: sql<number>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)` 
          })
          .from(invoices)
          .where(and(
            eq(invoices.status, 'paid'),
            dateFilter as any
          ));

        const expenseTotal = await db
          .select({ 
            totalExpenses: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)` 
          })
          .from(expenses)
          .where(and(
            eq(expenses.status, 'approved'),
            dateFilter as any
          ));

        const totalRevenue = revenue[0]?.totalRevenue || 0;
        const totalExpenses = expenseTotal[0]?.totalExpenses || 0;

        res.json({
          summary: {
            totalRevenue,
            totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0
          }
        });
      }

    } catch (error) {
      console.error("Error fetching financial reports:", error);
      res.status(500).json({ message: "Failed to fetch financial reports" });
    }
  });

  // Trend Analysis - Monthly/Quarterly data
  app.get("/api/analytics/trends", devAuth, async (req, res) => {
    try {
      const { period = 'month', metric = 'revenue' } = req.query;
      
      const groupByClause = period === 'quarter' 
        ? sql`TO_CHAR(${invoices.createdAt}, 'YYYY-Q')`
        : sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`;

      if (metric === 'revenue') {
        const trendData = await db
          .select({
            period: groupByClause,
            value: sql<number>`SUM(CAST(${invoices.amount} AS DECIMAL))`,
            count: count()
          })
          .from(invoices)
          .where(eq(invoices.status, 'paid'))
          .groupBy(groupByClause)
          .orderBy(groupByClause)
          .limit(12);

        res.json({ trends: trendData, metric: 'revenue' });

      } else if (metric === 'expenses') {
        const expenseGroupBy = period === 'quarter' 
          ? sql`TO_CHAR(${expenses.createdAt}, 'YYYY-Q')`
          : sql`TO_CHAR(${expenses.createdAt}, 'YYYY-MM')`;

        const trendData = await db
          .select({
            period: expenseGroupBy,
            value: sql<number>`SUM(CAST(${expenses.amount} AS DECIMAL))`,
            count: count()
          })
          .from(expenses)
          .where(eq(expenses.status, 'approved'))
          .groupBy(expenseGroupBy)
          .orderBy(expenseGroupBy)
          .limit(12);

        res.json({ trends: trendData, metric: 'expenses' });

      } else if (metric === 'clients') {
        const clientGroupBy = period === 'quarter' 
          ? sql`TO_CHAR(${clients.createdAt}, 'YYYY-Q')`
          : sql`TO_CHAR(${clients.createdAt}, 'YYYY-MM')`;

        const trendData = await db
          .select({
            period: clientGroupBy,
            value: count(),
            count: count()
          })
          .from(clients)
          .groupBy(clientGroupBy)
          .orderBy(clientGroupBy)
          .limit(12);

        res.json({ trends: trendData, metric: 'clients' });
      }

    } catch (error) {
      console.error("Error fetching trend analysis:", error);
      res.status(500).json({ message: "Failed to fetch trend analysis" });
    }
  });

  // Period Comparison
  app.get("/api/analytics/comparison", devAuth, async (req, res) => {
    try {
      const { period1Start, period1End, period2Start, period2End } = req.query;

      if (!period1Start || !period1End || !period2Start || !period2End) {
        return res.status(400).json({ message: "All period dates are required" });
      }

      // Helper function to get metrics for a period
      const getMetricsForPeriod = async (startDate: string, endDate: string) => {
        const dateFilter = and(
          gte(invoices.createdAt, new Date(startDate)),
          lte(invoices.createdAt, new Date(endDate))
        );

        const revenue = await db
          .select({ 
            total: sql<number>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)` 
          })
          .from(invoices)
          .where(and(eq(invoices.status, 'paid'), dateFilter as any));

        const expenseFilter = and(
          gte(expenses.createdAt, new Date(startDate)),
          lte(expenses.createdAt, new Date(endDate))
        );

        const expenseTotal = await db
          .select({ 
            total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)` 
          })
          .from(expenses)
          .where(and(eq(expenses.status, 'approved'), expenseFilter as any));

        const clientFilter = and(
          gte(clients.createdAt, new Date(startDate)),
          lte(clients.createdAt, new Date(endDate))
        );

        const newClients = await db
          .select({ count: count() })
          .from(clients)
          .where(clientFilter as any);

        const taskFilter = and(
          gte(tasks.createdAt, new Date(startDate)),
          lte(tasks.createdAt, new Date(endDate))
        );

        const completedTasks = await db
          .select({ count: count() })
          .from(tasks)
          .where(and(eq(tasks.status, 'completed'), taskFilter as any));

        return {
          revenue: revenue[0]?.total || 0,
          expenses: expenseTotal[0]?.total || 0,
          newClients: newClients[0]?.count || 0,
          completedTasks: completedTasks[0]?.count || 0
        };
      };

      const period1Metrics = await getMetricsForPeriod(period1Start as string, period1End as string);
      const period2Metrics = await getMetricsForPeriod(period2Start as string, period2End as string);

      // Calculate percentage changes
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const comparison = {
        period1: period1Metrics,
        period2: period2Metrics,
        changes: {
          revenue: {
            absolute: period1Metrics.revenue - period2Metrics.revenue,
            percentage: calculateChange(period1Metrics.revenue, period2Metrics.revenue)
          },
          expenses: {
            absolute: period1Metrics.expenses - period2Metrics.expenses,
            percentage: calculateChange(period1Metrics.expenses, period2Metrics.expenses)
          },
          profit: {
            absolute: (period1Metrics.revenue - period1Metrics.expenses) - (period2Metrics.revenue - period2Metrics.expenses),
            percentage: calculateChange(
              period1Metrics.revenue - period1Metrics.expenses,
              period2Metrics.revenue - period2Metrics.expenses
            )
          },
          newClients: {
            absolute: period1Metrics.newClients - period2Metrics.newClients,
            percentage: calculateChange(period1Metrics.newClients, period2Metrics.newClients)
          },
          completedTasks: {
            absolute: period1Metrics.completedTasks - period2Metrics.completedTasks,
            percentage: calculateChange(period1Metrics.completedTasks, period2Metrics.completedTasks)
          }
        }
      };

      res.json(comparison);

    } catch (error) {
      console.error("Error fetching period comparison:", error);
      res.status(500).json({ message: "Failed to fetch period comparison" });
    }
  });

  // Outstanding Receivables and Payables
  app.get("/api/analytics/outstanding", devAuth, async (req, res) => {
    try {
      // Outstanding Receivables (Unpaid/Partial invoices)
      const receivables = await db
        .select({
          id: invoices.id,
          clientId: invoices.clientId,
          amount: invoices.amount,
          status: invoices.status,
          dueDate: invoices.dueDate,
          createdAt: invoices.createdAt
        })
        .from(invoices)
        .where(sql`${invoices.status} IN ('pending', 'partial')`)
        .orderBy(desc(invoices.createdAt));

      // Calculate total outstanding
      const outstandingTotal = await db
        .select({ 
          total: sql<number>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)` 
        })
        .from(invoices)
        .where(sql`${invoices.status} IN ('pending', 'partial')`);

      // Overdue invoices (past due date)
      const overdueInvoices = await db
        .select({
          id: invoices.id,
          clientId: invoices.clientId,
          amount: invoices.amount,
          dueDate: invoices.dueDate,
          daysPastDue: sql<number>`EXTRACT(DAY FROM NOW() - ${invoices.dueDate})`
        })
        .from(invoices)
        .where(
          and(
            sql`${invoices.status} IN ('pending', 'partial')`,
            sql`${invoices.dueDate} < NOW()`
          )
        )
        .orderBy(sql`EXTRACT(DAY FROM NOW() - ${invoices.dueDate}) DESC`);

      res.json({
        receivables,
        outstandingTotal: outstandingTotal[0]?.total || 0,
        overdueInvoices,
        overdueCount: overdueInvoices.length
      });

    } catch (error) {
      console.error("Error fetching outstanding data:", error);
      res.status(500).json({ message: "Failed to fetch outstanding data" });
    }
  });
}