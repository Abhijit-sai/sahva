import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  MeetingArchive,
  meetingReplays,
  replayAudio,
} from "../lib/server/meeting-archive";
import { enter } from "../lib/server/rooms";
import { database } from "../lib/server/db";
import { revise, timeline, processStage } from "../lib/server/turns";
import { meetingConsent } from "../lib/shared";

it("keeps a byte-identical private replay through correction and discards stale-epoch media", async () => {
  const config = {
    SAHVA_LOCAL: "1",
    SAHVA_TEST_RUN: randomUUID(),
    SAHVA_OFFLINE_TEST: "1",
    SAHVA_LIVEKIT: "1",
    LIVEKIT_URL: "ws://127.0.0.1:1",
    LIVEKIT_API_KEY: "fixture",
    LIVEKIT_API_SECRET: "fixture",
  };
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
  try {
    const profile = {
      name: "Author",
      transport: "livekit",
      speakingLanguage: "fr",
      listeningLanguage: "fr",
      acceptedConsent: true,
      consentVersion: meetingConsent,
    };
    const author = await enter(profile);
    const listener = await enter(
      {
        ...profile,
        invite: author.invite,
        name: "Listener",
        speakingLanguage: "pt-BR",
        listeningLanguage: "pt-BR",
      },
      author.id,
    );
    const issues = new Map<string, string>();
    const archive = new MeetingArchive(author.id, 0, issues);
    const original = archive.original(author.member, "fr", "mic");
    original.frame(Buffer.from(new Int16Array(320).fill(900).buffer));
    original.transcript("Bonjour.", true);
    const mix = archive.replay(author.member, listener.member, "pt-BR", "mic");
    const frames = [3800, 4000, 4200].map((n) =>
      Buffer.from(new Int16Array(480).fill(n).buffer),
    );
    for (const pcm of frames) mix.frame(pcm, true);
    mix.transcript("Olá.", false);
    await archive.finish();
    expect(issues.size).toBe(0);
    const rows = await meetingReplays(author.id, listener.member);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ target: "pt-BR", caption: "Olá." });
    const key = String(rows[0].id);
    const read = async () =>
      Buffer.from(
        await (
          await replayAudio(author.id, listener.member, key)
        ).arrayBuffer(),
      ).subarray(44);
    expect(await read()).toEqual(Buffer.concat(frames));
    const { turns } = await timeline(author.id, author.member);
    expect(turns).toHaveLength(1);
    await revise(author.id, author.member, String(turns[0].id), {
      correctedText: "Bonsoir.",
      expectedCurrentRevision: 0,
    });
    expect(
      await processStage(author.id, author.member, String(turns[0].id), true),
    ).toBeUndefined();
    expect(await read()).toEqual(Buffer.concat(frames));
    await expect(
      replayAudio(author.id, author.member, key),
    ).rejects.toMatchObject({ status: 404 });
    const stale = new MeetingArchive(author.id, 0, issues);
    stale
      .replay(author.member, listener.member, "pt-BR", "old")
      .frame(frames[0], true);
    const db = await database();
    await db.query("update sahva.turns set stage='tts' where id=$1", [turns[0].id]);
    await processStage(author.id, author.member, String(turns[0].id), false);
    expect((await timeline(author.id, author.member)).turns[0].error).toBe("LIVE_REPLAY_UNAVAILABLE");
    expect(await read()).toEqual(Buffer.concat(frames));
    await db.query(
      "update sahva.rooms set media_epoch=media_epoch+1 where id=$1",
      [author.id],
    );
    await stale.finish();
    expect(await meetingReplays(author.id, listener.member)).toHaveLength(1);
  } finally {
    vi.unstubAllEnvs();
  }
}, 30000);
