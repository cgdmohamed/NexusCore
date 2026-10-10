import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { format } from "@/lib/dateUtils";
import { describeEntry, methodLabel, type StatementData } from "@/lib/statement";
import { INK, MUTED, Amount, DocFooter, DocTable, DocHeader, Party, PrintMessage, PrintPage, SummaryTiles, rowStyle, td, useAutoPrint } from "@/components/print/PrintDocument";

// Same template as the invoice (see InvoicePrint): the ledger is its items table
export default function ClientStatementPrint() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const search = typeof window !== "undefined" ? window.location.search : "";

  const { data, isLoading, isError } = useQuery<StatementData>({
    queryKey: [`/api/clients/${id}/statement${search}`],
    enabled: !!id,
    retry: false,
  });
  useAutoPrint(!!data, 600);

  if (isLoading) return <PrintMessage>…</PrintMessage>;
  if (isError || !data) return <PrintMessage error>{t("stmt.error")}</PrintMessage>;

  const { company, client, entries, totals, position } = data;
  const fmtDate = (d: string) => format(d, "dd/MM/yyyy");
  const money = (v: number) => <Amount>{formatCurrency(v)}</Amount>;
  const period = data.period.from || data.period.to
    ? `${data.period.from ? fmtDate(data.period.from) : "…"} – ${data.period.to ? fmtDate(data.period.to) : fmtDate(data.generatedAt)}`
    : t("stmt.all_time");
  const clientLines = [client.address, [client.city, client.country].filter(Boolean).join(", "), [client.phone, client.email].filter(Boolean).join(" · ")];
  const cell = td();
  const num = { ...td("end"), whiteSpace: "nowrap" as const };

  return (
    <PrintPage>
      <DocHeader
        company={company}
        title={t("stmt.title")}
        meta={[[t("doc.quotation_date"), <Amount>{fmtDate(data.generatedAt)}</Amount>], [t("stmt.period"), <Amount>{period}</Amount>]]}
      />

      <Party label={t("stmt.client")} name={client.name} lines={clientLines} />

      <SummaryTiles tiles={[
        { label: t("stmt.outstanding"), value: money(position.outstanding) },
        { label: t("stmt.overdue"), value: money(position.overdue) },
        { label: t("stmt.credit_held"), value: money(position.creditBalance) },
        { label: t("stmt.closing_balance"), value: money(totals.closingBalance) },
      ]} />

      <DocTable columns={[
        { label: t("stmt.date") },
        { label: t("stmt.description") },
        { label: t("stmt.debit"), align: "end" },
        { label: t("stmt.credit"), align: "end" },
        { label: t("stmt.balance"), align: "end" },
      ]}>
        {data.period.from && (
          <tr style={rowStyle(0)}>
            <td style={cell} /><td style={{ ...cell, fontWeight: 600 }}>{t("stmt.opening_balance")}</td><td style={cell} /><td style={cell} />
            <td style={{ ...num, fontWeight: 600 }}>{money(data.openingBalance)}</td>
          </tr>
        )}
        {entries.map((e, i) => {
          const detail = [methodLabel(e.method, t), e.reference && e.reference !== e.invoiceNumber ? e.reference : ""].filter(Boolean).join(" · ");
          return (
            <tr key={i} style={{ ...rowStyle(i), color: e.kind === "credit_applied" ? MUTED : undefined }}>
              <td style={{ ...cell, whiteSpace: "nowrap" }}><Amount>{fmtDate(e.date)}</Amount></td>
              <td style={cell}>
                {describeEntry(e, t)}
                {detail && <div style={{ color: MUTED, fontSize: 11 }}>{detail}</div>}
                {e.overpayment > 0 && <div style={{ color: MUTED, fontSize: 11 }}>{t("stmt.overpayment_note", { n: formatCurrency(e.overpayment) })}</div>}
              </td>
              <td style={num}>{e.debit ? money(e.debit) : ""}</td>
              <td style={num}>{e.credit ? money(e.credit) : ""}</td>
              <td style={{ ...num, fontWeight: 600 }}>{money(e.balance)}</td>
            </tr>
          );
        })}
        {entries.length === 0 && <tr><td colSpan={5} style={{ ...cell, textAlign: "center", color: MUTED, padding: 24 }}>{t("stmt.empty")}</td></tr>}
        {entries.length > 0 && (
          <tr style={{ fontWeight: 700, background: "#f3f4f6", borderTop: `2px solid ${INK}` }}>
            <td style={cell} /><td style={{ ...cell, fontWeight: 700 }}>{t("stmt.totals")}</td>
            <td style={{ ...num, fontWeight: 700 }}>{money(totals.billed + totals.refunded)}</td>
            <td style={{ ...num, fontWeight: 700 }}>{money(totals.received)}</td>
            <td style={{ ...num, fontWeight: 700 }}>{money(totals.closingBalance)}</td>
          </tr>
        )}
      </DocTable>

      <DocFooter company={company} lines={[`${t("stmt.positive_note")} ${t("stmt.currency_note")}.`]} />
    </PrintPage>
  );
}
