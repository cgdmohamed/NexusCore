import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CalendarIcon, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users,
  Briefcase,
  User,
  Building,
  FileText,
  MessageCircle,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Task form schema - simplified for existing database
const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  dueDate: z.date().optional(),
  assignedTo: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

// Priority colors
const priorityColors = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", 
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
};

// Status colors  
const statusColors = {
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
};

export default function Tasks() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: undefined as string | undefined,
    priority: undefined as string | undefined,
    assignedTo: "",
    myTasks: false,
  });

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });
      
      const response = await fetch(`/api/tasks?${params}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    }
  });

  // Fetch task stats
  const { data: stats } = useQuery({
    queryKey: ["/api/tasks/stats"],
    queryFn: async () => {
      const response = await fetch("/api/tasks/stats");
      if (!response.ok) throw new Error("Failed to fetch task stats");
      return response.json();
    }
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Fetch clients for linking
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      return apiRequest("POST", "/api/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/stats"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormData> }) => {
      return apiRequest("PUT", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/stats"] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "pending",
    },
  });

  const onSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { status: newStatus as any }
    });
  };

  const handleProgressChange = (taskId: string, newProgress: number) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { progressPercentage: newProgress }
    });
  };

  const viewTaskDetails = (task: any) => {
    setSelectedTask(task);
    setIsDetailDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground">
            Assign, track, and evaluate tasks across all departments
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Create a new task and assign it to team members
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter task title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter task description" 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTaskMutation.isPending}>
                    {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalTasks || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.statusBreakdown?.completed || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.statusBreakdown?.in_progress || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.statusBreakdown?.pending || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="myTasks"
                checked={filters.myTasks}
                onCheckedChange={(checked) => setFilters({ ...filters, myTasks: !!checked })}
              />
              <Label htmlFor="myTasks">My Tasks Only</Label>
            </div>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilters({
                search: "",
                status: undefined,
                priority: undefined,
                assignedTo: "",
                myTasks: false,
              })}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first task
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task: any) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{task.title}</h3>
                      <Badge className={cn(priorityColors[task.priority as keyof typeof priorityColors])}>
                        {task.priority}
                      </Badge>
                      <Badge className={cn(statusColors[task.status as keyof typeof statusColors])}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-muted-foreground mb-2">{task.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {task.assignedToEmployee && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.assignedToEmployee.firstName} {task.assignedToEmployee.lastName}
                        </div>
                      )}
                      {task.category && (
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {task.category}
                        </div>
                      )}
                      {task.client && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {task.client.name}
                        </div>
                      )}
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => viewTaskDetails(task)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div className="flex gap-2">
                    <Select 
                      value={task.status} 
                      onValueChange={(value) => handleStatusChange(task.id, value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    Created: {format(new Date(task.createdAt), 'MMM dd, yyyy')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              Task details and activity log
            </DialogDescription>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Badge className={cn(statusColors[selectedTask.status as keyof typeof statusColors])}>
                    {selectedTask.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Badge className={cn(priorityColors[selectedTask.priority as keyof typeof priorityColors])}>
                    {selectedTask.priority}
                  </Badge>
                </div>
              </div>
              
              {selectedTask.description && (
                <div>
                  <Label>Description</Label>
                  <p className="mt-1 text-sm">{selectedTask.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedTask.assignedToEmployee && (
                  <div>
                    <Label>Assigned To</Label>
                    <p className="mt-1 text-sm">
                      {selectedTask.assignedToEmployee.firstName} {selectedTask.assignedToEmployee.lastName}
                    </p>
                  </div>
                )}
                
                {selectedTask.category && (
                  <div>
                    <Label>Category</Label>
                    <p className="mt-1 text-sm">{selectedTask.category}</p>
                  </div>
                )}
              </div>

              {selectedTask.client && (
                <div>
                  <Label>Linked Client</Label>
                  <p className="mt-1 text-sm">{selectedTask.client.name}</p>
                </div>
              )}

              {selectedTask.dueDate && (
                <div>
                  <Label>Due Date</Label>
                  <p className="mt-1 text-sm">
                    {format(new Date(selectedTask.dueDate), 'MMM dd, yyyy')}
                  </p>
                </div>
              )}

              <Separator />

              <div>
                <Label>Created</Label>
                <p className="mt-1 text-sm">
                  {format(new Date(selectedTask.createdAt), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}