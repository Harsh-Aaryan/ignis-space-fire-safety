import { test, expect } from "@playwright/test";

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
      await route.fulfill({ json: { text: "Airflow transports oxygen to the flame. This is an exploratory model explanation.", sources: ["bass-ii"], context: "Model 2.0.0 · setup preview", provider: "groq" } });
    } else {
      await route.fulfill({ status: 429, json: { error: "Too many questions." } });
    }
  });
  await page.goto("/materials");
  await page.getByRole("button", { name: "Ask IGNIS", exact: true }).click();
  const assistant = page.getByRole("complementary", { name: "Ask IGNIS scenario assistant" });
  const input = assistant.getByLabel("Ask IGNIS a question");
  await input.fill("Why does airflow affect a flame?");
  await assistant.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(assistant.getByRole("status")).toContainText("Checking the scenario");
  await expect(assistant.getByRole("button", { name: "Send question", exact: true })).toBeDisabled();
  releaseAnswer();
  await expect(assistant).toContainText("AI explanation · Groq");
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
  await page.goto("/firetwin");
  await page.getByRole("tab",{name:"Fire scenario",exact:true}).click();
  await page.getByRole("button",{name:"Acrylic ignition",exact:true}).click();
  await expect(page.getByRole("button",{name:"Start scenario",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"10×",exact:true}).click();
  await page.getByRole("button",{name:"Start scenario",exact:true}).click();
  await expect(page.getByTestId("fire-status")).toContainText("flaming");
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  await page.getByRole("button",{name:"Explain this run",exact:true}).click();
  const assistant=page.getByRole("complementary",{name:"Ask IGNIS scenario assistant"});
  await assistant.getByRole("button",{name:"Explain this run",exact:true}).click();
  await expect(assistant).toContainText("chemical HRR");
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

test("Ask IGNIS stays visible and keyboard accessible on mobile",async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/materials");
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
});
