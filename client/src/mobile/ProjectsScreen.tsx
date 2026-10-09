import { useState } from "react";
import { CalendarDays, User2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import type { ProjectRow } from "@/components/projects/ProjectCard";
import { BottomSheet, Chips, ListState, SearchBox } from "./ui";
import { useList } from "./hooks";
import type { AddRequest } from "./QuickAdd";

type View = "live" | "completed" | "all";
const HEALTH_CLS: Record<string, string> = {
  on_track: "bg-success-soft text-success", at_risk: "bg-warning-soft text-warning", overdue: "bg-danger-soft text-danger",
  ready_to_close: "bg-info-soft text-info", no_tasks: "bg-muted text-muted-foreground", on_hold: "bg-warning-soft text-warning",
  completed: "bg-info-soft text-info", archived: "bg-muted text-muted-foreground",
};
const RANK: Record<string, number> = { overdue: 0, at_risk: 1, ready_to_close: 2, on_track: 3, no_tasks: 4, on_hold: 5, completed: 6, archived: 7 };

export default function ProjectsScreen({ onAdd }: { onAdd: (r: AddRequest) => void }) {
  const { t } = useTranslation();
  const { canAdd } = usePermissions();
  const [view, setView] = useState<View>("live");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useList<ProjectRow[]>("/api/projects");

  const health: Record<string, string> = {
    on_track: t("projects.health_on_track"), at_risk: t("projects.health_at_risk"), overdue: t("projects.health_overdue"),
    no_tasks: t("projects.health_no_tasks"), ready_to_close: t("projects.health_ready"), on_hold: t("projects.status_on_hold"),
    completed: t("projects.status_completed"), archived: t("projects.status_archived"),
  };

  const term = search.trim().toLowerCase();
  const visible = (q.data ?? [])
    .filter((p) => p.status !== "archived")
    .filter((p) => (view === "live" ? p.status === "active" || p.status === "on_hold" : view === "completed" ? p.status === "completed" : true))
    .filter((p) => !term || p.name.toLowerCase().includes(term) || (p.clientName ?? "").toLowerCase().includes(term))
    .sort((a, b) => RANK[a.health] - RANK[b.health] || (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity));
  const selected = (q.data ?? []).find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-3 p-4 pb-10">
      <SearchBox value={search} onChange={setSearch} placeholder={t("m.search")} />
      <Chips value={view} onChange={setView} options={[
        { value: "live", label: t("m.projects_live") }, { value: "completed", label: t("m.projects_done") }, { value: "all", label: t("m.filter_all") },
      ]} />
      <ListState loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} empty={visible.length === 0} emptyTitle={term ? t("m.no_results") : t("m.empty_projects")}>
        <ul className="space-y-2">
          {visible.map((p) => {
            const c = p.taskCounts;
            const pct = c.total ? Math.round((c.completed / c.total) * 100) : 0;
            return (
              <li key={p.id}>
                <button onClick={() => setSelectedId(p.id)} className="w-full rounded-xl border border-border bg-card p-3 text-start">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="truncate font-medium">{p.name}</span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", HEALTH_CLS[p.health])}>{health[p.health]}</span>
                  </span>
                  <span className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    {p.clientName && <span className="flex items-center gap-1 truncate"><User2 className="h-3.5 w-3.5" />{p.clientName}</span>}
                    {p.dueDate && <span className={cn("flex items-center gap-1", p.health === "overdue" && "font-medium text-danger")}><CalendarDays className="h-3.5 w-3.5" />{format(p.dueDate, "dd/MM/yyyy")}</span>}
                  </span>
                  {c.total > 0 && (
                    <span className="mt-2 block">
                      <span className="mb-1 flex justify-between text-xs text-muted-foreground tabular-nums">
                        <span>{t("m.tasks_progress", { done: String(c.completed), total: String(c.total) })}</span><span>{pct}%</span>
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </ListState>

      <BottomSheet open={!!selected} onOpenChange={(o) => { if (!o) setSelectedId(null); }} title={selected?.name ?? ""}>
        {selected && (
          <div className="space-y-3">
            {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className={cn("rounded-full px-2.5 py-1", HEALTH_CLS[selected.health])}>{health[selected.health]}</span>
              {selected.clientName && <span className="rounded-full bg-muted px-2.5 py-1">{selected.clientName}</span>}
            </div>
            {canAdd("tasks") && (
              <Button className="h-12 w-full text-base" onClick={() => { const id = selected.id; setSelectedId(null); onAdd({ kind: "task", projectId: id }); }}>
                {t("m.add_task_here")}
              </Button>
            )}
            <Link href={`/projects/${selected.id}`}>
              <Button variant="outline" className="h-12 w-full text-base">{t("m.open_board")}</Button>
            </Link>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
