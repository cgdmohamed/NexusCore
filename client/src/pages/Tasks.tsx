import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { useQuery, useMutation, useQueryClient as useQC } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
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
  MoreHorizontal,
  RotateCcw,
  SortAsc,
  SortDesc,
  Grid3X3,
  List
} from "lucide-react";
import { format } from "@/lib/dateUtils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/dashboard/Header";
import { DataExportButton } from "@/components/DataExportButton";
import { useTranslation } from "@/lib/i18n";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { userOptions, projectOptions } from "@/lib/select-options";
// Task form schema - simplified for existing database
const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  dueDate: z.date().optional(),
  assignedTo: z.string().optional(),
  projectId: z.string().nullable().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

// Priority colors (outline badge style — matches Quotations/Invoices)
const priorityColors = {
  low: "bg-success-soft text-success border-success/20",
  medium: "bg-warning-soft text-warning border-warning/20",
  high: "bg-danger-soft text-danger border-danger/20",
};

// Status colors (outline badge style — matches Quotations/Invoices)
const statusColors = {
  pending: "bg-muted text-foreground border-border",
  in_progress: "bg-info-soft text-info border-info/20",
  completed: "bg-success-soft text-success border-success/20",
  cancelled: "bg-danger-soft text-danger border-danger/20",
};

