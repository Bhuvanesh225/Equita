/**
 * The demo dataset.
 *
 * A fairness product cannot be demonstrated with empty tables: every claim it
 * makes is a claim about a number, and a number needs a situation behind it. So
 * this builds a term's worth of real-looking work — a class of twelve, four
 * groups, a second class, one independent team of friends — with the awkward
 * cases deliberately included: someone carrying a group, someone who has gone
 * quiet, a group with no deadline pressure yet, and one group that is actually
 * working well.
 *
 * It is generated deterministically, from a fixed seed, so the same dataset
 * appears every time and a screenshot taken today still matches tomorrow.
 */
import { all, get, run, tx, insert } from "./db.js";
import { newId, nowIso, iso, DAY, HOUR, weekKey, round } from "./util.js";
import { hashPassword } from "./auth.js";
import { SKILLS, skillId } from "./data/skills.js";
import { DEFAULT_CLASSROOM_POLICY, DEFAULT_CONFIG, loadProject } from "./engines/context.js";
import { computeEquity } from "./engines/equity.js";
import { planProject } from "./engines/planner.js";
import { personalNudges, classroomNudges } from "./engines/nudges.js";
import { record } from "./events.js";
import { CLASSROOMS, PROJECTS, normalizeStory } from "./seed-stories.js";

/* ---------- deterministic randomness ------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261018);
const pick = (list) => list[Math.floor(rand() * list.length)];
const jitter = (base, spread) => base + (rand() - 0.5) * spread;

/* ---------- catalog ------------------------------------------------------ */

export function ensureSkillCatalog() {
  const existing = new Set(all(`SELECT slug FROM skills`).map((r) => r.slug));
  let added = 0;
  SKILLS.forEach((skill, index) => {
    if (existing.has(skill.slug)) return;
    insert("skills", {
      id: skillId(skill.slug),
      slug: skill.slug,
      name: skill.name,
      kind: skill.kind,
      cluster: skill.cluster,
      prompt: skill.prompt,
      position: index,
    });
    added++;
  });
  return added;
}

/* ---------- people ------------------------------------------------------- */

function makeUser({ name, email, role = "student", headline, school, capacity = 8, hue, skills = [] }) {
  const id = newId("usr", Date.now() - 40 * DAY);
  const createdAt = iso(Date.now() - 45 * DAY + rand() * 5 * DAY);
  insert("users", {
    id,
    name,
    email,
    password_hash: hashPassword("equita2026"),
    role,
    headline,
    school,
    hue: hue ?? Math.floor(rand() * 360),
    capacity,
    status: "active",
    created_at: createdAt,
    last_seen_at: iso(Date.now() - rand() * 2 * DAY),
  });
  for (const [slug, level, appetite] of skills) {
    if (!SKILLS.some((s) => s.slug === slug)) continue;
    insert("user_skills", { user_id: id, skill_id: skillId(slug), level, appetite: appetite ?? (rand() < 0.55 ? 1 : rand() < 0.8 ? 2 : 4), source: "self" });
  }
  return { id, name, email };
}

