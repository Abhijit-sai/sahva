import { meetingReplays, replayAudio } from "../../../../../lib/server/meeting-archive";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticate,
  enter,
  Problem,
  roomState,
} from "../../../../../lib/server/rooms";
import { database } from "../../../../../lib/server/db";
import {
  beginLive,
  appendFrame,
  interpretDraft,
  finishLive,
  liveCaptions,
  cancelRoomStream,
} from "../../../../../lib/server/live";
import { setRecording } from "../../../../../lib/server/recording";
import { endRoom, generate, report } from "../../../../../lib/server/reports";
import {
  upload,
  timeline,
  media,
  revise,
  processStage,
} from "../../../../../lib/server/turns";
import { serverTime } from "../../../../../lib/rehearsal";
import { consentVersion, meetingConsent } from "../../../../../lib/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ parts?: string[] }> };
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
// Count chunked bodies too. Content-Length is optional and untrusted.
async function boundedBody(req: NextRequest, limit: number) {
  if (Number(req.headers.get("content-length")) > limit)
    throw new Problem(413, "SIZE", "Request exceeds the size limit.");
  const reader = req.body?.getReader();
  if (!reader) throw new Problem(400, "BODY", "Missing request body.");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Problem(413, "SIZE", "Request exceeds the size limit.");
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(new Blob(chunks), {
    headers: { "content-type": req.headers.get("content-type") ?? "" },
  });
}
async function jsonInput(req: NextRequest) {
  return (await boundedBody(req, 16000)).json();
}
async function handle(req: NextRequest, context: Params) {
  try {
    const parts = (await context.params).parts ?? [];
    const [id, action] = parts;
    const post = req.method === "POST";
    if (
      post &&
      (req.headers.get("x-sahva-request") !== "1" ||
        (req.headers.get("origin") &&
          new URL(req.headers.get("origin")!).host !==
            req.headers.get("host") &&
          req.headers.get("origin") !== process.env.SAHVA_BASE_URL))
    )
      throw new Problem(403, "ORIGIN", "Open the room to send this request.");
    if (id && !z.uuid().safeParse(id).success)
      throw new Problem(404, "ROOM", "Room unavailable.");
    if (
      post &&
      (parts.length === 0 || (action === "join" && parts.length === 2))
    ) {
      const session = await enter(await jsonInput(req), id);
      const response = json(
        {
          roomId: session.id,
          participantId: session.member,
          invite: session.invite,
        },
        201,
      );
      response.cookies.set("sahva_" + session.id, session.token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/api/v1/rooms/" + session.id,
        maxAge: 86400,
      });
      return response;
    }
    if (!id) throw new Problem(404, "ROUTE", "Unknown room route.");
    const participant = await authenticate(
      id,
      req.cookies.get("sahva_" + id)?.value,
    );
    const db = await database();
    if (!post && action === "timeline" && parts.length === 2) {
      await db.query(
        "update sahva.participants set last_seen=now() where room_id=$1 and id=$2 and last_seen<now()-interval '5 seconds'",
        [id, participant],
      );
      const snapshot = await timeline(id, participant);
      const meeting = snapshot.room.transport === "livekit" ? await import("../../../../../lib/server/meeting") : undefined;
      const captions = snapshot.canRecord ? liveCaptions(id, snapshot.me.listening) : [];
      return json({
        ...snapshot,
        liveMedia: !!meeting && meeting.interpretedRoom(),
        radio: !!meeting && meeting.radioRoom(),
        radioCaptions: snapshot.canRecord ? meeting?.radioCaptions(id, participant) : [],
        connectedMicrophones: snapshot.canRecord ? meeting?.connectedMicrophones(id, snapshot.room.media_epoch) : [],
        captions,
        meetingIssues: meeting?.meetingIssues(id) ?? {},
        replays: meeting ? await meetingReplays(id,participant) : [],
        serverTime: serverTime(),
        caption: captions[0] ?? null,
      });
    }
    if (post && action === "meeting" && parts.length === 3 && parts[2] === "decoded") {
      throw new Problem(409,"MEETING_AUDIO","Refresh to join the Gemini meeting.");
    }
    if (post && action === "meeting" && parts.length === 3 && parts[2] === "voice") {
      throw new Problem(409,"GEMINI_VOICE","This meeting uses Gemini Live Translate.");
    }
    if (post && action === "meeting" && parts.length === 2) {
      await jsonInput(req);
      return json(
        await (
          await import("../../../../../lib/server/meeting")
        ).joinMeeting(id, participant),
      );
    }
    if (post && action === "turns" && parts.length === 2) {
      if (Number(req.headers.get("content-length")) > 4_100_000)
        throw new Problem(413, "SIZE", "Recording exceeds 4 MB.");
      return json(
        await upload(
          id,
          participant,
          await (await boundedBody(req, 4_100_000)).formData(),
        ),
        202,
      );
    }
    if (post && action === "live" && parts.length === 3) {
      if (parts[2] === "start") return json(await beginLive(id, participant));
      if (parts[2] === "frame")
        return json(
          appendFrame(
            id,
            participant,
            await (await boundedBody(req, 24000)).json(),
          ),
        );
      if (parts[2] === "interpret") {
        await interpretDraft(id, participant, await jsonInput(req));
        return json({ ok: true });
      }
      if (parts[2] === "finish")
        return json(await finishLive(id, participant, await jsonInput(req)));
    }
    if (post && action === "recording" && parts.length === 2) {
      await setRecording(id, participant, await jsonInput(req), "phrase");
      return json({ ok: true });
    }
    if (post && action === "end" && parts.length === 2) {
      const state = await roomState(db.query,id,participant);
      if (state.me.seat === 1 && state.room.transport === "livekit") await (await import("../../../../../lib/server/meeting")).stopMeeting(id);
      await endRoom(id, participant);
      cancelRoomStream(id);
      if (
        (await roomState(db.query, id, participant)).room.transport ===
        "livekit"
      )
        (await import("../../../../../lib/server/meeting")).stopMeeting(id);
      return json({ roomStatus: "ended" }, 202);
    }
    if (action === "report") {
      if (!post && parts.length === 2) {
        const lang = req.nextUrl.searchParams.get("lang");
        if (lang) z.enum(["en-IN", "te-IN"]).parse(lang);
        return json(await report(id, participant, lang));
      }
      if (
        post &&
        parts.length === 3 &&
        ["generate", "retry"].includes(parts[2])
      ) {
        await generate(id, participant, parts[2] === "retry");
        return json({ ok: true });
      }
    }
    if (parts[2] && !z.uuid().safeParse(parts[2]).success)
      throw new Problem(404, "TURN", "Turn unavailable.");
    if (!post && action === "replays" && parts.length === 3) return await replayAudio(id,participant,parts[2]);
    if (!post && action === "media" && parts.length === 3)
      return media(
        id,
        participant,
        parts[2],
        req.nextUrl.searchParams.get("kind"),
      ).catch((error) => {
        if (error instanceof Problem)
          return json(
            { error: { code: error.code, message: error.message } },
            error.status,
          );
        return json(
          { error: { code: "STORAGE", message: "Audio storage unavailable." } },
          503,
        );
      });
    if (post && action === "turns" && parts.length === 4) {
      if (parts[3] === "revisions")
        await revise(id, participant, parts[2], await jsonInput(req));
      else if (parts[3] === "process" || parts[3] === "retry") {
        for (let stage = 0; stage < 3; stage++) {
          if (
            !(await processStage(
              id,
              participant,
              parts[2],
              stage === 0 && parts[3] === "retry",
            ))
          )
            break;
        }
      } else throw new Problem(404, "ROUTE", "Unknown turn operation.");
      return json({ ok: true });
    }
    if (!post && parts.length === 1) {
      await db.query(
        "update sahva.participants set last_seen=now() where room_id=$1 and id=$2 and last_seen<now()-interval '5 seconds'",
        [id, participant],
      );
      return json(await roomState(db.query, id, participant));
    }
    if (post && action === "consent" && parts.length === 2) {
      const { accepted, consentVersion: version } = z
        .object({
          accepted: z.boolean(),
          consentVersion: z.enum([consentVersion, meetingConsent]),
        })
        .parse(await jsonInput(req));
      return json(
        await db.transaction(async (q) => {
          const state = await roomState(q, id, participant, true);
          if (
            version !==
            (state.room.transport === "livekit"
              ? meetingConsent
              : consentVersion)
          )
            throw new Problem(
              400,
              "CONSENT_VERSION",
              "Review the current consent notice.",
            );
          await q(
            "update sahva.participants set consented_at=case when $3 then now() end where room_id=$1 and id=$2",
            [id, participant, accepted],
          );
          if (!accepted) {
            if (state.room.transport === "livekit") {
              await q(
                "update sahva.rooms set media_epoch=media_epoch+1 where id=$1",
                [id],
              );
              (await import("../../../../../lib/server/meeting")).stopMeeting(
                id,
              );
            }
            cancelRoomStream(id);
            await q(
              "update sahva.participants set recording_until=null,recording_key=null where room_id=$1 and recording_key is not null",
              [id],
            );
          }
          return roomState(q, id, participant);
        }),
      );
    }
    throw new Problem(404, "ROUTE", "Unknown room route.");
  } catch (error) {
    const issue =
      error instanceof Problem
        ? error
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? new Problem(400, "INPUT", "Check the fields and consent notice.")
          : new Problem(
              503,
              "UNAVAILABLE",
              "Room service unavailable. Check server configuration and try again.",
            );
    return json(
      {
        error: {
          code: issue.code,
          message: issue.message,
          retryable: issue.status >= 500,
          traceId: crypto.randomUUID(),
        },
      },
      issue.status,
    );
  }
}
export const GET = handle;
export const POST = handle;
