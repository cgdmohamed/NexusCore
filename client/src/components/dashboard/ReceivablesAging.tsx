import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { useOverview } from "./AttentionStrip";
import type { AgingData } from "./overview-types";

const ORDER = ["notDue", "d1_30", "d31_60", "d61_90", "d90plus"] as const;
// One hue deepening with age; "not yet due" stays neutral because it is not a problem
const FILL: Record<(typeof ORDER)[number], string> = {
  notDue: "bg-muted-foreground/25",
  d1_30: "bg-danger/25",
  d31_60: "bg-danger/45",
  d61_90: "bg-danger/70",
  d90plus: "bg-danger",
};

export function ReceivablesAging() {
  const { t } = useTranslation();
  const { data, isLoading } = useOverview();
  const aging: AgingData | undefined = data?.aging;
  if (!isLoading && !aging) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("dash.aging.title")}</CardTitle>
        {aging && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("dash.aging.summary", { total: formatCurrency(aging.total), late: formatCurrency(aging.overdueAmount) })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !aging ? (
          <Skeleton className="h-40 w-full" />
        ) : aging.total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("dash.aging.empty")}</p>
        ) : (
          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={t("dash.aging.title")} dir="ltr">
              {ORDER.map((k) => {
                const pct = (aging.buckets[k].amount / aging.total) * 100;
                return pct > 0 ? <div key={k} className={FILL[k]} style={{ width: `${pct}%` }} /> : null;
              })}
            </div>

            <ul className="space-y-1.5 text-sm">
              {ORDER.map((k) => (
                <li key={k} className="flex items-center justify-between gap-3" data-testid={`aging-${k}`}>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${FILL[k]}`} aria-hidden />
                    {t(`dash.aging.${k}`)}
                    <span className="text-xs tabular-nums">({aging.buckets[k].count})</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatCurrency(aging.buckets[k].amount)}</span>
                </li>
              ))}
            </ul>

            {aging.topDebtors.length > 0 && (
              <div>
                <p className="mb-1.5 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("dash.aging.debtors")}</p>
                <ul className="space-y-1.5">
                  {aging.topDebtors.map((d) => (
                    <li key={d.clientId ?? d.name} className="flex items-center justify-between gap-3 text-sm">
                      {d.clientId ? (
                        <Link href={`/clients/${d.clientId}`} className="min-w-0 truncate hover:text-primary">{d.name}</Link>
                      ) : (
                        <span className="min-w-0 truncate">{d.name}</span>
                      )}
                      <span className="flex shrink-0 items-center gap-2">
                        {d.oldestDaysPastDue > 0 && <span className="text-xs text-danger tabular-nums">{t("dash.aging.days_late", { n: String(d.oldestDaysPastDue) })}</span>}
                        <span className="font-medium tabular-nums">{formatCurrency(d.outstanding)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
