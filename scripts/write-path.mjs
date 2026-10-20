/**
 * Disposable end-to-end write-path check.
 *
 * Every request below runs against a fresh seeded database and the real Express
 * app. This is intentionally more demanding than the read-only smoke test: it
 * exercises the writes a person can trigger from the product, then reads the
 * changed records back before the process exits.
 */
import { rmSync } from "node:fs";
import path from "node:path";

const database = path.join(process.cwd(), ".tmp", "write-path.db");
rmSync(database, { force: true });
rmSync(`${database}-wal`, { force: true });
rmSync(`${database}-shm`, { force: true });
process.env.EQUITA_NO_LISTEN = "1";
process.env.EQUITA_DB = database;

const [{ app }, { seedIfEmpty }] = await Promise.all([import("../server/index.js"), import("../server/seed.js")]);
seedIfEmpty();
const server = await new Promise((resolve) => {
  const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
});
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

const sessions = new Map();
async function signIn(email) {
  const response = await fetch(`${base}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error(`sign-in did not set a cookie for ${email}`);
  sessions.set(email, cookie);
  return cookie;
}

async function call(email, method, endpoint, body, expected = [200, 201]) {
  const response = await fetch(`${base}${endpoint}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      cookie: sessions.get(email) ?? (await signIn(email)),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${endpoint} returned non-JSON: ${text.slice(0, 120)}`);
  }
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${endpoint} expected ${expected.join("/")}, got ${response.status}: ${payload?.error ?? text}`);
  }
  return payload;
}

const teacher = "amara@equita.demo";
const student = "maya@equita.demo";
await signIn(teacher);
await signIn(student);

const teacherProjects = await call(teacher, "GET", "/api/projects");
const projectId = teacherProjects.projects[0].id;
const beforeWorkspace = await call(teacher, "GET", `/api/projects/${projectId}`);
const beforeTaskCount = beforeWorkspace.tasks.length;
const mayaId = beforeWorkspace.members.find((member) => member.email === student)?.id;
const memberId = mayaId ?? beforeWorkspace.members.find((member) => member.id !== beforeWorkspace.viewer.id)?.id ?? beforeWorkspace.members[0]?.id;
if (!memberId) throw new Error("seeded project has no member to exercise assignment writes");
if (!mayaId) throw new Error("the seeded project does not include the student used for permission checks");
await call(student, "GET", `/api/projects/${projectId}/reviews`, undefined, [403]);

// Planning is explicitly preview-then-apply; the preview must not change the board.
const dueAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
const planPreview = await call(teacher, "POST", `/api/projects/${projectId}/plan`, { dueAt, utilisation: 0.6 });
const afterPreview = await call(teacher, "GET", `/api/projects/${projectId}`);
if (afterPreview.tasks.length !== beforeTaskCount) throw new Error("plan preview wrote tasks before confirmation");
const plannedTask = planPreview.plan.tasks[0];
if (!plannedTask) throw new Error("planner returned no task to apply");
await call(teacher, "POST", `/api/projects/${projectId}/plan/apply`, {
  tasks: [{ ...plannedTask, dueAt: plannedTask.dueAt ?? dueAt }],
  brief: afterPreview.project.brief,
});

// Create a hand-made task, edit it, assign it, comment, log help, and close it.
const created = await call(teacher, "POST", `/api/projects/${projectId}/tasks`, {
  title: "Write the browser verification note",
  detail: "A disposable end-to-end task.",
  phase: "review",
  effort: 1,
  priority: 2,
  dueAt,
  required: [],
  assigneeId: null,
});
const taskId = created.task.id;
await call(teacher, "PATCH", `/api/tasks/${taskId}`, { title: "Write the verified browser note" });
await call(teacher, "POST", `/api/tasks/${taskId}/assign`, { userId: memberId, force: true });
await call(teacher, "POST", `/api/tasks/${taskId}/comments`, { body: "The write path is under test." });
await call(teacher, "POST", `/api/tasks/${taskId}/log`, { hours: 0.5, note: "Checked the route and response." });
await call(teacher, "POST", `/api/tasks/${taskId}/status`, { status: "doing" });

