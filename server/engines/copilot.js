/**
 * The copilot.
 *
 * Answers questions about a project or a class by reading the same engine output
 * everything else reads. There is no model in the loop and there is no prose it
 * could invent: every sentence it produces is assembled from a number that was
 * computed a moment earlier, and every answer carries the figures behind it.
 *
 * That constraint is the feature. A student asking "am I doing enough?" deserves
 * the actual hours, not an encouraging paragraph.
 */
import { all, get } from "../db.js";
import { loadProject, loadRoster } from "./context.js";
import { computeEquity } from "./equity.js";
import { bestFor } from "./allocator.js";
import { personalNudges, classroomNudges, summarise } from "./nudges.js";
import { round } from "../util.js";

const has = (text, ...words) => words.some((w) => text.includes(w));

/** Which project is on this person's mind? */
export function pickProject(userId, projectId) {
  if (projectId) return loadProject(projectId);
  const rows = all(
    `SELECT p.id FROM projects p
       JOIN project_members pm ON pm.user_id = p.id
      WHERE pm.user_id = ? AND p.status IN ('active','review')
      ORDER BY p.due_at IS NULL, p.due_at LIMIT 6`,
    userId,
  );
  if (!rows.length) return null;
  let best = null;
  for (const row of rows) {
    const ctx = loadProject(row.id);
    if (!ctx) continue;
    const equity = computeEquity(ctx);
    const weight = equity.flags.filter((f) => f.severity === "critical").length * 3 + equity.flags.length;
    if (!best || weight > best.weight) best = { ctx, equity, weight };
  }
  return best ? { ...best.ctx, equity: best.equity } : null;
}

