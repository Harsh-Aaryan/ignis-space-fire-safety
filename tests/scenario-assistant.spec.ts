import { test, expect, type Page } from "@playwright/test";

/** Picks a habitat with the Moon / Mars / Gateway switcher in the top bar. */
async function chooseHabitat(page: Page, name: string) {
  await page.getByRole("radio", { name, exact: true }).click();
}

test("Ask IGNIS shows pending AI answers, citations and recoverable errors", async ({ page }) => {
  let releaseAnswer!: () => void;
  const gate = new Promise<void>(resolve => { releaseAnswer = resolve; });
  let calls = 0;
  await page.route("**/api/ask-ignis", async route => {
    const payload = route.request().postDataJSON();
    expect(payload.message).toBe("Why does airflow affect a flame?");
    expect(payload).not.toHaveProperty("apiKey");
    if (++calls === 1) {
      await gate;
      await route.fulfill({ json: { text: "Airflow transports oxygen to the flame. This is an exploratory model explanation.", sources: ["bass-ii"], context: "Model 2.1.0 · setup preview", provider: "groq" } });
    } else {
      await route.fulfill({ status: 429, json: { error: "Too many questions." } });
    }
  });
  await page.goto("/research/data");
  await page.getByRole("button", { name: "Ask IGNIS", exact: true }).click();
  const assistant = page.getByRole("complementary", { name: "Ask IGNIS scenario assistant" });
  const input = assistant.getByLabel("Ask IGNIS a question");
  await input.fill("Why does airflow affect a flame?");
  await assistant.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(assistant.getByRole("status")).toContainText("Checking the scenario");
  await expect(assistant.getByRole("button", { name: "Send question", exact: true })).toBeDisabled();
  releaseAnswer();
  await expect(assistant).toContainText("Generated explanation (Groq)");
  await expect(assistant.getByRole("link", { name: /BASS-II/ })).toHaveAttribute("href", /ntrs\.nasa\.gov/);
  await input.fill("Why does airflow affect a flame?");
  await assistant.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(assistant.getByRole("alert")).toContainText("Please wait a minute");
  await expect(input).toHaveValue("Why does airflow affect a flame?");
  await expect(input).toBeEnabled();
});

test("guided setup, grounded assistant and review work together", async ({ page }, info) => {
  const errors: string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",msg=>{if(msg.type()==="error" && /Shader Error|VALIDATE_STATUS|shader.*compil/i.test(msg.text()))errors.push(msg.text());});
  await page.goto("/simulation");
  await page.getByRole("tab",{name:"Fire scenario",exact:true}).click();
  await page.getByRole("button",{name:"Acrylic ignition",exact:true}).click();
  await expect(page.getByRole("button",{name:"Start fire",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"10×",exact:true}).click();
  await page.getByRole("button",{name:"Start fire",exact:true}).click();
  await expect(page.getByTestId("fire-status")).toContainText("Flaming");
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  await page.getByRole("button",{name:"Explain this run",exact:true}).click();
  const assistant=page.getByRole("complementary",{name:"Ask IGNIS scenario assistant"});

  await expect(assistant).toContainText("The fire itself is releasing");
  await expect(assistant.getByRole("link",{name:/NIST CFAST/})).toHaveAttribute("href",/nist/);
  await assistant.getByRole("button",{name:"What changes if I stop ventilation?",exact:true}).click();
  const status=await page.getByTestId("fire-status").textContent();
  await assistant.getByRole("button",{name:"Compare fan shutdown in a copy",exact:true}).click();
  await expect(assistant.getByRole("status")).toContainText("Fresh 180 s runs");
  expect(await page.getByTestId("fire-status").textContent()).toBe(status);
  await page.screenshot({path:info.outputPath("ask-ignis-desktop.png")});
  await page.keyboard.press("Escape");
  await expect(assistant).toHaveCount(0);
  await page.getByRole("button",{name:/4.*Review/}).click();
  await expect(page.getByRole("region",{name:"Fire run review"})).toContainText("Chemical heat");
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export this fire run",exact:true}).click();
  expect((await downloadPromise).suggestedFilename()).toBe("ignis-fire-run.json");
  expect(errors).toEqual([]);
});

test("short requests explain the captured run instead of showing the scope message", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.goto("/simulation", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/WebGL is unavailable/)).toBeVisible();
  await chooseHabitat(page, "Gateway, about 0 g");
  await page.getByRole("tab", { name: "Fire scenario", exact: true }).click();
  await page.getByRole("button", { name: "Acrylic ignition", exact: true }).click();
  await page.getByRole("button", { name: "60×", exact: true }).click();
  await page.getByRole("button", { name: "Start fire", exact: true }).click();
  await expect(page.getByTestId("fire-status")).toContainText("Flaming");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Ask IGNIS", exact: true }).click();
  const assistant = page.getByRole("complementary", { name: "Ask IGNIS scenario assistant" });
  for (const question of ["explain what this run did and how it worked", "explain", "explain my scenario", "Why didn’t this run work?"]) {
    const sent = page.waitForRequest(request => request.url().endsWith("/api/ask-ignis") && request.method() === "POST");
    await assistant.getByLabel("Ask IGNIS a question").fill(question);
    await assistant.getByRole("button", { name: "Send question", exact: true }).click();
    const captured = (await sent).postDataJSON();
    const turn = assistant.getByRole("article").last();
    await expect(turn).toContainText(question);
    await expect(turn).toContainText(`${Number(captured.snapshot.chemicalHrrW).toFixed(0)} W`);
    await expect(turn).toContainText(`${Number(captured.snapshot.peakHrrW).toFixed(0)} W`);
    await expect(turn).toContainText(captured.snapshot.firstAlarmTime === null
      ? "No detector alarm has been recorded yet."
      : `The first detector alarm was at ${Number(captured.snapshot.firstAlarmTime).toFixed(1)} s.`);
    await expect(turn).not.toContainText("I can help with your fire run");
    await expect(turn.getByText("Based on your run", { exact: false })).toBeVisible();
    await expect(assistant.getByRole("button", { name: "Send question", exact: true })).toBeDisabled();
  }
});

test("Ask IGNIS stays visible and keyboard accessible on mobile",async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/research/data");
  await page.getByRole("button",{name:"Ask IGNIS",exact:true}).click();
  const assistant=page.getByRole("complementary",{name:"Ask IGNIS scenario assistant"});
  await expect(assistant).toBeVisible();
  await expect(page.getByLabel("Ask IGNIS a question")).toBeFocused();
  await page.getByLabel("Ask IGNIS a question").fill("Which NASA data supports this?");
  await page.getByRole("button",{name:"Send question",exact:true}).click();
  await expect(assistant).toContainText("Choose a habitat");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath("ask-ignis-mobile.png")});
  await page.keyboard.press("Escape");
  await expect(assistant).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Ask IGNIS",exact:true})).toBeFocused();
});
