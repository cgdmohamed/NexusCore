// Shared by the statement tab and the print page

export interface StatementEntry {
  date: string;
  kind: "invoice" | "payment" | "refund" | "credit_refund" | "credit_applied";
  reference: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  method: string | null;
  note: string | null;
  invoiceStatus: string | null;
  debit: number;
  credit: number;
  overpayment: number;
  balance: number;
}

export interface StatementData {
  client: { id: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null; country: string | null };
  company: { name: string; email: string; phone: string; address: string; vatNumber: string; regNumber: string };
  period: { from: string | null; to: string | null };
  generatedAt: string;
  openingBalance: number;
  entries: StatementEntry[];
  totals: { billed: number; received: number; refunded: number; closingBalance: number };
  position: { outstanding: number; overdue: number; creditBalance: number };
}

type T = (key: string, params?: Record<string, string>) => string;

export function describeEntry(e: StatementEntry, t: T): string {
  const ref = e.invoiceNumber || e.reference;
  switch (e.kind) {
    case "invoice":
      return e.invoiceStatus === "cancelled" ? t("stmt.kind.invoice_cancelled", { ref }) : t("stmt.kind.invoice", { ref });
    case "payment":
      return t("stmt.kind.payment_for", { ref });
    case "refund":
      return t("stmt.kind.refund", { ref });
    case "credit_applied":
      return t("stmt.kind.credit_applied", { ref });
    default:
      return t("stmt.kind.credit_refund");
  }
}

export function methodLabel(method: string | null, t: T): string {
  if (!method) return "";
  const key = `stmt.method.${method}`;
  return t(key) === key ? method.replace(/_/g, " ") : t(key);
}

// Cells that start with = + - @ would be run as formulas by spreadsheets
const csvCell = (v: string | number) => {
  const s = String(v);
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function statementToCsv(data: StatementData, t: T): string {
  const head = [t("stmt.date"), t("stmt.description"), t("stmt.debit"), t("stmt.credit"), t("stmt.balance")];
  const rows: Array<Array<string | number>> = [head];
  rows.push(["", t("stmt.opening_balance"), "", "", data.openingBalance]);
  for (const e of data.entries) {
    const detail = [methodLabel(e.method, t), e.reference && e.reference !== e.invoiceNumber ? e.reference : "", e.note || ""].filter(Boolean).join(" · ");
    rows.push([e.date.slice(0, 10), [describeEntry(e, t), detail].filter(Boolean).join(" — "), e.debit || "", e.credit || "", e.balance]);
  }
  rows.push(["", t("stmt.closing_balance"), data.totals.billed + data.totals.refunded, data.totals.received, data.totals.closingBalance]);
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
