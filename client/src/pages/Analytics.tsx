import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import { KpiCard } from "@/components/analytics/KpiCard";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { ExpenseBreakdown } from "@/components/analytics/ExpenseBreakdown";
import { ComparisonCard } from "@/components/analytics/ComparisonCard";
import { FilterBar } from "@/components/analytics/FilterBar";
import { 
  DollarSign, 
  Users, 
  FileText, 
  TrendingUp, 
  CreditCard,
  Target,
  AlertCircle,
  BarChart3 
} from "lucide-react";
import { format, subDays, subMonths } from "date-fns";
import { formatCurrency } from "@/lib/currency";

export default function Analytics() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({
    start: subMonths(new Date(), 1),
    end: new Date()
  });
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Fetch Company KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/analytics/kpis', dateRange.start, dateRange.end],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start.toISOString());
      if (dateRange.end) params.append('endDate', dateRange.end.toISOString());
      
      const response = await fetch(`/api/analytics/kpis?${params}`);
      return response.json();
    }
  });

  // Fetch Revenue Trends
  const { data: revenueTrends } = useQuery({
    queryKey: ['/api/analytics/trends', 'revenue', selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/trends?metric=revenue&period=${selectedPeriod}`);
      return response.json();
    }
  });

  // Fetch Expense Trends
  const { data: expenseTrends } = useQuery({
    queryKey: ['/api/analytics/trends', 'expenses', selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/trends?metric=expenses&period=${selectedPeriod}`);
      return response.json();
    }
  });

  // Fetch Financial Reports
  const { data: expenseReports } = useQuery({
    queryKey: ['/api/analytics/financial-reports', 'expenses', dateRange.start, dateRange.end],
    queryFn: async () => {
      const params = new URLSearchParams({ type: 'expenses' });
      if (dateRange.start) params.append('startDate', dateRange.start.toISOString());
      if (dateRange.end) params.append('endDate', dateRange.end.toISOString());
      
      const response = await fetch(`/api/analytics/financial-reports?${params}`);
      return response.json();
    }
  });

  // Fetch Period Comparison
  const { data: comparison } = useQuery({
    queryKey: ['/api/analytics/comparison', dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!dateRange.start || !dateRange.end) return null;
      
      const period1Start = dateRange.start.toISOString();
      const period1End = dateRange.end.toISOString();
      
      // Calculate previous period of same length
      const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
      const period2End = new Date(dateRange.start.getTime());
      const period2Start = new Date(dateRange.start.getTime() - periodLength);
      
      const params = new URLSearchParams({
        period1Start,
        period1End,
        period2Start: period2Start.toISOString(),
        period2End: period2End.toISOString()
      });
      
      const response = await fetch(`/api/analytics/comparison?${params}`);
      return response.json();
    },
    enabled: !!(dateRange.start && dateRange.end)
  });

  // Fetch Outstanding Data
  const { data: outstanding } = useQuery({
    queryKey: ['/api/analytics/outstanding'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/outstanding');
      return response.json();
    }
  });

  const formatCurrencyValue = (value: number) => {
    return formatCurrency(value);
  };

  const handleDateRangeChange = (start: Date | null, end: Date | null) => {
    setDateRange({ start, end });
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const now = new Date();
    let start = new Date();
    
    switch (period) {
      case 'week':
        start = subDays(now, 7);
        break;
      case 'month':
        start = subMonths(now, 1);
        break;
      case 'quarter':
        start = subMonths(now, 3);
        break;
      case 'year':
        start = subMonths(now, 12);
        break;
    }
    
    setDateRange({ start, end: now });
  };

  const handleExport = () => {
    // Generate CSV export
    const exportData = {
      kpis,
      dateRange,
      comparison,
      generated: new Date().toISOString()
    };
    
    const csvContent = `Company Analytics Report
Generated: ${format(new Date(), 'PPP')}
Period: ${dateRange.start ? format(dateRange.start, 'PPP') : 'N/A'} to ${dateRange.end ? format(dateRange.end, 'PPP') : 'N/A'}

KPIs:
Total Revenue: ${formatCurrencyValue(kpis?.totalRevenue || 0)}
Total Expenses: ${formatCurrencyValue(kpis?.totalExpenses || 0)}
Net Profit: ${formatCurrencyValue(kpis?.netProfit || 0)}
New Clients: ${kpis?.newClients || 0}
Completed Tasks: ${kpis?.completedTasks || 0}
Conversion Rate: ${kpis?.conversionRate?.toFixed(2) || 0}%
Profit Margin: ${kpis?.profitMargin?.toFixed(2) || 0}%
`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (kpisLoading) {
    return (
      <div className="space-y-6">
        <Header 
          title={t('nav.reports_kpis')}
          subtitle="Comprehensive business performance and reporting analytics"
        />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-neutral">Loading analytics...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.reports_kpis')}
        subtitle="Comprehensive business performance and reporting analytics"
      />
      
      <div className="p-6 space-y-6">
        {/* Filter Bar */}
        <FilterBar
          onDateRangeChange={handleDateRangeChange}
          onPeriodChange={handlePeriodChange}
          onExport={handleExport}
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
            <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Company KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KpiCard
                title="Total Revenue"
                value={formatCurrencyValue(kpis?.totalRevenue || 0)}
                icon={DollarSign}
                className="border-l-4 border-l-green-500"
              />
              <KpiCard
                title="Total Expenses"
                value={formatCurrencyValue(kpis?.totalExpenses || 0)}
                icon={CreditCard}
                className="border-l-4 border-l-red-500"
              />
              <KpiCard
                title="Net Profit"
                value={formatCurrencyValue(kpis?.netProfit || 0)}
                icon={TrendingUp}
                className={`border-l-4 ${(kpis?.netProfit || 0) >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}
              />
              <KpiCard
                title="Profit Margin"
                value={`${(kpis?.profitMargin || 0).toFixed(1)}%`}
                icon={Target}
                className="border-l-4 border-l-blue-500"
              />
              <KpiCard
                title="New Clients"
                value={kpis?.newClients || 0}
                icon={Users}
                className="border-l-4 border-l-purple-500"
              />
              <KpiCard
                title="Completed Tasks"
                value={kpis?.completedTasks || 0}
                icon={FileText}
                className="border-l-4 border-l-indigo-500"
              />
              <KpiCard
                title="Conversion Rate"
                value={`${(kpis?.conversionRate || 0).toFixed(1)}%`}
                icon={BarChart3}
                className="border-l-4 border-l-orange-500"
              />
              <KpiCard
                title="Outstanding"
                value={formatCurrencyValue(outstanding?.outstandingTotal || 0)}
                icon={AlertCircle}
                className="border-l-4 border-l-yellow-500"
                description={`${outstanding?.overdueCount || 0} overdue invoices`}
              />
            </div>

            {/* Invoice Status Breakdown */}
            {kpis?.invoiceBreakdown && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600">Paid Invoices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-text">
                      {kpis.invoiceBreakdown.paid?.count || 0}
                    </div>
                    <p className="text-sm text-neutral">
                      {formatCurrencyValue(kpis.invoiceBreakdown.paid?.amount || 0)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-yellow-600">Pending Invoices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-text">
                      {kpis.invoiceBreakdown.pending?.count || 0}
                    </div>
                    <p className="text-sm text-neutral">
                      {formatCurrencyValue(kpis.invoiceBreakdown.pending?.amount || 0)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-blue-600">Partial Invoices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-text">
                      {kpis.invoiceBreakdown.partial?.count || 0}
                    </div>
                    <p className="text-sm text-neutral">
                      {formatCurrencyValue(kpis.invoiceBreakdown.partial?.amount || 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* P&L Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Profit & Loss Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral">Total Revenue</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrencyValue(kpis?.totalRevenue || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral">Total Expenses</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrencyValue(kpis?.totalExpenses || 0)}
                    </span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-text">Net Profit</span>
                    <span className={`font-bold text-lg ${(kpis?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrencyValue(kpis?.netProfit || 0)}
                    </span>
                  </div>
                  <div className="text-sm text-neutral">
                    Profit Margin: {(kpis?.profitMargin || 0).toFixed(2)}%
                  </div>
                </CardContent>
              </Card>

              {/* Expense Breakdown */}
              {expenseReports?.expensesByCategory && (
                <ExpenseBreakdown data={expenseReports.expensesByCategory} />
              )}
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {revenueTrends?.trends && (
                <RevenueChart 
                  data={revenueTrends.trends} 
                  title="Revenue Trends"
                  color="#10B981"
                />
              )}
              
              {expenseTrends?.trends && (
                <RevenueChart 
                  data={expenseTrends.trends} 
                  title="Expense Trends"
                  color="#EF4444"
                />
              )}
            </div>
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            {comparison && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ComparisonCard
                  title="Revenue"
                  currentValue={comparison.period1.revenue}
                  previousValue={comparison.period2.revenue}
                  change={comparison.changes.revenue}
                  formatter={formatCurrencyValue}
                />
                <ComparisonCard
                  title="Expenses"
                  currentValue={comparison.period1.expenses}
                  previousValue={comparison.period2.expenses}
                  change={comparison.changes.expenses}
                  formatter={formatCurrencyValue}
                />
                <ComparisonCard
                  title="Net Profit"
                  currentValue={comparison.period1.revenue - comparison.period1.expenses}
                  previousValue={comparison.period2.revenue - comparison.period2.expenses}
                  change={comparison.changes.profit}
                  formatter={formatCurrencyValue}
                />
                <ComparisonCard
                  title="New Clients"
                  currentValue={comparison.period1.newClients}
                  previousValue={comparison.period2.newClients}
                  change={comparison.changes.newClients}
                />
                <ComparisonCard
                  title="Completed Tasks"
                  currentValue={comparison.period1.completedTasks}
                  previousValue={comparison.period2.completedTasks}
                  change={comparison.changes.completedTasks}
                />
              </div>
            )}
          </TabsContent>

          {/* Outstanding Tab */}
          <TabsContent value="outstanding" className="space-y-6">
            {outstanding && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-yellow-600">Outstanding Receivables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-text mb-4">
                      {formatCurrencyValue(outstanding.outstandingTotal)}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-neutral">Total Outstanding Invoices</span>
                        <span className="font-medium">{outstanding.receivables?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral">Overdue Invoices</span>
                        <span className="font-medium text-red-600">{outstanding.overdueCount}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Overdue Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {outstanding.overdueInvoices?.length > 0 ? (
                      <div className="space-y-3">
                        {outstanding.overdueInvoices.slice(0, 5).map((invoice: any) => (
                          <div key={invoice.id} className="flex justify-between items-center">
                            <div>
                              <div className="font-medium text-text">{formatCurrencyValue(invoice.amount)}</div>
                              <div className="text-xs text-neutral">
                                {invoice.daysPastDue} days overdue
                              </div>
                            </div>
                            <div className="text-xs text-neutral">
                              Due: {format(new Date(invoice.dueDate), 'MMM dd')}
                            </div>
                          </div>
                        ))}
                        {outstanding.overdueInvoices.length > 5 && (
                          <div className="text-sm text-neutral text-center">
                            And {outstanding.overdueInvoices.length - 5} more...
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-neutral text-center">No overdue invoices</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
