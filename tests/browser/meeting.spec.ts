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
          return this.suspend().then(() => {
            throw new DOMException("Blocked", "NotAllowedError");
          });
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
    await expect(page.getByText("Use archived phrase playback")).toHaveCount(0);
  } finally {
    await peer.close();
  }
});

test("the first choice creates an interpreted room and preserves each listener's Gemini language", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.SAHVA_RTC_TEST !== "1",
    "requires the interpreted-meeting flag",
  );
  await page.goto("/");
  await expect(page.getByLabel("Room type")).toHaveValue("meeting");
  await page.getByLabel("Your name").fill("Route check");
  await page.getByLabel("Speak in").selectOption("fr");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Agree & create room" }).click();
  const invite = new URL(await page.getByLabel("Invitation link").inputValue());
  expect(invite.searchParams.get("meeting")).toBe("1");
  const id = invite.pathname.split("/").pop();
  const state = await (
    await page.request.get("/api/v1/rooms/" + id + "/timeline")
  ).json();
  expect(state.room.transport).toBe("livekit");
  expect(state.liveMedia).toBe(true);
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  try {
    const second = await guest.newPage();
    await second.goto(invite.href);
    await second.getByLabel("Listen in").selectOption("zh-Hant");
    await second.getByLabel("Your name").fill("Guest listener");
    await second.getByRole("checkbox").check();
    await second.getByRole("button", { name: "Agree & join" }).click();
    await expect(
      second.getByRole("button", { name: "Join meeting audio" }),
    ).toBeVisible();
    await expect(second.getByRole("group",{name:"Your incoming audio"})).toContainText("Chinese");
    await second.reload();
    await expect(second.getByRole("group",{name:"Your incoming audio"})).toContainText("Chinese");
    if (process.env.SAHVA_LOCAL_SFU_TEST === "1") {
      await second.evaluate(() => {
        const getMedia = navigator.mediaDevices.getUserMedia.bind(
          navigator.mediaDevices,
        );
        navigator.mediaDevices.getUserMedia = (constraints) => {
          if (constraints?.audio && !sessionStorage.getItem("allow-test-mic"))
            return Promise.reject(
              new DOMException(
                "Microphone permission denied",
                "NotAllowedError",
              ),
            );
          return getMedia(constraints);
        };
      });
      const joined = second.waitForResponse(
        (r) => r.url().endsWith("/" + id + "/meeting") && r.ok(),
      );
      await second.getByRole("button", { name: "Join meeting audio" }).click();
      await expect(
        second.getByRole("button", { name: "Retry microphone" }),
      ).toBeVisible();
      const incoming = second.getByRole("group", { name: "Your incoming audio" });
      const mic = second.getByRole("group", { name: "Your microphone" });
      await expect(mic.getByRole("status")).toHaveText("Microphone unavailable");
      const slider = second.getByRole("slider", { name: /Listening volume/ });
      await expect(slider).toBeVisible();
      await slider.fill("35");
      await expect(slider).toHaveAttribute("aria-valuetext", "35%");
      await incoming.getByRole("button", {name:"Mute incoming audio"}).click();
      await expect(incoming.getByRole("status")).toHaveText("Incoming audio muted");
      await expect(slider).toBeDisabled();
      await incoming.getByRole("button", {name:"Unmute incoming audio"}).click();
      await expect(slider).toHaveValue("35");
      await expect(
        second.getByRole("button", { name: "Leave meeting audio" }),
      ).toBeVisible();
      // Send a tone on the recipient's real RTC connection while microphone access is denied.
      const { outputToken, url } = await (await joined).json();
      expect(url).toBe("ws://127.0.0.1:17880");
      const outputRoom = JSON.parse(
        Buffer.from(outputToken.split(".")[1], "base64url").toString(),
      ).video.room;
      const { AccessToken } = await import("livekit-server-sdk");
      const rtc = await import("@livekit/rtc-node");
      const segment = crypto.randomUUID();
      const auth = new AccessToken("devkey", "secret", {
        identity: "radio-" + segment,
        ttl: 60,
      });
      auth.addGrant({
        roomJoin: true,
        room: outputRoom,
        canPublish: true,
        canSubscribe: false,
      });
      const sender = new rtc.Room();
      const source = new rtc.AudioSource(24000, 1, 100);
      const track = rtc.LocalAudioTrack.createAudioTrack(
        ["radio","zh-Hant",state.me.id,segment].join("/"),
        source,
      );
      try {
        await sender.connect(url, await auth.toJwt(), {
          autoSubscribe: false,
          dynacast: false,
        });
        const published = await sender.localParticipant!.publishTrack(
          track,
          new rtc.TrackPublishOptions(),
        );
        await published.waitForSubscription();
        const samples = Int16Array.from({ length: 480 }, (_, i) =>
          Math.round(8000 * Math.sin((i * Math.PI) / 24)),
        );
        for (let i = 0; i < 60; i++)
          await source.captureFrame(new rtc.AudioFrame(samples, 24000, 1, 480));
        await source.waitForPlayout();
        await expect
          .poll(() =>
            second.evaluate(
              (id) =>
                performance
                  .getEntriesByName("sahva.receiver-mix")
                  .some(
                    (mark) => (mark as PerformanceMark).detail?.speaker === id,
                  ),
              state.me.id,
            ),
          )
          .toBe(true);
      } finally {
        await sender.disconnect();
        await track.close(true);
      }
      await second.evaluate(() =>
        sessionStorage.setItem("allow-test-mic", "1"),
      );
      await second.getByRole("button", { name: "Retry microphone" }).click();
      await mic.getByRole("button", {name:"Mute microphone"}).click();
      await expect(mic.getByRole("status")).toHaveText("Muted");
      await expect(incoming.getByRole("button", {name:"Mute incoming audio"})).toBeEnabled();
      await mic.getByRole("button", {name:"Unmute microphone"}).click();
      await expect(
        page.getByText("Microphone connected", { exact: true }),
      ).toHaveCount(1);
      await page.route("**/api/v1/rooms/" + id + "/meeting", async route => {
        const response = await route.fetch();
        await route.fulfill({ response, json: {...await response.json(), outputToken: "invalid-local-fixture"} });
      });
      await page.getByRole("button", {name: "Join meeting audio"}).click();
      await expect(page.getByText(/Incoming audio could not connect/)).toBeVisible();
      await expect(second.getByText("Microphone connected", {exact:true})).toHaveCount(2);
      await page.getByRole("button", {name: "Leave meeting audio"}).click();
      await expect(
        second.getByRole("button", { name: "Leave meeting audio" }),
      ).toBeVisible();
      await second.reload();
      await expect(second.getByRole("group",{name:"Your incoming audio"})).toContainText("Chinese");
    }
  } finally {
    await guest.close();
  }
});

