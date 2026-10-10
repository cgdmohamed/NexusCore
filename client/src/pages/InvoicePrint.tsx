import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { format } from "@/lib/dateUtils";
import { formatDisplay, isIncludedItem, snapshotCompany, CURRENCY_SYMBOLS } from "@/lib/print-format";
import {
  Amount, DocFooter, DocHeader, DocTable, Note, Party, PrintMessage, PrintPage, TextBlock, Totals, rowStyle, td, useAutoPrint,
} from "@/components/print/PrintDocument";

// The reference template for every printed document: quotation and client statement are built from the same parts
export default function InvoicePrint() {
  const { printRecordId } = useParams<{ printRecordId: string }>();
  const { t } = useTranslation();

  const { data: record, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/invoice-print-records/${printRecordId}`],
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

  const displayTotal = parseFloat(snap.displayTotal || "0");
  const displayPaid = parseFloat(snap.displayPaidAmount || "0");
  const balanceDue = Math.max(0, displayTotal - displayPaid);

  const meta: [string, React.ReactNode][] = [[t("doc.invoice_no"), snap.invoiceNumber]];
  if (snap.invoiceDate) meta.push([t("doc.invoice_date"), date(snap.invoiceDate)]);
  if (snap.dueDate) meta.push([t("doc.due_date"), date(snap.dueDate)]);
  if (snap.title) meta.push([t("doc.subject"), snap.title]);

  return (
    <PrintPage>
      <DocHeader company={company} title={t("doc.invoice")} meta={meta} status={snap.status} />

      {currency !== "EGP" && (
        <Note>{t("doc.rate_note", { cur: currency, rate: rate.toFixed(2), symbol: CURRENCY_SYMBOLS[currency] || currency })}</Note>
      )}

      <Party label={t("doc.bill_to")} name={snap.clientName} lines={[snap.clientEmail, snap.clientPhone, snap.clientAddress]} />

      <DocTable columns={[
        { label: t("doc.description") },
        { label: t("doc.quantity"), align: "end" },
        { label: t("doc.unit_price"), align: "end" },
        { label: t("doc.total"), align: "end" },
      ]}>
        {(snap.items || []).map((item: any, idx: number) => {
          const included = isIncludedItem(item);
          return (
            <tr key={idx} style={rowStyle(idx)}>
              <td style={td()}>
                <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{item.name || item.description}</div>
                {item.name && item.description && item.description !== item.name && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{item.description}</div>}
              </td>
              <td style={td("end")}>{item.quantity}</td>
              <td style={td("end")}>{included ? t("doc.included") : money(item.displayUnitPrice)}</td>
              <td style={td("end", true)}>{included ? t("doc.included") : money(item.displayTotalPrice)}</td>
            </tr>
          );
        })}
      </DocTable>

      <Totals
        before={[
          { label: t("doc.subtotal"), value: money(snap.displaySubtotal) },
          ...(parseFloat(snap.displayDiscountAmount || "0") > 0 ? [{ label: t("doc.discount"), value: <>− {money(snap.displayDiscountAmount)}</> }] : []),
          ...(parseFloat(snap.displayTaxAmount || "0") > 0 ? [{ label: `${t("doc.vat")}${snap.taxRate ? ` (${snap.taxRate}%)` : ""}`, value: <>+ {money(snap.displayTaxAmount)}</> }] : []),
        ]}
        total={{ label: t("doc.total"), value: money(displayTotal) }}
        after={[
          { label: t("doc.paid"), value: money(displayPaid), tone: "good" },
          { label: t("doc.balance_due"), value: money(balanceDue), tone: balanceDue > 0 ? "bad" : "good", big: true },
        ]}
      />

      <TextBlock label={t("doc.notes")} text={snap.notes} />
      <TextBlock label={t("doc.payment_terms")} text={snap.paymentTerms} />

      {snap.qrCodeImage && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
          <img src={snap.qrCodeImage} alt="QR Code" style={{ width: 100, height: 100, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 6, padding: 4 }} />
        </div>
      )}

      <DocFooter
        company={company}
        lines={[currency === "EGP" ? t("doc.footer_invoice_egp") : t("doc.footer_invoice_fx", { cur: currency, rate: rate.toFixed(2) })]}
      />
    </PrintPage>
  );
}
