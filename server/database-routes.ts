import type { Express } from "express";
import { db } from "./db";
import { clients, tasks, expenses, quotations, invoices, invoiceItems, payments, clientCreditHistory, users, quotationItems, services, clientNotes, employees, activities } from "@shared/schema";
import { eq, sql, count } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for invoice file uploads
const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "invoices");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `invoice-${uniqueSuffix}${ext}`);
  },
});

const uploadInvoiceFile = multer({
  storage: invoiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed."));
    }
  },
});

export function setupDatabaseRoutes(app: Express) {
  // Status update endpoints for all entities
  app.patch('/api/clients/:id/status', async (req, res) => {
    try {
      const [updatedClient] = await db.update(clients)
        .set({ status: req.body.status, updatedAt: new Date() })
        .where(eq(clients.id, req.params.id))
        .returning();
      res.json(updatedClient);
    } catch (error) {
      console.error("Error updating client status:", error);
      res.status(500).json({ message: "Failed to update client status" });
    }
  });

  app.patch('/api/tasks/:id/status', async (req, res) => {
    try {
      const updateData: any = { 
        status: req.body.status, 
        updatedAt: new Date() 
      };
      
      if (req.body.status === 'completed') {
        updateData.completedDate = new Date();
      }

      const [updatedTask] = await db.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, req.params.id))
        .returning();
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ message: "Failed to update task status" });
    }
  });

  app.patch('/api/expenses/:id/status', async (req, res) => {
    try {
      const [updatedExpense] = await db.update(expenses)
        .set({ status: req.body.status, updatedAt: new Date() })
        .where(eq(expenses.id, req.params.id))
        .returning();
      res.json(updatedExpense);
    } catch (error) {
      console.error("Error updating expense status:", error);
      res.status(500).json({ message: "Failed to update expense status" });
    }
  });

  app.patch('/api/quotations/:id/status', async (req, res) => {
    try {
      const [updatedQuotation] = await db.update(quotations)
        .set({ status: req.body.status, updatedAt: new Date() })
        .where(eq(quotations.id, req.params.id))
        .returning();
      res.json(updatedQuotation);
    } catch (error) {
      console.error("Error updating quotation status:", error);
      res.status(500).json({ message: "Failed to update quotation status" });
    }
  });

  app.patch('/api/invoices/:id/status', async (req, res) => {
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
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });

  // Sidebar counters endpoint
  app.get('/api/sidebar/counters', async (req, res) => {
    try {
      const [clientsResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(clients);
      const [quotationsResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(quotations);
      const [invoicesResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices);
      const [expensesResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(expenses);
      const [employeesResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(employees);
      const [tasksResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(tasks);
      
      const counters = {
        clients: Number(clientsResult?.count || 0),
        quotations: Number(quotationsResult?.count || 0),
        invoices: Number(invoicesResult?.count || 0),
        expenses: Number(expensesResult?.count || 0),
        employees: Number(employeesResult?.count || 0),
        tasks: Number(tasksResult?.count || 0),
      };
      
      res.json(counters);
    } catch (error) {
      console.error("Error fetching sidebar counters:", error);
      res.status(500).json({ message: "Failed to fetch counters" });
    }
  });

  // Dashboard KPIs - real database data
  app.get('/api/dashboard/kpis', async (req, res) => {
    try {
      // Total Revenue from invoices
      const [revenueResult] = await db.select({ 
        total: sql<number>`COALESCE(SUM(CAST(${invoices.paidAmount} AS DECIMAL)), 0)` 
      }).from(invoices);

      // Pending invoices amount
      const [pendingResult] = await db.select({ 
        total: sql<number>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(${invoices.paidAmount} AS DECIMAL)), 0)` 
      }).from(invoices).where(eq(invoices.status, 'pending'));

      // Total Expenses (approved)
      const [expensesResult] = await db.select({ 
        total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)` 
      }).from(expenses).where(eq(expenses.status, 'approved'));

      // Active clients count
      const [activeClientsResult] = await db.select({ 
        count: count() 
      }).from(clients).where(eq(clients.status, 'active'));

      // Quotation stats
      const [totalQuotationsResult] = await db.select({ count: count() }).from(quotations);
      const [acceptedQuotationsResult] = await db.select({ count: count() }).from(quotations).where(eq(quotations.status, 'accepted'));
      const [pendingQuotationsResult] = await db.select({ count: count() }).from(quotations).where(eq(quotations.status, 'pending'));

      // Invoice stats
      const [totalInvoicesResult] = await db.select({ count: count() }).from(invoices);
      const [paidInvoicesResult] = await db.select({ count: count() }).from(invoices).where(eq(invoices.status, 'paid'));
      const [pendingInvoicesResult] = await db.select({ count: count() }).from(invoices).where(eq(invoices.status, 'pending'));
      const [overdueInvoicesResult] = await db.select({ count: count() }).from(invoices).where(eq(invoices.status, 'overdue'));

      // Task stats
      const [totalTasksResult] = await db.select({ count: count() }).from(tasks);
      const [completedTasksResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'completed'));
      const [inProgressTasksResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'in_progress'));
      const [pendingTasksResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'pending'));

      const totalRevenue = parseFloat(revenueResult?.total?.toString() || '0');
      const totalExpenses = parseFloat(expensesResult?.total?.toString() || '0');
      const pendingAmount = parseFloat(pendingResult?.total?.toString() || '0');

      res.json({
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        pendingRevenue: pendingAmount,
        activeClients: activeClientsResult?.count || 0,
        quotations: {
          total: totalQuotationsResult?.count || 0,
          accepted: acceptedQuotationsResult?.count || 0,
          pending: pendingQuotationsResult?.count || 0,
          conversionRate: totalQuotationsResult?.count > 0 
            ? ((acceptedQuotationsResult?.count || 0) / totalQuotationsResult.count * 100).toFixed(1)
            : 0
        },
        invoices: {
          total: totalInvoicesResult?.count || 0,
          paid: paidInvoicesResult?.count || 0,
          pending: pendingInvoicesResult?.count || 0,
          overdue: overdueInvoicesResult?.count || 0
        },
        tasks: {
          total: totalTasksResult?.count || 0,
          completed: completedTasksResult?.count || 0,
          inProgress: inProgressTasksResult?.count || 0,
          pending: pendingTasksResult?.count || 0
        }
      });
    } catch (error) {
      console.error("Error fetching dashboard KPIs:", error);
      res.status(500).json({ message: "Failed to fetch dashboard KPIs" });
    }
  });

  // Clients - using real database
  app.get('/api/clients', async (req: any, res) => {
    try {
      const clientsData = await db.select().from(clients);
      res.json(clientsData);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.post('/api/clients', async (req: any, res) => {
    try {
      // Get the actual user ID from the session or use the first available user
      const userId = req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0';
      
      const clientData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        city: req.body.city,
        country: req.body.country,
        status: req.body.status || 'active',
        totalValue: req.body.totalValue || '0',
        createdBy: userId,
      };

      const [newClient] = await db.insert(clients).values(clientData).returning();

      // Log activity for client creation
      try {
        await db.insert(activities).values({
          type: 'client_added',
          title: 'New Client Added',
          description: `Client "${newClient.name}" was added to the system`,
          entityType: 'client',
          entityId: newClient.id,
          createdBy: userId,
        });
      } catch (activityError) {
        console.error("Error logging activity:", activityError);
      }

      res.status(201).json(newClient);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Tasks routes moved to task-management-routes.ts

  // Expenses routes are handled by expense-routes.ts

  // Quotations - using real database
  app.get('/api/quotations', async (req: any, res) => {
    try {
      const quotationsData = await db.select().from(quotations);
      res.json(quotationsData);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  app.post('/api/quotations', async (req: any, res) => {
    try {
      // Get the actual user ID from the session or use the first available user
      const userId = req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0';
      
      const quotationData = {
        quotationNumber: `QUO-2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        clientId: req.body.clientId,
        title: req.body.title,
        description: req.body.description,
        amount: 0, // Start with 0, will be calculated from items
        status: 'draft',
        validUntil: req.body.validUntil ? new Date(req.body.validUntil) : null,
        notes: req.body.notes || null,
        terms: req.body.terms || null,
        createdBy: userId,
      };

      const [newQuotation] = await db.insert(quotations).values(quotationData).returning();

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

      res.status(201).json(newQuotation);
    } catch (error) {
      console.error("Error creating quotation:", error);
      res.status(500).json({ message: "Failed to create quotation" });
    }
  });

  // Invoices - using real database
  app.get('/api/invoices', async (req: any, res) => {
    try {
      const invoicesData = await db.select().from(invoices);
      res.json(invoicesData);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post('/api/invoices', async (req: any, res) => {
    try {
      const invoiceData = {
        invoiceNumber: `INV-2025-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
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
        createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
      };

      const [newInvoice] = await db.insert(invoices).values(invoiceData).returning();
      res.status(201).json(newInvoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Get specific invoice with details
  app.get('/api/invoices/:id', async (req: any, res) => {
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
  app.patch('/api/invoices/:id', async (req: any, res) => {
    try {
      // Get current invoice to calculate new total if tax/discount changed
      const [currentInvoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      if (!currentInvoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const updateData = { ...req.body, updatedAt: new Date() };
      
      // Recalculate amount if tax or discount changed
      if (req.body.taxAmount !== undefined || req.body.discountAmount !== undefined || 
          req.body.taxRate !== undefined || req.body.discountRate !== undefined) {
        const subtotal = parseFloat(currentInvoice.subtotal || '0');
        const taxAmount = parseFloat(req.body.taxAmount ?? currentInvoice.taxAmount ?? '0');
        const discountAmount = parseFloat(req.body.discountAmount ?? currentInvoice.discountAmount ?? '0');
        updateData.amount = (subtotal + taxAmount - discountAmount).toFixed(2);
      }
      
      const [updatedInvoice] = await db.update(invoices)
        .set(updateData)
        .where(eq(invoices.id, req.params.id))
        .returning();
      
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Delete invoice with all items and payments (only draft invoices)
  app.delete('/api/invoices/:id', async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      
      // Check if invoice exists
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Only allow deletion of draft invoices
      if (invoice.status !== 'draft') {
        return res.status(400).json({ 
          message: "Only draft invoices can be deleted. Please cancel the invoice instead." 
        });
      }

      // Delete payments first (shouldn't have any for draft, but just in case)
      await db.delete(payments).where(eq(payments.invoiceId, invoiceId));

      // Delete invoice items
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

      // Delete the invoice
      await db.delete(invoices).where(eq(invoices.id, invoiceId));

      res.json({ success: true, message: "Invoice deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Invoice Items CRUD
  app.get('/api/invoices/:id/items', async (req: any, res) => {
    try {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.id));
      res.json(items);
    } catch (error) {
      console.error("Error fetching invoice items:", error);
      res.status(500).json({ message: "Failed to fetch invoice items" });
    }
  });

  app.post('/api/invoices/:id/items', async (req: any, res) => {
    try {
      const itemData = {
        invoiceId: req.params.id,
        serviceId: req.body.serviceId || null,
        name: req.body.name,
        description: req.body.description || null,
        quantity: req.body.quantity,
        unitPrice: req.body.unitPrice,
        totalPrice: (parseFloat(req.body.quantity) * parseFloat(req.body.unitPrice)).toFixed(2),
      };

      const [newItem] = await db.insert(invoiceItems).values(itemData).returning();
      
      // Recalculate invoice totals
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.id));
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
      
      // Get invoice to preserve tax/discount calculations
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      const taxAmount = parseFloat(invoice?.taxAmount || '0');
      const discountAmount = parseFloat(invoice?.discountAmount || '0');
      const newTotal = subtotal + taxAmount - discountAmount;
      
      await db.update(invoices)
        .set({ 
          subtotal: subtotal.toFixed(2),
          amount: newTotal.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.id));
      
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating invoice item:", error);
      res.status(500).json({ message: "Failed to create invoice item" });
    }
  });

  app.patch('/api/invoices/:invoiceId/items/:itemId', async (req: any, res) => {
    try {
      const itemData = {
        name: req.body.name,
        description: req.body.description || null,
        quantity: req.body.quantity,
        unitPrice: req.body.unitPrice,
        totalPrice: (parseFloat(req.body.quantity) * parseFloat(req.body.unitPrice)).toFixed(2),
      };

      const [updatedItem] = await db.update(invoiceItems)
        .set(itemData)
        .where(eq(invoiceItems.id, req.params.itemId))
        .returning();
      
      // Recalculate invoice totals
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.invoiceId));
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
      
      // Get invoice to preserve tax/discount calculations
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.invoiceId));
      const taxAmount = parseFloat(invoice?.taxAmount || '0');
      const discountAmount = parseFloat(invoice?.discountAmount || '0');
      const newTotal = subtotal + taxAmount - discountAmount;
      
      await db.update(invoices)
        .set({ 
          subtotal: subtotal.toFixed(2),
          amount: newTotal.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.invoiceId));
      
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating invoice item:", error);
      res.status(500).json({ message: "Failed to update invoice item" });
    }
  });

  app.delete('/api/invoices/:invoiceId/items/:itemId', async (req: any, res) => {
    try {
      await db.delete(invoiceItems).where(eq(invoiceItems.id, req.params.itemId));
      
      // Recalculate invoice totals
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.invoiceId));
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
      
      // Get invoice to preserve tax/discount calculations
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.invoiceId));
      const taxAmount = parseFloat(invoice?.taxAmount || '0');
      const discountAmount = parseFloat(invoice?.discountAmount || '0');
      const newTotal = subtotal + taxAmount - discountAmount;
      
      await db.update(invoices)
        .set({ 
          subtotal: subtotal.toFixed(2),
          amount: newTotal.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.invoiceId));
      
      res.json({ message: "Invoice item deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice item:", error);
      res.status(500).json({ message: "Failed to delete invoice item" });
    }
  });

  // Payment Records CRUD
  app.get('/api/invoices/:id/payments', async (req: any, res) => {
    try {
      const paymentRecords = await db.select().from(payments).where(eq(payments.invoiceId, req.params.id));
      res.json(paymentRecords);
    } catch (error) {
      console.error("Error fetching payment records:", error);
      res.status(500).json({ message: "Failed to fetch payment records" });
    }
  });

  app.post('/api/invoices/:id/payments', async (req: any, res) => {
    try {
      const paymentAmount = parseFloat(req.body.amount);
      const isAdminApproved = req.body.adminApproved || false;
      
      // Get current invoice and payment information
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const currentPayments = await db.select().from(payments).where(eq(payments.invoiceId, req.params.id));
      const currentPaidAmount = currentPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
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
        paymentDate: new Date(req.body.paymentDate),
        paymentMethod: req.body.paymentMethod,
        bankTransferNumber: req.body.bankTransferNumber || null,
        attachmentUrl: req.body.attachmentUrl || null,
        notes: req.body.notes || null,
        createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
        approvedBy: isOverpayment && isAdminApproved ? (req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0') : null,
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
          createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
        });
      }
      
      // Log activity for invoice payment
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
            createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
          });
        } catch (activityError) {
          console.error("Error logging activity:", activityError);
        }
      }

      // Auto-update client totalValue based on all paid invoice amounts
      try {
        const allClientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, invoice.clientId));
        const clientTotalPaidValue = allClientInvoices.reduce((sum, inv) => {
          return sum + parseFloat(inv.paidAmount || '0');
        }, 0);
        
        await db.update(clients)
          .set({ 
            totalValue: clientTotalPaidValue.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(clients.id, invoice.clientId));
      } catch (clientUpdateError) {
        console.error("Error updating client total value:", clientUpdateError);
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
  app.post('/api/invoices/:id/refund', async (req: any, res) => {
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
        createdBy: "1"
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
  app.post('/api/clients/:clientId/credit/refund', async (req: any, res) => {
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
        createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
      });

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

  // Get client credit balance and history
  app.get('/api/clients/:id/credit', async (req: any, res) => {
    try {
      const [client] = await db.select().from(clients).where(eq(clients.id, req.params.id));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const creditHistory = await db.select().from(clientCreditHistory)
        .where(eq(clientCreditHistory.clientId, req.params.id))
        .orderBy(sql`${clientCreditHistory.createdAt} DESC`);
      
      res.json({
        currentBalance: parseFloat(client.creditBalance || "0"),
        history: creditHistory
      });
    } catch (error) {
      console.error("Error fetching client credit:", error);
      res.status(500).json({ message: "Failed to fetch client credit" });
    }
  });

  // Apply client credit to invoice
  app.post('/api/invoices/:invoiceId/apply-credit', async (req: any, res) => {
    try {
      const { clientId, creditAmount } = req.body;
      const creditAmountNum = parseFloat(creditAmount);
      
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
      
      // Get invoice information
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      const currentPayments = await db.select().from(payments).where(eq(payments.invoiceId, req.params.invoiceId));
      const currentPaidAmount = currentPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
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
        createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
        approvedBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
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
        createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
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

  // Employees endpoint removed - now handled by user-management-routes.ts with real database data

  // Employee creation endpoint removed - now handled by user-management-routes.ts with real database data

  // Enhanced Client Profile Routes
  app.get('/api/clients/:id', async (req: any, res) => {
    try {
      const [client] = await db.select().from(clients).where(eq(clients.id, req.params.id));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.patch('/api/clients/:id', async (req: any, res) => {
    try {
      const [updatedClient] = await db.update(clients)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(clients.id, req.params.id))
        .returning();
      res.json(updatedClient);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  // Recalculate invoice totals and fix status (for fixing existing invoices after discount bug)
  app.post('/api/invoices/:id/recalculate', async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      
      // Get invoice
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Get invoice items and calculate subtotal
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice || '0'), 0);
      
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
      
      // Get the stored paidAmount - do NOT overwrite from payments to preserve manual adjustments
      const storedPaidAmount = parseFloat(invoice.paidAmount || '0');
      
      // Determine correct status based on stored paidAmount vs new amount
      let newStatus = invoice.status;
      let paidDate = invoice.paidDate;
      
      if (storedPaidAmount >= amount && amount > 0) {
        newStatus = 'paid';
        paidDate = paidDate || new Date();
      } else if (storedPaidAmount > 0) {
        newStatus = 'partially_paid';
      } else if (invoice.status !== 'draft' && invoice.status !== 'cancelled') {
        newStatus = 'pending';
      }
      
      // Update invoice - only update amount fields and status, preserve paidAmount
      const [updatedInvoice] = await db.update(invoices)
        .set({
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          amount: amount.toFixed(2),
          status: newStatus,
          paidDate: paidDate,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceId))
        .returning();
      
      res.json({
        invoice: updatedInvoice,
        message: `Invoice recalculated: Subtotal ${subtotal.toFixed(2)}, Tax ${taxAmount.toFixed(2)}, Discount ${discountAmount.toFixed(2)}, Total ${amount.toFixed(2)}, Paid ${storedPaidAmount.toFixed(2)}, Status: ${newStatus}`
      });
    } catch (error) {
      console.error("Error recalculating invoice:", error);
      res.status(500).json({ message: "Failed to recalculate invoice" });
    }
  });

  // Recalculate client value based on paid invoices
  app.post('/api/clients/:id/recalculate-value', async (req: any, res) => {
    try {
      const clientId = req.params.id;
      
      // Check if client exists
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Calculate total paid amount from all invoices for this client
      const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, clientId));
      const totalPaidValue = clientInvoices.reduce((sum, invoice) => {
        return sum + parseFloat(invoice.paidAmount || '0');
      }, 0);

      // Update client totalValue
      const [updatedClient] = await db.update(clients)
        .set({ 
          totalValue: totalPaidValue.toFixed(2),
          updatedAt: new Date() 
        })
        .where(eq(clients.id, clientId))
        .returning();

      res.json({
        client: updatedClient,
        message: `Client value recalculated: EGP ${totalPaidValue.toFixed(2)}`
      });
    } catch (error) {
      console.error("Error recalculating client value:", error);
      res.status(500).json({ message: "Failed to recalculate client value" });
    }
  });

  // Delete client with cascade (quotations, invoices, payments, notes, credit history)
  app.delete('/api/clients/:id', async (req: any, res) => {
    try {
      const clientId = req.params.id;
      
      // Check if client exists
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get all invoices for this client to delete their payments
      const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, clientId));
      const invoiceIds = clientInvoices.map(inv => inv.id);

      // Delete in order of dependencies (cascade delete)
      // 1. Delete payments for all client invoices
      if (invoiceIds.length > 0) {
        for (const invoiceId of invoiceIds) {
          await db.delete(payments).where(eq(payments.invoiceId, invoiceId));
        }
      }

      // 2. Delete invoice items
      if (invoiceIds.length > 0) {
        for (const invoiceId of invoiceIds) {
          await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
        }
      }

      // 3. Delete invoices
      await db.delete(invoices).where(eq(invoices.clientId, clientId));

      // 4. Get all quotations for this client
      const clientQuotations = await db.select().from(quotations).where(eq(quotations.clientId, clientId));
      const quotationIds = clientQuotations.map(q => q.id);

      // 5. Delete quotation items
      if (quotationIds.length > 0) {
        for (const quotationId of quotationIds) {
          await db.delete(quotationItems).where(eq(quotationItems.quotationId, quotationId));
        }
      }

      // 6. Delete quotations
      await db.delete(quotations).where(eq(quotations.clientId, clientId));

      // 7. Delete client notes
      await db.delete(clientNotes).where(eq(clientNotes.clientId, clientId));

      // 8. Delete client credit history
      await db.delete(clientCreditHistory).where(eq(clientCreditHistory.clientId, clientId));

      // 9. Finally delete the client
      await db.delete(clients).where(eq(clients.id, clientId));

      res.json({ success: true, message: "Client and all related data deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Client Related Data Routes
  app.get('/api/clients/:id/quotations', async (req: any, res) => {
    try {
      const clientQuotations = await db.select().from(quotations).where(eq(quotations.clientId, req.params.id));
      res.json(clientQuotations);
    } catch (error) {
      console.error("Error fetching client quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  app.get('/api/clients/:id/invoices', async (req: any, res) => {
    try {
      const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, req.params.id));
      res.json(clientInvoices);
    } catch (error) {
      console.error("Error fetching client invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get('/api/clients/:id/notes', async (req: any, res) => {
    try {
      const clientNotesList = await db.select().from(clientNotes).where(eq(clientNotes.clientId, req.params.id));
      res.json(clientNotesList);
    } catch (error) {
      console.error("Error fetching client notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post('/api/clients/:id/notes', async (req: any, res) => {
    try {
      const noteData = {
        clientId: req.params.id,
        note: req.body.note,
        type: req.body.type || 'note',
        createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
      };

      const [newNote] = await db.insert(clientNotes).values(noteData).returning();
      res.status(201).json(newNote);
    } catch (error) {
      console.error("Error creating client note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  // Services Management Routes
  app.get('/api/services', async (req: any, res) => {
    try {
      const servicesList = await db.select().from(services).where(eq(services.isActive, true));
      res.json(servicesList);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  // Initialize Default Services
  app.post('/api/services/initialize', async (req: any, res) => {
    try {
      const existingServices = await db.select().from(services);
      if (existingServices.length === 0) {
        const defaultServices = [
          { name: 'Web Design', description: 'Custom website design', defaultPrice: '2500.00', category: 'web-design' },
          { name: 'Web Development', description: 'Full-stack web development', defaultPrice: '5000.00', category: 'development' },
          { name: 'Mobile App Development', description: 'iOS and Android app development', defaultPrice: '8000.00', category: 'development' },
          { name: 'SEO Optimization', description: 'Search engine optimization services', defaultPrice: '1500.00', category: 'marketing' },
          { name: 'Digital Marketing', description: 'Comprehensive digital marketing campaign', defaultPrice: '3000.00', category: 'marketing' },
          { name: 'Business Consulting', description: 'Strategic business consultation', defaultPrice: '200.00', category: 'consulting' },
          { name: 'UI/UX Design', description: 'User interface and experience design', defaultPrice: '1800.00', category: 'web-design' },
          { name: 'E-commerce Solution', description: 'Complete e-commerce platform setup', defaultPrice: '6000.00', category: 'development' },
        ];

        await db.insert(services).values(defaultServices);
        res.json({ message: 'Default services initialized' });
      } else {
        res.json({ message: 'Services already exist' });
      }
    } catch (error) {
      console.error("Error initializing services:", error);
      res.status(500).json({ message: "Failed to initialize services" });
    }
  });

  // Quotation Items Management
  app.get('/api/quotations/:id/items', async (req: any, res) => {
    try {
      const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));
      res.json(items);
    } catch (error) {
      console.error("Error fetching quotation items:", error);
      res.status(500).json({ message: "Failed to fetch quotation items" });
    }
  });

  app.post('/api/quotations/:id/items', async (req: any, res) => {
    try {
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
      
      // Recalculate and update quotation amount
      const allItems = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));
      const totalAmount = allItems.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
      
      await db.update(quotations)
        .set({ amount: totalAmount.toFixed(2), updatedAt: new Date() })
        .where(eq(quotations.id, req.params.id));
      
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating quotation item:", error);
      res.status(500).json({ message: "Failed to create quotation item" });
    }
  });

  // Enhanced Quotation Management Routes
  app.get('/api/quotations/:id', async (req: any, res) => {
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

  app.patch('/api/quotations/:id', async (req: any, res) => {
    try {
      const updateData = { ...req.body, updatedAt: new Date() };
      
      // If updating amount, recalculate from items
      if (req.body.status && !req.body.amount) {
        const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));
        const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
        updateData.amount = totalAmount.toFixed(2);
      }

      const [updatedQuotation] = await db.update(quotations)
        .set(updateData)
        .where(eq(quotations.id, req.params.id))
        .returning();
      
      res.json(updatedQuotation);
    } catch (error) {
      console.error("Error updating quotation:", error);
      res.status(500).json({ message: "Failed to update quotation" });
    }
  });

  // Delete quotation with all items
  app.delete('/api/quotations/:id', async (req: any, res) => {
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
  app.post('/api/quotations/:id/convert-to-invoice', async (req: any, res) => {
    try {
      // Get quotation details
      const [quotation] = await db.select().from(quotations).where(eq(quotations.id, req.params.id));
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Get quotation items
      const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));
      
      // Calculate total from items
      const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);

      // Create invoice
      const invoiceData = {
        invoiceNumber: `INV-2024-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        clientId: quotation.clientId,
        quotationId: quotation.id,
        amount: totalAmount.toFixed(2),
        paidAmount: '0.00',
        status: 'pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdBy: req.user?.id || 'ab376fce-7111-44a1-8e2a-a3bc6f01e4a0',
      };

      const [newInvoice] = await db.insert(invoices).values(invoiceData).returning();

      // Update quotation status to invoiced
      await db.update(quotations)
        .set({ status: 'invoiced', updatedAt: new Date() })
        .where(eq(quotations.id, req.params.id));

      res.status(201).json({ invoice: newInvoice, message: "Quotation converted to invoice successfully" });
    } catch (error) {
      console.error("Error converting quotation to invoice:", error);
      res.status(500).json({ message: "Failed to convert quotation to invoice" });
    }
  });

  // Export quotation as PDF
  app.get('/api/quotations/:id/export-pdf', async (req: any, res) => {
    try {
      // Get quotation with client and items
      const [quotation] = await db.select().from(quotations).where(eq(quotations.id, req.params.id));
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      const [client] = await db.select().from(clients).where(eq(clients.id, quotation.clientId));
      const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, req.params.id));

      const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);

      // Generate HTML for PDF (simplified version)
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Quotation ${quotation.quotationNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 40px; }
            .company-info { margin-bottom: 30px; }
            .client-info { margin-bottom: 30px; }
            .quotation-details { margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>QUOTATION</h1>
            <p>Quotation Number: ${quotation.quotationNumber}</p>
          </div>
          
          <div class="company-info">
            <h3>CompanyOS</h3>
            <p>123 Business Street<br>
            Business City, BC 12345<br>
            Phone: (555) 123-4567<br>
            Email: info@companyos.com</p>
          </div>
          
          <div class="client-info">
            <h3>Bill To:</h3>
            <p><strong>${client?.name || 'N/A'}</strong><br>
            ${client?.email || ''}<br>
            ${client?.phone || ''}<br>
            ${client?.city || ''}, ${client?.country || ''}</p>
          </div>
          
          <div class="quotation-details">
            <p><strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString()}</p>
            <p><strong>Valid Until:</strong> ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Status:</strong> ${quotation.status.toUpperCase()}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>$${parseFloat(item.unitPrice).toFixed(2)}</td>
                  <td>${parseFloat(item.discount).toFixed(1)}%</td>
                  <td>$${parseFloat(item.totalPrice).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4"><strong>TOTAL</strong></td>
                <td><strong>$${totalAmount.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p><strong>Terms & Conditions:</strong></p>
            <p>Payment due within 30 days of quotation acceptance. All prices are in USD. This quotation is valid for 30 days from the date of issue.</p>
            <br>
            <p>Thank you for your business!</p>
          </div>
        </body>
        </html>
      `;

      // Set headers for PDF download
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="quotation-${quotation.quotationNumber}.html"`);
      res.send(htmlContent);
    } catch (error) {
      console.error("Error exporting quotation:", error);
      res.status(500).json({ message: "Failed to export quotation" });
    }
  });

  // Delete quotation item
  app.delete('/api/quotations/:id/items/:itemId', async (req: any, res) => {
    try {
      await db.delete(quotationItems)
        .where(eq(quotationItems.id, req.params.itemId));
      res.json({ message: "Item deleted successfully" });
    } catch (error) {
      console.error("Error deleting quotation item:", error);
      res.status(500).json({ message: "Failed to delete quotation item" });
    }
  });

  // Export invoice as PDF
  app.get('/api/invoices/:id/export-pdf', async (req: any, res) => {
    try {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId));
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.id));

      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
      const taxAmount = parseFloat(invoice.taxAmount || '0');
      const discountAmount = parseFloat(invoice.discountAmount || '0');
      const totalAmount = subtotal + taxAmount - discountAmount;
      const paidAmount = parseFloat(invoice.paidAmount || '0');
      const balanceDue = totalAmount - paidAmount;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .header h1 { color: #1a1a1a; margin: 0; }
            .company-info { margin-bottom: 30px; }
            .client-info { margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 5px; }
            .invoice-details { margin-bottom: 30px; display: flex; justify-content: space-between; }
            .invoice-details div { flex: 1; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .total-section { margin-top: 20px; text-align: right; }
            .total-row { display: flex; justify-content: flex-end; margin: 5px 0; }
            .total-row span { width: 150px; }
            .total-row span:last-child { font-weight: bold; }
            .grand-total { font-size: 18px; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
            .balance-due { color: ${balanceDue > 0 ? '#dc2626' : '#16a34a'}; font-size: 20px; }
            .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
            .status-paid { background: #dcfce7; color: #16a34a; }
            .status-pending { background: #fef3c7; color: #d97706; }
            .status-partially_paid { background: #dbeafe; color: #2563eb; }
            .status-overdue { background: #fee2e2; color: #dc2626; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>INVOICE</h1>
            <p>Invoice Number: <strong>${invoice.invoiceNumber}</strong></p>
            <span class="status-badge status-${invoice.status}">${invoice.status.toUpperCase().replace('_', ' ')}</span>
          </div>
          
          <div class="company-info">
            <h3>Creative Code Nexus</h3>
            <p>123 Business Street<br>
            Business City, BC 12345<br>
            Phone: (555) 123-4567<br>
            Email: info@creativecode.com</p>
          </div>
          
          <div class="client-info">
            <h3>Bill To:</h3>
            <p><strong>${client?.name || 'N/A'}</strong><br>
            ${client?.email || ''}<br>
            ${client?.phone || ''}<br>
            ${client?.city || ''}, ${client?.country || ''}</p>
          </div>
          
          <div class="invoice-details">
            <div>
              <p><strong>Invoice Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
              <p><strong>Due Date:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.name}${item.description ? `<br><small style="color:#666">${item.description}</small>` : ''}</td>
                  <td>${item.quantity}</td>
                  <td>EGP ${parseFloat(item.unitPrice).toFixed(2)}</td>
                  <td>EGP ${parseFloat(item.totalPrice).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total-section">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>EGP ${subtotal.toFixed(2)}</span>
            </div>
            ${taxAmount > 0 ? `
            <div class="total-row">
              <span>VAT (${invoice.taxRate || '0'}%):</span>
              <span>+ EGP ${taxAmount.toFixed(2)}</span>
            </div>
            ` : ''}
            ${discountAmount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>- EGP ${discountAmount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>Total:</span>
              <span>EGP ${totalAmount.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Paid Amount:</span>
              <span style="color: #16a34a">EGP ${paidAmount.toFixed(2)}</span>
            </div>
            <div class="total-row balance-due">
              <span>Balance Due:</span>
              <span>EGP ${balanceDue.toFixed(2)}</span>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Payment Terms:</strong></p>
            <p>Payment is due within 30 days of invoice date. All amounts are in Egyptian Pounds (EGP).</p>
            <br>
            <p><strong>Bank Details:</strong></p>
            <p>Bank Name: Example Bank | Account Name: Creative Code Nexus | Account Number: 1234567890</p>
            <br>
            <p>Thank you for your business!</p>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber}.html"`);
      res.send(htmlContent);
    } catch (error) {
      console.error("Error exporting invoice:", error);
      res.status(500).json({ message: "Failed to export invoice" });
    }
  });

  // Invoice file attachments upload
  app.post('/api/invoices/:id/attachments', uploadInvoiceFile.single('file'), async (req: any, res) => {
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
  app.delete('/api/invoices/:id/attachments', async (req: any, res) => {
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
      const newAttachments = existingAttachments.filter(a => a !== attachmentPath);

      // Update invoice
      const [updatedInvoice] = await db.update(invoices)
        .set({ attachments: newAttachments, updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId))
        .returning();

      // Delete the file from disk
      const fullPath = path.join(process.cwd(), attachmentPath);
      if (fs.existsSync(fullPath)) {
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

  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(process.cwd(), 'uploads', req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  });
}