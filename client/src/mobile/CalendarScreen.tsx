import { useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckSquare, ChevronLeft, ChevronRight, FileText, FolderKanban, Receipt, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/hooks/usePermissions";
import { addDays, groupByDay, weekDays } from "@/lib/calendar-logic";
import { ListState, Segmented } from "./ui";

interface CalEvent { type: "task" | "invoice" | "quotation" | "project"; id: string; day: string; title: string; subtitle?: string; state?: "late" | "done" | "open"; href: string; mark?: "start" | "due" }
interface CalData { today: string; events: CalEvent[] }

const ICON: Record<CalEvent["type"], LucideIcon> = { task: CheckSquare, invoice: Receipt, quotation: FileText, project: FolderKanban };
const TONE: Record<CalEvent["type"], string> = { task: "bg-primary/10 text-primary", invoice: "bg-warning-soft text-warning", quotation: "bg-accent text-accent-foreground", project: "bg-success/10 text-success" };

// The phone's calendar: one week as a list of days (a month grid is too narrow here)
export default function CalendarScreen() {
  const { t, language } = useTranslation();
  const { isAdmin } = usePermissions();
  const [, navigate] = useLocation();
  const [scope, setScope] = useState<"me" | "team">("me");
  const [anchor, setAnchor] = useState<string | null>(null);
  const weekStart = language === "ar" ? 6 : 0;
  const locale = language === "ar" ? "ar-EG" : "en-US";

  const todayQ = useQuery<{ today: string }>({ queryKey: ["calendar-today"], queryFn: async () => (await apiRequest("GET", "/api/calendar?from=2000-01-01&to=2000-01-01&types=none")).json(), staleTime: 60 * 60 * 1000 });
  const base = anchor ?? todayQ.data?.today ?? null;
  const days = base ? weekDays(base, weekStart) : [];
  const effective = isAdmin ? scope : "me";
  const q = useQuery<CalData>({
    queryKey: ["/api/calendar", days[0], days[6], effective, "mobile"],
    enabled: days.length === 7,
    queryFn: async () => (await apiRequest("GET", `/api/calendar?from=${days[0]}&to=${days[6]}&scope=${effective}`)).json(),
    staleTime: 0,
  });

  const at = (d: string) => new Date(`${d}T12:00:00Z`);
  const fmtDay = (d: string) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(at(d));
  const fmtShort = (d: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(at(d));
  const by = groupByDay(q.data?.events ?? []);
  const Prev = language === "ar" ? ChevronRight : ChevronLeft;
  const Next = language === "ar" ? ChevronLeft : ChevronRight;
  const total = q.data?.events.length ?? 0;

  return (
    <div className="space-y-4 p-4 pb-24" data-testid="m-calendar">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/m")} aria-label={t("m.back")} className="flex h-11 w-11 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />
        </button>
        <h2 className="flex-1 text-xl font-semibold">{t("nav.calendar")}</h2>
        <button onClick={() => setAnchor(null)} className="h-11 rounded-full border border-border px-4 text-sm font-medium">{t("cal.today")}</button>
      </div>

      {isAdmin && <Segmented value={scope} onChange={setScope} options={[{ value: "me", label: t("cal.mine") }, { value: "team", label: t("cal.team") }]} />}

      <div className="flex items-center justify-between">
        <button onClick={() => base && setAnchor(addDays(base, -7))} aria-label={t("cal.prev")} className="flex h-11 w-11 items-center justify-center rounded-full border border-border"><Prev className="h-5 w-5" /></button>
        <p className="text-sm font-medium" data-testid="m-cal-range">{days.length === 7 ? `${fmtShort(days[0])} – ${fmtShort(days[6])}` : ""}</p>
        <button onClick={() => base && setAnchor(addDays(base, 7))} aria-label={t("cal.next")} className="flex h-11 w-11 items-center justify-center rounded-full border border-border"><Next className="h-5 w-5" /></button>
      </div>

      <ListState loading={q.isLoading || todayQ.isLoading} error={q.isError} onRetry={() => q.refetch()} empty={false} emptyTitle="">
        {total === 0 && !q.isLoading && <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("cal.no_events_week")}</p>}
        <div className="space-y-3">
          {days.map((d) => {
            const list = by.get(d) ?? [];
            if (list.length === 0) return null;
            const isToday = d === q.data?.today;
            return (
              <section key={d} className="rounded-xl border border-border bg-card p-3">
                <h3 className={cn("mb-2 text-sm font-semibold", isToday && "text-primary")}>{fmtDay(d)}{isToday ? ` · ${t("cal.today")}` : ""}</h3>
                <ul className="space-y-1.5">
                  {list.map((e) => {
                    const Icon = ICON[e.type];
                    const kind = e.type === "project" ? t(e.mark === "start" ? "cal.project_start" : "cal.project_due") : t(`cal.kind.${e.type}`);
                    return (
                      <li key={`${e.type}-${e.id}-${e.mark ?? ""}`}>
                        <Link href={e.href} className="flex min-h-12 items-center gap-2.5 rounded-lg px-1.5 py-1 active:bg-accent">
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", TONE[e.type])}><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span dir="auto" className={cn("block truncate text-sm font-medium", e.state === "done" && "line-through opacity-70")}>{e.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{[kind, e.subtitle].filter(Boolean).join(" · ")}</span>
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
          })}
        </div>
      </ListState>
    </div>
  );
}