export function buildPeople() {
  const school = "Riverside Sixth Form";
  const teacher = makeUser({
    name: "Amara Okafor",
    email: "amara@equita.demo",
    role: "teacher",
    headline: "Head of Design & Systems",
    school,
    capacity: 20,
    hue: 168,
    skills: [["planning", 5, 1], ["facilitation", 5, 1], ["reviewing", 4, 1], ["presenting", 4, 2], ["subject", 5, 1]],
  });
  const teacher2 = makeUser({
    name: "Tobias Lund",
    email: "tobias@equita.demo",
    role: "teacher",
    headline: "Media Studies",
    school,
    capacity: 18,
    hue: 214,
    skills: [["photovideo", 5, 1], ["audio", 4, 1], ["reviewing", 4, 1], ["writing", 4, 2]],
  });

  const students = {
    maya: makeUser({
      name: "Maya Okonkwo",
      email: "maya@equita.demo",
      headline: "Reads everything, then argues with it",
      school,
      capacity: 9,
      hue: 152,
      skills: [["research", 5, 1], ["reading", 5, 1], ["writing", 4, 2], ["notes", 4, 1], ["statistics", 3, 2], ["editing", 3, 3]],
    }),
    priya: makeUser({
      name: "Priya Raman",
      email: "priya@equita.demo",
      headline: "Numbers, and asking whether they mean anything",
      school,
      capacity: 8,
      hue: 196,
      skills: [["analysis", 5, 1], ["statistics", 4, 1], ["spreadsheets", 5, 1], ["visualisation", 3, 2], ["modelling", 3, 2]],
    }),
    sam: makeUser({
      name: "Sam Whitfield",
      email: "sam@equita.demo",
      headline: "Builds it, then tries to break it",
      school,
      capacity: 8,
      hue: 264,
      skills: [["coding", 5, 1], ["backend", 4, 1], ["testing", 4, 1], ["frontend", 3, 2]],
    }),
    noor: makeUser({
      name: "Noor Haddad",
      email: "noor@equita.demo",
      headline: "Sets the type and picks the colour",
      school,
      capacity: 9,
      hue: 24 + 8,
      skills: [["illustration", 5, 1], ["brand", 4, 1], ["slides", 4, 1], ["ux", 4, 2], ["visualisation", 4, 1]],
    }),
    diego: makeUser({
      name: "Diego Marín",
      email: "diego@equita.demo",
      headline: "Happiest in the workshop",
      school,
      capacity: 7,
      hue: 32,
      skills: [["making", 5, 1], ["photovideo", 4, 1], ["logistics", 3, 2], ["lab", 3, 2]],
    }),
    grace: makeUser({
      name: "Grace Lindqvist",
      email: "grace@equita.demo",
      headline: "Runs the schedule and the money",
      school,
      capacity: 10,
      hue: 128,
      skills: [["planning", 5, 1], ["logistics", 5, 1], ["budgeting", 4, 1], ["facilitation", 4, 1], ["spreadsheets", 3, 2]],
    }),
    tom: makeUser({
      name: "Tom Achebe",
      email: "tom@equita.demo",
      headline: "Talks to anybody",
      school,
      capacity: 6,
      hue: 300,
      skills: [["presenting", 5, 1], ["facilitation", 4, 1], ["outreach", 4, 1], ["notes", 3, 3]],
    }),
    yusuf: makeUser({
      name: "Yusuf Demir",
      email: "yusuf@equita.demo",
      headline: "Careful with detail",
      school,
      capacity: 5,
      hue: 88,
      skills: [["subject", 4, 2], ["notes", 3, 2], ["reading", 3, 2], ["planning", 2, 3]],
    }),
    ana: makeUser({
      name: "Ana Duarte",
      email: "ana@equita.demo",
      headline: "Portuguese and English, and a good organiser",
      school,
      capacity: 8,
      hue: 340,
      skills: [["languages", 4, 1], ["writing", 3, 2], ["outreach", 3, 2], ["notes", 3, 2], ["editing", 3, 3]],
    }),
    lena: makeUser({
      name: "Lena Fischer",
      email: "lena@equita.demo",
      headline: "Writes it, then cuts it in half",
      school,
      capacity: 9,
      hue: 48,
      skills: [["writing", 5, 1], ["editing", 5, 1], ["reading", 4, 2], ["presenting", 4, 2]],
    }),
    aisha: makeUser({
      name: "Aisha Bello",
      email: "aisha@equita.demo",
      headline: "Works out the screens first",
      school,
      capacity: 7,
      hue: 172,
      skills: [["ux", 5, 1], ["frontend", 4, 1], ["illustration", 3, 2], ["presenting", 3, 3]],
    }),
    ravi: makeUser({
      name: "Ravi Sharma",
      email: "ravi@equita.demo",
      headline: "Interfaces, mostly",
      school,
      capacity: 6,
      hue: 240,
      skills: [["frontend", 5, 1], ["coding", 4, 1], ["ux", 3, 2], ["testing", 3, 3]],
    }),
    kai: makeUser({
      name: "Kai Nakamura",
      email: "kai@equita.demo",
      headline: "Sound and picture",
      school,
      capacity: 8,
      hue: 288,
      skills: [["audio", 5, 1], ["photovideo", 5, 1], ["animation", 4, 1], ["editing", 3, 2]],
    }),
    imani: makeUser({
      name: "Imani Cole",
      email: "imani@equita.demo",
      headline: "Scripts first, always",
      school,
      capacity: 8,
      hue: 8,
      skills: [["writing", 5, 1], ["audio", 4, 1], ["editing", 4, 1], ["research", 3, 2]],
    }),
    bruno: makeUser({
      name: "Bruno Salas",
      email: "bruno@equita.demo",
      headline: "Behind a camera",
      school,
      capacity: 7,
      hue: 20,
      skills: [["photovideo", 4, 1], ["audio", 4, 1], ["animation", 3, 2]],
    }),
    hana: makeUser({
      name: "Hana Suzuki",
      email: "hana@equita.demo",
      headline: "Makes things move",
      school,
      capacity: 7,
      hue: 312,
      skills: [["animation", 5, 1], ["illustration", 4, 1], ["brand", 3, 2], ["visualisation", 3, 2]],
    }),
    oliver: makeUser({
      name: "Oliver Novak",
      email: "oliver@equita.demo",
      headline: "Interested in how things are reported",
      school,
      capacity: 8,
      hue: 104,
      skills: [["subject", 4, 1], ["presenting", 4, 2], ["writing", 3, 2], ["research", 3, 2]],
    }),
    june: makeUser({
      name: "June Abara",
      email: "june@equita.demo",
      headline: "Fixing bikes since she was twelve",
      school,
      capacity: 6,
      hue: 140,
      skills: [["making", 4, 1], ["logistics", 3, 2], ["outreach", 3, 2], ["brand", 2, 2]],
    }),
  };

  // A flat index as well as the grouped one, so every builder can look anyone up
  // by the short key their story uses ('maya', 'amara') without a resolve step.
  const byKey = { amara: teacher, tobias: teacher2, ...students };
  return { teacher, teacher2, students, school, byKey, ...byKey };
}

