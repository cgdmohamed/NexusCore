CREATE TABLE IF NOT EXISTS "api_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"name" varchar NOT NULL,
	"token_hash" varchar NOT NULL UNIQUE,
	"prefix" varchar NOT NULL,
	"created_by" varchar REFERENCES "users"("id"),
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp,
	"revoked_at" timestamp
);
