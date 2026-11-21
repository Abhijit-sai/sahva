import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { local, dataDir } from "./db.ts";
export type Bucket = "room-original-audio" | "room-translated-audio";
function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function save(
  bucket: Bucket,
  key: string,
  bytes: Buffer,
  mime: string,
) {
  if (local()) {
    const file = join(dataDir(), "media", bucket, key);
    await mkdir(dirname(file), { recursive: true });
    return writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  }
  const { error } = await client()
    .storage.from(bucket)
    .upload(key, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error("Private storage write failed");
}
export async function bytesFor(bucket: Bucket, key: string) {
  if (local()) return readFile(join(dataDir(), "media", bucket, key));
  const { data, error } = await client().storage.from(bucket).download(key);
  if (error || !data) throw new Error("Private storage read failed");
  return Buffer.from(await data.arrayBuffer());
}
export async function playback(bucket: Bucket, key: string, mime: string) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  if (local())
    return new Response(new Uint8Array(await bytesFor(bucket, key)), {
      headers: { ...headers, "Content-Type": mime },
    });
  const { data, error } = await client()
    .storage.from(bucket)
    .createSignedUrl(key, 60);
  if (error || !data) throw new Error("Private media link unavailable");
  return new Response(null, {
    status: 307,
    headers: { ...headers, Location: data.signedUrl },
  });
}
