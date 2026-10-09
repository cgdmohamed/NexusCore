import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task } from "@shared/schema";

export function TasksTable() {
  const { t } = useTranslation();
  
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks"],
  });

  const taskList = tasks as Task[];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="border-b border-border px-5 py-4">
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

  const pendingTasks = taskList.filter((task) => task.status === 'pending').slice(0, 3);

  const priorityTone = (priority: string | null) =>
    priority === 'high' ? 'bg-danger-soft text-danger' : priority === 'medium' ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground';

  return (
    <Card>
      <CardHeader className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Pending Tasks</h3>
          <Link href="/tasks" className="text-sm text-primary hover:underline">View All</Link>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {pendingTasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No pending tasks</p>
        ) : (
          <ul>
            {pendingTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 hover:bg-accent/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due: {task.dueDate ? formatDistanceToNow(new Date(task.dueDate), { addSuffix: true }) : 'No due date'}
                  </p>
                </div>
                <Badge variant="secondary" className={`shrink-0 hover:bg-transparent ${priorityTone(task.priority)}`}>
                  {task.priority}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
