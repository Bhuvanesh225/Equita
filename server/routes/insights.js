/**
 * The dashboard, the bell and the copilot.
 *
 * The dashboard is one request because it is the first screen after sign-in and
 * it should never arrive in pieces. It is assembled from the same engines the
 * project pages use, so a number on the dashboard and the same number inside a
 * project are the same number.
 */
import { Router } from "express";
import { z } from "zod";
import { all, get, run } from "../db.js";
import { round, nowIso, json, weekKey, DAY } from "../util.js";
import { requireAuth } from "../auth.js";
import { parse, shapeProject, nameMap, hueMap, shapeActivity } from "../api.js";
import { loadProject } from "../engines/context.js";
import { computeEquity, equityHistory } from "../engines/equity.js";
import { personalNudges, summarise, unreadNotifications, classroomNudges } from "../engines/nudges.js";
import { ask, starterQuestions, pickProject } from "../engines/copilot.js";
import { topSkills, clusterStrength } from "../engines/profiles.js";
import { rankCandidates } from "../engines/allocator.js";
import { classroomOverview } from "../engines/classroom.js";
import { SKILL_BY_SLUG } from "../data/skills.js";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

const myProjects = (userId) =>
  all(
    `SELECT DISTINCT p.* FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN enrollments e ON e.classroom_id = p.classroom_id AND e.user_id = ?
      WHERE (pm.user_id = ? OR e.user_id = ? OR p.owner_id = ?) AND p.status != 'archived'
      ORDER BY p.due_at IS NULL, p.due_at, p.updated_at DESC`,
    userId,
    userId,
    userId,
    userId,
  );

/** Shared by the dashboard and the projects list so the two cannot drift. */
export function projectCard(row, userId) {
  const ctx = loadProject(row.id);
  if (!ctx) return null;
  const equity = computeEquity(ctx);
  const me = equity.members.find((m) => m.id === userId) ?? null;
  const open = ctx.tasks.filter((t) => t.status !== "done");
  const mine = open.filter((t) => t.assigneeId === userId);
  const unclaimedFit = equity.unassigned
    .map((t) => {
      const full = ctx.tasks.find((x) => x.id === t.id);
      const ranked = full ? rankCandidates(ctx, equity, full, { limit: 1 }) : null;
      return {
        ...t,
        name: full ? t.title : t.title,
        fit: ranked?.recommended?.memberId === userId ? ranked.recommended.score : null,
      };
    })
    .filter((t) => t.fit !== null);

  return {
    ...shapeProject(row),
    equity: {
      score: equity.score,
      parts: equity.parts,
      /* The five parts are a weighted average, so the weights travel with them:
       * a screen that prints "Balance 62" without saying it counts for 30% of
       * the score is asking to be argued with. */
      weights: equity.weights,
      gini: equity.distribution.gini,
      headline: equity.headline,
      daysLeft: equity.timeline.daysLeft,
      progress: equity.timeline.actualProgress,
      elapsed: equity.timeline.elapsed,
    },
    totals: equity.totals,
    memberCount: equity.members.length,
    members: equity.members.map((m) => ({ id: m.id, name: m.name, hue: m.hue, state: m.state, committed: m.committed, credited: m.credited, even: m.even.committed, open: m.open })),
    mine: me
      ? {
          state: me.state,
          committed: me.committed,
          credited: me.credited,
          open: me.open,
          even: me.even.committed,
          owed: me.owedCreditedHours,
          headroom: me.headroom,
          remainingCapacity: me.remainingCapacity,
          tasks: mine.map((t) => ({ id: t.id, title: t.title, status: t.status, effort: t.effort, dueAt: t.dueAt, phase: t.phase, priority: t.priority, required: t.required })),
          flags: me.flags,
        }
      : null,
    unclaimedForMe: unclaimedFit.slice(0, 3),
    flags: equity.flags,
  };
}

