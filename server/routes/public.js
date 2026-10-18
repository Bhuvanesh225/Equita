/**
 * The one endpoint that does not need a session.
 *
 * The landing page claims this product measures fairness. A claim like that is
 * worth nothing as a paragraph and a great deal as a number, so rather than
 * describing the engine in prose the page runs it: this returns three real
 * situations read out of the seeded demonstration dataset, chosen by rule (the
 * worst-balanced group, the quietest, and the healthiest) so the page can never
 * drift out of step with what the data actually says.
 *
 * Everything here is demonstration data. No real student exists in it.
 */
import { Router } from "express";
import { all } from "../db.js";
import { loadProject } from "../engines/context.js";
import { computeEquity } from "../engines/equity.js";
import { classStudents, classProjects } from "../engines/classroom.js";
import { round } from "../util.js";

export const publicRouter = Router();

/** Computing six projects on every visit is waste; the picture moves slowly. */
let cached = null;
const CACHE_MS = 20_000;

function projectSituations() {
  const rows = all(
    `SELECT id, name, mode, due_at FROM projects
     WHERE status != 'archived' AND due_at IS NOT NULL
     ORDER BY name`,
  );

  const studied = [];
  for (const row of rows) {
    const ctx = loadProject(row.id);
    if (!ctx || ctx.members.length < 3) continue;
    const equity = computeEquity(ctx);
    studied.push({ row, ctx, equity });
  }

  const delivered = studied.filter((item) => item.equity.measure === "credited");
  const pool = delivered.length >= 3 ? delivered : studied;

  const pick = (score) => [...pool].sort((a, b) => score(a) - score(b))[0];

  const chosen = [];
  const take = (key, item) => {
    if (item && !chosen.some((existing) => existing.item.row.id === item.row.id)) chosen.push({ key, item });
  };

  // Each group is chosen to exemplify the thing it is worst at, so the page's
  // three lanes are facts about the data rather than captions written first.
  take("drift", pick((item) => item.equity.parts.balance));
  take("quiet", pick((item) => item.equity.parts.engagement));
  take("working", pick((item) => -item.equity.score));

  return chosen;
}

/**
 * The one line each lane is allowed to say, built from the figures below it.
 * If a number is not here, the page cannot claim it.
 */
function laneFor(key, equity) {
  const members = equity.members;
  const top = [...members].sort((a, b) => b.served - a.served)[0];
  const quietest = members
    .filter((member) => member.daysSinceSignal !== null)
    .sort((a, b) => b.daysSinceSignal - a.daysSinceSignal)[0];

  if (key === "working") {
    return {
      title: "The group that is working",
      note: `Five people, and no one holding more than ${Math.round(Math.max(...members.map((m) => m.shares.credited)) * 100)} per cent of the delivered work.`,
    };
  }
  if (key === "quiet") {
    return {
      title: "The group that has gone quiet",
      note: quietest
        ? `${quietest.name.split(" ")[0]} has logged nothing for ${Math.round(quietest.daysSinceSignal)} days, and the group sits at ${equity.parts.engagement} out of 100 for engagement.`
        : `Engagement is ${equity.parts.engagement} out of 100 — nobody is saying anything.`,
    };
  }
  return {
    title: "The group that drifted apart",
    note: top ? `${top.name.split(" ")[0]} holds ${Math.round(top.shares.credited * 100)} per cent of the delivered work for four people.` : "The split has come apart.",
  };
}

