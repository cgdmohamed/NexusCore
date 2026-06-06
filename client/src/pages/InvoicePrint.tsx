import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

const CURRENCY_SYMBOLS: Record<string, string> = {
  EGP: "ج.م",
  USD: "$",
  SAR: "ر.س",
};

function formatDisplay(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency === "USD") return `${symbol}${formatted}`;
  return `${formatted} ${symbol}`;
}

function isIncludedItem(item: any): boolean {
  if (typeof item.isIncluded === "boolean") return item.isIncluded;
  return parseFloat(item.displayUnitPrice || item.egpUnitPrice || "0") === 0
    && parseFloat(item.displayTotalPrice || item.egpTotalPrice || "0") === 0
    && parseFloat(item.discount || "0") === 0;
}

const STATUS_BADGE_STYLES: Record<string, { background: string; color: string }> = {
  paid:               { background: "#dcfce7", color: "#15803d" },
  partially_paid:     { background: "#dbeafe", color: "#2563eb" },
  sent:               { background: "#e0f2fe", color: "#0369a1" },
  draft:              { background: "#f3f4f6", color: "#374151" },
  overdue:            { background: "#fee2e2", color: "#dc2626" },
  cancelled:          { background: "#f3f4f6", color: "#6b7280" },
  refunded:           { background: "#ede9fe", color: "#7c3aed" },
  partially_refunded: { background: "#fef3c7", color: "#d97706" },
};

