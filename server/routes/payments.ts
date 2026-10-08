import type { Express } from "express";
import { db } from "../db";

import { logAudit } from "../audit";
import { parseMoney, parseDateValue, isAbsent } from "../validation";
import { requirePermission } from "../auth";
import { clients, invoices, payments, clientCreditHistory, activities, invoiceHistory } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { notificationService } from "../notification-service";

// Payments, refunds and client credit
export function registerPaymentsRoutes(app: Express) {

  // Payment Records CRUD
  app.get('/api/invoices/:id/payments', requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const paymentRecords = await db.select().from(payments).where(eq(payments.invoiceId, req.params.id));
      res.json(paymentRecords);
    } catch (error) {
      console.error("Error fetching payment records:", error);
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });

  app.post('/api/invoices/:id/payments', requirePermission("invoices", "approve"), async (req: any, res) => {
    try {
      const paymentAmount = parseMoney(req.body.amount);
      if (paymentAmount === null) {
        return res.status(400).json({ message: "Payment amount must be a positive number." });
      }
      const paymentDate = parseDateValue(req.body.paymentDate);
      if (!paymentDate) {
        return res.status(400).json({ message: "A valid payment date is required." });
      }
      if (typeof req.body.paymentMethod !== "string" || !req.body.paymentMethod.trim()) {
        return res.status(400).json({ message: "Payment method is required." });
      }
      const isAdminApproved = req.body.adminApproved || false;
      
      // Get current invoice and payment information
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.status === 'cancelled') {
        return res.status(400).json({ message: "Cannot record payments against a cancelled invoice." });
      }
      
      const [paidSumResult] = await db.select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`
      }).from(payments).where(eq(payments.invoiceId, req.params.id));
      const currentPaidAmount = parseFloat(paidSumResult?.total || '0');
      const invoiceAmount = parseFloat(invoice.amount);
      const remainingAmount = invoiceAmount - currentPaidAmount;
      
      // Check for overpayment
      const overpaymentAmount = Math.max(0, paymentAmount - remainingAmount);
      const isOverpayment = overpaymentAmount > 0;
      
      // If overpayment and not admin approved, return error with warning
      if (isOverpayment && !isAdminApproved) {
        return res.status(400).json({ 
          error: "OVERPAYMENT_DETECTED",
          message: `Payment amount ($${paymentAmount}) exceeds remaining balance ($${remainingAmount}). Overpayment of $${overpaymentAmount} detected.`,
          details: {
            paymentAmount,
            remainingAmount,
            overpaymentAmount,
            invoiceAmount,
            currentPaidAmount
          }
        });
      }
      
      // Create payment record with overpayment information
      const paymentData = {
        invoiceId: req.params.id,
        amount: paymentAmount.toFixed(2),
        overpaymentAmount: overpaymentAmount.toFixed(2),
        isOverpayment,
        adminApproved: isOverpayment && isAdminApproved,
        paymentDate,
        paymentMethod: req.body.paymentMethod,
        bankTransferNumber: req.body.bankTransferNumber || null,
        attachmentUrl: req.body.attachmentUrl || null,
        notes: req.body.notes || null,
        createdBy: req.user?.id,
        approvedBy: isOverpayment && isAdminApproved ? req.user?.id : null,
      };

      const [newPayment] = await db.insert(payments).values(paymentData).returning();
      
      // Calculate new totals including this payment
      const newTotalPaid = currentPaidAmount + paymentAmount;
      const actualInvoicePayment = Math.min(paymentAmount, remainingAmount);
      const newInvoicePaidAmount = currentPaidAmount + actualInvoicePayment;
      
      // Update invoice status
      let newStatus = invoice.status;
      let paidDate = invoice.paidDate;
      
      if (newInvoicePaidAmount >= invoiceAmount) {
        newStatus = 'paid';
        paidDate = new Date();
      } else if (newInvoicePaidAmount > 0) {
        newStatus = 'partially_paid';
      }
      
      await db.update(invoices)
        .set({ 
          paidAmount: newInvoicePaidAmount.toFixed(2),
          status: newStatus,
          paidDate: paidDate,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.id));
      
      // Handle overpayment as client credit
      if (isOverpayment && isAdminApproved) {
        // Get client's current credit balance
        const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId));
        const previousCreditBalance = parseFloat(client.creditBalance || "0");
        const newCreditBalance = previousCreditBalance + overpaymentAmount;
        
        // Update client credit balance
        await db.update(clients)
          .set({ 
            creditBalance: newCreditBalance.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(clients.id, invoice.clientId));
        
        // Record credit history
        await db.insert(clientCreditHistory).values({
          clientId: invoice.clientId,
          type: 'credit_added',
          amount: overpaymentAmount.toFixed(2),
          relatedInvoiceId: invoice.id,
          relatedPaymentId: newPayment.id,
          description: `Overpayment credit from invoice ${invoice.invoiceNumber}`,
          notes: `Payment amount: $${paymentAmount}, Invoice balance: $${remainingAmount}`,
          previousBalance: previousCreditBalance.toFixed(2),
          newBalance: newCreditBalance.toFixed(2),
          createdBy: req.user?.id,
        });
      }
      
      // Log activity and send notification for invoice payment
      if (newStatus === 'paid') {
        try {
          // Get client name for the activity description
          const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId));
          await db.insert(activities).values({
            type: 'invoice_paid',
            title: 'Invoice Paid',
            description: `Invoice ${invoice.invoiceNumber} for ${client?.name || 'Unknown Client'} has been fully paid`,
            entityType: 'invoice',
            entityId: invoice.id,
            createdBy: req.user?.id,
          });
          // Send notification to finance/management
          try {
            await notificationService.notifyInvoicePaid(
              invoice.id,
              client?.name || 'Unknown Client',
              newInvoicePaidAmount,
              (req as any).user?.id
            );
          } catch (notifyError) {
            console.error('Error sending invoice paid notification:', notifyError);
          }
        } catch (activityError) {
          console.error("Error logging activity:", activityError);
        }
      }

      await logAudit(req, "payment", "invoice", invoice.id, null, {
        amount: paymentAmount,
        method: req.body.paymentMethod,
        paymentId: newPayment.id,
        overpayment: isOverpayment ? overpaymentAmount : 0,
      });

      // Auto-update client totalValue based on all paid invoice amounts
      try {
        const [clientTotalSumResult] = await db.select({
          total: sql<string>`COALESCE(SUM(${invoices.paidAmount}), 0)`
        }).from(invoices).where(eq(invoices.clientId, invoice.clientId));
        const clientTotalPaidValue = parseFloat(clientTotalSumResult?.total || '0');
        
        await db.update(clients)
          .set({ 
            totalValue: clientTotalPaidValue.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(clients.id, invoice.clientId));
      } catch (clientUpdateError) {
        console.error("Error updating client total value:", clientUpdateError);
      }

      // Record history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        const paymentMethod = (req.body.paymentMethod || 'unknown').replace(/_/g, ' ');
        const eventText = isOverpayment && isAdminApproved
          ? `Payment of ${paymentAmount.toFixed(2)} recorded via ${paymentMethod} (overpayment of ${overpaymentAmount.toFixed(2)} added to client credit)`
          : `Payment of ${paymentAmount.toFixed(2)} recorded via ${paymentMethod}`;
        await db.insert(invoiceHistory).values({
          invoiceId: req.params.id,
          event: eventText,
          actor,
        });
      } catch (historyError) {
        console.error('Error recording invoice history:', historyError);
      }

      res.status(201).json({
        payment: newPayment,
        overpaymentHandled: isOverpayment && isAdminApproved,
        creditAdded: isOverpayment && isAdminApproved ? overpaymentAmount : 0
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  // Process invoice refund
  app.post('/api/invoices/:id/refund', requirePermission("invoices", "approve"), async (req: any, res) => {
    try {
      const { refundAmount, refundMethod, refundReference, notes } = req.body;
      const refundAmountNum = parseFloat(refundAmount);

      // Validate request
      if (!refundAmountNum || refundAmountNum <= 0) {
        return res.status(400).json({ message: "Invalid refund amount" });
      }

      // Get invoice
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const paidAmount = parseFloat(invoice.paidAmount || "0");
      
      // Validate refund amount doesn't exceed paid amount
      if (refundAmountNum > paidAmount) {
        return res.status(400).json({ 
          message: `Refund amount (${refundAmountNum}) cannot exceed paid amount (${paidAmount})` 
        });
      }

      // Create refund payment record (negative amount)
      const refundPayment = await db.insert(payments).values({
        invoiceId: req.params.id,
        amount: (-Math.abs(refundAmountNum)).toString(),
        paymentDate: new Date(),
        paymentMethod: refundMethod || "bank_transfer",
        bankTransferNumber: refundReference,
        notes: notes || `Partial refund: ${refundAmountNum}`,
        isRefund: true,
        refundReference: refundReference,
        createdBy: req.user?.id,
      }).returning().then(rows => rows[0]);

      // Update invoice paid amount and status
      const newPaidAmount = paidAmount - refundAmountNum;
      const invoiceAmount = parseFloat(invoice.amount || "0");
      let newStatus = invoice.status;
      
      // Determine new status based on refund amount
      if (newPaidAmount <= 0) {
        newStatus = "refunded";  // Fully refunded
      } else if (newPaidAmount < invoiceAmount) {
        newStatus = "partially_refunded";  // Partially refunded
      }
      
      await db.update(invoices)
        .set({ 
          paidAmount: newPaidAmount.toString(),
          status: newStatus,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.id));

      // Record refund history
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(invoiceHistory).values({
          invoiceId: req.params.id,
          event: `Refund of ${refundAmountNum.toFixed(2)} processed via ${refundMethod || 'bank transfer'} — status changed to "${newStatus}"`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording invoice history:", historyError);
      }

      await logAudit(req, "refund", "invoice", req.params.id, { paidAmount }, { refundAmount: refundAmountNum, newPaidAmount, newStatus });

      res.json({ 
        success: true, 
        refundAmount: refundAmountNum,
        refundPayment,
        newPaidAmount,
        newStatus,
        message: `Successfully processed refund of ${refundAmountNum}. Invoice status updated to ${newStatus}.`
      });
    } catch (error) {
      console.error("Error processing refund:", error);
      res.status(500).json({ message: "Failed to process refund" });
    }
  });

  // Process credit refund (convert credit balance to cash/bank transfer)
  app.post('/api/clients/:clientId/credit/refund', requirePermission("invoices", "approve"), async (req: any, res) => {
    try {
      const { refundAmount, refundMethod, refundReference, notes } = req.body;
      const refundAmountNum = parseFloat(refundAmount);

      // Validate request
      if (!refundAmountNum || refundAmountNum <= 0) {
        return res.status(400).json({ message: "Invalid refund amount" });
      }

      // Get client and current credit balance
      const [client] = await db.select().from(clients).where(eq(clients.id, req.params.clientId));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const availableCredit = parseFloat(client.creditBalance || "0");
      
      if (refundAmountNum > availableCredit) {
        return res.status(400).json({ 
          message: `Refund amount (${refundAmountNum}) cannot exceed available credit (${availableCredit})` 
        });
      }

      // Update client credit balance
      const newCreditBalance = availableCredit - refundAmountNum;
      await db.update(clients)
        .set({ 
          creditBalance: newCreditBalance.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(clients.id, req.params.clientId));

      // Record credit history
      await db.insert(clientCreditHistory).values({
        clientId: req.params.clientId,
        type: 'credit_refunded',
        amount: refundAmountNum.toFixed(2),
        description: `Credit refunded via ${refundMethod}${refundReference ? ` - Ref: ${refundReference}` : ''}`,
        notes: notes || `Credit balance refunded to client`,
        refundReference: refundReference,
        previousBalance: availableCredit.toFixed(2),
        newBalance: newCreditBalance.toFixed(2),
        createdBy: req.user?.id,
      });

      await logAudit(req, "credit_refund", "client", req.params.clientId, { creditBalance: availableCredit }, { refundAmount: refundAmountNum, newCreditBalance });

      res.json({ 
        success: true, 
        refundAmount: refundAmountNum,
        refundMethod,
        refundReference,
        newCreditBalance,
        message: `Successfully processed credit refund of ${refundAmountNum}`
      });
    } catch (error) {
      console.error("Error processing credit refund:", error);
      res.status(500).json({ message: "Failed to process credit refund" });
    }
  });

  // Apply client credit to invoice
  app.post('/api/invoices/:invoiceId/apply-credit', requirePermission("invoices", "approve"), async (req: any, res) => {
    try {
      const { creditAmount } = req.body;
      const creditAmountNum = parseMoney(creditAmount);
      if (creditAmountNum === null) {
        return res.status(400).json({ message: "Credit amount must be a positive number." });
      }

      // Credit always comes from the invoice's own client
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (!isAbsent(req.body.clientId) && req.body.clientId !== invoice.clientId) {
        return res.status(400).json({ message: "Credit can only be applied to invoices of the same client." });
      }
      const clientId = invoice.clientId;

      // Validate client and credit balance
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const currentCreditBalance = parseFloat(client.creditBalance || "0");
      if (creditAmountNum > currentCreditBalance) {
        return res.status(400).json({ 
          message: "Insufficient credit balance",
          availableCredit: currentCreditBalance,
          requestedCredit: creditAmountNum
        });
      }
      
      const [creditPaidSumResult] = await db.select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`
      }).from(payments).where(eq(payments.invoiceId, req.params.invoiceId));
      const currentPaidAmount = parseFloat(creditPaidSumResult?.total || '0');
      const remainingAmount = parseFloat(invoice.amount) - currentPaidAmount;
      
      const actualCreditUsed = Math.min(creditAmountNum, remainingAmount);
      
      // Create credit payment record
      const creditPayment = {
        invoiceId: req.params.invoiceId,
        amount: actualCreditUsed.toFixed(2),
        overpaymentAmount: "0",
        isOverpayment: false,
        adminApproved: true,
        paymentDate: new Date(),
        paymentMethod: 'credit_balance',
        bankTransferNumber: null,
        attachmentUrl: null,
        notes: `Applied client credit balance: $${actualCreditUsed}`,
        createdBy: req.user?.id,
        approvedBy: req.user?.id,
      };
      
      const [newPayment] = await db.insert(payments).values(creditPayment).returning();
      
      // Update client credit balance
      const newCreditBalance = currentCreditBalance - actualCreditUsed;
      await db.update(clients)
        .set({ 
          creditBalance: newCreditBalance.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(clients.id, clientId));
      
      // Record credit history
      await db.insert(clientCreditHistory).values({
        clientId: clientId,
        type: 'credit_used',
        amount: actualCreditUsed.toFixed(2),
        relatedInvoiceId: invoice.id,
        relatedPaymentId: newPayment.id,
        description: `Credit applied to invoice ${invoice.invoiceNumber}`,
        notes: `Credit balance applied to outstanding invoice`,
        previousBalance: currentCreditBalance.toFixed(2),
        newBalance: newCreditBalance.toFixed(2),
        createdBy: req.user?.id,
      });
      
      // Update invoice status
      const newPaidAmount = currentPaidAmount + actualCreditUsed;
      let newStatus = invoice.status;
      let paidDate = invoice.paidDate;
      
      if (newPaidAmount >= parseFloat(invoice.amount)) {
        newStatus = 'paid';
        paidDate = new Date();
      } else if (newPaidAmount > 0) {
        newStatus = 'partially_paid';
      }
      
      await db.update(invoices)
        .set({ 
          paidAmount: newPaidAmount.toFixed(2),
          status: newStatus,
          paidDate: paidDate,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.invoiceId));

      // Record history for credit application
      try {
        const actor = req.user?.email || req.user?.username || 'System';
        await db.insert(invoiceHistory).values({
          invoiceId: req.params.invoiceId,
          event: `Client credit of ${actualCreditUsed.toFixed(2)} applied — status updated to "${newStatus}"`,
          actor,
        });
      } catch (historyError) {
        console.error("Error recording invoice history:", historyError);
      }
      
      await logAudit(req, "apply_credit", "invoice", req.params.invoiceId, null, { clientId, creditUsed: actualCreditUsed, remainingCredit: newCreditBalance });

      res.json({
        payment: newPayment,
        creditUsed: actualCreditUsed,
        remainingCredit: newCreditBalance
      });
    } catch (error) {
      console.error("Error applying credit:", error);
      res.status(500).json({ message: "Failed to apply credit" });
    }
  });
}
