/**
 * The class view.
 *
 * A teacher does not want eight separate project dashboards. They want to know
 * which group is drifting, which student is carrying three groups, and which
 * student has quietly stopped, and they want it in one screen. This assembles
 * that, by running the same equity engine over every project in the class and
 * then reading across the results per student.
 */
import { all, get } from "../db.js";
import { loadProject, loadRoster } from "./context.js";
import { computeEquity, equityHistory } from "./equity.js";
import { classroomNudges, summarise } from "./nudges.js";
import { rosterCoverage, clusterStrength, topSkills, growthEdges } from "./profiles.js";
import { round, mean, json } from "../util.js";

/**
 * One project per group, each reduced to what a teacher needs to see at a glance.
 */
export function classProjects(classroomId, now = Date.now()) {
  const rows = all(`SELECT id FROM projects WHERE classroom_id = ? AND status != 'archived' ORDER BY created_at`, classroomId);
  return rows.map((row) => {
    const ctx = loadProject(row.id);
    if (!ctx) return null;
    const equity = computeEquity(ctx, { now });
    const attention = equity.members.filter((m) => m.state !== "on-track");
    return {
      id: ctx.project.id,
      name: ctx.project.name,
      brief: ctx.project.brief,
      status: ctx.project.status,
      dueAt: ctx.project.dueAt,
      memberCount: equity.members.length,
      /*
       * How many peer reviews have been written on this group. The console's
       * "never reviewed" figure reads it, and that figure used to be a literal
       * zero — which meant the screen claimed every group had been read even
       * when nobody had opened one. A number the product prints has to come
       * from the data.
       */
      reviewCount: ctx.reviews.length,
      equity,
      modest: {
        score: equity.score,
        gini: equity.distribution.gini,
        daysLeft: equity.timeline.daysLeft,
        progress: equity.timeline.actualProgress,
        done: equity.totals.done,
        tasks: equity.totals.tasks,
        unassigned: equity.totals.unassigned,
        open: equity.totals.open,
      },
      members: equity.members.map((m) => ({
        id: m.id,
        name: m.name,
        hue: m.hue,
        state: m.state,
        committed: m.committed,
        credited: m.credited,
        /*
         * `even` is the even share *of delivered work*, because that is the
         * measure every load bar in the product draws and the one `owed` is
         * computed against. Exposing `even.committed` here made a class roster
         * say one student was "11.3h behind" while the equity engine's own flag
         * on the same student, one line below, said "4.7h behind" — two numbers
         * for one word. The committed share is still available, under its own
         * name.
         */
        even: m.even.credited,
        evenCommitted: m.even.committed,
        owedCreditedHours: m.owedCreditedHours,
        open: m.open,
        capacity: m.capacity,
        flags: m.flags,
      })),
      attention: attention.map((m) => ({ id: m.id, name: m.name, state: m.state, detail: m.flags[0]?.detail ?? "" })),
      weakest: [...equity.members].sort((a, b) => a.credited - b.credited)[0]?.name ?? null,
      strongest: equity.members[0]?.name ?? null,
    };
  });
}

/** Equity across the whole class, over time: one line per project, averaged. */
export function classTrend(classroomId) {
  const rows = all(
    `SELECT s.week, s.taken_at, s.score, s.gini, s.project_id
       FROM equity_snapshots s JOIN projects p ON p.id = s.project_id
      WHERE p.classroom_id = ? ORDER BY s.taken_at`,
    classroomId,
  );
  const byWeek = new Map();
  for (const row of rows) {
    const entry = byWeek.get(row.week) || { week: row.week, takenAt: row.taken_at, scores: [], ginis: [], projects: 0 };
    entry.scores.push(row.score);
    entry.ginis.push(row.gini);
    entry.projects++;
    byWeek.set(row.week, entry);
  }
  return [...byWeek.values()].map((entry) => ({
    week: entry.week,
    takenAt: entry.takenAt,
    score: round(mean(entry.scores), 1),
    gini: round(mean(entry.ginis), 3),
    projects: entry.projects,
  }));
}

/**
 * Every student, read across every group they are in. This is the view that
 * catches the person who is fine in each group individually and overloaded
 * across all three.
 */
