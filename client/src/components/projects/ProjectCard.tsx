import { Link } from "wouter";
import { MoreHorizontal, CalendarDays, User2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { format, formatDistanceToNow } from "@/lib/dateUtils";

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "on_hold" | "completed" | "archived";
  color: string;
  clientId: string | null;
  clientName: string | null;
  dueDate: string | null;
  completedAt: string | null;
  budget: string | null;
  spent: number;
  overdueTasks: number;
  health: "completed" | "archived" | "on_hold" | "ready_to_close" | "overdue" | "at_risk" | "no_tasks" | "on_track";
  taskCounts: { pending: number; in_progress: number; completed: number; cancelled: number; total: number };
  members: Array<{ userId: string; name: string }>;
}

const HEALTH_CLS: Record<string, string> = {
  on_track: "bg-success-soft text-success border-success/20",
  at_risk: "bg-warning-soft text-warning border-warning/20",
  overdue: "bg-danger-soft text-danger border-danger/20",
  ready_to_close: "bg-info-soft text-info border-info/20",
  no_tasks: "bg-muted text-muted-foreground border-border",
  on_hold: "bg-warning-soft text-warning border-warning/20",
  completed: "bg-info-soft text-info border-info/20",
  archived: "bg-muted text-muted-foreground border-border",
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

interface Props {
  project: ProjectRow;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (p: ProjectRow) => void;
  onSetStatus: (p: ProjectRow, status: ProjectRow["status"]) => void;
  onDelete: (p: ProjectRow) => void;
}

export function ProjectCard({ project, canEdit, canDelete, onEdit, onSetStatus, onDelete }: Props) {
  const { t } = useTranslation();
  const { taskCounts: c } = project;
  const pct = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0;
  const finished = project.status === "completed" || project.status === "archived";
  const budget = project.budget != null ? parseFloat(project.budget) : null;
  const overBudget = budget != null && budget > 0 && project.spent > budget;
  const hasHistory = c.total + c.cancelled > 0 || project.spent > 0;

  const healthLabel: Record<string, string> = {
    on_track: t("projects.health_on_track"),
    at_risk: t("projects.health_at_risk"),
    overdue: t("projects.health_overdue"),
    no_tasks: t("projects.health_no_tasks"),
    ready_to_close: t("projects.health_ready"),
    on_hold: t("projects.status_on_hold"),
    completed: t("projects.status_completed"),
    archived: t("projects.status_archived"),
  };

  const due = project.dueDate ? new Date(project.dueDate) : null;
  const dueText = project.status === "completed" && project.completedAt
    ? t("projects.completed_on", { when: format(project.completedAt, "MMM dd, yyyy") })
    : due
      ? t("projects.due_in", { when: formatDistanceToNow(due, { addSuffix: true }) })
      : t("projects.no_due");

  const breakdown = [
    c.pending > 0 && t("projects.n_pending", { n: String(c.pending) }),
    c.in_progress > 0 && t("projects.n_in_progress", { n: String(c.in_progress) }),
  ].filter(Boolean) as string[];

  return (
    <Card className={cn("flex flex-col", finished && "bg-muted/30")}>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/projects/${project.id}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
            <span className="truncate font-semibold text-foreground">{project.name}</span>
          </Link>
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="-me-2 -mt-1 h-8 w-8 shrink-0 p-0" aria-label={t("projects.menu")}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && <DropdownMenuItem onClick={() => onEdit(project)}>{t("projects.edit")}</DropdownMenuItem>}
                {canEdit && project.status !== "completed" && project.status !== "archived" && (
                  <DropdownMenuItem onClick={() => onSetStatus(project, "completed")}>{t("projects.mark_completed")}</DropdownMenuItem>
                )}
                {canEdit && project.status === "completed" && (
                  <DropdownMenuItem onClick={() => onSetStatus(project, "active")}>{t("projects.reopen")}</DropdownMenuItem>
                )}
                {canEdit && (project.status === "archived" ? (
                  <DropdownMenuItem onClick={() => onSetStatus(project, "active")}>{t("projects.restore")}</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onSetStatus(project, "archived")}>{t("projects.archive")}</DropdownMenuItem>
                ))}
                {canDelete && !hasHistory && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => onDelete(project)}>{t("projects.delete_empty")}</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("text-xs", HEALTH_CLS[project.health])}>{healthLabel[project.health]}</Badge>
          {project.clientName ? (
            <Link href={`/clients/${project.clientId}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <User2 className="h-3.5 w-3.5" />
              {project.clientName}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">{t("projects.internal")}</span>
          )}
        </div>

        {project.description && <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}

        <div className="space-y-1.5">
          {c.total === 0 ? (
            <p className="text-xs text-muted-foreground">{t("projects.no_tasks_yet")}</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground tabular-nums">
                  {t("projects.tasks_progress", { done: String(c.completed), total: String(c.total) })}
                  {c.cancelled > 0 && <span className="ms-1 opacity-70">· {t("projects.cancelled_n", { n: String(c.cancelled) })}</span>}
                </span>
                <span className="font-medium tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              {(breakdown.length > 0 || project.overdueTasks > 0) && !finished && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {breakdown.join(" · ")}
                  {project.overdueTasks > 0 && (
                    <span className={cn("text-danger", breakdown.length > 0 && "ms-1")}>
                      {breakdown.length > 0 && "· "}{t("projects.n_late", { n: String(project.overdueTasks) })}
                    </span>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        {(budget != null && budget > 0) || project.spent > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("projects.budget_label")}</span>
              <span className={cn("tabular-nums", overBudget ? "font-medium text-danger" : "text-muted-foreground")}>
                {budget != null && budget > 0
                  ? t("projects.spent_of", { spent: formatCurrency(project.spent), budget: formatCurrency(budget) })
                  : t("projects.spent_only", { spent: formatCurrency(project.spent) })}
                {overBudget && ` · ${t("projects.over_budget")}`}
              </span>
            </div>
            {budget != null && budget > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", overBudget ? "bg-danger" : "bg-foreground/40")} style={{ width: `${Math.min(100, (project.spent / budget) * 100)}%` }} />
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className={cn("flex items-center gap-1 text-xs", project.health === "overdue" ? "font-medium text-danger" : "text-muted-foreground")}>
            <CalendarDays className="h-3.5 w-3.5" />
            {dueText}
          </span>
          {project.members.length > 0 && (
            <div className="flex -space-x-1.5">
              {project.members.slice(0, 3).map((m) => (
                <span key={m.userId} title={m.name} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
                  {initials(m.name)}
                </span>
              ))}
              {project.members.length > 3 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
                  {t("projects.members_more", { n: String(project.members.length - 3) })}
                </span>
              )}
            </div>
          )}
        </div>

        {project.health === "ready_to_close" && canEdit && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onSetStatus(project, "completed")}>
            {t("projects.mark_completed")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
