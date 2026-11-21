import { test, expect } from "@playwright/test";
test("two consenting seats persist, third seat and unscoped access are refused", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  if (await page.getByLabel("Room type").count()) await page.getByLabel("Room type").selectOption("call");
  await page.getByLabel("Your name").fill("Test owner");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Agree & create room" }).click();
  const invite = await page.getByLabel("Invitation link").inputValue();
  const guest = await browser.newContext();
  const second = await guest.newPage();
  await second.goto(invite);
  await second.getByLabel("Your name").fill("Test guest");
  await second.getByLabel("Listen in").selectOption("te-IN");
  await second.getByRole("checkbox").check();
  await second.getByRole("button", { name: "Agree & join" }).click();
  await expect(page.getByText("Test guest", { exact: true })).toBeVisible();
  await expect(second.getByText("Test guest (you)")).toBeVisible();
  await second.getByText("Audio options", { exact: true }).click();
  await second
    .getByLabel("My translated voice in English")
    .selectOption("dev_en_conversational");
  await second.reload();
  await expect(second.getByText("Test guest (you)")).toBeVisible();
  await second.getByText("Audio options", { exact: true }).click();
  await expect(second.getByLabel("My translated voice in English")).toHaveValue(
    "dev_en_conversational",
  );
  const id = new URL(invite).pathname.split("/").pop();
  const stranger = await browser.newContext();
  const base = "http://127.0.0.1:3231/api/v1/rooms/" + id;
  expect((await stranger.request.get(base)).status()).toBe(401);
  const join = await stranger.request.post(base + "/join", {
    headers: { "x-sahva-request": "1" },
    data: {
      invite: new URLSearchParams(new URL(invite).hash.slice(1)).get("invite"),
      name: "Third",
      listeningLanguage: "en-IN",
      speakingLanguage: "en-IN",
      acceptedConsent: true,
      consentVersion: "2026-11-21-v1",
    },
  });
  expect(join.status()).toBe(409);
  await second.getByRole("button", { name: "Withdraw consent" }).click();
  await expect(
    page.getByText("Recording requires two consenting participants."),
  ).toBeVisible();
  await stranger.close();
  await guest.close();
});

test("a recorded browser turn survives STT failure, retry and reload with private replay", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  if (await page.getByLabel("Room type").count()) await page.getByLabel("Room type").selectOption("call");
  await page.getByLabel("Your name").fill("Voice owner");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Agree & create room" }).click();
  const invite = await page.getByLabel("Invitation link").inputValue();
  const guest = await browser.newContext();
  const second = await guest.newPage();
  await second.goto(invite);
  await second.getByLabel("Your name").fill("Listener");
  await second.getByLabel("Listen in").selectOption("te-IN");
  await second.getByRole("checkbox").check();
  await second.getByRole("button", { name: "Agree & join" }).click();
  await page.getByText("Audio options", { exact: true }).click();
  await page.getByRole("button", { name: "Record a turn" }).click();
  await expect(
    page.getByRole("button", { name: /Stop recording · 1s/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Stop recording/ }).click();
  const preview = page.locator(".recorder audio").first();
  await expect(preview).toHaveAttribute("src", /^blob:/);
  await page.getByRole("button", { name: "Submit turn" }).click();
  await expect(
    second.getByText(
      "Speech provider is not configured. The original is saved.",
    ),
  ).toBeVisible({ timeout: 20000 });
  await second
    .locator("article")
    .getByText("Original", { exact: true })
    .click();
  const audio = second.getByLabel("Original recording");
  const url = await audio.getAttribute("src");
  const original = await guest.request.get(new URL(url!, second.url()).href);
  expect(original.status()).toBe(200);
  expect(original.headers()["content-type"]).toBe("audio/webm");
  const bytes = await original.body();
  expect(bytes.length).toBeGreaterThan(1000);
  const stranger = await browser.newContext();
  expect(
    (await stranger.request.get(new URL(url!, second.url()).href)).status(),
  ).toBe(401);
  await second.getByRole("button", { name: "Retry transcribing" }).click();
  await expect(
    second.getByRole("button", { name: "Retry transcribing" }),
  ).toHaveCount(0);
  await second.reload();
  await expect(second.locator("article")).toHaveCount(1);
  const played = await second
    .locator("article audio")
    .evaluate(async (element: HTMLAudioElement) => {
      await element.play();
      return new Promise<boolean>((resolve) => {
        element.addEventListener("ended", () => resolve(true), { once: true });
        setTimeout(() => resolve(element.currentTime > 0), 4000);
      });
    });
  expect(played).toBe(true);
  expect(
    await (await guest.request.get(new URL(url!, second.url()).href)).body(),
  ).toEqual(bytes);
  await stranger.close();
  await guest.close();
});