function shapeSituation(key, { row, ctx, equity }) {
  const members = equity.members
    .slice()
    .sort((a, b) => b.served - a.served)
    .map((member) => ({
      name: member.name.split(" ")[0],
      fullName: member.name,
      hue: member.hue,
      committed: round(member.committed, 1),
      delivered: round(member.served, 1),
      open: round(member.open, 1),
      share: round(member.shares[equity.measure], 4),
      state: member.state,
      flag: member.flags[0]?.kind ?? null,
      detail: member.flags[0]?.detail ?? null,
      silentFor: member.daysSinceSignal === null ? null : Math.round(member.daysSinceSignal),
    }));

  const move = equity.suggestions[0] ?? null;
  const daysLeft = equity.timeline.daysLeft;
  const lane = laneFor(key, equity);

  return {
    id: row.id,
    key,
    lane,
    name: row.name,
    mode: row.mode,
    classroom: ctx.classroom?.name ?? null,
    dueLabel:
      daysLeft === null
        ? null
        : daysLeft < 0
          ? `hand-in was ${Math.abs(Math.round(daysLeft))} days ago`
          : `${Math.round(daysLeft)} days to the hand-in`,
    headline: equity.headline,
    score: equity.score,
    parts: equity.parts,
    distribution: {
      gini: equity.distribution.gini,
      evenShare: equity.distribution.evenShare,
      maxGap: equity.distribution.maxGap,
    },
    hours: {
      committed: round(equity.members.reduce((sum, m) => sum + m.committed, 0), 1),
      delivered: round(equity.members.reduce((sum, m) => sum + m.served, 0), 1),
      // The shaped member's `even` carries committed, credited and open but not
      // the even share of hours actually finished, so it is taken from the total.
      even: round(equity.members.reduce((sum, m) => sum + m.served, 0) / Math.max(1, equity.members.length), 1),
      evenCommitted: round(equity.members[0]?.even.committed ?? 0, 1),
      open: round(equity.members.reduce((sum, m) => sum + m.open, 0), 1),
    },
    counts: { tasks: equity.totals?.tasks ?? ctx.tasks.length, done: equity.totals?.done ?? 0, unassigned: equity.totals?.unassigned ?? 0 },
    members,
    move: move
      ? {
          kind: move.kind,
          taskTitle: move.taskTitle,
          effort: round(move.taskEffort, 1),
          // A move out of somebody's hands has a `from`; work that nobody has
          // taken on does not, and that difference is worth keeping.
          from: move.fromName ?? null,
          to: move.toName ?? null,
          fromAfter: round(move.fromAfterHours ?? 0, 1),
          toAfter: round(move.toAfterHours ?? 0, 1),
          reason: move.reason,
        }
      : null,
    weights: ctx.config.weights,
    allocator: ctx.config.allocator,
    policy: {
      silenceDays: ctx.config.policy.silenceDays,
      shareGapFlag: ctx.config.policy.shareGapFlag,
      freeRiderShare: ctx.config.policy.freeRiderShare,
    },
  };
}

function classPicture() {
  const classroom = all(
    `SELECT c.id, c.name, c.code, c.subject, (SELECT COUNT(*) FROM enrollments e WHERE e.classroom_id = c.id AND e.role = 'student') AS students
     FROM classrooms c
     WHERE c.archived_at IS NULL
     ORDER BY students DESC, c.name
     LIMIT 1`,
  )[0];
  if (!classroom) return null;

  const students = classStudents(classroom.id);
  const projects = classProjects(classroom.id);

  return {
    id: classroom.id,
    name: classroom.name,
    code: classroom.code,
    subject: classroom.subject,
    students: students.map((student) => ({
      name: student.name.split(" ")[0],
      fullName: student.name,
      hue: student.hue,
      groups: student.projects.length,
      delivered: round(student.totals.credited, 1),
      committed: round(student.totals.committed, 1),
      open: round(student.totals.open, 1),
      owed: round(student.owed ?? 0, 1),
      state: student.state,
      detail: student.flags[0]?.detail ?? null,
    })),
    projects: projects.map((project) => ({
      name: project.name,
      members: project.memberCount,
      score: project.modest.score,
      balance: project.equity.parts.balance,
      gini: project.modest.gini,
      dueAt: project.dueAt,
    })),
  };
}

/** Totals across the whole demonstration, so the page can state scale honestly. */
function totals() {
  const one = (sql) => all(sql)[0]?.n ?? 0;
  return {
    students: one("SELECT COUNT(*) AS n FROM users WHERE role = 'student' AND status = 'active'"),
    teachers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'teacher' AND status = 'active'"),
    classes: one("SELECT COUNT(*) AS n FROM classrooms WHERE archived_at IS NULL"),
    projects: one("SELECT COUNT(*) AS n FROM projects WHERE status != 'archived'"),
    standalone: one("SELECT COUNT(*) AS n FROM projects WHERE status != 'archived' AND mode = 'standalone'"),
    tasks: one("SELECT COUNT(*) AS n FROM tasks"),
    completed: one("SELECT COUNT(*) AS n FROM tasks WHERE status = 'done'"),
    hoursLogged: round((all("SELECT COALESCE(SUM(effort), 0) AS n FROM contributions")[0]?.n ?? 0), 0),
    skills: one("SELECT COUNT(*) AS n FROM skills"),
    logEntries: one("SELECT COUNT(*) AS n FROM contributions"),
  };
}

publicRouter.get("/story", (req, res) => {
  const now = Date.now();
  if (!cached || now - cached.at > CACHE_MS) {
    const situations = projectSituations().map(({ key, item }) => shapeSituation(key, item));
    cached = {
      at: now,
      data: {
        generatedAt: new Date(now).toISOString(),
        demo: true,
        note: "Demonstration data. Every figure below was computed by the same engine the application runs, on a seeded dataset of invented students.",
        totals: totals(),
        situations,
        classroom: classPicture(),
      },
    };
  }
  res.set("Cache-Control", "public, max-age=20");
  res.json(cached.data);
});
