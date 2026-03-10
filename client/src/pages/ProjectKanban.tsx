import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  DndContext, 
  DragOverlay, 
  closestCenter,
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  ChevronLeft, 
  Plus, 
  User, 
  Calendar as CalendarIcon, 
  Clock,
  Edit,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const taskFormSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

const COLUMN_DEFS = [
  { id: "pending",     titleKey: "kanban.pending",     accent: "#94a3b8", headerBg: "bg-slate-50",  badgeCls: "bg-slate-200 text-slate-700" },
  { id: "in_progress", titleKey: "kanban.in_progress", accent: "#60a5fa", headerBg: "bg-blue-50",   badgeCls: "bg-blue-200 text-blue-700"  },
  { id: "completed",   titleKey: "kanban.completed",   accent: "#34d399", headerBg: "bg-green-50",  badgeCls: "bg-green-200 text-green-700"},
  { id: "cancelled",   titleKey: "kanban.cancelled",   accent: "#f87171", headerBg: "bg-red-50",    badgeCls: "bg-red-200 text-red-700"   },
];

const priorityColors: Record<string, string> = {
  low:    "bg-gray-100 text-gray-700 border-gray-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  high:   "bg-red-100 text-red-700 border-red-200",
};

function DroppableColumn({ colId, children }: { colId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-h-[120px] rounded-md transition-colors",
        isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed" : ""
      )}
    >
      {children}
    </div>
  );
}

