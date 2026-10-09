ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'daily_digest';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "digest_log" (
	"user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"day" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	PRIMARY KEY ("user_id", "day")
);
