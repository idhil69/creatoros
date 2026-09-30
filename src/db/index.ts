import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

// Cloud Postgres (Neon, Supabase, Vercel/Railway) membutuhkan TLS.
// Deteksi dari URL: sslmode=require atau host non-lokal.
const isLocal = /127\.0\.0\.1|localhost/.test(databaseUrl);
const needsSsl = /sslmode=require/.test(databaseUrl) || !isLocal;

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
