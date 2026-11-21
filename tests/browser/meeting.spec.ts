import { test, expect } from "@playwright/test";
import { meetingConsent, consentVersion } from "../../lib/shared";

test("group invitations bind consent, fill six seats atomically and revoke the media epoch", async ({
  request,
  browser,
  baseURL,
}) => {
  const root = baseURL + "/api/v1/rooms",
    headers = { "x-sahva-request": "1" };
  const profile = {
    name: "Meeting member",
    speakingLanguage: "en-IN",
    listeningLanguage: "te-IN",
    consentVersion: meetingConsent,
    acceptedConsent: true,
  };
  const created = await request.post(root, {
    headers,
    data: { ...profile, transport: "livekit" },
  });
  expect(created.status()).toBe(201);
  const { roomId, invite } = await created.json();
  const room = root + "/" + roomId;
  const alone = await request.post(room + "/meeting", { headers, data: {} });
  expect(alone.status()).toBe(403);
  const contexts = await Promise.all(
    Array.from({ length: 6 }, () => browser.newContext()),
  );
  try {
    expect((await contexts[0].request.get(room + "/timeline")).status()).toBe(
      401,
    );
    expect(
      (
        await contexts[0].request.post(room + "/join", {
          headers,
          data: { ...profile, invite, consentVersion },
        })
      ).status(),
    ).toBe(400);
    const results = await Promise.all(
      contexts.map((c) =>
        c.request.post(room + "/join", {
          headers,
          data: { ...profile, invite },
        }),
      ),
    );
    expect(results.map((r) => r.status()).sort()).toEqual([
      201, 201, 201, 201, 201, 409,
    ]);
    const before = await (await request.get(room + "/timeline")).json();
    expect(before.canRecord).toBe(true);
    expect(before.members.map((m: { seat: number }) => m.seat)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    const guest = contexts[results.findIndex((r) => r.ok())].request;
    expect(
      (await guest.post(room + "/end", { headers, data: {} })).status(),
    ).toBe(403);
    const revoked = await guest.post(room + "/consent", {
      headers,
      data: { accepted: false, consentVersion: meetingConsent },
    });
    expect(revoked.status()).toBe(200);
    expect(await revoked.json()).toMatchObject({
      canRecord: false,
      room: { media_epoch: before.room.media_epoch + 1 },
    });
    expect(
      (await request.post(room + "/meeting", { headers, data: {} })).status(),
    ).toBe(403);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
