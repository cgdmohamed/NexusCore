import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { DollarSign, Users, AlertTriangle, TrendingUp, ArrowUp, Clock, CheckSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function KPICards() {
  const { t } = useTranslation();
  
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["/api/dashboard/kpis"],
  });

  const { data: taskStats } = useQuery({
    queryKey: ["/api/tasks/stats"],
  });

  const kpiData = kpis as any;
  const taskData = taskStats as any;

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
      title: t('dashboard.totalRevenue'),
      value: `$${kpiData?.totalRevenue?.toLocaleString() || '0'}`,
      change: "Monthly revenue tracked",
      icon: DollarSign,
      iconBg: "bg-green-100",
      iconColor: "text-secondary",
      changeColor: "text-secondary",
    },
    {
      title: t('dashboard.activeClients'),
      value: kpiData?.activeClients?.toString() || '0',
      change: "Clients managed",
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-primary",
      changeColor: "text-secondary",
    },
    {
      title: "Active Tasks",
      value: taskData?.totalTasks?.toString() || '0',
      change: `${taskData?.statusBreakdown?.pending || 0} pending`,
      icon: CheckSquare,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      changeColor: (taskData?.statusBreakdown?.pending || 0) > 0 ? "text-yellow-600" : "text-secondary",
    },
    {
      title: t('dashboard.teamPerformance'),
      value: `${Math.round(((taskData?.statusBreakdown?.completed || 0) / (taskData?.totalTasks || 1)) * 100)}%`,
      change: "Task completion rate",
      icon: TrendingUp,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      changeColor: "text-secondary",
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
