ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
