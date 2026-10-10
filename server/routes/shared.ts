import type { Express } from "express";
import { db } from "../db";
import { attachmentUpload } from "../uploads";

import { invoices, invoiceItems } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// Invoice attachments: JPEG/PNG/GIF/PDF up to 10MB, extension from the content type, signature verified
export const uploadInvoiceFile = { single: (_field: string) => attachmentUpload("invoices", 10 * 1024 * 1024) };

// Either the shared connection pool or an open transaction
export type DbExecutor = Pick<typeof db, "execute" | "select" | "insert" | "update" | "delete">;

// Document numbers are "read the highest, add one". To make that safe when several requests arrive
// together, number allocation and the insert run in one transaction holding a database-wide lock
// per document type (released automatically at commit/rollback). Requests simply queue for a moment.
export async function lockNumbering(tx: DbExecutor, kind: "invoice_number" | "quotation_number") {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"nexus:" + kind}))`);
}

export async function generateQuotationNumber(executor: DbExecutor = db): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QUO-${year}-`;
  const result = await executor.execute(
    sql`SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(quotation_number, ${prefix}, ''), '') AS INTEGER)), 0) AS max_seq
        FROM quotations
        WHERE quotation_number LIKE ${prefix + '%'}`
  );
  const row = result.rows[0] as any;
  const nextSeq = (parseInt(row?.max_seq ?? '0', 10) || 0) + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

export async function generateInvoiceNumber(executor: DbExecutor = db): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const result = await executor.execute(
    sql`SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(invoice_number, ${prefix}, ''), '') AS INTEGER)), 0) AS max_seq
        FROM invoices
        WHERE invoice_number LIKE ${prefix + '%'}`
  );
  const row = result.rows[0] as any;
  const nextSeq = (parseInt(row?.max_seq ?? '0', 10) || 0) + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// Status an invoice should have once its total changes, given what was already paid.
// Only invoices that currently have payments (paid / partially_paid) are re-evaluated.
export function statusAfterTotalChange(invoice: { status: string; paidAmount: string | null; paidDate: Date | null }, newTotal: number) {
  const paid = parseFloat(invoice.paidAmount || "0");
  if (paid > 0 && (invoice.status === "paid" || invoice.status === "partially_paid")) {
    return newTotal <= paid
      ? { status: "paid", paidDate: invoice.paidDate ?? new Date() }
      : { status: "partially_paid", paidDate: null };
  }
  return { status: invoice.status, paidDate: invoice.paidDate };
}

export type InvoiceGuard =
  | { ok: true; invoice: typeof invoices.$inferSelect }
  | { ok: false; status: number; message: string };

// Checks that an invoice may have its line items changed by `subtotalDelta`:
// it must exist, must not be cancelled, and its new total must not drop below what was already paid.
export async function guardInvoiceItemChange(invoiceId: string, subtotalDelta: number): Promise<InvoiceGuard> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice) return { ok: false, status: 404, message: "Invoice not found" };
  if (invoice.status === "cancelled") {
    return { ok: false, status: 409, message: "Items of a cancelled invoice cannot be changed." };
  }
  const [row] = await db
    .select({ subtotal: sql<string>`COALESCE(SUM(${invoiceItems.totalPrice}), 0)` })
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId));
  const projected =
    parseFloat(row?.subtotal || "0") + subtotalDelta + parseFloat(invoice.taxAmount || "0") - parseFloat(invoice.discountAmount || "0");
  if (projected < parseFloat(invoice.paidAmount || "0") - 0.005) {
    return {
      ok: false,
      status: 400,
      message: "This change would reduce the invoice total below the amount already paid. Refund the difference first.",
    };
  }
  return { ok: true, invoice };
}

// ─── Print Records ─────────────────────────────────────────────────────────

export const VALID_CURRENCIES = ["EGP", "USD", "SAR"];

// One company block for every printed document (invoice, quotation, client statement)
export function companyInfo() {
  return {
    name: process.env.COMPANY_NAME || "Creative Code Nexus",
    email: process.env.COMPANY_EMAIL || "",
    phone: process.env.COMPANY_PHONE || "",
    address: process.env.COMPANY_ADDRESS || "",
    vatNumber: process.env.COMPANY_VAT_NUMBER || "",
    regNumber: process.env.COMPANY_REGISTRATION_NUMBER || "",
  };
}

export function convertAmount(egpValue: number, exchangeRate: number): number {
  return Math.round((egpValue / exchangeRate) * 100) / 100;
}

export function isIncludedPrintItem(unitPrice: string | null, totalPrice: string | null, discount?: string | null): boolean {
  return parseFloat(unitPrice || "0") === 0
    && parseFloat(totalPrice || "0") === 0
    && parseFloat(discount || "0") === 0;
}
