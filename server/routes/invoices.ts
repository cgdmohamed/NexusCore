import type { Express } from "express";
import { db, badRequestFromDbError } from "../db";
import { resolveUploadPath } from "../uploads";
import { logAudit } from "../audit";
import { parseMoney, parsePercent, parseDateValue, isAbsent } from "../validation";
import { requirePermission } from "../auth";
import { clients, invoices, invoiceItems, payments, users, invoiceHistory, invoicePrintRecords } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

import fs from "fs";
import QRCode from "qrcode";
import { lockNumbering, generateInvoiceNumber, statusAfterTotalChange, guardInvoiceItemChange, uploadInvoiceFile, VALID_CURRENCIES, convertAmount, isIncludedPrintItem } from "./shared";

// Invoices: lifecycle, items, attachments, QR codes, print records
export function registerInvoicesRoutes(app: Express) {

  app.patch('/api/invoices/:id/status', requirePermission("invoices", "edit"), async (req: any, res) => {
    try {
      const updateData: any = { 
        status: req.body.status, 
        updatedAt: new Date() 
      };
      
      if (req.body.status === 'paid') {
        updateData.paidDate = new Date();
        updateData.paidAmount = updateData.amount;
      }

      const [updatedInvoice] = await db.update(invoices)
        .set(updateData)
        .where(eq(invoices.id, req.params.id))
        .returning();
      res.json(updatedInvoice);

      // Record history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(invoiceHistory).values({
          invoiceId: req.params.id,
          event: `Status changed to ${req.body.status}`,
          actor,
        });
      } catch (historyError) {
        console.error('Error recording invoice history:', historyError);
      }
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });

  // Invoice history endpoint
  app.get('/api/invoices/:id/history', requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const history = await db.select().from(invoiceHistory)
        .where(eq(invoiceHistory.invoiceId, req.params.id))
        .orderBy(desc(invoiceHistory.createdAt));
      res.json(history);
    } catch (error) {
      console.error("Error fetching invoice history:", error);
      res.status(500).json({ message: "Failed to fetch invoice history" });
    }
  });

  // Cancel invoice - blocks further payments, excluded from revenue
  app.post('/api/invoices/:id/cancel', requirePermission("invoices", "approve"), async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.status === 'cancelled') {
        return res.status(400).json({ message: "Invoice is already cancelled" });
      }

      // Block cancellation of paid/refunded invoices unless paidAmount is 0 (fully refunded)
      const paidAmount = parseFloat(invoice.paidAmount || '0');
      if ((invoice.status === 'paid' || invoice.status === 'refunded') && paidAmount > 0) {
        return res.status(400).json({ 
          message: "Paid invoices cannot be cancelled. Process a full refund first to zero the paid amount." 
        });
      }

      const [updated] = await db.update(invoices)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId))
        .returning();

      // Record history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(invoiceHistory).values({
          invoiceId,
          event: 'Invoice cancelled',
          actor,
        });
      } catch (historyError) {
        console.error('Error recording invoice history:', historyError);
      }

      await logAudit(req, "cancel", "invoice", invoiceId, { status: invoice.status }, { status: "cancelled" });

      res.json(updated);
    } catch (error) {
      console.error("Error cancelling invoice:", error);
      res.status(500).json({ message: "Failed to cancel invoice" });
    }
  });

  // Invoice QR code - generate or upload
  app.post('/api/invoices/:id/qr-code', requirePermission("invoices", "edit"), async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      let qrCodeImage: string;

      if (req.body.generate) {
        // Auto-generate QR code encoding the invoice number/URL
        const qrContent = `${process.env.APP_URL || 'https://app.company.com'}/invoices/${invoiceId} | ${invoice.invoiceNumber}`;
        qrCodeImage = await QRCode.toDataURL(qrContent, { 
          width: 256, 
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
      } else if (req.body.imageData) {
        // Use uploaded base64 image — validate SVG or PNG only
        const imageData: string = req.body.imageData;
        const isPng = imageData.startsWith('data:image/png;base64,');
        const isSvg = imageData.startsWith('data:image/svg+xml;base64,');
        if (!isPng && !isSvg) {
          return res.status(400).json({ message: "Only PNG and SVG images are accepted for QR codes" });
        }
        // Basic size guard: 512 KB max for base64 payload
        if (imageData.length > 700000) {
          return res.status(400).json({ message: "QR code image exceeds the 512 KB size limit" });
        }
        qrCodeImage = imageData;
      } else {
        return res.status(400).json({ message: "Either 'generate: true' or 'imageData' must be provided" });
      }

      const [updated] = await db.update(invoices)
        .set({ qrCodeImage, updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId))
        .returning();

      // Record history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        const eventText = req.body.generate ? 'QR code generated' : 'Custom QR code uploaded';
        await db.insert(invoiceHistory).values({ invoiceId, event: eventText, actor });
      } catch (historyError) {
        console.error('Error recording invoice history:', historyError);
      }

      res.json({ success: true, qrCodeImage: updated.qrCodeImage });
    } catch (error) {
      console.error("Error setting invoice QR code:", error);
      res.status(500).json({ message: "Failed to set QR code" });
    }
  });

  // Invoice QR code - delete
  app.delete('/api/invoices/:id/qr-code', requirePermission("invoices", "edit"), async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      await db.update(invoices)
        .set({ qrCodeImage: null, updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId));

      // Record history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(invoiceHistory).values({ invoiceId, event: 'QR code removed', actor });
      } catch (historyError) {
        console.error('Error recording invoice history:', historyError);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing invoice QR code:", error);
      res.status(500).json({ message: "Failed to remove QR code" });
    }
  });

  // Invoices - using real database
  app.get('/api/invoices', requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const invoicesData = await db.select().from(invoices);
      res.json(invoicesData);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post('/api/invoices', requirePermission("invoices", "add"), async (req: any, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (typeof req.body.clientId !== "string" || !req.body.clientId) {
        return res.status(400).json({ message: "clientId is required." });
      }
      const [invoiceClient] = await db.select({ id: clients.id, status: clients.status }).from(clients).where(eq(clients.id, req.body.clientId));
      if (!invoiceClient) {
        return res.status(400).json({ message: "Client not found." });
      }
      if (invoiceClient.status === "archived") {
        return res.status(409).json({ message: "This client is archived. Restore it before creating new invoices." });
      }

      const money = (field: string) => (isAbsent(req.body[field]) ? undefined : parseMoney(req.body[field], { allowZero: true }));
      const percent = (field: string) => (isAbsent(req.body[field]) ? undefined : parsePercent(req.body[field]));
      const invalidFields = ["amount", "subtotal", "taxAmount", "discountAmount"].filter((f) => money(f) === null)
        .concat(["taxRate", "discountRate"].filter((f) => percent(f) === null));
      if (invalidFields.length > 0) {
        return res.status(400).json({
          message: `Invalid value for: ${invalidFields.join(", ")}. Amounts must be non-negative numbers and rates between 0 and 100.`,
        });
      }

      const baseInvoiceData = {
        clientId: req.body.clientId,
        quotationId: req.body.quotationId || null,
        title: req.body.title || 'New Invoice',
        description: req.body.description || null,
        amount: req.body.amount || '0',
        subtotal: req.body.subtotal || req.body.amount || '0',
        taxRate: req.body.taxRate || '0',
        taxAmount: req.body.taxAmount || '0',
        discountRate: req.body.discountRate || '0',
        discountAmount: req.body.discountAmount || '0',
        paidAmount: '0',
        status: 'draft',
        invoiceDate: new Date(),
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: req.body.notes || null,
        paymentTerms: req.body.paymentTerms || null,
        createdBy: req.user.id,
      };

      const newInvoice = await db.transaction(async (tx) => {
        await lockNumbering(tx, "invoice_number");
        const invoiceNumber = await generateInvoiceNumber(tx);
        const [created] = await tx.insert(invoices).values({ ...baseInvoiceData, invoiceNumber }).returning();
        return created;
      });

      // Record creation history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(invoiceHistory).values({
          invoiceId: newInvoice.id,
          event: `Invoice ${newInvoice.invoiceNumber} created`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording invoice history:", historyError);
      }

      res.status(201).json(newInvoice);
    } catch (error) {
      const badRequest = badRequestFromDbError(error);
      if (badRequest) return res.status(400).json({ message: badRequest });
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Get specific invoice with details
  app.get('/api/invoices/:id', requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Update invoice
  app.patch('/api/invoices/:id', requirePermission("invoices", "edit"), async (req: any, res) => {
    try {
      // Get current invoice to calculate new total if tax/discount changed
      const [currentInvoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      if (!currentInvoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Only these fields may be edited here. Status, numbers, amounts paid, client and ownership are
      // changed through their dedicated endpoints (payments, cancel, items, ...) and never directly.
      const body = req.body ?? {};
      const updateData: Record<string, any> = { updatedAt: new Date() };
      const changed: string[] = [];

      if (typeof body.title === "string" && body.title.trim()) { updateData.title = body.title; changed.push("title"); }
      for (const field of ["description", "notes", "paymentTerms"] as const) {
        if (body[field] === null || typeof body[field] === "string") { updateData[field] = body[field] || null; changed.push(field); }
      }
      if (body.dueDate !== undefined) {
        const due = body.dueDate === null || body.dueDate === "" ? null : parseDateValue(body.dueDate);
        if (due === null && body.dueDate !== null && body.dueDate !== "") {
          return res.status(400).json({ message: "dueDate must be a valid date." });
        }
        updateData.dueDate = due;
        changed.push("dueDate");
      }

      const moneyFields = ["taxAmount", "discountAmount"].filter((f) => body[f] !== undefined);
      const rateFields = ["taxRate", "discountRate"].filter((f) => body[f] !== undefined);
      const invalid = moneyFields.filter((f) => parseMoney(body[f], { allowZero: true }) === null)
        .concat(rateFields.filter((f) => parsePercent(body[f]) === null));
      if (invalid.length > 0) {
        return res.status(400).json({
          message: `Invalid value for: ${invalid.join(", ")}. Amounts must be non-negative numbers and rates between 0 and 100.`,
        });
      }

      if (moneyFields.length > 0 || rateFields.length > 0) {
        if (currentInvoice.status === "cancelled") {
          return res.status(409).json({ message: "The financial details of a cancelled invoice cannot be changed." });
        }
        for (const f of [...moneyFields, ...rateFields]) {
          updateData[f] = parseFloat(body[f]).toFixed(2);
          changed.push(f);
        }

        // The total is always derived: subtotal + tax - discount
        const subtotal = parseFloat(currentInvoice.subtotal || '0');
        const taxAmount = parseFloat(updateData.taxAmount ?? currentInvoice.taxAmount ?? '0');
        const discountAmount = parseFloat(updateData.discountAmount ?? currentInvoice.discountAmount ?? '0');
        const newTotal = subtotal + taxAmount - discountAmount;
        if (newTotal < parseFloat(currentInvoice.paidAmount || '0') - 0.005) {
          return res.status(400).json({
            message: "This change would reduce the invoice total below the amount already paid. Refund the difference first.",
          });
        }
        updateData.amount = newTotal.toFixed(2);
        Object.assign(updateData, statusAfterTotalChange(currentInvoice, newTotal));
      }

      const [updatedInvoice] = await db.update(invoices)
        .set(updateData)
        .where(eq(invoices.id, req.params.id))
        .returning();

      // Record edit history — summarise changed fields
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        const changedFields = changed;
        if (changedFields.length > 0) {
          const fieldLabels: Record<string, string> = {
            title: 'title', dueDate: 'due date', notes: 'notes',
            paymentTerms: 'payment terms', taxRate: 'tax rate',
            taxAmount: 'tax amount', discountRate: 'discount rate',
            discountAmount: 'discount amount', description: 'description',
          };
          const readable = changedFields.map(f => fieldLabels[f] || f).join(', ');
          await db.insert(invoiceHistory).values({
            invoiceId: req.params.id,
            event: `Invoice details updated (${readable})`,
            actor,
          });
        }
      } catch (historyError) {
        console.error("Error recording invoice history:", historyError);
      }
      
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Delete invoice with all items and payments (only draft invoices)
  // Invoices are never deleted (they are financial records). Use /cancel to void one.
  app.delete('/api/invoices/:id', requirePermission("invoices", "delete"), async (req: any, res) => {
    try {
      const [invoice] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.id, req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.status(409).json({
        message: "Invoices cannot be deleted. Cancel the invoice instead; it stays on record.",
      });
    } catch (error) {
      console.error("Error handling invoice delete:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Invoice Items CRUD
  app.get('/api/invoices/:id/items', requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.id));
      res.json(items);
    } catch (error) {
      console.error("Error fetching invoice items:", error);
      res.status(500).json({ message: "Failed to fetch invoice items" });
    }
  });

  app.post('/api/invoices/:id/items', requirePermission("invoices", "edit"), async (req: any, res) => {
    try {
      const quantity = parseMoney(req.body.quantity);
      const unitPrice = parseMoney(req.body.unitPrice, { allowZero: true });
      if (quantity === null || unitPrice === null || parseMoney(quantity * unitPrice, { allowZero: true }) === null) {
        return res.status(400).json({ message: "Quantity must be positive and unit price must be a non-negative number." });
      }

      const guard = await guardInvoiceItemChange(req.params.id, quantity * unitPrice);
      if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

      const itemData = {
        invoiceId: req.params.id,
        serviceId: req.body.serviceId || null,
        name: req.body.name,
        description: req.body.description || null,
        quantity: req.body.quantity,
        unitPrice: req.body.unitPrice,
        totalPrice: (quantity * unitPrice).toFixed(2),
      };

      const [newItem] = await db.insert(invoiceItems).values(itemData).returning();
      
      // Recalculate invoice totals using DB SUM
      const [subtotalResult] = await db.select({
        subtotal: sql<string>`COALESCE(SUM(${invoiceItems.totalPrice}), 0)`
      }).from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.id));
      const subtotal = parseFloat(subtotalResult?.subtotal || '0');
      
      // Get invoice to preserve tax/discount calculations
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      const taxAmount = parseFloat(invoice?.taxAmount || '0');
      const discountAmount = parseFloat(invoice?.discountAmount || '0');
      const newTotal = subtotal + taxAmount - discountAmount;
      
      await db.update(invoices)
        .set({ 
          subtotal: subtotal.toFixed(2),
          amount: newTotal.toFixed(2),
          ...(invoice ? statusAfterTotalChange(invoice, newTotal) : {}),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.id));

      // Record item-added history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(invoiceHistory).values({
          invoiceId: req.params.id,
          event: `Item "${newItem.name}" added (qty: ${newItem.quantity}, unit price: ${parseFloat(newItem.unitPrice).toFixed(2)})`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording invoice history:", historyError);
      }

      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating invoice item:", error);
      res.status(500).json({ message: "Failed to create invoice item" });
    }
  });

  app.patch('/api/invoices/:invoiceId/items/:itemId', requirePermission("invoices", "edit"), async (req: any, res) => {
    try {
      const quantity = parseMoney(req.body.quantity);
      const unitPrice = parseMoney(req.body.unitPrice, { allowZero: true });
      if (quantity === null || unitPrice === null || parseMoney(quantity * unitPrice, { allowZero: true }) === null) {
        return res.status(400).json({ message: "Quantity must be positive and unit price must be a non-negative number." });
      }

      const [existingItem] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, req.params.itemId));
      const guard = await guardInvoiceItemChange(
        req.params.invoiceId,
        quantity * unitPrice - parseFloat(existingItem?.totalPrice || '0'),
      );
      if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

      const itemData = {
        name: req.body.name,
        description: req.body.description || null,
        quantity: req.body.quantity,
        unitPrice: req.body.unitPrice,
        totalPrice: (quantity * unitPrice).toFixed(2),
      };

      const [updatedItem] = await db.update(invoiceItems)
        .set(itemData)
        .where(eq(invoiceItems.id, req.params.itemId))
        .returning();
      
      // Recalculate invoice totals using DB SUM
      const [subtotalResult2] = await db.select({
        subtotal: sql<string>`COALESCE(SUM(${invoiceItems.totalPrice}), 0)`
      }).from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.invoiceId));
      const subtotal2 = parseFloat(subtotalResult2?.subtotal || '0');
      
      // Get invoice to preserve tax/discount calculations
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.invoiceId));
      const taxAmount = parseFloat(invoice?.taxAmount || '0');
      const discountAmount = parseFloat(invoice?.discountAmount || '0');
      const newTotal = subtotal2 + taxAmount - discountAmount;
      
      await db.update(invoices)
        .set({ 
          subtotal: subtotal2.toFixed(2),
          amount: newTotal.toFixed(2),
          ...(invoice ? statusAfterTotalChange(invoice, newTotal) : {}),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.invoiceId));

      // Record item-edited history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(invoiceHistory).values({
          invoiceId: req.params.invoiceId,
          event: `Item "${updatedItem.name}" updated (qty: ${updatedItem.quantity}, unit price: ${parseFloat(updatedItem.unitPrice).toFixed(2)})`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording invoice history:", historyError);
      }

      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating invoice item:", error);
      res.status(500).json({ message: "Failed to update invoice item" });
    }
  });

  app.delete('/api/invoices/:invoiceId/items/:itemId', requirePermission("invoices", "edit"), async (req: any, res) => {
    try {
      // Fetch item name before deleting for history
      const [deletedItem] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, req.params.itemId));

      const guard = await guardInvoiceItemChange(req.params.invoiceId, -parseFloat(deletedItem?.totalPrice || '0'));
      if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

      await db.delete(invoiceItems).where(eq(invoiceItems.id, req.params.itemId));
      
      // Recalculate invoice totals using DB SUM
      const [subtotalResult3] = await db.select({
        subtotal: sql<string>`COALESCE(SUM(${invoiceItems.totalPrice}), 0)`
      }).from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.invoiceId));
      const subtotal3 = parseFloat(subtotalResult3?.subtotal || '0');
      
      // Get invoice to preserve tax/discount calculations
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.invoiceId));
      const taxAmount = parseFloat(invoice?.taxAmount || '0');
      const discountAmount = parseFloat(invoice?.discountAmount || '0');
      const newTotal = subtotal3 + taxAmount - discountAmount;
      
      await db.update(invoices)
        .set({ 
          subtotal: subtotal3.toFixed(2),
          amount: newTotal.toFixed(2),
          ...(invoice ? statusAfterTotalChange(invoice, newTotal) : {}),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.invoiceId));

      // Record item-deleted history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(invoiceHistory).values({
          invoiceId: req.params.invoiceId,
          event: `Item "${deletedItem?.name || 'Unknown'}" removed from invoice`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording invoice history:", historyError);
      }
      
      res.json({ message: "Invoice item deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice item:", error);
      res.status(500).json({ message: "Failed to delete invoice item" });
    }
  });

  // Recalculate invoice totals and fix status (for fixing existing invoices after discount bug)
  app.post('/api/invoices/:id/recalculate', requirePermission("invoices", "edit"), async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      
      // Get invoice
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Get invoice subtotal using DB SUM
      const [recalcSubtotalResult] = await db.select({
        subtotal: sql<string>`COALESCE(SUM(${invoiceItems.totalPrice}), 0)`
      }).from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      const subtotal = parseFloat(recalcSubtotalResult?.subtotal || '0');
      
      // Calculate tax and discount amounts from rates if available
      const taxRate = parseFloat(invoice.taxRate || '0');
      const discountRate = parseFloat(invoice.discountRate || '0');
      
      // Use existing fixed amounts or calculate from rates
      let taxAmount = parseFloat(invoice.taxAmount || '0');
      let discountAmount = parseFloat(invoice.discountAmount || '0');
      
      // If rates are set but amounts are 0, recalculate
      if (taxRate > 0 && taxAmount === 0) {
        taxAmount = subtotal * (taxRate / 100);
      }
      if (discountRate > 0 && discountAmount === 0) {
        discountAmount = subtotal * (discountRate / 100);
      }
      
      // Calculate final amount
      const amount = subtotal + taxAmount - discountAmount;
      
      // Derive paidAmount from payments table (authoritative source)
      const [paymentsSum] = await db.select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`
      }).from(payments).where(eq(payments.invoiceId, invoiceId));
      const derivedPaidAmount = parseFloat(paymentsSum?.total || '0');
      
      // Determine correct status based on derived paidAmount vs new amount
      let newStatus = invoice.status;
      let paidDate = invoice.paidDate;
      
      if (derivedPaidAmount >= amount && amount > 0) {
        newStatus = 'paid';
        paidDate = paidDate || new Date();
      } else if (derivedPaidAmount > 0) {
        newStatus = 'partially_paid';
      } else if (invoice.status !== 'draft' && invoice.status !== 'cancelled') {
        newStatus = 'pending';
      }
      
      // Update invoice - sync paidAmount from payments table and recalculate status
      const [updatedInvoice] = await db.update(invoices)
        .set({
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          amount: amount.toFixed(2),
          paidAmount: derivedPaidAmount.toFixed(2),
          status: newStatus,
          paidDate: paidDate,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceId))
        .returning();
      
      res.json({
        invoice: updatedInvoice,
        message: `Invoice recalculated: Subtotal ${subtotal.toFixed(2)}, Tax ${taxAmount.toFixed(2)}, Discount ${discountAmount.toFixed(2)}, Total ${amount.toFixed(2)}, Paid ${derivedPaidAmount.toFixed(2)}, Status: ${newStatus}`
      });
    } catch (error) {
      console.error("Error recalculating invoice:", error);
      res.status(500).json({ message: "Failed to recalculate invoice" });
    }
  });

  // Invoice file attachments upload
  app.post('/api/invoices/:id/attachments', requirePermission("invoices", "edit"), uploadInvoiceFile.single('file'), async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Get existing invoice
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        // Delete uploaded file if invoice not found
        fs.unlinkSync(file.path);
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Create file path relative to the uploads folder
      const filePath = `/uploads/invoices/${file.filename}`;

      // Add to existing attachments array
      const existingAttachments = invoice.attachments || [];
      const newAttachments = [...existingAttachments, filePath];

      // Update invoice with new attachment
      const [updatedInvoice] = await db.update(invoices)
        .set({ attachments: newAttachments, updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId))
        .returning();

      res.json({
        success: true,
        attachment: filePath,
        invoice: updatedInvoice,
      });
    } catch (error) {
      console.error("Error uploading invoice attachment:", error);
      res.status(500).json({ message: "Failed to upload attachment" });
    }
  });

  // Delete invoice attachment
  app.delete('/api/invoices/:id/attachments', requirePermission("invoices", "edit"), async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      const { attachmentPath } = req.body;

      if (!attachmentPath) {
        return res.status(400).json({ message: "Attachment path is required" });
      }

      // Get existing invoice
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Remove from attachments array
      const existingAttachments = invoice.attachments || [];
      if (!existingAttachments.includes(attachmentPath)) {
        return res.status(404).json({ message: "Attachment not found on this invoice" });
      }
      const newAttachments = existingAttachments.filter(a => a !== attachmentPath);

      // Update invoice
      const [updatedInvoice] = await db.update(invoices)
        .set({ attachments: newAttachments, updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId))
        .returning();

      // Delete the file from disk
      const fullPath = resolveUploadPath(attachmentPath);
      if (fullPath && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      res.json({
        success: true,
        invoice: updatedInvoice,
      });
    } catch (error) {
      console.error("Error deleting invoice attachment:", error);
      res.status(500).json({ message: "Failed to delete attachment" });
    }
  });

  // POST /api/invoices/:id/print — create print record & return printUrl
  app.post('/api/invoices/:id/print', requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      const { displayCurrency, exchangeRate: rateStr } = req.body;

      if (!VALID_CURRENCIES.includes(displayCurrency)) {
        return res.status(400).json({ message: "displayCurrency must be one of EGP, USD, SAR" });
      }

      const exchangeRate = displayCurrency === "EGP" ? 1 : parseFloat(rateStr);
      if (displayCurrency !== "EGP" && (isNaN(exchangeRate) || exchangeRate <= 0)) {
        return res.status(400).json({ message: "exchangeRate must be greater than 0 for non-EGP currencies" });
      }

      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      const [client] = invoice.clientId
        ? await db.select().from(clients).where(eq(clients.id, invoice.clientId))
        : [undefined];

      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

      const [iPrintSum] = await db.select({
        totalSum: sql<string>`COALESCE(SUM(${invoiceItems.totalPrice}), 0)`,
      }).from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      const egpSubtotal = parseFloat(iPrintSum?.totalSum || '0');
      const egpTaxAmount = parseFloat(invoice.taxAmount || "0");
      const egpDiscountAmount = parseFloat(invoice.discountAmount || "0");
      const egpGrandTotal = egpSubtotal + egpTaxAmount - egpDiscountAmount;
      const egpPaidAmount = parseFloat(invoice.paidAmount || "0");

      const snapshotItems = items.map(item => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        discount: "0",
        egpUnitPrice: item.unitPrice,
        egpTotalPrice: item.totalPrice,
        isIncluded: isIncludedPrintItem(item.unitPrice, item.totalPrice),
        displayUnitPrice: convertAmount(parseFloat(item.unitPrice), exchangeRate).toFixed(2),
        displayTotalPrice: convertAmount(parseFloat(item.totalPrice), exchangeRate).toFixed(2),
      }));

      const printSnapshotJson = {
        type: "invoice",
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        description: invoice.description,
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        paymentTerms: invoice.paymentTerms,
        taxRate: invoice.taxRate,
        qrCodeImage: invoice.qrCodeImage,
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
        egpPaidAmount: egpPaidAmount.toFixed(2),
        displaySubtotal: convertAmount(egpSubtotal, exchangeRate).toFixed(2),
        displayTaxAmount: convertAmount(egpTaxAmount, exchangeRate).toFixed(2),
        displayDiscountAmount: convertAmount(egpDiscountAmount, exchangeRate).toFixed(2),
        displayTotal: convertAmount(egpGrandTotal, exchangeRate).toFixed(2),
        displayPaidAmount: convertAmount(egpPaidAmount, exchangeRate).toFixed(2),
        printDate: new Date().toISOString(),
        companyName: process.env.COMPANY_NAME || "CompanyOS",
        companyEmail: process.env.COMPANY_EMAIL || "",
        companyPhone: process.env.COMPANY_PHONE || "",
        companyAddress: process.env.COMPANY_ADDRESS || "",
      };

      const convertedTotal = convertAmount(egpGrandTotal, exchangeRate);

      const [printRecord] = await db.insert(invoicePrintRecords).values({
        invoiceId,
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
        await db.insert(invoiceHistory).values({
          invoiceId,
          event: `Printed in ${displayCurrency}${displayCurrency !== "EGP" ? ` at rate ${exchangeRate.toFixed(2)}` : ""}`,
          actor,
        });
      } catch (_) {}

      res.json({
        printRecordId: printRecord.id,
        printUrl: `/invoices/print/${printRecord.id}`,
      });
    } catch (error) {
      console.error("Error creating invoice print record:", error);
      res.status(500).json({ message: "Failed to create print record" });
    }
  });

  // GET /api/invoice-print-records/:id — fetch single print record
  app.get('/api/invoice-print-records/:id', requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const [record] = await db.select().from(invoicePrintRecords).where(eq(invoicePrintRecords.id, req.params.id));
      if (!record) return res.status(404).json({ message: "Print record not found" });
      res.json(record);
    } catch (error) {
      console.error("Error fetching invoice print record:", error);
      res.status(500).json({ message: "Failed to fetch print record" });
    }
  });

  // GET /api/invoices/:id/print-records — list print records for an invoice
  app.get('/api/invoices/:id/print-records', requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const records = await db.select({
        id: invoicePrintRecords.id,
        displayCurrency: invoicePrintRecords.displayCurrency,
        exchangeRate: invoicePrintRecords.exchangeRate,
        convertedTotal: invoicePrintRecords.convertedTotal,
        printedAt: invoicePrintRecords.printedAt,
        printedByUserId: invoicePrintRecords.printedByUserId,
        printedByFirstName: users.firstName,
        printedByLastName: users.lastName,
        printedByEmail: users.email,
      }).from(invoicePrintRecords)
        .leftJoin(users, eq(invoicePrintRecords.printedByUserId, users.id))
        .where(eq(invoicePrintRecords.invoiceId, req.params.id))
        .orderBy(desc(invoicePrintRecords.printedAt));
      res.json(records);
    } catch (error) {
      console.error("Error fetching invoice print records:", error);
      res.status(500).json({ message: "Failed to fetch print records" });
    }
  });
}