/* ---------- handing out the work ---------------------------------------- */

/**
 * Target-driven allocation.
 *
 * Each member is owed a share of the total hours, and every task goes to whoever
 * is furthest below their target at that moment. Picking at random per task is
 * tempting and produces a dataset that contradicts the situation it is meant to
 * describe: the person who is supposed to be carrying the group ends up with an
 * average load and the story disappears.
 *
 * Allocation happens in a shuffled order rather than in phase order, so everyone
 * ends up with a mix of finished and unfinished work. Assigning in phase order
 * would hand all the early, completed tasks to the person with the largest share
 * and leave the quiet member holding nothing but untouched work, which is too
 * tidy to be true.
 */
function makeAllocator(share, tasks) {
  const keys = Object.keys(share);
  const totalWeight = keys.reduce((a, k) => a + (share[k] ?? 1), 0) || 1;
  const totalHours = tasks.reduce((a, t) => a + t.effort, 0) || 1;
  const target = Object.fromEntries(keys.map((k) => [k, ((share[k] ?? 1) / totalWeight) * totalHours]));
  const given = Object.fromEntries(keys.map((k) => [k, 0]));
  return (task) => {
    let best = null;
    for (const key of keys) {
      // A little noise, so the pattern is not mechanically exact.
      const score = (target[key] - given[key]) * (1 + (rand() - 0.5) * 0.14);
      if (!best || score > best.score) best = { key, score };
    }
    given[best.key] += task.effort;
    return best.key;
  };
}

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ---------- classrooms -------------------------------------------------- */

export function buildClassrooms(people, stories) {
  const out = new Map();
  stories.forEach((spec, index) => {
    const teacher = people[spec.teacher];
    const createdAt = iso(Date.now() - (48 - index * 2) * DAY);
    const id = newId("cls", Date.now() - 48 * DAY);
    insert("classrooms", {
      id,
      name: spec.name,
      code: spec.code,
      subject: spec.subject,
      term: spec.term,
      owner_id: teacher.id,
      policy: JSON.stringify({ ...DEFAULT_CLASSROOM_POLICY, ...(spec.policy || {}) }),
      created_at: createdAt,
    });
    insert("enrollments", { id: newId("enr"), classroom_id: id, user_id: teacher.id, role: "teacher", created_at: createdAt });
    for (const key of spec.students) {
      insert("enrollments", {
        id: newId("enr"),
        classroom_id: id,
        user_id: people[key].id,
        role: "student",
        created_at: iso(Date.now() - (44 - rand() * 4) * DAY),
      });
    }
    out.set(spec.key, { id, spec, teacher });
  });
  return out;
}

/* ---------- one project, built from its story --------------------------- */

