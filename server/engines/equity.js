/**
 * The equity engine.
 *
 * This is the part of Equita that does something a checklist cannot: it decides
 * whether the work is actually being shared, says who is carrying whom, and
 * shows the working.
 *
 * Two deliberate choices run through everything here.
 *
 * 1. Equity is judged on *delivered* work, not on promises. A task somebody was
 *    given is not a task somebody did. Both numbers are reported, because the gap
 *    between them is the single most useful signal a group has.
 * 2. Nothing is a category. Every member gets a position on a continuous scale
 *    and a number in hours, so the output stays honest in the awkward middle
 *    where someone is slightly behind rather than a "free rider".
 */
import { all, run } from "../db.js";
import { clamp, round, gini, hoursUntil, nowIso, weekKey, newId, DAY, HOUR, mean } from "../util.js";
import { fitSkills } from "./skills.js";

/** How much credit an open task earns, by how far along it is. */
const PROGRESS_WEIGHT = { todo: 0, doing: 0.5, review: 0.75, blocked: 0.15, done: 1 };

export function remainingWeeks(dueAt, now = Date.now()) {
  const hours = hoursUntil(dueAt, now);
  if (hours === null) return 4; // no deadline: assume a month, the honest default
  return Math.max(0.25, hours / (7 * 24));
}

export function elapsedFraction(project, now = Date.now()) {
  if (!project.dueAt) return 0.5;
  const start = new Date(project.createdAt).getTime();
  const end = new Date(project.dueAt).getTime();
  if (end <= start) return 1;
  return clamp((now - start) / (end - start), 0, 1);
}

/**
 * The per-member ledger. One row per person, every number in hours.
 */
export function memberLedgers(ctx, now = Date.now()) {
  const { members, tasks, contributions, project } = ctx;
  const week = remainingWeeks(project.dueAt, now);
  const byId = new Map();
  for (const member of members) {
    byId.set(member.id, {
      id: member.id,
      name: member.name,
      hue: member.hue,
      role: member.role,
      capacity: member.capacity,
      skills: member.skills,
      served: 0, // hours completed on tasks they own
      open: 0,
      blocked: 0,
      credited: 0, // progress-weighted hours: the mid-flight measure
      helped: 0, // work logged outside their own tasks
      taskCount: 0,
      doneCount: 0,
      openTasks: [],
      doneTasks: [],
      lastSignalAt: null,
      reviewCount: 0,
      commentCount: 0,
      checkinCount: 0,
      recentCheckin: false,
      startLatencies: [],
      lateCloses: 0,
      earlyCloses: 0,
    });
  }

  const orphan = [];
  for (const task of tasks) {
    if (!task.assigneeId || !byId.has(task.assigneeId)) {
      orphan.push(task);
      continue;
    }
    const row = byId.get(task.assigneeId);
    row.taskCount++;
    if (task.status === "done") {
      row.served += task.effort;
      row.doneCount++;
      row.doneTasks.push(task);
      if (task.dueAt && task.completedAt) {
        if (new Date(task.completedAt) <= new Date(task.dueAt)) row.earlyCloses++;
        else row.lateCloses++;
      }
    } else {
      row.open += task.effort;
      row.openTasks.push(task);
      if (task.status === "blocked") row.blocked += task.effort;
    }
    row.credited += task.effort * (PROGRESS_WEIGHT[task.status] ?? 0);
    if (task.startedAt && task.createdAt) {
      row.startLatencies.push((new Date(task.startedAt) - new Date(task.createdAt)) / HOUR);
    }
  }

  for (const entry of contributions) {
    const row = byId.get(entry.userId);
    if (!row) continue;
    // Help that is not one of their own tasks still counts, at a discount: it is
    // real work, but it did not carry a deliverable of its own.
    if (["help", "unblock", "evidence", "review"].includes(entry.kind)) {
      row.helped += entry.effort;
      row.credited += entry.effort * 0.6;
    }
    if (entry.kind === "review") row.reviewCount++;
    if (!row.lastSignalAt || entry.createdAt > row.lastSignalAt) row.lastSignalAt = entry.createdAt;
  }

  for (const checkin of ctx.checkins) {
    const row = byId.get(checkin.userId);
    if (!row) continue;
    row.checkinCount++;
    if ((now - new Date(checkin.createdAt).getTime()) / DAY <= 10) row.recentCheckin = true;
    if (!row.lastSignalAt || checkin.createdAt > row.lastSignalAt) row.lastSignalAt = checkin.createdAt;
  }

  for (const comment of ctx.comments) {
    const row = byId.get(comment.authorId);
    if (!row) continue;
    row.commentCount++;
    if (!row.lastSignalAt || comment.createdAt > row.lastSignalAt) row.lastSignalAt = comment.createdAt;
  }

  const rows = [...byId.values()].map((row) => ({
    ...row,
    committed: row.served + row.open + row.helped,
    projectedFinishWeeks: row.open > 0 ? row.open / Math.max(1, row.capacity) : 0,
    remainingCapacity: row.capacity * week,
    headroom: row.capacity * week - row.open,
    openTasks: [...row.openTasks].sort((a, b) => (a.dueAt || "9999").localeCompare(b.dueAt || "9999")),
    startLatency: row.startLatencies.length ? round(mean(row.startLatencies), 1) : null,
    daysSinceSignal: row.lastSignalAt ? round((now - new Date(row.lastSignalAt).getTime()) / DAY, 1) : null,
  }));

  return { rows, orphan };
}

