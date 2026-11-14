/* Local browser profile. Uses the installed Edge/Playwright setup. Run after a
 * production server starts. Numbers describe this renderer/device, not all hardware.
 */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(90000);
    await page.goto(process.env.IGNIS_TEST_URL ?? "http://127.0.0.1:3100/firetwin");
    if (!page.url().endsWith("/firetwin")) await page.goto(new URL("/firetwin", page.url()).href);
    await page.getByRole("tab", { name: "Fire scenario", exact: true }).click();
    await page.getByRole("button", { name: "Acrylic ignition", exact: true }).click();
    await page.getByRole("button", { name: "10×", exact: true }).click();
    await page.getByRole("button", { name: "Start scenario", exact: true }).click();
    await page.getByTestId("fire-status").filter({ hasText: "flaming" }).waitFor();
    const measured = await page.evaluate(() => new Promise(resolve => {
      const intervals = []; const start = performance.now(); let last = start;
      function frame(now) {
        intervals.push(now - last); last = now;
        if (now - start < 5000) return requestAnimationFrame(frame);
        intervals.sort((a,b) => a-b);
        resolve({ sampleMs: now-start, frames: intervals.length, averageFps: intervals.length / ((now-start)/1000), medianFrameMs: intervals[Math.floor(intervals.length*.5)], p95FrameMs: intervals[Math.floor(intervals.length*.95)] });
      }
      requestAnimationFrame(frame);
    }));
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const report = { measuredAt: new Date().toISOString(), renderer: "Edge headless, ANGLE SwiftShader software WebGL", viewport: "1600x1000", playback: "10x, lunar acrylic fire", ...measured, interpretation: "Observed local software-rendering performance; not a native GPU or mobile-device guarantee." };
    const output = path.resolve(__dirname, "..", ".qa-baseline");
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, "v2-render-performance.json"), JSON.stringify(report,null,2)+"\n");
    await page.screenshot({ path: path.join(output, "v2-profiled-scene.png") });
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
