// Renders .github/banner.html to .github/banner.png at 2x for a crisp README hero.
// Usage: node .github/render-banner.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 560 },
  deviceScaleFactor: 2,
});

await page.goto("file://" + join(here, "banner.html"), {
  waitUntil: "networkidle",
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const stage = page.locator(".stage");
await stage.screenshot({ path: join(here, "banner.png") });

await browser.close();
console.log("Wrote .github/banner.png");