export default function InvoicePrint() {
  const { printRecordId } = useParams<{ printRecordId: string }>();

  const { data: record, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/invoice-print-records/${printRecordId}`],
    enabled: !!printRecordId,
    retry: false,
  });

  useEffect(() => {
    if (record?.printSnapshotJson) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [record]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading print preview...</p>
      </div>
    );
  }

  if (isError || !record) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Print record not found.</p>
      </div>
    );
  }

  const snap = record.printSnapshotJson as any;
  const currency = snap.displayCurrency || "EGP";
  const rate = parseFloat(snap.exchangeRate || "1");
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const badgeStyle = STATUS_BADGE_STYLES[snap.status] || STATUS_BADGE_STYLES.draft;
  const displayTotal = parseFloat(snap.displayTotal || "0");
  const displayPaid = parseFloat(snap.displayPaidAmount || "0");
  const balanceDue = Math.max(0, displayTotal - displayPaid);
  const balanceColor = balanceDue > 0 ? "#dc2626" : "#16a34a";

  const companyName = snap.companyName || "CompanyOS";

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { margin: 1cm; }
        }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; }
      `}</style>

      <div className="no-print" style={{ background: "#fefce8", borderBottom: "1px solid #fde68a", color: "#92400e", padding: "8px 16px", fontSize: "13px", textAlign: "center" }}>
        Print dialog will open automatically. Use your browser&apos;s print settings to save as PDF.
      </div>

      <div style={{ padding: "48px", maxWidth: "900px", margin: "0 auto", background: "#fff" }}>

        {/* TWO-COLUMN HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "48px", paddingBottom: "32px", borderBottom: "3px solid #1a1a2e" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", maxWidth: "260px" }}>
            <img src="/assets/logo.png" alt={companyName} style={{ width: "72px", height: "72px", objectFit: "contain", marginBottom: "14px" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", marginBottom: "4px" }}>{companyName}</div>
            {snap.companyAddress && <div style={{ fontSize: "11.5px", color: "#6b7280", lineHeight: 1.7 }}>{snap.companyAddress}</div>}
            {snap.companyPhone && <div style={{ fontSize: "11.5px", color: "#6b7280", lineHeight: 1.7 }}>Tel: {snap.companyPhone}</div>}
            {snap.companyEmail && <div style={{ fontSize: "11.5px", color: "#6b7280", lineHeight: 1.7 }}>{snap.companyEmail}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "34px", fontWeight: 800, color: "#1a1a2e", letterSpacing: "3px", marginBottom: "18px" }}>INVOICE</div>
            <table style={{ marginLeft: "auto", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 0 4px 28px", fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap" }}>Invoice No.</td>
                  <td style={{ padding: "4px 0 4px 28px", fontSize: "12px", fontWeight: 600, color: "#1a1a2e" }}>{snap.invoiceNumber}</td>
                </tr>
                {snap.invoiceDate && (
                  <tr>
                    <td style={{ padding: "4px 0 4px 28px", fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap" }}>Invoice Date</td>
                    <td style={{ padding: "4px 0 4px 28px", fontSize: "12px", fontWeight: 600, color: "#1a1a2e" }}>{new Date(snap.invoiceDate).toLocaleDateString()}</td>
                  </tr>
                )}
                {snap.dueDate && (
                  <tr>
                    <td style={{ padding: "4px 0 4px 28px", fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap" }}>Due Date</td>
                    <td style={{ padding: "4px 0 4px 28px", fontSize: "12px", fontWeight: 600, color: "#1a1a2e" }}>{new Date(snap.dueDate).toLocaleDateString()}</td>
                  </tr>
                )}
                {snap.title && (
                  <tr>
                    <td style={{ padding: "4px 0 4px 28px", fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap" }}>Subject</td>
                    <td style={{ padding: "4px 0 4px 28px", fontSize: "12px", fontWeight: 600, color: "#1a1a2e" }}>{snap.title}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div style={{ marginTop: "14px" }}>
              <span style={{ display: "inline-block", padding: "5px 14px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", background: badgeStyle.background, color: badgeStyle.color }}>
                {(snap.status || "").toUpperCase().replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>

        {/* CURRENCY NOTE */}
        {currency !== "EGP" && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "10px 16px", marginBottom: "28px", fontSize: "12px", color: "#6b7280" }}>
            Exchange rate: 1 {currency} = {rate.toFixed(2)} EGP — Amounts shown in {currency} ({symbol})
          </div>
        )}

        {/* BILL TO */}
        <div style={{ marginBottom: "36px", padding: "20px 24px", background: "#f9fafb", borderLeft: "4px solid #1a1a2e", borderRadius: "0 6px 6px 0" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "#9ca3af", marginBottom: "8px" }}>Bill To</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginBottom: "4px" }}>{snap.clientName || "—"}</div>
          {snap.clientEmail && <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.7 }}>{snap.clientEmail}</div>}
          {snap.clientPhone && <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.7 }}>{snap.clientPhone}</div>}
          {snap.clientAddress && <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.7 }}>{snap.clientAddress}</div>}
        </div>

        {/* ITEMS TABLE */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "36px" }}>
          <thead>
            <tr style={{ background: "#1a1a2e" }}>
              <th style={{ padding: "13px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#fff", textAlign: "left" }}>Description</th>
              <th style={{ padding: "13px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#fff", textAlign: "right" }}>Quantity</th>
              <th style={{ padding: "13px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#fff", textAlign: "right" }}>Unit Price</th>
              <th style={{ padding: "13px 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#fff", textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(snap.items || []).map((item: any, idx: number) => {
              const included = isIncludedItem(item);

              return (
                <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6", background: idx % 2 === 1 ? "#f9fafb" : "#fff" }}>
                  <td style={{ padding: "13px 16px", fontSize: "13px", color: "#374151", verticalAlign: "top" }}>
                    <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{item.name}</div>
                    {item.description && <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "3px" }}>{item.description}</div>}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: "13px", color: "#374151", textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: "13px 16px", fontSize: "13px", color: "#374151", textAlign: "right" }}>
                    {included ? "included" : formatDisplay(parseFloat(item.displayUnitPrice || "0"), currency)}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: "13px", color: "#374151", textAlign: "right", fontWeight: 600 }}>
                    {included ? "included" : formatDisplay(parseFloat(item.displayTotalPrice || "0"), currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* TOTALS */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "48px" }}>
          <div style={{ width: "300px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", fontSize: "13px", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#6b7280" }}>Subtotal</span>
              <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{formatDisplay(parseFloat(snap.displaySubtotal || "0"), currency)}</span>
            </div>
            {parseFloat(snap.displayDiscountAmount || "0") > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", fontSize: "13px", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ color: "#6b7280" }}>Discount</span>
                <span style={{ fontWeight: 600, color: "#1a1a2e" }}>− {formatDisplay(parseFloat(snap.displayDiscountAmount || "0"), currency)}</span>
              </div>
            )}
            {parseFloat(snap.displayTaxAmount || "0") > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", fontSize: "13px", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ color: "#6b7280" }}>VAT{snap.taxRate ? ` (${snap.taxRate}%)` : ""}</span>
                <span style={{ fontWeight: 600, color: "#1a1a2e" }}>+ {formatDisplay(parseFloat(snap.displayTaxAmount || "0"), currency)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", fontSize: "15px", fontWeight: 700, borderTop: "2px solid #1a1a2e", borderBottom: "2px solid #1a1a2e", marginTop: "4px" }}>
              <span style={{ color: "#6b7280" }}>Total</span>
              <span style={{ color: "#1a1a2e" }}>{formatDisplay(displayTotal, currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", fontSize: "13px", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#6b7280" }}>Paid Amount</span>
              <span style={{ fontWeight: 600, color: "#16a34a" }}>{formatDisplay(displayPaid, currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 7px", fontSize: "16px", fontWeight: 800 }}>
              <span style={{ color: "#6b7280" }}>Balance Due</span>
              <span style={{ color: balanceColor }}>{formatDisplay(balanceDue, currency)}</span>
            </div>
          </div>
        </div>

        {/* NOTES & PAYMENT TERMS */}
        {(snap.notes || snap.paymentTerms) && (
          <div style={{ marginBottom: "32px" }}>
            {snap.notes && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "#9ca3af", marginBottom: "6px" }}>Notes</div>
                <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.7 }}>{snap.notes}</div>
              </div>
            )}
            {snap.paymentTerms && (
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "#9ca3af", marginBottom: "6px" }}>Payment Terms</div>
                <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.7 }}>{snap.paymentTerms}</div>
              </div>
            )}
          </div>
        )}

        {/* QR CODE */}
        {snap.qrCodeImage && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
            <img src={snap.qrCodeImage} alt="QR Code" style={{ width: "100px", height: "100px", objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "4px" }} />
          </div>
        )}

        {/* FOOTER */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "24px", fontSize: "11px", color: "#9ca3af", lineHeight: 1.7 }}>
          <p>
            {currency === "EGP"
              ? "Payment is due within 30 days of the invoice date. All amounts are in Egyptian Pounds (EGP) and include applicable VAT."
              : `Payment is due within 30 days of the invoice date. Amounts shown in ${currency} at a rate of ${rate.toFixed(2)} EGP per ${currency}. Original amounts are recorded in EGP.`}
          </p>
          <br />
          <p>Thank you for your business with <strong>{companyName}</strong>. We appreciate your continued partnership.</p>
        </div>

      </div>
    </>
  );
}
