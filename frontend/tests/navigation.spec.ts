import { test, expect, type Page } from "@playwright/test";

function lesson(id: string, language = "en") {
  return {
    id,
    language,
    title: id,
    date: "2026-11-12",
    expression: id,
    meaning: `Meaning ${id}`,
    reading: null,
    explanation: "Explanation",
    dialogue: "Dialogue",
    translation: "Translation",
    words: "Words",
    sourceUrl: null,
    imageUrl: null,
    partial: false,
    vocabulary: [],
    notes: [],
    expressions: ["one", "two"].map((word) => ({
      text: `${id} ${word}`,
      reading: null,
      meaning: `Meaning ${word}`,
      explanation: null,
      examples: [],
    })),
  };
}
async function fixture(page: Page) {
  const control = { failed: false, release: () => {} };
  await page.route("**/back-sentinel", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Outside the app</h1>",
    }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { id: "fixture", name: "Learner" } }),
  );
  await page.route("**/api/lessons**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/lessons")
      return route.fulfill({
        json: {
          items: ["first", "second", "slow"].map((id) =>
            lesson(id, url.searchParams.get("language") || "en"),
          ),
          nextOffset: null,
        },
      });
    const id = url.pathname.split("/").pop()!;
    if (id === "slow")
      await new Promise<void>((resolve) => {
        control.release = resolve;
      });
    try {
      await route.fulfill(
        control.failed
          ? { status: 503, json: { error: "lessons_unavailable" } }
          : { json: lesson(id, url.pathname.split("/")[3]) },
      );
    } catch {
      /* The browser can abort an in-flight request on Back. */
    }
  });
  return control;
}
const dashboard = (page: Page) =>
  expect(page.locator(".lesson-card").first()).toBeVisible();
const detail = (page: Page) =>
  expect(page.locator(".reader-content")).toBeVisible();
const practice = (page: Page) =>
  expect(
    page.getByRole("region", { name: "Recall practice", exact: true }),
  ).toBeVisible();

// All data and authentication are fixture responses; tests never contact providers.
test("Back and Forward restore nested lessons, practice position and dashboard", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/");
  await dashboard(page);
  await page.locator(".lesson-card").first().click();
  await detail(page);
  await page
    .getByRole("button", { name: "Practice this lesson →", exact: true })
    .click();
  await practice(page);
  await page
    .getByRole("button", { name: "Next expression →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reveal meaning", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open full lesson ↗", exact: true })
    .click();
  await detail(page);
  await expect(
    page.getByRole("button", { name: "← Back to practice", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await practice(page);
  await expect(page.locator(".practice h1")).toHaveText("first two");
  await expect(
    page.getByRole("button", { name: "Hide meaning", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await detail(page);
  await page.goBack();
  await dashboard(page);
  await page.goForward();
  await detail(page);
  await page.goForward();
  await practice(page);
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await detail(page);
  await page
    .getByRole("button", { name: "← Back to library", exact: true })
    .click();
  await dashboard(page);
});

test("reload and practice rehydration preserve Back steps without storing lesson text", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/");
  await dashboard(page);
  await page.locator(".lesson-card").first().click();
  await detail(page);
  const length = await page.evaluate(() => history.length);
  await page.reload();
  await detail(page);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page
    .getByRole("button", { name: "Practice this lesson →", exact: true })
    .click();
  await practice(page);
  await page.reload();
  await practice(page);
  const saved = await page.evaluate(() => JSON.stringify(history.state));
  expect(saved).not.toContain("Meaning");
  expect(saved).not.toContain("Dialogue");
  await page.goBack();
  await detail(page);
  await page.goBack();
  await dashboard(page);
});

test("Back cancels loading and retries do not create extra entries", async ({
  page,
}) => {
  const control = await fixture(page);
  await page.goto("/");
  await dashboard(page);
  control.failed = true;
  await page.locator(".lesson-card").nth(1).click();
  await expect(page.getByRole("alert")).toBeVisible();
  const length = await page.evaluate(() => history.length);
  control.failed = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await detail(page);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.goBack();
  await dashboard(page);
  await page.locator(".lesson-card").nth(2).click();
  await expect(
    page.getByRole("status", { name: "Loading lesson detail", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await dashboard(page);
  control.release();
  await expect(page.locator(".reader-content")).toHaveCount(0);
});

test("language changes and Home do not trap Back at the dashboard", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/back-sentinel");
  await page.goto("/");
  await dashboard(page);
  const length = await page.evaluate(() => history.length);
  for (const name of ["Japanese", "English"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await dashboard(page);
  }
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.evaluate(() => window.scrollTo(0, 400));
  const dashboardScroll = await page.evaluate(() => window.scrollY);
  await page.locator(".lesson-card").first().click();
  await detail(page);
  await page
    .getByRole("button", { name: "Practice this lesson →", exact: true })
    .click();
  await practice(page);
  await page
    .getByRole("link", { name: "LinguaLoop home", exact: true })
    .click();
  await dashboard(page);
  expect(await page.evaluate(() => history.state.lingualoop.depth)).toBe(0);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(dashboardScroll);
  await page.goBack();
  const confirmation = page.getByRole("dialog", { name: "Leave LinguaLoop?" });
  await expect(confirmation).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stay", exact: true }),
  ).toBeFocused();
  const guardedLength = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await dashboard(page);
  for (let i = 0; i < 2; i++) {
    await page.goBack();
    await expect(confirmation).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirmation).not.toBeVisible();
  }
  expect(await page.evaluate(() => history.length)).toBe(guardedLength);
  await page.goBack();
  await expect(confirmation).toBeVisible();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Outside the app" }),
  ).toBeVisible();
});

test("Back after signing out never restores authenticated lesson content", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.goto("/");
  await dashboard(page);
  await page.locator(".lesson-card").first().click();
  await detail(page);
  await page
    .getByRole("button", { name: "Practice this lesson →", exact: true })
    .click();
  await practice(page);
  await page.getByLabel("Open settings and account").click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Continue with KakaoTalk →", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await page.goBack();
  await page.goForward();
  await expect(
    page.locator(".reader-content, .practice, .lesson-card"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Continue with KakaoTalk →", exact: true }),
  ).toBeVisible();
});

test("fresh dashboard asks before leaving and disarms for native Back if closing is unavailable", async ({
  page,
}) => {
  await fixture(page);
  // Model an installed launch with no prior document; a test tab may otherwise
  // include about:blank as a real previous page.
  await page.addInitScript(() => {
    if (!history.state?.lingualoop)
      history.replaceState(
        {
          lingualoop: {
            version: 1,
            key: "installed-root",
            depth: 0,
            parent: null,
            view: { kind: "dashboard", language: "en" },
            scroll: 0,
            exitGuard: { id: "installed-exit", previous: false },
            exitBoundary: true,
          },
        },
        "",
      );
  });
  await page.goto("/");
  await dashboard(page);
  const length = await page.evaluate(() => history.length);
  await page.reload();
  await dashboard(page);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.goBack();
  const confirmation = page.getByRole("dialog", { name: "Leave LinguaLoop?" });
  await expect(confirmation).toBeVisible();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Press Back once more" }),
  ).toContainText("Press Back once more to leave");
  expect(await page.evaluate(() => history.state.lingualoop.exitBoundary)).toBe(
    true,
  );
  await page.locator(".lesson-card").first().click();
  await detail(page);
  await page.goBack();
  await dashboard(page);
  await page.goBack();
  await expect(confirmation).toBeVisible();
});