export function buildProject(people, classroom, rawStory, { planSummary } = {}) {
  const memberKeys = rawStory.members;
  const story = normalizeStory(rawStory, memberKeys);
  const lead = people[rawStory.lead];
  const createdAt = Date.now() - rawStory.createdDaysAgo * DAY;
  const dueAt = new Date(Date.now() + rawStory.dueInDays * DAY);
  const id = newId("prj", createdAt);
  const config = classroom
    ? JSON.parse(JSON.stringify(classroom.spec.policy ? { ...DEFAULT_CLASSROOM_POLICY, ...classroom.spec.policy } : DEFAULT_CLASSROOM_POLICY))
    : { ...DEFAULT_CONFIG };
  if (story.allowStretch !== undefined) config.policy.allowStretch = story.allowStretch;

  insert("projects", {
    id,
    name: story.name,
    brief: story.brief,
    mode: classroom ? "class" : "standalone",
    classroom_id: classroom?.id ?? null,
    owner_id: classroom ? classroom.teacher.id : lead.id,
    status: "active",
    due_at: dueAt.toISOString(),
    config: JSON.stringify(config),
    created_at: new Date(createdAt).toISOString(),
    updated_at: nowIso(),
  });

  memberKeys.forEach((key, index) => {
    insert("project_members", {
      project_id: id,
      user_id: people[key].id,
      role: key === rawStory.lead ? "lead" : "member",
      joined_at: iso(createdAt + (index + 1) * HOUR),
    });
  });

  /* tasks, from the real planner, planned at the moment the project began */
  const totalCapacity = memberKeys.reduce((a, key) => a + (get(`SELECT capacity FROM users WHERE id = ?`, people[key].id)?.capacity ?? 8), 0);
  const plan = planProject({
    brief: story.brief,
    members: memberKeys.length,
    totalCapacity,
    dueAt,
    utilisation: 0.25,
    now: createdAt,
  });
  planSummary?.(plan);

  const allocator = makeAllocator(story.share, plan.tasks);
  const doneCount = Math.round(plan.tasks.length * story.progress);
  const reviewCount = story.progress > 0.3 ? 1 : 0;
  const blockedCount = story.progress > 0.25 && story.progress < 0.7 ? 1 : 0;

  // First decide how far along each piece is, in phase order: a project works
  // from discovery forward, so the early phases are the ones that are finished.
  const draft = plan.tasks.map((task, index) => {
    let status = "todo";
    if (index < doneCount) status = "done";
    else if (index < doneCount + reviewCount) status = "review";
    else if (index < doneCount + reviewCount + 1) status = "doing";
    else if (index < doneCount + reviewCount + 1 + blockedCount) status = "blocked";

    // Work nobody has taken on sits in the later half, which is where it happens.
    const unassigned = index >= doneCount && rand() < story.unassignedFraction;

    let startedAt = null;
    let completedAt = null;
    if (status !== "todo") startedAt = iso(Math.max(createdAt, new Date(task.dueAt).getTime() - (2 + rand() * 6) * DAY));
    if (status === "done") {
      const due = new Date(task.dueAt).getTime();
      completedAt = iso(rand() < story.lateFraction ? due + (0.3 + rand() * 3) * DAY : due - (0.1 + rand() * 2.5) * DAY);
      if (new Date(completedAt).getTime() > Date.now() - 4 * HOUR) completedAt = iso(Date.now() - (4 + rand() * 20) * HOUR);
    }

    return { index, task, status, unassigned, startedAt, completedAt, ownerKey: null };
  });

  // Then hand the work out, in a shuffled order.
  for (const row of shuffled(draft)) {
    if (row.unassigned) continue;
    row.ownerKey = allocator(row.task);
  }

  const taskRows = draft.map((row) => {
    const { task, index, status, unassigned, startedAt, completedAt, ownerKey } = row;
    const owner = ownerKey ? people[ownerKey] : null;
    const taskId = newId("tsk", createdAt + index * 1000);

    insert("tasks", {
      id: taskId,
      project_id: id,
      title: task.title,
      detail: task.detail,
      phase: task.phase,
      status,
      assignee_id: owner?.id ?? null,
      effort: task.effort,
      priority: task.priority,
      due_at: task.dueAt,
      required_skills: JSON.stringify(task.required),
      depends_on: JSON.stringify(task.dependsOn ?? []),
      deliverable: status === "done" && rand() < 0.4 ? "link in the shared drive" : "",
      needs_review: task.needsReview ? 1 : 0,
      position: task.position,
      created_by: lead.id,
      created_at: iso(createdAt + index * 900),
      updated_at: completedAt ?? startedAt ?? iso(createdAt + index * 900),
      started_at: startedAt,
      completed_at: completedAt,
    });

    if (owner && status !== "todo") {
      insert("assignments", {
        id: newId("asg", createdAt + index * 1000),
        project_id: id,
        task_id: taskId,
        user_id: owner.id,
        kind: index === 0 ? "manual" : "auto",
        status: "active",
        score: round(52 + rand() * 38, 1),
        breakdown: "{}",
        rationale: index === 0 ? `${lead.name} set this up at the start.` : "Placed by the allocator against skills and headroom.",
        created_by: lead.id,
        created_at: iso(createdAt + index * 1000),
      });
    }

    return { taskId, index, status, owner, ownerKey, title: task.title, effort: task.effort, dueAt: task.dueAt, completedAt, phase: task.phase, unassigned };
  });

  /* the ledger: what was actually delivered, when */
  const silentIds = new Set(story.silent.map((key) => people[key].id));
  const silenceFloor = Date.now() - 9 * DAY;
  const memberOf = (key) => people[key];
  const contributors = new Map(memberKeys.map((key) => [key, []]));

  for (const row of taskRows) {
    if (row.status !== "done" || !row.ownerKey) continue;
    let at = row.completedAt;
    // A member who has gone quiet must not have a contribution from yesterday,
    // otherwise the dataset contradicts the situation it is meant to show.
    if (silentIds.has(row.owner.id) && new Date(at).getTime() > silenceFloor) {
      at = iso(silenceFloor - rand() * 6 * DAY);
      run(`UPDATE tasks SET completed_at = ? WHERE id = ?`, at, row.taskId);
    }
    contributors.get(row.ownerKey).push({ taskId: row.taskId, at, effort: row.effort });
    insert("contributions", {
      id: newId("con", new Date(at).getTime()),
      project_id: id,
      task_id: row.taskId,
      user_id: row.owner.id,
      kind: "complete",
      effort: row.effort,
      note: `completed “${row.title}”`,
      created_at: at,
    });
    record({
      verb: "task.done",
      subject: `${row.owner.name} finished “${row.title}” (${row.effort}h)`,
      projectId: id,
      actorId: row.owner.id,
      meta: { taskId: row.taskId, effort: row.effort },
      at,
      quiet: true,
    });
  }

  /* help that is not a task of your own — the work nobody records */
  const helpers = memberKeys.filter((key) => !silentIds.has(people[key].id));
  const helpNotes = [
    "read the whole draft through and marked it up",
    "sat with the analysis for an hour and found the bug",
    "redid the chart so it actually reads at the back of the room",
    "covered the interview when the other person could not make it",
    "rewrote the opening paragraph so it stops sounding like a memo",
  ];
  const helpCount = Math.max(1, Math.round(plan.tasks.length * 0.25));
  for (let i = 0; i < helpCount && helpers.length; i++) {
    const key = helpers[Math.floor(rand() * helpers.length)];
    const person = memberOf(key);
    const hours = round(0.5 + rand() * 2.5, 1);
    const at = iso(createdAt + rand() * (Date.now() - createdAt - (silentIds.has(person.id) ? 10 * DAY : 2 * DAY)));
    const safeAt = silentIds.has(person.id) && new Date(at).getTime() > silenceFloor ? iso(silenceFloor - rand() * 5 * DAY) : at;
    insert("contributions", {
      id: newId("con", new Date(safeAt).getTime()),
      project_id: id,
      task_id: null,
      user_id: person.id,
      kind: "help",
      effort: hours,
      note: pick(helpNotes),
      created_at: safeAt,
    });
    record({
      verb: "task.helped",
      subject: `${person.name} put ${hours}h in to help outside their own tasks`,
      projectId: id,
      actorId: person.id,
      meta: { hours },
      at: safeAt,
      quiet: true,
    });
  }

  /* weekly check-ins — the thing that makes silence visible */
  const moods = ["ahead", "steady", "steady", "behind", "stuck"];
  const checkinNotes = {
    ahead: ["ahead of where I thought I would be", "finished the piece I was worried about", "got more done than planned this week"],
    steady: ["carrying on, nothing blocked", "roughly where I expected to be", "quiet week but on track"],
    behind: ["slower than I wanted, but nothing is stopping me", "lost a couple of evenings, catching up", "running late on my part, will have it by the weekend"],
    stuck: ["waiting on something before I can carry on", "need someone to look at this with me"],
  };
  const blockerNotes = ["nothing", "nothing blocking me", "waiting on the shared folder", "need a decision on scope", "nothing right now"];
  const weeks = story.checkinWeeks ?? 3;
  for (let w = 0; w < weeks; w++) {
    const at = iso(Date.now() - w * 7 * DAY - rand() * 36 * HOUR);
    const week = weekKey(new Date(at));
    for (const key of memberKeys) {
      const person = memberOf(key);
      if (silentIds.has(person.id)) continue;
      const weight = story.share[key] ?? 1;
      const mood = weight > 1.45 ? (rand() < 0.55 ? "behind" : "steady") : weight < 0.7 ? pick(["steady", "behind", "stuck"]) : pick(moods);
      insert("checkins", {
        id: newId("chk", new Date(at).getTime()),
        project_id: id,
        user_id: person.id,
        week,
        mood,
        note: pick(checkinNotes[mood]),
        blockers: pick(blockerNotes),
        created_at: at,
      });
      insert("contributions", {
        id: newId("con", new Date(at).getTime()),
        project_id: id,
        task_id: null,
        user_id: person.id,
        kind: "progress",
        effort: 0,
        note: `check-in: ${mood}`,
        created_at: at,
      });
    }
  }

  /* conversation, including the mentions that pull somebody back in */
  const commentSeeds = [
    { body: "@NAME can you have a look at this before Thursday? I think the middle section is doing two jobs.", needs: 2 },
    { body: "Pushed a new version. The numbers changed after we dropped the two half-empty rows.", needs: 0 },
    { body: "I am not going to get to this until the weekend, sorry — flagging it now rather than later.", needs: 0 },
    { body: "@NAME the chart on slide 4 contradicts the table. One of them is wrong and I do not know which.", needs: 2 },
    { body: "Can we agree to stop adding things? Two weeks left and the list is still growing.", needs: 0 },
    { body: "Found a much better source for this — sending it over. It argues the opposite, which is useful.", needs: 1 },
    { body: "Marked this blocked. Cannot go further until we decide which site we are actually proposing.", needs: 0 },
    { body: "This is good. Genuinely. The opening is much stronger than last week's version.", needs: 0 },
  ];
  const speaking = memberKeys.filter((key) => !silentIds.has(people[key].id));
  const commentCount = Math.min(commentSeeds.length, Math.max(2, Math.round(plan.tasks.length * 0.35)));
  for (let i = 0; i < commentCount && speaking.length > 1; i++) {
    const seed = commentSeeds[i % commentSeeds.length];
    const authorKey = speaking[Math.floor(rand() * speaking.length)];
    const others = memberKeys.filter((key) => key !== authorKey);
    const mentioned = seed.needs ? others[Math.floor(rand() * others.length)] : null;
    const body = seed.body.replace(/@NAME/g, mentioned ? `@${people[mentioned].name.split(" ")[0]}` : "@someone");
    const target = taskRows.filter((r) => r.status !== "todo")[i % Math.max(1, taskRows.filter((r) => r.status !== "todo").length)];
    const at = iso(createdAt + rand() * (Date.now() - createdAt - (silentIds.has(people[authorKey].id) ? 10 * DAY : 2 * DAY)));
    const safeAt = silentIds.has(people[authorKey].id) && new Date(at).getTime() > silenceFloor ? iso(silenceFloor - rand() * 5 * DAY) : at;
    insert("comments", {
      id: newId("cmt", new Date(safeAt).getTime()),
      project_id: id,
      task_id: target?.taskId ?? null,
      author_id: people[authorKey].id,
      body,
      mentions: JSON.stringify(mentioned ? [people[mentioned].name.split(" ")[0].toLowerCase()] : []),
      created_at: safeAt,
    });
    record({
      verb: "comment",
      subject: `${people[authorKey].name} commented on “${target?.title ?? story.name}”`,
      projectId: id,
      actorId: people[authorKey].id,
      meta: { taskId: target?.taskId ?? null },
      at: safeAt,
      quiet: true,
    });
  }

  /* peer reviews, for the groups that are far enough along to have opinions */
  if (story.reviews && story.progress > 0.4) {
    for (const key of memberKeys) {
      const reviewer = memberOf(key);
      for (const otherKey of memberKeys) {
        if (otherKey === key) continue;
        const other = memberOf(otherKey);
        const weight = story.share[otherKey] ?? 1;
        const base = weight > 1.4 ? 5 : weight < 0.55 ? 2 : 4;
        insert("reviews", {
          id: newId("rev", createdAt + rand() * (Date.now() - createdAt)),
          project_id: id,
          reviewer_id: reviewer.id,
          subject_id: other.id,
          reliability: Math.max(1, Math.min(5, base + (rand() < 0.3 ? -1 : 0))),
          quality: Math.max(1, Math.min(5, base + (rand() < 0.35 ? -1 : 1))),
          teamwork: base,
          note: weight < 0.55 ? "Hard to tell — has not been around much this half of term." : weight > 1.4 ? "Carried most of this and never made a thing of it." : "Solid, reliable, no complaints.",
          created_at: iso(Date.now() - (3 + rand() * 8) * DAY),
        });
      }
    }
  }

  /* the project's own memory */
  record({ verb: "project.created", subject: `${lead.name} started “${story.name}”`, projectId: id, actorId: lead.id, at: new Date(createdAt).toISOString(), quiet: true });
  for (const key of memberKeys) {
    if (key === rawStory.lead) continue;
    record({
      verb: "member.added",
      subject: `${lead.name} added ${memberOf(key).name} to the team`,
      projectId: id,
      actorId: lead.id,
      at: iso(createdAt + (memberKeys.indexOf(key) + 1) * HOUR),
      quiet: true,
    });
  }
  for (const row of taskRows.filter((r) => r.status === "doing" || r.status === "blocked")) {
    const at = row.status === "blocked" ? iso(Date.now() - (2 + rand() * 5) * DAY) : iso(Date.now() - (1 + rand() * 6) * DAY);
    record({
      verb: `task.${row.status}`,
      subject: row.status === "blocked" ? `${row.owner?.name ?? lead.name} marked “${row.title}” blocked` : `${row.owner?.name ?? lead.name} started “${row.title}”`,
      projectId: id,
      actorId: row.owner?.id ?? lead.id,
      at,
      quiet: true,
    });
  }

  return { id, story, taskRows, memberKeys };
}

