ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_source_id" varchar REFERENCES "payment_sources"("id");