/**
 * The full picture for a project: shares, the score and its parts, the flags,
 * and the rebalancing options that would improve the score.
 */
export function computeEquity(ctx, opts = {}) {
  const now = opts.now ?? Date.now();
  const { config, project, tasks } = ctx;
  const { rows, orphan } = memberLedgers(ctx, now);
  const n = Math.max(1, rows.length);

  const totalCommitted = rows.reduce((a, r) => a + r.committed, 0);
  const totalCredited = rows.reduce((a, r) => a + r.credited, 0);
  const totalOpen = rows.reduce((a, r) => a + r.open, 0);
  const totalServed = rows.reduce((a, r) => a + r.served, 0);
  const totalBlocked = rows.reduce((a, r) => a + r.blocked, 0);
  const orphanEffort = orphan.reduce((a, t) => a + t.effort, 0);
  const totalEffort = totalCommitted + orphanEffort;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter((t) => t.status !== "done" && t.dueAt && new Date(t.dueAt).getTime() < now);
  const elapsed = elapsedFraction(project, now);
  const week = remainingWeeks(project.dueAt, now);
  const daysLeft = project.dueAt ? round(hoursUntil(project.dueAt, now) / 24, 1) : null;

  // What "fair" is measured against shifts as the project moves. Early on there
  // is nothing delivered to judge, so commitment is all that exists, and marking
  // half a two-week-old team as "behind" would be both wrong and ignored. Once a
  // third of the work is genuinely delivered, commitment flatters whoever took
  // the easy half, so delivered work takes over.
  const deliveryMeaningful = totalCredited >= 4 && totalCredited >= 0.35 * Math.max(totalCommitted, 1);
  const measure = deliveryMeaningful ? "credited" : "committed";

  const withShares = rows.map((row) => ({
    ...row,
    shares: {
      credited: totalCredited > 0 ? row.credited / totalCredited : 0,
      committed: totalCommitted > 0 ? row.committed / totalCommitted : 0,
      open: totalOpen > 0 ? row.open / totalOpen : 0,
      served: totalServed > 0 ? row.served / totalServed : 0,
    },
    even: {
      credited: totalCredited / n,
      committed: totalCommitted / n,
      open: totalOpen / n,
      served: totalServed / n,
    },
  }));

  const giniMeasure = gini(withShares.map((r) => r[measure]));
  const giniCommitted = gini(withShares.map((r) => r.committed));
  const giniOpen = gini(withShares.map((r) => r.open));
  const maxGap = withShares.length
    ? Math.max(...withShares.map((r) => r.shares[measure])) - Math.min(...withShares.map((r) => r.shares[measure]))
    : 0;

  // ---- the five parts of the score ----------------------------------------
  // A Gini of 0.6 is the point at which a group is effectively one person and
  // three passengers, so that is where this part of the score reaches zero.
  const balance = clamp(100 * (1 - giniMeasure / 0.6), 0, 100);
  const spread = clamp(100 * (1 - giniOpen / 0.6), 0, 100);

  const actualProgress = totalCommitted > 0 ? totalCredited / totalCommitted : 0;
  const scheduleScore = clamp(1 - Math.max(0, elapsed - actualProgress) / 0.5, 0, 1);
  const closedWithDue = tasks.filter((t) => t.status === "done" && t.dueAt);
  const punctuality = closedWithDue.length
    ? closedWithDue.filter((t) => t.completedAt && new Date(t.completedAt) <= new Date(t.dueAt)).length / closedWithDue.length
    : clamp(1 - overdue.length / Math.max(1, tasks.filter((t) => t.status !== "done").length), 0, 1);
  const delivery = clamp(100 * (0.55 * scheduleScore + 0.45 * punctuality), 0, 100);

  // Engagement is measured per person first and averaged, so one very talkative
  // member cannot hide three silent ones.
  const engagementParts = withShares.map((row) => {
    const recency = row.daysSinceSignal === null ? 0 : clamp(1 - row.daysSinceSignal / 14, 0, 1);
    const checkin = row.recentCheckin ? 1 : clamp(row.checkinCount / 3, 0, 0.6);
    const talking = clamp(row.commentCount / 3, 0, 1);
    const promptness = row.startLatency === null ? 0.6 : clamp(1 - row.startLatency / (7 * 24), 0, 1);
    return clamp(0.4 * recency + 0.25 * checkin + 0.2 * talking + 0.15 * promptness, 0, 1);
  });
  const engagement = clamp(100 * mean(engagementParts), 0, 100);

  const unassignedShare = totalEffort > 0 ? orphanEffort / totalEffort : 0;
  const blockedShare = totalEffort > 0 ? totalBlocked / totalEffort : 0;
  const readiness = clamp(100 * (0.72 * (1 - unassignedShare) + 0.28 * (1 - blockedShare)), 0, 100);

  const parts = {
    balance: round(balance),
    delivery: round(delivery),
    spread: round(spread),
    engagement: round(engagement),
    readiness: round(readiness),
  };
  const weights = config.weights;
  const score = round(Object.entries(parts).reduce((a, [key, value]) => a + value * (weights[key] ?? 0), 0), 1);

  // ---- who is carrying whom ------------------------------------------------
  const { policy } = config;
  const flags = [];
  const evenShareFraction = 1 / n;

  const membersOut = withShares
    .map((row, index) => {
      const delta = row.shares.committed - evenShareFraction;
      const owedHours = round(row.even.committed - row.committed, 2);
      const owedCreditedHours = round(row.even.credited - row.credited, 2);
      const overloaded = row.remainingCapacity > 0 ? row.open > row.remainingCapacity : row.open > 0;
      const silent = row.daysSinceSignal !== null && row.daysSinceSignal > policy.silenceDays;
      // Owing is a statement about delivered work: it needs a project far enough
      // along for delivery to mean anything, and a gap worth a conversation.
      const owing = deliveryMeaningful && owedCreditedHours > 1 && row.shares.credited < policy.freeRiderShare * evenShareFraction;
      // On a young project the same person is instead flagged quietly, against
      // what they took on, which is the only thing there is to judge yet.
      const light = !deliveryMeaningful && owedHours > 2 && row.shares.committed < 0.7 * evenShareFraction;
      const carrying = delta > policy.shareGapFlag || (totalCredited > 0 && row.shares.credited > evenShareFraction * 1.4);

      const personFlags = [];
      if (overloaded) {
        personFlags.push({
          kind: "overloaded",
          severity: row.open > row.remainingCapacity * 1.4 ? "critical" : "warn",
          detail: `${round(row.open)}h of open work against ${round(row.remainingCapacity)}h of time left, which is about ${round(row.projectedFinishWeeks)} weeks of their capacity.`,
        });
      }
      if (carrying && !overloaded) {
        personFlags.push({ kind: "carrying", severity: "warn", detail: `${Math.round(delta * 100)} points above an even share of the work taken on.` });
      }
      if (owing) {
        personFlags.push({
          kind: "owing",
          severity: owedCreditedHours > row.even.credited * 0.6 ? "critical" : "warn",
          detail: `${round(owedCreditedHours)}h behind an even share of delivered work.`,
        });
      }
      if (light) {
        personFlags.push({ kind: "light", severity: "info", detail: `${round(owedHours)}h below an even share of what has been taken on so far.` });
      }
      if (silent) {
        personFlags.push({ kind: "silent", severity: "warn", detail: `Nothing in the project for ${row.daysSinceSignal} days.` });
      }
      if (row.blocked > 0) {
        personFlags.push({ kind: "blocked", severity: "info", detail: `${round(row.blocked)}h of their work is blocked.` });
      }
      if (row.open > 0 && row.capacity < 3) {
        personFlags.push({ kind: "thin-capacity", severity: "info", detail: `Only ${row.capacity}h a week available, so anything past ${round(row.capacity * week)}h will not land.` });
      }

      for (const flag of personFlags) flags.push({ scope: "member", memberId: row.id, memberName: row.name, ...flag });

      // One word for the whole state, used on the board and in the class console.
      const state = overloaded ? "overloaded" : owing ? "behind" : carrying ? "carrying" : silent ? "quiet" : "on-track";

      return {
        id: row.id,
        name: row.name,
        hue: row.hue,
        role: row.role,
        capacity: row.capacity,
        skills: [...row.skills.entries()].map(([slug, s]) => ({ slug, level: s.level, appetite: s.appetite })),
        served: round(row.served, 2),
        open: round(row.open, 2),
        blocked: round(row.blocked, 2),
        committed: round(row.committed, 2),
        credited: round(row.credited, 2),
        helped: round(row.helped, 2),
        shares: {
          committed: round(row.shares.committed, 4),
          credited: round(row.shares.credited, 4),
          open: round(row.shares.open, 4),
        },
        even: { committed: round(row.even.committed, 2), credited: round(row.even.credited, 2), open: round(row.even.open, 2) },
        deltaHours: round(row.committed - row.even.committed, 2),
        deltaCreditedHours: round(row.credited - row.even.credited, 2),
        owedHours,
        owedCreditedHours,
        headroom: round(row.headroom, 2),
        remainingCapacity: round(row.remainingCapacity, 2),
        weeksNeeded: round(row.projectedFinishWeeks, 2),
        taskCount: row.taskCount,
        doneCount: row.doneCount,
        openTasks: row.openTasks.map((t) => ({
          id: t.id,
          title: t.title,
          effort: t.effort,
          status: t.status,
          dueAt: t.dueAt,
          priority: t.priority,
          required: t.required,
        })),
        lateCloses: row.lateCloses,
        earlyCloses: row.earlyCloses,
        reviewCount: row.reviewCount,
        commentCount: row.commentCount,
        checkinCount: row.checkinCount,
        daysSinceSignal: row.daysSinceSignal,
        startLatency: row.startLatency,
        state,
        flags: personFlags,
        engagement: round((engagementParts[index] ?? 0) * 100, 1),
      };
    })
    .sort((a, b) => b.committed - a.committed);

  // Project-level flags.
  if (orphanEffort > 0) {
    flags.push({ scope: "project", kind: "unassigned", severity: "warn", detail: `${round(orphanEffort)}h of work has nobody on it.` });
  }
  if (giniMeasure > 0.45) {
    flags.push({ scope: "project", kind: "imbalance", severity: "critical", detail: `Effort is spread very unevenly, at a Gini of ${round(giniMeasure, 2)}.` });
  } else if (giniMeasure > policy.shareGapFlag * 0.9) {
    flags.push({ scope: "project", kind: "imbalance", severity: "warn", detail: `Effort is drifting apart, at a Gini of ${round(giniMeasure, 2)}.` });
  }
  if (overdue.length) {
    flags.push({ scope: "project", kind: "overdue", severity: overdue.length > 2 ? "critical" : "warn", detail: `${overdue.length} task${overdue.length === 1 ? "" : "s"} past the date.` });
  }
  if (daysLeft !== null && daysLeft < 7 && totalCommitted > 0 && actualProgress < 0.7) {
    flags.push({ scope: "project", kind: "behind", severity: "critical", detail: `${Math.round(actualProgress * 100)}% of the work is through with ${daysLeft} days left.` });
  }

  const totals = {
    committed: round(totalCommitted, 2),
    credited: round(totalCredited, 2),
    served: round(totalServed, 2),
    open: round(totalOpen, 2),
    blocked: round(totalBlocked, 2),
    unassigned: round(orphanEffort, 2),
    effort: round(totalEffort, 2),
    tasks: tasks.length,
    done: doneCount,
    open: tasks.length - doneCount,
    overdue: overdue.length,
    members: rows.length,
  };

  return {
    computedAt: nowIso(),
    measure,
    score,
    parts,
    weights,
    totals,
    distribution: {
      gini: round(giniMeasure, 4),
      giniCommitted: round(giniCommitted, 4),
      giniOpen: round(giniOpen, 4),
      maxGap: round(maxGap, 4),
      evenShare: round(evenShareFraction, 4),
    },
    timeline: {
      elapsed: round(elapsed, 4),
      actualProgress: round(actualProgress, 4),
      daysLeft,
      remainingWeeks: round(week, 2),
      scheduleScore: round(scheduleScore, 3),
      punctuality: round(punctuality, 3),
    },
    members: membersOut,
    unassigned: orphan.map((t) => ({ id: t.id, title: t.title, effort: t.effort, dueAt: t.dueAt, phase: t.phase, required: t.required })),
    flags,
    suggestions: suggestRebalance(ctx, { rows: withShares, orphans: orphan, parts }),
    headline: equityHeadline({ measure, giniMeasure, membersOut, committed: totalCommitted }),
  };
}

