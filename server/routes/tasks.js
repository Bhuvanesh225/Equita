/**
 * Tasks: creating them, moving them, and the ledger entries that follow.
 *
 * The rule that matters here is that closing a task writes to the contribution
 * ledger with a real number of hours. That write is what every equity figure in
 * the product is built from, so it is never inferred later and never left to a
 * client to send.
 */
import { Router } from "express";
import { z } from "zod";
import { all, get, run, tx } from "../db.js";
import { newId, nowIso, round, json } from "../util.js";
import { requireAuth, canTeach } from "../auth.js";
import { parse, bad, deny, missing, taskRow, shapeTask, nameMap, isoDate, SkillRefs } from "../api.js";
import { loadProject, normaliseRequired } from "../engines/context.js";
import { computeEquity, recordSnapshot } from "../engines/equity.js";
import { rankCandidates } from "../engines/allocator.js";
import { record } from "../events.js";
import { SKILL_BY_SLUG } from "../data/skills.js";
import { access } from "./projects.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

function taskAccess(req, taskId) {
  const row = taskRow(taskId);
  const { row: project, memberRole, teaching, owner } = access(req, row.project_id);
  return { task: row, project, memberRole, teaching, owner };
}

const TaskInput = z.object({
  title: z.string().trim().min(2, "Give the task a name").max(160),
  detail: z.string().trim().max(3000).default(""),
  phase: z.enum(["discover", "define", "build", "review", "ship"]).default("build"),
  effort: z.coerce.number().min(0.25).max(80).default(2),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  dueAt: isoDate,
  required: SkillRefs,
  needsReview: z.coerce.boolean().optional(),
  deliverable: z.string().trim().max(500).default(""),
  assigneeId: z.string().trim().max(64).optional().nullable(),
  dependsOn: z.array(z.string()).max(20).optional(),
});

/** A patch changes only the fields it names: no defaults, so nothing is reset. */
const TaskPatch = z
  .object({
    title: z.string().trim().min(2, "Give the task a name").max(160),
    detail: z.string().trim().max(3000),
    phase: z.enum(["discover", "define", "build", "review", "ship"]),
    effort: z.coerce.number().min(0.25).max(80),
    priority: z.coerce.number().int().min(1).max(3),
    dueAt: isoDate,
    required: SkillRefs,
    needsReview: z.coerce.boolean(),
    deliverable: z.string().trim().max(500),
    assigneeId: z.string().trim().max(64).nullable(),
    dependsOn: z.array(z.string()).max(20),
  })
  .partial();

