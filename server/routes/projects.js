/**
 * Projects: the team, the board, the ledger.
 *
 * GET /:id is deliberately one call that returns everything the workspace needs.
 * A project page renders from a single round trip, and every live event simply
 * refetches it, which means there is exactly one definition of what a project
 * looks like and no chance of two panels showing different numbers.
 */
import { Router } from "express";
import { z } from "zod";
import { all, get, run, tx, bool } from "../db.js";
import { newId, nowIso, json, round, weekKey, clamp } from "../util.js";
import { requireAuth, canTeach } from "../auth.js";
import {
  parse,
  bad,
  deny,
  missing,
  projectRow,
  shapeProject,
  shapeTask,
  shapeActivity,
  nameMap,
  hueMap,
  isoDate,
  projectMemberIds,
} from "../api.js";
import { addProjectMembers } from "../people.js";
import { DEFAULT_CONFIG, mergeConfig, loadProject, normaliseRequired } from "../engines/context.js";
import { computeEquity, equityHistory, recordSnapshot, requiredSkillDemand } from "../engines/equity.js";
import { projectNudges, summarise } from "../engines/nudges.js";
import { clusterStrength, topSkills } from "../engines/profiles.js";
import { record } from "../events.js";
import { SKILL_BY_SLUG } from "../data/skills.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

/** Load a project and prove the caller is allowed to see it. */
export function access(req, projectId, { needTeach = false } = {}) {
  const row = projectRow(projectId);
  const userId = req.user.id;
  const memberRole = get(`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`, projectId, userId)?.role ?? null;
  const teaching = row.classroom_id ? canTeach(userId, row.classroom_id) : false;
  const owner = row.owner_id === userId;
  if (needTeach && !teaching && !owner) deny("Only the teacher or the project owner can do that.");
  if (!memberRole && !teaching && !owner) deny("You are not on this project.");
  return { row, memberRole, teaching, owner };
}

const asMap = (list) => new Map(list.map((s) => [s.slug, s]));

function memberShape(userId, role, capacity) {
  const user = get(`SELECT * FROM users WHERE id = ?`, userId);
  if (!user) return null;
  const skills = all(`SELECT skill_id, level, appetite FROM user_skills WHERE user_id = ?`, userId).map((row) => ({
    slug: String(row.skill_id).replace(/^skl_/, ""),
    level: row.level,
    appetite: row.appetite,
  }));
  const profile = { id: user.id, name: user.name, skills: asMap(skills) };
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    hue: user.hue,
    headline: user.headline,
    capacity: capacity ?? user.capacity,
    status: user.status,
    skills,
    topSkills: topSkills(profile, 5),
    clusters: clusterStrength(profile).slice(0, 3),
  };
}

/* ---------- list and create ---------------------------------------------- */

projectsRouter.get("/", (req, res) => {
  const rows = all(
    `SELECT DISTINCT p.* FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN enrollments e ON e.classroom_id = p.classroom_id AND e.user_id = ?
      WHERE (pm.user_id = ? OR e.role IN ('teacher', 'assistant') OR p.owner_id = ?) AND p.status != 'archived'
      ORDER BY p.updated_at DESC`,
    req.user.id,
    req.user.id,
    req.user.id,
  );

  const projects = rows.map((row) => {
    const ctx = loadProject(row.id);
    const equity = ctx ? computeEquity(ctx) : null;
    const me = equity?.members.find((m) => m.id === req.user.id) ?? null;
    const openTasks = ctx ? ctx.tasks.filter((t) => t.status !== "done") : [];
    const mine = openTasks.filter((t) => t.assigneeId === req.user.id);
    const nextDue = mine.map((t) => t.dueAt).filter(Boolean).sort()[0] ?? null;
    return {
      ...shapeProject(row),
      memberCount: ctx?.members.length ?? 0,
      taskCount: ctx?.tasks.length ?? 0,
      openCount: openTasks.length,
      myOpen: mine.length,
      myNextDue: nextDue,
      equity: equity
        ? {
            score: equity.score,
            gini: equity.distribution.gini,
            parts: equity.parts,
            /* The weights are what turn the five parts into the score. The
             * fairness screen prints them beside each part. */
            weights: equity.weights,
            headline: equity.headline,
            daysLeft: equity.timeline.daysLeft,
          }
        : null,
      myShare: me ? { committed: me.committed, credited: me.credited, even: me.even.committed, state: me.state } : null,
      unassigned: equity?.totals.unassigned ?? 0,
    };
  });

  res.json({ projects });
});

