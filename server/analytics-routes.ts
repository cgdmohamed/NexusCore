import type { Express } from "express";
import { db } from "./db";
import { invoices, expenses, clients, quotations, tasks } from "@shared/schema";
import { and, count, gte, lte, sql } from "drizzle-orm";
import { requirePermission } from "./auth";
import { APP_TIMEZONE } from "./task-insights";
import { bucketAging } from "./dashboard-overview";
import {
  buildSeries, collectedTotal, monthlyCollected, monthlySpent, parseRange, spentByCategory, spentTotal,
  summarizeSeries, trailingMonths,
} from "./analytics-series";

const num = (v: string | number | null | undefined) => {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

// Money figures here share one definition with the dashboard: revenue is what payments actually collected
// (by payment date, refunds counted), expenses are paid expenses (by the day they were paid).
export function registerAnalyticsRoutes(app: Express) {

  // Company KPIs - High-level performance indicators
  app.get("/api/analytics/kpis", requirePermission('analytics', 'view'), async (req, res) => {
    try {
      const { from, to } = parseRange(req.query.startDate, req.query.endDate);
      const ranged = !!(from && to);

      const totalRevenue = await collectedTotal(from, to);
      const totalExpenses = await spentTotal(from, to);

      const [newClientsRow] = await db.select({ n: count() }).from(clients)
        .where(ranged ? and(gte(clients.createdAt, from!), lte(clients.createdAt, to!)) : undefined);

      const invoiceStatusResult = await db
        .select({
          status: invoices.status,
          count: count(),
          totalAmount: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
          totalPaidAmount: sql<string>`COALESCE(SUM(CAST(${invoices.paidAmount} AS DECIMAL)), 0)`,
        })
        .from(invoices)
        .where(ranged ? and(gte(invoices.createdAt, from!), lte(invoices.createdAt, to!)) : undefined)
        .groupBy(invoices.status);

      const quotationStatsResult = await db
        .select({
          status: quotations.status,
          count: count(),
          totalValue: sql<string>`COALESCE(SUM(CAST(${quotations.amount} AS DECIMAL)), 0)`,
        })
        .from(quotations)
        .where(ranged ? and(gte(quotations.createdAt, from!), lte(quotations.createdAt, to!)) : undefined)
        .groupBy(quotations.status);

      const completedAt = sql`COALESCE(${tasks.completedDate}, ${tasks.updatedAt})`;
      const [completedRow] = await db.select({ n: count() }).from(tasks)
        .where(and(
          sql`${tasks.status} = 'completed'`,
          ranged ? sql`${completedAt} >= ${from!.toISOString()}::timestamp AND ${completedAt} <= ${to!.toISOString()}::timestamp` : undefined,
        ));

      const netProfit = round2(totalRevenue - totalExpenses);

      const invoiceBreakdown = invoiceStatusResult.reduce((acc, item) => {
        acc[item.status] = { count: item.count, amount: round2(num(item.totalAmount)), paidAmount: round2(num(item.totalPaidAmount)) };
        return acc;
      }, {} as Record<string, { count: number; amount: number; paidAmount: number }>);

      const quotationBreakdown = quotationStatsResult.reduce((acc, item) => {
        acc[item.status] = { count: item.count, value: round2(num(item.totalValue)) };
        return acc;
      }, {} as Record<string, { count: number; value: number }>);

      const totalQuotations = quotationStatsResult.reduce((sum, item) => sum + item.count, 0);
      const acceptedQuotations = quotationBreakdown.accepted?.count || 0;
      const conversionRate = totalQuotations > 0 ? (acceptedQuotations / totalQuotations) * 100 : 0;

      res.json({
        totalRevenue,
        totalExpenses,
        netProfit,
        newClients: newClientsRow?.n ?? 0,
        completedTasks: completedRow?.n ?? 0,
        invoiceBreakdown,
        quotationBreakdown,
        conversionRate,
        profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      });
    } catch (error) {
      console.error("Error fetching analytics KPIs:", error);
      res.status(500).json({ message: "Failed to fetch analytics KPIs" });
    }
  });

  // Financial Reports - income by month, expenses by category, or the profit-and-loss summary
  app.get("/api/analytics/financial-reports", requirePermission('analytics', 'view'), async (req, res) => {
    try {
      const { type = 'summary' } = req.query;
      const { from, to } = parseRange(req.query.startDate, req.query.endDate);

      if (type === 'income') {
        const months = trailingMonths(12);
        const series = buildSeries(months, await monthlyCollected(), {}, "month");
        res.json({ incomeData: series.map((p) => ({ month: p.period, revenue: p.collected })) });
      } else if (type === 'expenses') {
        res.json({ expensesByCategory: await spentByCategory(from, to) });
      } else {
        const totalRevenue = await collectedTotal(from, to);
        const totalExpenses = await spentTotal(from, to);
        const netProfit = round2(totalRevenue - totalExpenses);
        res.json({
          summary: { totalRevenue, totalExpenses, netProfit, profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0 },
        });
      }
    } catch (error) {
      console.error("Error fetching financial reports:", error);
      res.status(500).json({ message: "Failed to fetch financial reports" });
    }
  });

  // Trend analysis: collected vs spent by month or quarter. The window is the last `months` calendar months
  // (3-36, default 12); months without any money are zeros so the line never joins distant months.
  app.get("/api/analytics/trends", requirePermission('analytics', 'view'), async (req, res) => {
    try {
      const granularity = req.query.period === 'quarter' ? 'quarter' : 'month';
      const months = trailingMonths(Number(req.query.months) || 12);
      const points = buildSeries(months, await monthlyCollected(), await monthlySpent(), granularity);
      res.json({ granularity, points, summary: summarizeSeries(points), timezone: APP_TIMEZONE });
    } catch (error) {
      console.error("Error fetching trend analysis:", error);
      res.status(500).json({ message: "Failed to fetch trend analysis" });
    }
  });

  // Period Comparison
  app.get("/api/analytics/comparison", requirePermission('analytics', 'view'), async (req, res) => {
    try {
      const { period1Start, period1End, period2Start, period2End } = req.query;

      if (!period1Start || !period1End || !period2Start || !period2End) {
        return res.status(400).json({ message: "All period dates are required" });
      }

      const getMetricsForPeriod = async (startDate: string, endDate: string) => {
        const from = new Date(startDate);
        const to = new Date(endDate);
        const [newClients] = await db.select({ n: count() }).from(clients)
          .where(and(gte(clients.createdAt, from), lte(clients.createdAt, to)));
        const completedAt = sql`COALESCE(${tasks.completedDate}, ${tasks.updatedAt})`;
        const [completed] = await db.select({ n: count() }).from(tasks)
          .where(and(
            sql`${tasks.status} = 'completed'`,
            sql`${completedAt} >= ${from.toISOString()}::timestamp AND ${completedAt} <= ${to.toISOString()}::timestamp`,
          ));
        return {
          revenue: await collectedTotal(from, to),
          expenses: await spentTotal(from, to),
          newClients: newClients?.n ?? 0,
          completedTasks: completed?.n ?? 0,
        };
      };

      const period1Metrics = await getMetricsForPeriod(period1Start as string, period1End as string);
      const period2Metrics = await getMetricsForPeriod(period2Start as string, period2End as string);

      const calculateChange = (current: number, previous: number) => {
        const absolute = round2(current - previous);
        const percentage = previous === 0
          ? (current > 0 ? 100 : 0)
          : round2(((current - previous) / previous) * 100);
        return { absolute, percentage };
      };

      const p1r = period1Metrics.revenue;
      const p1e = period1Metrics.expenses;
      const p2r = period2Metrics.revenue;
      const p2e = period2Metrics.expenses;

      res.json({
        period1: period1Metrics,
        period2: period2Metrics,
        changes: {
          revenue: calculateChange(p1r, p2r),
          expenses: calculateChange(p1e, p2e),
          profit: calculateChange(round2(p1r - p1e), round2(p2r - p2e)),
          newClients: calculateChange(period1Metrics.newClients, period2Metrics.newClients),
          completedTasks: calculateChange(period1Metrics.completedTasks, period2Metrics.completedTasks),
        },
      });
    } catch (error) {
      console.error("Error fetching period comparison:", error);
      res.status(500).json({ message: "Failed to fetch period comparison" });
    }
  });

  // Money still owed on issued invoices: the remaining amount (not the invoice total), all current statuses,
  // aged the same way as the dashboard.
  app.get("/api/analytics/outstanding", requirePermission('analytics', 'view'), async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT i.id, i.invoice_number, i.client_id, c.name AS client_name, i.status, i.amount, i.paid_amount, i.due_date
        FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
        WHERE i.status NOT IN ('draft','cancelled')
      `);
      const rows = ((result as any).rows ?? result) as any[];
      const aging = bucketAging(rows.map((r) => ({
        clientId: r.client_id, clientName: r.client_name, status: r.status, amount: r.amount, paidAmount: r.paid_amount, dueDate: r.due_date,
      })), new Date(), APP_TIMEZONE, 5);

      const today = new Date();
      const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      const owing = rows
        .map((r) => ({ ...r, remaining: Math.max(0, num(r.amount) - num(r.paid_amount)) }))
        .filter((r) => r.remaining > 0);
      const overdue = owing
        .filter((r) => r.due_date && new Date(r.due_date).getTime() < startOfToday)
        .map((r) => ({
          id: r.id,
          invoiceNumber: r.invoice_number,
          clientName: r.client_name,
          amount: round2(r.remaining),
          dueDate: r.due_date,
          daysPastDue: Math.floor((startOfToday - new Date(r.due_date).getTime()) / 86_400_000),
        }))
        .sort((a, b) => b.daysPastDue - a.daysPastDue);

      res.json({
        outstandingTotal: aging.total,
        receivableCount: owing.length,
        overdueCount: aging.overdueCount,
        overdueAmount: aging.overdueAmount,
        overdueInvoices: overdue,
        aging: aging.buckets,
        topDebtors: aging.topDebtors,
      });
    } catch (error) {
      console.error("Error fetching outstanding data:", error);
      res.status(500).json({ message: "Failed to fetch outstanding data" });
    }
  });
}
