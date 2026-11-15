import { expect, test, type Page } from "@playwright/test";

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
    await page.getByRole("radio", { name: habitat.name, exact: true }).click();
    await page.getByRole("tab", { name: "Fire scenario", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Fire scenario", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Acrylic ignition", exact: true }).click();
    await expect(page.getByLabel("Material", { exact: true })).toHaveValue("pmma");
    await expect(page.getByRole("button", { name: "Start scenario", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "60×", exact: true }).click();
    await page.getByRole("button", { name: "Start scenario", exact: true }).click();
    await expect(page.getByTestId("fire-status")).toContainText("Flaming", { timeout: 60_000 });
    await expect(page.getByTestId("fire-hud")).toContainText("CFM");
    await expect(page.getByTestId("fire-hud")).toContainText(habitat.gravity);

    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByTestId("fire-hud")).toContainText("paused");
    const paused = await page.getByTestId("fire-status").textContent();
    await page.waitForTimeout(1500);
    expect(await page.getByTestId("fire-status").textContent()).toBe(paused);
    await page.getByRole("button", { name: "Resume", exact: true }).click();

    await page.getByRole("button", { name: /3\s*Respond/ }).click();
    await page.getByRole("button", { name: "Fine water mist extinguisher", exact: true }).click();
    await expect(page.getByTestId("fire-status")).toContainText("Flame out", { timeout: 90_000 });

    await page.getByRole("button", { name: /4\s*Review/ }).click();
    await expect(page.getByRole("region", { name: "Fire run review" })).toContainText("Chemical heat released");
    await page.getByLabel("Fire scenario", { exact: true }).getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByTestId("fire-status")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

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
    await expect(page.getByRole("table", { name: "Gravity regime comparison" })).toContainText("Orbit, 0 g");
  } finally {
    releaseScripts();
  }
});

test("gravity comparison runs one setup at three gravity levels", async ({ page }) => {
  await page.goto("/simulation/compare");
  await page.getByLabel("Forecast origin", { exact: true }).selectOption("lunar-habitat-lab-bench-0");
  await expect(page.getByLabel("Forecast origin", { exact: true })).toHaveValue("lunar-habitat-lab-bench-0");
  const table = page.getByRole("table", { name: "Gravity regime comparison" });
  await expect(table).toContainText("Orbit, 0 g");
  await expect(table).toContainText("Mars, 0.38 g");
  await expect(table).toContainText("Extrapolated");
  await page.getByLabel("Prediction ignition source", { exact: true }).selectOption("hot-wire");
  await page.getByRole("link", { name: "Open in 3D simulation", exact: true }).click();
  await expect(page).toHaveURL(/\/simulation$/);
  await expect(page.getByLabel("Fire origin", { exact: true })).toHaveValue("lunar-habitat-lab-bench-0");
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
  await page.getByRole("button", { name: "Start scenario", exact: true }).click();
  await expect(page.getByTestId("fire-status")).toContainText("Flaming");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByTestId("fire-hud")).toContainText("paused");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
