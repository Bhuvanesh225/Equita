/**
 * Accounts and sessions.
 *
 * Passwords go through scrypt with a per-user salt, and a session is a row with
 * an expiry rather than a signed token with a secret to leak: revoking someone
 * is a delete. The cookie is httpOnly and same-site, which is what makes it safe
 * for the API and the browser to be on different ports in development.
 */
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { get, run, all } from "./db.js";
import { newId, nowIso } from "./util.js";

const COOKIE = "equita_session";
const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, salt, hash] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function createSession(userId) {
  const id = newId("ses");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  run(`INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`, id, userId, nowIso(), expires);
  run(`UPDATE users SET last_seen_at = ? WHERE id = ?`, nowIso(), userId);
  return { id, expiresAt: expires };
}

export function destroySession(id) {
  if (id) run(`DELETE FROM sessions WHERE id = ?`, id);
}

export function sweepSessions() {
  return run(`DELETE FROM sessions WHERE expires_at < ?`, nowIso()).changes;
}

function userFromCookie(req) {
  const raw = req.cookies?.[COOKIE];
  if (!raw || typeof raw !== "string") return null;
  const session = get(`SELECT * FROM sessions WHERE id = ?`, raw);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    destroySession(raw);
    return null;
  }
  return get(`SELECT * FROM users WHERE id = ?`, session.user_id) ?? null;
}

export function currentUser(req) {
  if (req._user !== undefined) return req._user;
  req._user = userFromCookie(req);
  if (req._user) run(`UPDATE users SET last_seen_at = ? WHERE id = ?`, nowIso(), req._user.id);
  return req._user;
}

export function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // a school laptop on http://localhost is the normal case
    maxAge: SESSION_DAYS * 86_400_000,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: "/" });
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to continue." });
  req.user = user;
  next();
}

export function attachUser(req, _res, next) {
  req.user = currentUser(req);
  next();
}

/** The shape of a user that is safe to send to a browser. */
export function publicUser(row, extra = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    headline: row.headline,
    school: row.school,
    hue: row.hue,
    capacity: row.capacity,
    status: row.status,
    createdAt: row.created_at,
    ...extra,
  };
}

/** Every classroom this person is enrolled in, with their role in it. */
export function memberships(userId) {
  return all(
    `SELECT e.classroom_id, e.role AS member_role, c.*
       FROM enrollments e JOIN classrooms c ON c.id = e.classroom_id
      WHERE e.user_id = ? AND c.archived_at IS NULL
      ORDER BY c.created_at DESC`,
    userId,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    subject: row.subject,
    term: row.term,
    ownerId: row.owner_id,
    role: row.member_role,
    createdAt: row.created_at,
  }));
}

/** Is this person allowed to see and change this classroom? */
export function canTeach(userId, classroomId) {
  if (!userId || !classroomId) return false;
  const row = get(
    `SELECT role FROM enrollments WHERE classroom_id = ? AND user_id = ?`,
    classroomId,
    userId,
  );
  const classroom = get(`SELECT owner_id FROM classrooms WHERE id = ?`, classroomId);
  return row?.role === "teacher" || row?.role === "assistant" || classroom?.owner_id === userId;
}

export function isOnProject(userId, projectId) {
  return !!get(`SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?`, projectId, userId);
}

export function roleOnProject(userId, projectId) {
  return get(`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`, projectId, userId)?.role ?? null;
}

export const SESSION_COOKIE = COOKIE;