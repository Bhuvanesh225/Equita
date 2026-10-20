/**
 * One-off DOM probe: signs in, loads a route, and prints what is actually in
 * the document. Used while a screen renders nothing and the reason is not
 * obvious from a screenshot.
 *
 *   MSYS_NO_PATHCONV=1 node scripts/probe.mjs teacher /today
 */
import { launchBrowser } from "./browser.mjs";

const ACCOUNTS = { teacher: "amara@equita.demo", teacher2: "tobias@equita.demo", student: "maya@equita.demo", free: "june@equita.demo", none: null };
const [, , accountArg = "teacher", route = "/today"] = process.argv;
const account = ACCOUNTS[accountArg];

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const messages = [];
context.on("page", (page) => {
  page.on("console", (m) => messages.push(`${m.type()}: ${m.text().slice(0, 300)}`));
  page.on("pageerror", (e) => messages.push(`pageerror: ${String(e.stack ?? e).slice(0, 900)}`));
  page.on("requestfailed", (r) => messages.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.status() >= 400) messages.push(`http ${r.status()} ${r.url()}`);
  });
  page.on("websocket", (socket) => {
    messages.push(`ws open ${socket.url()}`);
    socket.on("framereceived", (frame) => messages.push(`ws recv ${String(frame.payload).slice(0, 300)}`));
    socket.on("framesent", (frame) => messages.push(`ws sent ${String(frame.payload).slice(0, 300)}`));
    socket.on("close", () => messages.push("ws close"));
  });
});

if (account) {
  const res = await context.request.post("http://localhost:5173/api/auth/demo", { data: { email: account } });
  console.log("sign in:", res.status());
}

const page = await context.newPage();
await page.goto("http://localhost:5173" + route, { waitUntil: "load" });
await page.waitForTimeout(5000);
const dump = await page.evaluate(() => ({
  path: location.pathname,
  ready: document.readyState,
  rootLen: document.getElementById("root")?.innerHTML.length,
  html: document.getElementById("root")?.innerHTML.slice(0, 1500),
  scripts: [...document.querySelectorAll("link[rel=modulepreload]")].map((n) => n.href),
  sessions: document.cookie.length,
}));
console.log(JSON.stringify(dump, null, 1));
console.log("--- messages ---");
console.log(messages.slice(-25).join("\n"));
await browser.close();
