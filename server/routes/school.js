/**
 * Classrooms.
 *
 * A classroom is what turns Equita from a tool a group of friends use into
 * something a school runs. The teacher owns the roster, sets the fairness policy
 * that groups are held to, and can see every group at once — but the students
 * inside each group still run their own board, which is the point.
 */
import { Router } from "express";
import { z } from "zod";
import { all, get, run, tx } from "../db.js";
import { newId, nowIso, json, round } from "../util.js";
import { requireAuth, canTeach, memberships } from "../auth.js";
import { parse, bad, deny, missing, classroomRow, freshJoinCode, shapeProject } from "../api.js";
import { addClassroomStudents } from "../people.js";
import { DEFAULT_CLASSROOM_POLICY, mergeConfig, loadProject, loadRoster } from "../engines/context.js";
import { computeEquity, recordSnapshot } from "../engines/equity.js";
import { classroomOverview, studentRecord } from "../engines/classroom.js";
import { formGroups, classGaps } from "../engines/grouping.js";
import { rosterCoverage } from "../engines/profiles.js";
import { planProject } from "../engines/planner.js";
import { autoAssign } from "../engines/allocator.js";
import { record } from "../events.js";
import { normaliseRequired } from "../engines/context.js";

export const schoolRouter = Router();
schoolRouter.use(requireAuth);

function classroomAccess(req, id, { needTeach = true } = {}) {
  const row = classroomRow(id);
  const teaching = canTeach(req.user.id, id);
  const enrolled = !!get(`SELECT 1 FROM enrollments WHERE classroom_id = ? AND user_id = ?`, id, req.user.id);
  if (needTeach && !teaching) deny("Only a teacher of this class can do that.");
  if (!needTeach && !teaching && !enrolled && row.owner_id !== req.user.id) deny("You are not in this class.");
  return { row, teaching };
}

/* ---------- list, create, join ------------------------------------------ */

schoolRouter.get("/", (req, res) => {
  const mine = memberships(req.user.id);
  const classrooms = mine.map((classroom) => {
    const students = get(`SELECT COUNT(*) AS n FROM enrollments WHERE classroom_id = ? AND role = 'student'`, classroom.id)?.n ?? 0;
    const projects = get(`SELECT COUNT(*) AS n FROM projects WHERE classroom_id = ? AND status != 'archived'`, classroom.id)?.n ?? 0;
    const scores = all(
      `SELECT id FROM projects WHERE classroom_id = ? AND status != 'archived'`,
      classroom.id,
    ).map((row) => computeEquity(loadProject(row.id)).score);
    return {
      ...classroom,
      isTeacher: classroom.role === "teacher" || classroom.ownerId === req.user.id,
      students,
      projects,
      meanScore: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length, 1) : null,
    };
  });
  res.json({ classrooms });
});

const CreateClassroom = z.object({
  name: z.string().trim().min(2, "Give the class a name").max(120),
  subject: z.string().trim().max(80).default(""),
  term: z.string().trim().max(60).default(""),
  policy: z.record(z.string(), z.unknown()).optional(),
});

