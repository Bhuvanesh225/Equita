/**
 * The server.
 *
 * One process: the JSON API, the live event stream, and — when the app has been
 * built — the static files themselves. In development Vite serves the front end
 * and proxies /api and /events here, so both halves run with instant reload.
 */
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { currentUser } from "./auth.js";
import { subscribe } from "./bus.js";
import { all } from "./db.js";
import { healthcheck } from "./db.js";
import { HttpError } from "./api.js";
import { authRouter, skillsRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { planningRouter } from "./routes/planning.js";
import { schoolRouter } from "./routes/school.js";
import { insightsRouter } from "./routes/insights.js";
import { publicRouter } from "./routes/public.js";
import { sweepSessions } from "./auth.js";
import { seedIfEmpty } from "./seed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

/* ---------- the live channel -------------------------------------------- */

app.get("/events", (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).end();
  const classroomIds = all(`SELECT classroom_id FROM enrollments WHERE user_id = ?`, user.id).map((r) => r.classroom_id);
  subscribe(res, { userId: user.id, classroomIds });
});

/* ---------- health ------------------------------------------------------ */

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "equita", ...healthcheck(), at: new Date().toISOString() });
});

/* ---------- api --------------------------------------------------------- */

// Before the sign-in wall: the landing page reads its numbers from here.
app.use("/api/public", publicRouter);
app.use("/api/auth", authRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/classrooms", schoolRouter);
// The intelligence endpoints live on the same path as their resources.
//
// This router declares its own paths in full (`/projects/:id/plan`), so it is
// mounted at `/api` and not at `/api/projects`. Mounting it at `/api/projects`
// served every plan, allocation and rebalance call at `/api/projects/projects/…`,
// which meant the three headline actions in the workspace were 404s from the
// browser while the read endpoints they sit next to worked fine. Keep this line
// identical to the way `tasksRouter` is mounted below.
app.use("/api", planningRouter);
app.use("/api/projects", projectsRouter);
app.use("/api", tasksRouter);
app.use("/api/insights", insightsRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "No such endpoint." }));

/* ---------- static build, when there is one ----------------------------- */

const dist = path.join(here, "..", "dist");
if (existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api|\/events).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

/* ---------- errors ----------------------------------------------------- */

app.use((error, _req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "That request body was not valid JSON." });
  }
  console.error("[equita] unhandled:", error);
  res.status(500).json({ error: "Something went wrong on the server. The details are in the server log." });
});

/* ---------- boot ------------------------------------------------------- */

const start = () => {
  // A clone of the repository should come up showing something. Seeding only
  // ever runs when there is not a single account, so it can never overwrite
  // work somebody has done.
  try {
    const seeded = seedIfEmpty();
    if (seeded) console.log(`  seeded       a demonstration dataset was created (${seeded.accounts?.length ?? "?"} people, ${seeded.projects?.length ?? "?"} projects)`);
  } catch (error) {
    console.error("  warning      could not seed the demonstration dataset:", error.message);
  }
  const swept = sweepSessions();
  const server = app.listen(PORT, () => {
    const counts = {
      users: all(`SELECT COUNT(*) AS n FROM users`)[0]?.n ?? 0,
      projects: all(`SELECT COUNT(*) AS n FROM projects`)[0]?.n ?? 0,
      tasks: all(`SELECT COUNT(*) AS n FROM tasks`)[0]?.n ?? 0,
      classes: all(`SELECT COUNT(*) AS n FROM classrooms`)[0]?.n ?? 0,
    };
    console.log(`  equita api   http://127.0.0.1:${PORT}`);
    console.log(`  data         ${healthcheck().path}`);
    console.log(`  contains     ${counts.users} people · ${counts.classes} classes · ${counts.projects} projects · ${counts.tasks} tasks`);
    if (swept) console.log(`  swept        ${swept} expired session${swept === 1 ? "" : "s"}`);
    if (counts.users === 0) console.log(`  note         the database is empty — run: npm run seed`);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 1500).unref();
    });
  }
  return server;
};

if (process.env.EQUITA_NO_LISTEN !== "1") start();

export { start };