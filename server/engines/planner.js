/**
 * The planner.
 *
 * Turns a project brief into a task list. Not a language model: a library of
 * what each kind of deliverable actually involves, matched against the words in
 * the brief, then scaled to the hours this particular team really has.
 *
 * The important part is that it is destroyed easily. Every task it produces
 * records which words caused it, so a team can see why the list looks like this
 * and delete what does not apply. A plan you cannot argue with is a plan nobody
 * follows.
 */
import { PATTERNS, STEWARDSHIP, PHASES, PHASE_WINDOW, PHASE_BY_ID, matchPatterns } from "../data/templates.js";
import { clamp, quarter, round, newId, nowIso, DAY, sentenceList } from "../util.js";

const PHASE_ORDER = PHASES.map((p) => p.id);

/** A project with a brief that mentions nothing recognisable still needs a plan. */
const FALLBACK = {
  id: "generic",
  tasks: [
    { title: "Agree what we are making", detail: "One paragraph, written down, that everyone agrees with.", phase: "discover", load: 2, skills: [["planning", 3], ["subject", 1]] },
    { title: "Break the work into pieces", detail: "Every piece small enough to finish in a week.", phase: "define", load: 3, skills: [["planning", 3]] },
    { title: "Do the main work", detail: "The biggest chunk. Start it before it is comfortable to start.", phase: "build", load: 12, skills: [["subject", 3]] },
    { title: "Review it together", detail: "Read the whole thing at once, as a stranger would.", phase: "review", load: 4, skills: [["reviewing", 3], ["editing", 2]] },
    { title: "Hand it in", detail: "Files named properly, everything in one place.", phase: "ship", load: 3, skills: [["documenting", 3], ["logistics", 2]] },
  ],
};

/**
 * @param {object} input
 * @param {string} input.brief
 * @param {number} input.members          number of people
 * @param {number} input.totalCapacity    sum of weekly hours available
 * @param {string|null} input.dueAt
 * @param {number} [input.utilisation]    0.6 = people are not machines
 * @param {number} [input.now]
 */