/* ---------- equity history ---------------------------------------------- */

/**
 * The trend line.
 *
 * Reconstructing genuine weekly snapshots would mean replaying the whole term,
 * so this ramps the current position backwards: a group that is uneven now was
 * more even once, and a group in trouble has been getting there for a while.
 * The shape is honest even though the individual weeks are reconstructed.
 */
export function writeHistory({ id }) {
  const ctx = loadProject(id);
  if (!ctx) return 0;
  const equity = computeEquity(ctx);
  const ageDays = (Date.now() - new Date(ctx.project.createdAt).getTime()) / DAY;
  const points = Math.max(2, Math.min(7, Math.round(ageDays / 7)));
  const baseGini = equity.distribution.gini;
  let written = 0;
  for (let i = 0; i < points; i++) {
    const fraction = points === 1 ? 1 : i / (points - 1);
    const takenAt = new Date(Date.now() - (points - 1 - i) * 7 * DAY);
    const score = round(equity.score * (0.63 + 0.37 * fraction) + (rand() - 0.5) * 4, 1);
    const gini = round(Math.max(0, baseGini * (0.42 + 0.58 * fraction) + (rand() - 0.5) * 0.03), 4);
    insert("equity_snapshots", {
      id: newId("snp", takenAt.getTime()),
      project_id: id,
      taken_at: takenAt.toISOString(),
      week: weekKey(takenAt),
      score: Math.max(0, Math.min(100, score)),
      gini,
      payload: JSON.stringify({
        members: equity.members.map((m) => ({
          id: m.id,
          credited: round(m.credited * (0.4 + 0.6 * fraction), 2),
          committed: round(m.committed * (0.45 + 0.55 * fraction), 2),
        })),
        parts: equity.parts,
      }),
    });
    written++;
  }
  return written;
}

