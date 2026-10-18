/**
 * Nudges.
 *
 * The product's real job is to say something before the problem is expensive.
 * Every nudge here is derived, not scheduled: it exists because a number crossed
 * a line, and it disappears when the number moves back. Each one carries the
 * action that resolves it, so a nudge is never just bad news.
 *
 * Severity is deliberately conservative. A panel that is always red is a panel
 * nobody reads.
 */
import { all, get } from "../db.js";
import { computeEquity } from "./equity.js";
import { loadProject, loadRoster } from "./context.js";
import { round, hoursUntil, weekKey, json } from "../util.js";

const SEVERITY_ORDER = { critical: 0, warn: 1, info: 2 };

const nudge = (parts) => ({
  id: `${parts.kind}:${parts.subjectId ?? "project"}:${parts.memberId ?? "all"}`,
  ...parts,
});

/**
 * Nudges for one project, as seen by one person. What somebody sees depends on
 * their role: a student is told about their own work and the work nobody has; a
 * lead and a teacher also see who is overloaded and where the split has drifted.
 */
export function projectNudges(ctx, equity, viewerId, opts = {}) {
  const now = opts.now ?? Date.now();
  const viewer = equity.members.find((m) => m.id === viewerId);
  const isLead = viewer?.role === "lead" || ctx.project.ownerId === viewerId;
  const out = [];
  const tasks = ctx.tasks;

  // ---- the viewer's own work ---------------------------------------------
  if (viewer) {
    for (const task of viewer.openTasks) {
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null;
      const hours = task.dueAt ? hoursUntil(task.dueAt, now) : null;
      if (due && due < now) {
        out.push(
          nudge({
            kind: "own-overdue",
            severity: "critical",
            subjectId: task.id,
            title: `${task.title} is past its date`,
            body: `It slipped ${round(Math.abs(hours) / 24, 1)} days ago. Either finish it now or say it is blocked so the date can move.`,
            action: { label: "Open the task", href: `/projects/${ctx.project.id}/board?task=${task.id}` },
          }),
        );
      } else if (hours !== null && hours <= 48 && task.status === "todo") {
        out.push(
          nudge({
            kind: "own-soon",
            severity: "warn",
            subjectId: task.id,
            title: `${task.title} is due in ${Math.round(hours)} hours`,
            body: `${task.effort}h of work, and it has not been started.`,
            action: { label: "Start it", href: `/projects/${ctx.project.id}/board?task=${task.id}` },
          }),
        );
      }
    }
    if (viewer.owedCreditedHours > 1) {
      out.push(
        nudge({
          kind: "own-share",
          severity: viewer.owedCreditedHours > viewer.even.credited * 0.5 ? "warn" : "info",
          title: `You are ${round(viewer.owedCreditedHours)}h behind an even share`,
          body:
            equity.unassigned.length > 0
              ? `${round(equity.totals.unassigned)}h of work has nobody on it. Picking one of those up is the fastest way to even it out.`
              : `${viewer.name}, an even share of the delivered work so far is ${round(viewer.even.credited)}h and yours is ${round(viewer.credited)}h.`,
          action: { label: "See what is unclaimed", href: `/projects/${ctx.project.id}?panel=equity` },
        }),
      );
    }
    if (!viewer.checkinCount || !recentCheckin(ctx, viewerId, now)) {
      out.push(
        nudge({
          kind: "own-checkin",
          severity: "info",
          title: "No check-in this week",
          body: "Two lines is enough: what you did, and what is in your way. It is how the others know you are still on it.",
          action: { label: "Check in", href: `/projects/${ctx.project.id}?panel=team` },
        }),
      );
    }
  }

  // ---- work nobody owns ---------------------------------------------------
  for (const task of equity.unassigned) {
    const hours = task.dueAt ? hoursUntil(task.dueAt, now) : null;
    if (hours !== null && hours < 0) {
      out.push(
        nudge({
          kind: "unclaimed-late",
          severity: "critical",
          subjectId: task.id,
          title: `Nobody has taken “${task.title}” and it is already due`,
          body: `${task.effort}h of work with no owner.`,
          action: { label: "Give it to someone", href: `/projects/${ctx.project.id}/board?task=${task.id}` },
        }),
      );
    } else if (hours !== null && hours < 24 * 6) {
      out.push(
        nudge({
          kind: "unclaimed-soon",
          severity: "warn",
          subjectId: task.id,
          title: `“${task.title}” still has no owner`,
          body: `${task.effort}h, due in ${Math.round(hours / 24)} days.`,
          action: { label: "Find the best fit", href: `/projects/${ctx.project.id}/board?task=${task.id}` },
        }),
      );
    }
  }

  // ---- the project as a whole --------------------------------------------
  if (isLead) {
    for (const member of equity.members) {
      const overload = member.flags.find((f) => f.kind === "overloaded");
      if (overload) {
        out.push(
          nudge({
            kind: "member-overloaded",
            severity: overload.severity,
            memberId: member.id,
            title: `${member.name} has more than they can finish`,
            body: overload.detail,
            action: { label: "Move something", href: `/projects/${ctx.project.id}?panel=equity` },
          }),
        );
      }
    }
    for (const move of equity.suggestions.slice(0, 3)) {
      out.push(
        nudge({
          kind: "rebalance",
          severity: "info",
          subjectId: move.taskId,
          memberId: move.toId,
          title: move.kind === "fill" ? `“${move.taskTitle}” could go to ${move.toName}` : `Move “${move.taskTitle}” to ${move.toName}`,
          body: move.reason,
          action: { label: "Review the move", href: `/projects/${ctx.project.id}?panel=equity` },
        }),
      );
    }
    const blocked = tasks.filter((t) => t.status === "blocked");
    for (const task of blocked) {
      out.push(
        nudge({
          kind: "blocked",
          severity: "warn",
          subjectId: task.id,
          title: `“${task.title}” is blocked`,
          body: "Blocked work is invisible in most tools. Someone has to decide whether to unblock it or drop it.",
          action: { label: "Look at it", href: `/projects/${ctx.project.id}/board?task=${task.id}` },
        }),
      );
    }
  }

  if (equity.timeline.daysLeft !== null && equity.timeline.daysLeft < 10 && equity.timeline.actualProgress < 0.75) {
    out.push(
      nudge({
        kind: "pace",
        severity: equity.timeline.actualProgress < 0.5 ? "critical" : "warn",
        title: `${Math.round(equity.timeline.actualProgress * 100)}% through with ${equity.timeline.daysLeft} days left`,
        body: `At an even pace it should be around ${Math.round(Math.min(1, equity.timeline.elapsed) * 100)}% by now.`,
        action: { label: "See the plan", href: `/projects/${ctx.project.id}?panel=plan` },
      }),
    );
  }

  if (equity.flags.some((f) => f.kind === "imbalance" && f.severity === "critical")) {
    out.push(
      nudge({
        kind: "imbalance",
        severity: "critical",
        title: "The work is spread very unevenly",
        body: equity.headline,
        action: { label: "See who is carrying it", href: `/projects/${ctx.project.id}?panel=equity` },
      }),
    );
  }

  return sortNudges(out);
}

