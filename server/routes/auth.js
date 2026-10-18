/**
 * Accounts, profiles and the skill profile.
 */
import { Router } from "express";
import { z } from "zod";
import { all, get, run, tx } from "../db.js";
import { newId, nowIso, hash01 } from "../util.js";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  publicUser,
  memberships,
  currentUser,
} from "../auth.js";
import { parse, bad, deny, hueFor, shapeUser } from "../api.js";
import { SKILLS, CLUSTERS, SKILL_BY_SLUG, skillId } from "../data/skills.js";
import { topSkills, clusterStrength } from "../engines/profiles.js";

export const authRouter = Router();

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter an email address"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

const Signup = Credentials.extend({
  name: z.string().trim().min(1, "Enter your name").max(80),
  role: z.enum(["student", "teacher"]).default("student"),
  school: z.string().trim().max(120).default(""),
  joinCode: z.string().trim().max(16).optional(),
});

authRouter.post("/signup", (req, res) => {
  const body = parse(Signup, req.body);
  if (get(`SELECT 1 FROM users WHERE email = ?`, body.email)) {
    bad("There is already an account with that email. Sign in instead.");
  }
  const id = newId("usr");
  const now = nowIso();
  tx(() => {
    run(
      `INSERT INTO users (id, name, email, password_hash, role, headline, school, hue, capacity, status, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      id,
      body.name,
      body.email,
      hashPassword(body.password),
      body.role,
      body.role === "teacher" ? "Teacher" : "Student",
      body.school,
      Math.floor(hash01(body.email) * 360),
      8,
      now,
      now,
    );
    // Everyone starts with the three skills they are most likely to have claimed.
    for (const slug of ["planning", "writing", "research"]) {
      run(`INSERT INTO user_skills (user_id, skill_id, level, appetite, source) VALUES (?, ?, ?, ?, 'self')`, id, skillId(slug), 3, 3);
    }
  });

  const session = createSession(id);
  setSessionCookie(res, session.id);

  let joined = null;
  if (body.joinCode) {
    const classroom = get(`SELECT id, name FROM classrooms WHERE code = ?`, body.joinCode.toUpperCase());
    if (classroom) {
      run(
        `INSERT OR IGNORE INTO enrollments (id, classroom_id, user_id, role, created_at) VALUES (?, ?, ?, 'student', ?)`,
        newId("enr"),
        classroom.id,
        id,
        now,
      );
      joined = classroom;
    }
  }

  res.status(201).json({ user: shapeUser(get(`SELECT * FROM users WHERE id = ?`, id)), joined });
});

authRouter.post("/login", (req, res) => {
  const body = parse(Credentials, req.body);
  const user = get(`SELECT * FROM users WHERE email = ?`, body.email);
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    return res.status(401).json({ error: "That email and password do not match an account." });
  }
  if (user.status === "paused") {
    return res.status(403).json({ error: "This account is paused. Ask your teacher to switch it back on." });
  }
  const session = createSession(user.id);
  setSessionCookie(res, session.id);
  res.json({ user: publicUser(user) });
});

/**
 * The demo shortcut.
 *
 * Seeded accounts exist so a teacher — or a judge — can see a populated product
 * in one click instead of creating a class by hand. It only ever opens accounts
 * that were created by the seed, and it says so.
 */
authRouter.post("/demo", (req, res) => {
  const body = parse(z.object({ email: z.string().trim().toLowerCase() }), req.body);
  const user = get(`SELECT * FROM users WHERE email = ? AND email LIKE '%@equita.demo'`, body.email);
  if (!user) return bad("That demo account does not exist.");
  const session = createSession(user.id);
  setSessionCookie(res, session.id);
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (req, res) => {
  const raw = req.cookies?.equita_session;
  destroySession(raw);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) return res.json({ user: null });

  const skills = all(`SELECT skill_id, level, appetite, source FROM user_skills WHERE user_id = ?`, user.id).map((row) => ({
    slug: String(row.skill_id).replace(/^skl_/, ""),
    level: row.level,
    appetite: row.appetite,
    source: row.source,
  }));

  const projectCount = get(
    `SELECT COUNT(*) AS n FROM project_members pm JOIN projects p ON p.id = pm.project_id
      WHERE pm.user_id = ? AND p.status != 'archived'`,
    user.id,
  )?.n ?? 0;

  const unread = get(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`, user.id)?.n ?? 0;
  const openTasks = get(
    `SELECT COUNT(*) AS n FROM tasks t JOIN project_members pm ON pm.project_id = t.project_id
      WHERE pm.user_id = ? AND t.assignee_id = ? AND t.status != 'done'`,
    user.id,
    user.id,
  )?.n ?? 0;

  const profile = { id: user.id, name: user.name, skills: new Map(skills.map((s) => [s.slug, s])) };

  res.json({
    user: { ...publicUser(user), skillCount: skills.length },
    skills,
    memberships: memberships(user.id),
    counts: { projects: projectCount, unread, openTasks },
    clusters: clusterStrength(profile).slice(0, 4),
    top: topSkills(profile, 6),
  });
});

authRouter.patch("/me", requireAuth, (req, res) => {
  const body = parse(
    z.object({
      name: z.string().trim().min(1).max(80).optional(),
      headline: z.string().trim().max(120).optional(),
      school: z.string().trim().max(120).optional(),
      capacity: z.coerce.number().min(0.5).max(60).optional(),
      hue: z.coerce.number().min(0).max(359).optional(),
    }),
    req.body,
  );
  const patch = [];
  const values = [];
  for (const [key, value] of Object.entries(body)) {
    patch.push(`${key} = ?`);
    values.push(value);
  }
  if (patch.length) run(`UPDATE users SET ${patch.join(", ")} WHERE id = ?`, ...values, req.user.id);
  res.json({ user: shapeUser(get(`SELECT * FROM users WHERE id = ?`, req.user.id)) });
});

/** Replace the whole skill profile in one transaction. */
authRouter.put("/me/skills", requireAuth, (req, res) => {
  const body = parse(
    z.object({
      skills: z
        .array(
          z.object({
            slug: z.string().trim().min(1).max(40),
            level: z.coerce.number().int().min(1).max(5),
            appetite: z.coerce.number().int().min(1).max(5).default(3),
          }),
        )
        .max(40),
    }),
    req.body,
  );
  const known = new Set(SKILLS.map((s) => s.slug));
  const clean = body.skills.filter((s) => known.has(s.slug));

  tx(() => {
    run(`DELETE FROM user_skills WHERE user_id = ?`, req.user.id);
    for (const skill of clean) {
      run(
        `INSERT INTO user_skills (user_id, skill_id, level, appetite, source) VALUES (?, ?, ?, ?, 'self')`,
        req.user.id,
        skillId(skill.slug),
        skill.level,
        skill.appetite,
      );
    }
  });
  res.json({ skills: clean, count: clean.length });
});

/** The catalogue, with this person's level against each entry. */
export const skillsRouter = Router();

skillsRouter.get("/", (req, res) => {
  const user = currentUser(req);
  const mine = new Map();
  if (user) {
    for (const row of all(`SELECT skill_id, level, appetite FROM user_skills WHERE user_id = ?`, user.id)) {
      mine.set(String(row.skill_id).replace(/^skl_/, ""), { level: row.level, appetite: row.appetite });
    }
  }
  res.json({
    clusters: CLUSTERS,
    skills: SKILLS.map((s) => ({ ...s, id: skillId(s.slug), mine: mine.get(s.slug) ?? null })),
    mine: [...mine.entries()].map(([slug, value]) => ({ slug, ...value, name: SKILL_BY_SLUG.get(slug)?.name ?? slug })),
  });
});

/** The vocabulary used to describe task requirements in the UI. */
skillsRouter.get("/clusters", (_req, res) => {
  res.json({
    clusters: CLUSTERS.map((cluster) => ({
      ...cluster,
      skills: SKILLS.filter((s) => s.cluster === cluster.id).map((s) => ({ slug: s.slug, name: s.name, prompt: s.prompt })),
    })),
  });
});

export { deny };