function SortableTaskCard({ task, onClick }: { task: any; onClick: (t: any) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "Task", task } });

  const style = { transition, transform: CSS.Translate.toString(transform) };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg h-20 mb-2"
      />
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border border-slate-200"
      onClick={() => onClick(task)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <span className="font-medium text-sm leading-snug line-clamp-2 flex-1">{task.title}</span>
          <Badge variant="outline" className={cn("text-xs flex-shrink-0", priorityColors[task.priority] ?? "")}>
            {task.priority}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {task.assigneeName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assigneeName}
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(task.dueDate), "MMM d")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectKanban() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [activeTask, setActiveTask]                   = useState<any>(null);
  const [selectedTask, setSelectedTask]               = useState<any>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen]       = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen]   = useState(false);

  const { data: projectData, isLoading } = useQuery<any>({
    queryKey: ["/api/projects", id],
  });

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      apiRequest("PUT", `/api/tasks/${taskId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", id] }),
    onError: (err: Error) =>
      toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/tasks", { ...data, projectId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: t("common.success"), description: t("kanban.task_created") });
    },
    onError: (err: Error) =>
      toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { title: "", description: "", priority: "medium", status: "pending" },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const project = projectData;
  const tasks: any[] = projectData?.tasks ?? [];

  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === "Task") {
      setActiveTask(event.active.data.current.task);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const columnIds = COLUMN_DEFS.map((c) => c.id);
    let newStatus: string;
    if (columnIds.includes(overId)) {
      newStatus = overId;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      newStatus = overTask?.status ?? overId;
    }

    const draggedTask = tasks.find((t) => t.id === taskId);
    if (draggedTask && draggedTask.status !== newStatus) {
      updateTaskMutation.mutate({ taskId, data: { status: newStatus } });
    }
  };

  const openCreateDialog = (status: string) => {
    form.reset({ title: "", description: "", priority: "medium", status: status as any });
    setIsCreateDialogOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col p-3 md:p-6 overflow-hidden bg-slate-50/50 min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 flex-shrink-0">
        <div className="flex flex-col gap-1 min-w-0">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="w-fit -ms-2">
              <ChevronLeft className="h-4 w-4 me-1" />
              {t("kanban.back_to_projects")}
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: project?.color }} />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{project?.name ?? t("nav.projects")}</h1>
            </div>
            {project?.clientName ? (
              <Link href={`/clients/${project.clientId}`}>
                <div className="flex items-center gap-1.5 mt-0.5 text-sm text-primary hover:underline cursor-pointer w-fit ms-6">
                  <User className="h-3.5 w-3.5" />
                  <span>{project.clientName}</span>
                </div>
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5 ms-6">{t("common.internal_project")}</p>
            )}
          </div>
        </div>
        <Button onClick={() => openCreateDialog("pending")} size="sm" className="w-fit sm:flex-shrink-0">
          <Plus className="h-4 w-4 me-1.5" />
          {t("kanban.new_task")}
        </Button>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-5 overflow-x-auto pb-4 flex-1 min-h-0 items-start">
          {COLUMN_DEFS.map((col) => {
            const columnTasks = tasks.filter((t: any) => t.status === col.id);
            return (
              <div key={col.id} className="flex flex-col w-80 flex-shrink-0 min-w-[18rem]">
                <div
                  className={cn("rounded-t-lg px-4 py-3 flex items-center justify-between", col.headerBg)}
                  style={{ borderTop: `3px solid ${col.accent}` }}
                >
                  <span className="text-sm font-semibold text-slate-700 tracking-wide">
                    {t(col.titleKey)}
                  </span>
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center", col.badgeCls)}>
                    {columnTasks.length}
                  </span>
                </div>

                <div className="bg-white rounded-b-lg border border-t-0 border-slate-200 flex flex-col shadow-sm">
                  <SortableContext
                    items={columnTasks.map((t: any) => t.id)}
                    strategy={verticalListSortingStrategy}
                    id={col.id}
                  >
                    <DroppableColumn colId={col.id}>
                      <div className="p-3 space-y-2">
                        {columnTasks.map((task: any) => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            onClick={(t) => { setSelectedTask(t); setIsTaskDialogOpen(true); }}
                          />
                        ))}
                        {columnTasks.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 gap-2 select-none">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${col.accent}20` }}>
                              <Plus className="h-4 w-4" style={{ color: col.accent }} />
                            </div>
                            <p className="text-xs text-muted-foreground">{t("common.no_tasks")}</p>
                          </div>
                        )}
                      </div>
                    </DroppableColumn>
                  </SortableContext>

                  <div className="px-3 pb-3 pt-1 border-t border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground hover:text-slate-800 hover:bg-slate-50 h-8 text-xs"
                      onClick={() => openCreateDialog(col.id)}
                    >
                      <Plus className="h-3.5 w-3.5 me-1.5" />
                      {t("kanban.add_task")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <Card className="w-64 shadow-xl rotate-2 border-primary/40">
              <CardContent className="p-3">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium text-sm line-clamp-2 flex-1">{activeTask.title}</span>
                  <Badge variant="outline" className={cn("text-xs", priorityColors[activeTask.priority] ?? "")}>
                    {activeTask.priority}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("kanban.add_task_title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((d) => createTaskMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("kanban.task_title")} <span className="text-destructive">*</span></Label>
              <Input id="title" {...form.register("title")} placeholder={t("kanban.task_title_placeholder")} />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{t("tasks.title_required")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("kanban.description_label")}</Label>
              <Textarea id="description" {...form.register("description")} placeholder={t("kanban.task_desc_placeholder")} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("kanban.priority")}</Label>
                <Select
                  onValueChange={(v) => form.setValue("priority", v as any)}
                  defaultValue="medium"
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("tasks.low")}</SelectItem>
                    <SelectItem value="medium">{t("tasks.medium")}</SelectItem>
                    <SelectItem value="high">{t("tasks.high")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("kanban.assignee")}</Label>
                <Select onValueChange={(v) => form.setValue("assignedTo", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder={t("common.unassigned")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">{t("kanban.due_date")}</Label>
              <Input id="dueDate" type="date" {...form.register("dueDate")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {t("kanban.create_task")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pe-8">
              <DialogTitle className="text-xl leading-snug">{selectedTask?.title}</DialogTitle>
              <Badge variant="outline" className={cn("text-xs mt-0.5 flex-shrink-0", priorityColors[selectedTask?.priority] ?? "")}>
                {selectedTask?.priority}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {selectedTask?.description && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">{t("kanban.description_label")}</p>
                <p className="text-sm whitespace-pre-wrap text-slate-700">{selectedTask.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-full">
                  <User className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("kanban.assignee_label")}</p>
                  <p className="text-sm font-medium">{selectedTask?.assigneeName || t("common.unassigned")}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-full">
                  <CalendarIcon className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("kanban.due_date_label")}</p>
                  <p className="text-sm font-medium">
                    {selectedTask?.dueDate
                      ? format(new Date(selectedTask.dueDate), "PPP")
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-full">
                  <Clock className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("kanban.status_label")}</p>
                  <Badge variant="outline" className="capitalize text-xs">
                    {selectedTask?.status?.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>{t("common.close")}</Button>
            <Link href="/tasks">
              <Button variant="secondary">
                <Edit className="h-4 w-4 me-2" />
                {t("common.full_edit")}
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
