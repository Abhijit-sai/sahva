import { mkdir, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { PGlite } from "@electric-sql/pglite";

export const local = () =>
  process.env.SAHVA_LOCAL === "1" && process.env.NODE_ENV !== "production";
export const dataDir = () =>
  resolve(
    ".sahva",
    process.env.SAHVA_TEST_RUN
      ? "test-" + process.env.SAHVA_TEST_RUN.replace(/[^\w-]/g, "")
      : "dev",
  );
type Row = Record<string, unknown>;
export type Query = <T extends Row = Row>(
  sql: string,
  args?: unknown[],
) => Promise<T[]>;
export type Database = {
  query: Query;
  transaction: <T>(work: (query: Query) => Promise<T>) => Promise<T>;
};
const shared = globalThis as typeof globalThis & {
  sahvaDatabase?: Promise<Database>;
};

async function connect(): Promise<Database> {
  if (local()) {
    const { PGlite } = await import("@electric-sql/pglite");
    await mkdir(dataDir(), { recursive: true });
    const db = await PGlite.create(resolve(dataDir(), "postgres"));
    const folder = resolve("supabase/migrations");
    await db.exec("create schema if not exists sahva; create table if not exists sahva.local_migrations(name text primary key)");
    for (const file of (await readdir(folder))
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort()) {
      const sql = await readFile(resolve(folder,file),"utf8");
      await db.transaction(async tx => {
        const applied = await tx.query("select name from sahva.local_migrations where name=$1",[file]);
        if (applied.rows.length) return;
        await tx.exec(sql);
        await tx.query("insert into sahva.local_migrations values($1)",[file]);
      });
    }
    const wrap =
      (c: Pick<PGlite, "query">): Query =>
      async <T extends Row>(sql: string, args: unknown[] = []) =>
        (await c.query<T>(sql, args)).rows;
    return {
      query: wrap(db),
      transaction: (work) => db.transaction((tx) => work(wrap(tx))),
    };
  }
  if (!process.env.DATABASE_URL)
    throw new Error("Database configuration missing");
  const uri = new URL(process.env.DATABASE_URL);
  uri.searchParams.delete("sslmode");
  const pool = new Pool({
    connectionString: uri.href,
    ssl: {
      ca: await readFile(resolve("supabase/prod-ca-2021.crt"), "utf8"),
      rejectUnauthorized: true,
    },
    max: 4,
    connectionTimeoutMillis: 5000,
  });
  return {
    query: async (sql, args) => (await pool.query(sql, args)).rows,
    transaction: async (work) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await work(
          async (sql, args) => (await client.query(sql, args)).rows,
        );
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
export async function database() {
  shared.sahvaDatabase ??= connect().catch((error) => {
    delete shared.sahvaDatabase;
    throw error;
  });
  return shared.sahvaDatabase;
}