export default function Tasks() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const lsl = (v: string) => { const k = `ls.${v}`; const r = t(k); return r === k ? v.replace(/_/g, ' ') : r; };
  const qc = useQC();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const [depTaskIds, setDepTaskIds] = useState<string[]>([]);
  const [depPickerOpen, setDepPickerOpen] = useState(false);

  // Fetch tasks with filtering
  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ["/api/tasks"],
  });
  
  // Filter tasks based on current filters
  const filteredTasksBase = (allTasks as any[]).filter((task: any) => {
    const matchesSearch = !searchTerm || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const tasks = [...filteredTasksBase].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;
    if (sortBy === "priority") {
      aVal = priorityOrder[a.priority as string] ?? 3;
      bVal = priorityOrder[b.priority as string] ?? 3;
    } else if (sortBy === "dueDate" || sortBy === "createdAt") {
      aVal = a[sortBy] ? new Date(a[sortBy] as string).getTime() : 0;
      bVal = b[sortBy] ? new Date(b[sortBy] as string).getTime() : 0;
    } else {
      aVal = String(a[sortBy] ?? "").toLowerCase();
      bVal = String(b[sortBy] ?? "").toLowerCase();
    }
    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const {
    currentPage: tasksPage,
    totalPages: tasksTotalPages,
    pageSize: tasksPageSize,
    paginatedItems: paginatedTasks,
    setCurrentPage: setTasksPage,
    setPageSize: setTasksPageSize,
  } = usePagination(tasks);

  useEffect(() => { setTasksPage(1); }, [searchTerm, statusFilter, priorityFilter]);

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

  // Fetch projects for optional task linking
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      return apiRequest("POST", "/api/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      // Invalidate projects so task counters and Kanban boards update
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: t("tasks.created"),
        description: t("tasks.created_desc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
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
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsEditDialogOpen(false);
      setEditingTask(null);
      editForm.reset();
      toast({
        title: t("tasks.updated"),
        description: t("tasks.updated_desc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
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

  const editForm = useForm<TaskFormData>({
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

  const onEditSubmit = (data: TaskFormData) => {
    if (!editingTask) return;
    const submitData: any = {
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status,
      assignedTo: data.assignedTo || null,
      projectId: data.projectId !== undefined ? data.projectId : (editingTask.projectId ?? null),
    };
    if (data.dueDate) {
      submitData.dueDate = data.dueDate instanceof Date 
        ? data.dueDate.toISOString() 
        : data.dueDate;
    } else if (editingTask.dueDate) {
      submitData.dueDate = editingTask.dueDate;
    }
    updateTaskMutation.mutate({
      id: editingTask.id,
      data: submitData
    });
  };

  const openEditDialog = (task: any) => {
    setEditingTask(task);
    editForm.reset({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      status: task.status || "pending",
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      assignedTo: task.assignedTo || undefined,
      projectId: task.projectId ?? null,
    });
    setIsEditDialogOpen(true);
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
      data: { status: "in_progress" as any }
    });
  };

  // Full task detail query (includes dependencies) — active when detail dialog open
  const { data: fullTaskDetail } = useQuery<any>({
    queryKey: ["/api/tasks", selectedTask?.id],
    enabled: !!selectedTask?.id && isDetailDialogOpen,
  });

  // Add dependency mutation
  const addDepMutation = useMutation({
    mutationFn: async ({ taskId, dependsOnTaskId }: { taskId: string; dependsOnTaskId: string }) => {
      const res = await apiRequest("POST", `/api/tasks/${taskId}/dependencies`, { dependsOnTaskId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tasks", selectedTask?.id] });
      setDepTaskIds([]);
      setDepPickerOpen(false);
      toast({ title: t('tk.dep_added') });
    },
    onError: (err: any) => {
      toast({ title: t('tk.dep_add_fail'), description: err.message, variant: "destructive" });
    },
  });

  // Remove dependency mutation
  const removeDepMutation = useMutation({
    mutationFn: async ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) => {
      const res = await apiRequest("DELETE", `/api/tasks/${taskId}/dependencies/${dependsOnId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tasks", selectedTask?.id] });
      toast({ title: t('tk.dep_removed') });
    },
    onError: (err: any) => {
      toast({ title: t('tk.dep_remove_fail'), description: err.message, variant: "destructive" });
    },
  });

  const viewTaskDetails = (task: any) => {
    setSelectedTask(task);
    setDepTaskIds([]);
    setDepPickerOpen(false);
    setIsDetailDialogOpen(true);
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div>
      <Header 
        title={t('nav.tasks')} 
        subtitle={t('page.tasks.sub')}
        hideExport
      />
      
      <div className="p-3 md:p-6 space-y-6">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {[
              { label: t('tk.total'),   value: stats.totalTasks || 0,                         icon: Briefcase,    iconColor: "text-primary" },
              { label: t('ls.completed'),     value: stats.statusBreakdown?.completed || 0,          icon: CheckCircle2, iconColor: "text-success" },
              { label: t('ls.in_progress'),   value: stats.statusBreakdown?.in_progress || 0,        icon: Clock,        iconColor: "text-warning" },
              { label: t('ls.pending'),       value: stats.statusBreakdown?.pending || 0,            icon: AlertCircle,  iconColor: "text-warning" },
              { label: t('tk.high_priority'), value: stats.priorityBreakdown?.high || 0,             icon: AlertCircle,  iconColor: "text-danger" },
              { label: t('tk.assigned'),      value: tasks.filter((t: any) => t.assignedTo).length, icon: Users,        iconColor: "text-muted-foreground" },
            ].map(({ label, value, icon: Icon, iconColor }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{label}</p>
                      <p className="text-2xl font-bold">{value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Controls and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{t('tk.management')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 mb-4">
              <div className="relative">
                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('common.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ps-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] flex-1 sm:flex-none">
                    <SelectValue placeholder={t('tk.all_status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('tk.all_status')}</SelectItem>
                    <SelectItem value="pending">{t('ls.pending')}</SelectItem>
                    <SelectItem value="in_progress">{t('ls.in_progress')}</SelectItem>
                    <SelectItem value="completed">{t('ls.completed')}</SelectItem>
                    <SelectItem value="cancelled">{t('ls.cancelled')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] flex-1 sm:flex-none">
                    <SelectValue placeholder={t('tk.all_priority')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('tk.all_priority')}</SelectItem>
                    <SelectItem value="high">{t('ls.high')}</SelectItem>
                    <SelectItem value="medium">{t('ls.medium')}</SelectItem>
                    <SelectItem value="low">{t('ls.low')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const parts = value.split('-');
                  const order = parts.pop() as "asc" | "desc";
                  setSortBy(parts.join('-'));
                  setSortOrder(order);
                }}>
                  <SelectTrigger className="w-full sm:w-[140px] flex-1 sm:flex-none">
                    <SelectValue placeholder={t('tk.sort_by')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt-desc">{t('tk.newest')}</SelectItem>
                    <SelectItem value="createdAt-asc">{t('tk.oldest')}</SelectItem>
                    <SelectItem value="title-asc">{t('tk.title_az')}</SelectItem>
                    <SelectItem value="title-desc">{t('tk.title_za')}</SelectItem>
                    <SelectItem value="priority-asc">{t('tk.priority_high_first')}</SelectItem>
                    <SelectItem value="dueDate-asc">{t('tk.due_earliest')}</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => { setSearchTerm(""); setStatusFilter("all"); setPriorityFilter("all"); }}
                >
                  <RotateCcw className="h-4 w-4 me-2" />
                  {t('tk.clear')}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-muted-foreground">
                {t('tk.showing', { n: String(tasks.length) })}
                {(searchTerm || statusFilter !== "all" || priorityFilter !== "all") && ` ${t('tk.matching')}`}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === "cards" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("cards")}
                    className="rounded-e-none h-8 px-3"
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="rounded-s-none h-8 px-3"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <DataExportButton data={tasks} filename="tasks-export" type="csv" />
                <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 me-2" />
                  {t('tasks.createTask')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create Task Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('tk.create_new')}</DialogTitle>
              <DialogDescription>{t('tk.create_desc')}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tk.title')}</FormLabel>
                      <FormControl><Input placeholder={t('tk.enter_title')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.description')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('tk.enter_desc')} className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('tasks.priority')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder={t('tk.select_priority')} /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="low">{t('ls.low')}</SelectItem>
                            <SelectItem value="medium">{t('ls.medium')}</SelectItem>
                            <SelectItem value="high">{t('ls.high')}</SelectItem>
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
                        <FormLabel>{t('common.status')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder={t('tk.select_status')} /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="pending">{t('ls.pending')}</SelectItem>
                            <SelectItem value="in_progress">{t('ls.in_progress')}</SelectItem>
                            <SelectItem value="completed">{t('ls.completed')}</SelectItem>
                            <SelectItem value="cancelled">{t('ls.cancelled')}</SelectItem>
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
                      <FormLabel>{t('tk.assign_to')}</FormLabel>
                      <FormControl>
                        <SearchableSelect options={userOptions(users as any[])} value={field.value || ""} onValueChange={field.onChange} placeholder={t('tk.select_assignee')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {projects.length > 0 && (
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('tk.project')} <span className="text-muted-foreground font-normal">({t('common.optional')})</span></FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={[{ value: "none", label: t('tk.no_project') }, ...projectOptions(projects)]}
                            value={field.value ?? "none"}
                            onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                            placeholder={t('tk.no_project')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>{t('common.cancel')}</Button>
                  <Button type="submit" disabled={createTaskMutation.isPending}>
                    {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Tasks Display */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">{t('tk.none')}</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                  ? t('tk.no_match')
                  : t('tk.get_started')}
              </p>
              {(!searchTerm && statusFilter === "all" && priorityFilter === "all") && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 me-2" />
                  {t('tasks.createTask')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {viewMode === "cards" ? (
              <>
              <div className="grid gap-4">
                {paginatedTasks.map((task: any) => (
                  <Card key={task.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-text leading-snug mb-2 truncate">{task.title}</h3>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge
                              variant="outline"
                              className={`${statusColors[task.status as keyof typeof statusColors]} text-xs`}
                            >
                              {lsl(task.status)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`${priorityColors[task.priority as keyof typeof priorityColors]} text-xs`}
                            >
                              {lsl(task.priority)}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {task.assignedTo && (
                              <div className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                <span>{task.assigneeName || task.assignedTo}</span>
                              </div>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center gap-1">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                <span>{t('tk.due')} {new Date(task.dueDate).toLocaleDateString('en-GB')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 sm:w-auto sm:px-3"
                            onClick={() => viewTaskDetails(task)}
                          >
                            <Eye className="h-3.5 w-3.5 sm:me-2" />
                            <span className="hidden sm:inline text-xs">{t('common.view')}</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                <Edit className="h-4 w-4 me-2" />{t('tk.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')}>
                                <Clock className="h-4 w-4 me-2" />{t('tk.mark_progress')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')}>
                                <CheckCircle2 className="h-4 w-4 me-2" />{t('tk.mark_complete')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'cancelled')}>
                                <AlertCircle className="h-4 w-4 me-2" />{t('tk.cancel_task')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <TablePagination
                currentPage={tasksPage}
                totalPages={tasksTotalPages}
                pageSize={tasksPageSize}
                totalItems={tasks.length}
                onPageChange={setTasksPage}
                onPageSizeChange={setTasksPageSize}
              />
              </>
            ) : (
              <>
              <Card className="overflow-x-auto">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tk.title')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('tasks.priority')}</TableHead>
                      <TableHead>{t('tasks.assignedTo')}</TableHead>
                      <TableHead>{t('tasks.dueDate')}</TableHead>
                      <TableHead className="text-end">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTasks.map((task: any) => (
                      <TableRow key={task.id} className="hover:bg-muted/60">
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${statusColors[task.status as keyof typeof statusColors]} text-xs`}
                          >
                            {lsl(task.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${priorityColors[task.priority as keyof typeof priorityColors]} text-xs`}
                          >
                            {lsl(task.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell>{task.assigneeName || task.assignedTo || "-"}</TableCell>
                        <TableCell>
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB') : "-"}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewTaskDetails(task)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                  <Edit className="h-4 w-4 me-2" />
                                  {t('tk.edit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')}>
                                  <Clock className="h-4 w-4 me-2" />
                                  {t('tk.mark_progress')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')}>
                                  <CheckCircle2 className="h-4 w-4 me-2" />
                                  {t('tk.mark_complete')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'cancelled')}>
                                  <AlertCircle className="h-4 w-4 me-2" />
                                  {t('tk.cancel_task')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              <TablePagination
                currentPage={tasksPage}
                totalPages={tasksTotalPages}
                pageSize={tasksPageSize}
                totalItems={tasks.length}
                onPageChange={setTasksPage}
                onPageSizeChange={setTasksPageSize}
              />
              </Card>
              </>
            )}
          </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t('common.status')}</Label>
                  <Badge variant="outline" className={cn(statusColors[selectedTask.status as keyof typeof statusColors])}>
                    {lsl(selectedTask.status)}
                  </Badge>
                </div>
                <div>
                  <Label>{t('tasks.priority')}</Label>
                  <Badge variant="outline" className={cn(priorityColors[selectedTask.priority as keyof typeof priorityColors])}>
                    {selectedTask.priority}
                  </Badge>
                </div>
              </div>
              
              {selectedTask.description && (
                <div>
                  <Label>{t('common.description')}</Label>
                  <p className="mt-1 text-sm">{selectedTask.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedTask.assignedToEmployee && (
                  <div>
                    <Label>{t('tasks.assignedTo')}</Label>
                    <p className="mt-1 text-sm">
                      {selectedTask.assignedToEmployee.firstName} {selectedTask.assignedToEmployee.lastName}
                    </p>
                  </div>
                )}
                
                {selectedTask.category && (
                  <div>
                    <Label>{t('tk.category')}</Label>
                    <p className="mt-1 text-sm">{selectedTask.category}</p>
                  </div>
                )}
              </div>

              {selectedTask.client && (
                <div>
                  <Label>{t('tk.linked_client')}</Label>
                  <p className="mt-1 text-sm">{selectedTask.client.name}</p>
                </div>
              )}

              {selectedTask.dueDate && (
                <div>
                  <Label>{t('tasks.dueDate')}</Label>
                  <p className="mt-1 text-sm">
                    {format(new Date(selectedTask.dueDate), 'MMM dd, yyyy')}
                  </p>
                </div>
              )}

              <Separator />

              {/* Dependencies Section */}
              <div>
                <Label className="text-base font-semibold">{t('tk.dependencies')}</Label>
                <p className="text-xs text-muted-foreground mb-3">{t('tk.dep_hint')}</p>

                {/* Existing dependencies */}
                {fullTaskDetail?.dependencies && fullTaskDetail.dependencies.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {fullTaskDetail.dependencies.map((dep: any) => (
                      <div key={dep.dependsOnTaskId || dep.id} className="flex items-center justify-between p-2 rounded border bg-muted/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className={cn("text-xs", statusColors[(dep.dependentTask?.status || 'pending') as keyof typeof statusColors])}>
                            {lsl(dep.dependentTask?.status || 'pending')}
                          </Badge>
                          <span className="text-sm truncate">{dep.dependentTask?.title || dep.dependsOnTaskId}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger shrink-0"
                          disabled={removeDepMutation.isPending}
                          onClick={() => removeDepMutation.mutate({ taskId: selectedTask.id, dependsOnId: dep.dependsOnTaskId || dep.id })}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-3">{t('tk.no_deps')}</p>
                )}

                {/* Add dependency — multi-select via checkbox popover */}
                {(() => {
                  const availableTasks = (allTasks as any[]).filter((t: any) => {
                    if (t.id === selectedTask.id) return false;
                    if (t.projectId !== (selectedTask.projectId ?? null)) return false;
                    return !fullTaskDetail?.dependencies?.some(
                      (d: any) => (d.dependsOnTaskId || d.id) === t.id
                    );
                  });
                  return (
                    <div className="flex gap-2">
                      <Popover open={depPickerOpen} onOpenChange={setDepPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1 justify-start text-sm font-normal truncate">
                            {depTaskIds.length === 0
                              ? t('tk.select_deps')
                              : `${depTaskIds.length} task${depTaskIds.length > 1 ? "s" : ""} selected`}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2 max-h-56 overflow-y-auto" align="start">
                          {availableTasks.length === 0 ? (
                            <p className="text-sm text-muted-foreground px-2 py-1">{t('tk.no_available')}</p>
                          ) : (
                            availableTasks.map((t: any) => (
                              <label key={t.id} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent cursor-pointer">
                                <Checkbox
                                  checked={depTaskIds.includes(t.id)}
                                  onCheckedChange={(checked) => {
                                    setDepTaskIds(prev =>
                                      checked ? [...prev, t.id] : prev.filter(id => id !== t.id)
                                    );
                                  }}
                                />
                                <span className="text-sm">{t.title}</span>
                              </label>
                            ))
                          )}
                        </PopoverContent>
                      </Popover>
                      <Button
                        size="sm"
                        disabled={depTaskIds.length === 0 || addDepMutation.isPending}
                        onClick={async () => {
                          for (const id of depTaskIds) {
                            await addDepMutation.mutateAsync({ taskId: selectedTask.id, dependsOnTaskId: id });
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  );
                })()}
              </div>

              <Separator />

              <div>
                <Label>{t('tk.created_at')}</Label>
                <p className="mt-1 text-sm">
                  {format(new Date(selectedTask.createdAt), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingTask(null);
          editForm.reset();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('tk.edit')}</DialogTitle>
            <DialogDescription>
              Update task details and assignment
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tk.title')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('tk.enter_title')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('tk.enter_desc')} 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tasks.priority')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('tk.select_priority')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">{t('ls.low')}</SelectItem>
                          <SelectItem value="medium">{t('ls.medium')}</SelectItem>
                          <SelectItem value="high">{t('ls.high')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.status')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('tk.select_status')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">{t('ls.pending')}</SelectItem>
                          <SelectItem value="in_progress">{t('ls.in_progress')}</SelectItem>
                          <SelectItem value="completed">{t('ls.completed')}</SelectItem>
                          <SelectItem value="cancelled">{t('ls.cancelled')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('tasks.dueDate')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full ps-3 text-start font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>{t('tk.pick_date')}</span>
                            )}
                            <CalendarIcon className="ms-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tk.assign_to')}</FormLabel>
                    <FormControl>
                      <SearchableSelect options={userOptions(users as any[])} value={field.value || ""} onValueChange={field.onChange} placeholder={t('tk.select_assignee')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {projects.length > 0 && (
                <FormField
                  control={editForm.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tk.project')} <span className="text-muted-foreground font-normal">({t('common.optional')})</span></FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={[{ value: "none", label: t('tk.no_project') }, ...projectOptions(projects)]}
                          value={field.value ?? "none"}
                          onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                          placeholder={t('tk.no_project')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingTask(null);
                    editForm.reset();
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={updateTaskMutation.isPending}>
                  {updateTaskMutation.isPending ? t('common.saving') : t('common.save_changes')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}