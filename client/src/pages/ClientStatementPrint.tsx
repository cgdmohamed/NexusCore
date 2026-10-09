import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { format } from "@/lib/dateUtils";
import { describeEntry, methodLabel, type StatementData } from "@/lib/statement";

// Printed documents use fixed light colours so they look the same on screen, on paper and as PDF
export default function ClientStatementPrint() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useTranslation();
  const search = typeof window !== "undefined" ? window.location.search : "";

  const { data, isLoading, isError } = useQuery<StatementData>({
    queryKey: [`/api/clients/${id}/statement${search}`],
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, [data]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">…</div>;
  if (isError || !data) return <div className="flex min-h-screen items-center justify-center text-sm text-red-600">{t("stmt.error")}</div>;

  const { company, client, entries, totals, position } = data;
  const fmtDate = (d: string) => format(d, "dd/MM/yyyy");
  const period = data.period.from || data.period.to
    ? `${data.period.from ? fmtDate(data.period.from) : "…"} – ${data.period.to ? fmtDate(data.period.to) : fmtDate(data.generatedAt)}`
    : t("stmt.all_time");
  const cell: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const num: React.CSSProperties = { ...cell, textAlign: "end", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const head: React.CSSProperties = { padding: "6px 8px", borderBottom: "2px solid #111827", fontWeight: 600, fontSize: 11, color: "#374151" };

  return (
    <div dir={language === "ar" ? "rtl" : "ltr"} style={{ background: "#fff", color: "#111827", maxWidth: 820, margin: "0 auto", padding: 32, fontSize: 12, lineHeight: 1.5 }}>
      <style>{`@page { size: A4; margin: 14mm; } body { background: #fff !important; }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{company.name}</div>
          {company.address && <div>{company.address}</div>}
          {(company.phone || company.email) && <div><bdi dir="ltr">{[company.phone, company.email].filter(Boolean).join(" · ")}</bdi></div>}
          {(company.vatNumber || company.regNumber) && (
            <div style={{ color: "#6b7280" }}>
              {company.vatNumber && <>{t("stmt.company_vat")} <bdi dir="ltr">{company.vatNumber}</bdi> </>}
              {company.regNumber && <>{t("stmt.company_reg")} <bdi dir="ltr">{company.regNumber}</bdi></>}
            </div>
          )}
        </div>
        <div style={{ textAlign: "end" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t("stmt.title")}</div>
          <div style={{ color: "#6b7280" }}>{t("stmt.generated", { date: fmtDate(data.generatedAt) })}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 20, padding: 12, border: "1px solid #e5e7eb", borderRadius: 6 }}>
        <div>
          <div style={{ color: "#6b7280", fontSize: 11 }}>{t("stmt.client")}</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{client.name}</div>
          {[client.address, [client.city, client.country].filter(Boolean).join(", ")].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
          {(client.phone || client.email) && <div><bdi dir="ltr">{[client.phone, client.email].filter(Boolean).join(" · ")}</bdi></div>}
        </div>
        <div style={{ textAlign: "end" }}>
          <div style={{ color: "#6b7280", fontSize: 11 }}>{t("stmt.period")}</div>
          <div style={{ fontWeight: 600 }}><bdi dir="ltr">{period}</bdi></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          [t("stmt.outstanding"), position.outstanding],
          [t("stmt.overdue"), position.overdue],
          [t("stmt.credit_held"), position.creditBalance],
          [t("stmt.closing_balance"), totals.closingBalance],
        ].map(([label, value]) => (
          <div key={label as string} style={{ flex: 1, padding: 10, border: "1px solid #e5e7eb", borderRadius: 6 }}>
            <div style={{ color: "#6b7280", fontSize: 11 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>{formatCurrency(value as number)}</div>
          </div>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: "start" }}>{t("stmt.date")}</th>
            <th style={{ ...head, textAlign: "start" }}>{t("stmt.description")}</th>
            <th style={{ ...head, textAlign: "end" }}>{t("stmt.debit")}</th>
            <th style={{ ...head, textAlign: "end" }}>{t("stmt.credit")}</th>
            <th style={{ ...head, textAlign: "end" }}>{t("stmt.balance")}</th>
          </tr>
        </thead>
        <tbody>
          {data.period.from && (
            <tr style={{ background: "#f9fafb" }}>
              <td style={cell} /><td style={{ ...cell, fontWeight: 600 }}>{t("stmt.opening_balance")}</td><td style={cell} /><td style={cell} />
              <td style={{ ...num, fontWeight: 600 }}>{formatCurrency(data.openingBalance)}</td>
            </tr>
          )}
          {entries.map((e, i) => {
            const detail = [methodLabel(e.method, t), e.reference && e.reference !== e.invoiceNumber ? e.reference : ""].filter(Boolean).join(" · ");
            return (
              <tr key={i} style={{ breakInside: "avoid", color: e.kind === "credit_applied" ? "#6b7280" : undefined }}>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                <td style={cell}>
                  {describeEntry(e, t)}
                  {detail && <div style={{ color: "#6b7280", fontSize: 11 }}>{detail}</div>}
                  {e.overpayment > 0 && <div style={{ color: "#6b7280", fontSize: 11 }}>{t("stmt.overpayment_note", { n: formatCurrency(e.overpayment) })}</div>}
                </td>
                <td style={num}>{e.debit ? formatCurrency(e.debit) : ""}</td>
                <td style={num}>{e.credit ? formatCurrency(e.credit) : ""}</td>
                <td style={{ ...num, fontWeight: 600 }}>{formatCurrency(e.balance)}</td>
              </tr>
            );
          })}
          {entries.length === 0 && <tr><td colSpan={5} style={{ ...cell, textAlign: "center", color: "#6b7280", padding: 24 }}>{t("stmt.empty")}</td></tr>}
        </tbody>
        {entries.length > 0 && (
          <tfoot>
            <tr style={{ fontWeight: 700, background: "#f3f4f6" }}>
              <td style={cell} /><td style={cell}>{t("stmt.totals")}</td>
              <td style={num}>{formatCurrency(totals.billed + totals.refunded)}</td>
              <td style={num}>{formatCurrency(totals.received)}</td>
              <td style={num}>{formatCurrency(totals.closingBalance)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      <div style={{ marginTop: 16, color: "#6b7280", fontSize: 11 }}>{t("stmt.positive_note")} {t("stmt.currency_note")}.</div>
    </div>
  );
}
