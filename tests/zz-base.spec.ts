import { test, expect } from "@playwright/test";
const OUT = process.env.SHOT_DIR!;
test.skip(!OUT, "Optional baseline capture: set SHOT_DIR to save Gateway screenshots.");
test("baseline gateway equipment focus", async ({ page }) => {
  await page.goto("/firetwin", { waitUntil: "domcontentloaded" });
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(3000);
  await page.getByRole("radio", { name: "Gateway-inspired lunar orbit habitat, about 0 g, conceptual digital twin", exact: true }).click();
  await page.waitForTimeout(5000);
  await page.getByLabel("Select room", { exact: true }).selectOption("gateway-orbit-halo");
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/base-gateway-room.png` });
  await page.locator('[data-object-id="gateway-orbit-halo-bench-1"]').click();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${OUT}/base-gateway-object.png` });
});