/* ---------- the bell, filled from the real nudges ----------------------- */

/**
 * Notifications are generated from the nudges the engines actually produce, so
 * the demo's bell agrees with the demo's dashboards. A hand-written notification
 * list would drift out of step the first time anything changed.
 */
export function writeNotifications(people, classroomMap) {
  let count = 0;
  const push = (userId, nudge, link, ageDays) => {
    insert("notifications", {
      id: newId("ntf", Date.now() - ageDays * DAY),
      user_id: userId,
      kind: nudge.severity === "critical" ? "urgent" : nudge.kind,
      title: nudge.title,
      body: nudge.body ?? "",
      link: link ?? nudge.action?.href ?? "",
      meta: JSON.stringify({ seed: true }),
      read_at: ageDays > 3 ? iso(Date.now() - (ageDays - 1) * DAY) : null,
      created_at: iso(Date.now() - ageDays * DAY),
    });
    count++;
  };

  for (const key of ["maya", "priya", "sam", "grace"]) {
    const nudges = personalNudges(people[key].id);
    nudges.slice(0, 5).forEach((item, index) => push(people[key].id, item, item.action?.href, 0.2 + index * 0.9));
  }

  const systems = classroomMap.get("systems");
  if (systems) {
    classroomNudges(systems.id).slice(0, 6).forEach((item, index) => push(systems.teacher.id, item, item.action?.href, 0.3 + index * 0.8));
  }
  const media = classroomMap.get("media");
  if (media) {
    classroomNudges(media.id).slice(0, 3).forEach((item, index) => push(media.teacher.id, item, item.action?.href, 0.5 + index));
  }
  return count;
}

