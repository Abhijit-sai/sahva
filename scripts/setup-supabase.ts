import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

async function main() {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co"))
    throw new Error("CHECK_PROJECT_URL");
  const project = url.hostname.split(".")[0];
  const client = createClient(
    url.origin,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const buckets = await client.storage.listBuckets();
  if (buckets.error) throw new Error("STORAGE_AUTH_FAILED");
  for (const [name, limit] of [
    ["room-original-audio", 4000000],
    ["room-translated-audio", 10000000],
  ] as const) {
    const existing = buckets.data.find((b) => b.name === name);
    if (existing?.public) throw new Error("BUCKET_IS_PUBLIC");
    if (!existing) {
      const r = await client.storage.createBucket(name, {
        public: false,
        fileSizeLimit: limit,
      });
      if (r.error) throw new Error("BUCKET_CREATE_FAILED");
    }
    const result = await client.storage.getBucket(name);
    if (result.error || result.data.public)
      throw new Error("PRIVATE_BUCKET_CHECK_FAILED");
    console.log(name, "private bucket verified");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");
  const uri = new URL(connectionString);
  if (
    uri.hostname !== "db." + project + ".supabase.co" &&
    !(
      uri.hostname.endsWith(".pooler.supabase.com") &&
      uri.username === "postgres." + project
    )
  )
    throw new Error("DATABASE_PROJECT_MISMATCH");
  uri.searchParams.delete("sslmode");
  const db = new pg.Client({
    connectionString: uri.href,
    ssl: {
      ca: await readFile("supabase/prod-ca-2021.crt", "utf8"),
      rejectUnauthorized: true,
    },
    connectionTimeoutMillis: 10000,
  });
  try {
    await db.connect();
    await db.query("begin");
    await db.query("select pg_advisory_xact_lock(821917,20261121)");
    await db.query(
      "create schema if not exists sahva; revoke all on schema sahva from public; create table if not exists sahva.migrations(name text primary key,sha text not null)",
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort()) {
      const sql = await readFile(join("supabase/migrations", file), "utf8"),
        sha = createHash("sha256")
          .update(sql.replaceAll("\r\n", "\n"))
          .digest("hex");
      const { rows } = await db.query(
        "select sha from sahva.migrations where name=$1",
        [file],
      );
      if (rows.length && rows[0].sha !== sha)
        throw new Error("MIGRATION_CHECKSUM_MISMATCH");
      if (!rows.length) {
        await db.query(sql);
        await db.query("insert into sahva.migrations values($1,$2)", [
          file,
          sha,
        ]);
      }
    }
    const tables = await db.query(
      "select table_name from information_schema.tables where table_schema='sahva' order by table_name",
    );
    await db.query("commit");
    console.log(
      "Migrations committed. Tables verified:",
      tables.rows.map((r) => r.table_name).join(", "),
    );
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    await db.end().catch(() => {});
  }
}
main().catch((e) => {
  const safe = String(e.code || e.message);
  console.error(
    /^[A-Z0-9_]+$/.test(safe)
      ? safe
      : "Supabase configuration or connection failed",
  );
  process.exitCode = 1;
});