/** Every project the person is on, flattened into one list for the dashboard. */
export function personalNudges(userId, opts = {}) {
  const now = opts.now ?? Date.now();
  const rows = all(
    `SELECT pm.project_id FROM project_members pm JOIN projects p ON p.id = pm.project_id
      WHERE pm.user_id = ? AND p.status != 'archived'`,
    userId,
  );
  const out = [];
  for (const row of rows) {
    const ctx = loadProject(row.project_id);
    if (!ctx) continue;
    const equity = computeEquity(ctx, { now });
    for (const item of projectNudges(ctx, equity, userId, { now })) {
      out.push({ ...item, projectId: ctx.project.id, projectName: ctx.project.name });
    }
  }
  return sortNudges(out);
}

/** The teacher's view: what needs attention across the whole class. */
export function classroomNudges(classroomId, opts = {}) {
  const now = opts.now ?? Date.now();
  const projects = all(`SELECT id FROM projects WHERE classroom_id = ? AND status != 'archived'`, classroomId);
  const roster = loadRoster(classroomId);
  const out = [];

  const perStudent = new Map();
  for (const row of projects) {
    const ctx = loadProject(row.id);
    if (!ctx) continue;
    const equity = computeEquity(ctx, { now });
    const byId = new Map(equity.members.map((m) => [m.id, m]));

    for (const projectFlag of equity.flags) {
      if (projectFlag.scope !== "project" || projectFlag.severity === "info") continue;
      out.push(
        nudge({
          kind: `project-${projectFlag.kind}`,
          severity: projectFlag.severity,
          subjectId: ctx.project.id,
          title: `${ctx.project.name}: ${projectFlag.detail}`,
          body: equity.headline,
          action: { label: "Open the group", href: `/classrooms/${classroomId}/groups/${ctx.project.id}` },
        }),
      );
    }

    for (const member of equity.members) {
      const entry = perStudent.get(member.id) || { member, states: [], owed: 0, projects: [] };
      entry.states.push(member.state);
      entry.owed += member.owedCreditedHours;
      entry.projects.push({ id: ctx.project.id, name: ctx.project.name, state: member.state, owed: member.owedCreditedHours });
      perStudent.set(member.id, entry);
    }
  }

  for (const entry of perStudent.values()) {
    const behind = entry.states.filter((s) => s === "behind").length;
    const overloaded = entry.states.filter((s) => s === "overloaded").length;
    const quiet = entry.states.filter((s) => s === "quiet").length;
    if (behind >= 1 && entry.owed > 2) {
      out.push(
        nudge({
          kind: "student-behind",
          severity: entry.owed > 6 ? "critical" : "warn",
          memberId: entry.member.id,
          title: `${entry.member.name} is ${round(entry.owed)}h behind across ${entry.states.length} group${entry.states.length === 1 ? "" : "s"}`,
          body: entry.projects
            .filter((p) => p.state !== "on-track")
            .map((p) => `${p.name}: ${p.state}`)
            .join(" · "),
          action: { label: "See their record", href: `/classrooms/${classroomId}/students/${entry.member.id}` },
        }),
      );
    }
    if (overloaded >= 1) {
      out.push(
        nudge({
          kind: "student-overloaded",
          severity: "warn",
          memberId: entry.member.id,
          title: `${entry.member.name} is over capacity in ${overloaded} group${overloaded === 1 ? "" : "s"}`,
          body: "They will miss something. Worth sitting with them rather than waiting for it.",
          action: { label: "See their record", href: `/classrooms/${classroomId}/students/${entry.member.id}` },
        }),
      );
    }
    if (quiet >= 2) {
      out.push(
        nudge({
          kind: "student-quiet",
          severity: "info",
          memberId: entry.member.id,
          title: `${entry.member.name} has gone quiet in ${quiet} groups`,
          body: "Silence across more than one group is a pattern rather than a bad week.",
          action: { label: "See their record", href: `/classrooms/${classroomId}/students/${entry.member.id}` },
        }),
      );
    }
  }

  // Students with no group at all.
  const placed = new Set(all(`SELECT pm.user_id FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE p.classroom_id = ?`, classroomId).map((r) => r.user_id));
  const unplaced = roster.filter((s) => !placed.has(s.id));
  if (unplaced.length) {
    out.push(
      nudge({
        kind: "unplaced",
        severity: "warn",
        title: `${unplaced.length} student${unplaced.length === 1 ? " is" : "s are"} not in a group`,
        body: unplaced.map((s) => s.name).slice(0, 6).join(", ") + (unplaced.length > 6 ? `, and ${unplaced.length - 6} more` : ""),
        action: { label: "Build the groups", href: `/classrooms/${classroomId}/groups` },
      }),
    );
  }

  return sortNudges(out);
}

function recentCheckin(ctx, userId, now) {
  const key = weekKey(new Date(now));
  return ctx.checkins.some((c) => c.userId === userId && (c.week === key || (now - new Date(c.createdAt).getTime()) / 86_400_000 <= 10));
}

const sortNudges = (list) =>
  [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

export const summarise = (list) => ({
  total: list.length,
  critical: list.filter((n) => n.severity === "critical").length,
  warn: list.filter((n) => n.severity === "warn").length,
  info: list.filter((n) => n.severity === "info").length,
});

/** Unread notifications, for the bell. */
export function unreadNotifications(userId) {
  return all(
    `SELECT id, kind, title, body, link, meta, created_at FROM notifications
      WHERE user_id = ? AND read_at IS NULL ORDER BY created_at DESC LIMIT 40`,
    userId,
  ).map((row) => ({ id: row.id, kind: row.kind, title: row.title, body: row.body, link: row.link, meta: json(row.meta, {}), createdAt: row.created_at }));
}

export { get };