export function planProject({ brief = "", members = 1, totalCapacity = 8, dueAt = null, utilisation = 0.6, now = Date.now() }) {
  const hits = matchPatterns(brief);
  const usesFallback = hits.length === 0;

  const chosen = [];
  const evidence = new Map(); // task title -> the words that caused it
  const sourceOf = new Map(); // task title -> pattern id

  const addTasks = (pattern) => {
    for (const task of pattern.tasks) {
      if (chosen.some((t) => t.title === task.title)) continue;
      chosen.push({ ...task });
      sourceOf.set(task.title, pattern.id);
    }
  };

  if (usesFallback) {
    addTasks(FALLBACK);
  } else {
    // Cap at four patterns: beyond that the list stops describing the project
    // and starts describing every project.
    for (const hit of hits.slice(0, 4)) {
      for (const task of hit.pattern.tasks) {
        if (chosen.some((t) => t.title === task.title)) continue;
        chosen.push({ ...task });
        sourceOf.set(task.title, hit.pattern.id);
        evidence.set(task.title, hit.evidence);
      }
    }
  }

  // The work nobody claims unless it is written down.
  for (const task of STEWARDSHIP) {
    if (chosen.some((t) => t.title === task.title)) continue;
    chosen.push({ ...task });
    sourceOf.set(task.title, "stewardship");
  }

  // A list with fewer than two tasks per person cannot be divided fairly, so the
  // largest pieces are split until it can.
  let target = Math.max(chosen.length, members * 2);
  let guard = 0;
  while (chosen.length < target && guard++ < 12) {
    const biggest = chosen.reduce((a, b) => (b.load > a.load ? b : a));
    if (biggest.load < 4) break;
    const half = Math.round(biggest.load * 0.5);
    biggest.load -= half;
    const part = chosen.find((t) => t.title === biggest.title);
    part.title = `${part.title} — first half`;
    chosen.push({ ...biggest, title: `${biggest.title} — second half`, load: half, phase: biggest.phase, skills: biggest.skills });
    sourceOf.set(`${biggest.title} — second half`, sourceOf.get(biggest.title) || "split");
    target = Math.max(chosen.length, members * 2);
  }

  // Scale to the hours the team actually has. Everyone is at 60% of their stated
  // capacity by default: a plan that assumes otherwise is a plan that slips.
  const durationDays = dueAt ? Math.max(1, (new Date(dueAt).getTime() - now) / DAY) : 28;
  const weeks = Math.max(0.5, durationDays / 7);
  const available = Math.max(4, totalCapacity * weeks * utilisation);
  const totalLoad = chosen.reduce((a, t) => a + t.load, 0) || 1;
  const scale = available / totalLoad;

  const tasks = chosen.map((task, index) => {
    const upcoming = PHASE_WINDOW[task.phase] ?? [0.3, 0.8];
    const due = new Date(now + durationDays * upcoming[1] * DAY);
    return {
      id: newId("tsk", now + index),
      title: task.title,
      detail: task.detail,
      phase: task.phase,
      effort: Math.max(1, quarter(clamp(task.load * scale, 1, 40))),
      priority: task.phase === "ship" ? 1 : task.phase === "review" ? 2 : 2,
      dueAt: due.toISOString(),
      required: task.skills.map(([slug, weight]) => ({ slug, weight })),
      dependsOn: [],
      deliverable: "",
      needsReview: task.phase === "ship" || task.phase === "review",
      position: index * 1000,
      source: sourceOf.get(task.title) || "generic",
      evidence: evidence.get(task.title) || [],
    };
  });

  // Only one dependency is declared, and it is the one that matters: nothing is
  // submitted until the pieces it is made of exist.
  const shipIds = tasks.filter((t) => t.phase === "ship").map((t) => t.id);
  const buildIds = tasks.filter((t) => t.phase === "build" || t.phase === "review").map((t) => t.id);
  for (const task of tasks) if (shipIds.includes(task.id)) task.dependsOn = buildIds.filter((id) => id !== task.id);

  tasks.sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || b.effort - a.effort);
  tasks.forEach((t, i) => {
    t.position = i * 1000;
  });

  const byPhase = PHASES.map((phase) => ({
    ...phase,
    tasks: tasks.filter((t) => t.phase === phase.id).length,
    hours: round(
      tasks.filter((t) => t.phase === phase.id).reduce((a, t) => a + t.effort, 0),
      1,
    ),
  })).filter((p) => p.tasks > 0);

  return {
    tasks,
    meta: {
      createdFrom: usesFallback ? "generic" : hits.slice(0, 4).map((h) => h.pattern.id),
      matchedWords: [...new Set(hits.flatMap((h) => h.evidence))].slice(0, 14),
      totalHours: round(tasks.reduce((a, t) => a + t.effort, 0), 1),
      perMemberHours: round(tasks.reduce((a, t) => a + t.effort, 0) / Math.max(1, members), 1),
      availableHours: round(available, 1),
      utilisation,
      weeks: round(weeks, 1),
      phases: byPhase,
      fallback: usesFallback,
      notes: planNotes({ tasks, members, available, usedFallback: usesFallback, matchedWords: hits.flatMap((h) => h.evidence) }),
    },
  };
}

function planNotes({ tasks, members, available, usedFallback, matchedWords }) {
  const notes = [];
  const hours = tasks.reduce((a, t) => a + t.effort, 0);
  if (usedFallback) {
    notes.push("The brief did not name a particular kind of deliverable, so this is a general shape. Edit it to match what you are actually making.");
  } else {
    notes.push(`Built from ${sentenceList([...new Set(matchedWords)].slice(0, 4).map((w) => `“${w}”`))} in your brief.`);
  }
  notes.push(`${round(hours)}h of work for ${members} people, which is ${round(hours / Math.max(1, members))}h each.`);
  notes.push(`That assumes ${round(available)}h of real working time between everyone — about 60% of the hours people said they had, because nobody works at 100%.`);
  const heaviest = [...tasks].sort((a, b) => b.effort - a.effort)[0];
  if (heaviest && heaviest.effort > hours / Math.max(1, members) * 1.4) {
    notes.push(`“${heaviest.title}” is the one to watch at ${heaviest.effort}h — it is the largest single piece and everything else waits on it.`);
  }
  return notes;
}

export { PHASE_BY_ID, PHASES, PATTERNS };
export const planSummary = (plan) => `${plan.tasks.length} tasks, ${plan.meta.totalHours}h, ${plan.meta.perMemberHours}h each.`;
export { nowIso };