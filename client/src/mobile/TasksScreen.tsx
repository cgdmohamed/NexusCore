import { useMemo, useState } from "react";
import { Check, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "@/lib/dateUtils";
import type { ProjectRow } from "@/components/projects/ProjectCard";
import { Chips, ListState, SearchBox, Segmented } from "./ui";
import { useDebounced, useList } from "./hooks";
import { groupTasks, startOfDay, type MobileTask, type StatusFilter } from "./logic";
import { TaskSheet, useTaskUpdate } from "./TaskSheet";

const PRIORITY_DOT = { high: "bg-danger", medium: "bg-warning", low: "bg-muted-foreground/40" } as const;

export default function TasksScreen() {
  const { t } = useTranslation();
  const { canEdit } = usePermissions();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useDebounced(search.trim());
  const update = useTaskUpdate();

  const params = new URLSearchParams({ limit: "200" });
  if (scope === "mine") params.set("myTasks", "true");
  if (q) params.set("search", q);
  const tasksQ = useList<MobileTask[]>(`/api/tasks?${params}`);
  const { data: projects = [] } = useList<ProjectRow[]>("/api/projects");

  const tasks = tasksQ.data ?? [];
  const groups = useMemo(() => groupTasks(tasks, new Date(), filter), [tasks, filter]);
  const selected = tasks.find((x) => x.id === selectedId) ?? null;
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name;
  const today = startOfDay(new Date()).getTime();

  const labels: Record<string, string> = {
    overdue: t("m.group_overdue"), today: t("m.group_today"), upcoming: t("m.group_upcoming"), no_date: t("m.group_no_date"), done: t("m.group_done"),
  };

  return (
    <div className="space-y-3 p-4 pb-10">
      <Segmented value={scope} onChange={setScope} options={[{ value: "mine", label: t("m.scope_mine") }, { value: "all", label: t("m.scope_all") }]} />
      <SearchBox value={search} onChange={setSearch} placeholder={t("m.search")} />
      <Chips value={filter} onChange={setFilter} options={[
        { value: "open", label: t("m.filter_open") }, { value: "done", label: t("m.filter_done") }, { value: "all", label: t("m.filter_all") },
      ]} />

      <ListState
        loading={tasksQ.isLoading} error={tasksQ.isError} onRetry={() => tasksQ.refetch()}
        empty={groups.length === 0}
        emptyTitle={q ? t("m.no_results") : t("m.empty_tasks")} emptyHint={q ? undefined : t("m.empty_tasks_hint")}
      >
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className={cn("mb-2 text-sm font-semibold", g.key === "overdue" ? "text-danger" : "text-muted-foreground")}>
                {labels[g.key]} <span className="tabular-nums">({g.tasks.length})</span>
              </h2>
              <ul className="space-y-2">
                {g.tasks.map((task) => {
                  const done = task.status === "completed";
                  const late = !done && task.dueDate != null && new Date(task.dueDate).getTime() < today;
                  return (
                    <li key={task.id} className="flex items-stretch gap-1 rounded-xl border border-border bg-card">
                      <button
                        type="button"
                        disabled={!canEdit("tasks") || update.isPending}
                        aria-label={done ? t("m.reopen") : t("m.mark_done")}
                        onClick={() => update.mutate({ id: task.id, changes: { status: done ? "pending" : "completed" } })}
                        className="flex w-14 shrink-0 items-center justify-center"
                      >
                        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2", done ? "border-success bg-success text-white" : "border-border")}>
                          {done && <Check className="h-4 w-4" />}
                        </span>
                      </button>
                      <button type="button" onClick={() => setSelectedId(task.id)} className="min-w-0 flex-1 py-3 pe-3 text-start">
                        <span className={cn("block font-medium", done && "text-muted-foreground line-through")}>{task.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[task.priority])} aria-hidden />
                          {task.dueDate && (
                            <span className={cn("flex items-center gap-1", late && "font-medium text-danger")}>
                              <CalendarDays className="h-3.5 w-3.5" />
                              {format(task.dueDate, "dd/MM/yyyy")}
                            </span>
                          )}
                          {projectName(task.projectId) && <span className="truncate">{projectName(task.projectId)}</span>}
                          {scope === "all" && task.assigneeName && <span className="truncate">{task.assigneeName}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </ListState>

      <TaskSheet task={selected} projects={projects} onClose={() => setSelectedId(null)} />
    </div>
  );
}
