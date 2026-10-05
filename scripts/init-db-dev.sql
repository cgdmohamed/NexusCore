-- Runs once when the PostgreSQL data directory is first initialised.
-- The schema itself is created by the application migrations (see drizzle/).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