test("meeting layout keeps call controls first and pairs each speaker with the listener's interpretation", async ({page, browser, baseURL}, testInfo) => {
  test.skip(process.env.SAHVA_RTC_TEST !== "1", "requires the interpreted meeting flag");
  const root = baseURL + "/api/v1/rooms";
  const headers = {"x-sahva-request":"1"};
  const profile = {name:"Maya", title:"Design conversation", transport:"livekit", speakingLanguage:"en-IN", listeningLanguage:"en-IN", consentVersion:meetingConsent, acceptedConsent:true};
  const created = await page.request.post(root, {headers, data:profile});
  expect(created.ok()).toBeTruthy();
  const {roomId, invite} = await created.json();
  const guest = await browser.newContext();
  try {
    const joined = await guest.request.post(root + "/" + roomId + "/join", {headers, data:{...profile, invite, name:"Arun", speakingLanguage:"te-IN", listeningLanguage:"te-IN"}});
    expect(joined.ok()).toBeTruthy();
    // Recorded presentation fixture for the UI. No microphone or provider is started here.
    await page.route("**/" + roomId + "/timeline", async route => {
      const response = await route.fetch();
      const snapshot = await response.json();
      const peer = snapshot.members.find((person: {name:string}) => person.name === "Arun");
      await route.fulfill({response, json:{...snapshot, radio:true, radioCaptions:[{
        speaker:peer.id, source:"te-IN", target:"en-IN", original:"మనం రేపు మాట్లాడదామా?", translation:"Shall we talk tomorrow?"
      }]}});
    });
    await page.goto("/room/" + roomId);
    const audio = page.getByRole("region", {name:"Interpreted meeting audio"});
    const join = audio.getByRole("button", {name:"Join meeting audio"});
    await expect(join).toBeVisible();
    await expect(audio.getByRole("group",{name:"Your microphone"}).getByRole("status")).toHaveText("Off");
    await expect(page.getByText("మనం రేపు మాట్లాడదామా?")).toHaveAttribute("lang","te-IN");
    await expect(page.getByText("Shall we talk tomorrow?")).toHaveAttribute("lang","en-IN");
    await expect(page.getByLabel(/Voice I hear in/)).toHaveCount(0);
    for (const width of [1280,390,320]) {
      await page.setViewportSize({width,height:900});
      await expect(join).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const transcript = await page.getByRole("heading", {name:"Live transcript"}).boundingBox();
      expect((await join.boundingBox())!.y).toBeLessThan(transcript!.y);
      if (width !== 320) await page.screenshot({path:testInfo.outputPath("meeting-" + width + ".png"),fullPage:true});
    }
  } finally { await guest.close(); }
});
