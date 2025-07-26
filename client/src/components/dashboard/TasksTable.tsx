import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export function TasksTable() {
  const { t } = useTranslation();
  
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 p-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingTasks = tasks.filter((task: any) => task.status === 'pending').slice(0, 3);

  return (
    <Card>
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text">Pending Tasks</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              Priority
            </Button>
            <Button size="sm">
              Assign
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {pendingTasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral">No pending tasks</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTasks.map((task: any) => (
              <div 
                key={task.id} 
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    task.priority === 'high' ? 'bg-accent' :
                    task.priority === 'medium' ? 'bg-yellow-500' :
                    'bg-secondary'
                  }`}></div>
                  <div>
                    <p className="text-sm font-medium text-text">{task.title}</p>
                    <p className="text-xs text-neutral">
                      Due: {task.dueDate ? formatDistanceToNow(new Date(task.dueDate), { addSuffix: true }) : 'No due date'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant="outline"
                    className={
                      task.priority === 'high' 
                        ? 'bg-red-100 text-accent border-red-200' :
                      task.priority === 'medium'
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                        'bg-blue-100 text-blue-700 border-blue-200'
                    }
                  >
                    {task.priority}
                  </Badge>
                  <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