schoolRouter.post("/", (req, res) => {
  if (req.user.role !== "teacher") deny("Only teacher accounts can create a class. Switch your role in settings if you teach.");
  const body = parse(CreateClassroom, req.body);
  const id = newId("cls");
  const now = nowIso();
  const policy = mergeConfig({ ...DEFAULT_CLASSROOM_POLICY, ...(body.policy || {}) });

  tx(() => {
    run(
      `INSERT INTO classrooms (id, name, code, subject, term, owner_id, policy, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      body.name,
      freshJoinCode(),
      body.subject,
      body.term,
      req.user.id,
      json(policy, {}),
      now,
    );
    run(`INSERT INTO enrollments (id, classroom_id, user_id, role, created_at) VALUES (?, ?, ?, 'teacher', ?)`, newId("enr"), id, req.user.id, now);
  });

  const row = classroomRow(id);
  res.status(201).json({ classroom: { id: row.id, name: row.name, code: row.code, subject: row.subject, term: row.term, policy } });
});

schoolRouter.post("/join", (req, res) => {
  const body = parse(z.object({ code: z.string().trim().min(4).max(16) }), req.body);
  const row = get(`SELECT * FROM classrooms WHERE code = ? AND archived_at IS NULL`, body.code.toUpperCase().replace(/\s+/g, ""));
  if (!row) return bad("No class is using that code. Check it with your teacher.");
  const already = get(`SELECT 1 FROM enrollments WHERE classroom_id = ? AND user_id = ?`, row.id, req.user.id);
  if (!already) {
    run(`INSERT INTO enrollments (id, classroom_id, user_id, role, created_at) VALUES (?, ?, ?, 'student', ?)`, newId("enr"), row.id, req.user.id, nowIso());
    record({
      verb: "class.joined",
      subject: `${req.user.name} joined ${row.name}`,
      classroomId: row.id,
      actorId: req.user.id,
      notify: [{ userId: row.owner_id, title: `${req.user.name} joined ${row.name}`, body: "They can be added to a group now.", link: `/classrooms/${row.id}/groups` }],
    });
  }
  res.json({ classroom: { id: row.id, name: row.name, code: row.code, subject: row.subject, term: row.term }, already: !!already });
});

/* ---------- one classroom ------------------------------------------------- */

schoolRouter.get("/:id", (req, res) => {
  const { row, teaching } = classroomAccess(req, req.params.id, { needTeach: false });
  const overview = classroomOverview(row.id);
  if (!overview) missing("That class does not exist.");
  res.json({
    ...overview,
    viewer: {
      id: req.user.id,
      isTeacher: teaching || row.owner_id === req.user.id,
      role: teaching ? "teacher" : "student",
    },
    gaps: classGaps(loadRoster(row.id), []),
  });
});

schoolRouter.patch("/:id", (req, res) => {
  const { row } = classroomAccess(req, req.params.id);
  const body = parse(
    z.object({
      name: z.string().trim().min(2).max(120).optional(),
      subject: z.string().trim().max(80).optional(),
      term: z.string().trim().max(60).optional(),
      policy: z.record(z.string(), z.unknown()).optional(),
      archived: z.coerce.boolean().optional(),
    }),
    req.body,
  );
  const patch = [];
  const values = [];
  if (body.name !== undefined) {
    patch.push("name = ?");
    values.push(body.name);
  }
  if (body.subject !== undefined) {
    patch.push("subject = ?");
    values.push(body.subject);
  }
  if (body.term !== undefined) {
    patch.push("term = ?");
    values.push(body.term);
  }
  if (body.policy !== undefined) {
    const merged = mergeConfig({ ...mergeConfig(row.policy), ...body.policy });
    patch.push("policy = ?");
    values.push(json(merged, {}));
  }
  if (body.archived !== undefined) {
    patch.push("archived_at = ?");
    values.push(body.archived ? nowIso() : null);
  }
  if (!patch.length) return res.json({ ok: true });
  run(`UPDATE classrooms SET ${patch.join(", ")} WHERE id = ?`, ...values, row.id);

  // A policy change is retroactive on purpose: the rule was wrong, not the work.
  record({ verb: "class.updated", subject: `${req.user.name} updated ${row.name}`, classroomId: row.id, actorId: req.user.id, meta: { policy: !!body.policy } });
  const fresh = classroomRow(row.id);
  res.json({ classroom: { ...fresh, policy: json(fresh.policy, {}) } });
});

/* ---------- roster -------------------------------------------------------- */

schoolRouter.post("/:id/students", (req, res) => {
  const { row } = classroomAccess(req, req.params.id);
  const body = parse(
    z.object({
      students: z
        .array(z.union([z.string(), z.object({ email: z.string(), name: z.string().optional() })]))
        .min(1)
        .max(60),
    }),
    req.body,
  );
  const added = addClassroomStudents(row.id, body.students);
  const fresh = added.filter((a) => !a.alreadyEnrolled);
  if (fresh.length) {
    record({
      verb: "class.roster",
      subject: `${req.user.name} added ${fresh.length} student${fresh.length === 1 ? "" : "s"} to ${row.name}`,
      classroomId: row.id,
      actorId: req.user.id,
      notify: fresh.map((a) => ({ userId: a.id, title: `You were added to ${row.name}`, body: "You can fill in your strengths now.", link: "/profile" })),
    });
  }
  res.status(201).json({ added });
});

schoolRouter.delete("/:id/students/:userId", (req, res) => {
  /*
   * A teacher removes somebody else; a student may remove themselves. Leaving
   * has to be possible from /settings, and the alternative — a person stuck in a
   * class they can see but cannot leave — is the kind of control a product is
   * right to offer. The owner is still refused, because a class without its
   * owner has nobody who can hand it on.
   */
  const { row, teaching } = classroomAccess(req, req.params.id, { needTeach: false });
  const self = req.params.userId === req.user.id;
  if (!teaching && !self) deny("Only a teacher of this class can remove somebody else.");
  if (req.params.userId === row.owner_id) bad("The class owner cannot leave it — archive the class instead.");
  tx(() => {
    // Leaving a class takes the student out of its groups, but their work stays
    // on the record and their tasks are released rather than deleted.
    const projects = all(`SELECT id FROM projects WHERE classroom_id = ?`, row.id).map((p) => p.id);
    for (const projectId of projects) {
      run(`UPDATE tasks SET assignee_id = NULL WHERE project_id = ? AND assignee_id = ? AND status != 'done'`, projectId, req.params.userId);
      run(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, projectId, req.params.userId);
    }
    run(`DELETE FROM enrollments WHERE classroom_id = ? AND user_id = ?`, row.id, req.params.userId);
  });
  const name = get(`SELECT name FROM users WHERE id = ?`, req.params.userId)?.name ?? "A student";
  record({
    verb: self ? "class.left" : "class.removed",
    subject: self ? `${req.user.name} left ${row.name}` : `${req.user.name} removed ${name} from ${row.name}`,
    classroomId: row.id,
    actorId: req.user.id,
  });
  res.json({ ok: true });
});

schoolRouter.get("/:id/students/:userId", (req, res) => {
  const { row, teaching } = classroomAccess(req, req.params.id, { needTeach: false });
  if (!teaching && req.user.id !== req.params.userId) deny("A student can only see their own record.");
  const record_ = studentRecord(row.id, req.params.userId);
  if (!record_) missing("That student does not exist.");
  res.json(record_);
});

/** Where the whole class is thin, before any group is built. */
schoolRouter.get("/:id/coverage", (req, res) => {
  const { row } = classroomAccess(req, req.params.id, { needTeach: false });
  const roster = loadRoster(row.id);
  res.json({ coverage: rosterCoverage(roster), gaps: classGaps(roster, []), size: roster.length });
});

/* ---------- group formation --------------------------------------------- */

const GroupInput = z.object({
  teams: z.coerce.number().int().min(2).max(20).optional(),
  size: z.coerce.number().int().min(2).max(8).default(4),
  requiredClusters: z.array(z.string()).max(8).default([]),
  seed: z.coerce.number().int().optional(),
});

schoolRouter.post("/:id/groups/preview", (req, res) => {
  const { row } = classroomAccess(req, req.params.id);
  const body = parse(GroupInput, req.body);
  const roster = loadRoster(row.id);
  if (roster.length < 2) bad("There are not enough students in this class yet.");
  const result = formGroups(roster, {
    teams: body.teams,
    size: body.size,
    requiredClusters: body.requiredClusters,
    seed: body.seed ?? 20261018,
  });
  res.json({ ...result, rosterSize: roster.length });
});

const ApplyGroups = z.object({
  name: z.string().trim().min(2, "Name the assignment").max(120),
  brief: z.string().trim().max(6000).default(""),
  dueAt: z.string().trim().max(40).optional().nullable(),
  teams: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        memberIds: z.array(z.string()).min(1).max(12),
      }),
    )
    .min(1)
    .max(20),
  autoPlan: z.coerce.boolean().default(true),
  autoAssign: z.coerce.boolean().default(false),
  requiredClusters: z.array(z.string()).max(8).default([]),
});

/**
 * The teacher's one action: turn a set of groups into real projects, with a plan
 * and, if asked, an allocation. Everything it creates is ordinary data
 * afterwards — no special "class project" mode to maintain.
 */
schoolRouter.post("/:id/projects", (req, res) => {
  const { row } = classroomAccess(req, req.params.id);
  const body = parse(ApplyGroups, req.body);
  const policy = mergeConfig(row.policy);
  const now = nowIso();
  const dueAt = body.dueAt ? new Date(body.dueAt).toISOString() : null;
  const created = [];

  for (const team of body.teams) {
    const projectId = newId("prj");
    const memberIds = team.memberIds.filter((id) => get(`SELECT 1 FROM enrollments WHERE classroom_id = ? AND user_id = ?`, row.id, id));
    tx(() => {
      run(
        `INSERT INTO projects (id, name, brief, mode, classroom_id, owner_id, status, due_at, config, created_at, updated_at)
         VALUES (?, ?, ?, 'class', ?, ?, 'active', ?, ?, ?, ?)`,
        projectId,
        `${body.name} — ${team.name}`,
        body.brief,
        row.id,
        req.user.id,
        dueAt,
        json(policy, {}),
        now,
        now,
      );
      memberIds.forEach((userId, index) => {
        run(
          `INSERT OR IGNORE INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`,
          projectId,
          userId,
          index === 0 ? "lead" : "member",
          now,
        );
      });
    });

    let planned = 0;
    let placed = 0;
    if (body.autoPlan && body.brief.trim()) {
      const totalCapacity = memberIds.reduce((a, id) => a + (get(`SELECT capacity FROM users WHERE id = ?`, id)?.capacity ?? 8), 0);
      const plan = planProject({
        brief: body.brief,
        members: memberIds.length,
        totalCapacity: totalCapacity || memberIds.length * 8,
        dueAt,
        utilisation: 0.6,
      });
      const top = 0;
      plan.tasks.forEach((task, index) => {
        run(
          `INSERT INTO tasks (id, project_id, title, detail, phase, status, effort, priority, due_at, required_skills,
                              deliverable, needs_review, position, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, '', ?, ?, ?, ?, ?)`,
          newId("tsk"),
          projectId,
          task.title,
          task.detail,
          task.phase,
          task.effort,
          task.priority,
          task.dueAt,
          json(normaliseRequired(task.required), []),
          task.needsReview ? 1 : 0,
          top + (index + 1) * 1000,
          req.user.id,
          now,
          now,
        );
        planned++;
      });

      if (body.autoAssign && memberIds.length) {
        const ctx = loadProject(projectId);
        const result = autoAssign(ctx, computeEquity(ctx), {});
        for (const item of result.assignments) {
          run(`UPDATE tasks SET assignee_id = ? WHERE id = ?`, item.userId, item.taskId);
          run(
            `INSERT INTO assignments (id, project_id, task_id, user_id, kind, status, score, breakdown, rationale, created_by, created_at)
             VALUES (?, ?, ?, ?, 'auto', 'accepted', ?, ?, ?, ?, ?)`,
            newId("asg"),
            projectId,
            item.taskId,
            item.userId,
            item.score,
            json(item.parts ?? {}, {}),
            item.rationale,
            req.user.id,
            now,
          );
          placed++;
        }
      }
    }

    const fresh = loadProject(projectId);
    recordSnapshot(fresh, computeEquity(fresh));
    created.push({ id: projectId, name: `${body.name} — ${team.name}`, members: memberIds.length, planned, placed });
  }

  const memberUserIds = [...new Set(body.teams.flatMap((t) => t.memberIds))];
  record({
    verb: "class.assigned",
    subject: `${req.user.name} set “${body.name}” for ${body.teams.length} group${body.teams.length === 1 ? "" : "s"}`,
    classroomId: row.id,
    actorId: req.user.id,
    meta: { groups: body.teams.length },
    notify: memberUserIds.map((userId) => ({
      userId,
      title: `New assignment: ${body.name}`,
      body: `${body.brief.slice(0, 140)}${body.brief.length > 140 ? "…" : ""}`,
      link: `/projects/${created.find((c) => c.id)?.id ?? ""}`,
    })),
  });

  res.status(201).json({ created });
});

/* ---------- analytics ---------------------------------------------------- */

schoolRouter.get("/:id/analytics", (req, res) => {
  const { row } = classroomAccess(req, req.params.id, { needTeach: false });
  const overview = classroomOverview(row.id);
  if (!overview) missing("That class does not exist.");
  res.json({
    analytics: overview.analytics,
    trend: overview.trend,
    coverage: overview.coverage,
    students: overview.students.map((s) => ({
      id: s.id,
      name: s.name,
      hue: s.hue,
      state: s.state,
      groups: s.projects.length,
      credited: s.totals.credited,
      committed: s.totals.committed,
      even: s.totals.even,
      owed: s.owed,
      open: s.totals.open,
      capacity: s.capacity,
      top: s.top,
    })),
    projects: overview.projects.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.equity.score,
      gini: p.equity.distribution.gini,
      parts: p.equity.parts,
      progress: p.equity.timeline.actualProgress,
      daysLeft: p.equity.timeline.daysLeft,
      open: p.equity.totals.open,
      unassigned: p.equity.totals.unassigned,
      members: p.members,
    })),
  });
});

export { shapeProject, all };