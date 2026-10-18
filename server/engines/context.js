/**
 * Loading a project once, in the shape the engines want.
 *
 * Every metric in Equita is derived from this object rather than from queries
 * scattered through the routes, so the dashboard, the allocator, the nudges and
 * the copilot can never disagree about what is true.
 */
import { all, get, bool } from "../db.js";
import { json } from "../util.js";
import { slugOf } from "../data/skills.js";

export const DEFAULT_CONFIG = {
  // How a project's equity score is assembled. Weights sum to 1.
  weights: { balance: 0.3, delivery: 0.25, spread: 0.2, engagement: 0.15, readiness: 0.1 },
  // How the allocator ranks people for a task. Weights sum to 1.
  allocator: { skill: 0.34, headroom: 0.24, equity: 0.18, deadline: 0.12, continuity: 0.07, growth: 0.05 },
  policy: {
    autoAssign: true,
    allowStretch: true,
    enforceCapacity: true,
    requireReview: false,
    shareGapFlag: 0.35,
    freeRiderShare: 0.6,
    silenceDays: 7,
  },
};

export const DEFAULT_CLASSROOM_POLICY = {
  ...DEFAULT_CONFIG,
  policy: {
    ...DEFAULT_CONFIG.policy,
    // A teacher's default is more protective: work may not be handed to someone
    // who is already over capacity, and a task cannot be closed by its author.
    enforceCapacity: true,
    requireReview: true,
    autoAssign: false,
    shareGapFlag: 0.3,
  },
};

/** Merge stored config over the defaults so new keys appear for old projects. */
export function mergeConfig(stored) {
  const raw = json(stored, {});
  return {
    weights: { ...DEFAULT_CONFIG.weights, ...(raw.weights || {}) },
    allocator: { ...DEFAULT_CONFIG.allocator, ...(raw.allocator || {}) },
    policy: { ...DEFAULT_CONFIG.policy, ...(raw.policy || {}) },
  };
}

function memberSkills(userId) {
  const rows = all(
    `SELECT skill_id, level, appetite FROM user_skills WHERE user_id = ? ORDER BY level DESC`,
    userId,
  );
  const map = new Map();
  for (const row of rows) map.set(slugOf(row.skill_id), { level: row.level, appetite: row.appetite });
  return map;
}

const REQUIRED_SHAPE = ["slug", "weight"];

export function normaliseRequired(raw) {
  const list = json(raw, []);
  const out = [];
  for (const item of list) {
    if (typeof item === "string") {
      out.push({ slug: item.replace(/^skl_/, ""), weight: 1 });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const slug = String(item.slug ?? item.skill ?? "").replace(/^skl_/, "");
    if (!slug) continue;
    const weight = Number(item.weight ?? item.w ?? 1);
    out.push({ slug, weight: Number.isFinite(weight) && weight > 0 ? weight : 1 });
  }
  return out;
}

export function hydrateTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    detail: row.detail,
    phase: row.phase,
    status: row.status,
    assigneeId: row.assignee_id,
    effort: row.effort,
    priority: row.priority,
    dueAt: row.due_at,
    required: normaliseRequired(row.required_skills),
    dependsOn: json(row.depends_on, []),
    deliverable: row.deliverable,
    needsReview: bool(row.needs_review),
    position: row.position,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export function hydrateMember(row) {
  const skills = memberSkills(row.user_id);
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    headline: row.headline,
    hue: row.hue,
    capacity: row.capacity,
    skills,
    skillCount: skills.size,
    joinedAt: row.joined_at,
  };
}

/** Everything the engines need about one project, in one pass over the data. */
export function loadProject(projectId) {
  const projectRow = get(`SELECT * FROM projects WHERE id = ?`, projectId);
  if (!projectRow) return null;

  const config = mergeConfig(projectRow.config);
  const memberRows = all(
    `SELECT pm.user_id, pm.role, pm.joined_at, u.name, u.email, u.headline, u.hue, u.capacity
       FROM project_members pm JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
      ORDER BY pm.role = 'lead' DESC, u.name`,
    projectId,
  );

  const tasks = all(`SELECT * FROM tasks WHERE project_id = ? ORDER BY phase, position, created_at`, projectId).map(hydrateTask);
  const contributions = all(`SELECT * FROM contributions WHERE project_id = ? ORDER BY created_at`, projectId).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    kind: row.kind,
    effort: row.effort,
    note: row.note,
    verifiedBy: row.verified_by,
    createdAt: row.created_at,
  }));

  const checkins = all(`SELECT * FROM checkins WHERE project_id = ? ORDER BY created_at DESC`, projectId).map((row) => ({
    id: row.id,
    userId: row.user_id,
    week: row.week,
    mood: row.mood,
    note: row.note,
    blockers: row.blockers,
    createdAt: row.created_at,
  }));

  const reviews = all(`SELECT * FROM reviews WHERE project_id = ?`, projectId).map((row) => ({
    id: row.id,
    reviewerId: row.reviewer_id,
    subjectId: row.subject_id,
    reliability: row.reliability,
    quality: row.quality,
    teamwork: row.teamwork,
    note: row.note,
    createdAt: row.created_at,
  }));

  const activity = all(`SELECT * FROM activity WHERE project_id = ? ORDER BY created_at DESC LIMIT 400`, projectId).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    verb: row.verb,
    subject: row.subject,
    meta: json(row.meta, {}),
    createdAt: row.created_at,
  }));

  const comments = all(
    `SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.project_id = ? ORDER BY c.created_at`,
    projectId,
  ).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    mentions: json(row.mentions, []),
    createdAt: row.created_at,
  }));

  const classroom = projectRow.classroom_id ? get(`SELECT * FROM classrooms WHERE id = ?`, projectRow.classroom_id) : null;

  return {
    project: {
      id: projectRow.id,
      name: projectRow.name,
      brief: projectRow.brief,
      mode: projectRow.mode,
      classroomId: projectRow.classroom_id,
      classroom: classroom ? { id: classroom.id, name: classroom.name, code: classroom.code, subject: classroom.subject, term: classroom.term } : null,
      ownerId: projectRow.owner_id,
      status: projectRow.status,
      dueAt: projectRow.due_at,
      createdAt: projectRow.created_at,
      updatedAt: projectRow.updated_at,
    },
    config,
    members: memberRows.map(hydrateMember),
    tasks,
    contributions,
    checkins,
    reviews,
    activity,
    comments,
  };
}

/** Members of a classroom, with skills — used by grouping and class analytics. */
export function loadRoster(classroomId) {
  const rows = all(
    `SELECT e.user_id, e.role, e.created_at AS joined_at, u.name, u.email, u.headline, u.hue, u.capacity
       FROM enrollments e JOIN users u ON u.id = e.user_id
      WHERE e.classroom_id = ? AND e.role = 'student'
      ORDER BY u.name`,
    classroomId,
  );
  return rows.map(hydrateMember);
}

export const REQUIRED_SKILL_SHAPE = REQUIRED_SHAPE;