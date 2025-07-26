import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { DollarSign, Users, AlertTriangle, TrendingUp, ArrowUp, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function KPICards() {
  const { t } = useTranslation();
  
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["/api/dashboard/kpis"],
  });

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

  const kpiData = [
    {
      title: t('dashboard.totalRevenue'),
      value: `$${kpis?.totalRevenue?.toLocaleString() || '0'}`,
      change: "+12.5% from last month",
      icon: DollarSign,
      iconBg: "bg-green-100",
      iconColor: "text-secondary",
      changeColor: "text-secondary",
    },
    {
      title: t('dashboard.activeClients'),
      value: kpis?.activeClients?.toString() || '0',
      change: "+8 new this week",
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-primary",
      changeColor: "text-secondary",
    },
    {
      title: t('dashboard.pendingInvoices'),
      value: `$${kpis?.pendingInvoices?.toLocaleString() || '0'}`,
      change: "3 overdue",
      icon: AlertTriangle,
      iconBg: "bg-red-100",
      iconColor: "text-accent",
      changeColor: "text-accent",
      changeIcon: Clock,
    },
    {
      title: t('dashboard.teamPerformance'),
      value: `${kpis?.teamPerformance || 0}%`,
      change: "Above target",
      icon: TrendingUp,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      changeColor: "text-secondary",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiData.map((kpi, index) => {
        const Icon = kpi.icon;
        const ChangeIcon = kpi.changeIcon || ArrowUp;
        
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
