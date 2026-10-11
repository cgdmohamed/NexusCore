import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardList, FileClock, Landmark, Receipt, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import type { OverviewData } from "./overview-types";

const ICONS: Record<string, typeof Receipt> = {
  overdue_invoices: Receipt,
  expiring_quotations: FileClock,
  unassigned_payments: Landmark,
  overdue_tasks: ClipboardList,
  pending_expenses: Wallet,
};
// Only what is late wears red; the rest are reminders
const URGENT = new Set(["overdue_invoices", "overdue_tasks"]);

export function useOverview() {
  const { isAuthenticated } = useAuth();
  return useQuery<OverviewData>({ queryKey: ["/api/dashboard/overview"], enabled: isAuthenticated, staleTime: 30_000 });
}

// What needs a person today, with the number and one click to the page that fixes it
export function AttentionStrip() {
  const { t } = useTranslation();
  const { data, isLoading } = useOverview();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[74px]" />)}
      </div>
    );
  }
  if (!data) return null;

  if (data.attention.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground" data-testid="attention-clear">
        <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.75} />
        {t("dash.att.clear")}
      </div>
    );
  }

  return (
    <section aria-label={t("dash.att.title")}>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <AlertTriangle className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        {t("dash.att.title")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {data.attention.map((a) => {
          const Icon = ICONS[a.key] ?? AlertTriangle;
          const urgent = URGENT.has(a.key) && a.count > 0;
          return (
            <Link key={a.key} href={a.href} data-testid={`attention-${a.key}`}>
              <Card className="h-full cursor-pointer transition-colors hover:bg-accent/40">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-2xl font-semibold tabular-nums ${urgent ? "text-danger" : "text-foreground"}`}>{a.count}</span>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  <p className="mt-1 text-xs font-medium text-foreground">{t(`dash.att.${a.key}`)}</p>
                  {a.amount !== undefined && <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{formatCurrency(a.amount)}</p>}
                  {a.secondary !== undefined && <p className="mt-0.5 text-xs text-muted-foreground">{t("dash.att.team_overdue", { n: String(a.secondary) })}</p>}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
