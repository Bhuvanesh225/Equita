/**
 * Endpoint smoke test.
 *
 * Why this exists: the project workspace was built under `tsc` and a screenshot,
 * and both passed while every write endpoint it calls was a 404 — the router was
 * mounted under the wrong path. A typecheck cannot see a URL, and a screenshot of
 * a read-only page cannot see a write.
 *
 * So this walks the real API with the real session cookie and asserts a status
 * for every endpoint a screen depends on. It is deliberately **non-mutating**:
 * it calls the preview half of the two-step endpoints only, and never an `/apply`
 * that would write.
 *
 *   node scripts/smoke.mjs            # as the demo teacher
 *   node scripts/smoke.mjs student    # as the demo student
 *
 * Exit code is 1 if anything failed, so it can gate a delivery.
 */

const BASE = process.env.EQUITA_API ?? "http://127.0.0.1:8787";
const who = process.argv[2] === "student" ? "student" : "teacher";
const EMAIL = who === "student" ? "maya@equita.demo" : "amara@equita.demo";

let cookie = "";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text.slice(0, 160);
  }
  return { status: res.status, payload };
}

/* ---------- sign in ------------------------------------------------------- */

const signin = await call("POST", "/api/auth/demo", { email: EMAIL });
if (signin.status !== 200 || !signin.payload?.user) {
  console.error(`could not sign in as ${EMAIL}:`, signin.status, signin.payload);
  process.exit(2);
}

/* ---------- real ids, so the paths under test are real paths --------------- */

const projects = await call("GET", "/api/projects");
const project = projects.payload?.projects?.[0]?.id ?? null;
const classrooms = await call("GET", "/api/classrooms");
const classroom = classrooms.payload?.classrooms?.[0]?.id ?? null;

const workspace = project ? await call("GET", `/api/projects/${project}`) : { payload: null };
const task = workspace.payload?.tasks?.[0]?.id ?? null;
const person = workspace.payload?.members?.[0]?.id ?? null;
const student = classroom ? (await call("GET", `/api/classrooms/${classroom}`)).payload?.students?.[0]?.id ?? null : null;

/* ---------- the list ------------------------------------------------------ */

/** [label, method, path, body, accepted statuses] */
const checks = [
  ["health", "GET", "/api/health", undefined, [200]],
  ["session", "GET", "/api/auth/me", undefined, [200]],
  ["skills", "GET", "/api/skills", undefined, [200]],
  ["skill clusters", "GET", "/api/skills/clusters", undefined, [200]],
  ["project list", "GET", "/api/projects", undefined, [200]],
  ["project workspace", "GET", `/api/projects/${project}`, undefined, [200]],
  ["project equity", "GET", `/api/projects/${project}/equity`, undefined, [200]],
  ["project activity", "GET", `/api/projects/${project}/activity`, undefined, [200]],
  ["project nudges", "GET", `/api/projects/${project}/nudges`, undefined, [200]],
  ["project reviews", "GET", `/api/projects/${project}/reviews`, undefined, [200]],
  ["task detail", "GET", `/api/tasks/${task}`, undefined, [200]],
  ["candidate shortlist", "GET", `/api/projects/${project}/assign/${task}`, undefined, [200]],
  ["plan preview", "POST", `/api/projects/${project}/plan`, { utilisation: 0.6 }, [200, 201]],
  ["auto-assign preview", "POST", `/api/projects/${project}/assign/auto`, { apply: false, onlyUnassigned: true }, [200, 403]],
  ["classroom list", "GET", "/api/classrooms", undefined, [200]],
  ["classroom overview", "GET", `/api/classrooms/${classroom}`, undefined, [200]],
  ["classroom analytics", "GET", `/api/classrooms/${classroom}/analytics`, undefined, [200]],
  ["classroom coverage", "GET", `/api/classrooms/${classroom}/coverage`, undefined, [200]],
  ["student record", "GET", `/api/classrooms/${classroom}/students/${student}`, undefined, [200, 403]],
  ["group proposal", "POST", `/api/classrooms/${classroom}/groups/preview`, { size: 4 }, [200, 403]],
  ["dashboard", "GET", "/api/insights/dashboard", undefined, [200]],
  ["insight nudges", "GET", "/api/insights/nudges", undefined, [200]],
  ["notifications", "GET", "/api/insights/notifications", undefined, [200]],
  ["copilot starters", "GET", "/api/insights/copilot/starters", undefined, [200]],
  ["copilot ask", "POST", "/api/insights/copilot", { question: "what should I do next?" }, [200]],
  ["search", "GET", "/api/insights/search?q=re", undefined, [200]],
  ["person record", "GET", `/api/insights/people/${person}`, undefined, [200]],
  ["public story", "GET", "/api/public/story", undefined, [200]],
];

const rows = [];
let failed = 0;
for (const [label, method, path, body, accepted] of checks) {
  if (path.includes("null") || path.includes("undefined")) {
    rows.push({ ok: false, label, status: "skipped", path, note: "no id available to build the path" });
    failed += 1;
    continue;
  }
  const { status, payload } = await call(method, path, body);
  const ok = accepted.includes(status);
  if (!ok) failed += 1;
  const denied = status === 403 && accepted.includes(403);
  rows.push({
    ok,
    label,
    status: denied ? "403 ok" : status,
    path,
    note: ok ? "" : typeof payload?.error === "string" ? payload.error : JSON.stringify(payload).slice(0, 120),
  });
}

const width = Math.max(...rows.map((row) => row.label.length));
for (const row of rows) {
  console.log(`${row.ok ? "ok  " : "FAIL"}  ${row.label.padEnd(width)}  ${String(row.status).padEnd(4)}  ${row.path}${row.note ? `   ← ${row.note}` : ""}`);
}

console.log(
  `\n${rows.length - failed}/${rows.length} endpoints answered as expected as ${EMAIL}` +
    `\nids: project=${project} classroom=${classroom} task=${task} person=${person} student=${student}`,
);

process.exit(failed ? 1 : 0);