insightsRouter.get("/dashboard", (req, res) => {
  const userId = req.user.id;
  const rows = myProjects(userId);
  const cards = rows.map((row) => projectCard(row, userId)).filter(Boolean);

  // Everything on me, in the order it will hurt.
  const now = Date.now();
  const agenda = [];
  for (const card of cards) {
    for (const task of card.mine?.tasks ?? []) {
      agenda.push({
        ...task,
        projectId: card.id,
        projectName: card.name,
        requiredNames: task.required.map((r) => ({ ...r, name: SKILL_BY_SLUG.get(r.slug)?.name ?? r.slug })),
        overdue: task.dueAt ? new Date(task.dueAt).getTime() < now : false,
        hoursUntilDue: task.dueAt ? round((new Date(task.dueAt).getTime() - now) / 3_600_000, 1) : null,
      });
    }
  }
  agenda.sort((a, b) => (a.dueAt || "9999").localeCompare(b.dueAt || "9999"));

  // The week ahead, in hours, so a person can see the shape of it.
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now + index * DAY);
    const key = day.toISOString().slice(0, 10);
    const hours = agenda
      .filter((task) => task.dueAt && task.dueAt.slice(0, 10) === key && task.status !== "done")
      .reduce((a, t) => a + t.effort, 0);
    return { date: key, label: day.toLocaleDateString(undefined, { weekday: "short" }), hours: round(hours, 1), isToday: index === 0 };
  });

  // My own line against an even share, week by week, across every project.
  const trendMap = new Map();
  for (const card of cards) {
    for (const point of equityHistory(card.id)) {
      const mine = point.members?.find((m) => m.id === userId);
      if (!mine) continue;
      /*
       * The even share of that week, read out of the same snapshot: the
       * snapshot stores what each member held, so the even share is the mean of
       * the members who were on the project when it was taken. It used to be a
       * literal `+= 0`, which drew a rule line at zero and claimed a person was
       * infinitely ahead of everybody. See docs/06-traps.md T30.
       */
      const members = point.members ?? [];
      const even = members.length ? members.reduce((a, m) => a + (m.credited ?? 0), 0) / members.length : 0;
      const entry = trendMap.get(point.week) || { week: point.week, takenAt: point.takenAt, credited: 0, committed: 0, even: 0 };
      entry.credited += mine.credited;
      entry.committed += mine.committed;
      entry.even += even;
      trendMap.set(point.week, entry);
    }
  }

  const nudges = personalNudges(userId);
  const unread = unreadNotifications(userId);
  const skills = all(`SELECT skill_id, level, appetite FROM user_skills WHERE user_id = ?`, userId).map((r) => ({
    slug: String(r.skill_id).replace(/^skl_/, ""),
    level: r.level,
    appetite: r.appetite,
  }));
  const profile = { id: userId, name: req.user.name, skills: new Map(skills.map((s) => [s.slug, s])) };

  const classroomIds = all(`SELECT classroom_id FROM enrollments WHERE user_id = ? AND role IN ('teacher','assistant')`, userId).map((r) => r.classroom_id);
  const classes = classroomIds.map((id) => {
    const overview = classroomOverview(id);
    if (!overview) return null;
    const classNudges = classroomNudges(id);
    return {
      id,
      name: overview.classroom.name,
      code: overview.classroom.code,
      subject: overview.classroom.subject,
      term: overview.classroom.term,
      students: overview.analytics.students,
      groups: overview.analytics.groups,
      meanScore: overview.analytics.meanScore,
      worstScore: overview.analytics.worstScore,
      behind: overview.analytics.behindCount,
      overloaded: overview.analytics.overloadedCount,
      unplaced: overview.analytics.unplaced,
      urgent: classNudges.filter((n) => n.severity === "critical").length,
      attention: overview.attention.slice(0, 4),
    };
  }).filter(Boolean);

  const recentActivity = all(
    `SELECT a.* FROM activity a
      WHERE a.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
      ORDER BY a.created_at DESC LIMIT 24`,
    userId,
  );
  const names = hueMap(recentActivity.map((a) => a.actor_id));

  const totalOpen = cards.reduce((a, c) => a + (c.mine?.open ?? 0), 0);
  const totalEven = cards.reduce((a, c) => a + (c.mine?.even ?? 0), 0);
  const totalCredited = cards.reduce((a, c) => a + (c.mine?.credited ?? 0), 0);

  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      role: req.user.role,
      hue: req.user.hue,
      capacity: req.user.capacity,
      headline: req.user.headline,
    },
    top: topSkills(profile, 6),
    clusters: clusterStrength(profile).slice(0, 4),
    skillCount: skills.length,
    cards,
    agenda: agenda.slice(0, 24),
    week,
    nudges,
    nudgeCounts: summarise(nudges),
    notifications: unread,
    unreadCount: unread.length,
    classes,
    activity: recentActivity.map((a) => ({
      ...shapeActivity(a, Object.fromEntries(Object.entries(names).map(([id, v]) => [id, v.name]))),
      actorHue: names[a.actor_id]?.hue ?? null,
    })),
    trend: [...trendMap.values()]
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
      .map((t) => ({ ...t, credited: round(t.credited, 2), committed: round(t.committed, 2), even: round(t.even, 2) })),
    summary: {
      projects: cards.length,
      openHours: round(totalOpen, 1),
      evenHours: round(totalEven, 1),
      creditedHours: round(totalCredited, 1),
      dueToday: agenda.filter((t) => t.hoursUntilDue !== null && t.hoursUntilDue <= 24 && t.hoursUntilDue > -24).length,
      overdue: agenda.filter((t) => t.overdue).length,
      classes: classes.length,
    },
  });
});

insightsRouter.get("/nudges", (req, res) => {
  const nudges = personalNudges(req.user.id);
  res.json({ nudges, counts: summarise(nudges) });
});

/* ---------- notifications ------------------------------------------------ */