/** Create a task, optionally on the spot for somebody. */
tasksRouter.post("/projects/:id/tasks", (req, res) => {
  const { row: project } = access(req, req.params.id);
  const body = parse(TaskInput, req.body);
  const now = nowIso();
  const id = newId("tsk");

  const top = get(`SELECT MAX(position) AS p FROM tasks WHERE project_id = ?`, project.id)?.p ?? 0;
  const ctx = loadProject(project.id);
  const config = ctx?.config;

  if (body.assigneeId && config?.policy.enforceCapacity) {
    const equity = computeEquity(ctx);
    const member = equity.members.find((m) => m.id === body.assigneeId);
    if (member && member.open + body.effort > member.remainingCapacity) {
      const over = round(member.open + body.effort - member.remainingCapacity, 2);
      if (!req.body.force) {
        return res.status(409).json({
          error: `${member.name} already has ${member.open}h of open work and only ${member.remainingCapacity}h of time before the deadline. This would put them ${over}h past it.`,
          code: "capacity",
          over,
          member: { id: member.id, name: member.name, open: member.open, capacity: member.remainingCapacity },
        });
      }
    }
  }

  tx(() => {
    run(
      `INSERT INTO tasks (id, project_id, title, detail, phase, status, assignee_id, effort, priority, due_at, required_skills, depends_on,
                          deliverable, needs_review, position, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      project.id,
      body.title,
      body.detail,
      body.phase,
      body.assigneeId || null,
      body.effort,
      body.priority,
      body.dueAt ? new Date(body.dueAt).toISOString() : null,
      json(normaliseRequired(body.required), []),
      json(body.dependsOn ?? [], []),
      body.deliverable,
      body.needsReview ? 1 : 0,
      top + 1000,
      req.user.id,
      now,
      now,
    );
    run(`UPDATE projects SET updated_at = ? WHERE id = ?`, now, project.id);
    if (body.assigneeId) {
      run(
        `INSERT INTO assignments (id, project_id, task_id, user_id, kind, status, score, breakdown, rationale, created_by, created_at)
         VALUES (?, ?, ?, ?, 'manual', 'active', 0, '{}', ?, ?, ?)`,
        newId("asg"),
        project.id,
        id,
        body.assigneeId,
        `Added directly by ${req.user.name}.`,
        req.user.id,
        now,
      );
    }
  });

  record({
    verb: "task.created",
    subject: `${req.user.name} added “${body.title}” (${body.effort}h)`,
    projectId: project.id,
    actorId: req.user.id,
    meta: { taskId: id, effort: body.effort },
    notify: body.assigneeId
      ? [{ userId: body.assigneeId, title: `“${body.title}” is yours`, body: `${req.user.name} gave you a ${body.effort}h task.`, link: `/projects/${project.id}/board?task=${id}` }]
      : [],
  });

  res.status(201).json({ task: shapeTask(taskRow(id)) });
});

/** One task, with everything attached to it. */
tasksRouter.get("/tasks/:id", (req, res) => {
  const { task, project } = taskAccess(req, req.params.id);
  const ctx = loadProject(project.id);
  const comments = all(`SELECT * FROM comments WHERE task_id = ? ORDER BY created_at`, task.id);
  const names = nameMap([...comments.map((c) => c.author_id), task.assignee_id, task.created_by]);
  const contributions = all(`SELECT * FROM contributions WHERE task_id = ? ORDER BY created_at`, task.id);
  const equity = computeEquity(ctx);
  const hydrated = ctx.tasks.find((t) => t.id === task.id);

  res.json({
    task: {
      ...shapeTask(task),
      assigneeName: task.assignee_id ? names[task.assignee_id] : null,
      history: all(`SELECT * FROM assignments WHERE task_id = ? ORDER BY created_at`, task.id).map((a) => ({
        id: a.id,
        userId: a.user_id,
        userName: names[a.user_id] ?? a.user_id,
        kind: a.kind,
        status: a.status,
        score: a.score,
        rationale: a.rationale,
        breakdown: json(a.breakdown, {}),
        createdAt: a.created_at,
      })),
    },
    comments: comments.map((c) => ({ id: c.id, authorId: c.author_id, authorName: names[c.author_id], body: c.body, mentions: json(c.mentions, []), createdAt: c.created_at })),
    contributions: contributions.map((c) => ({ ...c, userName: names[c.user_id] })),
    requiredNames: normaliseRequired(task.required_skills).map((r) => ({ ...r, name: SKILL_BY_SLUG.get(r.slug)?.name ?? r.slug })),
    blockedBy: hydrated?.dependsOn
      .map((depId) => ctx.tasks.find((t) => t.id === depId))
      .filter((t) => t && t.status !== "done")
      .map((t) => ({ id: t.id, title: t.title, status: t.status })),
    candidates: rankCandidates(ctx, equity, hydrated, { limit: 5 }).candidates,
  });
});

tasksRouter.patch("/tasks/:id", (req, res) => {
  const { task, project, memberRole, teaching, owner } = taskAccess(req, req.params.id);
  const body = parse(TaskPatch, req.body);
  if (body.assigneeId !== undefined && (body.assigneeId || null) !== task.assignee_id) {
    bad("Use the assignment endpoint to change who does the task.");
  }
  const isLead = memberRole === "lead" || teaching || owner;
  const onTask = task.created_by === req.user.id || task.assignee_id === req.user.id;
  if (!isLead && !onTask) deny("Only the lead or the person on the task can change it.");
  if (!isLead) {
    const nextDue = body.dueAt ? new Date(body.dueAt).toISOString() : null;
    const changed = [
      body.effort !== undefined && body.effort !== task.effort && "effort",
      body.priority !== undefined && body.priority !== task.priority && "priority",
      body.dueAt !== undefined && nextDue !== task.due_at && "deadline",
      body.needsReview !== undefined && Boolean(body.needsReview) !== Boolean(task.needs_review) && "review rule",
      body.dependsOn !== undefined && JSON.stringify(body.dependsOn) !== JSON.stringify(json(task.depends_on, [])) && "dependencies",
      body.required !== undefined && JSON.stringify(normaliseRequired(body.required)) !== JSON.stringify(normaliseRequired(task.required_skills)) && "skills",
    ].filter(Boolean);
    if (changed.length) deny(`Only the lead can change a task's ${changed.join(", ")}.`);
  }

  const patch = [];
  const values = [];
  const push = (column, value) => {
    patch.push(`${column} = ?`);
    values.push(value);
  };
  if (body.title !== undefined) push("title", body.title);
  if (body.detail !== undefined) push("detail", body.detail);
  if (body.phase !== undefined) push("phase", body.phase);
  if (body.effort !== undefined) push("effort", body.effort);
  if (body.priority !== undefined) push("priority", body.priority);
  if (body.dueAt !== undefined) push("due_at", body.dueAt ? new Date(body.dueAt).toISOString() : null);
  if (body.required !== undefined) push("required_skills", json(normaliseRequired(body.required), []));
  if (body.deliverable !== undefined) push("deliverable", body.deliverable);
  if (body.needsReview !== undefined) push("needs_review", body.needsReview ? 1 : 0);
  if (body.dependsOn !== undefined) push("depends_on", json(body.dependsOn, []));
  if (!patch.length) return res.json({ task: shapeTask(task) });

  push("updated_at", nowIso());
  tx(() => {
    run(`UPDATE tasks SET ${patch.join(", ")} WHERE id = ?`, ...values, task.id);
    run(`UPDATE projects SET updated_at = ? WHERE id = ?`, nowIso(), project.id);
  });

  record({
    verb: "task.updated",
    subject: `${req.user.name} edited “${task.title}”`,
    projectId: project.id,
    actorId: req.user.id,
    meta: { taskId: task.id },
  });
  res.json({ task: shapeTask(taskRow(task.id)) });
});

tasksRouter.delete("/tasks/:id", (req, res) => {
  const { task, project, memberRole, teaching, owner } = taskAccess(req, req.params.id);
  const isLead = memberRole === "lead" || teaching || owner;
  if (!isLead && task.created_by !== req.user.id) deny("Only the lead or whoever added it can delete it.");
  const credited = get(`SELECT 1 FROM contributions WHERE task_id = ?`, task.id);
  if (!isLead && (task.status === "done" || credited)) deny("Only the lead can delete work that is done or has hours against it.");
  tx(() => {
    run(`DELETE FROM tasks WHERE id = ?`, task.id);
    for (const row of all(`SELECT id, depends_on FROM tasks WHERE project_id = ?`, project.id)) {
      const deps = json(row.depends_on, []);
      if (deps.includes(task.id)) {
        run(`UPDATE tasks SET depends_on = ? WHERE id = ?`, json(deps.filter((id) => id !== task.id), []), row.id);
      }
    }
  });
  record({ verb: "task.deleted", subject: `${req.user.name} deleted “${task.title}”`, projectId: project.id, actorId: req.user.id });
  res.json({ ok: true });
});

/* ---------- status ------------------------------------------------------- */

const StatusInput = z.object({
  status: z.enum(["todo", "doing", "review", "blocked", "done"]),
  note: z.string().trim().max(600).default(""),
  actualEffort: z.coerce.number().min(0).max(80).optional(),
  deliverable: z.string().trim().max(500).optional(),
  verifiedBy: z.string().trim().max(64).optional(),
  force: z.coerce.boolean().optional(),
});

/**
 * Move a task. Everything that must accompany a move — a reason for blocking,
 * a second pair of eyes before closing, the ledger entry — is enforced here
 * rather than trusted to the caller.
 */
tasksRouter.post("/tasks/:id/status", (req, res) => {
  const { task, project, memberRole, teaching, owner } = taskAccess(req, req.params.id);
  const body = parse(StatusInput, req.body);
  const ctx = loadProject(project.id);
  const config = ctx.config;
  const now = nowIso();
  const isAssignee = task.assignee_id === req.user.id;
  const canOverride = memberRole === "lead" || teaching || owner;

  if (task.status === body.status) return res.json({ task: shapeTask(task), unchanged: true });
  if (body.force && !canOverride) deny("Only the lead can override the review rule or the dependencies.");

  if (body.status === "blocked" && !body.note.trim()) {
    bad("Say what it is blocked on. A blocked task with no reason is just a stopped task.");
  }

  // The rule that makes review mean something.
  if (body.status === "done" && task.needs_review && config.policy.requireReview && isAssignee && !canOverride && !body.force) {
    return res.status(409).json({
      error: "This project asks for a second pair of eyes before a task closes. Move it to review and let someone else close it.",
      code: "needs-review",
    });
  }
  if (body.status === "done" && task.needs_review && config.policy.requireReview && isAssignee && !canOverride && body.force && !body.verifiedBy) {
    bad("Closing your own reviewed task needs somebody named as the reviewer.");
  }

  const patch = ["status = ?", "updated_at = ?"];
  const values = [body.status, now];
  if (body.status === "doing" && !task.started_at) {
    patch.push("started_at = ?");
    values.push(now);
  }
  if (body.status === "done") {
    patch.push("completed_at = ?");
    values.push(now);
  } else if (task.status === "done") {
    patch.push("completed_at = NULL");
  }
  if (body.deliverable !== undefined) {
    patch.push("deliverable = ?");
    values.push(body.deliverable);
  }

  const effort = body.actualEffort ?? task.effort;
  // `task` here is the raw SQLite row from `taskAccess`, so the JSON column is
  // still named `depends_on`. The hydrated engine shape uses `dependsOn`; using
  // that client-side name here made closing any newly-created task crash the
  // server instead of returning the intended dependency refusal.
  const blockedBy = json(task.depends_on, [])
    .map((depId) => ctx.tasks.find((t) => t.id === depId))
    .filter((t) => t && t.status !== "done");
  if (body.status === "done" && blockedBy.length && !body.force) {
    return res.status(409).json({
      error: `“${blockedBy[0].title}” is still open, and this waits on it.`,
      code: "dependency",
      blockedBy: blockedBy.map((t) => ({ id: t.id, title: t.title, status: t.status })),
    });
  }

  tx(() => {
    run(`UPDATE tasks SET ${patch.join(", ")} WHERE id = ?`, ...values, task.id);
    run(`UPDATE projects SET updated_at = ? WHERE id = ?`, now, project.id);

    if (body.status === "done") {
      // The single most important write in the product. A task earns its hours
      // once: reopening it to add a fix must not credit the same work twice.
      const credited = get(`SELECT 1 FROM contributions WHERE task_id = ? AND kind = 'complete'`, task.id);
      if (!credited) {
        run(
          `INSERT INTO contributions (id, project_id, task_id, user_id, kind, effort, note, verified_by, created_at)
           VALUES (?, ?, ?, ?, 'complete', ?, ?, ?, ?)`,
          newId("con"),
          project.id,
          task.id,
          task.assignee_id ?? req.user.id,
          effort,
          body.note || `completed “${task.title}”`,
          body.verifiedBy ?? null,
          now,
        );
      }
    } else if (body.status === "blocked") {
      run(
        `INSERT INTO contributions (id, project_id, task_id, user_id, kind, effort, note, created_at)
         VALUES (?, ?, ?, ?, 'unblock', 0, ?, ?)`,
        newId("con"),
        project.id,
        task.id,
        req.user.id,
        `blocked: ${body.note}`,
        now,
      );
    }
  });

  const verb = `task.${body.status}`;
  const subjects = {
    doing: `${req.user.name} started “${task.title}”`,
    done: `${req.user.name} finished “${task.title}” (${effort}h)`,
    review: `${req.user.name} put “${task.title}” up for review`,
    blocked: `${req.user.name} marked “${task.title}” blocked: ${body.note}`,
    todo: `${req.user.name} moved “${task.title}” back to the queue`,
  };

  record({
    verb,
    subject: subjects[body.status] ?? `${req.user.name} moved “${task.title}”`,
    projectId: project.id,
    actorId: req.user.id,
    meta: { taskId: task.id, status: body.status, effort: body.status === "done" ? effort : undefined },
    notify:
      body.status === "review"
        ? ctx.members
            .filter((m) => m.id !== req.user.id)
            .slice(0, 6)
            .map((m) => ({ userId: m.id, title: `“${task.title}” needs a second pair of eyes`, body: `${req.user.name} says it is done. Close it if you agree.`, link: `/projects/${project.id}/board?task=${task.id}` }))
        : body.status === "blocked"
          ? ctx.members
              .filter((m) => m.id !== req.user.id && m.role === "lead")
              .map((m) => ({ userId: m.id, title: `“${task.title}” is blocked`, body: body.note, link: `/projects/${project.id}/board?task=${task.id}` }))
          : [],
  });

  // A material change is worth a point on the trend line.
  if (body.status === "done") {
    const fresh = loadProject(project.id);
    recordSnapshot(fresh, computeEquity(fresh));
  }

  res.json({ task: shapeTask(taskRow(task.id)), credited: body.status === "done" ? round(effort, 2) : 0 });
});

/* ---------- assignment --------------------------------------------------- */

const AssignInput = z.object({
  userId: z.string().trim().max(64).nullable(),
  note: z.string().trim().max(400).default(""),
  acceptSuggestion: z.coerce.boolean().optional(),
  force: z.coerce.boolean().optional(),
  breakdown: z.record(z.string(), z.unknown()).optional(),
});

tasksRouter.post("/tasks/:id/assign", (req, res) => {
  const { task, project, memberRole, teaching, owner } = taskAccess(req, req.params.id);
  const body = parse(AssignInput, req.body);
  const ctx = loadProject(project.id);
  const isLead = memberRole === "lead" || teaching || owner;
  const isAssignee = task.assignee_id === req.user.id;
  if (!isLead && body.userId && body.userId !== req.user.id) deny("Only the lead can hand work to somebody else.");
  if (!isLead && body.userId !== req.user.id && !isAssignee) deny("That task belongs to somebody else. Ask the lead.");
  if (!isLead && body.force) deny("Only the lead can override capacity.");

  if (body.userId && !ctx.members.some((m) => m.id === body.userId)) bad("That person is not on this project.");

  let warning = null;
  if (body.userId && ctx.config.policy.enforceCapacity) {
    const equity = computeEquity(ctx);
    const member = equity.members.find((m) => m.id === body.userId);
    if (member && member.open + task.effort > member.remainingCapacity) {
      const over = round(member.open + task.effort - member.remainingCapacity, 2);
      if (!body.force) {
        return res.status(409).json({
          error: `${member.name} would be ${over}h past what they can finish before the deadline.`,
          code: "capacity",
          over,
        });
      }
      warning = `${member.name} is now ${over}h past capacity.`;
    }
  }

  const previous = task.assignee_id;
  const now = nowIso();
  tx(() => {
    run(`UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE id = ?`, body.userId, now, task.id);
    run(`UPDATE projects SET updated_at = ? WHERE id = ?`, now, project.id);
    if (previous && previous !== body.userId) {
      run(`UPDATE assignments SET status = 'superseded' WHERE task_id = ? AND status IN ('active', 'accepted')`, task.id);
    }
    if (body.userId) {
      run(
        `INSERT INTO assignments (id, project_id, task_id, user_id, kind, status, score, breakdown, rationale, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
        newId("asg"),
        project.id,
        task.id,
        body.userId,
        body.acceptSuggestion ? "auto" : "manual",
        Number(req.body.score ?? 0),
        json(body.breakdown ?? {}, {}),
        body.note || (body.acceptSuggestion ? "Accepted from a suggestion." : `${req.user.name} assigned it directly.`),
        req.user.id,
        now,
      );
    }
  });

  if (body.userId && body.userId !== previous) {
    record({
      verb: "task.assigned",
      subject: `${req.user.name} gave “${task.title}” to ${ctx.members.find((m) => m.id === body.userId)?.name}`,
      projectId: project.id,
      actorId: req.user.id,
      meta: { taskId: task.id, userId: body.userId },
      notify: body.userId !== req.user.id ? [{ userId: body.userId, title: `“${task.title}” is yours`, body: `${task.effort}h${task.dueAt ? `, due ${new Date(task.dueAt).toDateString()}` : ""}.`, link: `/projects/${project.id}/board?task=${task.id}` }] : [],
    });
  } else if (!body.userId && previous) {
    record({
      verb: "task.unassigned",
      subject: `${req.user.name} took “${task.title}” off ${ctx.members.find((m) => m.id === previous)?.name}`,
      projectId: project.id,
      actorId: req.user.id,
      meta: { taskId: task.id },
      notify: [{ userId: previous, title: `“${task.title}” was taken off your list`, body: `${req.user.name} unassigned it.`, link: `/projects/${project.id}` }],
    });
  }

  res.json({ task: shapeTask(taskRow(task.id)), warning });
});

/* ---------- comments and logged help ------------------------------------ */

tasksRouter.post("/tasks/:id/comments", (req, res) => {
  const { task, project } = taskAccess(req, req.params.id);
  const body = parse(z.object({ body: z.string().trim().min(1, "Write something").max(2000) }), req.body);
  const mentions = [...body.body.matchAll(/@([\p{L}][\p{L}\d'’.-]*)/gu)].map((m) => m[1].toLowerCase());
  const id = newId("cmt");
  run(
    `INSERT INTO comments (id, project_id, task_id, author_id, body, mentions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    project.id,
    task.id,
    req.user.id,
    body.body,
    json(mentions, []),
    nowIso(),
  );

  const ctx = loadProject(project.id);
  const notified = ctx.members.filter((m) => m.id !== req.user.id && mentions.some((mention) => m.name.toLowerCase().startsWith(mention)));
  if (mentions.length) {
    record({
      verb: "comment",
      subject: `${req.user.name} commented on “${task.title}”`,
      projectId: project.id,
      actorId: req.user.id,
      meta: { taskId: task.id },
      notify: notified.map((m) => ({ userId: m.id, title: `${req.user.name} mentioned you`, body: body.body.slice(0, 160), link: `/projects/${project.id}/board?task=${task.id}` })),
    });
  } else {
    record({ verb: "comment", subject: `${req.user.name} commented on “${task.title}”`, projectId: project.id, actorId: req.user.id, meta: { taskId: task.id }, quiet: true });
  }

  res.status(201).json({ id, createdAt: nowIso() });
});

/** Log work that is not one of your own tasks: helping somebody else. */
tasksRouter.post("/tasks/:id/log", (req, res) => {
  const { task, project } = taskAccess(req, req.params.id);
  const body = parse(
    z.object({ hours: z.coerce.number().min(0.25).max(40), note: z.string().trim().max(400).default("") }),
    req.body,
  );
  run(
    `INSERT INTO contributions (id, project_id, task_id, user_id, kind, effort, note, created_at) VALUES (?, ?, ?, ?, 'help', ?, ?, ?)`,
    newId("con"),
    project.id,
    task.id,
    req.user.id,
    body.hours,
    body.note || `helped with “${task.title}”`,
    nowIso(),
  );
  record({
    verb: "task.helped",
    subject: `${req.user.name} put ${body.hours}h into “${task.title}”`,
    projectId: project.id,
    actorId: req.user.id,
    meta: { taskId: task.id, hours: body.hours },
  });
  res.status(201).json({ ok: true });
});

export { missing };
