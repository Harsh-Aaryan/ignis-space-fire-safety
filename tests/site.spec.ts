import { expect, test, type Page } from "@playwright/test";

function monitor(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** The cabin conditions chip in the top bar. */
const cabinChip = (page: Page) => page.getByRole("button", { name: /^Cabin conditions: / });

/** Picks a habitat with the Moon / Mars / Gateway switcher in the top bar. */
async function chooseHabitat(page: Page, name: string) {
  await page.getByRole("radio", { name, exact: true }).click();
  await expect(page.getByRole("radio", { name, exact: true })).toBeChecked();
}

test("four sections, and earlier addresses still resolve", async ({ page }) => {
  await page.goto("/");
  const sections = page.getByRole("navigation", { name: "Sections", exact: true }).first();
  await expect(sections.getByRole("link")).toHaveCount(4);
  await expect(sections.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");

  const moved = [
    ["/firetwin", "/simulation"],
    ["/predict", "/simulation/compare"],
    ["/materials", "/research/data"],
    ["/gravity-bridge", "/research/gaps"],
    ["/firelab", "/research/gaps"],
    ["/reports", "/results"],
  ];
  for (const [from, to] of moved) {
    await page.goto(from, { waitUntil: "domcontentloaded" });
    await expect(page, from).toHaveURL(new RegExp(to + "$"));
  }
  await expect(sections.getByRole("link", { name: "Results", exact: true })).toHaveAttribute("aria-current", "page");
});

test("the page itself never scrolls; only the main area does", async ({ page }) => {
  // Regression: sr-only labels inside <main> once anchored to the page, stretched the
  // document past the h-dvh shell and added a second scrollbar over an empty band.
  for (const viewport of [{ width: 1912, height: 988 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/research", "/results"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#main")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), { message: `${path} at ${viewport.width}px` })
        .toBeLessThanOrEqual(1);
    }
  }
});

test("overview leads to the three research questions", async ({ page }) => {
  const errors = monitor(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fire behaves differently off Earth");
  await page.getByRole("link", { name: "See the modeling data" }).click();
  await expect(page).toHaveURL(/\/research\/data$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modeling data");
  await page.goto("/");
  await chooseHabitat(page, "Mars, 0.38 g");
  await expect(page.locator("#habitat-preview")).toHaveAttribute("data-habitat", "mars-exterior");
  expect(errors).toEqual([]);
});

test("overview opens on a sourced finding and a research question, and its habitat follows the top bar", async ({ page }) => {
  const errors = monitor(page);
  const hydration: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|did not match|#418|#423|#425/i.test(message.text())) hydration.push(message.text());
  });
  await page.goto("/");
  const viewport = page.viewportSize()!;

  // A finding with its implication and source, a question box and the main actions all sit in the first desktop screen.
  const finding = page.getByRole("region", { name: "Featured finding", exact: true });
  await expect(finding).toContainText("981 s");
  await expect(finding).toContainText("Implication for crew safety");
  await expect(finding.getByRole("link", { name: "Saffire VI", exact: true })).toHaveAttribute("href", "/research/saffire-vi");
  await expect(finding.getByRole("link", { name: "NTRS 20240002981", exact: true })).toHaveAttribute("href", "https://ntrs.nasa.gov/citations/20240002981");
  const question = page.getByRole("search", { name: "Search the investigations", exact: true });
  for (const target of [finding, question, page.getByRole("link", { name: "Run a fire scenario", exact: true })]) {
    const box = (await target.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  await expect(page.locator('section[aria-labelledby="overview-title"] dl')).toHaveCount(0);

  // The render is the hero scene: full width across the top half of the screen, with the headline on it.
  const main = (await page.locator("main").boundingBox())!;
  const render = (await page.locator("#habitat-preview").boundingBox())!;
  const heading = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
  expect(render.width).toBeGreaterThanOrEqual(main.width - 1);
  expect(render.height).toBeGreaterThanOrEqual(viewport.height * 0.45);
  expect(heading.y).toBeGreaterThanOrEqual(render.y);
  expect(heading.y + heading.height).toBeLessThanOrEqual(render.y + render.height);
  await expect(page.locator("#habitat-preview img")).toHaveAttribute("src", /q=90/);

  // A fresh session shows the same habitat in the top bar switcher and the hero, and the switcher moves both.
  // The hero has no habitat switch of its own: it names the habitat and its gravity.
  const hero = page.locator('section[aria-labelledby="overview-title"]');
  await expect(hero.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Moon, 0.165 g", exact: true })).toBeChecked();
  await expect(hero).toContainText("Moon habitat · 0.165 g");
  await expect(page.locator("#habitat-preview")).toHaveAttribute("data-habitat", "moon-exterior");
  await expect(page.getByText("Conceptual habitat after Foster + Partners / ESA", { exact: true })).toBeVisible();
  await chooseHabitat(page, "Gateway, about 0 g");
  await expect(page.getByText("Exterior after NASA Gateway; interiors are conceptual", { exact: true })).toBeVisible();
  await chooseHabitat(page, "Mars, 0.38 g");
  await expect(page.locator("#habitat-preview")).toHaveAttribute("data-habitat", "mars-exterior");
  await expect(hero).toContainText("Mars habitat · 0.38 g");
  // The session's habitat survives a reload, without a hydration mismatch.
  await page.reload();
  await expect(page.getByRole("radio", { name: "Mars, 0.38 g", exact: true })).toBeChecked();
  await expect(page.locator("#habitat-preview")).toHaveAttribute("data-habitat", "mars-exterior");

  // On a phone the headline and actions sit on the render, then the finding and the question box follow it, with no sideways scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  const bottomNav = 64;
  const run = (await page.getByRole("link", { name: "Run a fire scenario", exact: true }).boundingBox())!;
  expect(run.y + run.height).toBeLessThan(844 - bottomNav);
  const phoneRender = (await page.locator("#habitat-preview").boundingBox())!;
  expect(run.y).toBeGreaterThanOrEqual(phoneRender.y);
  expect(run.y + run.height).toBeLessThanOrEqual(phoneRender.y + phoneRender.height);
  const findingBox = (await finding.boundingBox())!;
  expect(findingBox.y).toBeGreaterThan(phoneRender.y + phoneRender.height);
  expect((await question.getByRole("searchbox").boundingBox())!.y).toBeGreaterThan(findingBox.y);
  expect(await noSidewaysScroll(page)).toBe(true);
  await page.setViewportSize(viewport);

  const primary = await page.getByRole("link", { name: "Run a fire scenario", exact: true }).evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
  }));
  // Ask IGNIS is outlined: the filled accent belongs to the page's own primary action alone.
  const assistant = await page.getByRole("button", { name: "Ask IGNIS", exact: true }).evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
  }));
  expect(assistant.background).not.toEqual(primary.background);
  expect(assistant.color).not.toEqual(primary.color);
  expect(errors).toEqual([]);
  expect(hydration).toEqual([]);
});