insightsRouter.get("/notifications", (req, res) => {
  const rows = all(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60`,
    req.user.id,
  );
  res.json({
    notifications: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      link: row.link,
      meta: json(row.meta, {}),
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    unread: rows.filter((r) => !r.read_at).length,
  });
});

insightsRouter.post("/notifications/read", (req, res) => {
  const body = parse(z.object({ ids: z.array(z.string()).max(200).optional(), all: z.coerce.boolean().default(false) }), req.body ?? {});
  if (body.all) {
    run(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`, nowIso(), req.user.id);
  } else if (body.ids?.length) {
    for (const id of body.ids) run(`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?`, nowIso(), id, req.user.id);
  }
  res.json({ ok: true, unread: get(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`, req.user.id)?.n ?? 0 });
});

/* ---------- copilot ----------------------------------------------------- */

insightsRouter.post("/copilot", (req, res) => {
  const body = parse(
    z.object({
      question: z.string().trim().min(1, "Ask something").max(400),
      projectId: z.string().trim().max(64).optional().nullable(),
      classroomId: z.string().trim().max(64).optional().nullable(),
    }),
    req.body,
  );
  const answer = ask(body.question, {
    userId: req.user.id,
    projectId: body.projectId ?? null,
    classroomId: body.classroomId ?? null,
  });
  res.json(answer);
});

insightsRouter.get("/copilot/starters", (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
  const classroomId = typeof req.query.classroomId === "string" ? req.query.classroomId : null;
  res.json({ questions: starterQuestions(req.user.id, projectId, classroomId) });
});

/* ---------- search ------------------------------------------------------- */

insightsRouter.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ results: [] });
  const like = `%${q}%`;
  const userId = req.user.id;

  const projects = all(
    `SELECT DISTINCT p.id, p.name, p.mode, p.classroom_id FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN enrollments e ON e.classroom_id = p.classroom_id AND e.user_id = ?
      WHERE (pm.user_id = ? OR e.user_id = ? OR p.owner_id = ?) AND (p.name LIKE ? OR p.brief LIKE ?)
      LIMIT 8`,
    userId,
    userId,
    userId,
    userId,
    like,
    like,
  ).map((row) => ({ kind: "project", id: row.id, title: row.name, subtitle: row.mode === "class" ? "Class assignment" : "Team project", href: `/projects/${row.id}` }));

  const tasks = all(
    `SELECT t.id, t.title, t.status, t.project_id, p.name AS project_name FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      WHERE t.title LIKE ? OR t.detail LIKE ?
      LIMIT 12`,
    userId,
    like,
    like,
  ).map((row) => ({ kind: "task", id: row.id, title: row.title, subtitle: `${row.project_name} · ${row.status}`, href: `/projects/${row.project_id}/board?task=${row.id}` }));

  const people = all(
    `SELECT DISTINCT u.id, u.name, u.headline, u.hue FROM users u
       JOIN project_members pm ON pm.user_id = u.id
      WHERE pm.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?) AND u.name LIKE ?
      LIMIT 8`,
    userId,
    like,
  ).map((row) => ({ kind: "person", id: row.id, title: row.name, subtitle: row.headline || "On your team", hue: row.hue, href: `/people/${row.id}` }));

  const classes = all(
    `SELECT c.id, c.name, c.subject FROM classrooms c JOIN enrollments e ON e.classroom_id = c.id
      WHERE e.user_id = ? AND (c.name LIKE ? OR c.subject LIKE ?) LIMIT 6`,
    userId,
    like,
    like,
  ).map((row) => ({ kind: "class", id: row.id, title: row.name, subtitle: row.subject || "Class", href: `/classrooms/${row.id}` }));

  res.json({ results: [...projects, ...tasks, ...classes, ...people].slice(0, 20) });
});

/** A person's public card: enough to decide whether to put them on a task. */
insightsRouter.get("/people/:id", (req, res) => {
  const user = get(`SELECT * FROM users WHERE id = ?`, req.params.id);
  if (!user) return res.status(404).json({ error: "That person does not exist." });
  const shared = all(
    `SELECT p.id, p.name FROM projects p
      WHERE p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        AND p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)`,
    req.user.id,
    req.params.id,
  );
  const skills = all(`SELECT skill_id, level, appetite FROM user_skills WHERE user_id = ?`, req.params.id).map((r) => ({
    slug: String(r.skill_id).replace(/^skl_/, ""),
    level: r.level,
    appetite: r.appetite,
  }));
  const profile = { id: user.id, name: user.name, skills: new Map(skills.map((s) => [s.slug, s])) };
  res.json({
    person: { id: user.id, name: user.name, headline: user.headline, hue: user.hue, capacity: user.capacity, school: user.school },
    top: topSkills(profile, 8),
    clusters: clusterStrength(profile),
    sharedProjects: shared,
    isTeammate: shared.length > 0,
  });
});

export { pickProject, weekKey, nameMap };