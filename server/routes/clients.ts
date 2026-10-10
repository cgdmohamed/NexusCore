import type { Express } from "express";
import { db, badRequestFromDbError } from "../db";

import { logAudit } from "../audit";
import { parseMoney } from "../validation";
import { requirePermission } from "../auth";
import { clients, quotations, invoices, payments, clientCreditHistory, clientNotes, activities } from "@shared/schema";
import { companyInfo } from "./shared";
import { eq, sql, ne, and, inArray } from "drizzle-orm";
import { buildStatement } from "../statement";

// Clients: profile, status, archive/restore, notes, credit balance
export function registerClientsRoutes(app: Express) {
  // Status update endpoints for all entities
  app.patch('/api/clients/:id/status', requirePermission("crm", "edit"), async (req, res) => {
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

  // Clients - using real database
  app.get('/api/clients', requirePermission("crm", "view"), async (req: any, res) => {
    try {
      // Archived clients stay in the list (invoices still need their names); pickers can hide them
      const clientsData = req.query.excludeArchived === "true"
        ? await db.select().from(clients).where(ne(clients.status, "archived"))
        : await db.select().from(clients);
      res.json(clientsData);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.post('/api/clients', requirePermission("crm", "add"), async (req: any, res) => {
    try {
      // Get the actual user ID from the session or use the first available user
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (typeof req.body.name !== "string" || !req.body.name.trim()) {
        return res.status(400).json({ message: "Client name is required." });
      }

      const clientData = {
        name: req.body.name.trim(),
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
      const badRequest = badRequestFromDbError(error);
      if (badRequest) return res.status(400).json({ message: badRequest });
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Get client credit balance and history
  app.get('/api/clients/:id/credit', requirePermission("crm", "view"), async (req: any, res) => {
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

  // Account statement: invoices, payments and refunds as one dated ledger with a running balance
  app.get('/api/clients/:id/statement', requirePermission("crm", "view"), requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const day = /^\d{4}-\d{2}-\d{2}$/;
      const parseDay = (v: unknown, endOfDay: boolean) => {
        if (v === undefined || v === "") return null;
        if (typeof v !== "string" || !day.test(v)) return undefined;
        const d = new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
        return Number.isNaN(d.getTime()) ? undefined : d;
      };
      const from = parseDay(req.query.from, false);
      const to = parseDay(req.query.to, true);
      if (from === undefined || to === undefined) {
        return res.status(400).json({ message: "Dates must use the format YYYY-MM-DD." });
      }
      if (from && to && from > to) {
        return res.status(400).json({ message: "The start date must not be after the end date." });
      }

      const [client] = await db.select().from(clients).where(eq(clients.id, req.params.id));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, client.id));
      const invoiceIds = clientInvoices.map((i) => i.id);
      const clientPayments = invoiceIds.length
        ? await db.select().from(payments).where(inArray(payments.invoiceId, invoiceIds))
        : [];
      const creditRefunds = await db.select().from(clientCreditHistory)
        .where(and(eq(clientCreditHistory.clientId, client.id), eq(clientCreditHistory.type, "credit_refunded")));

      const statement = buildStatement({ invoices: clientInvoices, payments: clientPayments, creditRefunds, creditBalance: client.creditBalance, from, to });

      res.json({
        client: { id: client.id, name: client.name, email: client.email, phone: client.phone, address: client.address, city: client.city, country: client.country, status: client.status },
        company: companyInfo(),
        currency: "EGP",
        period: { from: from ? from.toISOString().slice(0, 10) : null, to: to ? to.toISOString().slice(0, 10) : null },
        generatedAt: new Date().toISOString(),
        ...statement,
      });
    } catch (error) {
      console.error("Error building client statement:", error);
      res.status(500).json({ message: "Failed to build client statement" });
    }
  });

  // Employees endpoint removed - now handled by user-management-routes.ts with real database data

  // Employee creation endpoint removed - now handled by user-management-routes.ts with real database data

  // Enhanced Client Profile Routes
  app.get('/api/clients/:id', requirePermission("crm", "view"), async (req: any, res) => {
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

  app.patch('/api/clients/:id', requirePermission("crm", "edit"), async (req: any, res) => {
    try {
      // creditBalance is deliberately not editable here: it only changes through payments, credit
      // application and credit refunds, which keep the credit history.
      const { name, email, phone, address, city, country, status, totalValue } = req.body;
      if (totalValue !== undefined && parseMoney(totalValue, { allowZero: true }) === null) {
        return res.status(400).json({ message: "totalValue must be a non-negative number." });
      }
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (country !== undefined) updateData.country = country;
      if (status !== undefined) updateData.status = status;
      if (totalValue !== undefined) updateData.totalValue = parseFloat(totalValue).toFixed(2);

      const [updatedClient] = await db.update(clients)
        .set(updateData)
        .where(eq(clients.id, req.params.id))
        .returning();

      if (!updatedClient) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(updatedClient);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  // Recalculate client value based on paid invoices
  app.post('/api/clients/:id/recalculate-value', requirePermission("crm", "edit"), async (req: any, res) => {
    try {
      const clientId = req.params.id;
      
      // Check if client exists
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Calculate total paid amount from all invoices for this client using DB SUM
      const [clientPaidSumResult] = await db.select({
        total: sql<string>`COALESCE(SUM(${invoices.paidAmount}), 0)`
      }).from(invoices).where(eq(invoices.clientId, clientId));
      const totalPaidValue = parseFloat(clientPaidSumResult?.total || '0');

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

  // Clients are never deleted: removing one archives it. Invoices, payments, quotations, notes,
  // credit history and credentials all stay, so financial records remain complete.
  app.delete('/api/clients/:id', requirePermission("crm", "delete"), async (req: any, res) => {
    try {
      const [client] = await db.select().from(clients).where(eq(clients.id, req.params.id));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (client.status !== "archived") {
        await db.update(clients).set({ status: "archived", updatedAt: new Date() }).where(eq(clients.id, client.id));
        await logAudit(req, "archive", "client", client.id, { status: client.status }, { status: "archived" });
      }

      res.json({
        success: true,
        archived: true,
        message: "Client archived. Its invoices, payments, quotations and history are kept.",
      });
    } catch (error) {
      console.error("Error archiving client:", error);
      res.status(500).json({ message: "Failed to archive client" });
    }
  });

  app.post('/api/clients/:id/restore', requirePermission("crm", "edit"), async (req: any, res) => {
    try {
      const [client] = await db.select().from(clients).where(eq(clients.id, req.params.id));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (client.status === "archived") {
        await db.update(clients).set({ status: "active", updatedAt: new Date() }).where(eq(clients.id, client.id));
        await logAudit(req, "restore", "client", client.id, { status: "archived" }, { status: "active" });
      }

      res.json({ success: true, restored: client.status === "archived" });
    } catch (error) {
      console.error("Error restoring client:", error);
      res.status(500).json({ message: "Failed to restore client" });
    }
  });

  // Client Related Data Routes
  app.get('/api/clients/:id/quotations', requirePermission("quotations", "view"), async (req: any, res) => {
    try {
      const clientQuotations = await db.select().from(quotations).where(eq(quotations.clientId, req.params.id));
      res.json(clientQuotations);
    } catch (error) {
      console.error("Error fetching client quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  app.get('/api/clients/:id/invoices', requirePermission("invoices", "view"), async (req: any, res) => {
    try {
      const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, req.params.id));
      res.json(clientInvoices);
    } catch (error) {
      console.error("Error fetching client invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get('/api/clients/:id/notes', requirePermission("crm", "view"), async (req: any, res) => {
    try {
      const clientNotesList = await db.select().from(clientNotes).where(eq(clientNotes.clientId, req.params.id));
      res.json(clientNotesList);
    } catch (error) {
      console.error("Error fetching client notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post('/api/clients/:id/notes', requirePermission("crm", "edit"), async (req: any, res) => {
    try {
      const noteData = {
        clientId: req.params.id,
        note: req.body.note,
        type: req.body.type || 'note',
        createdBy: req.user?.id,
      };

      const [newNote] = await db.insert(clientNotes).values(noteData).returning();
      res.status(201).json(newNote);
    } catch (error) {
      console.error("Error creating client note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });
}
