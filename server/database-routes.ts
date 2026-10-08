import type { Express } from "express";
import { registerMiscRoutes } from "./routes/misc";
import { registerClientsRoutes } from "./routes/clients";
import { registerInvoicesRoutes } from "./routes/invoices";
import { registerPaymentsRoutes } from "./routes/payments";
import { registerQuotationsRoutes } from "./routes/quotations";

// The business routes live in server/routes/*; this keeps the single entry point used by routes.ts.
export function setupDatabaseRoutes(app: Express) {
  registerMiscRoutes(app);
  registerClientsRoutes(app);
  registerInvoicesRoutes(app);
  registerPaymentsRoutes(app);
  registerQuotationsRoutes(app);
}
