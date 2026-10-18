/**
 * The allocator.
 *
 * Decides who a task should go to, and — just as importantly — explains itself.
 * Six things are weighed, each of them a real property of the situation rather
 * than a preference: can this person do it, does taking it move them toward an
 * even share, can they fit it in before it is due, does it suit the context they
 * are already in, would they learn something, and does the project's policy let
 * this happen at all.
 *
 * Nothing here assigns silently. It ranks, prices and justifies; a person
 * presses the button.
 */
import { fitSkills, describeFit, growthOpportunity } from "./skills.js";
import { clamp, round, gini, hoursUntil } from "../util.js";

const WEEK_HOURS = 7 * 24;

const asMap = (skills) => (skills instanceof Map ? skills : new Map(skills.map((s) => [s.slug, s])));

/**
 * @param {object} ctx      loadProject() result
 * @param {object} equity   computeEquity() result for the same context
 * @param {object} task     a hydrated task
 * @param {object} [opts]
 */
export function rankCandidates(ctx, equity, task, opts = {}) {
  const { exclude = [], limit = 6, includeAssigned = false } = opts;
  const { config } = ctx;
  const weights = config.allocator;
  const excludeSet = new Set(exclude.map((id) => (typeof id === "string" ? id : id.id)));
  const evenOpen = equity.totals.open / Math.max(1, equity.members.length);
  const hoursToDue = hoursUntil(task.dueAt);

  const ranked = [];

  for (const member of equity.members) {
    if (!includeAssigned && excludeSet.has(member.id)) continue;
    const source = ctx.members.find((m) => m.id === member.id);
    if (!source) continue;
    const skills = asMap(source.skills);

    const fit = fitSkills(task.required, skills, { allowStretch: config.policy.allowStretch });
    const growth = growthOpportunity(task.required, skills);

    // Headroom: the best candidate is the one whose open load lands nearest to an
    // even share after taking this on. Both directions are penalised, because
    // handing work to someone with nothing to do is as wrong as overloading
    // someone, just less visible.
    const after = member.open + task.effort;
    const headroomFit = 1 - clamp(Math.abs(after - evenOpen) / Math.max(evenOpen, task.effort, 1), 0, 1);

    // Equity pull: does this person owe the project delivered work? This is the
    // force that stops the same three people doing everything.
    const pull = clamp(member.owedCreditedHours / Math.max(member.even.credited, 1), -1, 1);
    const equityPart = (pull + 1) / 2;

    // Deadline: their remaining hours before this task is due, against the work
    // that has to land by then — not just this task, everything already on them.
    let deadlineFit = 0.7;
    if (hoursToDue !== null) {
      const capacityBeforeDue = Math.max(0.5, member.capacity * Math.max(0.05, hoursToDue / WEEK_HOURS));
      const dueFirst = member.openTasks
        .filter((t) => t.dueAt && new Date(t.dueAt) <= new Date(task.dueAt))
        .reduce((a, t) => a + t.effort, 0);
      const pressure = (dueFirst + task.effort) / capacityBeforeDue;
      deadlineFit = clamp(1 - Math.max(0, pressure - 1) / 1.5, 0, 1);
    }

    // Continuity: someone already in this phase, or already holding a task that
    // needs the same skills, has the context loaded. Spreading work thinly over
    // many people is its own kind of waste.
    const samePhase = member.openTasks.some((t) => t.phase === task.phase) ? 0.6 : 0.25;
    const overlap = member.openTasks.some((t) => t.required.some((r) => task.required.some((q) => q.slug === r.slug))) ? 0.4 : 0.15;
    const fragmentation = clamp(1 - Math.max(0, member.openTasks.length - 4) / 6, 0.4, 1);
    const continuity = (samePhase + overlap) * fragmentation;

    const parts = {
      skill: round(fit.score, 4),
      headroom: round(headroomFit, 4),
      equity: round(equityPart, 4),
      deadline: round(deadlineFit, 4),
      continuity: round(continuity, 4),
      growth: round(growth.score, 4),
    };

    let raw = Object.entries(parts).reduce((a, [key, value]) => a + value * (weights[key] ?? 0), 0);

    const warnings = [];
    if (fit.stretch && !config.policy.allowStretch) {
      raw *= 0.15;
      warnings.push("Has not done this before, and the project is set to only assign work people have proven.");
    }
    if (fit.missing.length && fit.score < 0.4) {
      raw *= 0.6;
      warnings.push(`No experience in ${fit.missing.map((m) => m.name.toLowerCase()).join(" or ")}.`);
    }
    const projected = member.open + task.effort;
    const overBy = round(projected - member.remainingCapacity, 2);
    if (projected > member.remainingCapacity) {
      if (config.policy.enforceCapacity) raw *= 0.25;
      warnings.push(`${overBy}h past what they can realistically finish before the deadline.`);
    }
    for (const req of task.required) {
      const held = skills.get(req.slug);
      if (held && held.appetite >= 4 && held.level <= 2) {
        raw *= 0.85;
        warnings.push(`Has said they would rather not do ${req.slug.replace(/-/g, " ")}.`);
      }
    }
    if (member.role === "lead") raw *= 0.97; // the lead already carries the coordination

    const score = round(clamp(raw, 0, 1) * 100, 1);

    const points = [];
    if (fit.matched.length) points.push(describeFit(fit));
    points.push(
      member.owedCreditedHours > 0.25
        ? `${round(member.owedCreditedHours)}h short of an even share of delivered work`
        : `${round(Math.abs(member.owedCreditedHours))}h past an even share already`,
    );
    points.push(
      member.headroom >= task.effort
        ? `${round(member.headroom)}h of headroom before the deadline`
        : `${round(member.headroom)}h of headroom, less than the ${task.effort}h this needs`,
    );
    if (growth.score > 0.35) points.push(`would learn something: ${growth.headline}`);

    ranked.push({
      memberId: member.id,
      name: member.name,
      hue: member.hue,
      role: member.role,
      capacity: member.capacity,
      state: member.state,
      score,
      parts,
      rankedBy: Object.entries(parts)
        .sort((a, b) => b[1] * (weights[b[0]] ?? 0) - a[1] * (weights[a[0]] ?? 0))
        .map(([key]) => key)[0],
      fit,
      growth,
      warnings,
      rationale: points.join("; ") + ".",
      projection: {
        openAfter: round(projected, 2),
        evenOpen: round(evenOpen, 2),
        headroomAfter: round(member.headroom - task.effort, 2),
        weeksNeeded: round(projected / Math.max(1, member.capacity), 2),
      },
      currentLoad: { open: member.open, committed: member.committed, tasks: member.openTasks.length },
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.currentLoad.open - b.currentLoad.open);
  const trimmed = ranked.slice(0, limit);
  return {
    taskId: task.id,
    taskTitle: task.title,
    effort: task.effort,
    dueAt: task.dueAt,
    required: task.required,
    evenOpen: round(evenOpen, 2),
    candidates: trimmed,
    recommended: trimmed[0] ?? null,
    alternatives: trimmed.slice(1),
    summary: trimmed[0]
      ? `Best fit is ${trimmed[0].name} at ${trimmed[0].score}%. ${trimmed[0].rationale}`
      : "Nobody is available for this.",
  };
}

/**
 * Auto-assignment.
 *
 * Works through the tasks in the order they will actually hurt — earliest
 * deadline first, then priority — and gives each one to the best candidate, but
 * re-deciding after every placement. That matters: a greedy pass that scores
 * everyone once and does not update will hand four tasks to the same patient
 * person, which is exactly the failure the product exists to prevent.
 *
 * @param {object} ctx
 * @param {object} equity
 * @param {object} [opts]
 * @param {Array} [opts.tasks]     defaults to every unassigned task in ctx
 * @param {number} [opts.floor]    below this score, leave the task alone
 */
export function autoAssign(ctx, equity, opts = {}) {
  const { tasks = ctx.tasks.filter((t) => !t.assigneeId), floor = 26 } = opts;
  const { config } = ctx;
  const n = Math.max(1, equity.members.length);
  if (!n) return { assignments: [], unassigned: [], notes: ["There is nobody on this project yet."] };

  const state = equity.members.map((m) => ({
    ...m,
    even: { ...m.even },
    openTasks: [...m.openTasks],
  }));
  const totals = { open: equity.totals.open, committed: equity.totals.committed, credited: equity.totals.credited };

  const refresh = () => {
    totals.open = state.reduce((a, m) => a + m.open, 0);
    totals.committed = state.reduce((a, m) => a + m.committed, 0);
    for (const m of state) {
      m.even.open = totals.open / n;
      m.even.committed = totals.committed / n;
      m.headroom = round(m.remainingCapacity - m.open, 2);
      m.owedCreditedHours = round(m.even.credited - m.credited, 2);
      m.owedHours = round(m.even.committed - m.committed, 2);
      m.state = m.open > m.remainingCapacity ? "overloaded" : m.owedCreditedHours > 0.5 ? "behind" : "on-track";
    }
  };
  refresh();

  const order = [...tasks].sort(
    (a, b) =>
      (a.dueAt || "9999").localeCompare(b.dueAt || "9999") ||
      a.priority - b.priority ||
      b.effort - a.effort,
  );

  const giniBefore = gini(state.map((m) => m.committed));
  const assignments = [];
  const unassigned = [];

  for (const task of order) {
    const pseudo = { members: state, totals };
    const ranked = rankCandidates(ctx, pseudo, task, { limit: 3 });
    const best = ranked.recommended;

    if (!best || best.score < floor) {
      unassigned.push({
        taskId: task.id,
        title: task.title,
        effort: task.effort,
        reason: best
          ? `Nobody scores above ${floor}% for this. ${best.name} comes closest at ${best.score}%.`
          : "Nobody on this project can take it.",
      });
      continue;
    }

    const member = state.find((m) => m.id === best.memberId);
    member.open = round(member.open + task.effort, 2);
    member.committed = round(member.committed + task.effort, 2);
    member.openTasks.push({
      id: task.id,
      title: task.title,
      effort: task.effort,
      status: "todo",
      dueAt: task.dueAt,
      priority: task.priority,
      phase: task.phase,
      required: task.required,
    });
    refresh();

    assignments.push({
      taskId: task.id,
      taskTitle: task.title,
      effort: task.effort,
      dueAt: task.dueAt,
      userId: best.memberId,
      name: best.name,
      score: best.score,
      parts: best.parts,
      rationale: best.rationale,
      warnings: best.warnings,
      projection: best.projection,
      alternatives: ranked.alternatives.map((a) => ({ memberId: a.memberId, name: a.name, score: a.score })),
    });
  }

  const giniAfter = gini(state.map((m) => m.committed));
  const notes = [];
  if (assignments.length) {
    notes.push(
      `Placed ${assignments.length} task${assignments.length === 1 ? "" : "s"} and brought the spread of work from a Gini of ` +
        `${round(giniBefore, 2)} to about ${round(giniAfter, 2)}.`,
    );
    notes.push("Every placement is a suggestion until somebody accepts it — nothing has been written to the board yet.");
  } else {
    notes.push("Nothing was placed. Either every task already has an owner, or none of them fits anyone well enough.");
  }
  if (unassigned.length) notes.push(`${unassigned.length} task${unassigned.length === 1 ? "" : "s"} left without an owner.`);

  return {
    assignments,
    unassigned,
    notes,
    balance: { giniBefore: round(giniBefore, 4), giniAfter: round(giniAfter, 4), improved: giniAfter <= giniBefore },
    load: state.map((m) => ({ id: m.id, name: m.name, open: round(m.open, 2), even: round(m.even.open, 2), tasks: m.openTasks.length })),
  };
}

/** The single best person for one task, with the runners-up attached. */
export function bestFor(ctx, equity, task, opts = {}) {
  return rankCandidates(ctx, equity, task, { limit: 5, ...opts });
}