/* ---------- reset and run ----------------------------------------------- */

const TABLES = [
  "equity_snapshots",
  "reviews",
  "checkins",
  "notifications",
  "activity",
  "comments",
  "contributions",
  "assignments",
  "tasks",
  "project_members",
  "projects",
  "enrollments",
  "classrooms",
  "user_skills",
  "sessions",
  "users",
];

export function resetDatabase() {
  tx(() => {
    for (const table of TABLES) run(`DELETE FROM ${table}`);
  });
}

/**
 * Build the whole dataset. Idempotent when asked to be: `reset` clears first.
 */
export function seed({ reset = false, quiet = false } = {}) {
  const log = (...args) => {
    if (!quiet) console.log("  seed        ", ...args);
  };

  if (reset) resetDatabase();
  if ((get(`SELECT COUNT(*) AS n FROM users`)?.n ?? 0) > 0) {
    log("database already has data — nothing done");
    return { skipped: true };
  }

  return tx(() => {
    const skillsAdded = ensureSkillCatalog();
    const people = buildPeople();
    const classroomMap = buildClassrooms(people, CLASSROOMS);

    let taskTotal = 0;
    const built = PROJECTS.map((spec) => {
      const classroom = spec.classroom ? classroomMap.get(spec.classroom) : null;
      if (spec.classroom && !classroom) throw new Error(`story ${spec.key} names a classroom that does not exist: ${spec.classroom}`);
      const project = buildProject(people, classroom, spec, {
        planSummary: (plan) => {
          taskTotal += plan.tasks.length;
        },
      });
      return project;
    });

    for (const project of built) writeHistory(project);
    const notifications = writeNotifications(people, classroomMap);

    const accounts = [people.teacher, people.teacher2, ...Object.values(people.students)].map((u) => u.email);
    log(`${Object.keys(people.students).length + 2} accounts, ${CLASSROOMS.length} classes, ${built.length} projects, ${taskTotal} tasks`);
    log(`${skillsAdded} skills in the catalogue, ${notifications} notifications`);
    log(`every account's password is “equita2026”`);

    return { accounts, projects: built.map((b) => b.id), taskTotal, notifications };
  });
}

/** Called at boot so the product is never empty on first run. */
export function seedIfEmpty() {
  const users = get(`SELECT COUNT(*) AS n FROM users`)?.n ?? 0;
  if (users > 0) return { skipped: true };
  console.log("\n  equita      first run — building the demo dataset");
  const result = seed({ reset: true });
  console.log("  equita      ready\n");
  return result;
}

/* ---------- command line ------------------------------------------------- */

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("/seed.js");
if (isMain) {
  const reset = process.argv.includes("--reset");
  console.log("\n  seeding equita\n");
  const result = seed({ reset });
  if (result.skipped) console.log("  nothing to do — pass --reset to rebuild it\n");
  else console.log("\n  done. sign in as amara@equita.demo or maya@equita.demo with equita2026\n");
}

export { CLASSROOMS, PROJECTS, all };