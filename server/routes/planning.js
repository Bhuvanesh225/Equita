/**
 * The intelligence endpoints: planning a project from its brief, and deciding
 * who should do what.
 *
 * Both of them are two-step on purpose. The POST without `apply` returns a
 * proposal that changes nothing, and the POST with `apply` writes it. Nobody
 * should ever discover that pressing a button re-wrote their board.
 */
import { Router } from "express";
import { z } from "zod";
import { all, get, run, tx } from "../db.js";
import { newId, nowIso, json, round } from "../util.js";
import { requireAuth } from "../auth.js";
import { parse, bad, deny, isoDate, SkillRefs, shapeTask } from "../api.js";
import { loadProject, normaliseRequired } from "../engines/context.js";
import { computeEquity, recordSnapshot } from "../engines/equity.js";
import { planProject } from "../engines/planner.js";
import { autoAssign, bestFor, rankCandidates } from "../engines/allocator.js";
import { record } from "../events.js";
import { projectNudges } from "../engines/nudges.js";
import { SKILL_BY_SLUG } from "../data/skills.js";
import { access } from "./projects.js";

export const planningRouter = Router();
planningRouter.use(requireAuth);

const PlanInput = z.object({
  brief: z.string().trim().max(6000).optional(),
  dueAt: isoDate,
  utilisation: z.coerce.number().min(0.2).max(1).default(0.6),
  members: z.coerce.number().int().min(1).max(40).optional(),
});

/** What the brief implies, without touching anything. */
planningRouter.post("/projects/:id/plan", (req, res) => {
  const { row } = access(req, req.params.id);
  const body = parse(PlanInput, req.body);
  const ctx = loadProject(req.params.id);
  const brief = body.brief ?? row.brief ?? "";
  const dueAt = body.dueAt ? new Date(body.dueAt).toISOString() : row.due_at;
  const members = body.members ?? ctx.members.length ?? 1;
  const totalCapacity = ctx.members.reduce((a, m) => a + m.capacity, 0) || members * 8;

  const plan = planProject({
    brief,
    members,
    totalCapacity,
    dueAt,
    utilisation: body.utilisation,
  });

  const existingTitles = new Set(ctx.tasks.map((t) => t.title.toLowerCase()));
  for (const task of plan.tasks) {
    task.required = task.required.map((r) => ({ ...r, name: SKILL_BY_SLUG.get(r.slug)?.name ?? r.slug }));
    task.duplicate = existingTitles.has(task.title.toLowerCase());
  }

  const equity = computeEquity(ctx);
  res.json({
    plan,
    context: {
      brief,
      dueAt,
      members,
      totalCapacity: round(totalCapacity, 1),
      existingTasks: ctx.tasks.length,
      evenShareHours: plan.tasks.length ? round(plan.meta.totalHours / Math.max(1, members), 1) : 0,
      currentEvenShare: round(equity.totals.committed / Math.max(1, members), 2),
    },
  });
});

const ApplyPlan = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(160),
        detail: z.string().trim().max(3000).default(""),
        phase: z.enum(["discover", "define", "build", "review", "ship"]).default("build"),
        effort: z.coerce.number().min(0.25).max(80),
        priority: z.coerce.number().int().min(1).max(3).default(2),
        dueAt: isoDate,
        required: SkillRefs,
        needsReview: z.coerce.boolean().optional(),
      }),
    )
    .max(60),
  brief: z.string().trim().max(6000).optional(),
  autoAssign: z.coerce.boolean().optional(),
});