/** One sentence a person can act on. Sits at the top of every equity panel. */
function equityHeadline({ measure, giniMeasure, membersOut, committed }) {
  if (!committed) return "Nothing has been taken on yet, so there is nothing to judge.";
  const label = measure === "credited" ? "Delivered work" : "The work taken on";
  if (giniMeasure < 0.18) return `${label} is shared evenly — a Gini of ${round(giniMeasure, 2)}.`;
  const top = membersOut[0];
  const worst = membersOut.filter((m) => m.state === "behind").sort((a, b) => a.credited - b.credited)[0];
  if (giniMeasure < 0.35 && top) {
    return `${top.name} is carrying a little more than their share. It is close, but moving one task would even it out.`;
  }
  if (worst && top) {
    return `${worst.name} is ${round(Math.abs(worst.owedCreditedHours))}h behind an even share of delivered work while ${top.name} carries ${round(top.served)}h. That gap is the thing to fix.`;
  }
  if (top) {
    const share = Math.round((measure === "credited" ? top.shares.credited : top.shares.committed) * 100);
    return `${label} is split ${share}/${100 - share}, with ${top.name} holding the larger half.`;
  }
  return `${label} is uneven.`;
}

/**
 * Rebalancing.
 *
 * For every task sitting on someone past their head, find the people who could
 * do it and would be brought closer to an even share by taking it, then rank by
 * how much the imbalance actually falls. Each option is priced in hours on both
 * sides, so accepting one is a decision rather than a leap of faith.
 */
