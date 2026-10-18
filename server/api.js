/**
 * Request plumbing shared by every route file.
 *
 * The convention is one JSON object per response with no envelope: a successful
 * response is the data, a failure is `{ error, details? }` with a real status
 * code and a message written for a person to read.
 */
import { z } from "zod";
import { all, get, insert, run, tx, bool } from "./db.js";
import { json, newId, nowIso, joinCode, clamp, hash01 } from "./util.js";
import { normaliseRequired } from "./engines/context.js";

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const bad = (message, details) => {
  throw new HttpError(400, message, details);
};
export const deny = (message = "You do not have access to this.") => {
  throw new HttpError(403, message);
};
export const missing = (message = "That does not exist.") => {
  throw new HttpError(404, message);
};

/** Validate and return the parsed body, or throw a readable 400. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new HttpError(400, `${first.path.join(".") || "Input"}: ${first.message}`, result.error.issues);
  }
  return result.data;
}

export const Id = z.string().min(1).max(64);
export const SkillRefs = z
  .array(z.union([z.string(), z.object({ slug: z.string(), weight: z.number().optional() })]))
  .max(12)
  .optional();

export const isoDate = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Not a valid date")
  .optional()
  .nullable();

/* ---------- query helpers ------------------------------------------------- */

export function projectRow(id) {
  const row = get(`SELECT * FROM projects WHERE id = ?`, id);
  if (!row) missing("That project does not exist.");
  return row;
}

export function classroomRow(id) {
  const row = get(`SELECT * FROM classrooms WHERE id = ?`, id);
  if (!row) missing("That class does not exist.");
  return row;
}

export function taskRow(id) {
  const row = get(`SELECT * FROM tasks WHERE id = ?`, id);
  if (!row) missing("That task does not exist.");
  return row;
}

export function userRow(id) {
  const row = get(`SELECT * FROM users WHERE id = ?`, id);
  if (!row) missing("That person does not exist.");
  return row;
}

/* ---------- shapes sent to the browser ----------------------------------- */

export const shapeUser = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        headline: row.headline,
        school: row.school,
        hue: row.hue,
        capacity: row.capacity,
        status: row.status,
      }
    : null;

export const shapeProject = (row) => ({
  id: row.id,
  name: row.name,
  brief: row.brief,
  mode: row.mode,
  classroomId: row.classroom_id,
  ownerId: row.owner_id,
  status: row.status,
  dueAt: row.due_at,
  config: json(row.config, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const shapeTask = (row) => ({
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
});

export const shapeActivity = (row, nameOf = {}) => ({
  id: row.id,
  verb: row.verb,
  subject: row.subject,
  meta: json(row.meta, {}),
  actorId: row.actor_id,
  actorName: nameOf[row.actor_id] ?? row.actor_name ?? null,
  projectId: row.project_id,
  classroomId: row.classroom_id,
  createdAt: row.created_at,
});

/** A quick id -> name map, so feeds and timelines do not need a join each. */
export function nameMap(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  const rows = all(`SELECT id, name, hue FROM users WHERE id IN (${list.map(() => "?").join(",")})`, ...list);
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

export function hueMap(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  const rows = all(`SELECT id, name, hue FROM users WHERE id IN (${list.map(() => "?").join(",")})`, ...list);
  return Object.fromEntries(rows.map((r) => [r.id, { name: r.name, hue: r.hue }]));
}

/* ---------- small reusable writes ---------------------------------------- */

/** A stable, human, unique join code. */
export function freshJoinCode() {
  for (let i = 0; i < 40; i++) {
    const code = joinCode();
    if (!get(`SELECT 1 FROM classrooms WHERE code = ?`, code)) return code;
  }
  return `EQ-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Everyone on a project, as ids. */
export const projectMemberIds = (projectId) =>
  all(`SELECT user_id FROM project_members WHERE project_id = ?`, projectId).map((r) => r.user_id);

export const classroomStudentIds = (classroomId) =>
  all(`SELECT user_id FROM enrollments WHERE classroom_id = ? AND role = 'student'`, classroomId).map((r) => r.user_id);

/** A pleasant, stable hue from a name, so a new avatar is never an ugly grey. */
export const hueFor = (seed) => Math.floor(hash01(String(seed)) * 360);

export { insert, run, all, get, tx, newId, nowIso, json, clamp };