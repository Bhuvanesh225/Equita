/**
 * Screenshot harness.
 *
 * A real browser of our own, so a picture of every screen can be taken without
 * depending on whatever tab a person happens to have open. Signs in through the
 * same API the app uses, then walks the routes and writes one PNG per screen.
 *
 *   node scripts/shoot.mjs <account> <outdir> <route...>
 *
 * account is `teacher`, `student`, or `none` for the pages a stranger sees.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { launchBrowser } from "./browser.mjs";

const ACCOUNTS = {
  teacher: "amara@equita.demo",
  teacher2: "tobias@equita.demo",
  student: "maya@equita.demo",
  free: "june@equita.demo",
  none: null,
};

const [, , accountArg = "teacher", outArg = ".shots", ...routeArgs] = process.argv;
const account = ACCOUNTS[accountArg];
if (account === undefined) throw new Error(`unknown account: ${accountArg}`);

const BASE = "http://localhost:5173";
const routes = routeArgs.length ? routeArgs : ["/today"];
const outDir = path.resolve(outArg);
await mkdir(outDir, { recursive: true });

const browser = await launchBrowser();

/*
 * Viewport and scheme come from the environment so the route arguments stay
 * routes. `EQUITA_WIDTH=390` and `EQUITA_SCHEME=ink` are what the mobile and
 * dark-scheme passes in the roadmap are run with.
 */
const width = Number(process.env.EQUITA_WIDTH || 1440);
const height = Number(process.env.EQUITA_HEIGHT || 900);
const scheme = process.env.EQUITA_SCHEME;
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  colorScheme: scheme === "ink" ? "dark" : "light",
});
if (scheme) {
  await context.addInitScript((value) => {
    try {
      window.localStorage.setItem("equita.scheme", value);
    } catch {
      /* ignore */
    }
  }, scheme);
}

if (account) {
  const res = await context.request.post(`${BASE}/api/auth/demo`, {
    data: { email: account },
    headers: { "content-type": "application/json" },
  });
  if (!res.ok()) throw new Error(`sign in failed: ${res.status()} ${await res.text()}`);
}

const summary = [];
for (const route of routes) {
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror ${String(error).slice(0, 200)}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // The extension's own chrome-extension:// violations are not ours.
    if (text.includes("chrome-extension://") || text.includes("Permissions policy")) return;
    problems.push(`console ${text.slice(0, 200)}`);
  });

  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !document.querySelector("main .spinner"), null, { timeout: 15000 }).catch(() => {
    problems.push("still loading after 15s");
  });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  // Reveal-on-scroll never fires for content below the fold in a full-page shot.
  await page.evaluate(() => {
    document.querySelectorAll("[data-reveal]").forEach((node) => node.setAttribute("data-seen", "true"));
    document.querySelectorAll("[data-armed]").forEach((node) => node.setAttribute("data-armed", "false"));
  });
  await page.waitForTimeout(600);

  const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-");
  // The viewport and scheme go into the filename so a mobile or ink capture
  // never silently overwrites the desktop one.
  const suffix = `${scheme ? `-${scheme}` : ""}${width !== 1440 ? `-${width}` : ""}`;
  const file = path.join(outDir, `${slug}${suffix}.png`);
  await page.screenshot({ path: file, fullPage: true });

  const facts = await page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    const count = (selector) => document.querySelectorAll(selector).length;
    return {
      url: location.pathname,
      title: text(".page-head__heading") ?? text("h1"),
      height: document.documentElement.scrollHeight,
      panels: count(".panel"),
      flags: count(".flag"),
      empty: text(".empty__title"),
    };
  });
  const size = await page.viewportSize();
  summary.push({ route, file: path.basename(file), ...facts, viewport: `${size.width}x${size.height}`, problems });
  await page.close();
}

await browser.close();
const report = { account: account ?? "stranger", outDir, screens: summary };
await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