export function suggestRebalance(ctx, { rows, orphans }) {
  const { config } = ctx;
  const moves = [];
  const fitOf = (task, member) => fitSkills(task.required, member.skills, { allowStretch: config.policy.allowStretch });

  for (const row of rows) {
    const overHead = row.open - row.remainingCapacity;
    const overShare = row.open - row.even.open;
    if (overHead <= 0 && overShare <= 0.75) continue;
    for (const task of row.openTasks) {
      if (task.status === "blocked") continue;
      for (const candidate of rows) {
        if (candidate.id === row.id) continue;
        if (!config.policy.allowStretch && task.required.some((r) => !candidate.skills.has(r.slug))) continue;
        if (candidate.remainingCapacity - task.effort < 0) continue;
        const fit = fitOf(task, candidate);
        if (fit.score < 0.28) continue;

        const before = Math.abs(row.committed - row.even.committed) + Math.abs(candidate.committed - candidate.even.committed);
        const after = Math.abs(row.committed - task.effort - row.even.committed) + Math.abs(candidate.committed + task.effort - candidate.even.committed);
        const improvement = before - after;
        if (improvement <= 0.25) continue;

        moves.push({
          kind: "move",
          taskId: task.id,
          taskTitle: task.title,
          taskEffort: task.effort,
          taskDueAt: task.dueAt,
          taskStatus: task.status,
          fromId: row.id,
          fromName: row.name,
          toId: candidate.id,
          toName: candidate.name,
          fitScore: round(fit.score, 3),
          improvement: round(improvement, 2),
          fromAfterHours: round(row.committed - task.effort, 2),
          toAfterHours: round(candidate.committed + task.effort, 2),
          evenHours: round(row.even.committed, 2),
          fit,
          // `candidate` here is a ledger row, not the shaped member, so the owed
          // figure is computed rather than read: the shaped member's `owedHours`
          // is written after this runs.
          reason: (() => {
            const owed = round(candidate.even.committed - candidate.committed, 2);
            return (
              `${candidate.name} is ${round(Math.abs(owed))}h ${owed > 0 ? "short of" : "past"} an even share ` +
              `and this task matches them at ${Math.round(fit.score * 100)}%.`
            );
          })(),
        });
      }
    }
  }

  // Work nobody has taken on yet is the cheapest thing to fix, so it is offered
  // as its own kind of suggestion rather than folded in with moving tasks.
  for (const task of orphans) {
    for (const candidate of rows) {
      if (candidate.remainingCapacity - task.effort < 0) continue;
      const fit = fitOf(task, candidate);
      if (fit.score < 0.3) continue;
      const before = Math.abs(candidate.committed - candidate.even.committed);
      const after = Math.abs(candidate.committed + task.effort - candidate.even.committed);
      moves.push({
        kind: "fill",
        taskId: task.id,
        taskTitle: task.title,
        taskEffort: task.effort,
        taskDueAt: task.dueAt,
        taskStatus: task.status,
        fromId: null,
        fromName: null,
        toId: candidate.id,
        toName: candidate.name,
        fitScore: round(fit.score, 3),
        improvement: round(before - after, 2),
        fromAfterHours: null,
        toAfterHours: round(candidate.committed + task.effort, 2),
        evenHours: round(candidate.even.committed, 2),
        fit,
        reason: `${candidate.name} has ${round(candidate.headroom)}h of headroom left and matches this task at ${Math.round(fit.score * 100)}%.`,
      });
    }
  }

  return moves
    .sort((a, b) => b.improvement - a.improvement || b.fitScore - a.fitScore)
    .filter((move, index, list) => list.findIndex((m) => m.taskId === move.taskId && m.toId === move.toId) === index)
    .slice(0, 12);
}

