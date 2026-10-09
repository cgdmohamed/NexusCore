import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, FolderKanban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertProjectSchema, type Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { Header } from "@/components/dashboard/Header";
import { ProjectCard, type ProjectRow } from "@/components/projects/ProjectCard";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

const projectFormSchema = insertProjectSchema.extend({
  clientId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
  status: z.enum(["active", "on_hold", "completed", "archived"]).default("active"),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

type ViewKey = "live" | "completed" | "archived" | "all" | "overdue" | "due_week" | "ready";

const DAY = 24 * 60 * 60 * 1000;
const HEALTH_RANK: Record<string, number> = { overdue: 0, at_risk: 1, ready_to_close: 2, on_track: 3, no_tasks: 4, on_hold: 5, completed: 6, archived: 7 };
const isLive = (p: ProjectRow) => p.status === "active" || p.status === "on_hold";

// Most urgent first, then by the nearest deadline; projects without a deadline come last
function byUrgency(a: ProjectRow, b: ProjectRow) {
  const rank = HEALTH_RANK[a.health] - HEALTH_RANK[b.health];
  if (rank !== 0) return rank;
  const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  return da - db;
}

export default function Projects() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [view, setView] = useState<ViewKey>("live");
  const [completeTarget, setCompleteTarget] = useState<ProjectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const { canEdit, canDelete, canAdd } = usePermissions();

  const { data: projects = [], isLoading } = useQuery<ProjectRow[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#3b82f6",
      status: "active",
      clientId: null,
      startDate: null,
      dueDate: null,
      budget: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const payload = {
        ...data,
        clientId: data.clientId || null,
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
        budget: data.budget || null,
      };
      const res = await apiRequest("POST", "/api/projects", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: t("common.success"), description: t("projects.created") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProjectFormData }) => {
      const payload = {
        ...data,
        clientId: data.clientId || null,
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
        budget: data.budget || null,
      };
      const res = await apiRequest("PUT", `/api/projects/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setEditingProject(null);
      form.reset();
      toast({ title: t("common.success"), description: t("projects.updated") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: t("common.success"), description: t("projects.deleted") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProjectRow["status"] }) => {
      await apiRequest("PUT", `/api/projects/${id}`, { status });
      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      const message = status === "archived" ? "projects.archived_toast" : status === "completed" ? "projects.completed_toast" : "projects.restored_toast";
      toast({ title: t("common.success"), description: t(message) });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  // Completing a project that still has open tasks asks first; every other change goes straight through
  const requestStatus = (project: ProjectRow, status: ProjectRow["status"]) => {
    const open = project.taskCounts.total - project.taskCounts.completed;
    if (status === "completed" && open > 0) {
      setCompleteTarget(project);
      return;
    }
    statusMutation.mutate({ id: project.id, status });
  };

  const onSubmit = (data: ProjectFormData) => {
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const startEdit = (project: any) => {
    setEditingProject(project);
    form.reset({
      name: project.name,
      description: project.description || "",
      color: project.color || "#3b82f6",
      status: project.status || "active",
      clientId: project.clientId || null,
      startDate: project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : null,
      dueDate: project.dueDate ? new Date(project.dueDate).toISOString().split("T")[0] : null,
      budget: project.budget ? String(project.budget) : null,
    });
  };

  const closeDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingProject(null);
    form.reset();
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekEnd = startOfToday.getTime() + 7 * DAY;
  const dueThisWeek = (p: ProjectRow) =>
    isLive(p) && p.dueDate != null && new Date(p.dueDate).getTime() >= startOfToday.getTime() && new Date(p.dueDate).getTime() <= weekEnd;

  const live = projects.filter(isLive);
  const counts = {
    live: live.length,
    completed: projects.filter((p) => p.status === "completed").length,
    archived: projects.filter((p) => p.status === "archived").length,
    all: projects.length,
    overdue: projects.filter((p) => p.health === "overdue").length,
    due_week: projects.filter(dueThisWeek).length,
    ready: projects.filter((p) => p.health === "ready_to_close").length,
  };

  const visible = (() => {
    switch (view) {
      case "live": return [...live].sort(byUrgency);
      case "overdue": return projects.filter((p) => p.health === "overdue").sort(byUrgency);
      case "due_week": return projects.filter(dueThisWeek).sort(byUrgency);
      case "ready": return projects.filter((p) => p.health === "ready_to_close").sort(byUrgency);
      case "completed":
        return projects.filter((p) => p.status === "completed")
          .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime());
      case "archived": return projects.filter((p) => p.status === "archived");
      default: return [...projects].sort(byUrgency);
    }
  })();

  const tabs: { key: ViewKey; label: string }[] = [
    { key: "live", label: t("projects.tab_live") },
    { key: "completed", label: t("projects.status_completed") },
    { key: "archived", label: t("projects.status_archived") },
    { key: "all", label: t("projects.filter_all") },
  ];
  const summary: { key: ViewKey; label: string; value: number; alert?: boolean }[] = [
    { key: "live", label: t("projects.summary_active"), value: counts.live },
    { key: "overdue", label: t("projects.summary_overdue"), value: counts.overdue, alert: counts.overdue > 0 },
    { key: "due_week", label: t("projects.summary_due_week"), value: counts.due_week },
    { key: "ready", label: t("projects.summary_ready"), value: counts.ready },
  ];

  return (
    <div className="flex-1 overflow-auto bg-muted/50">
      <Header 
        title={t("nav.projects")}
        subtitle={t("projects.subtitle")}
      />
      
      <div className="p-3 md:p-6">
        <div className="mb-4 flex items-center justify-end">
          <Dialog 
            open={isCreateDialogOpen || !!editingProject} 
            onOpenChange={(open) => { if (!open) closeDialog(); }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("projects.new_project")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProject ? t("projects.edit_project") : t("projects.create_project")}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("projects.name")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("projects.name_placeholder")} />
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
                        <FormLabel>{t("projects.description")}</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} placeholder={t("projects.description_placeholder")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("projects.client_optional")}</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                          value={field.value ?? "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("projects.select_client")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">{t("projects.no_client")}</SelectItem>
                            {clients.filter((client: any) => client.status !== "archived").map((client: any) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("projects.color")}</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            {PRESET_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={cn(
                                  "w-8 h-8 rounded-full border-2 transition-all",
                                  field.value === color ? "border-border scale-110" : "border-transparent"
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => field.onChange(color)}
                              />
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("projects.status")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">{t("projects.status_active")}</SelectItem>
                            <SelectItem value="on_hold">{t("projects.status_on_hold")}</SelectItem>
                            <SelectItem value="completed">{t("projects.status_completed")}</SelectItem>
                            <SelectItem value="archived">{t("projects.status_archived")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("projects.start_date")}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("projects.due_date")}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("projects.budget")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={t("projects.budget_placeholder")}
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      {t("common.cancel")}
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                      )}
                      {editingProject ? t("projects.save_changes") : t("projects.create_btn")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Where things stand right now; each box filters the list */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summary.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              aria-pressed={view === item.key}
              className={cn(
                "rounded-lg border bg-card p-4 text-start transition-colors hover:bg-accent/40",
                view === item.key ? "border-primary ring-1 ring-primary" : "border-border",
              )}
            >
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", item.alert && "text-danger")}>{item.value}</p>
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                view === tab.key ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted/50",
              )}
            >
              {tab.label}
              <span className="ms-1.5 text-xs opacity-70 tabular-nums">({counts[tab.key as "live" | "completed" | "archived" | "all"]})</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-48">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-2 h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-5">
              <FolderKanban className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground">
              {projects.length === 0 ? t("projects.no_projects") : view === "live" ? t("projects.empty_live") : t("projects.empty_filter")}
            </h3>
            <p className="mt-2 max-w-sm text-muted-foreground">
              {projects.length === 0 ? t("projects.no_projects_desc") : view === "live" ? t("projects.empty_live_desc") : ""}
            </p>
            <div className="mt-6 flex gap-2">
              {projects.length > 0 && view !== "all" && (
                <Button variant="outline" onClick={() => setView("all")}>{t("projects.show_all")}</Button>
              )}
              {canAdd("projects") && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="me-2 h-4 w-4" />
                  {t("projects.create_btn")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                canEdit={canEdit("projects")}
                canDelete={canDelete("projects")}
                onEdit={startEdit}
                onSetStatus={requestStatus}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}

        <AlertDialog open={!!completeTarget} onOpenChange={(open) => { if (!open) setCompleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("projects.complete_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {completeTarget && t("projects.complete_open_tasks", { n: String(completeTarget.taskCounts.total - completeTarget.taskCounts.completed) })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (completeTarget) statusMutation.mutate({ id: completeTarget.id, status: "completed" });
                  setCompleteTarget(null);
                }}
              >
                {t("projects.complete_confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("projects.delete_title")}</AlertDialogTitle>
              <AlertDialogDescription>{t("projects.delete_desc_empty")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
