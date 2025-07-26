import type { Express } from "express";
import { db } from "./db";
import { clients, tasks, expenses, quotations, invoices, users, quotationItems, services, clientNotes } from "@shared/schema";
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
        amount: req.body.amount,
        status: 'draft',
        validUntil: req.body.validUntil ? new Date(req.body.validUntil) : null,
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
        invoiceNumber: `INV-2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        clientId: req.body.clientId,
        amount: req.body.amount,
        paidAmount: '0',
        status: 'pending',
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: '1', // Development user ID
      };

      const [newInvoice] = await db.insert(invoices).values(invoiceData).returning();
      res.status(201).json(newInvoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
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
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating quotation item:", error);
      res.status(500).json({ message: "Failed to create quotation item" });
    }
  });
}