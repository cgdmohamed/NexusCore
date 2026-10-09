import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { DollarSign, Users, TrendingUp, CheckSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";

export function KPICards() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  
  const { data: kpis, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/kpis"],
    enabled: isAuthenticated,
  });

  const { data: taskStats } = useQuery<any>({
    queryKey: ["/api/tasks/stats"],
    enabled: isAuthenticated,
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated,
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    enabled: isAuthenticated,
  });

  const kpiData = kpis as any;
  const taskData = taskStats as any;

  // Calculate real-time data from actual API responses
  const realTimeStats = {
    totalRevenue: invoices.reduce((sum: number, inv: any) => {
      if (inv.status === 'cancelled') return sum;
      return sum + parseFloat(inv.paidAmount || 0);
    }, 0),
    activeClients: clients.filter((client: any) => client.status === 'active').length,
    pendingRevenue: invoices.reduce((sum: number, inv: any) => {
      if (inv.status === 'cancelled') return sum;
      const remaining = parseFloat(inv.amount || 0) - parseFloat(inv.paidAmount || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0),
    overdueInvoices: invoices.filter((inv: any) => 
      inv.status !== 'cancelled' &&
      (inv.status === 'overdue' || (new Date(inv.dueDate) < new Date() && inv.status !== 'paid'))
    ).length
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const pendingTasks = taskData?.statusBreakdown?.pending || 0;
  const overdueTasks = taskData?.overdueTasks || 0;

  // Secondary lines stay neutral; colour is reserved for something that needs attention.
  const kpiCards = [
    {
      title: t("dash.kpi.revenue"),
      value: formatCurrency(realTimeStats.totalRevenue),
      note: t("dash.kpi.revenue_note", { n: formatCurrency(realTimeStats.pendingRevenue) }),
      icon: DollarSign,
      alert: false,
    },
    {
      title: t("dash.kpi.clients"),
      value: realTimeStats.activeClients.toString(),
      note: t("dash.kpi.clients_note", { n: String(clients.length) }),
      icon: Users,
      alert: false,
    },
    {
      title: t("dash.kpi.tasks"),
      value: taskData?.totalTasks?.toString() || '0',
      note: t("dash.kpi.tasks_note", { n: String(pendingTasks) }),
      icon: CheckSquare,
      alert: false,
    },
    {
      title: t("dash.kpi.performance"),
      value: taskData?.totalTasks > 0 ? `${Math.round(((taskData?.statusBreakdown?.completed || 0) / taskData.totalTasks) * 100)}%` : '0%',
      note: t("dash.kpi.performance_note", { n: String(overdueTasks) }),
      icon: TrendingUp,
      alert: overdueTasks > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <Card key={index} className={index === 0 ? "col-span-2 lg:col-span-1" : undefined}>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{kpi.value}</p>
              <p className={`mt-1 text-xs tabular-nums ${kpi.alert ? "text-danger" : "text-muted-foreground"}`}>{kpi.note}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
