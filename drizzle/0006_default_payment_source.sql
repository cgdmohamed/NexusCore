ALTER TABLE "payment_sources" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_sources_one_default" ON "payment_sources" ("is_default") WHERE "is_default" = true;
