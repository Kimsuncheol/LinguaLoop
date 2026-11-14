import { test, expect, type Page } from "@playwright/test";
async function fixture(
  page: Page,
  dialogue = "A Hello there.\nB Nice to see you.\nA Likewise.",
) {
  const lesson = {
    id: "formatted",
    language: "en",
    title: "Lesson",
    date: "2026-11-13",
    expression: "Nice to see you",
    meaning: "만나서 반가워요",
    reading: null,
    explanation:
      "첫 문장이다.두 번째 문장 Nice to see you이다.\n\n참고로 다른 표현도 있다.",
    dialogue,
    translation: "A 안녕하세요.\nB 만나서 반가워요.\nA 저도요.",
    words: null,
    vocabulary: [],
    notes: [],
    expressions: [],
    partial: false,
    sourceUrl: null,
    imageUrl: null,
  };
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { id: "fixture", name: "Learner" } }),
  );
  await page.route("**/api/lessons**", (route) =>
    route.fulfill({
      json:
        new URL(route.request().url()).pathname === "/api/lessons"
          ? { items: [lesson], nextOffset: null }
          : lesson,
    }),
  );
  await page.goto("/");
  await page.locator(".lesson-card").first().click();
  await expect(page.locator(".reader-content")).toBeVisible();
}
test("meaning paragraphs and the real vue-bubble-chat renderer show A left and B right", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page);
  await expect(
    page.locator("#lesson-section-Meaning .meaning-copy p"),
  ).toHaveCount(3);
  await expect(page.locator("#lesson-section-Meaning strong")).toHaveText(
    "Nice to see you",
  );
  const rows = page.locator(".dialogue-chat .scroll > div");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toHaveAttribute("data-speaker", "A");
  await expect(rows.nth(1)).toHaveAttribute("data-speaker", "B");
  await expect(rows.nth(2)).toHaveAttribute("data-speaker", "A");
  await page.getByRole("link", { name: "Dialogue", exact: true }).click();
  const aRow = (await rows.nth(0).boundingBox())!,
    bRow = (await rows.nth(1).boundingBox())!;
  const a = (await rows.nth(0).locator(":scope > div").boundingBox())!;
  const b = (await rows.nth(1).locator(":scope > div").boundingBox())!;
  const aBadge = rows.nth(0).locator(":scope > .character-badge"),
    bBadge = rows.nth(1).locator(":scope > .character-badge");
  await expect(aBadge).toHaveText("A");
  await expect(bBadge).toHaveText("B");
  await expect(aBadge).toHaveCSS("border-radius", "50%");
  await expect(bBadge).toHaveCSS("border-radius", "50%");
  const aCircle = (await aBadge.boundingBox())!,
    bCircle = (await bBadge.boundingBox())!;
  expect(aCircle.width).toBe(aCircle.height);
  expect(bCircle.width).toBe(bCircle.height);
  expect(aCircle.x).toBeCloseTo(aRow.x, 0);
  expect(aCircle.x + aCircle.width).toBeLessThan(a.x);
  expect(b.x + b.width).toBeLessThan(bCircle.x);
  expect(bCircle.x + bCircle.width).toBeCloseTo(bRow.x + bRow.width, 0);
  await expect(rows.locator(":scope > div .name")).toHaveCount(0);
  expect(b.x).toBeGreaterThan(a.x);
  await expect(rows.nth(0).locator(".bubble-translation")).toHaveText(
    "안녕하세요.",
  );
  await expect(page.locator(".dialogue-chat textarea")).not.toBeVisible();
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator(".bubble_chat_wrapper")).toHaveCSS(
      "position",
      "static",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("tab", { name: "Dialogue", exact: true }).click();
  await expect(rows.nth(1)).toBeVisible();
  await page.goBack();
  await expect(page.locator(".lesson-card").first()).toBeVisible();
  await expect(page.locator(".dialogue-chat .bubble_chat_wrapper")).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});
test("HTML-like message text is rendered literally and safely", async ({
  page,
}) => {
  await fixture(
    page,
    'A <img src=x onerror="window.injected=true">\nB Literal text.',
  );
  await expect(page.locator(".dialogue-chat .scroll > div")).toHaveCount(2);
  await expect(page.locator(".dialogue-chat .msg").first()).toContainText(
    "<img",
  );
  await expect(page.locator(".dialogue-chat img")).toHaveCount(0);
  expect(await page.evaluate(() => "injected" in window)).toBe(false);
});

test("dialogue without A/B labels remains available as original text", async ({
  page,
}) => {
  await fixture(page, "No character labels are supplied here.");
  await expect(page.locator(".dialogue-chat > .lesson-copy")).toHaveText(
    "No character labels are supplied here.",
  );
  await expect(page.locator(".bubble_chat_wrapper")).toHaveCount(0);
});
