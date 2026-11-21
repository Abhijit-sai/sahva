import { expect, test } from "@playwright/test";
import { consentVersion } from "../../lib/shared";
const headers = { "x-sahva-request": "1" };
const profile = {
  name: "Test user",
  listeningLanguage: "en-IN",
  speakingLanguage: "en-IN",
  acceptedConsent: true,
  consentVersion,
};
test("room-scoped sessions, concurrent joins, protected media, consent and empty meeting", async ({
  request,
  browser,
  baseURL,
}) => {
  const rooms = baseURL + "/api/v1/rooms";
  expect((await request.post(rooms, { data: profile })).status()).toBe(403);
  expect(
    (
      await request.post(rooms, {
        headers,
        data: { ...profile, acceptedConsent: false },
      })
    ).status(),
  ).toBe(400);
  const a = await (
    await request.post(rooms, { headers, data: profile })
  ).json();
  const b = await (
    await request.post(rooms, { headers, data: profile })
  ).json();
  const cookie = (await request.storageState()).cookies.find(
    (c) => c.name === "sahva_" + a.roomId,
  )!;
  const outsider = await browser.newContext();
  const other = rooms + "/" + b.roomId;
  const forged = { cookie: "sahva_" + b.roomId + "=" + cookie.value };
  expect(
    (
      await outsider.request.get(other + "/timeline", { headers: forged })
    ).status(),
  ).toBe(401);
  expect(
    (
      await outsider.request.get(
        other + "/media/" + crypto.randomUUID() + "?kind=original",
        { headers: forged },
      )
    ).status(),
  ).toBe(401);
  const room = rooms + "/" + a.roomId;
  const data = {
    idempotencyKey: crypto.randomUUID(),
    audio: {
      name: "empty.wav",
      mimeType: "audio/wav",
      buffer: Buffer.alloc(4),
    },
  };
  expect(
    (
      await request.post(room + "/turns", { headers, multipart: data })
    ).status(),
  ).toBe(403);
  const guests = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const responses = await Promise.all(
    guests.map((ctx) =>
      ctx.request.post(room + "/join", {
        headers,
        data: { ...profile, invite: a.invite },
      }),
    ),
  );
  expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
  expect(
    (
      await request.post(room + "/turns", { headers, multipart: data })
    ).status(),
  ).toBe(422);
  const occupiedKey = crypto.randomUUID();
  expect(
    (
      await request.post(room + "/recording", {
        headers,
        data: { recording: true, key: occupiedKey },
      })
    ).status(),
  ).toBe(200);
  const joined = guests[responses.findIndex((r) => r.ok())];
  expect(
    (
      await joined.request.post(room + "/recording", {
        headers,
        data: { recording: true, key: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(409);
  await request.post(room + "/recording", {
    headers,
    data: { recording: false, key: occupiedKey },
  });
  await request.post(room + "/end", { headers, data: {} });
  await request.post(room + "/end", { headers, data: {} });
  expect(
    (
      await request.post(room + "/turns", { headers, multipart: data })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(room + "/report/generate", { headers, data: {} })
    ).status(),
  ).toBe(200);
  const result = await (await request.get(room + "/report?lang=te-IN")).json();
  expect(result).toMatchObject({
    version: 1,
    items: [],
    status: "ready",
    language: "te-IN",
    skipped: 0,
  });
  await outsider.close();
  await Promise.all(guests.map((ctx) => ctx.close()));
});
