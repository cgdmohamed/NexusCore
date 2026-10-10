import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { format } from "@/lib/dateUtils";
import { formatDisplay, isIncludedItem, snapshotCompany, CURRENCY_SYMBOLS } from "@/lib/print-format";
import {
  Amount, DocFooter, DocHeader, DocTable, Note, Party, PrintMessage, PrintPage, TextBlock, Totals, rowStyle, td, useAutoPrint,
} from "@/components/print/PrintDocument";

// Same template as the invoice (see InvoicePrint): only the columns and the wording differ
export default function QuotationPrint() {
  const { printRecordId } = useParams<{ printRecordId: string }>();
  const { t } = useTranslation();

  const { data: record, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/quotation-print-records/${printRecordId}`],
    enabled: !!printRecordId,
    retry: false,
  });
  useAutoPrint(!!record?.printSnapshotJson);

  if (isLoading) return <PrintMessage>{t("doc.loading")}</PrintMessage>;
  if (isError || !record) return <PrintMessage error>{t("doc.not_found")}</PrintMessage>;

  const snap = record.printSnapshotJson as any;
  const currency = snap.displayCurrency || "EGP";
  const rate = parseFloat(snap.exchangeRate || "1");
  const company = snapshotCompany(snap);
  const money = (v: unknown) => <Amount>{formatDisplay(parseFloat(String(v || "0")), currency)}</Amount>;
  const date = (d: string) => <Amount>{format(d, "dd/MM/yyyy")}</Amount>;

  const meta: [string, React.ReactNode][] = [[t("doc.quotation_no"), snap.quotationNumber]];
  if (snap.createdAt) meta.push([t("doc.quotation_date"), date(snap.createdAt)]);
  if (snap.validUntil) meta.push([t("doc.valid_until"), date(snap.validUntil)]);
  if (snap.title) meta.push([t("doc.subject"), snap.title]);

  return (
    <PrintPage>
      <DocHeader company={company} title={t("doc.quotation")} meta={meta} status={snap.status} />

      <Note>
        {currency === "EGP"
          ? t("doc.egp_note")
          : t("doc.rate_note", { cur: currency, rate: rate.toFixed(2), symbol: CURRENCY_SYMBOLS[currency] || currency })}
      </Note>

      <Party label={t("doc.bill_to")} name={snap.clientName} lines={[snap.clientEmail, snap.clientPhone, snap.clientAddress]} />

      {snap.description && <TextBlock label={t("doc.description")} text={snap.description} />}

      <DocTable columns={[
        { label: t("doc.description") },
        { label: t("doc.quantity"), align: "end" },
        { label: t("doc.unit_price"), align: "end" },
        { label: t("doc.discount_pct"), align: "end" },
        { label: t("doc.total"), align: "end" },
      ]}>
        {(snap.items || []).map((item: any, idx: number) => {
          const included = isIncludedItem(item);
          return (
            <tr key={idx} style={rowStyle(idx)}>
              <td style={td()}><div style={{ fontWeight: 600, color: "#1a1a2e" }}>{item.description}</div></td>
              <td style={td("end")}>{item.quantity}</td>
              <td style={td("end")}>{included ? t("doc.included") : money(item.displayUnitPrice)}</td>
              <td style={td("end")}><Amount>{parseFloat(item.discount || "0").toFixed(1)}%</Amount></td>
              <td style={td("end", true)}>{included ? t("doc.included") : money(item.displayTotalPrice)}</td>
            </tr>
          );
        })}
      </DocTable>

      <Totals
        before={[
          { label: t("doc.subtotal"), value: money(snap.displaySubtotal || snap.displayTotal) },
          ...(parseFloat(snap.displayDiscountAmount || "0") > 0 ? [{ label: t("doc.discount"), value: <>− {money(snap.displayDiscountAmount)}</> }] : []),
          ...(parseFloat(snap.displayTaxAmount || "0") > 0 ? [{ label: `${t("doc.vat")}${snap.taxRate ? ` (${snap.taxRate}%)` : ""}`, value: <>+ {money(snap.displayTaxAmount)}</> }] : []),
        ]}
        total={{ label: t("doc.total"), value: money(snap.displayTotal) }}
      />

      <TextBlock label={t("doc.notes")} text={snap.notes} />
      <TextBlock label={t("doc.terms")} text={snap.terms} />

      <DocFooter
        company={company}
        lines={[currency === "EGP" ? t("doc.footer_quotation_egp") : t("doc.footer_quotation_fx", { cur: currency, rate: rate.toFixed(2) })]}
      />
    </PrintPage>
  );
}
