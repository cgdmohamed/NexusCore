import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckSquare, ChevronLeft, ChevronRight, FileText, FolderKanban, Loader2, Receipt, type LucideIcon } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/hooks/usePermissions";
import { addDays, addMonths, barFor, daysBetween, groupByDay, monthGrid, monthOf, rangeFor, startOfMonth, weekDays } from "@/lib/calendar-logic";

type View = "month" | "week" | "timeline";
type EventType = "task" | "invoice" | "quotation" | "project";
interface CalEvent {
  type: EventType; id: string; day: string; title: string; subtitle?: string; status: string; state?: "late" | "done" | "open";
  href: string; priority?: string; assignee?: string; amount?: number; remaining?: number; mark?: "start" | "due";
}
interface CalProject { id: string; name: string; color: string; status: string; startDay: string | null; dueDay: string | null; pct: number; completed: number; total: number; overdue: number; health: string }
interface CalData { from: string; to: string; scope: "me" | "team"; today: string; events: CalEvent[]; projects: CalProject[] }

const TYPES: EventType[] = ["task", "invoice", "quotation", "project"];
const ICON: Record<EventType, LucideIcon> = { task: CheckSquare, invoice: Receipt, quotation: FileText, project: FolderKanban };
// Colour alone never carries meaning: each kind also has its own icon, and late or finished work says so in words
const TONE: Record<EventType, string> = {
  task: "bg-primary/10 text-primary",
  invoice: "bg-warning-soft text-warning",
  quotation: "bg-accent text-accent-foreground",
  project: "bg-success/10 text-success",
};
const DOT: Record<EventType, string> = { task: "bg-primary", invoice: "bg-warning", quotation: "bg-muted-foreground", project: "bg-success" };
const HEALTH_BAR: Record<string, string> = { overdue: "bg-danger", at_risk: "bg-warning", ready_to_close: "bg-success", completed: "bg-success", on_hold: "bg-muted-foreground", on_track: "bg-primary", no_tasks: "bg-muted-foreground" };

const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };

