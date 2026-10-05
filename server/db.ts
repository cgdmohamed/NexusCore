import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const db = drizzle(pool, { schema });

/**
 * drizzle-orm >= 0.44 wraps driver errors in DrizzleQueryError; the original pg error
 * (with `code` / `constraint`) lives in `cause`. Use this to inspect SQLSTATE codes.
 */
export function pgError(error: any): any {
  return error?.cause?.code ? error.cause : error;
}
