import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Inisialisasi DB dibuat LAZY: modul ini harus aman di-import saat `next build`
// (proses collect page data mengimpor semua route) bahkan sebelum DATABASE_URL
// tersedia. Error baru dilempar saat properti `db`/`pool` diakses pertama kali,
// yaitu ketika query benar-benar dijalankan.
const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu isi koneksi PostgreSQL kamu (lihat bagian 'Jalankan lokal' di README).",
    );
  }

  // Cloud Postgres (Neon, Supabase, Vercel/Railway) membutuhkan TLS.
  // Deteksi dari URL: sslmode=require atau host non-lokal.
  const isLocal = /127\.0\.0\.1|localhost/.test(databaseUrl);
  const needsSsl = /sslmode=require/.test(databaseUrl) || !isLocal;

  const pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }
  return pool;
}

function createDb() {
  return drizzle(createPool());
}

type Db = ReturnType<typeof createDb>;

// Proxy yang membangun nilai aslinya hanya saat properti pertama diakses,
// sehingga tidak ada koneksi (atau throw) di module scope.
function lazy<T extends object>(create: () => T): T {
  let instance: T | undefined;
  const resolve = (): T => (instance ??= create());
  return new Proxy({} as T, {
    get: (_target, prop) => {
      const owner = resolve();
      const value = Reflect.get(owner, prop);
      return typeof value === "function" ? value.bind(owner) : value;
    },
    set: (_target, prop, value) => Reflect.set(resolve(), prop, value),
    has: (_target, prop) => Reflect.has(resolve(), prop),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getOwnPropertyDescriptor: (_target, prop) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve(), prop);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  });
}

export const pool: Pool = lazy(createPool);
export const db: Db = lazy(createDb);
