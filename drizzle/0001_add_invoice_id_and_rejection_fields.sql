ALTER TABLE "quotations" ADD COLUMN "invoice_id" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejected_by" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
