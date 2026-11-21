import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  SarvamSpeech,
  SpeechError,
  type Language,
} from "../providers/sarvam.ts";
import { database, local, type Query } from "./db.ts";
import { Problem, roomState } from "./rooms.ts";
import { audioDuration, extensions } from "./audio.ts";
import { save, bytesFor, playback } from "./storage.ts";

import { otherLanguage } from "../shared.ts";
import { supportsVoice } from "../voices.ts";
import { serverTime, type TurnTiming } from "../rehearsal.ts";

type Turn = {
  id: string;
  room_id: string;
  speaker_id: string;
  seq: number;
  mime: string;
  duration_ms: number;
  original_key: string;
  source: Language | null;
  target: Language;
  raw_text: string | null;
  revision: number;
  stage: "stt" | "translation" | "tts" | "ready";
  error: string | null;
  retries: number;
  lease: string | null;
  lease_until: string | null;
  timings: { synthesis?: { speaker?: string } };
};
async function getTurn(q: Query, room: string, id: string) {
  const [turn] = await q<Turn>(
    "select * from sahva.turns where room_id=$1 and id=$2",
    [room, id],
  );
  if (!turn) throw new Problem(404, "TURN", "Turn unavailable.");
  return turn;
}
function requireConsent(canRecord: boolean) {
  if (!canRecord)
    throw new Problem(
      403,
      "CONSENT",
      "Recording requires two consenting participants in an active room.",
    );
}
export async function upload(
  room: string,
  person: string,
  form: FormData,
  final?: { text: string; source: Language },
  timing?: TurnTiming,
) {
  const db = await database();
  requireConsent((await roomState(db.query, room, person)).canRecord);
  const idem = z.uuid().parse(form.get("idempotencyKey"));
  const file = form.get("audio");
  if (!(file instanceof File) || !file.size || file.size > 4_000_000)
    throw new Problem(413, "SIZE", "Choose a nonempty recording under 4 MB.");
  const mime = file.type.split(";")[0];
  if (!Object.hasOwn(extensions, mime))
    throw new Problem(400, "MIME", "Choose WebM, Ogg, MP4 or WAV audio.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const duration = await audioDuration(bytes, mime).catch(() => {
    throw new Problem(
      422,
      "AUDIO",
      "Could not decode the recording. Try recording again or check the server decoder.",
    );
  });
  if (duration < 200 || duration > 30000)
    throw new Problem(
      422,
      "DURATION",
      "The recording must be under 30 seconds and contain audio.",
    );
  return db.transaction(async (q) => {
    const state = await roomState(q, room, person, true);
    requireConsent(state.canRecord);
    const [existing] = await q(
      "select id,seq from sahva.turns where room_id=$1 and speaker_id=$2 and idem=$3",
      [room, person, idem],
    );
    if (existing) return existing;
    const [{ count }] = await q(
      "select count(*)::int as count from sahva.turns where room_id=$1",
      [room],
    );
    if (Number(count) >= 60)
      throw new Problem(
        429,
        "LIMIT",
        "This room has reached its 60-turn limit.",
      );
    const id = randomUUID(),
      seq = Number(count) + 1;
    const key = room + "/" + id + "/original." + extensions[mime];
    const target =
      state.room.transport === "livekit"
        ? otherLanguage(final?.source ?? state.me.speaking)
        : state.members.find((m) => m.id !== person)!.listening;
    const voice = form.get("voice");
    if (voice !== null && !supportsVoice(target, voice))
      throw new Problem(
        400,
        "VOICE",
        "Choose a supported voice for the listener’s language.",
      );
    await save("room-original-audio", key, bytes, mime);
    await q(
      "insert into sahva.turns(id,room_id,speaker_id,seq,idem,mime,duration_ms,original_key,target,raw_text,source,stage,timings) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)",
      [
        id,
        room,
        person,
        seq,
        idem,
        mime,
        duration,
        key,
        target,
        final?.text ?? null,
        final?.source ?? null,
        final ? "translation" : "stt",
        JSON.stringify({
          live: timing,
          synthesis: voice ? { speaker: voice } : undefined,
        }),
      ],
    );
    return { id, seq };
  });
}
export async function timeline(room: string, person: string) {
  const db = await database();
  const state = await roomState(db.query, room, person);
  const turns = await db.query(
    `select t.id,t.idem as phrase_id,t.seq,t.speaker_id,t.duration_ms,t.created_at,t.source,t.raw_text,t.target,t.revision,t.stage,t.error,t.retries,
    t.timings->'tts'->>'speaker' as output_voice, t.timings->'live' as live_timing, t.timings->'translation'->'at' as translated_at,
    t.timings->'tts'->'at' as generated_at, t.timings->'stt'->'at' as transcribed_at,
    coalesce(r.text,t.raw_text) as current_text,d.text as translated_text,(d.audio_key is not null) as voice,
    (t.lease_until>now()) is true as busy from sahva.turns t
    left join sahva.revisions r on r.turn_id=t.id and r.num=t.revision
    left join sahva.deliveries d on d.turn_id=t.id and d.revision=t.revision where t.room_id=$1 order by seq`,
    [room],
  );
  if (state.room.transport === "livekit") {
    for (const t of turns) {
      if (t.speaker_id !== person && t.source === state.me.listening) {
        t.target = t.source;
        t.translated_text = t.current_text;
        t.voice = false;
      }
    }
  }
  return { ...state, turns };
}
export async function media(
  room: string,
  person: string,
  id: string,
  kind: string | null,
) {
  const db = await database();
  await roomState(db.query, room, person);
  const turn = await getTurn(db.query, room, id);
  if (
    kind === "original" ||
    (kind === "translation" && turn.target === turn.source)
  )
    return playback("room-original-audio", turn.original_key, turn.mime);
  if (kind !== "translation")
    throw new Problem(400, "KIND", "Choose original or translated audio.");
  const [row] = await db.query<{ audio_key: string }>(
    "select audio_key from sahva.deliveries where turn_id=$1 and revision=$2 and audio_key is not null",
    [id, turn.revision],
  );
  if (!row) throw new Problem(404, "MEDIA", "Translated audio is unavailable.");
  return playback("room-translated-audio", row.audio_key, "audio/wav");
}
export async function revise(
  room: string,
  person: string,
  id: string,
  input: unknown,
) {
  const { correctedText, expectedCurrentRevision } = z
    .object({
      correctedText: z.string().trim().min(1).max(1000),
      expectedCurrentRevision: z.int().nonnegative(),
    })
    .parse(input);
  const db = await database();
  await db.transaction(async (q) => {
    const state = await roomState(q, room, person, true);
    requireConsent(
      state.members.length >= 2 && state.members.every((m) => m.consented_at),
    );
    const t = await getTurn(q, room, id);
    if (t.speaker_id !== person)
      throw new Problem(
        403,
        "SPEAKER",
        "Only the speaker can correct this turn.",
      );
    if (!t.raw_text || t.revision !== expectedCurrentRevision)
      throw new Problem(
        409,
        "REVISION",
        "Transcript changed or is unavailable. Refresh the turn.",
      );
    const next = t.revision + 1;
    if (next > 5) throw new Problem(429, "LIMIT", "Correction limit reached.");
    await q(
      "insert into sahva.revisions(turn_id,num,text,author) values($1,$2,$3,$4)",
      [id, next, correctedText, person],
    );
    await q(
      "update sahva.turns set revision=$2,stage='translation',lease=null,lease_until=null,error=null,retries=0 where id=$1",
      [id, next],
    );
    if (state.room.status === "ended")
      await q(
        "update sahva.meeting_records set canonical=null,telugu=null,version=version+1,attempts=0,lease=null,lease_until=null,error=null where room_id=$1",
        [room],
      );
  });
}
export async function processStage(
  room: string,
  person: string,
  id: string,
  retry: boolean,
) {
  const db = await database(),
    lease = randomUUID();
  const job = await db.transaction(async (q) => {
    const state = await roomState(q, room, person, true);
    const turn = await getTurn(q, room, id);
    requireConsent(
      state.canRecord ||
        (turn.revision > 0 && state.members.every((m) => m.consented_at)),
    );
    if (
      turn.stage === "ready" ||
      (turn.lease_until && new Date(turn.lease_until).getTime() > Date.now())
    )
      return null;
    if (turn.error && (!retry || turn.retries >= 1)) return null;
    await q(
      "update sahva.turns set lease=$2,lease_until=now()+interval '45 seconds',error=null,retries=retries+$3 where id=$1",
      [id, lease, turn.error ? 1 : 0],
    );
    return { t: turn, meeting: state.room.transport === "livekit" };
  });
  if (!job) return;
  const { t, meeting } = job;
  try {
    const current = await db.query<{ text: string }>(
      "select text from sahva.revisions where turn_id=$1 and num=$2",
      [id, t.revision],
    );
    const sourceText = current[0]?.text ?? t.raw_text;
    const key =
      local() && process.env.SAHVA_OFFLINE_TEST === "1"
        ? undefined
        : process.env.SARVAM_API_KEY;
    let next: Turn["stage"] = "ready",
      raw = t.raw_text,
      source = t.source,
      translated: string | null = null,
      audioKey: string | null = null;
    let target = t.target;
    let receipt: object = {};
    if (t.stage === "translation" && t.target === source)
      translated = sourceText;
    else {
      if (!key)
        throw new SpeechError(
          t.stage === "ready" ? "stt" : t.stage,
          "PROVIDER_NOT_CONFIGURED",
        );
      const speech = new SarvamSpeech(key);
      if (t.stage === "stt") {
        const bytes = await bytesFor("room-original-audio", t.original_key);
        const result = await speech.transcribe(
          new File([new Uint8Array(bytes)], "turn." + extensions[t.mime], {
            type: t.mime,
          }),
        );
        raw = result.text;
        source = result.language;
        if (meeting) target = otherLanguage(source);
        next = "translation";
        receipt = {
          ms: result.elapsedMs,
          id: result.requestId,
          at: serverTime(),
        };
      } else if (t.stage === "translation") {
        const result = await speech.translate(sourceText!, source!, t.target);
        translated = result.text;
        next = "tts";
        receipt = {
          ms: result.elapsedMs,
          id: result.requestId,
          at: serverTime(),
        };
      } else {
        const [delivery] = await db.query<{ text: string }>(
          "select text from sahva.deliveries where turn_id=$1 and revision=$2",
          [id, t.revision],
        );
        const result = await speech.synthesize(
          delivery.text,
          t.target,
          supportsVoice(t.target, t.timings.synthesis?.speaker)
            ? t.timings.synthesis?.speaker
            : undefined,
        );
        const generatedAt = serverTime();
        audioKey = room + "/" + id + "/" + t.revision + "-" + lease + ".wav";
        await save(
          "room-translated-audio",
          audioKey,
          result.audio,
          "audio/wav",
        );
        receipt = {
          ms: result.elapsedMs,
          id: result.requestId,
          at: generatedAt,
          speaker: result.speaker,
        };
      }
    }
    await db.transaction(async (q) => {
      const updated = await q(
        `update sahva.turns set stage=$3,raw_text=$4,source=$5,lease=null,lease_until=null,retries=0,
        target=$7,timings=timings || $6::jsonb where id=$1 and lease=$2 returning id`,
        [
          id,
          lease,
          next,
          raw,
          source,
          JSON.stringify({ [t.stage]: receipt }),
          target,
        ],
      );
      if (!updated.length) return;
      if (translated !== null)
        await q(
          "insert into sahva.deliveries(turn_id,revision,target,text) values($1,$2,$3,$4)",
          [id, t.revision, t.target, translated],
        );
      if (audioKey)
        await q(
          "update sahva.deliveries set audio_key=$3 where turn_id=$1 and revision=$2",
          [id, t.revision, audioKey],
        );
    });
    return next !== "ready";
  } catch (e) {
    await db.query(
      "update sahva.turns set error=$3,lease=null,lease_until=null where id=$1 and lease=$2",
      [id, lease, e instanceof SpeechError ? e.code : "PROCESSING_FAILED"],
    );
  }
}
