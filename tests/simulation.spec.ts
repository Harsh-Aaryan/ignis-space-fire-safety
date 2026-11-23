import { expect, test, type Page } from "@playwright/test";

/** Picks a habitat with the Moon / Mars / Gateway switcher in the top bar. */
async function chooseHabitat(page: Page, name: string) {
  await page.getByRole("radio", { name, exact: true }).click();
}

function monitor(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /Shader Error|VALIDATE_STATUS|shader.*compil/i.test(message.text())) errors.push(message.text());
  });
  return errors;
}

const HABITATS = [
  { name: "Moon, 0.165 g", gravity: "0.165" },
  { name: "Mars, 0.38 g", gravity: "0.38" },
  { name: "Gateway, about 0 g", gravity: "0" },
];

for (const habitat of HABITATS) {
  test(`a fire ignites, pauses, is put out and resets: ${habitat.name}`, async ({ page }) => {
    const errors = monitor(page);
    await page.goto("/simulation", { waitUntil: "domcontentloaded" });
    await expect(page.locator("canvas")).toBeVisible();
    await chooseHabitat(page, habitat.name);
    await page.getByRole("tab", { name: "Fire scenario", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Fire scenario", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Acrylic ignition", exact: true }).click();
    await expect(page.getByLabel("Material", { exact: true })).toHaveValue("pmma");
    await expect(page.getByRole("button", { name: "Start fire", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "60×", exact: true }).click();
    await page.getByRole("button", { name: "Start fire", exact: true }).click();
    await expect(page.getByTestId("fire-status")).toContainText("Flaming", { timeout: 60_000 });
    await expect(page.getByTestId("fire-hud")).toContainText("CFM");
    await expect(page.getByTestId("fire-hud")).toContainText(habitat.gravity);

    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByTestId("fire-hud")).toContainText("paused");
    const paused = await page.getByTestId("fire-status").textContent();
    await page.waitForTimeout(1500);
    expect(await page.getByTestId("fire-status").textContent()).toBe(paused);
    await page.getByRole("button", { name: "Resume", exact: true }).click();

    await page.getByRole("button", { name: "Respond to the fire", exact: true }).click();
    await page.getByRole("button", { name: "Fine water mist extinguisher", exact: true }).click();
    await expect(page.getByTestId("fire-status")).toContainText("Flame out", { timeout: 90_000 });

    await page.getByRole("button", { name: /4\s*Review/ }).click();
    await expect(page.getByRole("region", { name: "Fire run review" })).toContainText("Chemical heat released");
    await page.getByLabel("Fire scenario", { exact: true }).getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByTestId("fire-status")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

function withoutWebGL(page: Page) {
  return page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
}

test("a direct visit opens on the fire scenario and asks where the fire starts", async ({ page }) => {
  await withoutWebGL(page);
  await page.goto("/simulation", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tab", { name: "Fire scenario", exact: true })).toHaveAttribute("aria-selected", "true");
  const steps = page.getByRole("navigation", { name: "Scenario stages" });
  await expect(steps.getByRole("button", { name: /1\s*Set up/ })).toHaveAttribute("aria-current", "step");
  const start = page.getByRole("button", { name: "Start fire", exact: true });
  await expect(start).toBeDisabled();
  await expect(start).toHaveAccessibleDescription("Pick where the fire starts first");
});

test("once the flame is out, the run offers Review, which leads to Results", async ({ page }) => {
  test.setTimeout(300_000);
  await withoutWebGL(page);
  await page.goto("/simulation", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/WebGL is unavailable/)).toBeVisible();
  await page.getByRole("button", { name: "Acrylic ignition", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start fire", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "60×", exact: true }).click();
  await page.getByRole("button", { name: "Start fire", exact: true }).click();
  const steps = page.getByRole("navigation", { name: "Scenario stages" });
  await expect(steps.getByRole("button", { name: /2\s*Run/ })).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("fire-status")).toContainText("Flaming", { timeout: 60_000 });
  await page.getByRole("button", { name: "Respond to the fire", exact: true }).click();
  await page.getByRole("button", { name: "Fine water mist extinguisher", exact: true }).click();
  await expect(page.getByTestId("fire-status")).toContainText("Flame out", { timeout: 120_000 });
  await page.getByRole("button", { name: "Review this run", exact: true }).click();
  await expect(steps.getByRole("button", { name: /4\s*Review/ })).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("region", { name: "Fire run review" })).toBeVisible();
  const results = page.getByRole("link", { name: "Open in Results", exact: true });
  await expect(results).toBeVisible();
  await expect(results).toHaveAttribute("href", "/results");
});

test("view controls reach every mode, room and level", async ({ page }) => {
  const errors = monitor(page);
  await page.goto("/simulation", { waitUntil: "domcontentloaded" });
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Orbit", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("habitat-location")).toContainText("Moon habitat · Exterior");

  await page.getByRole("button", { name: "Cutaway", exact: true }).click();
  await expect(page.getByTestId("habitat-location")).toContainText("All levels");
  await page.getByLabel("Select room", { exact: true }).selectOption("lunar-habitat-lab");
  await expect(page.getByTestId("habitat-location")).toContainText("Laboratory");
  await page.getByLabel("Select floor", { exact: true }).selectOption("2");
  await expect(page.getByTestId("habitat-location")).toContainText("Level 2");

  await page.getByRole("button", { name: "View options" }).click();
  await page.getByRole("button", { name: "Explode levels", exact: true }).click();
  await expect(page.getByRole("button", { name: "Explode levels", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Return to exterior", exact: true }).click();
  await expect(page.getByTestId("habitat-location")).toContainText("Exterior");
  expect(errors).toEqual([]);
});

test("equipment links to real research and starts a fire where it stands", async ({ page }) => {
  await page.goto("/simulation", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Equipment", exact: true }).click();
  const panel = page.getByLabel("Equipment", { exact: true });
  await panel.getByRole("button", { name: /Laboratory/ }).click();
  await panel.getByRole("button", { name: "Material sample rack" }).first().click();
  await expect(panel.getByRole("heading", { name: "Material sample rack", exact: true })).toBeVisible();
  await expect(panel.getByRole("link", { name: /BASS-II Flight experiment/ })).toHaveAttribute("href", "/research/bass-ii");
  await panel.getByRole("button", { name: "Start a fire here", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Fire scenario", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Fire origin", { exact: true })).not.toHaveValue("");
});

test("setup controls wait for hydration before accepting an origin", async ({ page }) => {
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/simulation/compare", { waitUntil: "domcontentloaded" });
    const origin = page.getByLabel("Forecast origin", { exact: true });
    await expect(origin).toBeDisabled();
    await expect(page.getByRole("button", { name: "Acrylic ignition", exact: true })).toBeDisabled();
    releaseScripts();
    await expect(origin).toBeEnabled();
    await origin.selectOption("lunar-habitat-lab-bench-0");
    await expect(origin).toHaveValue("lunar-habitat-lab-bench-0");
    await expect(page.getByRole("table", { name: "Gravity regime comparison" })).toContainText("Orbit, ~0 g");
  } finally {
    releaseScripts();
  }
});

test("gravity comparison runs one setup at three gravity levels", async ({ page }) => {
  await page.goto("/simulation/compare");
  await page.getByLabel("Forecast origin", { exact: true }).selectOption("lunar-habitat-lab-bench-0");
  await expect(page.getByLabel("Forecast origin", { exact: true })).toHaveValue("lunar-habitat-lab-bench-0");
  const table = page.getByRole("table", { name: "Gravity regime comparison" });
  await expect(table).toContainText("Orbit, ~0 g");
  await expect(table).toContainText("Mars, 0.38 g");
  await expect(table).toContainText("Extrapolated");
  await page.getByLabel("Prediction ignition source", { exact: true }).selectOption("hot-wire");
  await page.getByRole("link", { name: "Open in 3D simulation", exact: true }).click();
  await expect(page).toHaveURL(/\/simulation$/);
  await expect(page.getByLabel("Fire origin", { exact: true })).toHaveValue("lunar-habitat-lab-bench-0");
});

test("telemetry fits all readouts and centers its graph without horizontal scrolling", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.goto("/simulation", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/WebGL is unavailable/)).toBeVisible();
  await page.getByRole("tab", { name: "Fire scenario", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Fire scenario", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Acrylic ignition", exact: true }).click();
  await page.getByRole("button", { name: "60×", exact: true }).click();
  await page.getByRole("button", { name: "Start fire", exact: true }).click();
  await expect(page.getByTestId("fire-status")).toContainText("Flaming");
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  const hud = page.getByTestId("fire-hud");
  for (const width of [1024, 1280, 1600, 1920, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await hud.scrollIntoViewIfNeeded();
    await expect(hud.locator("dt")).toHaveCount(8);
    expect(await hud.evaluate(el => el.scrollWidth <= el.clientWidth), `Telemetry fits at ${width}px`).toBe(true);
    expect(await hud.locator("dt, dd, p, figcaption").evaluateAll(elements => elements.every(el => {
      const box = el.getBoundingClientRect();
      const parent = el.closest("section")!.getBoundingClientRect();
      return box.left >= parent.left - 1 && box.right <= parent.right + 1 && el.scrollWidth <= el.clientWidth + 1;
    })), `Every readout fits at ${width}px`).toBe(true);
    const bar = (await hud.boundingBox())!;
    const graph = (await page.getByTestId("telemetry-graph").boundingBox())!;
    expect(Math.abs(graph.x + graph.width / 2 - (bar.x + bar.width / 2)), `Graph centered at ${width}px`).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width >= 1024) {
      const main = (await page.locator("main").boundingBox())!;
      expect(Math.abs(bar.x - main.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(bar.width - main.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(bar.y + bar.height - (main.y + main.height))).toBeLessThanOrEqual(1);
      expect(bar.height).toBeLessThanOrEqual(180);
      const scene = (await page.getByTestId("habitat-viewport").boundingBox())!;
      expect(scene.height).toBeGreaterThan(300);
    }
  }
});

test("the simulation works on a narrow screen without WebGL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.goto("/simulation", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/WebGL is unavailable/)).toBeVisible();
  await page.getByRole("tab", { name: "Fire scenario", exact: true }).click();
  await page.getByLabel("Fire origin", { exact: true }).selectOption("lunar-habitat-lab-bench-0");
  await page.getByRole("button", { name: "60×", exact: true }).click();
  await page.getByRole("button", { name: "Start fire", exact: true }).click();
  await expect(page.getByTestId("fire-status")).toContainText("Flaming");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByTestId("fire-hud")).toContainText("paused");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
