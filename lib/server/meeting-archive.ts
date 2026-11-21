import { randomUUID } from "node:crypto";
import { model } from "../providers/gemini-interpretation.ts";
import type { Language } from "../shared.ts";
import { database } from "./db.ts";
import { roomState, Problem } from "./rooms.ts";
import { playback, save } from "./storage.ts";
import { wave } from "./wave.ts";

type Chunk = {
  pcm: Buffer;
  start: number;
  text: string | null;
  draft: string | null;
};
export type Clip = {
  frame(bytes: Buffer, translated?: boolean): void;
  transcript(text: string, final: boolean): void;
  close(): void;
};

// Each writer belongs to one microphone or one recipient publication. Never group audio by a guessed translation delay.
function clip(
  rate: number,
  incoming: boolean,
  commit: (chunk: Chunk) => void,
): Clip {
  let frames: Buffer[] = [],
    size = 0,
    start = 0,
    quiet = 0,
    interpreted = false,
    closed = false;
  let draft = "";
  let idle: ReturnType<typeof setTimeout> | undefined;
  function flush(text: string | null = null) {
    clearTimeout(idle);
    idle = undefined;
    if (size && (!incoming || interpreted))
      commit({
        pcm: Buffer.concat(frames, size),
        start,
        text,
        draft: text ? null : draft.trim() || null,
      });
    draft = "";
    frames = [];
    size = 0;
    quiet = 0;
    interpreted = false;
  }
  return {
    frame(bytes, translated = false) {
      if (closed || !bytes.length) return;
      let voiced = false;
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        if (Math.abs(bytes.readInt16LE(i)) > 180) {
          voiced = true;
          break;
        }
      }
      if (!size && !voiced && !translated) return;
      if (!size) start = Date.now();
      frames.push(Buffer.from(bytes));
      size += bytes.length;
      interpreted ||= translated;
      quiet = voiced || translated ? 0 : quiet + bytes.length;
      if (size >= rate * 2 * 25 || quiet >= rate * 2 * 2) flush();
      else {
        if (idle) idle.refresh();
        else
          idle = setTimeout(() => {
            idle = undefined;
            flush();
          }, 2500);
      }
    },
    transcript(text, final) {
      if (closed || !size) return;
      draft = (draft + text).slice(-8000);
      if (final && draft.trim()) flush(draft.trim());
    },
    close() {
      closed = true;
      flush();
    },
  };
}
export class MeetingArchive {
  private pending = new Set<Promise<void>>();
  private clips = new Set<Clip>();
  private closed = false;
  private room: string;
  private epoch: number;
  private issues: Map<string, string>;
  constructor(room: string, epoch: number, issues: Map<string, string>) {
    this.room = room;
    this.epoch = epoch;
    this.issues = issues;
  }
  private writer(
    speaker: string,
    language: Language,
    sid: string,
    listener?: string,
  ): Clip {
    const rate = listener ? 24000 : 16000;
    const writer = clip(rate, !!listener, (chunk) => {
      if (this.pending.size >= 64) {
        this.issues.set(
          listener ?? speaker,
          "Archive storage is behind. A recording could not be saved.",
        );
        return;
      }
      const job = this.persist(speaker, language, sid, listener, rate, chunk)
        .catch((error: unknown) => {
          this.issues.set(
            listener ?? speaker,
            error instanceof Problem && error.code === "LIMIT"
              ? error.message
              : "A call recording could not be saved.",
          );
        })
        .finally(() => this.pending.delete(job));
      this.pending.add(job);
    });
    if (this.closed) writer.close();
    else this.clips.add(writer);
    return {
      ...writer,
      close: () => {
        writer.close();
        this.clips.delete(writer);
      },
    };
  }
  original(speaker: string, language: Language, sid: string) {
    return this.writer(speaker, language, sid);
  }
  replay(speaker: string, listener: string, language: Language, sid: string) {
    return this.writer(speaker, language, sid, listener);
  }
  async finish() {
    this.closed = true;
    for (const writer of this.clips) writer.close();
    this.clips.clear();
    await Promise.all(this.pending);
  }
  private async persist(
    speaker: string,
    language: Language,
    sid: string,
    listener: string | undefined,
    rate: number,
    chunk: Chunk,
  ) {
    const db = await database();
    const id = randomUUID(),
      duration = Math.round((chunk.pcm.length * 500) / rate);
    const key =
      this.room + "/" + id + (listener ? "/incoming.wav" : "/original.wav");
    await db.transaction(async (q) => {
      const state = await roomState(q, this.room, speaker, true);
      if (
        !state.canRecord ||
        state.room.media_epoch !== this.epoch ||
        state.room.transport !== "livekit"
      )
        return;
      if (
        listener &&
        !state.members.some(
          (m) => m.id === listener && m.listening === language,
        )
      )
        return;
      if (listener) {
        const [budget] = await q<{ used: number }>(
          "select coalesce(sum(duration_ms),0)::integer as used from sahva.meeting_replays where room_id=$1 and listener_id=$2",
          [this.room, listener],
        );
        if (budget.used + duration > 60 * 30000)
          throw new Problem(
            429,
            "LIMIT",
            "Your 30-minute replay archive is full. Live audio continues.",
          );
        await q(
          "insert into sahva.meeting_replays(id,room_id,speaker_id,listener_id,epoch,source_track,target,started_at,duration_ms,audio_key,provider,caption) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          [
            id,
            this.room,
            speaker,
            listener,
            this.epoch,
            sid,
            language,
            new Date(chunk.start).toISOString(),
            duration,
            key,
            model,
            chunk.draft,
          ],
        );
      } else {
        const [budget] = await q<{ count: number }>(
          "select count(*)::integer as count from sahva.turns where room_id=$1",
          [this.room],
        );
        if (budget.count >= 60)
          throw new Problem(
            429,
            "LIMIT",
            "The room has reached its 60-turn original recording limit. Live audio continues.",
          );
        await q(
          "insert into sahva.turns(id,room_id,speaker_id,seq,idem,mime,duration_ms,original_key,created_at,source,target,raw_text,stage,timings) select $1,$2,$3,coalesce(max(seq),0)+1,$1,'audio/wav',$4,$5,$6,$7,$7,$8,'ready',$9::jsonb from sahva.turns where room_id=$2",
          [
            id,
            this.room,
            speaker,
            duration,
            key,
            new Date(chunk.start).toISOString(),
            language,
            chunk.text,
            JSON.stringify({
              provider: model,
              sourceTrack: sid,
              epoch: this.epoch,
              geminiDraft: chunk.draft,
            }),
          ],
        );
      }
      await save(
        listener ? "room-translated-audio" : "room-original-audio",
        key,
        wave(chunk.pcm, rate),
        "audio/wav",
      );
    });
  }
}
export async function meetingReplays(room: string, person: string) {
  const db = await database();
  return db.query(
    "select id,speaker_id,target,started_at,duration_ms,caption from sahva.meeting_replays where room_id=$1 and listener_id=$2 order by started_at,id",
    [room, person],
  );
}
export async function replayAudio(room: string, person: string, id: string) {
  const db = await database();
  await roomState(db.query, room, person);
  const [row] = await db.query<{ audio_key: string }>(
    "select audio_key from sahva.meeting_replays where room_id=$1 and listener_id=$2 and id=$3",
    [room, person, id],
  );
  if (!row) throw new Problem(404, "MEDIA", "This replay is unavailable.");
  return playback("room-translated-audio", row.audio_key, "audio/wav");
}