export function classStudents(classroomId, now = Date.now()) {
  const roster = loadRoster(classroomId);
  const projects = classProjects(classroomId, now);
  const byStudent = new Map();

  for (const user of roster) {
    byStudent.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      headline: user.headline,
      hue: user.hue,
      capacity: user.capacity,
      top: topSkills(user, 4),
      clusters: clusterStrength(user).slice(0, 3),
      growth: growthEdges(user, 3),
      projects: [],
      totals: { committed: 0, credited: 0, even: 0, evenCommitted: 0, open: 0, capacity: 0, tasks: 0, done: 0 },
      state: "on-track",
      flags: [],
      owed: 0,
    });
  }

  for (const project of projects) {
    for (const member of project.members) {
      const entry = byStudent.get(member.id);
      if (!entry) continue;
      entry.projects.push({
        id: project.id,
        name: project.name,
        state: member.state,
        committed: member.committed,
        credited: member.credited,
        even: member.even,
        owed: member.owedCreditedHours,
        open: member.open,
        flags: member.flags,
      });
      entry.totals.committed += member.committed;
      entry.totals.credited += member.credited;
      entry.totals.even += member.even;
      entry.totals.evenCommitted += member.evenCommitted ?? 0;
      entry.totals.open += member.open;
      entry.totals.capacity += member.capacity;
      entry.flags.push(...member.flags.map((f) => ({ ...f, projectName: project.name, projectId: project.id })));
    }
  }

  const students = [...byStudent.values()].map((entry) => {
    entry.totals.committed = round(entry.totals.committed, 2);
    entry.totals.credited = round(entry.totals.credited, 2);
    entry.totals.even = round(entry.totals.even, 2);
    entry.totals.evenCommitted = round(entry.totals.evenCommitted, 2);
    entry.totals.open = round(entry.totals.open, 2);
    entry.owed = round(entry.totals.even - entry.totals.credited, 2);
    // Across groups, a student's own capacity is shared: three groups each
    // fitting comfortably can still add up to more than they have.
    const weeks = Math.max(1, ...entry.projects.map(() => 1));
    entry.totals.available = round(entry.totals.capacity * weeks, 2);
    entry.acrossGroups = entry.projects.length > 1 && entry.totals.open > entry.totals.capacity * 1.5;
    entry.state = entry.flags.some((f) => f.kind === "overloaded" || f.severity === "critical")
      ? "overloaded"
      : entry.owed > 2
        ? "behind"
        : entry.flags.some((f) => f.kind === "silent" || f.kind === "quiet") || entry.projects.some((p) => p.state === "quiet")
          ? "quiet"
          : entry.totals.committed > entry.totals.even + 2
            ? "carrying"
            : "on-track";
    entry.share = entry.totals.committed > 0 ? round(entry.totals.credited / Math.max(1, entry.totals.committed), 3) : 0;
    return entry;
  });

  return students.sort((a, b) => {
    const rank = { overloaded: 0, behind: 1, quiet: 2, carrying: 3, "on-track": 4 };
    return (rank[a.state] ?? 5) - (rank[b.state] ?? 5) || a.name.localeCompare(b.name);
  });
}

/** The one call the class console needs. */
export function classroomOverview(classroomId, now = Date.now()) {
  const classroom = get(`SELECT * FROM classrooms WHERE id = ?`, classroomId);
  if (!classroom) return null;
  const projects = classProjects(classroomId, now);
  const students = classStudents(classroomId, now);
  const nudges = classroomNudges(classroomId, { now });
  const roster = loadRoster(classroomId);
  const coverage = rosterCoverage(roster);

  const scores = projects.map((p) => p.equity.score);
  const ginis = projects.map((p) => p.equity.distribution.gini);
  const progress = projects.map((p) => p.equity.timeline.actualProgress);
  const behind = students.filter((s) => s.state === "behind");
  const overloaded = students.filter((s) => s.state === "overloaded");

  return {
    classroom: {
      id: classroom.id,
      name: classroom.name,
      code: classroom.code,
      subject: classroom.subject,
      term: classroom.term,
      ownerId: classroom.owner_id,
      policy: json(classroom.policy, {}),
      createdAt: classroom.created_at,
    },
    projects,
    students,
    nudges,
    nudgeCounts: summarise(nudges),
    coverage,
    analytics: {
      groups: projects.length,
      students: students.length,
      meanScore: projects.length ? round(mean(scores), 1) : 0,
      worstScore: scores.length ? Math.min(...scores) : 0,
      bestScore: scores.length ? Math.max(...scores) : 0,
      meanGini: ginis.length ? round(mean(ginis), 3) : 0,
      meanProgress: progress.length ? round(mean(progress), 3) : 0,
      behindCount: behind.length,
      overloadedCount: overloaded.length,
      unplaced: students.filter((s) => s.projects.length === 0).length,
      neverReviewed: projects.filter((p) => p.reviewCount === 0).length,
      spreadOfStates: students.reduce((acc, s) => ({ ...acc, [s.state]: (acc[s.state] ?? 0) + 1 }), {}),
      projectsWithoutDeadline: projects.filter((p) => !p.dueAt).length,
      totalOpenHours: round(projects.reduce((a, p) => a + p.equity.totals.open, 0), 1),
    },
    trend: classTrend(classroomId),
    attention: [
      ...overloaded.map((s) => ({ kind: "overloaded", studentId: s.id, name: s.name, hue: s.hue, detail: `${round(s.totals.open)}h open across ${s.projects.length} group${s.projects.length === 1 ? "" : "s"}`, severity: "critical" })),
      ...behind.map((s) => ({ kind: "behind", studentId: s.id, name: s.name, hue: s.hue, detail: `${round(s.owed)}h behind an even share of delivered work`, severity: s.owed > 6 ? "critical" : "warn" })),
      ...students.filter((s) => s.state === "quiet").map((s) => ({ kind: "quiet", studentId: s.id, name: s.name, hue: s.hue, detail: "No contributions or check-ins recently", severity: "warn" })),
      ...students.filter((s) => s.projects.length === 0).map((s) => ({ kind: "unplaced", studentId: s.id, name: s.name, hue: s.hue, detail: "Not in any group yet", severity: "info" })),
    ],
  };
}

