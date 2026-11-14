import { test, expect } from "@playwright/test";

test("release snackbar stays at the bottom, dismisses, and announces each newer release", async ({ page }) => {
  let release = { id: "2098-01-01T00:00:00.000Z", message: "First improvements" };
  await page.route("**/api/auth/me", route => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
  await page.route("**/app-release.json", route => route.fulfill({ json: release }));
  await page.goto("/");
  const snackbar = page.getByRole("complementary", { name: "LinguaLoop update" });
  await expect(snackbar).toContainText("First improvements");
  await expect(snackbar).toHaveCSS("position", "fixed");
  const box = (await snackbar.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  expect(box.y + box.height).toBeGreaterThan(810);
  expect(box.x).toBeGreaterThanOrEqual(16);
  expect(box.x + box.width).toBeLessThanOrEqual(374);
  await expect(snackbar.getByRole("status")).toHaveAttribute("aria-live", "polite");
  await expect(snackbar.getByRole("button", { name: "Update now" })).toBeVisible();
  await snackbar.getByRole("button", { name: "Dismiss update notification" }).click();
  await expect(snackbar).toHaveCount(0);
  release = { id: "2099-01-01T00:00:00.000Z", message: "Next improvements" };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(snackbar).toContainText("Next improvements");
  await expect(snackbar.getByRole("button", { name: "Update now" })).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(snackbar).toBeVisible();
  await Promise.all([
    page.waitForEvent("load"),
    snackbar.getByRole("button", { name: "Update now" }).click(),
  ]);
});
