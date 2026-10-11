import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency, formatCurrencyShort } from "@/lib/currency";
import { useOverview } from "./AttentionStrip";
import type { MonthPoint } from "./overview-types";

const W = 520;
const H = 190;
const PAD_TOP = 22;
const PAD_BOTTOM = 22;

function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

// Money received against money spent, month by month. Time runs left to right in both languages.
export function RevenueVsExpenses() {
  const { t, language } = useTranslation();
  const { data, isLoading } = useOverview();
  const [picked, setPicked] = useState<number | null>(null);
  const cash = data?.cashflow;
  if (!isLoading && !cash) return null;

  const months: MonthPoint[] = cash?.months ?? [];
  const monthLabel = (m: string) =>
    new Date(`${m}-15T12:00:00Z`).toLocaleDateString(language === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { month: "short", timeZone: "UTC" });
  const max = Math.max(1, ...months.flatMap((m) => [m.collected, m.spent]));
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotH;
  const slot = W / Math.max(1, months.length);
  const barW = Math.min(26, slot / 3);
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;
  const selected = picked !== null ? months[picked] : months[months.length - 1];
  const showSpent = cash?.hasSpent !== false;
  const describe = (m: MonthPoint) =>
    `${monthLabel(m.month)}: ${t("dash.cash.collected")} ${formatCurrency(m.collected)}${showSpent ? `, ${t("dash.cash.spent")} ${formatCurrency(m.spent)}, ${t("dash.cash.net")} ${formatCurrency(m.net)}` : ""}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("dash.cash.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("dash.cash.subtitle")}</p>
      </CardHeader>
      <CardContent>
        {isLoading || !cash ? (
          <Skeleton className="h-52 w-full" />
        ) : (
          <div dir="ltr">
            <div className="mb-1 flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums" dir={language === "ar" ? "rtl" : "ltr"} data-testid="cash-reading">{selected ? describe(selected) : ""}</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />{t("dash.cash.collected")}</span>
                {showSpent && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/45" aria-hidden />{t("dash.cash.spent")}</span>}
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("dash.cash.title")}>
              <line x1="0" x2={W} y1={baseline} y2={baseline} className="stroke-border" strokeWidth="1" />
              {months.map((m, i) => {
                const cx = i * slot + slot / 2;
                const active = (picked ?? months.length - 1) === i;
                const gap = 3;
                const hC = Math.max(m.collected > 0 ? 3 : 0, (m.collected / max) * plotH);
                const hS = Math.max(m.spent > 0 ? 3 : 0, (m.spent / max) * plotH);
                return (
                  <g key={m.month}>
                    <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" className="cursor-pointer" onClick={() => setPicked(picked === i ? null : i)} />
                    {m.collected > 0 && <path d={barPath(showSpent ? cx - barW - gap / 2 : cx - barW / 2, baseline - hC, barW, hC, 4)} className={cn("fill-primary transition-opacity", !active && "opacity-45")} />}
                    {showSpent && m.spent > 0 && <path d={barPath(cx + gap / 2, baseline - hS, barW, hS, 4)} className={cn("fill-muted-foreground transition-opacity", active ? "opacity-60" : "opacity-30")} />}
                    {active && m.collected > 0 && (
                      <text x={showSpent ? cx - barW / 2 - gap / 2 : cx} y={y(m.collected) - 5} textAnchor="middle" className="fill-foreground text-[10px] font-semibold tabular-nums">{formatCurrencyShort(m.collected)}</text>
                    )}
                    <text x={cx} y={H - 6} textAnchor="middle" className={cn("text-[11px]", active ? "fill-foreground font-semibold" : "fill-muted-foreground")}>{monthLabel(m.month)}</text>
                  </g>
                );
              })}
            </svg>
            <table className="sr-only">
              <caption>{t("dash.cash.title")}</caption>
              <tbody>{months.map((m) => <tr key={m.month}><th scope="row">{monthLabel(m.month)}</th><td>{describe(m)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
