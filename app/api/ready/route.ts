import { database } from "../../../lib/server/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (
      process.env.NODE_ENV === "production" &&
      [
        "DATABASE_URL",
        "SARVAM_API_KEY",
        "OPENAI_API_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SAHVA_SESSION_SIGNING_KEY",
      ].some((k) => !process.env[k]?.trim())
    )
      throw new Error("Incomplete runtime configuration");
    const db = await database();
    await db.query("select 1 from sahva.meeting_records limit 0");
    return Response.json(
      { ready: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ready: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