const CreateProject = z.object({
  name: z.string().trim().min(2, "Give the project a name").max(120),
  brief: z.string().trim().max(4000).default(""),
  dueAt: isoDate,
  classroomId: z.string().trim().max(64).optional().nullable(),
  members: z.array(z.union([z.string(), z.object({ email: z.string(), name: z.string().optional() })])).max(40).optional(),
  teamSize: z.coerce.number().int().min(1).max(12).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

projectsRouter.post("/", (req, res) => {
  const body = parse(CreateProject, req.body);
  const now = nowIso();
  const id = newId("prj");
  const mode = body.classroomId ? "class" : "standalone";

  if (body.classroomId) {
    if (!canTeach(req.user.id, body.classroomId)) deny("Only a teacher of that class can start an assignment in it.");
  }

  tx(() => {
    run(
      `INSERT INTO projects (id, name, brief, mode, classroom_id, owner_id, status, due_at, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      id,
      body.name,
      body.brief,
      mode,
      body.classroomId || null,
      req.user.id,
      body.dueAt ? new Date(body.dueAt).toISOString() : null,
      json({ ...DEFAULT_CONFIG, ...(body.config || {}) }, {}),
      now,
      now,
    );
    run(`INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'lead', ?)`, id, req.user.id, now);
  });

  const added = body.members?.length ? addProjectMembers(id, body.members) : [];

  record({
    verb: "project.created",
    subject: `${req.user.name} started “${body.name}”`,
    projectId: id,
    actorId: req.user.id,
    meta: { projectId: id },
    notify: added.filter((a) => !a.alreadyMember).map((a) => ({ userId: a.id, title: `You were added to “${body.name}”`, body: `${req.user.name} put you on the team.`, link: `/projects/${id}` })),
  });

  res.status(201).json({ project: shapeProject(projectRow(id)), members: added });
});

/* ---------- one project, in full ---------------------------------------- */

projectsRouter.get("/:id", (req, res) => {
  const { row, memberRole, teaching, owner } = access(req, req.params.id);
  const ctx = loadProject(req.params.id);
  if (!ctx) missing("That project does not exist.");
  const equity = computeEquity(ctx);
  const viewerId = req.user.id;

  const isLead = memberRole === "lead" || owner || teaching;
  const tasks = ctx.tasks.map((task) => ({
    ...task,
    assigneeName: ctx.members.find((m) => m.id === task.assigneeId)?.name ?? null,
    assigneeHue: ctx.members.find((m) => m.id === task.assigneeId)?.hue ?? null,
    blockedBy: task.dependsOn
      .map((depId) => ctx.tasks.find((t) => t.id === depId))
      .filter((t) => t && t.status !== "done")
      .map((t) => ({ id: t.id, title: t.title })),
  }));

  const activity = ctx.activity.slice(0, 60);
  const names = hueMap([...activity.map((a) => a.actorId), ...ctx.members.map((m) => m.id)]);

  const checkins = ctx.checkins.slice(0, 40).map((c) => ({ ...c, name: names[c.userId]?.name ?? null, hue: names[c.userId]?.hue ?? null }));
  const latestCheckin = new Map();
  for (const c of checkins) if (!latestCheckin.has(c.userId)) latestCheckin.set(c.userId, c);

  const reviews = ctx.reviews.map((r) => ({
    ...r,
    reviewerName: names[r.reviewerId]?.name ?? null,
    subjectName: names[r.subjectId]?.name ?? null,
  }));
  const myReviews = reviews.filter((r) => r.reviewerId === viewerId);
  const awaitingMyReview = ctx.members
    .filter((m) => m.id !== viewerId)
    .filter((m) => !myReviews.some((r) => r.subjectId === m.id))
    .map((m) => ({ id: m.id, name: m.name, hue: m.hue }));

  const nudges = projectNudges(ctx, equity, viewerId);

  res.json({
    project: { ...ctx.project, config: ctx.config },
    config: ctx.config,
    members: ctx.members.map((m) => memberShape(m.id, m.role, m.capacity)),
    tasks,
    equity,
    history: equityHistory(req.params.id),
    activity: activity.map((a) => shapeActivity(a, Object.fromEntries(Object.entries(names).map(([id, v]) => [id, v.name])))),
    comments: ctx.comments.slice(-80).map((c) => ({ ...c, authorHue: names[c.authorId]?.hue ?? null })),
    checkins,
    latestCheckin: Object.fromEntries([...latestCheckin.entries()].map(([id, c]) => [id, c])),
    // The full list is the teacher's view. A teammate sees the reviews they
    // wrote and who still needs one; another person's note is not theirs to read.
    reviews: { all: teaching || owner ? reviews : myReviews, mine: myReviews, awaiting: awaitingMyReview },
    nudges,
    nudgeCounts: summarise(nudges),
    insights: {
      demand: requiredSkillDemand(ctx.tasks).map((d) => ({ ...d, name: SKILL_BY_SLUG.get(d.slug)?.name ?? d.slug })),
      suggestions: equity.suggestions,
    },
    viewer: { id: viewerId, role: memberRole ?? (teaching ? "teacher" : "observer"), isLead, canTeach: teaching || owner },
  });
});

projectsRouter.patch("/:id", (req, res) => {
  const { row } = access(req, req.params.id, { needTeach: false });
  const body = parse(
    z.object({
      name: z.string().trim().min(2).max(120).optional(),
      brief: z.string().trim().max(6000).optional(),
      status: z.enum(["draft", "active", "review", "done", "archived"]).optional(),
      dueAt: isoDate,
      config: z.record(z.string(), z.unknown()).optional(),
    }),
    req.body,
  );

  const isOwner = row.owner_id === req.user.id;
  const isTeacher = row.classroom_id ? canTeach(req.user.id, row.classroom_id) : false;
  const isLead = get(`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`, row.id, req.user.id)?.role === "lead";
  if (!isOwner && !isTeacher && !isLead) deny("Only the lead, the owner or the teacher can change the project itself.");
  if (body.config && !isOwner && !isTeacher && !isLead) deny("Only the lead or the teacher can change the rules.");

  const patch = [];
  const values = [];
  if (body.name !== undefined) {
    patch.push("name = ?");
    values.push(body.name);
  }
  if (body.brief !== undefined) {
    patch.push("brief = ?");
    values.push(body.brief);
  }
  if (body.status !== undefined) {
    patch.push("status = ?");
    values.push(body.status);
  }
  if (body.dueAt !== undefined) {
    patch.push("due_at = ?");
    values.push(body.dueAt ? new Date(body.dueAt).toISOString() : null);
  }
  if (body.config !== undefined) {
    const merged = mergeConfig({ ...mergeConfig(row.config), ...body.config });
    patch.push("config = ?");
    values.push(json(merged, {}));
  }
  patch.push("updated_at = ?");
  values.push(nowIso());
  run(`UPDATE projects SET ${patch.join(", ")} WHERE id = ?`, ...values, row.id);

  if (body.status) {
    record({
      verb: `project.${body.status}`,
      subject: `${req.user.name} moved “${row.name}” to ${body.status}`,
      projectId: row.id,
      actorId: req.user.id,
    });
  } else {
    record({ verb: "project.updated", subject: `${req.user.name} updated “${row.name}”`, projectId: row.id, actorId: req.user.id, quiet: false });
  }

  res.json({ project: shapeProject(projectRow(row.id)) });
});

/* ---------- members ------------------------------------------------------ */

projectsRouter.post("/:id/members", (req, res) => {
  const { row, teaching } = access(req, req.params.id);
  const isLead = get(`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`, row.id, req.user.id)?.role === "lead";
  if (!isLead && !teaching && row.owner_id !== req.user.id) deny("Only the lead or the teacher can add people to this project.");
  const body = parse(z.object({ members: z.array(z.union([z.string(), z.object({ email: z.string(), name: z.string().optional() })])).min(1).max(40) }), req.body);
  const added = addProjectMembers(row.id, body.members);
  const fresh = added.filter((a) => !a.alreadyMember);
  if (fresh.length) {
    record({
      verb: "member.added",
      subject: `${req.user.name} added ${fresh.map((a) => a.name).join(", ")} to “${row.name}”`,
      projectId: row.id,
      actorId: req.user.id,
      notify: fresh.map((a) => ({ userId: a.id, title: `You were added to “${row.name}”`, body: `${req.user.name} put you on the team.`, link: `/projects/${row.id}` })),
    });
  }
  res.status(201).json({ added });
});

projectsRouter.patch("/:id/members/:userId", (req, res) => {
  const { row } = access(req, req.params.id, { needTeach: false });
  const isOwner = row.owner_id === req.user.id || (row.classroom_id && canTeach(req.user.id, row.classroom_id));
  if (!isOwner) deny("Only the project owner or the teacher can change roles.");
  const body = parse(z.object({ role: z.enum(["lead", "member", "observer"]) }), req.body);
  const changed = run(`UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?`, body.role, row.id, req.params.userId).changes;
  if (!changed) missing("That person is not on this project.");
  record({ verb: "member.role", subject: `${req.user.name} made ${get(`SELECT name FROM users WHERE id = ?`, req.params.userId)?.name} a ${body.role}`, projectId: row.id, actorId: req.user.id });
  res.json({ ok: true, role: body.role });
});

projectsRouter.delete("/:id/members/:userId", (req, res) => {
  const { row } = access(req, req.params.id, { needTeach: false });
  const isOwner = row.owner_id === req.user.id || (row.classroom_id && canTeach(req.user.id, row.classroom_id));
  if (!isOwner && req.user.id !== req.params.userId) deny("Only the owner or the teacher can remove somebody.");
  if (row.owner_id === req.params.userId) bad("The owner cannot be removed from their own project. Transfer it or archive it.");

  // Removing someone must not silently dump their work, so anything still open is
  // put back in the unassigned pile and the team is told.
  const open = all(`SELECT id, title FROM tasks WHERE project_id = ? AND assignee_id = ? AND status != 'done'`, row.id, req.params.userId);
  tx(() => {
    run(`UPDATE tasks SET assignee_id = NULL, updated_at = ? WHERE project_id = ? AND assignee_id = ? AND status != 'done'`, nowIso(), row.id, req.params.userId);
    run(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, row.id, req.params.userId);
  });
  const name = get(`SELECT name FROM users WHERE id = ?`, req.params.userId)?.name ?? "Someone";
  record({
    verb: "member.removed",
    subject: `${req.user.name} removed ${name} from “${row.name}”`,
    projectId: row.id,
    actorId: req.user.id,
    meta: { released: open.length },
  });
  res.json({ ok: true, released: open });
});

/* ---------- equity, history, activity ----------------------------------- */

projectsRouter.get("/:id/equity", (req, res) => {
  access(req, req.params.id);
  const ctx = loadProject(req.params.id);
  const equity = computeEquity(ctx);
  res.json({ equity, history: equityHistory(req.params.id) });
});

/**
 * Freeze this week's position. Called by the board whenever something material
 * changes, so the trend line exists without anyone having to remember.
 */
projectsRouter.post("/:id/equity/snapshot", (req, res) => {
  access(req, req.params.id);
  const ctx = loadProject(req.params.id);
  if (!ctx) missing("That project does not exist.");
  const equity = computeEquity(ctx);
  const week = recordSnapshot(ctx, equity);
  res.json({ week, equity });
});

projectsRouter.get("/:id/activity", (req, res) => {
  access(req, req.params.id);
  const limit = clamp(Number(req.query.limit) || 60, 1, 300);
  const rows = all(`SELECT * FROM activity WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`, req.params.id, limit);
  const names = nameMap(rows.map((r) => r.actor_id));
  res.json({ activity: rows.map((r) => shapeActivity(r, names)) });
});

/* ---------- check-ins ---------------------------------------------------- */

projectsRouter.post("/:id/checkin", (req, res) => {
  access(req, req.params.id);
  const body = parse(
    z.object({
      mood: z.enum(["ahead", "steady", "behind", "stuck"]),
      note: z.string().trim().max(600).default(""),
      blockers: z.string().trim().max(400).default(""),
    }),
    req.body,
  );
  const week = weekKey();
  const id = newId("chk");
  run(
    `INSERT INTO checkins (id, project_id, user_id, week, mood, note, blockers, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (project_id, user_id, week) DO UPDATE SET mood = excluded.mood, note = excluded.note, blockers = excluded.blockers, created_at = excluded.created_at`,
    id,
    req.params.id,
    req.user.id,
    week,
    body.mood,
    body.note,
    body.blockers,
    nowIso(),
  );
  run(`INSERT INTO contributions (id, project_id, user_id, kind, effort, note, created_at) VALUES (?, ?, ?, 'progress', 0, ?, ?)`, newId("con"), req.params.id, req.user.id, `check-in: ${body.mood}`, nowIso());

  const moodWord = { ahead: "ahead of where they expected", steady: "on track", behind: "running behind", stuck: "stuck" }[body.mood];
  record({
    verb: "checkin",
    subject: `${req.user.name} checked in, ${moodWord}${body.blockers ? `: ${body.blockers}` : ""}`,
    projectId: req.params.id,
    actorId: req.user.id,
    meta: { mood: body.mood },
  });
  res.status(201).json({ ok: true, week, mood: body.mood });
});

/* ---------- peer reviews ------------------------------------------------- */

projectsRouter.get("/:id/reviews", (req, res) => {
  access(req, req.params.id, { needTeach: true });
  const rows = all(`SELECT * FROM reviews WHERE project_id = ? ORDER BY created_at DESC`, req.params.id);
  const names = nameMap(rows.flatMap((r) => [r.reviewer_id, r.subject_id]));
  res.json({ reviews: rows.map((r) => ({ ...r, reviewerName: names[r.reviewer_id], subjectName: names[r.subject_id] })) });
});

projectsRouter.post("/:id/reviews", (req, res) => {
  access(req, req.params.id);
  const body = parse(
    z.object({
      subjectId: z.string().min(1),
      reliability: z.coerce.number().int().min(1).max(5),
      quality: z.coerce.number().int().min(1).max(5),
      teamwork: z.coerce.number().int().min(1).max(5),
      note: z.string().trim().max(800).default(""),
    }),
    req.body,
  );
  if (body.subjectId === req.user.id) bad("You cannot review yourself.");
  if (!get(`SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?`, req.params.id, body.subjectId)) {
    bad("That person is not on this project.");
  }
  const existing = get(
    `SELECT 1 FROM reviews WHERE project_id = ? AND reviewer_id = ? AND subject_id = ?`,
    req.params.id,
    req.user.id,
    body.subjectId,
  );
  const now = nowIso();
  tx(() => {
    run(
      `INSERT INTO reviews (id, project_id, reviewer_id, subject_id, reliability, quality, teamwork, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (project_id, reviewer_id, subject_id) DO UPDATE SET
         reliability = excluded.reliability, quality = excluded.quality, teamwork = excluded.teamwork, note = excluded.note, created_at = excluded.created_at`,
      newId("rev"),
      req.params.id,
      req.user.id,
      body.subjectId,
      body.reliability,
      body.quality,
      body.teamwork,
      body.note,
      now,
    );
    if (!existing) {
      run(
        `INSERT INTO contributions (id, project_id, user_id, kind, effort, note, created_at) VALUES (?, ?, ?, 'review', 0.5, ?, ?)`,
        newId("con"),
        req.params.id,
        req.user.id,
        "peer review submitted",
        now,
      );
    }
  });
  const target = get(`SELECT name FROM users WHERE id = ?`, body.subjectId)?.name;
  record({
    verb: "review.given",
    subject: `${req.user.name} reviewed ${target}'s contribution`,
    projectId: req.params.id,
    actorId: req.user.id,
    meta: { subjectId: body.subjectId },
    // Reviews are shared with the teacher, not with the person reviewed: the
    // point is early intervention, not a public score.
    notify: [],
  });
  res.status(201).json({ ok: true });
});

/** What the teacher sees: the aggregated peer view, and who nobody trusts. */
projectsRouter.get("/:id/reviews/summary", (req, res) => {
  access(req, req.params.id, { needTeach: true });
  const rows = all(`SELECT * FROM reviews WHERE project_id = ?`, req.params.id);
  const bySubject = new Map();
  for (const row of rows) {
    const entry = bySubject.get(row.subject_id) || { id: row.subject_id, reviews: 0, reliability: 0, quality: 0, teamwork: 0, notes: [] };
    entry.reviews++;
    entry.reliability += row.reliability;
    entry.quality += row.quality;
    entry.teamwork += row.teamwork;
    if (row.note) entry.notes.push(row.note);
    bySubject.set(row.subject_id, entry);
  }
  const names = hueMap([...bySubject.keys()]);
  res.json({
    spread: rows.length > 0,
    members: [...bySubject.values()].map((entry) => ({
      id: entry.id,
      name: names[entry.id]?.name ?? entry.id,
      hue: names[entry.id]?.hue ?? 0,
      reviews: entry.reviews,
      reliability: round(entry.reliability / entry.reviews, 2),
      quality: round(entry.quality / entry.reviews, 2),
      teamwork: round(entry.teamwork / entry.reviews, 2),
      notes: entry.notes.slice(0, 8),
    })),
  });
});

export { bool, normaliseRequired };