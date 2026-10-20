/**
 * Layout inspector. Signs in, opens a route, and reports the mistakes that are
 * easy to miss in a screenshot: text clipped without an ellipsis, elements
 * sticking out of their container, siblings overlapping, controls too small to
 * hit, and a page that scrolls sideways.
 *
 *   MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher /today
 *   MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher /projects /projects/new
 */
import { launchBrowser } from "./browser.mjs";

const ACCOUNTS = { teacher: "amara@equita.demo", teacher2: "tobias@equita.demo", student: "maya@equita.demo", free: "june@equita.demo", none: null };
const [, , accountArg = "teacher", ...routes] = process.argv;
const account = ACCOUNTS[accountArg];

/** Runs inside the page. Kept as one function so it can be passed to evaluate whole. */
function audit() {
  const out = { path: location.pathname, title: document.title, height: 0, hOverflow: 0, viewport: `${window.innerWidth}x${window.innerHeight}`, scheme: document.documentElement.dataset.scheme ?? null, clipped: [], overflow: [], overlap: [], small: [], unlabelled: [], images: [] };
  const root = document.getElementById("root");
  if (!root) return out;

  const label = (el) => {
    const parts = [];
    let node = el;
    for (let depth = 0; depth < 3 && node && node !== document.body; depth += 1) {
      let step = node.tagName.toLowerCase();
      if (node.id) step += `#${node.id}`;
      else if (node.className && typeof node.className === "string") {
        const first = node.className.trim().split(/\s+/).slice(0, 2).join(".");
        if (first) step += `.${first}`;
      }
      parts.unshift(step);
      node = node.parentElement;
    }
    const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
    return `${parts.join(" > ")} — "${text}"`;
  };

  const visible = (el) => {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0.5 && rect.height > 0.5;
  };

  out.height = document.documentElement.scrollHeight;
  out.hOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

  const all = [...root.querySelectorAll("*")];
  for (const el of all) {
    if (!visible(el)) continue;
    // Screen-reader-only text is deliberately one pixel wide; it is not clipped.
    if (el.closest(".visually-hidden") || el.classList.contains("visually-hidden")) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // Text cut off with no ellipsis and no scroll: the reader loses words.
    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
    if (hasOwnText && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      const scrollable = ["auto", "scroll"].includes(style.overflowX);
      const ellipsis = style.textOverflow === "ellipsis";
      const wraps = style.whiteSpace !== "nowrap" && style.whiteSpace !== "pre";
      if (!scrollable && !ellipsis) {
        out.clipped.push({ el: label(el), shown: el.clientWidth, needs: el.scrollWidth, wraps });
      }
    }

    // A box wider than the space it was given.
    const parent = el.parentElement;
    if (parent && !["absolute", "fixed"].includes(style.position) && style.display !== "contents") {
      const prow = parent.getBoundingClientRect();
      const pstyle = getComputedStyle(parent);
      const parentScrollsX = ["auto", "scroll"].includes(pstyle.overflowX);
      const inScrollX = el.closest(".scroll-x");
      const clippedByParent = pstyle.overflowX === "hidden" || pstyle.overflow === "hidden";
      if (!parentScrollsX && !inScrollX && !clippedByParent && rect.width > prow.width + 2 && prow.width > 40) {
        out.overflow.push({ el: label(el), width: Math.round(rect.width), parentWidth: Math.round(prow.width), parent: label(parent) });
      }
    }

    // Controls smaller than a fingertip.
    if (el.matches("button, a[href], input, select, textarea, [role=button]") && rect.height < 24 && rect.width >= 12) {
      out.small.push({ el: label(el), h: Math.round(rect.height * 10) / 10, w: Math.round(rect.width * 10) / 10 });
    }

    // Icon-only controls with nothing for a screen reader to say.
    if (el.matches("button, a[href]")) {
      const named = el.getAttribute("aria-label") || el.getAttribute("title") || (el.textContent || "").trim().length > 0;
      if (!named) out.unlabelled.push(label(el));
    }
  }

  // Siblings that sit on top of each other inside one row or head.
  for (const row of root.querySelectorAll(".panel__head, .row, .page-head, .panel__foot")) {
    const kids = [...row.children].filter(visible);
    for (let i = 0; i < kids.length; i += 1) {
      for (let j = i + 1; j < kids.length; j += 1) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && h > 2) {
          const area = w * h;
          const smaller = Math.min(a.width * a.height, b.width * b.height);
          if (area > smaller * 0.25) out.overlap.push({ a: label(kids[i]), b: label(kids[j]), px: Math.round(area) });
        }
      }
    }
  }

  for (const img of root.querySelectorAll("img")) {
    const rect = img.getBoundingClientRect();
    out.images.push({ src: img.currentSrc.split("/").pop(), w: Math.round(rect.width), h: Math.round(rect.height), loaded: img.complete && img.naturalWidth > 0, alt: img.alt.slice(0, 60) });
  }
  return out;
}

const browser = await launchBrowser();
/*
 * Viewport and scheme are environment variables rather than arguments, because
 * the remaining arguments are routes and an option-looking string would be
 * indistinguishable from a path on Windows.
 *
 *   EQUITA_WIDTH=390 MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher /today
 *   EQUITA_SCHEME=ink MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher /today
 */
const width = Number(process.env.EQUITA_WIDTH || 1440);
const height = Number(process.env.EQUITA_HEIGHT || 900);
const scheme = process.env.EQUITA_SCHEME;
const context = await browser.newContext({ viewport: { width, height } });
if (scheme) {
  // Written before any document script runs, so index.html's pre-paint choice
  // reads the stored value and the first frame is already in the right scheme.
  await context.addInitScript((value) => {
    try {
      window.localStorage.setItem("equita.scheme", value);
    } catch {
      /* a blocked storage API is not a reason to fail the run */
    }
  }, scheme);
}
const noise = [];
context.on("page", (page) => {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") noise.push(`${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => noise.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("response", (r) => {
    if (r.status() >= 400) noise.push(`http ${r.status()} ${r.url().replace("http://localhost:5173", "")}`);
  });
});

if (account) {
  const res = await context.request.post("http://localhost:5173/api/auth/demo", { data: { email: account } });
  if (res.status() !== 200) console.log("sign in failed:", res.status());
}

const page = await context.newPage();
const report = [];
for (const route of routes.length ? routes : ["/today"]) {
  await page.goto(`http://localhost:5173${route}`, { waitUntil: "load" });
  await page.waitForTimeout(1800);
  const result = await page.evaluate(audit);
  report.push(result);
}

console.log(JSON.stringify(report, null, 1));
const real = noise.filter((line) => !line.includes("favicon"));
if (real.length) {
  console.log("--- console noise ---");
  console.log([...new Set(real)].slice(0, 20).join("\n"));
}
await browser.close();