/** Write the plan the user actually confirmed. */
planningRouter.post("/projects/:id/plan/apply", (req, res) => {
  const { row, memberRole, teaching, owner } = access(req, req.params.id);
  if (!(memberRole === "lead" || teaching || owner)) deny("Only the lead or the teacher can add a plan to this project.");
  const body = parse(ApplyPlan, req.body);
  if (!body.tasks.length) bad("There is nothing to add.");

  const ctx = loadProject(req.params.id);
  const now = nowIso();
  const top = get(`SELECT MAX(position) AS p FROM tasks WHERE project_id = ?`, row.id)?.p ?? 0;
  const created = [];

  tx(() => {
    body.tasks.forEach((task, index) => {
      const id = newId("tsk");
      run(
        `INSERT INTO tasks (id, project_id, title, detail, phase, status, effort, priority, due_at, required_skills,
                            deliverable, needs_review, position, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, '', ?, ?, ?, ?, ?)`,
        id,
        row.id,
        task.title,
        task.detail,
        task.phase,
        task.effort,
        task.priority,
        task.dueAt ? new Date(task.dueAt).toISOString() : null,
        json(normaliseRequired(task.required), []),
        task.needsReview ? 1 : 0,
        top + (index + 1) * 1000,
        req.user.id,
        now,
        now,
      );
      created.push(id);
    });
    if (body.brief !== undefined) run(`UPDATE projects SET brief = ? WHERE id = ?`, body.brief, row.id);
    run(`UPDATE projects SET updated_at = ? WHERE id = ?`, now, row.id);
    const plain = body.tasks.map((task, index) => ({ id: created[index], phase: task.phase }));
    const shipIds = plain.filter((t) => t.phase === "ship").map((t) => t.id);
    const earlierIds = plain.filter((t) => t.phase !== "ship").map((t) => t.id);
    // Nothing is submitted before the pieces it is made of exist. Only the ship
    // phase gets dependencies: linking everything to everything makes a board
    // that is impossible to read and impossible to start.
    if (shipIds.length && earlierIds.length) {
      run(
        `UPDATE tasks SET depends_on = ? WHERE project_id = ? AND id IN (${shipIds.map(() => "?").join(",")})`,
        json(earlierIds, []),
        row.id,
        ...shipIds,
      );
    }
  });

  record({
    verb: "plan.applied",
    subject: `${req.user.name} planned ${created.length} tasks from the brief`,
    projectId: row.id,
    actorId: req.user.id,
    meta: { created: created.length },
  });

  let assigned = null;
  if (body.autoAssign) {
    const fresh = loadProject(row.id);
    assigned = applyAutoAssign(req, fresh, {});
  }

  const fresh = loadProject(row.id);
  recordSnapshot(fresh, computeEquity(fresh));
  res.status(201).json({ created: created.length, taskIds: created, assigned });
});

/* ---------- auto-assignment --------------------------------------------- */

const AutoInput = z.object({
  apply: z.coerce.boolean().default(false),
  floor: z.coerce.number().min(0).max(100).optional(),
  taskIds: z.array(z.string()).max(80).optional(),
  onlyUnassigned: z.coerce.boolean().default(true),
});

planningRouter.post("/projects/:id/assign/auto", (req, res) => {
  const { row, memberRole, teaching, owner } = access(req, req.params.id);
  if (!(memberRole === "lead" || teaching || owner)) deny("Only the lead or the teacher can assign work.");
  const body = parse(AutoInput, req.body);
  const ctx = loadProject(req.params.id);
  if (!ctx.members.length) bad("There is nobody on this project yet.");

  let pool = ctx.tasks;
  if (body.onlyUnassigned) pool = pool.filter((t) => !t.assigneeId);
  if (body.taskIds?.length) pool = ctx.tasks.filter((t) => body.taskIds.includes(t.id));
  if (!pool.length) {
    return res.json({ result: { assignments: [], unassigned: [], notes: ["Every task already has an owner."], balance: null, load: [] }, applied: false });
  }

  const equity = computeEquity(ctx);
  const result = autoAssign(ctx, equity, { tasks: pool, floor: body.floor ?? 26 });

  if (!body.apply) {
    return res.json({ result, applied: false, note: "This is a proposal. Nothing has been written to the board yet." });
  }

  const applied = applyAutoAssign(req, ctx, { result, pool });
  res.json({ result, applied: true, written: applied });
});

/** Write an auto-assignment result to the board. Shared by both routes. */
function applyAutoAssign(req, ctx, { result, pool }) {
  const computed = result ?? autoAssign(ctx, computeEquity(ctx), { tasks: pool ?? ctx.tasks.filter((t) => !t.assigneeId) });
  const now = nowIso();
  const byId = new Map(ctx.members.map((m) => [m.id, m]));
  let written = 0;

  tx(() => {
    for (const item of computed.assignments) {
      if (!byId.has(item.userId)) continue;
      run(`UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE id = ?`, item.userId, now, item.taskId);
      run(
        `INSERT INTO assignments (id, project_id, task_id, user_id, kind, status, score, breakdown, rationale, created_by, created_at)
         VALUES (?, ?, ?, ?, 'auto', 'accepted', ?, ?, ?, ?, ?)`,
        newId("asg"),
        ctx.project.id,
        item.taskId,
        item.userId,
        item.score,
        json(item.parts ?? {}, {}),
        item.rationale,
        req.user.id,
        now,
      );
      written++;
    }
    run(`UPDATE projects SET updated_at = ? WHERE id = ?`, now, ctx.project.id);
  });

  if (written) {
    const grouped = new Map();
    for (const item of computed.assignments) {
      const list = grouped.get(item.userId) ?? [];
      list.push(item.taskTitle);
      grouped.set(item.userId, list);
    }
    record({
      verb: "assignment.auto",
      subject: `${req.user.name} let Equita place ${written} task${written === 1 ? "" : "s"}`,
      projectId: ctx.project.id,
      actorId: req.user.id,
      meta: { written, giniAfter: computed.balance?.giniAfter },
      notify: computed.assignments.map((item) => ({
        userId: item.userId,
        title: `Equita put “${item.taskTitle}” on your list`,
        body: item.rationale,
        link: `/projects/${ctx.project.id}/board?task=${item.taskId}`,
      })),
    });
  }

  return { written, notes: computed.notes, balance: computed.balance };
}

