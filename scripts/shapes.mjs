/*
 * Print the shape of every API response the screens have to render.
 *
 * Guessing at response shapes is how front ends end up rendering undefined, so
 * this logs in as the demo teacher and walks the endpoints, printing a compact
 * type tree (keys, types, one example value) rather than the raw payload.
 *
 *   node scripts/shapes.mjs            # teacher account
 *   node scripts/shapes.mjs student    # student account
 */

const BASE = process.env.EQUITA_API ?? "http://localhost:8787";
const argv = process.argv.slice(2);
const who = argv[0] === "student" || argv[0] === "teacher" ? argv.shift() : "teacher";
const account = who === "student" ? "maya@equita.demo" : "amara@equita.demo";

let cookie = "";

async function call(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "content-type": "application/json", cookie, ...(init.headers ?? {}) },
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, body };
}

function shape(value, depth = 0, seen = new Set()) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    const inner = shape(value[0], depth + 1, seen);
    return `${value.length} × ${inner}`;
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "<circular>";
    seen.add(value);
    if (depth > 2) return "{…" + Object.keys(value).slice(0, 4).join(",") + "}";
    const parts = Object.entries(value).map(([k, v]) => `${k}: ${shape(v, depth + 1, seen)}`);
    return parts.length > 12 ? "{\n    " + parts.join("\n    ") + "\n  }" : "{ " + parts.join(", ") + " }";
  }
  if (typeof value === "string") return JSON.stringify(value.length > 44 ? value.slice(0, 44) + "…" : value);
  return typeof value;
}

const login = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email: account, password: "equita2026" }) });
if (login.status !== 200) {
  console.error("login failed", login.status, login.body);
  process.exit(1);
}
console.log(`\n### signed in as ${account}\n`);

const paths = argv.length ? argv : null;
const ids = {};

if (!paths) {
  const list = await call("/api/projects");
  ids.project = list.body?.projects?.[0]?.id;
  const classes = await call("/api/classrooms");
  ids.classroom = classes.body?.classrooms?.[0]?.id;
  const tasks = await call(`/api/projects/${ids.project}`);
  ids.task = tasks.body?.project?.tasks?.[0]?.id ?? tasks.body?.tasks?.[0]?.id;
  const people = await call("/api/insights/people/" + (tasks.body?.project?.members?.[0]?.id ?? ""));
  ids.person = null;
  console.log("ids:", ids, "\n");
}

const targets = paths ?? [
  "/api/auth/me",
  "/api/skills",
  "/api/projects",
  `/api/projects/${ids.project}`,
  `/api/projects/${ids.project}/equity`,
  `/api/projects/${ids.project}/activity`,
  `/api/projects/${ids.project}/nudges`,
  `/api/projects/${ids.project}/reviews`,
  `/api/tasks/${ids.task}`,
  "/api/classrooms",
  `/api/classrooms/${ids.classroom}`,
  `/api/classrooms/${ids.classroom}/analytics`,
  "/api/insights/dashboard",
  "/api/insights/notifications",
  "/api/insights/nudges",
  "/api/insights/copilot/starters",
  "/api/insights/search?q=re",
];

for (const path of targets) {
  const { status, body } = await call(path);
  console.log(`--- GET ${path}  [${status}]`);
  console.log("   ", shape(body).replace(/\n/g, "\n    "));
  console.log();
}