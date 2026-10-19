import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import { KpiCard } from "@/components/analytics/KpiCard";
import { TrendsChart, type TrendPoint } from "@/components/analytics/TrendsChart";
import { periodLabel } from "@/components/analytics/TrendsChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { formatCurrency } from "@/lib/currency";

export default function Analytics() {
  const { t, language } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";
  const phone = useIsMobile();
  // Phone-sized screens get the same text scale as the /m app (13/15/17/20/22/28px)
  useEffect(() => {
    if (!phone) return;
    document.documentElement.classList.add("phone-scale");
    return () => document.documentElement.classList.remove("phone-scale");
  }, [phone]);
  const [trendMonths, setTrendMonths] = useState("12");
  const [granularity, setGranularity] = useState<"month" | "quarter">("month");
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({
    start: startOfDay(subMonths(new Date(), 1)),
    end: endOfDay(new Date())
  });
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const startKey = dateRange.start?.toISOString() ?? null;
  const endKey = dateRange.end?.toISOString() ?? null;

  // Fetch Company KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/analytics/kpis', startKey, endKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start.toISOString());
      if (dateRange.end) params.append('endDate', dateRange.end.toISOString());
      
      const response = await fetch(`/api/analytics/kpis?${params}`);
      return response.json();
    },
    // Changing the dates must not replace the whole page with the loader (it unmounted the filter and lost its state)
    placeholderData: keepPreviousData,
  });

  // Collected vs spent by month or quarter, on its own window
  const { data: trends } = useQuery<{ granularity: string; points: TrendPoint[]; summary: { collected: number; spent: number; net: number; averageCollected: number; bestPeriod: { period: string; collected: number } | null } }>({
    queryKey: ['/api/analytics/trends', trendMonths, granularity],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/trends?months=${trendMonths}&period=${granularity}`);
      return response.json();
    }
  });

  // Fetch Financial Reports
  const { data: expenseReports } = useQuery({
    queryKey: ['/api/analytics/financial-reports', 'expenses', startKey, endKey],
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
    queryKey: ['/api/analytics/comparison', startKey, endKey],
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
    setDateRange({
      start: start ? startOfDay(start) : null,
      end: end ? endOfDay(end) : null,
    });
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
    
    setDateRange({ start: startOfDay(start), end: endOfDay(now) });
  };

  const handleExport = () => {
    const csvContent = `${t('analytics.csv_report_title')}
${t('analytics.csv_generated')}: ${format(new Date(), 'PPP')}
${t('analytics.csv_period')}: ${dateRange.start ? format(dateRange.start, 'PPP') : 'N/A'} to ${dateRange.end ? format(dateRange.end, 'PPP') : 'N/A'}

${t('analytics.csv_kpis')}:
${t('analytics.csv_total_revenue')}: ${formatCurrencyValue(kpis?.totalRevenue || 0)}
${t('analytics.csv_total_expenses')}: ${formatCurrencyValue(kpis?.totalExpenses || 0)}
${t('analytics.csv_net_profit')}: ${formatCurrencyValue(kpis?.netProfit || 0)}
${t('analytics.csv_new_clients')}: ${kpis?.newClients || 0}
${t('analytics.csv_completed_tasks')}: ${kpis?.completedTasks || 0}
${t('analytics.csv_conversion_rate')}: ${kpis?.conversionRate?.toFixed(2) || 0}%
${t('analytics.csv_profit_margin')}: ${kpis?.profitMargin?.toFixed(2) || 0}%
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
      <div>
        <Header 
          title={t('nav.reports_kpis')}
          subtitle={t('analytics.subtitle')}
          hideExport
        />
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-neutral">{t('analytics.loading')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header 
        title={t('nav.reports_kpis')}
        subtitle={t('analytics.subtitle')}
        hideExport
      />
      
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Filter Bar */}
        <FilterBar
          onDateRangeChange={handleDateRangeChange}
          onPeriodChange={handlePeriodChange}
          onExport={handleExport}
        />

        <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
          <div className="-mx-4 snap-x snap-proximity overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)] md:mx-0 md:px-0 md:[mask-image:none]">
            <TabsList className="flex h-[52px] w-max md:grid md:h-10 md:w-full md:grid-cols-5">
              <TabsTrigger value="overview" className="h-11 snap-start whitespace-nowrap px-4 md:h-auto md:px-2">{t("an.tab_overview")}</TabsTrigger>
              <TabsTrigger value="financial" className="h-11 snap-start whitespace-nowrap px-4 md:h-auto md:px-2">{t("an.tab_financial")}</TabsTrigger>
              <TabsTrigger value="trends" className="h-11 snap-start whitespace-nowrap px-4 md:h-auto md:px-2">{t("an.tab_trends")}</TabsTrigger>
              <TabsTrigger value="comparison" className="h-11 snap-start whitespace-nowrap px-4 md:h-auto md:px-2">{t("an.tab_comparison")}</TabsTrigger>
              <TabsTrigger value="outstanding" className="h-11 snap-start whitespace-nowrap px-4 md:h-auto md:px-2">{t("an.tab_outstanding")}</TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* The four numbers that matter first, then the supporting ones */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard primary title={t("an.kpi_net")} value={formatCurrencyValue(kpis?.netProfit || 0)} icon={TrendingUp} />
              <KpiCard title={t("an.kpi_revenue")} value={formatCurrencyValue(kpis?.totalRevenue || 0)} icon={DollarSign} />
              <KpiCard title={t("an.kpi_expenses")} value={formatCurrencyValue(kpis?.totalExpenses || 0)} icon={CreditCard} />
              <KpiCard
                title={t("an.kpi_outstanding")}
                value={formatCurrencyValue(outstanding?.outstandingTotal || 0)}
                icon={AlertCircle}
                description={t("an.overdue_n", { n: String(outstanding?.overdueCount || 0) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
              <KpiCard title={t("an.kpi_margin")} value={`${(kpis?.profitMargin || 0).toFixed(1)}%`} icon={Target} />
              <KpiCard title={t("an.kpi_clients")} value={kpis?.newClients || 0} icon={Users} />
              <KpiCard title={t("an.kpi_tasks")} value={kpis?.completedTasks || 0} icon={FileText} />
              <KpiCard title={t("an.kpi_conversion")} value={`${(kpis?.conversionRate || 0).toFixed(1)}%`} icon={BarChart3} />
            </div>

            {/* Invoice status breakdown (invoices created in the selected dates) */}
            {kpis?.invoiceBreakdown && (() => {
              const bd = kpis.invoiceBreakdown;
              const waiting = { count: (bd.pending?.count || 0) + (bd.sent?.count || 0), amount: (bd.pending?.amount || 0) + (bd.sent?.amount || 0) };
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">{t("an.inv_paid")}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-text">{bd.paid?.count || 0}</div>
                      <p className="text-sm text-neutral">{formatCurrencyValue(bd.paid?.amount || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">{t("an.inv_pending")}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-text">{waiting.count}</div>
                      <p className="text-sm text-neutral">{formatCurrencyValue(waiting.amount)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">{t("an.inv_partial")}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-text">{bd.partially_paid?.count || 0}</div>
                      <p className="text-sm text-neutral">
                        {t("an.paid_of", { paid: formatCurrencyValue(bd.partially_paid?.paidAmount || 0), total: formatCurrencyValue(bd.partially_paid?.amount || 0) })}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* P&L Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("an.pl_title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral">{t("an.kpi_revenue")}</span>
                    <span className="font-semibold text-success">
                      {formatCurrencyValue(kpis?.totalRevenue || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral">{t("an.kpi_expenses")}</span>
                    <span className="font-semibold text-danger">
                      {formatCurrencyValue(kpis?.totalExpenses || 0)}
                    </span>
                  </div>
                  <hr className="border-border" />
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-text">{t("an.kpi_net")}</span>
                    <span className={`font-bold text-lg ${(kpis?.netProfit || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCurrencyValue(kpis?.netProfit || 0)}
                    </span>
                  </div>
                  <div className="text-sm text-neutral">
                    {t("an.kpi_margin")}: {(kpis?.profitMargin || 0).toFixed(2)}%
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
          <TabsContent value="trends" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={trendMonths} onValueChange={setTrendMonths}>
                <SelectTrigger className="h-11 w-44 md:h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">{t("an.range_6")}</SelectItem>
                  <SelectItem value="12">{t("an.range_12")}</SelectItem>
                  <SelectItem value="24">{t("an.range_24")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-1 rounded-lg bg-muted p-1" role="group">
                {(["month", "quarter"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={granularity === g}
                    onClick={() => setGranularity(g)}
                    className={`h-11 rounded-md px-3 text-sm font-medium transition-colors md:h-8 ${granularity === g ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                    {t(g === "month" ? "an.by_month" : "an.by_quarter")}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t("an.trend_note")}</p>
            </div>

            {trends?.summary && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                <KpiCard title={t("an.sum_collected")} value={formatCurrencyValue(trends.summary.collected)} icon={DollarSign} />
                <KpiCard title={t("an.sum_spent")} value={formatCurrencyValue(trends.summary.spent)} icon={CreditCard} />
                <KpiCard title={t("an.sum_net")} value={formatCurrencyValue(trends.summary.net)} icon={TrendingUp} />
                <KpiCard title={t(granularity === "month" ? "an.avg_month" : "an.avg_quarter")} value={formatCurrencyValue(trends.summary.averageCollected)} icon={BarChart3} />
                <KpiCard
                  title={t("an.best_period")}
                  value={trends.summary.bestPeriod ? periodLabel(trends.summary.bestPeriod.period, lang) : "—"}
                  icon={Target}
                  description={trends.summary.bestPeriod ? formatCurrencyValue(trends.summary.bestPeriod.collected) : undefined}
                />
              </div>
            )}

            {trends?.points && <TrendsChart points={trends.points} />}
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            {comparison && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ComparisonCard
                  title={t("an.sum_collected")}
                  currentValue={comparison.period1.revenue}
                  previousValue={comparison.period2.revenue}
                  change={comparison.changes.revenue}
                  formatter={formatCurrencyValue}
                />
                <ComparisonCard
                  title={t("an.kpi_expenses")}
                  currentValue={comparison.period1.expenses}
                  previousValue={comparison.period2.expenses}
                  change={comparison.changes.expenses}
                  formatter={formatCurrencyValue}
                />
                <ComparisonCard
                  title={t("an.kpi_net")}
                  currentValue={Math.round((comparison.period1.revenue - comparison.period1.expenses) * 100) / 100}
                  previousValue={Math.round((comparison.period2.revenue - comparison.period2.expenses) * 100) / 100}
                  change={comparison.changes.profit}
                  formatter={formatCurrencyValue}
                />
                <ComparisonCard
                  title={t("an.kpi_clients")}
                  currentValue={comparison.period1.newClients}
                  previousValue={comparison.period2.newClients}
                  change={comparison.changes.newClients}
                />
                <ComparisonCard
                  title={t("an.kpi_tasks")}
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
                    <CardTitle className="text-base">{t("an.out_title")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-text mb-4">
                      {formatCurrencyValue(outstanding.outstandingTotal)}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-neutral">{t("an.out_count")}</span>
                        <span className="font-medium">{outstanding.receivableCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral">{t("an.out_overdue")}</span>
                        <span className="font-medium text-danger">{outstanding.overdueCount}</span>
                      </div>
                    </div>
                    {outstanding.aging && (
                      <div className="mt-5 border-t border-border pt-4">
                        <p className="mb-2 text-sm font-medium text-foreground">{t("an.aging")}</p>
                        <ul className="space-y-1.5 text-sm">
                          {(["notDue", "d1_30", "d31_60", "d61_90", "d90plus"] as const).map((k) => (
                            <li key={k} className="flex justify-between">
                              <span className="text-neutral">{t(`an.age_${k}`)} <span className="tabular-nums">({outstanding.aging[k]?.count || 0})</span></span>
                              <span className="font-medium tabular-nums">{formatCurrencyValue(outstanding.aging[k]?.amount || 0)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("an.out_details")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {outstanding.overdueInvoices?.length > 0 ? (
                      <div className="space-y-3">
                        {outstanding.overdueInvoices.slice(0, 5).map((invoice: any) => (
                          <div key={invoice.id} className="flex justify-between items-center gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-text">{formatCurrencyValue(invoice.amount)}</div>
                              <div className="truncate text-xs text-neutral">
                                {invoice.clientName ? `${invoice.clientName} · ` : ""}{t("an.days_overdue", { n: String(invoice.daysPastDue) })}
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-neutral">
                              {t("an.due")}: {format(new Date(invoice.dueDate), 'dd/MM/yyyy')}
                            </div>
                          </div>
                        ))}
                        {outstanding.overdueInvoices.length > 5 && (
                          <div className="text-sm text-neutral text-center">
                            {t("an.more", { n: String(outstanding.overdueInvoices.length - 5) })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-neutral text-center">{t("an.none_overdue")}</p>
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