/* ---------- who-should-do-this ------------------------------------------ */

planningRouter.get("/projects/:id/assign/:taskId", (req, res) => {
  access(req, req.params.id);
  const ctx = loadProject(req.params.id);
  const task = ctx.tasks.find((t) => t.id === req.params.taskId);
  if (!task) bad("That task is not on this project.");
  const equity = computeEquity(ctx);
  const ranked = bestFor(ctx, equity, task);
  res.json({
    ...ranked,
    requiredNames: task.required.map((r) => ({ ...r, name: SKILL_BY_SLUG.get(r.slug)?.name ?? r.slug })),
    assigneeId: task.assigneeId,
  });
});

/* ---------- rebalancing ------------------------------------------------- */

const Rebalance = z.object({
  taskId: z.string().min(1),
  toId: z.string().min(1).nullable(),
  note: z.string().trim().max(400).default(""),
});

/**
 * Apply one suggested move. The suggestion's own numbers are attached to the
 * ledger entry, so in three weeks the team can see not just that a task moved
 * but what it was expected to fix.
 */
planningRouter.post("/projects/:id/rebalance/apply", (req, res) => {
  const { row, memberRole, teaching, owner } = access(req, req.params.id);
  if (!(memberRole === "lead" || teaching || owner)) deny("Only the lead or the teacher can move work between people.");
  const body = parse(Rebalance, req.body);
  const ctx = loadProject(req.params.id);
  const task = ctx.tasks.find((t) => t.id === body.taskId);
  if (!task) bad("That task is not on this project.");
  if (body.toId && !ctx.members.some((m) => m.id === body.toId)) bad("That person is not on this project.");

  const equity = computeEquity(ctx);
  const move = equity.suggestions.find((s) => s.taskId === body.taskId && s.toId === body.toId);
  const target = body.toId ? ctx.members.find((m) => m.id === body.toId) : null;
  const from = task.assigneeId ? ctx.members.find((m) => m.id === task.assigneeId) : null;
  const now = nowIso();

  if (target && ctx.config.policy.enforceCapacity) {
    const member = equity.members.find((m) => m.id === target.id);
    if (member && member.open + task.effort > member.remainingCapacity && !move) {
      bad(`${target.name} does not have ${task.effort}h of room before the deadline.`);
    }
  }

  tx(() => {
    run(`UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE id = ?`, body.toId, now, task.id);
    run(`UPDATE projects SET updated_at = ? WHERE id = ?`, now, row.id);
    run(`UPDATE assignments SET status = 'superseded' WHERE task_id = ? AND status = 'active'`, task.id);
    run(
      `INSERT INTO assignments (id, project_id, task_id, user_id, kind, status, score, breakdown, rationale, created_by, created_at)
       VALUES (?, ?, ?, ?, 'rebalanced', 'accepted', ?, ?, ?, ?, ?)`,
      newId("asg"),
      row.id,
      task.id,
      body.toId,
      move?.fitScore ?? 0,
      json({ improvement: move?.improvement ?? null, reason: move?.reason ?? null }, {}),
      body.note || move?.reason || `Moved off ${from?.name ?? "nobody"} to even the load.`,
      req.user.id,
      now,
    );
  });

  record({
    verb: "task.rebalanced",
    subject: target
      ? `${req.user.name} moved “${task.title}” from ${from?.name ?? "unassigned"} to ${target.name}`
      : `${req.user.name} took “${task.title}” off ${from?.name ?? "the board"}`,
    projectId: row.id,
    actorId: req.user.id,
    meta: { taskId: task.id, toId: body.toId, expectedImprovement: move?.improvement ?? null },
    notify: body.toId
      ? [{ userId: body.toId, title: `“${task.title}” moved to you`, body: move?.reason ?? `${req.user.name} evened out the load.`, link: `/projects/${row.id}/board?task=${task.id}` }]
      : [],
  });

  const fresh = loadProject(row.id);
  const after = computeEquity(fresh);
  recordSnapshot(fresh, after);
  res.json({ task: shapeTask(get(`SELECT * FROM tasks WHERE id = ?`, task.id)), equity: after, expectedImprovement: move?.improvement ?? null });
});

/** Every nudge for one project, for the person asking. */
planningRouter.get("/projects/:id/nudges", (req, res) => {
  access(req, req.params.id);
  const ctx = loadProject(req.params.id);
  const equity = computeEquity(ctx);
  res.json({ nudges: projectNudges(ctx, equity, req.user.id) });
});

export { all };