// A member can edit the description but not the structure, cannot hand the task
// to somebody else through PATCH, and cannot force a close past the review rule.
await call(student, "PATCH", `/api/tasks/${taskId}`, { title: "Write the verified browser note, as Maya" });
await call(student, "PATCH", `/api/tasks/${taskId}`, { effort: 4 }, [403]);
await call(student, "PATCH", `/api/tasks/${taskId}`, { assigneeId: beforeWorkspace.viewer.id }, [400]);
await call(student, "POST", `/api/tasks/${taskId}/status`, { status: "done", force: true }, [403]);
await call(student, "POST", `/api/tasks/${taskId}/assign`, { userId: mayaId, force: true }, [403]);
const otherMember = beforeWorkspace.members.find(
  (member) => member.id !== mayaId && member.id !== beforeWorkspace.viewer.id && member.role !== "lead",
);
if (otherMember) {
  await call(otherMember.email, "POST", `/api/tasks/${taskId}/assign`, { userId: null }, [403]);
}

await call(teacher, "POST", `/api/tasks/${taskId}/status`, { status: "done", actualEffort: 1, note: "Verified end to end." });
const finished = await call(teacher, "GET", `/api/tasks/${taskId}`);
if (finished.task.status !== "done" || !finished.contributions.some((entry) => entry.kind === "complete")) {
  throw new Error("closing a task did not create the completion ledger entry");
}
const completeCount = finished.contributions.filter((entry) => entry.kind === "complete").length;
await call(teacher, "POST", `/api/tasks/${taskId}/status`, { status: "doing", note: "Reopened by the write path." });
await call(teacher, "POST", `/api/tasks/${taskId}/status`, { status: "done", actualEffort: 1, note: "Closed again." });
const reopened = await call(teacher, "GET", `/api/tasks/${taskId}`);
if (reopened.contributions.filter((entry) => entry.kind === "complete").length !== completeCount) {
  throw new Error("reopening and closing a task credited it twice");
}

// Auto-assignment also remains a two-step action.
const autoPreview = await call(teacher, "POST", `/api/projects/${projectId}/assign/auto`, { apply: false, onlyUnassigned: true });
if (autoPreview.applied !== false) throw new Error("auto-assignment preview was not marked unapplied");
if (autoPreview.result.assignments.length) {
  const applied = await call(teacher, "POST", `/api/projects/${projectId}/assign/auto`, { apply: true, onlyUnassigned: true });
  if (applied.applied !== true) throw new Error("auto-assignment apply did not report a write");
}

await call(teacher, "PATCH", `/api/projects/${projectId}`, { status: "review" });
await call(teacher, "POST", `/api/projects/${projectId}/checkin`, { mood: "steady", note: "The board is readable.", blockers: "" });
await call(teacher, "POST", `/api/projects/${projectId}/equity/snapshot`);
await call(teacher, "PATCH", `/api/projects/${projectId}`, { status: "active" });

// Profile and skills round-trip through the session APIs.
await call(student, "PATCH", "/api/auth/me", { headline: "Browser-verified teammate", capacity: 9 });
await call(student, "PUT", "/api/auth/me/skills", { skills: [{ slug: "writing", level: 4, appetite: 5 }] });
const refreshedSession = await call(student, "GET", "/api/auth/me");
if (refreshedSession.user.headline !== "Browser-verified teammate" || refreshedSession.user.capacity !== 9 || !refreshedSession.skills.some((skill) => skill.slug === "writing")) {
  throw new Error("profile or skills did not round-trip");
}

