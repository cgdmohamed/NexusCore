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
      color: "text-blue-600",
      bg: "bg-blue-100"
    },
    {
      title: "Active Tasks",
      value: taskData?.totalTasks?.toString() || '0',
      icon: CheckSquare,
      color: "text-yellow-600",
      bg: "bg-yellow-100"
    },
    {
      title: "Completion Rate",
      value: taskData?.totalTasks > 0 ? `${Math.round(((taskData?.statusBreakdown?.completed || 0) / taskData.totalTasks) * 100)}%` : '0%',
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-100"
    }
  ];

  if (employeesLoading) {
    return (
      <Card>
        <CardHeader>
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

  return (
    <Card>
      <CardHeader className="border-b border-gray-200">
        <h3 className="text-lg font-semibold text-text">Team Performance</h3>
        <p className="text-sm text-neutral">Real-time team metrics</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {teamMetrics.map((metric, index) => {
          const Icon = metric.icon;
          
          return (
            <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${metric.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${metric.color} w-4 h-4`} />
                </div>
                <div>
                  <p className="text-text text-sm font-medium">{metric.title}</p>
                  <p className="text-neutral text-xs">Current status</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${metric.color}`}>
                  {metric.value}
                </p>
              </div>
            </div>
          );
        })}
        
        {/* Recent Task Activity */}
        {tasksData.length > 0 && (
          <div className="pt-3 mt-4 border-t border-gray-200">
            <p className="text-xs text-neutral mb-2">Recent Task Updates</p>
            {tasksData.slice(0, 2).map((task: any) => (
              <div key={task.id} className="flex items-center justify-between text-xs py-1">
                <span className="text-neutral truncate flex-1">{task.title}</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  task.status === 'completed' ? 'bg-green-100 text-green-600' :
                  task.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