export function ask(question, { userId, projectId = null, classroomId = null } = {}) {
  const text = String(question || "").toLowerCase().trim();
  const facts = [];
  const actions = [];

  // ---- a class question ---------------------------------------------------
  if (classroomId || has(text, "class", "my students", "the cohort", "everyone")) {
    const classroom = classroomId ? get(`SELECT * FROM classrooms WHERE id = ?`, classroomId) : null;
    if (classroom) return answerClassroom(question, text, classroom);
  }

  const ctx = pickProject(userId, projectId);
  if (!ctx) {
    return {
      intent: "none",
      answer: "You are not on a project yet. Start one, or join a class with the code your teacher gave you.",
      facts: [],
      actions: [
        { label: "Start a project", href: "/projects/new" },
        { label: "Join a class", href: "/join" },
      ],
    };
  }

  const equity = ctx.equity ?? computeEquity(ctx);
  const me = equity.members.find((m) => m.id === userId) ?? null;
  const name = ctx.project.name;

  const link = (panel) => `/projects/${ctx.project.id}${panel ? `?panel=${panel}` : ""}`;

  // ---- who is carrying too much ------------------------------------------
  if (has(text, "too much", "overload", "carrying", "drowning", "over capacity", "struggling")) {
    const over = equity.members.filter((m) => m.open > m.remainingCapacity).sort((a, b) => b.open - b.remainingCapacity - (a.open - a.remainingCapacity));
    if (!over.length) {
      return {
        intent: "overload",
        answer: `Nobody in ${name} is past what they can finish before the deadline. The heaviest load is ${equity.members[0]?.name} at ${equity.members[0]?.open}h of open work.`,
        facts: equity.members.slice(0, 4).map((m) => ({ label: m.name, value: `${m.open}h open · ${m.remainingCapacity}h of time left` })),
        actions: [{ label: "See the split", href: link("equity") }],
      };
    }
    for (const m of over) facts.push({ label: m.name, value: `${m.open}h open against ${m.remainingCapacity}h of time left — ${m.weeksNeeded} weeks of capacity` });
    const fix = equity.suggestions[0];
    return {
      intent: "overload",
      answer:
        `${over.length === 1 ? over[0].name + " is" : `${over.map((m) => m.name).join(" and ")} are`} past what they can finish: ` +
        over.map((m) => `${m.open}h of open work with ${m.remainingCapacity}h of time left`).join(", ") +
        "." +
        (fix ? ` Moving “${fix.taskTitle}” to ${fix.toName} would even it out — ${fix.reason}` : " There is no move that clearly helps, so the deadline or the scope has to give."),
      facts,
      actions: fix ? [{ label: "Review that move", href: link("equity") }] : [{ label: "See the split", href: link("equity") }],
    };
  }

  // ---- is it fair ---------------------------------------------------------
  if (has(text, "fair", "even", "equal", "balance", "gini", "equity", "who is doing", "shared", "split")) {
    const top = equity.members[0];
    const bottom = [...equity.members].sort((a, b) => a.credited - b.credited)[0];
    for (const m of equity.members) facts.push({ label: m.name, value: `${round(m.credited)}h delivered · ${Math.round(m.shares.credited * 100)}% of the group` });
    return {
      intent: "fairness",
      answer:
        `${name} scores ${equity.score}/100 on equity, and effort is spread with a Gini of ${equity.distribution.gini}. ${equity.headline} ` +
        `The even share is ${round(equity.totals.committed / Math.max(1, equity.members.length))}h each; ` +
        (top && bottom ? `${top.name} is at ${round(top.committed)}h and ${bottom.name} at ${round(bottom.committed)}h.` : ""),
      facts,
      actions: [{ label: "Open the equity panel", href: link("equity") }],
    };
  }

  // ---- late or at risk ---------------------------------------------------
  if (has(text, "late", "overdue", "risk", "deadline", "on track", "behind", "slipping", "slip")) {
    const now = Date.now();
    const risky = ctx.tasks
      .filter((t) => t.status !== "done")
      .filter((t) => {
        if (!t.dueAt) return false;
        const owner = equity.members.find((m) => m.id === t.assigneeId);
        const days = (new Date(t.dueAt).getTime() - now) / 86_400_000;
        return days < 0 || (days <= 5 && (!owner || owner.open > owner.remainingCapacity));
      })
      .sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""));
    if (!risky.length) {
      return {
        intent: "risk",
        answer: `Nothing in ${name} is at risk right now. ${equity.totals.done} of ${equity.totals.tasks} tasks are done, ${round(equity.totals.open)}h of work is open, and ${equity.timeline.daysLeft ?? "—"} days are left.`,
        facts: [
          { label: "Progress", value: `${Math.round(equity.timeline.actualProgress * 100)}% delivered against ${Math.round(equity.timeline.elapsed * 100)}% of the time used` },
          { label: "Open work", value: `${round(equity.totals.open)}h` },
        ],
        actions: [{ label: "Open the board", href: link("board") }],
      };
    }
    for (const t of risky.slice(0, 5)) {
      const owner = equity.members.find((m) => m.id === t.assigneeId);
      const days = round((new Date(t.dueAt).getTime() - now) / 86_400_000, 1);
      facts.push({ label: t.title, value: `${owner ? owner.name : "nobody"} · ${days < 0 ? `${Math.abs(days)} days late` : `${days} days left`} · ${t.effort}h` });
    }
    return {
      intent: "risk",
      answer:
        `${risky.length} task${risky.length === 1 ? "" : "s"} in ${name} need attention. ` +
        (equity.timeline.daysLeft !== null
          ? `${Math.round(equity.timeline.actualProgress * 100)}% of the work is delivered with ${equity.timeline.daysLeft} days left, and an even pace would be ${Math.round(equity.timeline.elapsed * 100)}%.`
          : "There is no deadline set, so nothing is technically late."),
      facts,
      actions: [{ label: "Open the board", href: link("board") }],
    };
  }

  // ---- who is not pulling their weight ----------------------------------
  if (has(text, "not doing", "lazy", "free rider", "freeload", "skiving", "owe", "shoulder", "who owes")) {
    const owing = equity.members.filter((m) => m.owedCreditedHours > 0.5).sort((a, b) => b.owedCreditedHours - a.owedCreditedHours);
    for (const m of equity.members) facts.push({ label: m.name, value: `${round(m.credited)}h delivered of an even ${round(m.even.credited)}h` });
    if (!owing.length) {
      return {
        intent: "owing",
        answer: `Nobody in ${name} is materially behind an even share. ${equity.headline}`,
        facts,
        actions: [{ label: "See the split", href: link("equity") }],
      };
    }
    const worst = owing[0];
    const silent = worst.daysSinceSignal;
    return {
      intent: "owing",
      answer:
        `${owing.length === 1 ? owing[0].name + " is" : `${owing.map((m) => m.name).join(", ")} are`} behind the even share, measured on work actually delivered rather than work taken on. ` +
        `${worst.name} is ${round(worst.owedCreditedHours)}h short` +
        (silent !== null ? `, and has not contributed or checked in for ${silent} days.` : ".") +
        ` An even share is ${round(equity.totals.credited / Math.max(1, equity.members.length))}h of delivered work. ` +
        (equity.unassigned.length ? `There is ${round(equity.totals.unassigned)}h with no owner, which is the easy thing to hand over.` : ""),
      facts,
      actions: [{ label: "See what is unclaimed", href: link("equity") }],
    };
  }

  // ---- what should I do next --------------------------------------------
  if (has(text, "what should i", "next", "my task", "start with", "priority", "today", "focus", "should i do")) {
    if (!me) {
      return { intent: "next", answer: "You are not on this project's team, so I cannot suggest anything for you here.", facts: [], actions: [] };
    }
    const open = [...me.openTasks].sort((a, b) => (a.dueAt || "9999").localeCompare(b.dueAt || "9999"));
    if (!open.length) {
      const unclaimed = equity.unassigned[0];
      return {
        intent: "next",
        answer: unclaimed
          ? `You have nothing open in ${name}. ${round(equity.totals.unassigned)}h of work has nobody on it — “${unclaimed.title}” is the one that matters most.`
          : `You have nothing open in ${name}, and nothing is unclaimed. That is genuinely finished on your side.`,
        facts: [{ label: "Your delivered work", value: `${round(me.credited)}h of an even ${round(me.even.credited)}h` }],
        actions: unclaimed ? [{ label: "Take it", href: link("board") }] : [{ label: "Check the board", href: link("board") }],
      };
    }
    const first = open[0];
    for (const t of open.slice(0, 4)) facts.push({ label: t.title, value: `${t.effort}h · ${t.status} · ${t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 10) : "no date"}` });
    return {
      intent: "next",
      answer:
        `Start with “${first.title}”, ${first.effort}h${first.dueAt ? `, due ${new Date(first.dueAt).toISOString().slice(0, 10)}` : ""}. ` +
        `You have ${round(me.open)}h open against ${round(me.remainingCapacity)}h of time before the deadline, which is ${me.open > me.remainingCapacity ? "more than you can finish — say so now rather than later" : "comfortably doable"}. ` +
        `You have delivered ${round(me.credited)}h against an even share of ${round(me.even.credited)}h.`,
      facts,
      actions: [{ label: "Open it", href: `${link("board")}&task=${first.id}` }],
    };
  }

  // ---- nobody has taken this --------------------------------------------
  if (has(text, "nobody", "unassigned", "no owner", "unclaimed", "who can take", "who should do", "who should take")) {
    if (!equity.unassigned.length) {
      return {
        intent: "unassigned",
        answer: `Every task in ${name} has an owner. ${equity.totals.open} are open, ${equity.totals.done} are done.`,
        facts: [],
        actions: [{ label: "Open the board", href: link("board") }],
      };
    }
    const target = equity.unassigned[0];
    const task = ctx.tasks.find((t) => t.id === target.id);
    const ranked = task ? bestFor(ctx, equity, task) : null;
    for (const t of equity.unassigned.slice(0, 5)) facts.push({ label: t.title, value: `${t.effort}h · ${t.phase}` });
    return {
      intent: "unassigned",
      answer:
        `${equity.unassigned.length} task${equity.unassigned.length === 1 ? "" : "s"} in ${name} have no owner, worth ${round(equity.totals.unassigned)}h. ` +
        (ranked?.recommended
          ? `For “${target.title}” the best fit is ${ranked.recommended.name}: ${ranked.recommended.rationale}`
          : ""),
      facts,
      actions: [{ label: "Assign them", href: link("board") }],
    };
  }

  // ---- general state ----------------------------------------------------
  const counts = summarise(personalNudges(userId));
  return {
    intent: "summary",
    answer:
      `${name} is ${Math.round((equity.totals.done / Math.max(1, equity.totals.tasks)) * 100)}% done: ${equity.totals.done} of ${equity.totals.tasks} tasks, ` +
      `${round(equity.totals.open)}h still open across ${equity.members.length} people. Equity scores ${equity.score}/100 and ${equity.headline.toLowerCase()} ` +
      `You have ${counts.total} thing${counts.total === 1 ? "" : "s"} flagged, ${counts.critical} of them urgent.`,
    facts: [
      { label: "Delivered", value: `${round(equity.totals.credited)}h of ${round(equity.totals.committed)}h taken on` },
      { label: "Even share", value: `${round(equity.totals.committed / Math.max(1, equity.members.length))}h each` },
      { label: "Unclaimed", value: `${round(equity.totals.unassigned)}h` },
      { label: "Days left", value: equity.timeline.daysLeft === null ? "no deadline" : String(equity.timeline.daysLeft) },
    ],
    actions: [
      { label: "Open the board", href: link("board") },
      { label: "See the split", href: link("equity") },
    ],
  };
}

