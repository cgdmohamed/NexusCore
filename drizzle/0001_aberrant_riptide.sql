CREATE TYPE "public"."credential_type" AS ENUM('social', 'website', 'server', 'email', 'other');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'direct_message';--> statement-breakpoint
CREATE TABLE "client_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"label" varchar NOT NULL,
	"type" "credential_type" DEFAULT 'other' NOT NULL,
	"username" text,
	"encrypted_password" text,
	"url" text,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"last_read_at" timestamp,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"event" text NOT NULL,
	"actor" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_print_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"display_currency" varchar NOT NULL,
	"exchange_rate" numeric(12, 6) NOT NULL,
	"source_total_egp" numeric(12, 2) NOT NULL,
	"converted_total" numeric(12, 2) NOT NULL,
	"print_snapshot_json" jsonb NOT NULL,
	"printed_at" timestamp DEFAULT now() NOT NULL,
	"printed_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" varchar,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "project_members_project_user_unique" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "quotation_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" varchar NOT NULL,
	"event" text NOT NULL,
	"actor" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quotation_print_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" varchar NOT NULL,
	"display_currency" varchar NOT NULL,
	"exchange_rate" numeric(12, 6) NOT NULL,
	"source_total_egp" numeric(12, 2) NOT NULL,
	"converted_total" numeric(12, 2) NOT NULL,
	"print_snapshot_json" jsonb NOT NULL,
	"printed_at" timestamp DEFAULT now() NOT NULL,
	"printed_by_user_id" varchar
);
--> statement-breakpoint
ALTER TABLE "expense_payments" ALTER COLUMN "attachment_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "attachment_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "attachment_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_source_transactions" ALTER COLUMN "amount" SET DATA TYPE numeric(12, 2) USING "amount"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "payment_source_transactions" ALTER COLUMN "balance_before" SET DATA TYPE numeric(12, 2) USING "balance_before"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "payment_source_transactions" ALTER COLUMN "balance_after" SET DATA TYPE numeric(12, 2) USING "balance_after"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "payment_sources" ALTER COLUMN "initial_balance" SET DATA TYPE numeric(12, 2) USING "initial_balance"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "payment_sources" ALTER COLUMN "current_balance" SET DATA TYPE numeric(12, 2) USING "current_balance"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejected_by" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "qr_code_image" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "client_id" varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget" numeric;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "subtotal" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "tax_rate" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "tax_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "discount_rate" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "discount_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "invoice_id" varchar;--> statement-breakpoint
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_history" ADD CONSTRAINT "invoice_history_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_print_records" ADD CONSTRAINT "invoice_print_records_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_print_records" ADD CONSTRAINT "invoice_print_records_printed_by_user_id_users_id_fk" FOREIGN KEY ("printed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_history" ADD CONSTRAINT "quotation_history_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_print_records" ADD CONSTRAINT "quotation_print_records_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_print_records" ADD CONSTRAINT "quotation_print_records_printed_by_user_id_users_id_fk" FOREIGN KEY ("printed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_related_project_id_projects_id_fk" FOREIGN KEY ("related_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;