function useDayFormat() {
  const { language } = useTranslation();
  const locale = language === "ar" ? "ar-EG" : "en-US";
  const at = (day: string) => new Date(`${day}T12:00:00Z`);
  return {
    weekStart: language === "ar" ? 6 : 0,
    month: (day: string) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(at(day)),
    weekday: (day: string, style: "short" | "long" = "short") => new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" }).format(at(day)),
    dayNum: (day: string) => new Intl.NumberFormat(locale).format(Number(day.slice(8))),
    full: (day: string) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(at(day)),
    short: (day: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(at(day)),
    n: (v: number) => new Intl.NumberFormat(locale).format(v),
  };
}

function EventLine({ e, compact = false }: { e: CalEvent; compact?: boolean }) {
  const { t } = useTranslation();
  const Icon = ICON[e.type];
  const label = e.type === "project" ? t(e.mark === "start" ? "cal.project_start" : "cal.project_due") : null;
  return (
    <Link
      href={e.href}
      title={[label, e.title, e.subtitle].filter(Boolean).join(" · ")}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-2 py-0.5 text-start text-xs transition-colors hover:brightness-95",
        TONE[e.type], e.state === "done" && "opacity-60 line-through", e.state === "late" && "ring-1 ring-danger/60",
        compact && "py-px",
      )}
      data-testid={`cal-event-${e.type}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span dir="auto" className="min-w-0 truncate">{e.title}</span>
    </Link>
  );
}

function DayDetails({ day, events, fmt }: { day: string; events: CalEvent[]; fmt: ReturnType<typeof useDayFormat> }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="cal-day-details" aria-live="polite">
      <h2 className="mb-3 text-sm font-semibold">{fmt.full(day)}</h2>
      {events.length === 0 && <p className="text-sm text-muted-foreground">{t("cal.no_events")}</p>}
      <ul className="space-y-2">
        {events.map((e) => {
          const Icon = ICON[e.type];
          const kind = e.type === "project" ? t(e.mark === "start" ? "cal.project_start" : "cal.project_due") : t(`cal.kind.${e.type}`);
          return (
            <li key={`${e.type}-${e.id}-${e.mark ?? ""}`}>
              <Link href={e.href} className="flex items-start gap-3 rounded-lg p-2 hover:bg-accent">
                <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", TONE[e.type])}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span dir="auto" className={cn("block truncate text-sm font-medium", e.state === "done" && "line-through opacity-70")}>{e.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[kind, e.subtitle].filter(Boolean).join(" · ")}</span>
                  {e.type === "invoice" && e.remaining! > 0 && <span className="block text-xs tabular-nums text-muted-foreground">{t("cal.remaining")} {fmt.n(e.remaining!)}</span>}
                </span>
                {e.state === "late" && <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">{t("cal.late")}</span>}
                {e.state === "done" && <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">{t("cal.done")}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MonthView({ data, anchor, selected, onSelect, fmt }: { data: CalData | undefined; anchor: string; selected: string; onSelect: (d: string) => void; fmt: ReturnType<typeof useDayFormat> }) {
  const { t } = useTranslation();
  const grid = monthGrid(anchor, fmt.weekStart);
  const by = useMemo(() => groupByDay(data?.events ?? []), [data]);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card" data-testid="cal-month">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {grid.slice(0, 7).map((d) => <div key={d} className="py-2">{fmt.weekday(d)}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d) => {
          const list = by.get(d) ?? [];
          const inMonth = monthOf(d) === monthOf(anchor);
          const isToday = d === data?.today;
          const isSelected = d === selected;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-pressed={isSelected}
              aria-label={`${fmt.full(d)}${list.length ? `، ${t("cal.events_n", { n: fmt.n(list.length) })}` : ""}`}
              className={cn(
                "flex min-h-14 flex-col gap-1 border-b border-e border-border p-1 text-start transition-colors hover:bg-accent/50 md:min-h-28 md:p-2",
                !inMonth && "bg-muted/30 text-muted-foreground", isSelected && "bg-primary/5 ring-2 ring-inset ring-primary",
              )}
              data-testid="cal-day"
            >
              <span className={cn("flex h-6 w-6 items-center justify-center self-start rounded-full text-xs tabular-nums", isToday && "bg-primary font-semibold text-primary-foreground")}>{fmt.dayNum(d)}</span>
              {/* Wide screens list the events; phones show one dot per kind and the day's details sit below the grid */}
              <div className="hidden min-w-0 flex-1 flex-col gap-0.5 md:flex">
                {list.slice(0, 3).map((e) => <EventLine key={`${e.type}-${e.id}-${e.mark ?? ""}`} e={e} compact />)}
                {list.length > 3 && <span className="px-1 text-xs text-muted-foreground">{t("cal.more_n", { n: fmt.n(list.length - 3) })}</span>}
              </div>
              <div className="flex flex-wrap gap-0.5 md:hidden">
                {TYPES.filter((ty) => list.some((e) => e.type === ty)).map((ty) => <span key={ty} className={cn("h-1.5 w-1.5 rounded-full", DOT[ty])} />)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ data, anchor, selected, onSelect, fmt }: { data: CalData | undefined; anchor: string; selected: string; onSelect: (d: string) => void; fmt: ReturnType<typeof useDayFormat> }) {
  const { t } = useTranslation();
  const by = useMemo(() => groupByDay(data?.events ?? []), [data]);
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7" data-testid="cal-week">
      {weekDays(anchor, fmt.weekStart).map((d) => {
        const list = by.get(d) ?? [];
        return (
          <div key={d} className={cn("rounded-lg border bg-card p-2", d === selected ? "border-primary ring-1 ring-primary" : "border-border")}>
            <button type="button" onClick={() => onSelect(d)} className="mb-2 flex w-full items-baseline justify-between text-start">
              <span className={cn("text-sm font-semibold", d === data?.today && "text-primary")}>{fmt.weekday(d)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{fmt.dayNum(d)}</span>
            </button>
            <div className="space-y-1">
              {list.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground md:py-6">{t("cal.no_events_short")}</p>}
              {list.map((e) => <EventLine key={`${e.type}-${e.id}-${e.mark ?? ""}`} e={e} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineView({ data, anchor, fmt }: { data: CalData | undefined; anchor: string; fmt: ReturnType<typeof useDayFormat> }) {
  const { t } = useTranslation();
  const from = startOfMonth(anchor);
  const to = addDays(addMonths(anchor, 1), -1);
  const total = daysBetween(from, to) + 1;
  const todayPct = data && data.today >= from && data.today <= to ? ((daysBetween(from, data.today) + 0.5) / total) * 100 : null;
  const weekMarks = Array.from({ length: total }, (_, i) => addDays(from, i)).filter((d, i) => i === 0 || i % 7 === 0);
  const rows = (data?.projects ?? []).filter((p) => barFor(p.startDay, p.dueDay, from, to));

  if (rows.length === 0) return <p className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground" data-testid="cal-timeline-empty">{t("cal.timeline_empty")}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card" data-testid="cal-timeline">
      <div className="min-w-[640px]" dir="ltr">
        <div className="relative h-8 border-b border-border bg-muted/40">
          {weekMarks.map((d) => <span key={d} className="absolute top-2 -translate-x-1/2 text-xs tabular-nums text-muted-foreground" style={{ left: `${(daysBetween(from, d) / total) * 100}%`, marginLeft: "0.75rem" }}>{fmt.short(d)}</span>)}
        </div>
        <div className="relative">
          {todayPct !== null && <div className="absolute inset-y-0 z-10 w-px bg-primary" style={{ left: `${todayPct}%` }} aria-hidden />}
          {rows.map((p) => {
            const bar = barFor(p.startDay, p.dueDay, from, to)!;
            return (
              <div key={p.id} className="relative flex h-14 items-center border-b border-border last:border-b-0">
                <Link
                  href={`/projects/${p.id}`}
                  className={cn("absolute flex h-8 items-center overflow-hidden rounded-md text-xs text-white shadow-sm hover:brightness-110", HEALTH_BAR[p.health] ?? "bg-primary", bar.startsBefore && "rounded-s-none", bar.endsAfter && "rounded-e-none")}
                  style={{ left: `${bar.left}%`, width: `max(${bar.width}%, 2rem)` }}
                  title={`${p.name} — ${p.pct}%`}
                  data-testid="cal-project-bar"
                >
                  <span className="absolute inset-y-0 start-0 bg-black/25" style={{ width: `${p.pct}%` }} aria-hidden />
                  <span dir="auto" className="relative z-10 truncate px-2 font-medium">{p.name}</span>
                  <span className="relative z-10 ms-auto shrink-0 pe-2 tabular-nums">{fmt.n(p.pct)}%</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
      <ul className="border-t border-border p-3 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-4">
        {rows.map((p) => <li key={p.id}><bdi>{p.name}</bdi>: <bdi>{t("cal.progress_of", { done: fmt.n(p.completed), total: fmt.n(p.total) })}{p.overdue > 0 ? ` · ${t("cal.late_n", { n: fmt.n(p.overdue) })}` : ""}</bdi></li>)}
      </ul>
    </div>
  );
}

export default function CalendarPage() {
  const { t, language } = useTranslation();
  const { isAdmin } = usePermissions();
  const fmt = useDayFormat();
  const [view, setView] = useState<View>(() => (read("cal.view") as View) || "month");
  const [scope, setScope] = useState<"me" | "team">(() => (read("cal.scope") === "team" ? "team" : "me"));
  const [off, setOff] = useState<Set<EventType>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Today comes from the server's calendar (the company's time zone), not the browser's
  const todayQuery = useQuery<{ today: string }>({ queryKey: ["calendar-today"], queryFn: async () => (await apiRequest("GET", `/api/calendar?from=2000-01-01&to=2000-01-01&types=none`)).json(), staleTime: 60 * 60 * 1000 });
  const today = todayQuery.data?.today ?? null;
  const day = anchor ?? today;
  const effectiveScope = isAdmin ? scope : "me";
  const types = TYPES.filter((ty) => !off.has(ty));

  const range = day ? rangeFor(view, day, fmt.weekStart) : null;
  const q = useQuery<CalData>({
    queryKey: ["/api/calendar", range?.from, range?.to, effectiveScope, types.join(",")],
    enabled: !!range && types.length > 0,
    queryFn: async () => (await apiRequest("GET", `/api/calendar?from=${range!.from}&to=${range!.to}&scope=${effectiveScope}&types=${types.join(",")}`)).json(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const choose = (v: View) => { setView(v); write("cal.view", v); };
  const chooseScope = (s: "me" | "team") => { setScope(s); write("cal.scope", s); };
  const step = (dir: 1 | -1) => day && setAnchor(view === "week" ? addDays(day, 7 * dir) : addMonths(day, dir));
  const heading = day ? (view === "week" ? `${fmt.short(weekDays(day, fmt.weekStart)[0])} – ${fmt.short(weekDays(day, fmt.weekStart)[6])}` : fmt.month(day)) : "";
  const selected = selectedDay ?? today ?? "";
  const selectedEvents = (q.data?.events ?? []).filter((e) => e.day === selected);
  const Prev = language === "ar" ? ChevronRight : ChevronLeft;
  const Next = language === "ar" ? ChevronLeft : ChevronRight;

  const views: { key: View; label: string }[] = [{ key: "month", label: t("cal.month") }, { key: "week", label: t("cal.week") }, { key: "timeline", label: t("cal.timeline") }];

  return (
    <div className="flex-1 overflow-auto bg-muted/50">
      <Header title={t("nav.calendar")} subtitle={t("cal.subtitle")} />
      <div className="space-y-4 p-3 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label={t("cal.prev")} data-testid="cal-prev"><Prev className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => step(1)} aria-label={t("cal.next")} data-testid="cal-next"><Next className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => { setAnchor(null); setSelectedDay(null); }} data-testid="cal-today">{t("cal.today")}</Button>
          </div>
          <h2 className="min-w-0 flex-1 text-lg font-semibold" data-testid="cal-heading">{heading}</h2>
          {isAdmin && (
            <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label={t("cal.scope")}>
              {(["me", "team"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={scope === s} onClick={() => chooseScope(s)} data-testid={`cal-scope-${s}`}
                  className={cn("rounded-md px-3 py-2 text-sm transition-colors", scope === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                  {t(s === "me" ? "cal.mine" : "cal.team")}
                </button>
              ))}
            </div>
          )}
          <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label={t("cal.view")}>
            {views.map((v) => (
              <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => choose(v.key)} data-testid={`cal-view-${v.key}`}
                className={cn("rounded-md px-3 py-2 text-sm transition-colors", view === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label={t("cal.filter")}>
          {TYPES.map((ty) => {
            const Icon = ICON[ty];
            const on = !off.has(ty);
            return (
              <button key={ty} type="button" aria-pressed={on} data-testid={`cal-filter-${ty}`}
                onClick={() => setOff((prev) => { const n = new Set(prev); on ? n.add(ty) : n.delete(ty); return n; })}
                className={cn("flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors", on ? `${TONE[ty]} border-transparent` : "border-border bg-card text-muted-foreground line-through")}>
                <Icon className="h-3.5 w-3.5" />{t(`cal.type.${ty}`)}
              </button>
            );
          })}
          {q.isFetching && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" aria-label={t("common.loading")} />}
        </div>

        {q.isError && <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">{t("cal.error")}</p>}

        {day && (
          <div className={cn("grid gap-4", view !== "timeline" && view !== "week" && "lg:grid-cols-[1fr_20rem]")}>
            <div className="min-w-0 space-y-4">
              {view === "month" && <MonthView data={q.data} anchor={day} selected={selected} onSelect={setSelectedDay} fmt={fmt} />}
              {view === "week" && <WeekView data={q.data} anchor={day} selected={selected} onSelect={setSelectedDay} fmt={fmt} />}
              {view === "timeline" && <TimelineView data={q.data} anchor={day} fmt={fmt} />}
            </div>
            {view === "month" && selected && <DayDetails day={selected} events={selectedEvents} fmt={fmt} />}
          </div>
        )}
        {view === "week" && selected && selectedEvents.length > 0 && <DayDetails day={selected} events={selectedEvents} fmt={fmt} />}
      </div>
    </div>
  );
}
