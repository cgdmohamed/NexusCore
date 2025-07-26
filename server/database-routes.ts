import type { Express } from "express";
import { db } from "./db";
import { clients, tasks, expenses, quotations, invoices, invoiceItems, payments, clientCreditHistory, users, quotationItems, services, clientNotes } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

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
      const clientsCount = await db.execute(sql`SELECT COUNT(*) as count FROM clients`);
      const quotationsCount = await db.execute(sql`SELECT COUNT(*) as count FROM quotations`);
      const invoicesCount = await db.execute(sql`SELECT COUNT(*) as count FROM invoices`);
      const expensesCount = await db.execute(sql`SELECT COUNT(*) as count FROM expenses`);
      const tasksCount = await db.execute(sql`SELECT COUNT(*) as count FROM tasks`);
      
      const counters = {
        clients: parseInt(clientsCount[0]?.count?.toString() || '0'),
        quotations: parseInt(quotationsCount[0]?.count?.toString() || '0'),
        invoices: parseInt(invoicesCount[0]?.count?.toString() || '0'),
        expenses: parseInt(expensesCount[0]?.count?.toString() || '0'),
        employees: 2, // Mock data for employees
        tasks: parseInt(tasksCount[0]?.count?.toString() || '0'),
      };
      
      res.json(counters);
    } catch (error) {
      console.error("Error fetching sidebar counters:", error);
      res.status(500).json({ message: "Failed to fetch counters" });
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
      const clientData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        city: req.body.city,
        country: req.body.country,
        status: req.body.status || 'active',
        totalValue: req.body.totalValue || '0',
        createdBy: '1', // Development user ID
      };

      const [newClient] = await db.insert(clients).values(clientData).returning();
      res.status(201).json(newClient);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Tasks - using real database
  app.get('/api/tasks', async (req: any, res) => {
    try {
      const tasksData = await db.select().from(tasks);
      res.json(tasksData);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post('/api/tasks', async (req: any, res) => {
    try {
      const taskData = {
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority || 'medium',
        status: 'todo',
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        assigneeId: null,
        createdBy: '1', // Development user ID
      };

      const [newTask] = await db.insert(tasks).values(taskData).returning();
      res.status(201).json(newTask);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Expenses - using real database
  app.get('/api/expenses', async (req: any, res) => {
    try {
      const expensesData = await db.select().from(expenses);
      res.json(expensesData);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post('/api/expenses', async (req: any, res) => {
    try {
      const expenseData = {
        title: req.body.title,
        category: req.body.category,
        amount: req.body.amount,
        description: req.body.description,
        status: 'pending',
        expenseDate: new Date(), // Add required expense date
        receiptUrl: null,
        createdBy: '1', // Development user ID
      };

      const [newExpense] = await db.insert(expenses).values(expenseData).returning();
      res.status(201).json(newExpense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

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
        createdBy: '1', // Development user ID
      };

      const [newQuotation] = await db.insert(quotations).values(quotationData).returning();
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
        createdBy: '1', // Development user ID
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
      const updateData = { ...req.body, updatedAt: new Date() };
      
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
      
      await db.update(invoices)
        .set({ 
          subtotal: subtotal.toFixed(2),
          amount: subtotal.toFixed(2), // For now, assume no tax/discount
          updatedAt: new Date()
        })
        .where(eq(invoices.id, req.params.id));
      
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating invoice item:", error);
      res.status(500).json({ message: "Failed to create invoice item" });
    }
  });

  app.delete('/api/invoices/:invoiceId/items/:itemId', async (req: any, res) => {
    try {
      await db.delete(invoiceItems).where(eq(invoiceItems.id, req.params.itemId));
      
      // Recalculate invoice totals
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, req.params.invoiceId));
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
      
      await db.update(invoices)
        .set({ 
          subtotal: subtotal.toFixed(2),
          amount: subtotal.toFixed(2),
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
        createdBy: '1', // Development user ID
        approvedBy: isOverpayment && isAdminApproved ? '1' : null,
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
          createdBy: '1',
        });
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
        createdBy: '1',
        approvedBy: '1',
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
        createdBy: '1',
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

  // Employees - mock for now since we don't have an employees table
  app.get('/api/employees', async (req, res) => {
    try {
      // Return mock data for development
      const employees = [
        {
          id: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@company.com',
          phone: '+1 555-0101',
          position: 'Software Engineer',
          department: 'operations',
          salary: '75000',
          status: 'active',
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-10')
        },
        {
          id: '2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@company.com',
          phone: '+1 555-0102',
          position: 'Marketing Manager',
          department: 'sales',
          salary: '85000',
          status: 'active',
          createdAt: new Date('2024-01-12'),
          updatedAt: new Date('2024-01-12')
        }
      ];
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.post('/api/employees', async (req, res) => {
    try {
      // Mock employee creation for development
      const newEmployee = {
        id: Date.now().toString(),
        firstName: req.body.firstName || 'John',
        lastName: req.body.lastName || 'Doe',
        email: req.body.email || 'employee@company.com',
        phone: req.body.phone || '',
        position: req.body.position || 'Employee',
        department: req.body.department || 'operations',
        salary: req.body.salary || '50000',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.status(201).json(newEmployee);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

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
        createdBy: '1', // Development user ID
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
        createdBy: '1', // Development user ID
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
}