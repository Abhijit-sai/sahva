// Three isolated browser profiles. Only the microphone waveform is synthetic.
import { chromium, expect } from "@playwright/test";
import { join } from "node:path";
import assert from "node:assert/strict";
import { installSyntheticMicrophone } from "./qa-microphone.mjs";
const fixtures = process.argv[2];
if (!fixtures) throw Error("Pass the synthetic WAV fixture directory.");
const trilingual = process.argv.includes("--trilingual");
const captionsOnlyTe = process.argv.includes("--telugu-captions");
const origin = process.env.SAHVA_SMOKE_ORIGIN || "http://localhost:3024";
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const pages = [];
const button = (page, name) => page.getByRole("button", { name, exact: true });
async function enter(name, source, target, url) {
  const p = await browser.newPage();
  pages.push(p);
  await installSyntheticMicrophone(
    p,
    join(
      fixtures,
      source === "hi-IN"
        ? "hindi.wav"
        : source === "te-IN"
          ? "telugu.wav"
          : "english.wav",
    ),
  );
  await p.goto(url ?? origin);
  if (!url) {
    await p.getByLabel("Room type").selectOption("meeting");
    await expect(
      p.getByRole("heading", { name: "Create a meeting room." }),
    ).toBeVisible();
  }
  await p.getByLabel("Your name").fill(name);
  await p.getByLabel("Speak in").selectOption(source);
  await p.getByLabel("Listen in").selectOption(target);
  await p.getByRole("checkbox").check();
  await button(p, url ? "Agree & join" : "Agree & create room").click();
  return p;
}
try {
  const a = await enter("Sam", "en-IN", "en-IN");
  const invite = await a.getByLabel("Invitation link").inputValue();
  const b = await enter("Anu", "te-IN", "te-IN", invite);
  const c = await enter(
    "Mira",
    trilingual ? "hi-IN" : "en-IN",
    trilingual ? "hi-IN" : "en-IN",
    invite,
  );
  const path =
    origin + "/api/v1/rooms/" + new URL(invite).pathname.split("/").pop();
  const state = async (p) =>
    await (await p.request.get(path + "/timeline")).json();
  for (const p of pages) {
    await expect(p.locator(".member")).toHaveCount(3);
    await button(p, "Join meeting audio").click();
    await expect(button(p, "Leave meeting audio")).toBeVisible({
      timeout: 90000,
    });
  }
  if (trilingual) {
    const langs = ["en-IN", "te-IN", "hi-IN"];
    const scripts = [/[a-z]/i, /[\u0c00-\u0c7f]/, /[\u0900-\u097f]/];
    const members = await Promise.all(
      pages.map(async (p) => (await state(p)).me.id),
    );
    for (const [i, speaker] of pages.entries()) {
      const start = Date.now();
      await speaker.evaluate(() => window.qaSpeak());
      await Promise.all(
        pages.map(async (listener, j) => {
          if (i === j) return;
          const card = listener.locator("article.chat-message").nth(i);
          const expectVoice = !(captionsOnlyTe && j === 1);
          if (expectVoice)
            await expect(card.locator(".playing-label")).toBeVisible({
              timeout: 90000,
            });
          else
            await expect(card.getByText(/Sreekar.*unavailable/)).toBeVisible({
              timeout: 90000,
            });
          const t = (await state(listener)).turns[i];
          assert.equal(t.speaker_id, members[i]);
          assert.equal(t.source, langs[i]);
          assert.equal(t.target, langs[j]);
          assert.match(t.translated_text, scripts[j]);
          await expect(card.locator(".message-caption")).toHaveText(
            t.translated_text,
          );
          assert.equal(t.voice, expectVoice);
          if (expectVoice && j === 1) {
            const expected =
              process.env.SAHVA_SMOKE_TELUGU_VOICE || "tarun_te_narration";
            assert.equal(t.output_voice, expected);
            console.log("Verified Telugu voice", t.output_voice);
          }
          if (expectVoice) {
            const media = await listener.request.get(
              path + "/media/" + t.id + "?kind=translation",
            );
            assert.ok(media.ok());
            const wave = await media.body();
            assert.equal(wave.toString("ascii", 8, 12), "WAVE");
          }
          console.log(
            langs[i],
            "→",
            langs[j],
            expectVoice ? "browser playback" : "translated captions only",
            Date.now() - start,
            "ms from source start",
          );
        }),
      );
      await Promise.all(
        pages.map((p) =>
          expect(p.locator(".playing-label")).toHaveCount(0, {
            timeout: 30000,
          }),
        ),
      );
    }
    await button(a, "End call").click();
    // Repeating the same instruction does not imply the participants agreed on a decision.
    await expect
      .poll(
        async () =>
          (await (await c.request.get(path + "/report?lang=en-IN")).json())
            .status,
        { timeout: 120000 },
      )
      .toBe("ready");
    const report = await (
      await c.request.get(path + "/report?lang=en-IN")
    ).json();
    const turnIds = new Set((await state(c)).turns.map((t) => t.id));
    for (const item of report.items)
      for (const evidence of item.evidence)
        assert.ok(turnIds.has(evidence.turnId));
    console.log(
      "Three-language room ended; report ready with",
      report.items.length,
      "items.",
    );
  } else {
    const t0 = Date.now();
    await a.evaluate(() => window.qaSpeak());
    await expect(
      c.locator(".live-caption").filter({ hasText: "Sam" }),
    ).toBeVisible({ timeout: 35000 });
    await expect(b.getByText("Draft translation", { exact: true })).toBeVisible(
      {
        timeout: 20000,
      },
    );
    const captionMs = Date.now() - t0;
    for (const p of [b, c])
      await expect(p.locator("article.chat-message")).toHaveCount(1, {
        timeout: 60000,
      });
    // Use browser-observed playback and the actual media URL selected for each recipient.
    await Promise.all(
      [b, c].map((p) =>
        expect(p.locator("article .playing-label")).toBeVisible({
          timeout: 60000,
        }),
      ),
    );
    const playbackMs = Date.now() - t0;
    const [translated] = (await state(b)).turns,
      [original] = (await state(c)).turns;
    assert.equal(translated.id, original.id);
    assert.equal(translated.speaker_id, original.speaker_id);
    assert.equal(translated.target, "te-IN");
    assert.equal(original.target, "en-IN");
    assert.match(translated.translated_text, /[\u0c00-\u0c7f]/);
    assert.equal(original.translated_text, original.raw_text);
    assert.equal(translated.voice, true);
    assert.equal(original.voice, false);
    for (const p of [b, c]) {
      const card = p.locator("article").first();
      await expect(card.locator(".message-caption")).toHaveText(
        p === b ? translated.translated_text : original.current_text,
      );
      await expect(card.locator(".voice-message audio")).toHaveAttribute(
        "src",
        p === b ? /kind=translation/ : /kind=original/,
      );
      await card.getByText("Original", { exact: true }).click();
      assert.equal(
        await card.locator(".message-original p").first().innerText(),
        original.raw_text,
      );
      const media = await p.request.get(
        path + "/media/" + original.id + "?kind=original",
      );
      assert.equal((await media.body()).toString("ascii", 0, 4), "RIFF");
    }
    console.log(
      "Three-seat English utterance: displayed draft",
      captionMs,
      "ms; both players started within",
      playbackMs,
      "ms from onset.",
    );
    await Promise.all(
      pages.map((p) =>
        expect(p.locator(".playing-label")).toHaveCount(0, { timeout: 30000 }),
      ),
    );
    await Promise.all([a, b].map((p) => p.evaluate(() => window.qaSpeak())));
    await expect(c.locator(".live-caption[data-has-speech]")).toHaveCount(2, {
      timeout: 20000,
    });
    await expect
      .poll(
        async () =>
          (await state(c)).turns.filter((t) => t.stage === "ready").length,
        { timeout: 90000 },
      )
      .toBe(3);
    const overlap = (await state(c)).turns.slice(1);
    assert.equal(new Set(overlap.map((t) => t.speaker_id)).size, 2);
    assert.equal(new Set(overlap.map((t) => t.source)).size, 2);
    const te = overlap.find((t) => t.source === "te-IN");
    assert.equal(te.target, "en-IN");
    assert.ok(te.voice && te.translated_text);
    await button(c, "Withdraw consent").click();
    for (const p of pages)
      await expect(button(p, "Leave meeting audio")).toHaveCount(0, {
        timeout: 15000,
      });
    await button(c, "Consent again").click();
    await button(b, "Join meeting audio").click();
    await expect(button(b, "Leave meeting audio")).toBeVisible({
      timeout: 25000,
    });
    await button(a, "End call").click();
    await expect(c.locator(".citation").first()).toBeVisible({
      timeout: 120000,
    });
    console.log(
      "PASS: three independent profiles, mixed-language delivery, original replay, two overlapping speakers, consent shutdown, new audio connection and meeting evidence.",
    );
  }
} catch (e) {
  for (const p of pages)
    console.log(
      "room diagnostics",
      await p.locator(".live-heading span").allTextContents(),
      await p.getByRole("alert").allTextContents(),
      await p.locator("article .status").allTextContents(),
    );
  throw e;
} finally {
  await browser.close();
}
