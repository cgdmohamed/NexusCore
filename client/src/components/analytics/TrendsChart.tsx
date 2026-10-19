import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { TrendingUp } from "lucide-react";

export interface TrendPoint { period: string; collected: number; spent: number; net: number }

// 1,250 -> 1.3k, 2,400,000 -> 2.4M, so the axis labels stay short enough to fit
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  const trim = (v: number) => String(Math.round(v * 10) / 10);
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}k`;
  return String(Math.round(n));
}

// "2026-10" -> "Oct 26" / "أكتوبر 26", "2026-Q4" -> "Q4 26" / "ر4 26"
export function periodLabel(period: string, language: "ar" | "en"): string {
  const q = period.match(/^(\d{4})-Q(\d)$/);
  if (q) return `${language === "ar" ? "ر" : "Q"}${q[2]} ${q[1].slice(2)}`;
  const [y, m] = period.split("-");
  const name = new Date(`${y}-${m}-15T12:00:00Z`).toLocaleDateString(language === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { month: "short", timeZone: "UTC" });
  return `${name} ${y.slice(2)}`;
}

const COLLECTED = "hsl(var(--chart-1))";
const SPENT = "hsl(var(--chart-4))";

export function TrendsChart({ points }: { points: TrendPoint[] }) {
  const { t, language } = useTranslation();
  const lang = language === "ar" ? "ar" : "en";
  const hasData = points.some((p) => p.collected !== 0 || p.spent !== 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("an.trend_title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("an.trend_sub")}</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
            <TrendingUp className="h-10 w-10 opacity-40" />
            <p className="text-sm">{t("an.no_data")}</p>
          </div>
        ) : (
          <div dir="ltr">
            <div className="mb-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLLECTED }} aria-hidden />{t("dash.cash.collected")}</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SPENT }} aria-hidden />{t("dash.cash.spent")}</span>
            </div>
            <div className="h-72" role="img" aria-label={t("an.trend_title")}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tickFormatter={(p) => periodLabel(String(p), lang)} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval="preserveStartEnd" minTickGap={16} padding={{ left: 24, right: 24 }} />
                  <YAxis width={52} domain={[0, "auto"]} tickCount={5} tickFormatter={(v) => compactNumber(Number(v))} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))" }}
                    content={({ active, payload, label }) => {
                      const p = payload?.[0]?.payload as TrendPoint | undefined;
                      if (!active || !p) return null;
                      return (
                        <div dir={language === "ar" ? "rtl" : "ltr"} className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
                          <p className="mb-1 font-semibold text-foreground">{periodLabel(String(label), lang)}</p>
                          <p className="tabular-nums text-muted-foreground">{t("dash.cash.collected")}: <span className="font-medium text-foreground">{formatCurrency(p.collected)}</span></p>
                          <p className="tabular-nums text-muted-foreground">{t("dash.cash.spent")}: <span className="font-medium text-foreground">{formatCurrency(p.spent)}</span></p>
                          <p className="tabular-nums text-muted-foreground">{t("dash.cash.net")}: <span className="font-medium text-foreground">{formatCurrency(p.net)}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Line type="linear" dataKey="collected" stroke={COLLECTED} strokeWidth={2} dot={{ r: 3, fill: COLLECTED, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                  <Line type="linear" dataKey="spent" stroke={SPENT} strokeWidth={2} dot={{ r: 3, fill: SPENT, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>{t("an.trend_title")}</caption>
              <thead><tr><th>{t("an.period")}</th><th>{t("dash.cash.collected")}</th><th>{t("dash.cash.spent")}</th><th>{t("dash.cash.net")}</th></tr></thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.period}><th scope="row">{periodLabel(p.period, lang)}</th><td>{formatCurrency(p.collected)}</td><td>{formatCurrency(p.spent)}</td><td>{formatCurrency(p.net)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
