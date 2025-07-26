import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Tasks() {
  const { t } = useTranslation();
  
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks"],
  });

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.tasks')}
        subtitle="Assign and track team tasks"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">All Tasks</h3>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Task
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-neutral">{t('common.loading')}</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral mb-4">No tasks found</p>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first task
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            task.status === 'completed' 
                              ? 'bg-green-100 text-secondary border-green-200' :
                            task.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            task.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-700 border-gray-200' :
                              'bg-yellow-100 text-yellow-700 border-yellow-200'
                          }
                        >
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.dueDate ? formatDistanceToNow(new Date(task.dueDate), { addSuffix: true }) : 'No due date'}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">Edit</Button>
                          <Button variant="outline" size="sm">View</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
