import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Check, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/currency";
import type { ProjectRow } from "@/components/projects/ProjectCard";
import { Chips, ListState, Segmented } from "./ui";
import { useList } from "./hooks";
import { ColumnChart, HBars, Sparkline, StackedBar } from "./charts";
import { TaskSheet, useTaskUpdate } from "./TaskSheet";
import { dueInfo, durationLabel, greetingFor, receivablesSnapshot } from "./overview-logic";
import type { MobileTask } from "./logic";

interface Insights {
  scope: "me" | "team";
  days: number;
  totals: { open: number; pending: number; inProgress: number; overdue: number; dueToday: number; completed: number; previousCompleted: number; created: number };
  priorities: { high: number; medium: number; low: number };
  daily: Array<{ date: string; completed: number }>;
  productivity: { perDay: number; previousPerDay: number; changePct: number | null; onTimeRate: number | null; onTimeSample: number; avgCompletionHours: number | null };
  topTasks: Array<{ id: string; title: string; priority: MobileTask["priority"]; status: MobileTask["status"]; dueDate: string | null; projectId: string | null; projectName: string | null; assigneeName: string | null; assignedTo: string | null }>;
  workload: Array<{ name: string | null; n: number }>;
}

const PRIORITY_DOT = { high: "bg-danger", medium: "bg-warning", low: "bg-muted-foreground/40" } as const;