/** One student's whole record: their groups, their hours, their history. */
export function studentRecord(classroomId, userId, now = Date.now()) {
  const projects = classProjects(classroomId, now);
  const mine = projects.filter((p) => p.members.some((m) => m.id === userId));
  const user = get(`SELECT * FROM users WHERE id = ?`, userId);
  if (!user) return null;

  const detail = mine.map((project) => {
    const ctx = loadProject(project.id);
    const equity = computeEquity(ctx, { now });
    const member = equity.members.find((m) => m.id === userId);
    const contributions = ctx.contributions
      .filter((c) => c.userId === userId)
      .map((c) => ({ ...c, taskTitle: ctx.tasks.find((t) => t.id === c.taskId)?.title ?? null }));
    return {
      id: ctx.project.id,
      name: ctx.project.name,
      equityScore: equity.score,
      member,
      contributions,
      checkins: ctx.checkins.filter((c) => c.userId === userId),
      tasks: ctx.tasks
        .filter((t) => t.assigneeId === userId)
        .map((t) => ({ id: t.id, title: t.title, status: t.status, effort: t.effort, dueAt: t.dueAt, completedAt: t.completedAt, late: t.completedAt && t.dueAt && new Date(t.completedAt) > new Date(t.dueAt) })),
      history: equityHistory(ctx.project.id).map((h) => ({
        week: h.week,
        credited: h.members?.find((m) => m.id === userId)?.credited ?? null,
        committed: h.members?.find((m) => m.id === userId)?.committed ?? null,
      })),
    };
  });

  const totals = detail.reduce(
    (acc, entry) => ({
      credited: round(acc.credited + (entry.member?.credited ?? 0), 2),
      committed: round(acc.committed + (entry.member?.committed ?? 0), 2),
      even: round(acc.even + (entry.member?.even.committed ?? 0), 2),
      done: acc.done + entry.tasks.filter((t) => t.status === "done").length,
      late: acc.late + entry.tasks.filter((t) => t.late).length,
      open: acc.open + entry.tasks.filter((t) => t.status !== "done").length,
    }),
    { credited: 0, committed: 0, even: 0, done: 0, late: 0, open: 0 },
  );

  const profile = { id: user.id, name: user.name, skills: new Map(topSkills({ skills: all(`SELECT skill_id, level, appetite FROM user_skills WHERE user_id = ?`, userId).map((r) => ({ slug: String(r.skill_id).replace(/^skl_/, ""), level: r.level, appetite: r.appetite })) }, 99).map((s) => [s.slug, s])) };

  return {
    student: {
      id: user.id,
      name: user.name,
      email: user.email,
      headline: user.headline,
      hue: user.hue,
      capacity: user.capacity,
      status: user.status,
    },
    top: topSkills(profile, 8),
    growth: growthEdges(profile, 4),
    clusters: clusterStrength(profile),
    totals: { ...totals, owed: round(totals.even - totals.credited, 2) },
    projects: detail,
    reading: reading(totals, detail),
  };
}

/** The paragraph a teacher reads before deciding whether to intervene. */
function reading(totals, detail) {
  if (!detail.length) return "Not in any group yet, so there is nothing to read.";
  const lines = [];
  lines.push(`${totals.credited}h delivered against an even share of ${totals.even}h, across ${detail.length} group${detail.length === 1 ? "" : "s"}.`);
  if (totals.owed > 2) lines.push(`That is ${round(totals.owed)}h short of even.`);
  else if (totals.owed < -2) lines.push(`That is ${round(Math.abs(totals.owed))}h more than an even share.`);
  else lines.push("That is level with an even share.");
  if (totals.late) lines.push(`${totals.late} task${totals.late === 1 ? " closed late" : "s closed late"}.`);
  if (totals.open > totals.committed * 0.5) lines.push(`${totals.open}h is still open, which is more than half of what they hold.`);
  const weak = detail.filter((d) => d.member?.state === "behind" || d.member?.state === "quiet");
  if (weak.length) lines.push(`Falling behind in ${weak.map((d) => d.name).join(" and ")}.`);
  return lines.join(" ");
}

export { all };