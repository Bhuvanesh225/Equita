/**
 * A static deployment of Equita, with the real product logic.
 *
 * The browser cannot reach an Express server on a static host, so this module
 * mounts the same routers the server mounts, against a WASM SQLite database
 * seeded with the same stories. `src/lib/api.ts` only calls it when `/api` is
 * not answered by a live server.
 */
import { createApp, readCookies, type DemoRequest } from "./express";
import { openDemoDatabase } from "./db";
import { authRouter, skillsRouter } from "../../../server/routes/auth.js";
import { projectsRouter } from "../../../server/routes/projects.js";
import { tasksRouter } from "../../../server/routes/tasks.js";
import { planningRouter } from "../../../server/routes/planning.js";
import { schoolRouter } from "../../../server/routes/school.js";
import { insightsRouter } from "../../../server/routes/insights.js";
import { publicRouter } from "../../../server/routes/public.js";

export { onDemoEvent } from "./bus";

const app = createApp();

/* Same order as server/index.js. Paths are full inside each router. */
app.mount("/api/public", publicRouter);
app.mount("/api/auth", authRouter);
app.mount("/api/skills", skillsRouter);
app.mount("/api/classrooms", schoolRouter);
app.mount("/api", planningRouter);
app.mount("/api/projects", projectsRouter);
app.mount("/api", tasksRouter);
app.mount("/api/insights", insightsRouter);

app.fallback((_req, res) => {
  res.status(404).json({ error: "No such endpoint." });
});

let ready: Promise<void> | null = null;

async function ensureReady() {
  ready ??= (async () => {
    await openDemoDatabase();
    const { seedIfEmpty } = await import("../../../server/seed.js");
    seedIfEmpty();
  })();
  return ready;
}

export async function demoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await ensureReady();

  const url = new URL(path, window.location.origin);
  if (url.pathname === "/api/health") {
    return new Response(JSON.stringify({ ok: true, service: "equita", mode: "browser-demo" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const method = (init.method ?? "GET").toUpperCase();
  let body: unknown = undefined;
  if (typeof init.body === "string" && init.body.trim()) {
    try {
      body = JSON.parse(init.body);
    } catch {
      return new Response(JSON.stringify({ error: "That request body was not valid JSON." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const req: DemoRequest = {
    method,
    path: url.pathname,
    params: {},
    query,
    body,
    cookies: readCookies(),
    headers,
    secure: false,
  };

  console.log("[demo req]", method, url.pathname, JSON.stringify(req.cookies), "body:", JSON.stringify(body));
  const result = app.handle(req);
  const payload = result.raw ?? JSON.stringify(result.payload ?? null);
  return new Response(payload, {
    status: result.statusCode,
    headers: { "content-type": "application/json", ...result.headers },
  });
}



