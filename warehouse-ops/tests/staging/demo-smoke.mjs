// Browser smoke test of the demo accounts against an app connected to staging.
//   BASE_URL=http://localhost:3000 DEMO_PASSWORD=... node tests/staging/demo-smoke.mjs [screenshotDir]
// Set BROWSER_PROXY when the browser needs a proxy to reach Supabase (e.g. in CI sandboxes).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PW = process.env.DEMO_PASSWORD;
const SHOTS = process.argv[2] ?? "staging-screenshots";
if (!PW) throw new Error("Set DEMO_PASSWORD");
fs.mkdirSync(SHOTS, { recursive: true });
let n = 0;
const ok = (c, m) => {
  if (!c) throw new Error(`FAIL: ${m}`);
  console.log(`ok ${++n} - ${m}`);
};
const browser = await chromium.launch(
  process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {},
);
async function login(email, ctxOpts = { viewport: { width: 1366, height: 900 } }) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  return page;
}
try {
  const dana = await login("dana.owner@example.com");
  await dana.goto(`${BASE}/dashboard?range=all`);
  const total = (await dana.locator("a:has-text('Total exceptions') p").nth(1).innerText()).trim();
  ok(Number(total) >= 48, `Owner dashboard shows ${total} synthetic exceptions`);
  ok(await dana.locator("td a", { hasText: "Trinity Corrugated" }).isVisible(), "Supplier patterns show the synthetic suppliers");
  await dana.screenshot({ path: path.join(SHOTS, "staging-dashboard.png"), fullPage: true });
  await dana.goto(`${BASE}/incidents`);
  await dana.screenshot({ path: path.join(SHOTS, "staging-incidents.png"), fullPage: true });
  await dana.locator("tbody a").first().waitFor({ timeout: 30_000 });
  const firstHref = await dana.locator("tbody a").first().getAttribute("href");
  await dana.goto(BASE + firstHref);
  await dana.getByText("Activity and comments").waitFor({ timeout: 30_000 });
  ok(true, "Incident detail with history renders");
  await dana.screenshot({ path: path.join(SHOTS, "staging-incident.png"), fullPage: true });

  const grace = await login("grace.viewer@example.com");
  ok(!(await grace.locator("text=Report exception").count()), "Viewer has no Report exception button");

  const rosa = await login("rosa.owner@example.com", { ...devices["iPhone 13"] });
  await rosa.goto(`${BASE}/incidents`);
  await rosa.locator("ul.md\\:hidden > li").first().waitFor({ timeout: 30_000 });
  ok((await rosa.locator("ul.md\\:hidden > li").count()) === 2, "Second company sees only its own 2 incidents");
  await rosa.goto(BASE + firstHref);
  await rosa.getByText("Page not found").waitFor({ timeout: 30_000 });
  ok(true, "Second company cannot open the first company's incident URL");
  await rosa.screenshot({ path: path.join(SHOTS, "staging-mobile-second-company.png"), fullPage: true });
  console.log(`\nAll ${n} staging demo checks passed.`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
