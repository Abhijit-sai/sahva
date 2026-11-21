import { createHash, randomUUID } from "node:crypto";
import { database, local, type Query } from "./db.ts";
import { Problem, roomState } from "./rooms.ts";
import {
  extract,
  localize,
  type Fact,
  type Projection,
  type EvidenceTurn,
} from "../providers/meeting.ts";

type RecordRow = {
  room_id: string;
  version: number;
  canonical: Fact[] | null;
  telugu: Projection | null;
  skipped: number;
  error: string | null;
  lease: string | null;
  lease_until: string | null;
  attempts: number;
  fingerprint: string;
};
async function source(q: Query, room: string) {
  const rows = await q<EvidenceTurn>(
    "select t.id,p.name as speaker,p.id as \"speakerId\",t.revision,coalesce(r.text,t.raw_text,'') as text from sahva.turns t join sahva.participants p on p.id=t.speaker_id left join sahva.revisions r on r.turn_id=t.id and r.num=t.revision where t.room_id=$1 order by t.seq",
    [room],
  );
  const turns = rows.filter((t) => t.text.trim());
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex");
  return { turns, fingerprint, skipped: rows.length - turns.length };
}
export async function endRoom(room: string, person: string) {
  const db = await database();
  await db.transaction(async (q) => {
    const state = await roomState(q, room, person, true);
    if (state.me.seat !== 1)
      throw new Problem(
        403,
        "OWNER",
        "Only the room owner can end the conversation.",
      );
    if (state.room.status === "ended") return;
    const pending = await q(
      "select id from sahva.turns where room_id=$1 and stage<>'ready' and error is null limit 1",
      [room],
    );
    if (pending.length && state.canRecord)
      throw new Problem(
        409,
        "PROCESSING",
        "A turn is processing. End the room after it finishes.",
      );
    await q(
      "update sahva.rooms set status='ended',ended_at=now() where id=$1",
      [room],
    );
    const input = await source(q, room);
    await q(
      "insert into sahva.meeting_records(room_id,fingerprint,skipped) values($1,$2,$3)",
      [room, input.fingerprint, input.skipped],
    );
  });
}
export async function generate(room: string, person: string, retry: boolean) {
  const db = await database(),
    lease = randomUUID();
  const job = await db.transaction(async (q) => {
    const state = await roomState(q, room, person, true);
    if (state.room.status !== "ended")
      throw new Problem(
        409,
        "ACTIVE",
        "End this room before requesting a report.",
      );
    const [r] = await q<RecordRow>(
      "select * from sahva.meeting_records where room_id=$1",
      [room],
    );
    if (
      !r ||
      r.telugu !== null ||
      (r.error && !retry) ||
      r.attempts >= 3 ||
      (r.lease_until && new Date(r.lease_until).getTime() > Date.now())
    )
      return null;
    const input = await source(q, room);
    if (input.turns.length && state.members.some((m) => !m.consented_at)) {
      await q(
        "update sahva.meeting_records set error='CONSENT_WITHDRAWN' where room_id=$1",
        [room],
      );
      return null;
    }
    await q(
      "update sahva.meeting_records set lease=$2,lease_until=now()+interval '120 seconds',error=null,attempts=attempts+1,fingerprint=$3,skipped=$4 where room_id=$1",
      [room, lease, input.fingerprint, input.skipped],
    );
    return { r, input };
  });
  if (!job) return;
  try {
    if (
      local() &&
      process.env.SAHVA_OFFLINE_TEST === "1" &&
      job.input.turns.length
    )
      throw new Error("OFFLINE_TEST");
    const canonical = job.r.canonical ?? (await extract(job.input.turns));
    if (job.r.canonical === null) {
      const updated = await db.query(
        "update sahva.meeting_records set canonical=$3::jsonb where room_id=$1 and lease=$2 returning room_id",
        [room, lease, JSON.stringify(canonical)],
      );
      if (!updated.length) return;
    }
    const te = await localize(canonical);
    await db.query(
      "update sahva.meeting_records set telugu=$3::jsonb,lease=null,lease_until=null where room_id=$1 and lease=$2",
      [room, lease, JSON.stringify(te)],
    );
  } catch (e) {
    const code =
      e instanceof Error &&
      /^(LLM_[A-Z_0-9]+|MISSING_EVIDENCE|INVALID_EVIDENCE|INVALID_STATUS|ACCEPTANCE_EVIDENCE_REQUIRED|LOCALIZATION_MISMATCH|REPORT_TOO_LARGE)$/.test(
        e.message,
      )
        ? e.message
        : "REPORT_VALIDATION_OR_CONNECTION";
    await db.query(
      "update sahva.meeting_records set error=$3,lease=null,lease_until=null where room_id=$1 and lease=$2",
      [room, lease, code],
    );
  }
}
export async function report(
  room: string,
  person: string,
  lang: string | null,
) {
  const db = await database();
  const state = await roomState(db.query, room, person);
  const [r] = await db.query<RecordRow>(
    "select * from sahva.meeting_records where room_id=$1",
    [room],
  );
  if (!r) throw new Problem(409, "ACTIVE", "End this room first.");
  const te = (lang ?? state.me.listening) === "te-IN" && r.telugu !== null;
  const busy =
    !!r.lease_until && new Date(r.lease_until).getTime() > Date.now();
  const status =
    r.telugu !== null
      ? "ready"
      : r.error
        ? "failed"
        : busy
          ? "generating"
          : r.attempts >= 3
            ? "failed"
            : "pending";
  return {
    version: r.version,
    status,
    error: r.error,
    skipped: r.skipped,
    canRetry: r.attempts < 3,
    fallback:
      !te && (lang ?? state.me.listening) === "te-IN" && r.canonical !== null,
    language: te ? "te-IN" : "en-IN",
    items:
      r.canonical?.map((f) => ({
        ...f,
        text: te ? r.telugu![f.id] : f.text,
      })) ?? [],
  };
}