test("mobile top bar keeps the habitat switcher and oxygen visible in two rows, and habitat keyboard selection keeps focus", async ({ page }) => {
  await page.goto("/");
  const chip = cabinChip(page);
  const header = page.locator("header").filter({ has: chip });
  const switcher = page.getByRole("radiogroup", { name: "Habitat" });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(chip).toBeVisible();
    await expect(switcher).toBeVisible();
    // Two rows, no taller than 116px: the mark, the cabin chip and an icon-only Ask IGNIS, then Moon / Mars / Gateway.
    expect((await header.boundingBox())!.height, `Top bar height at ${width}px`).toBeLessThanOrEqual(116);
    const ask = page.getByRole("button", { name: "Ask IGNIS", exact: true });
    await expect(ask).toBeVisible();
    expect((await ask.boundingBox())!.width, `Ask IGNIS is an icon button at ${width}px`).toBeLessThanOrEqual(48);
    // The oxygen readout is shown in full inside the chip.
    const oxygen = chip.locator('[data-slot="scenario-readout"]');
    await expect(oxygen).toHaveText(/% O₂$/);
    expect(await oxygen.evaluate((value) => {
      const box = value.getBoundingClientRect();
      const control = value.closest("button")!.getBoundingClientRect();
      return box.width > 0 && box.left >= control.left && box.right <= control.right && value.scrollWidth <= value.clientWidth;
    }), `Oxygen fits at ${width}px`).toBe(true);
    expect(await noSidewaysScroll(page)).toBe(true);
  }

  const moon = page.getByRole("radio", { name: "Moon, 0.165 g", exact: true });
  const mars = page.getByRole("radio", { name: "Mars, 0.38 g", exact: true });
  const gateway = page.getByRole("radio", { name: "Gateway, about 0 g", exact: true });
  await moon.focus();
  for (const [key, habitat] of [["ArrowRight", mars], ["End", gateway], ["Home", moon], ["Home", moon], ["ArrowLeft", gateway]] as const) {
    await page.keyboard.press(key);
    await expect(habitat).toBeChecked();
    await expect(habitat).toBeFocused();
  }
});

