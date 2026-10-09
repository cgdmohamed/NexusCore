import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Printer, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { format } from "@/lib/dateUtils";
import { describeEntry, methodLabel, statementToCsv, type StatementData } from "@/lib/statement";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function presets() {
  const now = new Date();
  const ago = new Date(now);
  ago.setDate(ago.getDate() - 90);
  return {
    all: { from: "", to: "" },
    thisMonth: { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: "" },
    last90: { from: iso(ago), to: "" },
    thisYear: { from: `${now.getFullYear()}-01-01`, to: "" },
  };
}

// Positive: the client owes us. Negative: we hold credit for them.
function BalanceLabel({ value }: { value: number }) {
  const { t } = useTranslation();
  if (value === 0) return <span className="text-xs text-muted-foreground">{t("stmt.settled")}</span>;
  return <span className="text-xs text-muted-foreground">{value > 0 ? t("stmt.owes") : t("stmt.in_credit")}</span>;
}

export function ClientStatement({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const [range, setRange] = useState({ from: "", to: "" });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    return p.toString();
  }, [range]);

  const { data, isLoading, isError } = useQuery<StatementData>({
    queryKey: [`/api/clients/${clientId}/statement${query ? `?${query}` : ""}`],
  });

  const quick = presets();
  const isActive = (p: { from: string; to: string }) => p.from === range.from && p.to === range.to;

  const downloadCsv = () => {
    if (!data) return;
    const blob = new Blob([statementToCsv(data, t)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement-${data.client.name.replace(/[^\w؀-ۿ-]+/g, "_")}-${iso(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printHref = `/clients/${clientId}/statement/print${query ? `?${query}` : ""}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="stmt-from">{t("stmt.from")}</Label>
            <Input id="stmt-from" type="date" className="h-9 w-40" value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stmt-to">{t("stmt.to")}</Label>
            <Input id="stmt-to" type="date" className="h-9 w-40" value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([["all", "stmt.all_time"], ["thisMonth", "stmt.this_month"], ["last90", "stmt.last_90"], ["thisYear", "stmt.this_year"]] as const).map(([k, label]) => (
              <Button key={k} type="button" size="sm" variant={isActive(quick[k]) ? "secondary" : "ghost"} className="h-9" onClick={() => setRange(quick[k])}>
                {t(label)}
              </Button>
            ))}
          </div>
          <div className="ms-auto flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 gap-2" onClick={downloadCsv} disabled={!data}>
              <Download className="h-4 w-4" />
              {t("stmt.csv")}
            </Button>
            <a href={printHref} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" className="h-9 gap-2">
                <Printer className="h-4 w-4" />
                {t("stmt.print")}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {isLoading && <Skeleton className="h-64 w-full" />}
      {isError && <p className="py-8 text-center text-sm text-danger">{t("stmt.error")}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{t("stmt.outstanding")}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(data.position.outstanding)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{t("stmt.overdue")}</p>
                <p className={`mt-1 text-xl font-semibold tabular-nums ${data.position.overdue > 0 ? "text-danger" : ""}`}>{formatCurrency(data.position.overdue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{t("stmt.credit_held")}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(data.position.creditBalance)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{t("stmt.closing_balance")}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(data.totals.closingBalance)}</p>
                <BalanceLabel value={data.totals.closingBalance} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="whitespace-nowrap px-4 py-2.5 text-start font-medium">{t("stmt.date")}</th>
                      <th className="px-4 py-2.5 text-start font-medium">{t("stmt.description")}</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-end font-medium">{t("stmt.debit")}</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-end font-medium">{t("stmt.credit")}</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-end font-medium">{t("stmt.balance")}</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.period.from && (
                      <tr className="border-b border-border bg-muted/40">
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5 font-medium">{t("stmt.opening_balance")}</td>
                        <td /><td />
                        <td className="whitespace-nowrap px-4 py-2.5 text-end font-medium">{formatCurrency(data.openingBalance)}</td>
                      </tr>
                    )}
                    {data.entries.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{t("stmt.empty")}</td></tr>
                    )}
                    {data.entries.map((e, i) => {
                      const detail = [methodLabel(e.method, t), e.reference && e.reference !== e.invoiceNumber ? e.reference : ""].filter(Boolean).join(" · ");
                      const memo = e.kind === "credit_applied";
                      return (
                        <tr key={i} className={`border-b border-border last:border-0 ${memo ? "text-muted-foreground" : ""}`}>
                          <td className="whitespace-nowrap px-4 py-2.5">{format(e.date, "dd/MM/yyyy")}</td>
                          <td className="px-4 py-2.5">
                            {e.invoiceId ? (
                              <Link href={`/invoices/${e.invoiceId}`} className="hover:underline">{describeEntry(e, t)}</Link>
                            ) : (
                              describeEntry(e, t)
                            )}
                            {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
                            {e.overpayment > 0 && <span className="block text-xs text-muted-foreground">{t("stmt.overpayment_note", { n: formatCurrency(e.overpayment) })}</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-end">{e.debit ? formatCurrency(e.debit) : ""}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-end">{e.credit ? formatCurrency(e.credit) : ""}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-end font-medium">{formatCurrency(e.balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {data.entries.length > 0 && (
                    <tfoot className="tabular-nums">
                      <tr className="border-t border-border bg-muted/40 font-medium">
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5">{t("stmt.totals")}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-end">{formatCurrency(data.totals.billed + data.totals.refunded)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-end">{formatCurrency(data.totals.received)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-end">{formatCurrency(data.totals.closingBalance)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">{t("stmt.positive_note")} {t("stmt.currency_note")}.</p>
        </>
      )}
    </div>
  );
}
