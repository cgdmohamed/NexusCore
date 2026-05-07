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

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, sans-serif; background: white; }
      `}</style>

      <div className="no-print bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 text-sm text-center">
        Print dialog will open automatically. Use your browser&apos;s print settings to save as PDF.
      </div>

      <div className="max-w-3xl mx-auto p-8 bg-white">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">INVOICE</h1>
            <p className="text-gray-500 mt-1">{snap.invoiceNumber}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="font-semibold text-gray-900 text-lg">{snap.companyName || "CompanyOS"}</p>
            <p className="mt-1">Print date: {snap.printDate ? new Date(snap.printDate).toLocaleDateString() : ""}</p>
          </div>
        </div>

        {/* Currency note */}
        <div className="bg-gray-50 border border-gray-200 rounded px-4 py-2 mb-6 text-sm text-gray-600">
          {currency === "EGP"
            ? "Amounts shown in EGP (Egyptian Pound)"
            : `Exchange rate: 1 ${currency} = ${rate.toFixed(2)} EGP — Amounts shown in ${currency} (${symbol})`}
        </div>

        {/* Client & Document Info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Bill To</p>
            <p className="font-semibold text-gray-900">{snap.clientName || "—"}</p>
            {snap.clientEmail && <p className="text-sm text-gray-600">{snap.clientEmail}</p>}
            {snap.clientPhone && <p className="text-sm text-gray-600">{snap.clientPhone}</p>}
            {snap.clientAddress && <p className="text-sm text-gray-600">{snap.clientAddress}</p>}
          </div>
          <div className="text-right">
            <div className="space-y-1 text-sm">
              <div><span className="text-gray-500">Status: </span><span className="font-medium capitalize">{snap.status}</span></div>
              {snap.invoiceDate && (
                <div><span className="text-gray-500">Invoice Date: </span><span>{new Date(snap.invoiceDate).toLocaleDateString()}</span></div>
              )}
              {snap.dueDate && (
                <div><span className="text-gray-500">Due Date: </span><span>{new Date(snap.dueDate).toLocaleDateString()}</span></div>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        {snap.title && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{snap.title}</h2>
            {snap.description && <p className="text-sm text-gray-600 mt-1">{snap.description}</p>}
          </div>
        )}

        {/* Line Items */}
        <table className="w-full mb-6" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th className="text-left py-2 text-sm font-semibold text-gray-700">Description</th>
              <th className="text-right py-2 text-sm font-semibold text-gray-700 w-16">Qty</th>
              <th className="text-right py-2 text-sm font-semibold text-gray-700 w-28">Unit Price</th>
              <th className="text-right py-2 text-sm font-semibold text-gray-700 w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {(snap.items || []).map((item: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td className="py-2 text-sm text-gray-800">
                  <div>{item.name}</div>
                  {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                </td>
                <td className="py-2 text-sm text-gray-800 text-right">{item.quantity}</td>
                <td className="py-2 text-sm text-gray-800 text-right">
                  {formatDisplay(parseFloat(item.displayUnitPrice || "0"), currency)}
                </td>
                <td className="py-2 text-sm text-gray-800 text-right font-medium">
                  {formatDisplay(parseFloat(item.displayTotalPrice || "0"), currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between py-1 text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatDisplay(parseFloat(snap.displaySubtotal || "0"), currency)}</span>
            </div>
            {parseFloat(snap.displayTaxAmount || "0") > 0 && (
              <div className="flex justify-between py-1 text-sm text-gray-600">
                <span>Tax ({snap.taxRate || 0}%)</span>
                <span>{formatDisplay(parseFloat(snap.displayTaxAmount || "0"), currency)}</span>
              </div>
            )}
            {parseFloat(snap.displayDiscountAmount || "0") > 0 && (
              <div className="flex justify-between py-1 text-sm text-gray-600">
                <span>Discount</span>
                <span>-{formatDisplay(parseFloat(snap.displayDiscountAmount || "0"), currency)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 text-base font-bold text-gray-900 border-t border-gray-300 mt-1">
              <span>Total</span>
              <span>{formatDisplay(parseFloat(snap.displayTotal || "0"), currency)}</span>
            </div>
            {parseFloat(snap.displayPaidAmount || "0") > 0 && (
              <>
                <div className="flex justify-between py-1 text-sm text-green-700">
                  <span>Paid</span>
                  <span>-{formatDisplay(parseFloat(snap.displayPaidAmount || "0"), currency)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm font-semibold text-gray-900 border-t border-gray-200 mt-1">
                  <span>Balance Due</span>
                  <span>{formatDisplay(Math.max(0, parseFloat(snap.displayTotal || "0") - parseFloat(snap.displayPaidAmount || "0")), currency)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* QR Code */}
        {snap.qrCodeImage && (
          <div className="flex justify-end mb-6">
            <div>
              <p className="text-xs text-gray-400 mb-1 text-right">Scan to verify</p>
              <img src={snap.qrCodeImage} alt="QR Code" className="w-20 h-20" />
            </div>
          </div>
        )}

        {/* Notes */}
        {snap.notes && (
          <div className="mb-4">
            <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Notes</p>
            <p className="text-sm text-gray-700">{snap.notes}</p>
          </div>
        )}
        {snap.paymentTerms && (
          <div className="mb-4">
            <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Payment Terms</p>
            <p className="text-sm text-gray-700">{snap.paymentTerms}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 mt-8 text-xs text-gray-400 text-center">
          This is a print snapshot. Original amounts are stored in EGP.
        </div>
      </div>
    </>
  );
}
