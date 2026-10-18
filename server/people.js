/**
 * Adding people.
 *
 * A group project is usually assembled by one person typing everyone else's
 * email addresses. Those classmates may not have an account yet, and a school
 * cannot ask thirty students to each go and sign up before the lesson starts.
 *
 * So adding somebody creates their account and returns a one-time password for
 * the person who added them to pass on. The account is real from that moment: it
 * exists, it can be given work, and it can be signed into.
 */
import { get, run, tx } from "./db.js";
import { newId, nowIso, hash01 } from "./util.js";
import { hashPassword } from "./auth.js";
import { bad } from "./api.js";

const WORDS = ["otter", "maple", "cobalt", "ember", "quartz", "lantern", "heron", "willow", "cinder", "marlin", "juniper", "flint"];

export function tempPassword() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${word}-${Math.floor(1000 + Math.random() * 8999)}`;
}

/**
 * @returns {{ user: object, created: boolean, password?: string }}
 */
export function findOrCreateUser(email, { name = "", role = "student", school = "", capacity = 8 } = {}) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) bad(`“${email}” is not an email address.`);
  const existing = get(`SELECT * FROM users WHERE email = ?`, clean);
  if (existing) return { user: existing, created: false };

  const password = tempPassword();
  const id = newId("usr");
  const display = name.trim() || clean.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  run(
    `INSERT INTO users (id, name, email, password_hash, role, headline, school, hue, capacity, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'invited', ?)`,
    id,
    display,
    clean,
    hashPassword(password),
    role,
    role === "teacher" ? "Teacher" : "Student",
    school,
    Math.floor(hash01(clean) * 360),
    capacity,
    nowIso(),
  );
  return { user: get(`SELECT * FROM users WHERE id = ?`, id), created: true, password };
}

/** Add people to a project by id or email. Returns what happened to each. */
export function addProjectMembers(projectId, entries, { role = "member" } = {}) {
  const results = [];
  tx(() => {
    for (const entry of entries) {
      const email = typeof entry === "string" ? entry : entry.email;
      const name = typeof entry === "string" ? "" : entry.name || "";
      if (!email && !/^usr_/.test(String(entry?.id ?? ""))) continue;

      let user;
      let created = false;
      let password;
      if (email) {
        const outcome = findOrCreateUser(email, { name, role: "student" });
        user = outcome.user;
        created = outcome.created;
        password = outcome.password;
      } else {
        user = get(`SELECT * FROM users WHERE id = ?`, entry.id);
      }
      if (!user) continue;

      const already = get(`SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?`, projectId, user.id);
      if (!already) {
        run(`INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, projectId, user.id, role, nowIso());
      }
      results.push({ id: user.id, name: user.name, email: user.email, created, password, alreadyMember: !!already });
    }
  });
  return results;
}

export function addClassroomStudents(classroomId, entries) {
  const results = [];
  tx(() => {
    for (const entry of entries) {
      const email = typeof entry === "string" ? entry : entry.email;
      const name = typeof entry === "string" ? "" : entry.name || "";
      if (!email) continue;
      const classroom = get(`SELECT school FROM classrooms c JOIN users u ON u.id = c.owner_id WHERE c.id = ?`, classroomId);
      const outcome = findOrCreateUser(email, { name, role: "student", school: classroom?.school || "" });
      const already = get(`SELECT 1 FROM enrollments WHERE classroom_id = ? AND user_id = ?`, classroomId, outcome.user.id);
      if (!already) {
        run(
          `INSERT INTO enrollments (id, classroom_id, user_id, role, created_at) VALUES (?, ?, ?, 'student', ?)`,
          newId("enr"),
          classroomId,
          outcome.user.id,
          nowIso(),
        );
      }
      results.push({
        id: outcome.user.id,
        name: outcome.user.name,
        email: outcome.user.email,
        created: outcome.created,
        password: outcome.password,
        alreadyEnrolled: !!already,
      });
    }
  });
  return results;
}