function answerClassroom(question, text, classroom) {
  const projects = all(`SELECT id, name FROM projects WHERE classroom_id = ? AND status != 'archived'`, classroom.id);
  const roster = loadRoster(classroom.id);
  const equities = projects.map((p) => ({ name: p.name, id: p.id, equity: computeEquity(loadProject(p.id)) }));
  const nudges = classroomNudges(classroom.id);
  const counts = summarise(nudges);
  const meanScore = round(equities.reduce((a, e) => a + e.equity.score, 0) / Math.max(1, equities.length), 1);
  const worst = [...equities].sort((a, b) => a.equity.score - b.equity.score)[0];
  const best = [...equities].sort((a, b) => b.equity.score - a.equity.score)[0];
  const behind = [];

  for (const e of equities) {
    for (const m of e.equity.members) {
      if (m.owedCreditedHours > 2) behind.push({ name: m.name, owed: m.owedCreditedHours, project: e.name, id: m.id });
    }
  }
  behind.sort((a, b) => b.owed - a.owed);

  const facts = equities.map((e) => ({ label: e.name, value: `${e.equity.score}/100 · Gini ${e.equity.distribution.gini} · ${e.equity.totals.done}/${e.equity.totals.tasks} done` }));
  for (const entry of behind.slice(0, 4)) facts.push({ label: entry.name, value: `${round(entry.owed)}h behind in ${entry.project}` });

  const answer =
    `${classroom.name} has ${projects.length} group${projects.length === 1 ? "" : "s"} across ${roster.length} students, averaging ${meanScore}/100 on equity. ` +
    (best && worst && best.id !== worst.id
      ? `${best.name} is the most even at ${best.equity.score}; ${worst.name} needs the most attention at ${worst.equity.score} — ${worst.equity.headline.toLowerCase()} `
      : "") +
    `${counts.critical} thing${counts.critical === 1 ? "" : "s"} need you urgently and ${counts.warn} more are worth a look. ` +
    (behind.length ? `${behind.length} student${behind.length === 1 ? " is" : "s are"} more than 2h behind an even share, starting with ${behind[0].name}.` : "Nobody is materially behind on delivered work.");

  return {
    intent: "classroom",
    answer,
    facts,
    actions: [
      { label: "Open the class console", href: `/classrooms/${classroom.id}` },
      { label: "See who needs help", href: `/classrooms/${classroom.id}?panel=attention` },
    ],
  };
}