test("investigations filter by crew environment and open a record", async ({ page }) => {
  const errors = monitor(page);
  await page.goto("/research");
  await expect(page.getByTestId("research-index-count")).toContainText("Showing 19 of 19");
  await page.getByRole("button", { name: /Lunar surface habitats/ }).click();
  await expect(page.getByRole("article").filter({ hasText: "Wire fires in partial gravity" })).toContainText("Tested");
  await expect(page.getByRole("article").filter({ hasText: "BASS-II" }).first()).toContainText("Transferable");

  await page.getByRole("searchbox").fill("smoke aerosol");
  await expect(page.getByTestId("research-index-count")).not.toContainText("Showing 19 of");
  await page.getByRole("link", { name: /SAME-2/ }).first().click();
  await expect(page).toHaveURL(/\/research\/same-2$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SAME-2");
  const trail = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
  await expect(trail.getByRole("link", { name: "All investigations", exact: true })).toHaveAttribute("href", "/research");
  await expect(trail.locator('[aria-current="page"]')).toHaveText("SAME-2");
  await expect(page.getByText("Kapton and Teflon smoke is very small")).toBeVisible();
  await expect(page.getByRole("link", { name: "PSI-101", exact: true })).toHaveAttribute("href", /psi\.nasa\.gov/);

  await page.goto("/research/not-a-record");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page is not part of IGNIS");
  expect(errors).toEqual([]);
});

test("NASA experiment tables load, filter and download on a narrow screen", async ({ page, request }) => {
  const errors = monitor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/research/data?view=tables", { waitUntil: "domcontentloaded" });
  const table = page.getByRole("table", { name: "Downloaded NASA PSI data", exact: true });
  await expect(table).toContainText("Calibrated");
  await page.getByLabel("Search NASA data", { exact: true }).fill("PMMA");
  await expect(page.getByTestId("nasa-table-count")).not.toContainText(/^0 matching/);
  await page.getByLabel("NASA PSI dataset", { exact: true }).selectOption("PSI-98");
  await expect(table).toContainText("21.5 - 21.7");
  await expect(table).toContainText("SIBAL Fabric");
  await expect(page.getByRole("region", { name: "Observed Saffire-I telemetry", exact: true })).toBeVisible();
  await page.getByLabel("Observed NASA sensor", { exact: true }).selectOption("obscuration");
  await expect(page.getByTestId("observed-nasa-value")).toContainText("-0.005 V");
  const download = page.getByRole("link", { name: "Download original CSV", exact: true });
  const response = await request.get((await download.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("21.5 - 21.7");
  expect(await noSidewaysScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("modeling data shows measurements, the model check and sources", async ({ page }) => {
  await page.goto("/research/data");
  await page.getByRole("tab", { name: "Flammability and smoke", exact: true }).click();
  await expect(page.getByRole("table", { name: "Extracted Saffire measurements" })).toContainText("VI-3");
  await expect(page.getByRole("table", { name: "White Sands test results" })).toContainText("Kapton");
  await page.getByRole("tab", { name: "Model check", exact: true }).click();
  const check = page.getByRole("table", { name: "Saffire model comparison" });
  await expect(check).toContainText("VI-4");
  await expect(check).toContainText("Modeled ÷ published");
  await expect(page.getByText(/On held-out Saffire VI tests, heat release is within/)).toBeVisible();
  await expect(page.getByText("NIST CFAST cross-check", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Material properties", exact: true }).click();
  await page.getByLabel("Research material", { exact: true }).selectOption("sibal");
  await page.getByRole("link", { name: "Compare this material", exact: true }).click();
  await expect(page).toHaveURL(/\/simulation\/compare$/);
  await expect(page.getByLabel("Prediction material", { exact: true })).toHaveValue("sibal");

  await page.goto("/research/data?view=sources#source-bass-ii");
  await expect(page.locator("#source-bass-ii")).toContainText("BASS-II");
});

test("controls and evidence gaps are built from the research index", async ({ page }) => {
  const errors = monitor(page);
  await page.goto("/research/controls");
  await expect(page.getByRole("heading", { name: "Detection", exact: true })).toBeVisible();
  await expect(page.getByText("Detectors belong in the ventilation path.")).toBeVisible();
  await expect(page.getByText(/No test of .* is indexed here/).first()).toBeVisible();

  await page.goto("/research/gaps");
  await expect(page.getByText("None indexed").first()).toBeVisible();
  const cabin = page.getByRole("table", { name: "Cabin conditions compared with tested conditions" });
  const bass = cabin.getByRole("row").filter({ hasText: "BASS-II" });
  await expect(bass).toContainText("Not tested");
  await chooseHabitat(page, "Gateway, about 0 g");
  await expect(bass).not.toContainText("Not tested");
  await expect(bass).toContainText("Above");
  expect(errors).toEqual([]);
});

test("results exports the research index and keeps cabin scenarios", async ({ page }) => {
  await page.goto("/results");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export research index (CSV)", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("ignis-research-index.csv");
  await page.getByLabel("Scenario name", { exact: true }).fill("Test cabin");
  await page.getByRole("button", { name: "Save scenario", exact: true }).click();
  const saved = page.getByRole("listitem").filter({ hasText: "Test cabin" });
  await expect(saved).toBeVisible();
  await saved.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No scenario has been saved in this browser yet.")).toBeVisible();
});
