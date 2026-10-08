import type { Express } from "express";
import { db, badRequestFromDbError } from "../db";

import { parseMoney, parsePercent, parseDateValue, isAbsent } from "../validation";
import { requirePermission } from "../auth";
import { clients, quotations, invoices, invoiceItems, users, quotationItems, activities, quotationHistory, invoiceHistory, quotationPrintRecords } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";
import { notificationService } from "../notification-service";

import { lockNumbering, generateQuotationNumber, generateInvoiceNumber, VALID_CURRENCIES, convertAmount, isIncludedPrintItem } from "./shared";

// Quotations: items, status, conversion, export, print records
export function registerQuotationsRoutes(app: Express) {

  app.patch('/api/quotations/:id/status', requirePermission("quotations", "edit"), async (req: any, res) => {
    try {
      const newStatus = req.body.status;

      // Fetch current quotation to validate transition
      const [currentQuotation] = await db.select().from(quotations).where(eq(quotations.id, req.params.id));
      if (!currentQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Transition matrix: maps current status to the set of statuses it can move TO
      const allowedTransitions: Record<string, string[]> = {
        draft:    ['sent', 'accepted', 'rejected', 'expired'],
        sent:     ['draft', 'accepted', 'rejected', 'expired'],
        accepted: ['rejected'],
        rejected: ['draft', 'sent'],
        expired:  ['draft', 'sent'],
        invoiced: [], // terminal — no transitions allowed
      };

      const currentStatus = currentQuotation.status;
      const allowed = allowedTransitions[currentStatus] ?? [];
      if (!allowed.includes(newStatus)) {
        return res.status(400).json({
          message: `Cannot transition quotation from "${currentStatus}" to "${newStatus}". Allowed transitions from "${currentStatus}": ${allowed.length ? allowed.join(', ') : 'none'}.`,
        });
      }

      const [updatedQuotation] = await db.update(quotations)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(quotations.id, req.params.id))
        .returning();

      // Record history before responding so the change is visible as soon as the client has its answer
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(quotationHistory).values({
          quotationId: req.params.id,
          event: `Status changed to ${newStatus}`,
          actor,
        });
      } catch (historyError) {
        console.error('Error recording quotation history:', historyError);
      }

      res.json(updatedQuotation);

      // Trigger notification when quotation is accepted
      if (newStatus === 'accepted' && updatedQuotation) {
        try {
          const [client] = await db.select().from(clients).where(eq(clients.id, updatedQuotation.clientId));
          await notificationService.notifyQuotationAccepted(
            updatedQuotation.id,
            client?.name || 'Unknown Client',
            parseFloat(updatedQuotation.amount || '0'),
            req.user?.id
          );
        } catch (notifyError) {
          console.error('Error sending quotation accepted notification:', notifyError);
        }
      }
    } catch (error) {
      console.error("Error updating quotation status:", error);
      res.status(500).json({ message: "Failed to update quotation status" });
    }
  });

  // Quotation history endpoint
  app.get('/api/quotations/:id/history', requirePermission("quotations", "view"), async (req: any, res) => {
    try {
      const history = await db.select().from(quotationHistory)
        .where(eq(quotationHistory.quotationId, req.params.id))
        .orderBy(desc(quotationHistory.createdAt));
      res.json(history);
    } catch (error) {
      console.error("Error fetching quotation history:", error);
      res.status(500).json({ message: "Failed to fetch quotation history" });
    }
  });

  // Tasks routes moved to task-management-routes.ts

  // Expenses routes are handled by expense-routes.ts

  // Quotations - using real database
  app.get('/api/quotations', requirePermission("quotations", "view"), async (req: any, res) => {
    try {
      const quotationsData = await db.select().from(quotations);
      res.json(quotationsData);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  app.post('/api/quotations', requirePermission("quotations", "add"), async (req: any, res) => {
    try {
      // Get the actual user ID from the session or use the first available user
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (typeof req.body.title !== "string" || !req.body.title.trim()) {
        return res.status(400).json({ message: "Quotation title is required." });
      }
      if (typeof req.body.clientId !== "string" || !req.body.clientId) {
        return res.status(400).json({ message: "clientId is required." });
      }
      const [quotationClient] = await db.select({ id: clients.id, status: clients.status }).from(clients).where(eq(clients.id, req.body.clientId));
      if (!quotationClient) {
        return res.status(400).json({ message: "Client not found." });
      }
      if (quotationClient.status === "archived") {
        return res.status(409).json({ message: "This client is archived. Restore it before creating new quotations." });
      }

      const newQuotation = await db.transaction(async (tx) => {
        await lockNumbering(tx, "quotation_number");
        const quotationNumber = await generateQuotationNumber(tx);
        const [created] = await tx.insert(quotations).values({
          quotationNumber,
          clientId: req.body.clientId,
          title: req.body.title,
          description: req.body.description,
          amount: "0",
          status: 'draft',
          validUntil: req.body.validUntil ? new Date(req.body.validUntil) : null,
          notes: req.body.notes || null,
          terms: req.body.terms || null,
          createdBy: userId,
        }).returning();
        return created;
      });

      // Log activity for quotation creation
      try {
        await db.insert(activities).values({
          type: 'quotation_sent',
          title: 'Quotation Created',
          description: `Quotation ${newQuotation.quotationNumber} was created`,
          entityType: 'quotation',
          entityId: newQuotation.id,
          createdBy: userId,
        });
      } catch (activityError) {
        console.error("Error logging activity:", activityError);
      }

      // Record creation history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(quotationHistory).values({
          quotationId: newQuotation.id,
          event: `Quotation ${newQuotation.quotationNumber} created`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording quotation history:", historyError);
      }

      res.status(201).json(newQuotation);
    } catch (error) {
      const badRequest = badRequestFromDbError(error);
      if (badRequest) return res.status(400).json({ message: badRequest });
      console.error("Error creating quotation:", error);
      res.status(500).json({ message: "Failed to create quotation" });
    }
  });

  // Quotation Items Management
  app.get('/api/quotations/:id/items', requirePermission("quotations", "view"), async (req: any, res) => {
    try {
      const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));
      res.json(items);
    } catch (error) {
      console.error("Error fetching quotation items:", error);
      res.status(500).json({ message: "Failed to fetch quotation items" });
    }
  });

  app.post('/api/quotations/:id/items', requirePermission("quotations", "edit"), async (req: any, res) => {
    try {
      // Lock items when quotation is accepted or invoiced
      const [parentQuotation] = await db.select({ status: quotations.status }).from(quotations).where(eq(quotations.id, req.params.id));
      if (parentQuotation && (parentQuotation.status === 'accepted' || parentQuotation.status === 'invoiced')) {
        return res.status(409).json({ message: `Cannot add items to a quotation with status "${parentQuotation.status}".` });
      }

      if (
        parseMoney(req.body.quantity) === null ||
        parseMoney(req.body.unitPrice, { allowZero: true }) === null ||
        parseMoney(req.body.totalPrice, { allowZero: true }) === null ||
        (!isAbsent(req.body.discount) && parsePercent(req.body.discount) === null)
      ) {
        return res.status(400).json({
          message: "Quantity must be positive, prices non-negative numbers, and discount between 0 and 100.",
        });
      }

      const itemData = {
        quotationId: req.params.id,
        serviceId: req.body.serviceId,
        description: req.body.description,
        quantity: req.body.quantity,
        unitPrice: req.body.unitPrice,
        totalPrice: req.body.totalPrice,
        discount: req.body.discount || '0.00',
      };

      const [newItem] = await db.insert(quotationItems).values(itemData).returning();
      
      // Recalculate and update quotation amount using DB-level SUM
      const [qTotals] = await db.select({
        subtotalAgg: sql<string>`COALESCE(SUM(${quotationItems.quantity}::numeric * ${quotationItems.unitPrice}::numeric), 0)`,
        totalAgg: sql<string>`COALESCE(SUM(${quotationItems.totalPrice}), 0)`,
      }).from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));
      const qSubtotal = parseFloat(qTotals?.subtotalAgg || '0');
      const qTotal = parseFloat(qTotals?.totalAgg || '0');
      const qDiscountAmt = qSubtotal - qTotal;
      const qDiscountRate = qSubtotal > 0 ? ((qDiscountAmt / qSubtotal) * 100).toFixed(2) : '0.00';
      
      await db.update(quotations)
        .set({ amount: qTotal.toFixed(2), subtotal: qSubtotal.toFixed(2), discountAmount: qDiscountAmt.toFixed(2), discountRate: qDiscountRate, updatedAt: new Date() })
        .where(eq(quotations.id, req.params.id));

      // Record item-added history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(quotationHistory).values({
          quotationId: req.params.id,
          event: `Item "${newItem.description}" added (qty: ${newItem.quantity}, unit price: ${parseFloat(newItem.unitPrice).toFixed(2)})`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording quotation history:", historyError);
      }

      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating quotation item:", error);
      res.status(500).json({ message: "Failed to create quotation item" });
    }
  });

  // Enhanced Quotation Management Routes
  app.get('/api/quotations/:id', requirePermission("quotations", "view"), async (req: any, res) => {
    try {
      const [quotation] = await db.select().from(quotations).where(eq(quotations.id, req.params.id));
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      res.json(quotation);
    } catch (error) {
      console.error("Error fetching quotation:", error);
      res.status(500).json({ message: "Failed to fetch quotation" });
    }
  });

  app.patch('/api/quotations/:id', requirePermission("quotations", "edit"), async (req: any, res) => {
    try {
      const [currentQuotation] = await db.select().from(quotations).where(eq(quotations.id, req.params.id));
      if (!currentQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Only these fields may be edited here. Number, client, invoice link and ownership are never
      // client-controlled, and the amount is always derived from the items.
      const body = req.body ?? {};
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (typeof body.title === "string" && body.title.trim()) updateData.title = body.title;
      for (const field of ["description", "notes", "terms"] as const) {
        if (body[field] === null || typeof body[field] === "string") updateData[field] = body[field] || null;
      }
      if (body.validUntil !== undefined) {
        const valid = body.validUntil === null || body.validUntil === "" ? null : parseDateValue(body.validUntil);
        if (valid === null && body.validUntil !== null && body.validUntil !== "") {
          return res.status(400).json({ message: "validUntil must be a valid date." });
        }
        updateData.validUntil = valid;
      }

      // If a status change is requested, enforce the transition matrix
      if (body.status) {
        const allowedTransitions: Record<string, string[]> = {
          draft:    ['sent', 'accepted', 'rejected', 'expired'],
          sent:     ['draft', 'accepted', 'rejected', 'expired'],
          accepted: ['rejected'],
          rejected: ['draft', 'sent'],
          expired:  ['draft', 'sent'],
          invoiced: [],
        };
        const current = currentQuotation.status;
        const next = body.status;
        const allowed = allowedTransitions[current] ?? [];
        if (!allowed.includes(next)) {
          return res.status(400).json({
            message: `Cannot transition quotation from "${current}" to "${next}".`,
          });
        }
        updateData.status = next;

        // Recalculate totals from the items using DB-level SUM
        const [patchTotals] = await db.select({
          subtotalAgg: sql<string>`COALESCE(SUM(${quotationItems.quantity}::numeric * ${quotationItems.unitPrice}::numeric), 0)`,
          totalAgg: sql<string>`COALESCE(SUM(${quotationItems.totalPrice}), 0)`,
        }).from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));
        const patchSubtotal = parseFloat(patchTotals?.subtotalAgg || '0');
        const patchTotal = parseFloat(patchTotals?.totalAgg || '0');
        const patchDiscountAmt = patchSubtotal - patchTotal;
        const patchDiscountRate = patchSubtotal > 0 ? ((patchDiscountAmt / patchSubtotal) * 100).toFixed(2) : '0.00';
        updateData.amount = patchTotal.toFixed(2);
        updateData.subtotal = patchSubtotal.toFixed(2);
        updateData.discountAmount = patchDiscountAmt.toFixed(2);
        updateData.discountRate = patchDiscountRate;
      }

      const [updatedQuotation] = await db.update(quotations)
        .set(updateData)
        .where(eq(quotations.id, req.params.id))
        .returning();

      // Record history for status changes and/or field edits
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        // Log status change separately for clear audit trail
        if (updateData.status) {
          await db.insert(quotationHistory).values({
            quotationId: req.params.id,
            event: `Status changed to "${updateData.status}"`,
            actor,
          });
        }
        const changedFields = Object.keys(updateData).filter(k => ['title', 'description', 'notes', 'terms', 'validUntil'].includes(k));
        if (changedFields.length > 0) {
          const fieldLabels: Record<string, string> = {
            title: 'title', validUntil: 'valid until', notes: 'notes',
            terms: 'terms', description: 'description',
          };
          const readable = changedFields.map(f => fieldLabels[f] || f).join(', ');
          await db.insert(quotationHistory).values({
            quotationId: req.params.id,
            event: `Quotation details updated (${readable})`,
            actor,
          });
        }
      } catch (historyError) {
        console.error("Error recording quotation history:", historyError);
      }
      
      res.json(updatedQuotation);
    } catch (error) {
      console.error("Error updating quotation:", error);
      res.status(500).json({ message: "Failed to update quotation" });
    }
  });

  // Delete quotation with all items
  app.delete('/api/quotations/:id', requirePermission("quotations", "delete"), async (req: any, res) => {
    try {
      const quotationId = req.params.id;
      
      // Check if quotation exists
      const [quotation] = await db.select().from(quotations).where(eq(quotations.id, quotationId));
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Delete quotation items first
      await db.delete(quotationItems).where(eq(quotationItems.quotationId, quotationId));

      // Delete the quotation
      await db.delete(quotations).where(eq(quotations.id, quotationId));

      res.json({ success: true, message: "Quotation deleted successfully" });
    } catch (error) {
      console.error("Error deleting quotation:", error);
      res.status(500).json({ message: "Failed to delete quotation" });
    }
  });

  // Convert quotation to invoice
  app.post('/api/quotations/:id/convert-to-invoice', requirePermission("quotations", "approve"), async (req: any, res) => {
    try {
      type ConvertOutcome = { error: { status: number; message: string } } | { invoice: any; items: any[] };
      const outcome: ConvertOutcome = await db.transaction(async (tx): Promise<ConvertOutcome> => {
        // Get quotation details
        // Lock the row: simultaneous conversions queue here and only the first one succeeds
        const [quotation] = await tx.select().from(quotations).where(eq(quotations.id, req.params.id)).for("update");
        if (!quotation) {
          return { error: { status: 404, message: "Quotation not found" } };
        }

        const [convertClient] = await tx.select({ status: clients.status }).from(clients).where(eq(clients.id, quotation.clientId));
        if (convertClient?.status === "archived") {
          return { error: { status: 409, message: "This client is archived. Restore it before converting its quotations." } };
        }

        // A quotation can only be converted once; converting again would bill the client twice
        if (quotation.status === 'invoiced' || quotation.invoiceId) {
          return { error: { status: 409, message: "This quotation has already been converted to an invoice." } };
        }

        // Fetch quotation items (needed both for financial aggregates and item copying)
        const qItems = await tx.select().from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));

        // Calculate financial summary using DB-level aggregates to avoid float drift
        const [conversionFinancials] = await tx.select({
          subtotal: sql<string>`COALESCE(SUM(${quotationItems.quantity}::numeric * ${quotationItems.unitPrice}::numeric), 0)`,
          totalAfterDiscounts: sql<string>`COALESCE(SUM(${quotationItems.totalPrice}), 0)`,
        }).from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));

        const subtotal = parseFloat(conversionFinancials?.subtotal || '0');
        const totalAfterItemDiscounts = parseFloat(conversionFinancials?.totalAfterDiscounts || '0');
        // Item-level discount = gross subtotal minus discounted line totals
        const itemDiscountAmount = subtotal - totalAfterItemDiscounts;
        // Carry over stored quotation-level tax/discount fields
        const quotationTaxAmount = parseFloat(quotation.taxAmount || '0');
        const quotationDiscountAmount = parseFloat(quotation.discountAmount || '0');
        // Use stored quotation discount if set (covers quotation-level discount); else use item-level discount
        const effectiveDiscountAmount = quotationDiscountAmount > 0 ? quotationDiscountAmount : itemDiscountAmount;
        const effectiveDiscountRate = parseFloat(quotation.discountRate || '0') > 0
          ? quotation.discountRate!
          : (subtotal > 0 ? ((effectiveDiscountAmount / subtotal) * 100).toFixed(2) : '0.00');
        const effectiveTaxAmount = quotationTaxAmount;
        const effectiveTaxRate = quotation.taxRate ?? '0.00';
        // Single coherent formula: total = subtotal - discount + tax
        const finalAmount = subtotal - effectiveDiscountAmount + effectiveTaxAmount;

        // Create invoice record carrying over all financial data from the quotation
        const baseConvertData = {
          clientId: quotation.clientId,
          quotationId: quotation.id,
          title: quotation.title,
          description: quotation.description,
          notes: quotation.notes,
          subtotal: subtotal.toFixed(2),
          discountAmount: effectiveDiscountAmount.toFixed(2),
          discountRate: effectiveDiscountRate,
          taxRate: effectiveTaxRate,
          taxAmount: effectiveTaxAmount.toFixed(2),
          amount: finalAmount.toFixed(2),
          paidAmount: '0.00',
          status: 'pending',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          createdBy: req.user?.id,
        };

        await lockNumbering(tx, "invoice_number");
        const [newInvoice] = await tx.insert(invoices).values({ ...baseConvertData, invoiceNumber: await generateInvoiceNumber(tx) }).returning();

        const invoiceNumber = newInvoice.invoiceNumber;

        // Copy quotation items into invoice items
        if (qItems.length > 0) {
          const invoiceItemsData = qItems.map((item) => ({
            invoiceId: newInvoice.id,
            serviceId: item.serviceId ?? undefined,
            name: item.description,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          }));
          await tx.insert(invoiceItems).values(invoiceItemsData);
        }

        // Update quotation status to invoiced and store the resulting invoiceId
        await tx.update(quotations)
          .set({ status: 'invoiced', invoiceId: newInvoice.id, updatedAt: new Date() })
          .where(eq(quotations.id, req.params.id));

        // Record history for both the quotation (status change) and the new invoice (creation)
        const actor = req.user?.email || req.user?.username || 'System';
        await tx.insert(quotationHistory).values({
          quotationId: req.params.id,
          event: `Status changed to "invoiced" — converted to invoice ${invoiceNumber}`,
          actor,
        });
        await tx.insert(invoiceHistory).values({
          invoiceId: newInvoice.id,
          event: `Invoice ${invoiceNumber} created from quotation ${quotation.quotationNumber}`,
          actor,
        });

        const createdItems = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, newInvoice.id));
        return { invoice: newInvoice, items: createdItems };

      });

      if ("error" in outcome) {
        return res.status(outcome.error.status).json({ message: outcome.error.message });
      }
      res.status(201).json({ invoice: outcome.invoice, items: outcome.items, message: "Quotation converted to invoice successfully" });
    } catch (error) {
      console.error("Error converting quotation to invoice:", error);
      res.status(500).json({ message: "Failed to convert quotation to invoice" });
    }
  });

  // Export quotation as PDF
  app.get('/api/quotations/:id/export-pdf', requirePermission("quotations", "view"), async (req: any, res) => {
    try {
      const [quotation] = await db.select().from(quotations).where(eq(quotations.id, req.params.id));
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      const [client] = await db.select().from(clients).where(eq(clients.id, quotation.clientId));
      const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));

      const companyName = process.env.COMPANY_NAME || 'Creative Code Nexus';
      const companyEmail = process.env.COMPANY_EMAIL || 'info@company.com';
      const companyPhone = process.env.COMPANY_PHONE || '';
      const companyAddress = process.env.COMPANY_ADDRESS || '';
      const companyVatNumber = process.env.COMPANY_VAT_NUMBER || '';
      const companyRegNumber = process.env.COMPANY_REGISTRATION_NUMBER || '';

      // Use stored quotation financial fields (kept in sync by item CRUD handlers)
      const subtotal = parseFloat(quotation.subtotal || quotation.amount || '0');
      const taxAmount = parseFloat(quotation.taxAmount || '0');
      const discountAmount = parseFloat(quotation.discountAmount || '0');
      const totalAmount = parseFloat(quotation.amount || '0');

      const statusBadgeStyles: Record<string, string> = {
        draft:    'background:#f3f4f6;color:#374151',
        sent:     'background:#dbeafe;color:#1d4ed8',
        accepted: 'background:#dcfce7;color:#15803d',
        rejected: 'background:#fee2e2;color:#dc2626',
        expired:  'background:#fef3c7;color:#d97706',
        invoiced: 'background:#ede9fe;color:#7c3aed',
      };
      const statusStyle = statusBadgeStyles[quotation.status] || 'background:#f3f4f6;color:#374151';

      const formatExportItemAmount = (item: typeof items[number], amount: string | null): string => (
        isIncludedPrintItem(item.unitPrice, item.totalPrice, item.discount)
          ? "included"
          : parseFloat(amount || "0").toFixed(2)
      );

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Quotation ${quotation.quotationNumber}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#1a1a2e;background:#fff;padding:48px;max-width:900px;margin:0 auto}

    /* Header */
    .doc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;padding-bottom:32px;border-bottom:3px solid #1a1a2e}
    .company-block{display:flex;flex-direction:column;gap:3px;max-width:260px}
    .company-logo{width:72px;height:72px;object-fit:contain;margin-bottom:14px}
    .company-name{font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:4px}
    .company-detail{font-size:11.5px;color:#6b7280;line-height:1.7}
    .doc-info{text-align:right}
    .doc-type{font-size:34px;font-weight:800;color:#1a1a2e;letter-spacing:3px;margin-bottom:18px}
    .doc-meta-table{margin-left:auto;border-collapse:collapse}
    .doc-meta-table td{padding:4px 0 4px 28px;font-size:12px;vertical-align:top}
    .doc-meta-table td:first-child{color:#9ca3af;white-space:nowrap}
    .doc-meta-table td:last-child{font-weight:600;color:#1a1a2e}
    .status-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;margin-top:14px}

    /* Bill To */
    .bill-section{margin-bottom:36px;padding:20px 24px;background:#f9fafb;border-left:4px solid #1a1a2e;border-radius:0 6px 6px 0}
    .section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;margin-bottom:8px}
    .bill-name{font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:4px}
    .bill-detail{font-size:12px;color:#6b7280;line-height:1.7}

    /* Items table */
    .items-table{width:100%;border-collapse:collapse;margin-bottom:36px}
    .items-table thead tr{background:#1a1a2e}
    .items-table thead th{padding:13px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:left}
    .items-table thead th.right{text-align:right}
    .items-table tbody tr{border-bottom:1px solid #f3f4f6}
    .items-table tbody tr:nth-child(even){background:#f9fafb}
    .items-table tbody td{padding:13px 16px;font-size:13px;color:#374151;vertical-align:top}
    .items-table tbody td.right{text-align:right}
    .item-name{font-weight:600;color:#1a1a2e}
    .item-desc{font-size:11px;color:#9ca3af;margin-top:3px}

    /* Totals */
    .totals-wrapper{display:flex;justify-content:flex-end;margin-bottom:48px}
    .totals-box{width:300px}
    .totals-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:13px;border-bottom:1px solid #f3f4f6}
    .totals-row:last-child{border-bottom:none}
    .totals-row.grand-total{font-size:15px;font-weight:700;border-top:2px solid #1a1a2e;border-bottom:2px solid #1a1a2e;padding:10px 0;margin-top:4px}
    .totals-label{color:#6b7280}
    .totals-value{font-weight:600;color:#1a1a2e}

    /* Footer */
    .doc-footer{border-top:1px solid #e5e7eb;padding-top:24px;font-size:11px;color:#9ca3af;line-height:1.7}

    @media print{body{padding:24px}@page{margin:1cm}}
  </style>
</head>
<body>

  <!-- TWO-COLUMN HEADER -->
  <div class="doc-header">
    <div class="company-block">
      <img src="/assets/logo.png" alt="${companyName}" class="company-logo" onerror="this.style.display='none'" />
      <div class="company-name">${companyName}</div>
      ${companyAddress ? `<div class="company-detail">${companyAddress}</div>` : ''}
      ${companyPhone ? `<div class="company-detail">Tel: ${companyPhone}</div>` : ''}
      <div class="company-detail">${companyEmail}</div>
      ${companyVatNumber ? `<div class="company-detail">VAT No: ${companyVatNumber}</div>` : ''}
      ${companyRegNumber ? `<div class="company-detail">Reg No: ${companyRegNumber}</div>` : ''}
    </div>
    <div class="doc-info">
      <div class="doc-type">QUOTATION</div>
      <table class="doc-meta-table">
        <tr><td>Quotation No.</td><td>${quotation.quotationNumber}</td></tr>
        <tr><td>Date</td><td>${quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString() : 'N/A'}</td></tr>
        <tr><td>Valid Until</td><td>${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}</td></tr>
        ${quotation.title ? `<tr><td>Subject</td><td>${quotation.title}</td></tr>` : ''}
      </table>
      <div><span class="status-badge" style="${statusStyle}">${quotation.status.toUpperCase()}</span></div>
    </div>
  </div>

  <!-- PREPARED FOR -->
  <div class="bill-section">
    <div class="section-label">Prepared For</div>
    <div class="bill-name">${client?.name || 'N/A'}</div>
    ${client?.email ? `<div class="bill-detail">${client.email}</div>` : ''}
    ${client?.phone ? `<div class="bill-detail">${client.phone}</div>` : ''}
    ${[client?.city, client?.country].filter(Boolean).length > 0 ? `<div class="bill-detail">${[client?.city, client?.country].filter(Boolean).join(', ')}</div>` : ''}
  </div>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Quantity</th>
        <th class="right">Unit Price</th>
        <th class="right">Discount</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
      <tr>
        <td>
          <div class="item-name">${item.description || ''}</div>
        </td>
        <td class="right">${item.quantity}</td>
        <td class="right">${formatExportItemAmount(item, item.unitPrice)}</td>
        <td class="right">${parseFloat(item.discount || '0').toFixed(1)}%</td>
        <td class="right">${formatExportItemAmount(item, item.totalPrice)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals-wrapper">
    <div class="totals-box">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">EGP ${subtotal.toFixed(2)}</span>
      </div>
      ${discountAmount > 0 ? `
      <div class="totals-row">
        <span class="totals-label">Discount${quotation.discountRate ? ` (${quotation.discountRate}%)` : ''}</span>
        <span class="totals-value">− EGP ${discountAmount.toFixed(2)}</span>
      </div>` : ''}
      ${taxAmount > 0 ? `
      <div class="totals-row">
        <span class="totals-label">VAT${quotation.taxRate ? ` (${quotation.taxRate}%)` : ''}</span>
        <span class="totals-value">+ EGP ${taxAmount.toFixed(2)}</span>
      </div>` : ''}
      <div class="totals-row grand-total">
        <span class="totals-label">Total</span>
        <span class="totals-value">EGP ${totalAmount.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="doc-footer">
    <p>This quotation is valid until the date shown above. All amounts are in Egyptian Pounds (EGP) and include VAT where applicable. Prices are subject to change after the validity date.</p>
    <br>
    <p>Thank you for considering <strong>${companyName}</strong>. We look forward to working with you.</p>
  </div>

</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="quotation-${quotation.quotationNumber}.html"`);
      res.send(htmlContent);
    } catch (error) {
      console.error("Error exporting quotation:", error);
      res.status(500).json({ message: "Failed to export quotation" });
    }
  });

  // Update quotation item
  app.patch('/api/quotations/:id/items/:itemId', requirePermission("quotations", "edit"), async (req: any, res) => {
    try {
      // Lock items when quotation is accepted or invoiced
      const [parentQuotation] = await db.select({ status: quotations.status }).from(quotations).where(eq(quotations.id, req.params.id));
      if (parentQuotation && (parentQuotation.status === 'accepted' || parentQuotation.status === 'invoiced')) {
        return res.status(409).json({ message: `Cannot edit items on a quotation with status "${parentQuotation.status}".` });
      }

      const qty = parseMoney(req.body.quantity);
      const price = parseMoney(req.body.unitPrice, { allowZero: true });
      if (qty === null || price === null || (!isAbsent(req.body.discount) && parsePercent(req.body.discount) === null)) {
        return res.status(400).json({
          message: "Quantity must be positive, unit price a non-negative number, and discount between 0 and 100.",
        });
      }
      const disc = isAbsent(req.body.discount) ? 0 : parsePercent(req.body.discount)!;
      const subtotal = qty * price;
      const totalPrice = (subtotal - (subtotal * disc / 100)).toFixed(2);

      const [updatedItem] = await db.update(quotationItems)
        .set({
          description: req.body.description,
          quantity: req.body.quantity,
          unitPrice: req.body.unitPrice,
          discount: req.body.discount || '0.00',
          totalPrice,
        })
        .where(eq(quotationItems.id, req.params.itemId))
        .returning();

      // Recalculate and update quotation total using DB-level SUM
      const [editTotals] = await db.select({
        subtotalAgg: sql<string>`COALESCE(SUM(${quotationItems.quantity}::numeric * ${quotationItems.unitPrice}::numeric), 0)`,
        totalAgg: sql<string>`COALESCE(SUM(${quotationItems.totalPrice}), 0)`,
      }).from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));
      const editSubtotal = parseFloat(editTotals?.subtotalAgg || '0');
      const editTotal = parseFloat(editTotals?.totalAgg || '0');
      const editDiscountAmt = editSubtotal - editTotal;
      const editDiscountRate = editSubtotal > 0 ? ((editDiscountAmt / editSubtotal) * 100).toFixed(2) : '0.00';
      await db.update(quotations)
        .set({ amount: editTotal.toFixed(2), subtotal: editSubtotal.toFixed(2), discountAmount: editDiscountAmt.toFixed(2), discountRate: editDiscountRate, updatedAt: new Date() })
        .where(eq(quotations.id, req.params.id));

      // Record item-edited history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(quotationHistory).values({
          quotationId: req.params.id,
          event: `Item "${updatedItem.description}" updated (qty: ${updatedItem.quantity}, unit price: ${parseFloat(updatedItem.unitPrice).toFixed(2)})`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording quotation history:", historyError);
      }

      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating quotation item:", error);
      res.status(500).json({ message: "Failed to update quotation item" });
    }
  });

  // Delete quotation item
  app.delete('/api/quotations/:id/items/:itemId', requirePermission("quotations", "edit"), async (req: any, res) => {
    try {
      // Lock items when quotation is accepted or invoiced
      const [parentQuotation] = await db.select({ status: quotations.status }).from(quotations).where(eq(quotations.id, req.params.id));
      if (parentQuotation && (parentQuotation.status === 'accepted' || parentQuotation.status === 'invoiced')) {
        return res.status(409).json({ message: `Cannot delete items from a quotation with status "${parentQuotation.status}".` });
      }

      // Fetch item before deleting for history
      const [deletedItem] = await db.select().from(quotationItems).where(eq(quotationItems.id, req.params.itemId));

      await db.delete(quotationItems)
        .where(eq(quotationItems.id, req.params.itemId));

      // Recalculate and update quotation total using DB-level SUM
      const [delTotals] = await db.select({
        subtotalAgg: sql<string>`COALESCE(SUM(${quotationItems.quantity}::numeric * ${quotationItems.unitPrice}::numeric), 0)`,
        totalAgg: sql<string>`COALESCE(SUM(${quotationItems.totalPrice}), 0)`,
      }).from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));
      const delSubtotal = parseFloat(delTotals?.subtotalAgg || '0');
      const delTotal = parseFloat(delTotals?.totalAgg || '0');
      const delDiscountAmt = delSubtotal - delTotal;
      const delDiscountRate = delSubtotal > 0 ? ((delDiscountAmt / delSubtotal) * 100).toFixed(2) : '0.00';
      await db.update(quotations)
        .set({ amount: delTotal.toFixed(2), subtotal: delSubtotal.toFixed(2), discountAmount: delDiscountAmt.toFixed(2), discountRate: delDiscountRate, updatedAt: new Date() })
        .where(eq(quotations.id, req.params.id));

      // Record item-deleted history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(quotationHistory).values({
          quotationId: req.params.id,
          event: `Item "${deletedItem?.description || 'Unknown'}" removed from quotation`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording quotation history:", historyError);
      }

      res.json({ message: "Item deleted successfully" });
    } catch (error) {
      console.error("Error deleting quotation item:", error);
      res.status(500).json({ message: "Failed to delete quotation item" });
    }
  });

  // POST /api/quotations/:id/print — create print record & return printUrl
  app.post('/api/quotations/:id/print', requirePermission("quotations", "view"), async (req: any, res) => {
    try {
      const quotationId = req.params.id;
      const { displayCurrency, exchangeRate: rateStr } = req.body;

      if (!VALID_CURRENCIES.includes(displayCurrency)) {
        return res.status(400).json({ message: "displayCurrency must be one of EGP, USD, SAR" });
      }

      const exchangeRate = displayCurrency === "EGP" ? 1 : parseFloat(rateStr);
      if (displayCurrency !== "EGP" && (isNaN(exchangeRate) || exchangeRate <= 0)) {
        return res.status(400).json({ message: "exchangeRate must be greater than 0 for non-EGP currencies" });
      }

      const [quotation] = await db.select().from(quotations).where(eq(quotations.id, quotationId));
      if (!quotation) return res.status(404).json({ message: "Quotation not found" });

      const [client] = quotation.clientId
        ? await db.select().from(clients).where(eq(clients.id, quotation.clientId))
        : [undefined];

      const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, quotationId));

      const [qPrintSum] = await db.select({
        totalSum: sql<string>`COALESCE(SUM(${quotationItems.totalPrice}), 0)`,
      }).from(quotationItems).where(eq(quotationItems.quotationId, quotationId));
      const egpSubtotal = parseFloat(qPrintSum?.totalSum || '0');
      const egpTaxAmount = parseFloat(quotation.taxAmount || "0");
      const egpDiscountAmount = parseFloat(quotation.discountAmount || "0");
      const egpGrandTotal = egpSubtotal + egpTaxAmount - egpDiscountAmount;
      const convertedTotal = convertAmount(egpGrandTotal, exchangeRate);

      const snapshotItems = items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        discount: item.discount || "0",
        egpUnitPrice: item.unitPrice,
        egpTotalPrice: item.totalPrice,
        isIncluded: isIncludedPrintItem(item.unitPrice, item.totalPrice, item.discount),
        displayUnitPrice: convertAmount(parseFloat(item.unitPrice), exchangeRate).toFixed(2),
        displayTotalPrice: convertAmount(parseFloat(item.totalPrice), exchangeRate).toFixed(2),
      }));

      const printSnapshotJson = {
        type: "quotation",
        quotationId,
        quotationNumber: quotation.quotationNumber,
        title: quotation.title,
        description: quotation.description,
        status: quotation.status,
        validUntil: quotation.validUntil,
        createdAt: quotation.createdAt,
        notes: quotation.notes,
        terms: quotation.terms,
        taxRate: quotation.taxRate,
        displayCurrency,
        exchangeRate: exchangeRate.toString(),
        clientName: client?.name,
        clientEmail: client?.email,
        clientPhone: client?.phone,
        clientAddress: client?.address,
        items: snapshotItems,
        egpSubtotal: egpSubtotal.toFixed(2),
        egpTaxAmount: egpTaxAmount.toFixed(2),
        egpDiscountAmount: egpDiscountAmount.toFixed(2),
        egpTotal: egpGrandTotal.toFixed(2),
        displaySubtotal: convertAmount(egpSubtotal, exchangeRate).toFixed(2),
        displayTaxAmount: convertAmount(egpTaxAmount, exchangeRate).toFixed(2),
        displayDiscountAmount: convertAmount(egpDiscountAmount, exchangeRate).toFixed(2),
        displayTotal: convertAmount(egpGrandTotal, exchangeRate).toFixed(2),
        printDate: new Date().toISOString(),
        companyName: process.env.COMPANY_NAME || "CompanyOS",
      };

      const [printRecord] = await db.insert(quotationPrintRecords).values({
        quotationId,
        displayCurrency,
        exchangeRate: exchangeRate.toString(),
        sourceTotalEgp: egpGrandTotal.toFixed(2),
        convertedTotal: convertedTotal.toFixed(2),
        printSnapshotJson,
        printedByUserId: req.user?.id,
      }).returning();

      // Optionally append to history
      try {
        const actor = req.user?.email || req.user?.username || "System";
        await db.insert(quotationHistory).values({
          quotationId,
          event: `Printed in ${displayCurrency}${displayCurrency !== "EGP" ? ` at rate ${exchangeRate.toFixed(2)}` : ""}`,
          actor,
        });
      } catch (_) {}

      res.json({
        printRecordId: printRecord.id,
        printUrl: `/quotations/print/${printRecord.id}`,
      });
    } catch (error) {
      console.error("Error creating quotation print record:", error);
      res.status(500).json({ message: "Failed to create print record" });
    }
  });

  // GET /api/quotation-print-records/:id — fetch single print record
  app.get('/api/quotation-print-records/:id', requirePermission("quotations", "view"), async (req: any, res) => {
    try {
      const [record] = await db.select().from(quotationPrintRecords).where(eq(quotationPrintRecords.id, req.params.id));
      if (!record) return res.status(404).json({ message: "Print record not found" });
      res.json(record);
    } catch (error) {
      console.error("Error fetching quotation print record:", error);
      res.status(500).json({ message: "Failed to fetch print record" });
    }
  });

  // GET /api/quotations/:id/print-records — list print records for a quotation
  app.get('/api/quotations/:id/print-records', requirePermission("quotations", "view"), async (req: any, res) => {
    try {
      const records = await db.select({
        id: quotationPrintRecords.id,
        displayCurrency: quotationPrintRecords.displayCurrency,
        exchangeRate: quotationPrintRecords.exchangeRate,
        convertedTotal: quotationPrintRecords.convertedTotal,
        printedAt: quotationPrintRecords.printedAt,
        printedByUserId: quotationPrintRecords.printedByUserId,
        printedByFirstName: users.firstName,
        printedByLastName: users.lastName,
        printedByEmail: users.email,
      }).from(quotationPrintRecords)
        .leftJoin(users, eq(quotationPrintRecords.printedByUserId, users.id))
        .where(eq(quotationPrintRecords.quotationId, req.params.id))
        .orderBy(desc(quotationPrintRecords.printedAt));
      res.json(records);
    } catch (error) {
      console.error("Error fetching quotation print records:", error);
      res.status(500).json({ message: "Failed to fetch print records" });
    }
  });
}