/**
 * Questions worth asking right now, chosen from the actual state. A fixed list of
 * suggested prompts is worse than none: it teaches people the tool has nothing
 * to say.
 */
export function starterQuestions(userId, projectId = null, classroomId = null) {
  if (classroomId) {
    const nudges = classroomNudges(classroomId);
    const out = ["How is the class doing overall?"];
    if (nudges.some((n) => n.kind === "student-behind")) out.push("Who is behind on delivered work?");
    if (nudges.some((n) => n.kind === "student-overloaded")) out.push("Who has too much on?");
    if (nudges.some((n) => n.kind === "unplaced")) out.push("Who is not in a group yet?");
    out.push("Which group is least even?");
    return out.slice(0, 5);
  }

  const ctx = pickProject(userId, projectId);
  if (!ctx) return ["What should I do next?"];
  const equity = ctx.equity ?? computeEquity(ctx);
  const out = ["What should I do next?"];
  if (equity.members.some((m) => m.open > m.remainingCapacity)) out.push("Who has too much on?");
  if (equity.distribution.gini > 0.2) out.push("Is the work split fairly?");
  if (equity.unassigned.length) out.push("What has nobody taken?");
  if (equity.members.some((m) => m.owedCreditedHours > 1)) out.push("Who is not pulling their weight?");
  if (equity.flags.some((f) => f.kind === "overdue" || f.kind === "behind")) out.push("What is at risk?");
  if (out.length < 3) out.push("Is the work split fairly?", "What is at risk?");
  return [...new Set(out)].slice(0, 5);
}