import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { 
  arrayMove, 
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
  DialogTrigger
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
  MoreHorizontal,
  Edit,
  Trash2,
  Clock
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

// Task form schema
const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

const COLUMNS = [
  { id: "pending", title: "Pending" },
  { id: "in_progress", title: "In Progress" },
  { id: "completed", title: "Completed" },
  { id: "cancelled", title: "Cancelled" },
];

const priorityColors = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
};

interface TaskCardProps {
  task: any;
  onClick: (task: any) => void;
}

function SortableTaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg h-24 mb-3"
      />
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-3 cursor-grab hover:shadow-md transition-shadow"
      onClick={() => onClick(task)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <span className="font-medium text-sm line-clamp-2">{task.title}</span>
          <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
            {task.priority}
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {task.assigneeName && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{task.assigneeName}</span>
            </div>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              <span>{format(new Date(task.dueDate), "MMM d")}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectKanban() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [activeTask, setActiveTask] = useState<any>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [targetColumn, setTargetColumn] = useState<string | null>(null);

  const { data: projectData, isLoading } = useQuery<any>({
    queryKey: ["/api/projects", id],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: any }) => {
      return apiRequest("PUT", `/api/tasks/${taskId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/tasks", { ...data, projectId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "pending",
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const project = projectData?.project;
  const tasks = projectData?.tasks || [];

  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === "Task") {
      setActiveTask(event.active.data.current.task);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column or another task
    let newStatus = overId;
    if (over.data.current?.type === "Task") {
      newStatus = over.data.current.task.status;
    }

    if (activeTask && activeTask.status !== newStatus) {
      updateTaskMutation.mutate({
        taskId,
        data: { status: newStatus },
      });
    }

    setActiveTask(null);
  };

  const handleCreateTask = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  const openCreateDialog = (status: string) => {
    setTargetColumn(status);
    form.reset({
      title: "",
      description: "",
      priority: "medium",
      status: status as any,
    });
    setIsCreateDialogOpen(true);
  };

  const openTaskDetail = (task: any) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  return (
    <div className="h-full flex flex-col space-y-6 p-6 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Projects
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: project?.color }} 
            />
            <h1 className="text-2xl font-bold">{project?.name}</h1>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4 h-full items-start">
          {COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t: any) => t.status === col.id);
            return (
              <div key={col.id} className="flex flex-col min-w-[300px] w-[300px] max-h-full">
                <Card className="bg-slate-50/50 border-none shadow-none flex flex-col max-h-full">
                  <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {col.title}
                      </CardTitle>
                      <Badge variant="secondary" className="bg-white">
                        {columnTasks.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2 flex-1 overflow-y-auto">
                    <SortableContext 
                      items={columnTasks.map((t: any) => t.id)} 
                      strategy={verticalListSortingStrategy}
                      id={col.id}
                    >
                      <div className="min-h-[100px]">
                        {columnTasks.map((task: any) => (
                          <SortableTaskCard 
                            key={task.id} 
                            task={task} 
                            onClick={openTaskDetail}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-muted-foreground mt-2"
                      onClick={() => openCreateDialog(col.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <Card className="w-[280px] shadow-lg border-primary/50">
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium text-sm line-clamp-2">{activeTask.title}</span>
                  <Badge className={priorityColors[activeTask.priority as keyof typeof priorityColors]}>
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
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleCreateTask)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...form.register("title")} placeholder="Task title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...form.register("description")} placeholder="Task description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  onValueChange={(val) => form.setValue("priority", val as any)} 
                  defaultValue={form.getValues("priority")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select 
                  onValueChange={(val) => form.setValue("assignedTo", val)} 
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input 
                id="dueDate" 
                type="date" 
                {...form.register("dueDate")} 
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex justify-between items-start pr-8">
              <DialogTitle className="text-xl">{selectedTask?.title}</DialogTitle>
              <Badge className={priorityColors[selectedTask?.priority as keyof typeof priorityColors]}>
                {selectedTask?.priority}
              </Badge>
            </div>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {selectedTask?.description && (
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedTask.description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-full">
                  <User className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Assignee</p>
                  <p className="text-sm">{selectedTask?.assigneeName || "Unassigned"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-full">
                  <CalendarIcon className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Due Date</p>
                  <p className="text-sm">
                    {selectedTask?.dueDate ? format(new Date(selectedTask.dueDate), "PPP") : "No due date"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-full">
                  <Clock className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Status</p>
                  <Badge variant="outline" className="capitalize">
                    {selectedTask?.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>Close</Button>
            <Link href={`/tasks`}>
              <Button variant="secondary">
                <Edit className="h-4 w-4 mr-2" />
                Full Edit
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
