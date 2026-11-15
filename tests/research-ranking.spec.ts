import { expect, test, type Page } from "@playwright/test";

function monitor(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const REVIEWER = "Which NASA investigations are most relevant to lunar-habitat fire detection?";

test("an environment ranks the index, with reasons and a separate evidence tag", async ({ page }) => {
  const errors = monitor(page);
  await page.goto("/research");
  await expect(page.getByTestId("research-index-count")).toContainText("Index order");
  await page.getByRole("button", { name: /Lunar surface habitats/ }).click();
  await expect(page.getByTestId("research-index-count")).toContainText("Ranked 19 of 19");
  const first = page.getByRole("article").first();
  await expect(first).toContainText("Wire fires in partial gravity");
  await expect(first).toContainText("Why it ranks here");
  await expect(first).toContainText("+30");
  await expect(first).toContainText("Flight results, published summary");
  await expect(page).toHaveURL(/environment=lunar-base/);
  expect(errors).toEqual([]);
});

test("the reviewer's question ranks detection records first and states the gap", async ({ page }) => {
  await page.goto("/research");
  await page.getByRole("searchbox").fill(REVIEWER);
  await expect(page.getByRole("article").first()).toContainText("Addresses fire detection.");
  await expect(page.getByText("No indexed test addresses fire detection at lunar gravity (0.165 g).")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Less related/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Ranking on" })).toContainText("Fire detection");
});

test("on a phone the question box and results sit near the top", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/research");
  await expect(page.getByRole("searchbox")).toBeEditable();
  const question = (await page.getByRole("searchbox").boundingBox())!;
  expect(question.y).toBeLessThan(700);
  const firstRecord = (await page.getByRole("article").first().boundingBox())!;
  expect(firstRecord.y).toBeLessThan(1400);
  expect(await noSidewaysScroll(page)).toBe(true);
});

test("records can be compared side by side, from the index or a shared link", async ({ page }) => {
  const errors = monitor(page);
  await page.goto("/research");
  await page.getByRole("button", { name: "Add Saffire VI to comparison", exact: true }).click();
  await page.getByRole("button", { name: "Add Saffire I–III to comparison", exact: true }).click();
  const tray = page.getByRole("complementary", { name: "Comparison" });
  await expect(tray).toContainText("2 of 3 picked");
  await tray.getByRole("link", { name: "Compare", exact: true }).click();
  await expect(page).toHaveURL(/\/research\/compare\?ids=saffire-vi,saffire-i-iii$/);
  await expect(page.getByRole("table", { name: "Investigations side by side" })).toContainText("Cast acrylic (PMMA) slabs");
  await expect(page.getByText(/^Directly comparable on microgravity/).first()).toBeVisible();
  await expect(page.getByText("Tabulated runs that line up")).toBeVisible();

  await page.goto("/research/compare?ids=saffire-vi,wstf-flammability-limits");
  await expect(page.getByText("Not comparable: different gravity.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("evidence gaps use run-level statuses instead of a range check", async ({ page }) => {
  await page.goto("/research/gaps");
  const cabin = page.getByRole("table", { name: "Cabin conditions compared with tested conditions" });
  await page.getByRole("radio", { name: "Gateway, about 0 g", exact: true }).click();
  await expect(cabin.getByRole("row").filter({ hasText: "FLEX" })).toContainText("Insufficient information");
  await expect(cabin.getByRole("row").filter({ hasText: "Saffire VI" })).toContainText("Outside tested conditions");
  await expect(page.getByText("Includes this cabin")).toHaveCount(0);
  await page.getByLabel("Material burning in the cabin").selectOption("kapton");
  await expect(cabin.getByRole("row").filter({ hasText: "Saffire VI" })).toContainText("Different material");
});

test("results puts an exportable evidence brief first once investigations are picked", async ({ page }) => {
  await page.goto("/research/compare?ids=saffire-vi,bass-ii");
  await expect(page.getByRole("table", { name: "Investigations side by side" })).toBeVisible();
  await page.getByRole("link", { name: "Open evidence brief", exact: true }).click();
  await expect(page).toHaveURL(/\/results$/);
  const brief = page.getByRole("region", { name: "Evidence brief", exact: true });
  await expect(brief).toContainText("Supported conclusions");
  await expect(brief).toContainText("Unresolved uncertainties");
  const markdown = page.waitForEvent("download");
  await brief.getByRole("button", { name: "Markdown", exact: true }).click();
  expect((await markdown).suggestedFilename()).toMatch(/^ignis-evidence-brief-\d{4}-\d{2}-\d{2}\.md$/);
  const json = page.waitForEvent("download");
  await brief.getByRole("button", { name: "JSON", exact: true }).click();
  expect((await json).suggestedFilename()).toMatch(/^ignis-evidence-brief-\d{4}-\d{2}-\d{2}\.json$/);
});
