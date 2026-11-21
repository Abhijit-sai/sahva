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

test("interpreted output recovers a blocked pre-join speaker without opening a microphone", async ({
  page,
  browser,
  baseURL,
}) => {
  test.skip(
    process.env.SAHVA_RTC_TEST !== "1",
    "requires the interpreted-meeting flag",
  );
  const profile = {
    transport: "livekit",
    name: "Listener",
    speakingLanguage: "en-IN",
    listeningLanguage: "en-IN",
    acceptedConsent: true,
    consentVersion: meetingConsent,
  };
  const headers = { "x-sahva-request": "1" };
  const path = baseURL + "/api/v1/rooms";
  const owner = await page.request.post(path, { headers, data: profile });
  expect(owner.ok()).toBeTruthy();
  const { roomId, invite } = await owner.json();
  const peer = await browser.newContext();
  try {
    expect(
      (
        await peer.request.post(path + "/" + roomId + "/join", {
          headers,
          data: { ...profile, invite, name: "Peer" },
        })
      ).ok(),
    ).toBeTruthy();
    await page.addInitScript(() => {
      const resume = AudioContext.prototype.resume;
      let blocked = true;
      AudioContext.prototype.resume = function () {
        if (blocked) {
          blocked = false;
          return this.suspend().then(() => { throw new DOMException("Blocked", "NotAllowedError"); });
        }
        return resume.call(this);
      };
    });
    await page.goto("/room/" + roomId);
    await page.getByRole("button", { name: "Test speaker" }).click();
    const recover = page.getByRole("button", { name: "Enable meeting audio" });
    await expect(recover).toBeVisible();
    await recover.click();
    await expect(recover).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Join meeting audio" }),
    ).toBeVisible();
    await page.getByText("Audio delivery", { exact: true }).click();
    await page.getByLabel("Use archived phrase playback").check();
    await expect(
      page.getByRole("button", { name: "Test speaker" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Join meeting audio" }),
    ).toBeVisible();
  } finally {
    await peer.close();
  }
});

test("the first choice creates an interpreted room when live media is enabled", async ({page}) => {
  test.skip(process.env.SAHVA_RTC_TEST !== "1", "requires the interpreted-meeting flag");
  await page.goto("/");
  await expect(page.getByLabel("Room type")).toHaveValue("meeting");
  await page.getByLabel("Your name").fill("Route check");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Agree & create room" }).click();
  const invite = new URL(await page.getByLabel("Invitation link").inputValue());
  expect(invite.searchParams.get("meeting")).toBe("1");
  const id = invite.pathname.split("/").pop();
  const state = await (await page.request.get("/api/v1/rooms/" + id + "/timeline")).json();
  expect(state.room.transport).toBe("livekit");
  expect(state.liveMedia).toBe(true);
});
