import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  FolderKanban, 
  ExternalLink,
  User2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import { Link } from "wouter";
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
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

export default function Projects() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const { data: projects = [], isLoading } = useQuery<any[]>({
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
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const payload = { ...data, clientId: data.clientId || null };
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
      const payload = { ...data, clientId: data.clientId || null };
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
    });
  };

  const closeDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingProject(null);
    form.reset();
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50">
      <Header 
        title={t("nav.projects")}
        subtitle={t("projects.subtitle")}
      />
      
      <div className="p-3 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-900">{t("projects.all_projects")}</h2>
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
            <DialogContent>
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
                            {clients.map((client: any) => (
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
                                  field.value === color ? "border-slate-900 scale-110" : "border-transparent"
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

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-48">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="bg-slate-100 p-6 rounded-full mb-4">
              <FolderKanban className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">{t("projects.no_projects")}</h3>
            <p className="text-slate-500 max-w-sm mt-2">
              {t("projects.no_projects_desc")}
            </p>
            <Button className="mt-6" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 me-2" />
              {t("projects.create_btn")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: project.color }}
                      />
                      <CardTitle className="text-lg font-semibold truncate">{project.name}</CardTitle>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ms-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => startEdit(project)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("projects.delete_title")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("projects.delete_desc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteMutation.mutate(project.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {project.clientName ? (
                    <Link href={`/clients/${project.clientId}`}>
                      <div className="flex items-center gap-1.5 mt-1.5 text-sm text-primary hover:underline cursor-pointer w-fit">
                        <User2 className="h-3.5 w-3.5" />
                        <span>{project.clientName}</span>
                      </div>
                    </Link>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">{t("common.internal_project")}</p>
                  )}

                  {project.description && (
                    <CardDescription className="line-clamp-2 mt-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-slate-50">
                      {project.taskCounts?.pending || 0} {t("projects.pending")}
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                      {project.taskCounts?.in_progress || 0} {t("projects.in_progress")}
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">
                      {project.taskCounts?.completed || 0} {t("projects.completed_tasks")}
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Link href={`/projects/${project.id}`} className="w-full">
                    <Button variant="secondary" className="w-full">
                      {t("projects.open_board")}
                      <ExternalLink className="ms-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
