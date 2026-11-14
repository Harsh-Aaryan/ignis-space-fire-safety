import { expect, test, type Page } from "@playwright/test";

const habitats = [
  { id: "moon", name: "Moon, 0.165 g", room: "lunar-habitat-lab", object: "lunar-habitat-lab-bench-0", gravity: "0.165", agent: "Fine water mist extinguisher" },
  { id: "mars", name: "Mars, 0.38 g", room: "mars-habitat-lab", object: "mars-habitat-lab-bench-0", gravity: "0.38", agent: "CO₂ extinguisher" },
  { id: "gateway", name: "Gateway-inspired lunar orbit habitat, about 0 g, conceptual digital twin", room: "gateway-orbit-halo", object: "gateway-orbit-halo-bench-1", gravity: "~0", agent: "Halon 1301 (chemical agent)" },
];

function monitor(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === new URL(page.url()).origin) errors.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

async function projected(page: Page, id: string) {
  return page.evaluate((key) => (window as Window & { __IGNIS_SCREEN?: Record<string, { x: number; y: number }> }).__IGNIS_SCREEN?.[key], id);
}

for (const habitat of habitats) {
  test(`${habitat.id}: ignition, telemetry, pause, suppression and reset preserve 3D navigation`, async ({ page }, info) => {
    const errors = monitor(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/firetwin", { waitUntil: "domcontentloaded" });
    await page.getByRole("radio", { name: habitat.name, exact: true }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByLabel("Select room", { exact: true }).selectOption(habitat.room);
    await page.getByRole("tab", { name: "Fire scenario", exact: true }).click();
    await page.getByLabel("Fire origin", { exact: true }).selectOption(habitat.object);
    await expect.poll(() => projected(page, habitat.object), { timeout: 60000 }).toBeTruthy();
    await page.getByRole("button", { name: /3.*Respond/ }).click();
    await page.getByLabel("Ventilation speed", { exact: true }).fill("0.2");
    await page.getByRole("button", { name: /1.*Set up/ }).click();
    await page.getByRole("button", { name: "60×", exact: true }).click();
    await page.getByRole("button", { name: "Start scenario", exact: true }).click();
    await expect(page.getByTestId("fire-status")).toContainText("flaming", { timeout: 60000 });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByTestId("fire-hud")).toContainText("paused");
    const paused = await page.getByTestId("fire-status").textContent();
    await page.waitForTimeout(500);
    expect(await page.getByTestId("fire-status").textContent()).toBe(paused);
    await expect(page.getByTestId("fire-hud")).toContainText(`${habitat.gravity}`);
    await expect(page.getByTestId("fire-hud")).toContainText("CFM");
    await page.screenshot({ path: info.outputPath(`${habitat.id}-burning.png`) });
    const point = await projected(page, habitat.object);
    expect(point).toBeTruthy();
    expect(Math.abs(point!.x)).toBeLessThan(1);
    expect(Math.abs(point!.y)).toBeLessThan(1);

    await page.getByRole("button", { name: /3.*Respond/ }).click();
    await page.getByRole("button", { name: "Remove power", exact: true }).click();
    await page.getByRole("button", { name: habitat.agent, exact: true }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByTestId("fire-status")).toContainText("extinguished", { timeout: 60000 });
    await page.getByRole("button", { name: "Fit selected", exact: true }).click();
    await expect.poll(async () => {
      const position = await projected(page, habitat.object);
      return position && Math.abs(position.x) < 1 && Math.abs(position.y) < 1;
    }).toBe(true);
    await page.screenshot({ path: info.outputPath(`${habitat.id}-suppressed.png`) });
    await page.getByLabel("Fire scenario", { exact: true }).getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByTestId("fire-status")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start scenario", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Return to exterior", exact: true }).click();
    await expect(page.getByRole("button", { name: "Orbit view", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });
}

test("NASA material selection reaches the same forecast and FireTwin setup", async ({ page }, info) => {
  const errors = monitor(page);
  await page.goto("/materials", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Research material", { exact: true }).selectOption("sibal");
  await expect(page.getByRole("table", { name: "Extracted Saffire measurements" })).toContainText("VI-3");
  await expect(page.getByRole("table", { name: "White Sands test results" })).toContainText("Kapton");
  await page.getByRole("link", { name: "Compare this material", exact: true }).click();
  await expect(page.getByLabel("Prediction material", { exact: true })).toHaveValue("sibal");
  await page.getByLabel("Forecast origin", { exact: true }).selectOption("lunar-habitat-lab-bench-0");
  await expect(page.getByLabel("Prediction material", { exact: true })).toHaveValue("sibal");
  await page.getByLabel("Prediction ignition source", { exact: true }).selectOption("hot-wire");
  await expect(page.getByRole("table", { name: "Gravity regime comparison" })).toContainText("Mars / 0.38 g");
  await page.screenshot({ path: info.outputPath("shared-forecast.png") });
  await page.getByRole("link", { name: "Open in 3D simulation", exact: true }).click();
  await expect(page).toHaveURL(/firetwin$/);
  await expect(page.getByRole("tab", { name: "Fire scenario", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Material", { exact: true })).toHaveValue("sibal");
  await expect(page.getByLabel("Ignition source", { exact: true })).toHaveValue("hot-wire");
  await expect(page.getByLabel("Fire origin", { exact: true })).toHaveValue("lunar-habitat-lab-bench-0");
  await page.getByRole("button", { name: "Materials and citations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Materials and citations", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("narrow-screen fire controls and telemetry work without WebGL", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.goto("/firetwin", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/WebGL is unavailable/)).toBeVisible();
  await page.getByRole("tab", { name: "Fire scenario", exact: true }).click();
  await page.getByLabel("Fire origin", { exact: true }).selectOption("lunar-habitat-lab-bench-0");
  await page.getByRole("button", { name: "60×", exact: true }).click();
  await page.getByRole("button", { name: "Start scenario", exact: true }).click();
  await expect(page.getByTestId("fire-status")).toContainText("flaming");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByTestId("fire-hud")).toContainText("paused");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("mobile-no-webgl.png"), fullPage: true });
});

test("research subviews stay grouped and every data route responds", async ({ page, request }) => {
  for (const route of ["/research", "/materials", "/predict", "/gravity-bridge", "/firelab", "/firetwin", "/reports"]) {
    expect((await request.get(route)).status(), route).toBe(200);
  }
  await page.goto("/materials", { waitUntil: "domcontentloaded" });
  const navigation = page.getByRole("navigation", { name: "Modules", exact: true }).first();
  await expect(navigation.getByRole("link")).toHaveCount(4);
  await expect(navigation.getByRole("link", { name: "NASA research", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("navigation", { name: "Research views", exact: true }).getByRole("link", { name: "Gravity coverage", exact: true }).click();
  await expect(page).toHaveURL(/gravity-bridge$/);
  await expect(navigation.getByRole("link", { name: "NASA research", exact: true })).toHaveAttribute("aria-current", "page");
});

test("original NASA experiment tables load, filter and download on a narrow screen", async ({ page, request }, info) => {
  const errors = monitor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/materials", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("table", { name: "Downloaded NASA PSI data", exact: true })).toContainText("Calibrated");
  await page.getByLabel("Search NASA data", { exact: true }).fill("PMMA");
  await expect(page.getByTestId("nasa-table-count")).not.toContainText(/^0 matching/);
  await page.getByLabel("NASA PSI dataset", { exact: true }).selectOption("PSI-98");
  const table = page.getByRole("table", { name: "Downloaded NASA PSI data", exact: true });
  await expect(table).toContainText("21.5 - 21.7");
  await expect(table).toContainText("SIBAL Fabric");
  await expect(page.getByRole("region", { name: "Observed Saffire-I telemetry", exact: true })).toBeVisible();
  await page.getByLabel("Observed NASA sensor", { exact: true }).selectOption("obscuration");
  await expect(page.getByTestId("observed-nasa-value")).toContainText("-0.005 V");
  const download = page.getByRole("link", { name: "Download original CSV", exact: true });
  const response = await request.get((await download.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("21.5 - 21.7");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("region", { name: "Observed Saffire-I telemetry", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("nasa-dataset-mobile.png") });
  expect(errors).toEqual([]);
});