function Card({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Delta({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", up ? "text-success" : "text-muted-foreground")} title={label}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

export default function OverviewScreen() {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { canView, canEdit } = usePermissions();
  const update = useTaskUpdate();
  const [scope, setScope] = useState<"me" | "team">("me");
  const [days, setDays] = useState<"7" | "14" | "30">("14");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tasksAllowed = canView("tasks");
  const insightsQ = useList<Insights>(`/api/tasks/insights?scope=${scope}&days=${days}`, tasksAllowed);
  const projectsQ = useList<ProjectRow[]>("/api/projects", canView("projects"));
  const invoicesQ = useList<any[]>("/api/invoices", canView("invoices"));
  const data = insightsQ.data;
  const projects = projectsQ.data ?? [];

  const name = (user as any)?.firstName || (user as any)?.username || "";
  const greeting = t(`m.ov.greet_${greetingFor(new Date().getHours())}`, { name });
  const today = format(new Date(), "EEEE, dd MMM");

  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(language === "ar" ? "ar-EG-u-nu-latn" : "en", { weekday: Number(days) <= 7 ? "short" : undefined, day: Number(days) <= 7 ? undefined : "numeric", timeZone: "UTC" })
      .format(new Date(`${iso}T12:00:00Z`));
  const dateDetail = (iso: string) =>
    new Intl.DateTimeFormat(language === "ar" ? "ar-EG-u-nu-latn" : "en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

  const columns = useMemo(
    () => (data?.daily ?? []).map((d) => ({ label: dayLabel(d.date), value: d.completed, detail: t("m.ov.chart_detail", { date: dateDetail(d.date), n: String(d.completed) }) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, language],
  );

  const attention = projects.filter((p) => p.status === "active" && (p.health === "overdue" || p.health === "at_risk")).slice(0, 3);
  const money = useMemo(() => receivablesSnapshot(invoicesQ.data ?? []), [invoicesQ.data]);
  const selected = data?.topTasks.find((x) => x.id === selectedId);
  const sheetTask: MobileTask | null = selected
    ? { id: selected.id, title: selected.title, description: null, status: selected.status, priority: selected.priority, dueDate: selected.dueDate, projectId: selected.projectId, assignedTo: selected.assignedTo, assigneeName: selected.assigneeName, createdAt: null }
    : null;
  const duration = durationLabel(data?.productivity.avgCompletionHours ?? null);

  const dueText = (dueDate: string | null) => {
    const info = dueInfo(dueDate);
    if (info.kind === "overdue") return { text: t("m.ov.due_overdue", { n: String(info.days) }), cls: "text-danger font-medium" };
    if (info.kind === "today") return { text: t("m.ov.due_today"), cls: "text-warning font-medium" };
    if (info.kind === "soon" || info.kind === "later") return { text: t("m.ov.due_in", { n: String(info.days) }), cls: "text-muted-foreground" };
    return null;
  };

  const tile = (label: string, value: number, extra?: ReactNode, tone?: "danger") => (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "danger" && value > 0 && "text-danger")}>{value}</p>
      {extra && <div className="mt-0.5">{extra}</div>}
    </div>
  );

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{greeting}</h2>
        <p className="text-sm text-muted-foreground">{today}</p>
        {data && scope === "me" && (
          <p className="mt-1 text-sm">
            {data.totals.dueToday + data.totals.overdue === 0 ? (
              t("m.ov.focus_none")
            ) : (
              <>
                {data.totals.dueToday > 0 && <span className="font-medium">{t("m.ov.focus_today", { n: String(data.totals.dueToday) })}</span>}
                {data.totals.dueToday > 0 && data.totals.overdue > 0 && " · "}
                {data.totals.overdue > 0 && <span className="font-medium text-danger">{t("m.ov.focus_overdue", { n: String(data.totals.overdue) })}</span>}
              </>
            )}
          </p>
        )}
      </div>

      {tasksAllowed && (
        <>
          <div className="space-y-2">
            <Segmented value={scope} onChange={setScope} options={[{ value: "me", label: t("m.ov.scope_me") }, { value: "team", label: t("m.ov.scope_team") }]} />
            <Chips value={days} onChange={setDays} options={(["7", "14", "30"] as const).map((d) => ({ value: d, label: t("m.ov.days", { n: d }) }))} />
          </div>

          <ListState loading={insightsQ.isLoading} error={insightsQ.isError} onRetry={() => insightsQ.refetch()} empty={false} emptyTitle="">
            {data && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {tile(t("m.ov.kpi_open"), data.totals.open)}
                  {tile(t("m.ov.kpi_overdue"), data.totals.overdue, undefined, "danger")}
                  {tile(t("m.ov.kpi_today"), data.totals.dueToday)}
                  {tile(t("m.ov.kpi_done"), data.totals.completed, <Delta pct={data.productivity.changePct} label={t("m.ov.vs_previous", { n: String(data.days) })} />)}
                </div>

                <Card title={t("m.ov.productivity")}>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums">{data.productivity.perDay}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {t("m.ov.per_day")}
                        <Delta pct={data.productivity.changePct} label={t("m.ov.vs_previous", { n: String(data.days) })} />
                      </p>
                    </div>
                    <Sparkline values={data.daily.map((d) => d.completed)} ariaLabel={t("m.ov.chart_title")} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">{t("m.ov.on_time")}</dt>
                      <dd className="mt-0.5 text-base font-semibold tabular-nums">{data.productivity.onTimeRate === null ? "—" : `${data.productivity.onTimeRate}%`}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("m.ov.avg_time")}</dt>
                      <dd className="mt-0.5 text-base font-semibold tabular-nums">{duration ? t(duration.unit === "days" ? "m.ov.unit_days" : "m.ov.unit_hours", { n: String(duration.value) }) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("m.ov.backlog")}</dt>
                      <dd className={cn("mt-0.5 text-base font-semibold tabular-nums", data.totals.created - data.totals.completed > 0 && "text-warning")}>
                        {data.totals.created - data.totals.completed > 0 ? "+" : ""}{data.totals.created - data.totals.completed}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {data.productivity.onTimeSample > 0 ? t("m.ov.on_time_note", { n: String(data.productivity.onTimeSample) }) : t("m.ov.none_yet")}
                    {" · "}{t("m.ov.backlog_note", { created: String(data.totals.created), done: String(data.totals.completed) })}
                  </p>
                </Card>

                <Card title={t("m.ov.chart_title")}>
                  <ColumnChart data={columns} average={data.productivity.perDay} averageLabel={t("m.ov.average", { n: String(data.productivity.perDay) })} ariaLabel={t("m.ov.chart_aria", { n: String(data.days) })} />
                </Card>

                <Card title={t("m.ov.status_title")}>
                  <StackedBar
                    ariaLabel={t("m.ov.status_aria")}
                    segments={[
                      { label: t("m.status_pending"), value: data.totals.pending, className: "bg-muted-foreground/40" },
                      { label: t("m.status_in_progress"), value: data.totals.inProgress, className: "bg-primary" },
                      { label: t("m.status_completed"), value: data.totals.completed, className: "bg-success" },
                    ]}
                  />
                  <p className="mb-1.5 mt-4 text-xs font-medium text-muted-foreground">{t("m.ov.priority_title")}</p>
                  <StackedBar
                    ariaLabel={t("m.ov.priority_title")}
                    segments={[
                      { label: t("m.priority_high"), value: data.priorities.high, className: "bg-danger" },
                      { label: t("m.priority_medium"), value: data.priorities.medium, className: "bg-warning" },
                      { label: t("m.priority_low"), value: data.priorities.low, className: "bg-muted-foreground/40" },
                    ]}
                  />
                </Card>

                <Card title={t("m.ov.top_title")} hint={t("m.ov.top_hint")} action={<Link href="/m/tasks" className="text-xs font-medium text-primary">{t("m.ov.view_all")}</Link>}>
                  {data.topTasks.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">{t("m.ov.no_open")}</p>
                  ) : (
                    <ol className="-mx-1 divide-y divide-border">
                      {data.topTasks.map((task, i) => {
                        const due = dueText(task.dueDate);
                        return (
                          <li key={task.id} className="flex items-center gap-2 py-2">
                            <button
                              type="button"
                              disabled={!canEdit("tasks") || update.isPending}
                              aria-label={t("m.mark_done")}
                              onClick={() => update.mutate({ id: task.id, changes: { status: "completed" } })}
                              className="flex h-11 w-9 shrink-0 items-center justify-center"
                            >
                              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border text-white hover:bg-success hover:border-success"><Check className="h-3.5 w-3.5" /></span>
                            </button>
                            <button type="button" onClick={() => setSelectedId(task.id)} className="min-w-0 flex-1 text-start">
                              <span className="flex items-baseline gap-1.5 text-sm font-medium"><span dir="ltr" className="shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span><span dir="auto" className="min-w-0 truncate">{task.title}</span></span>
                              <span className="mt-0.5 flex items-center gap-2 text-xs">
                                <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[task.priority])} aria-hidden />
                                {due && <span className={due.cls}>{due.text}</span>}
                                {(task.projectName || (scope === "team" && task.assigneeName)) && (
                                  <span className="truncate text-muted-foreground">{task.projectName ?? task.assigneeName}</span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </Card>

                {scope === "team" && data.workload.length > 0 && (
                  <Card title={t("m.ov.workload_title")}>
                    <HBars ariaLabel={t("m.ov.workload_title")} rows={data.workload.map((w) => ({ label: w.name ?? "—", value: w.n }))} />
                  </Card>
                )}
              </div>
            )}
          </ListState>
        </>
      )}

      {canView("projects") && projectsQ.data && (
        <Card title={t("m.ov.projects_title")} action={<Link href="/m/projects" className="text-xs font-medium text-primary">{t("m.ov.view_all")}</Link>}>
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("m.ov.projects_ok")}</p>
          ) : (
            <ul className="space-y-2">
              {attention.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} /><span className="truncate">{p.name}</span></span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", p.health === "overdue" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>
                    {p.health === "overdue" ? t("projects.health_overdue") : t("projects.health_at_risk")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {canView("invoices") && invoicesQ.data && (
        <Card title={t("m.ov.money_title")}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("m.ov.money_outstanding")}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCurrency(money.outstanding)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("m.ov.money_overdue")}</p>
              <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", money.overdue > 0 && "text-danger")}>{formatCurrency(money.overdue)}</p>
              {money.overdueCount > 0 && <p className="text-xs text-muted-foreground">{t("m.ov.money_overdue_n", { n: String(money.overdueCount) })}</p>}
            </div>
          </div>
        </Card>
      )}

      <TaskSheet task={sheetTask} projects={projects} onClose={() => setSelectedId(null)} />
    </div>
  );
}