/** The equity history, week by week, for the trend chart. */
export function equityHistory(projectId) {
  return all(`SELECT week, taken_at, score, gini, payload FROM equity_snapshots WHERE project_id = ? ORDER BY taken_at`, projectId).map(
    (row) => ({
      week: row.week,
      takenAt: row.taken_at,
      score: row.score,
      gini: row.gini,
      members: row.payload ? (JSON.parse(row.payload).members ?? null) : null,
    }),
  );
}

/** Write today's position into the history, replacing this week's row if it exists. */
export function recordSnapshot(ctx, equity, takenAt = new Date()) {
  const week = weekKey(takenAt);
  run(
    `INSERT INTO equity_snapshots (id, project_id, taken_at, week, score, gini, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (project_id, week) DO UPDATE SET score = excluded.score, gini = excluded.gini, payload = excluded.payload, taken_at = excluded.taken_at`,
    newId("snap"),
    ctx.project.id,
    takenAt.toISOString(),
    week,
    equity.score,
    equity.distribution.gini,
    JSON.stringify({ members: equity.members.map((m) => ({ id: m.id, credited: m.credited, committed: m.committed })), parts: equity.parts }),
  );
  return week;
}

/** Which skills this project leans on, so effort with no coverage is visible. */
export function requiredSkillDemand(tasks) {
  const demand = new Map();
  for (const task of tasks) {
    for (const req of task.required) {
      const entry = demand.get(req.slug) || { slug: req.slug, weight: 0, hours: 0, tasks: [] };
      entry.weight += req.weight;
      entry.hours += task.effort;
      entry.tasks.push(task.id);
      demand.set(req.slug, entry);
    }
  }
  return [...demand.values()].sort((a, b) => b.weight - a.weight);
}