// Teacher class management: create, add roster, edit policy, preview groups, commit groups.
const createdClass = await call(teacher, "POST", "/api/classrooms", { name: "Write-path class", subject: "Systems", term: "Verification" });
const classId = createdClass.classroom.id;
await call(teacher, "POST", `/api/classrooms/${classId}/students`, { students: ["maya@equita.demo", "june@equita.demo"] });
await call(teacher, "PATCH", `/api/classrooms/${classId}`, { policy: { policy: { requireReview: false } } });
const classOverview = await call(teacher, "GET", `/api/classrooms/${classId}`);
const groupPreview = await call(teacher, "POST", `/api/classrooms/${classId}/groups/preview`, { size: 2, seed: 20261019 });
if (groupPreview.teams.length < 2) throw new Error("group preview returned fewer than two teams");
const groupCommit = await call(teacher, "POST", `/api/classrooms/${classId}/projects`, {
  name: "Write-path assignment",
  brief: "Make and explain the thing.",
  teams: groupPreview.teams.map((team) => ({ name: team.name, memberIds: team.members.map((member) => member.id) })),
  autoPlan: true,
  autoAssign: true,
});
if (!groupCommit.created.length) throw new Error("group commit created no projects");
const afterClass = await call(teacher, "GET", `/api/classrooms/${classId}`);
if (afterClass.projects.length < classOverview.projects.length + groupCommit.created.length) throw new Error("committed classroom groups did not appear in the overview");

// The notification write changes the unread count and is visible from the session.
const beforeNotifications = await call(student, "GET", "/api/insights/notifications");
await call(student, "POST", "/api/insights/notifications/read", { all: true });
const afterNotifications = await call(student, "GET", "/api/insights/notifications");
if (afterNotifications.unread !== 0 || afterNotifications.unread > beforeNotifications.unread) throw new Error("mark-all-read did not clear notifications");

// Work that is done or has hours against it cannot be removed by its author;
// only the lead or teacher may clear it.
const studentTask = await call(student, "POST", `/api/projects/${projectId}/tasks`, {
  title: "Student-authored task with credited hours",
  phase: "build",
  effort: 1,
  priority: 2,
  dueAt,
  required: [],
});
const studentTaskId = studentTask.task.id;
await call(teacher, "POST", `/api/tasks/${studentTaskId}/assign`, { userId: mayaId, force: true });
await call(teacher, "POST", `/api/tasks/${studentTaskId}/status`, { status: "doing" });
await call(teacher, "POST", `/api/tasks/${studentTaskId}/status`, { status: "done", actualEffort: 1 });
await call(student, "DELETE", `/api/tasks/${studentTaskId}`, undefined, [403]);
await call(teacher, "DELETE", `/api/tasks/${studentTaskId}`);

// Finally remove the temporary task to cover the destructive task path.
await call(teacher, "DELETE", `/api/tasks/${taskId}`);
const afterDelete = await call(teacher, "GET", `/api/projects/${projectId}`);
if (afterDelete.tasks.some((task) => task.id === taskId)) throw new Error("deleted task still appears on the board");

// The event stream is the live-update contract. Keep a student connected while
// the teacher writes a comment and require the addressed SSE frame to arrive.
const stream = await fetch(`${base}/events`, { headers: { cookie: sessions.get(student), accept: "text/event-stream" } });
if (!stream.body) throw new Error("the live event stream has no body");
const reader = stream.body.getReader();
const decoder = new TextDecoder();
const hello = decoder.decode((await reader.read()).value);
if (!hello.includes('"type":"hello"')) throw new Error("the live stream did not send its hello frame");
const liveComment = `live write ${Date.now()}`;
await call(teacher, "POST", `/api/tasks/${beforeWorkspace.tasks[0].id}/comments`, { body: `@Maya ${liveComment}` });
const event = await Promise.race([
  reader.read(),
  new Promise((_, reject) => setTimeout(() => reject(new Error("the addressed live event did not arrive")), 5000)),
]);
if (!decoder.decode(event.value).includes('"type":"comment"')) throw new Error("the live stream returned the wrong event");
await reader.cancel();

console.log("write-path passed: plan, tasks, assignment, ledger, project state, profile, class management, groups, notifications, and deletion");
await new Promise((resolve) => server.close(resolve));
