import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TurnView } from "../../components/turn-card";
import type { Fact } from "../../lib/providers/meeting";
import { consentVersion } from "../../lib/shared";

test("four consented voice notes through two sessions, both speech directions and one localized report", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240000);
  const guest = await browser.newContext();
  const second = await guest.newPage();
  const headers = { "x-sahva-request": "1" };
  await page.goto("/");
  await page.getByLabel("Your name").fill("Speaker A");
  await page.getByLabel("Listen in").selectOption("te-IN");
  await page.getByLabel("Speak in").selectOption("te-IN");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Agree & create room" }).click();
  const invite = await page.getByLabel("Invitation link").inputValue();
  const room = new URL(invite).pathname.split("/").pop();
  const api = baseURL + "/api/v1/rooms/" + room;
  await second.goto(invite);
  await second.getByLabel("Your name").fill("Speaker B");
  await second.getByRole("checkbox").check();
  await second.getByRole("button", { name: "Agree & join" }).click();
  await page.getByText("Audio options", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Record a turn" }),
  ).toBeVisible();
  const turns = async (): Promise<TurnView[]> =>
    (await (await page.request.get(api + "/timeline")).json()).turns;
  for (const [index, file] of [
    "Telugu 1",
    "English 1",
    "Telugu 2",
    "English 2",
  ].entries()) {
    const speaker = index % 2 === 0 ? page : second;
    const recipient = index % 2 === 0 ? second : page;
    const buffer = await readFile(join(".sahva", "clips", file + ".m4a.mp4"));
    const multipart = {
      audio: { name: "turn.mp4", mimeType: "audio/mp4", buffer },
      idempotencyKey: crypto.randomUUID(),
    };
    const uploaded = await speaker.request.post(api + "/turns", {
      headers,
      multipart,
    });
    expect(uploaded.status()).toBe(202);
    const { id } = await uploaded.json();
    const duplicate = await speaker.request.post(api + "/turns", {
      headers,
      multipart,
    });
    expect((await duplicate.json()).id === id).toBe(true);
    await expect
      .poll(async () => (await turns()).find((t) => t.id === id)?.stage, {
        timeout: 45000,
        intervals: [1000, 1500],
      })
      .toBe("ready");
    const row = (await turns()).find((t) => t.id === id)!;
    expect(row.source).toBe(index % 2 === 0 ? "te-IN" : "en-IN");
    expect(row.target).toBe(index % 2 === 0 ? "en-IN" : "te-IN");
    expect(row.voice && !!row.translated_text).toBe(true);
    const replay = await recipient.request.get(
      api + "/media/" + id + "?kind=original",
    );
    expect((await replay.body()).equals(buffer)).toBe(true);
    const card = recipient.locator("#turn-" + id);
    await expect(card.locator("audio")).toHaveCount(2);
    const playable = await card
      .getByLabel("Replay translated message")
      .evaluate(async (a: HTMLAudioElement) => {
        await a.play();
        a.pause();
        return a.readyState >= 2;
      });
    expect(playable).toBe(true);
  }
  await second.reload();
  await expect(second.locator("article")).toHaveCount(4);
  const first = (await turns())[0];
  const revised = await page.request.post(
    api + "/turns/" + first.id + "/revisions",
    {
      headers,
      data: { correctedText: first.raw_text + "!", expectedCurrentRevision: 0 },
    },
  );
  expect(revised.status()).toBe(200);
  await expect
    .poll(async () => (await turns())[0].stage, { timeout: 45000 })
    .toBe("ready");
  expect((await turns())[0].revision).toBe(1);
  expect((await turns())[0].raw_text === first.raw_text).toBe(true);
  const forbidden = await second.request.post(api + "/end", {
    headers,
    data: {},
  });
  expect(forbidden.status()).toBe(403);
  await page.getByRole("button", { name: "End call" }).click();
  const getReport = async (lang: string) =>
    await (await second.request.get(api + "/report?lang=" + lang)).json();
  await expect
    .poll(async () => (await getReport("en-IN")).status, {
      timeout: 100000,
      intervals: [2000],
    })
    .toBe("ready");
  const en = await getReport("en-IN"),
    te = await getReport("te-IN");
  expect(en.items.length).toBeGreaterThan(0);
  const fields = (facts: Fact[]) =>
    facts.map((f) => ({
      id: f.id,
      status: f.status,
      owner: f.owner,
      deadline: f.deadline,
      evidence: f.evidence,
    }));
  expect(
    JSON.stringify(fields(en.items)) === JSON.stringify(fields(te.items)),
  ).toBe(true);
  expect(te.items.some((f: Fact) => /[\u0c00-\u0c7f]/.test(f.text))).toBe(true);
  await expect(page.getByLabel("Report language")).toHaveValue("te-IN");
  await expect(second.getByLabel("Report language")).toHaveValue("en-IN");
  await second.locator(".citation").first().click();
  expect(
    (await page.request.post(api + "/end", { headers, data: {} })).status(),
  ).toBe(202);
  expect((await getReport("en-IN")).version).toBe(en.version);
  const closed = await page.request.post(api + "/consent", {
    headers,
    data: { accepted: true, consentVersion },
  });
  expect(closed.ok()).toBe(true);
  console.log(
    "Verified 4 persisted turns, 4 AI voice playbacks, 1 speaker revision and",
    en.items.length,
    "matching bilingual report items.",
  );
  await guest.close();
});
