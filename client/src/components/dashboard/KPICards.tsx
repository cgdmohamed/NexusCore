import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { DollarSign, Users, AlertTriangle, TrendingUp, ArrowUp, Clock, CheckSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";

export function KPICards() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["/api/dashboard/kpis"],
    enabled: isAuthenticated,
  });

  const { data: taskStats } = useQuery({
    queryKey: ["/api/tasks/stats"],
    enabled: isAuthenticated,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["/api/invoices"],
    enabled: isAuthenticated,
  });

  const kpiData = kpis as any;
  const taskData = taskStats as any;

  // Calculate real-time data from actual API responses
  const realTimeStats = {
    totalRevenue: invoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.paidAmount || 0), 0),
    activeClients: clients.filter((client: any) => client.status === 'active').length,
    pendingRevenue: invoices.reduce((sum: number, inv: any) => {
      const remaining = parseFloat(inv.amount || 0) - parseFloat(inv.paidAmount || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0),
    overdueInvoices: invoices.filter((inv: any) => 
      inv.status === 'overdue' || (new Date(inv.dueDate) < new Date() && inv.status !== 'paid')
    ).length
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="w-12 h-12 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(realTimeStats.totalRevenue),
      change: `${formatCurrency(realTimeStats.pendingRevenue)} pending`,
      icon: DollarSign,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      changeColor: realTimeStats.pendingRevenue > 0 ? "text-orange-600" : "text-green-600",
    },
    {
      title: "Active Clients",
      value: realTimeStats.activeClients.toString(),
      change: `${clients.length} total clients`,
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      changeColor: "text-blue-600",
    },
    {
      title: "Active Tasks",
      value: taskData?.totalTasks?.toString() || '0',
      change: `${taskData?.statusBreakdown?.pending || 0} pending`,
      icon: CheckSquare,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      changeColor: (taskData?.statusBreakdown?.pending || 0) > 0 ? "text-yellow-600" : "text-green-600",
    },
    {
      title: "Task Performance",
      value: taskData?.totalTasks > 0 ? `${Math.round(((taskData?.statusBreakdown?.completed || 0) / taskData.totalTasks) * 100)}%` : '0%',
      change: `${taskData?.overdueTasks || 0} overdue tasks`,
      icon: TrendingUp,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      changeColor: (taskData?.overdueTasks || 0) > 0 ? "text-red-600" : "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon;
        const ChangeIcon = ArrowUp;
        
        return (
          <Card key={index} className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral text-sm font-medium">{kpi.title}</p>
                  <p className="text-2xl font-semibold text-text mt-1">{kpi.value}</p>
                  <p className={`text-sm mt-1 flex items-center gap-1 ${kpi.changeColor}`}>
                    <ChangeIcon className="w-3 h-3" />
                    {kpi.change}
                  </p>
                </div>
                <div className={`w-12 h-12 ${kpi.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${kpi.iconColor} text-lg w-6 h-6`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
