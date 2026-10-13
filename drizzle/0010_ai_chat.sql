CREATE TABLE IF NOT EXISTS "ai_settings" (
	"id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
	"provider" varchar DEFAULT 'anthropic' NOT NULL,
	"model" varchar,
	"api_key_enc" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chats_user_idx" ON "ai_chats" ("user_id", "updated_at");
