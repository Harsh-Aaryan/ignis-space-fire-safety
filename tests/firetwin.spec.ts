import { expect, test, type Page } from "@playwright/test";

const habitatNames = {
  moon: "Moon, 0.165 g",
  mars: "Mars, 0.38 g",
  gateway:
    "Gateway-inspired lunar orbit habitat, about 0 g, conceptual digital twin",
};
async function ready(page: Page) {
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(750);
  await page.waitForFunction(
    () =>
      Object.keys(
        (window as Window & { __IGNIS_SCREEN?: object }).__IGNIS_SCREEN ?? {},
      ).length > 0,
  );
  await page.waitForTimeout(2000);
}
async function clickEquipment(page: Page, id: string, label: string) {
  await page.waitForFunction(
    (id) =>
      Boolean(
        (window as Window & { __IGNIS_SCREEN?: Record<string, unknown> })
          .__IGNIS_SCREEN?.[id],
      ),
    id,
  );
  await page.waitForTimeout(2500);
  const bounds = (await page.locator("canvas").boundingBox())!;
  const point = await page.evaluate(
    (id) =>
      (
        window as Window & {
          __IGNIS_SCREEN?: Record<string, { x: number; y: number }>;
        }
      ).__IGNIS_SCREEN?.[id],
    id,
  );
  if (!point) throw new Error("Equipment missing from the scene: " + id);
  await page.mouse.click(
    bounds.x + ((point.x + 1) * bounds.width) / 2,
    bounds.y + ((1 - point.y) * bounds.height) / 2,
  );
  await expect(
    page.getByRole("heading", { name: label, exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-object-id="' + id + '"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
}

test("select lunar equipment in 3D and carry its research context across modules", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/firetwin", {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await ready(page);
  await screenshot(page, "moon-exterior");
  await page.getByRole("button", { name: "Cutaway view", exact: true }).click();
  await page.waitForFunction(() =>
    Boolean(
      (window as Window & { __IGNIS_SCREEN?: Record<string, unknown> })
        .__IGNIS_SCREEN?.["lunar-habitat-lab-samples-1"],
    ),
  );
  await page.waitForTimeout(2500);
  await screenshot(page, "moon-detailed-cutaway");
  await page
    .getByLabel("Select room", { exact: true })
    .selectOption("lunar-habitat-lab");
  await page.waitForTimeout(2500);
  const sampleId = "lunar-habitat-lab-samples-1";
  await page.waitForFunction(
    (id) =>
      Boolean(
        (window as Window & { __IGNIS_SCREEN?: Record<string, unknown> })
          .__IGNIS_SCREEN?.[id],
      ),
    sampleId,
  );
  const canvas = page.locator("canvas");
  const bounds = (await canvas.boundingBox())!;
  const point = await page.evaluate(
    (id) =>
      (
        window as Window & {
          __IGNIS_SCREEN?: Record<string, { x: number; y: number }>;
        }
      ).__IGNIS_SCREEN?.[id],
    sampleId,
  );
  expect(point).toBeTruthy();
  if (!point)
    throw new Error("Selected equipment is missing from the rendered scene");
  await page.mouse.click(
    bounds.x + ((point.x + 1) * bounds.width) / 2,
    bounds.y + ((1 - point.y) * bounds.height) / 2,
  );
  await expect(
    page.getByRole("heading", { name: "Material sample rack", exact: true }),
  ).toBeVisible();
  await expect(page.locator(`[data-object-id="${sampleId}"]`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForTimeout(2200);
  await screenshot(page, "equipment-research-inspector");
  await page
    .getByRole("spinbutton", { name: "Inspector Oxygen (%)", exact: true })
    .fill("35");
  await page
    .getByRole("spinbutton", {
      name: "Inspector Cabin pressure (psi)",
      exact: true,
    })
    .fill("12");
  await expect(page.getByTestId("oxygen-partial-pressure")).toHaveText(
    "4.200 psi",
  );
  const verifiedLink = page
    .getByRole("link", { name: "NASA source ↗" })
    .first();
  await expect(verifiedLink).toHaveAttribute("href", /^https:\/\//);
  await page
    .getByRole("link", { name: "Compare investigations", exact: true })
    .click();
  await expect(page).toHaveURL(/\/research$/);
  await expect(
    page.getByText(/FireTwin context · Laboratory \/ Material sample rack/),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Return to selected equipment", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open GravityBridge", exact: true })
    .click();
  await expect(page).toHaveURL(/gravity-bridge/);
  await expect(page.getByText(/FireTwin context · Laboratory/)).toBeVisible();
  await page
    .getByRole("link", { name: "Return to selected equipment", exact: true })
    .click();
  await page
    .getByRole("link", { name: "FireLab recommendation", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Ask the demo assistant" }),
  ).toHaveValue(/Material sample rack.*oxygen 35%.*pressure 12 psi/);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Briefing clerk", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Return to selected equipment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Return to exterior", exact: true })
    .click();
  await page.waitForTimeout(5000);
  await screenshot(page, "moon-exterior");
  expect(errors).toEqual([]);
});

test("Mars floors and exploded levels remain navigable", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/firetwin", { waitUntil: "domcontentloaded" });
  await ready(page);
  await page
    .getByRole("radio", { name: habitatNames.mars, exact: true })
    .click();
  await ready(page);
  await expect(page.getByText("0.38 g", { exact: true }).first()).toBeVisible();
  await screenshot(page, "mars-exterior");
  await page.getByRole("button", { name: "Cutaway view", exact: true }).click();
  await page.waitForTimeout(2500);
  await screenshot(page, "mars-multilevel-cutaway");
  for (const level of ["1", "2", "3", "4"]) {
    await page.getByLabel("Select floor", { exact: true }).selectOption(level);
    await expect(page.getByLabel("Interior breadcrumb")).toContainText(
      `Level ${level}`,
    );
  }
  await page.getByLabel("Select floor", { exact: true }).selectOption("2");
  await clickEquipment(
    page,
    "mars-habitat-lab-samples-3",
    "Material sample rack",
  );
  await screenshot(page, "mars-equipment-inspector");
  await page
    .getByRole("button", { name: "Explode levels", exact: true })
    .click();
  await page.waitForTimeout(2500);
  await screenshot(page, "mars-exploded-levels");
  await page
    .getByRole("button", { name: "Return to exterior", exact: true })
    .click();
  await page.waitForTimeout(5000);
  await screenshot(page, "mars-exterior");
  expect(errors).toEqual([]);
});

test("Gateway keeps its exterior and reveals all three pressurized modules", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/firetwin", { waitUntil: "domcontentloaded" });
  await ready(page);
  await page
    .getByRole("radio", { name: habitatNames.gateway, exact: true })
    .click();
  await ready(page);
  await screenshot(page, "gateway-exterior");
  for (const id of [
    "gateway-orbit-halo",
    "gateway-orbit-ihab",
    "gateway-orbit-passage",
  ]) {
    await page.getByLabel("Select room", { exact: true }).selectOption(id);
    await page.waitForFunction(
      (room) =>
        Boolean(
          (window as Window & { __IGNIS_SCREEN?: Record<string, unknown> })
            .__IGNIS_SCREEN?.[room],
        ),
      id,
    );
    await page.waitForTimeout(2500);
    await expect(page.getByLabel("Select room", { exact: true })).toHaveValue(
      id,
    );
    await expect(page.getByLabel("Research inspector")).toContainText("~0 g");
    await screenshot(
      page,
      id === "gateway-orbit-halo" ? "gateway-interior" : id,
    );
    if (id === "gateway-orbit-ihab") {
      await clickEquipment(
        page,
        "gateway-orbit-ihab-samples-2",
        "Material sample rack",
      );
      await screenshot(page, "gateway-equipment-inspector");
    }
  }
  await page
    .getByRole("button", { name: "Return to exterior", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Orbit view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(5000);
  await screenshot(page, "gateway-exterior");
  expect(errors).toEqual([]);
});

test("accessible controls remain usable without WebGL on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.goto("/firetwin", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/WebGL is unavailable/)).toBeVisible();
  await page
    .getByLabel("Select room", { exact: true })
    .selectOption("lunar-habitat-lab");
  await page.locator('[data-object-id="lunar-habitat-lab-samples-1"]').click();
  await expect(
    page.getByRole("heading", { name: "Material sample rack", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("existing application routes and a verified research dossier respond", async ({
  request,
}) => {
  for (const route of [
    "/",
    "/firetwin",
    "/research",
    "/gravity-bridge",
    "/firelab",
    "/predict",
    "/reports",
    "/research/20170000230",
  ]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
  }
});
