import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, CheckSquare } from "lucide-react";

export function TeamPerformance() {
  const { t } = useTranslation();

  // Fetch real data
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
  });

  const { data: taskStats } = useQuery({
    queryKey: ["/api/tasks/stats"],
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["/api/tasks"],
  });

  const employeeData = employees as any[];
  const taskData = taskStats as any;
  const tasksData = tasks as any[];

  // Calculate performance metrics based on real data
  const teamMetrics = [
    {
      title: "Team Size",
      value: employeeData.length.toString(),
      icon: Users,
    },
    {
      title: "Active Tasks",
      value: taskData?.totalTasks?.toString() || '0',
      icon: CheckSquare,
    },
    {
      title: "Completion Rate",
      value: taskData?.totalTasks > 0 ? `${Math.round(((taskData?.statusBreakdown?.completed || 0) / taskData.totalTasks) * 100)}%` : '0%',
      icon: TrendingUp,
    }
  ];

  if (employeesLoading) {
    return (
      <Card>
        <CardHeader className="px-5 py-4">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16 mt-1" />
                </div>
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const statusTone = (status: string) =>
    status === 'completed' ? 'bg-success-soft text-success' : status === 'pending' ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info';

  return (
    <Card>
      <CardHeader className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">Team Performance</h3>
      </CardHeader>
      <CardContent className="p-2">
        {teamMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className="flex h-10 items-center gap-3 px-3 text-sm">
              <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              <span className="flex-1 text-foreground">{metric.title}</span>
              <span className="font-medium text-foreground tabular-nums">{metric.value}</span>
            </div>
          );
        })}

        {tasksData.length > 0 && (
          <div className="mx-3 mt-2 border-t border-border py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Recent Task Updates</p>
            {tasksData.slice(0, 2).map((task: any) => (
              <div key={task.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                <span className="flex-1 truncate text-foreground">{task.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(task.status)}`}>{task.status}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
