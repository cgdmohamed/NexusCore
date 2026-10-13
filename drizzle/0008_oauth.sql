CREATE TABLE IF NOT EXISTS "oauth_clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL UNIQUE,
	"client_name" varchar NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_grants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp,
	"revoked_at" timestamp
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_codes" (
	"code_hash" varchar PRIMARY KEY NOT NULL,
	"client_id" varchar NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"redirect_uri" text NOT NULL,
	"code_challenge" varchar NOT NULL,
	"grant_id" varchar,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar NOT NULL UNIQUE,
	"kind" varchar NOT NULL,
	"grant_id" varchar NOT NULL REFERENCES "oauth_grants"("id") ON DELETE CASCADE,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
