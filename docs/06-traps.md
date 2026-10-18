# 06 — Traps

Bugs this project has already paid for. Each one cost real time and each one was mistaken
for something else at first. **Keep them fixed. Add any new one the moment you fix it.**

## From the first session (still true)

### T1 — SQLite WAL retriggered the dev server forever
`data/equita.db-wal` is written on every request, and Vite's watcher counted it as a source
change, so every open page reloaded about every two seconds. It read as "the site will not
stay still".
**Fixed** in `vite.config.ts` by ignoring `**/data/**` (plus `.shots`, `.playwright-mcp`,
`*.log`). If you add a watcher or a new generated directory, add it to the same list.

### T2 — Global `scroll-behavior: smooth`
It made every programmatic scroll animate indefinitely and fight scroll restoration.
**Removed.** Do not re-add it globally; scope it to a specific element if you ever need it.

### T3 — `signIn` did not await the session refresh
The route guard redirected before the person landed, so signing in bounced you back to the
form. **Fixed** at the source in `src/lib/session.tsx` (`await refresh()` inside `signIn`,
`signUp`, `enterDemo`). Any new auth call must await the refresh the same way.

### T4 — A component returning `null` while a request failed
`Dashboard.tsx` returns `null` on a dashboard error, which masked a live crash as a blank
page. **Still present (D2).**
**The rule:** every screen renders a visible error state with a retry and a way out. Never
`return null`.

### T5 — A stale server on port 8787
It silently serves pre-edit code. If a fix appears to have no effect, kill by port and
restart **before** debugging anything else.

```bash
netstat -ano | grep 8787
# taskkill //F //PID <pid>
```

### T6 — The Playwright MCP extension tab freezes when backgrounded
`page.goto` inside a `browser_run_code` call never wakes it. Bring the tab forward through
tool-level navigation, or — better — use `scripts/shoot.mjs`, which launches its own
headless Chromium. Prefer `shoot.mjs`.

### T7 — Very large `write` payloads drop `path`
A truncated write once deleted `index.html`.
**Rule:** keep each write modest; build a long file in two or three passes. Verify after a
big write (`wc -l <file>`).

### T8 — Double-encoded UTF-8 in the seed
A name arrived as `Diego MarÃ­n` instead of `Diego Marín`. **Fixed**; `scripts/encscan.mjs`
scans the whole database for the signature and printed `clean` at the time of writing.
Re-run it after any seed edit.

### T9 — Random allocation contradicted the demo's own story
A "carrying" group showed nobody carrying. Allocation is now **target-driven** so the story
reads true. If you change the allocator, re-read the arcs in `server/seed-stories.js` and
confirm each one still shows what its `note` claims.

### T10 — Prose that overstates is a bug here
Some suggestion kinds have no `from` member ("work nobody took on"), so every reason string
must handle `fromId === null`. Check `src/routes/project/Equity.tsx` for how the existing
render handles it.

## Found in the second session (build of Projects/Workspace)

### T11 — Batch `edit` calls are not atomic
A failing edit later in a batch can still leave earlier edits applied. Prefer several small
`edit` calls, and re-read the file after a failing one.

### T12 — Unused imports fail the build
`noUnusedLocals` and `noUnusedParameters` are on. Nearly every file the second session wrote
needed a cleanup pass for exactly this. Run `npx tsc --noEmit` after **every** file, not at
the end of the screen.

### T13 — The signature tick is not optional
`LoadBar` without the even-share tick says nothing ("9 hours" is only fair or unfair relative
to everyone else). Never render a bare hours bar; use `LoadBar`/`ShareBar`.

### T14 — A Spinner that the harness cannot see
`scripts/shoot.mjs` waits for `main .spinner` to disappear before screenshotting. If a screen
uses a hand-rolled loader without the `.spinner` class, the harness will not wait and will
photograph a blank page — and the run will look like a pass.
**Rule:** the loading state is `<div className="page"><Spinner label="…" /></div>` from
`src/components/ui`. This is also why `Spinner` renders `.row.spinner`.

## Found in the third session (this documentation pass)

### T15 — A router mounted at a sub-path while declaring full paths
**This was the biggest bug in the repository.** `server/routes/planning.js` declares
`planningRouter.post("/projects/:id/plan", …)`, i.e. full paths including `/projects`.
It was mounted with `app.use("/api/projects", planningRouter)`, so the real URL was
`/api/projects/projects/:id/plan`. Every plan, auto-assign, rebalance and nudges call from
the browser was a **404**, while the read endpoints next to them worked perfectly — which is
why a typecheck and a screenshot both passed.

**Fixed:** mount it at `/api`, the same way `tasksRouter` is mounted (see `server/index.js`,
which now carries a comment saying so).

**How to avoid repeating it:** before debugging a 404, read `server/index.js` and check
whether the router's own paths already include the mount prefix. The two parallel cases in
this repo are deliberate and different:

```js
app.use("/api", planningRouter);        // declares /projects/:id/plan
app.use("/api/projects", projectsRouter); // declares /:id/equity
app.use("/api", tasksRouter);           // declares /tasks/:id and /projects/:id/tasks
```

**The general lesson:** a screen verified only by `tsc` + a screenshot has not been verified.
Run `node scripts/smoke.mjs` (which hits every write-shaped endpoint for real) and click the
button.

### T16 — Engine-generated links do not match the router
`Nudges`, notifications, the copilot actions and search results carry `href`s the router does
not serve: `/projects/:id/board?task=…`, `?panel=equity`, `/people/:id`,
`/classrooms/:id/groups/:projectId`. They all land on `NotFound`.
`Nudges` renders `nudge.action.href` as a `Link`, so **clicking a nudge from the dashboard is
a 404 today.** This is P0-2 in `TODO.md`; the full list is in `docs/00-state.md`.

**The rule for new work:** a server-generated link is a contract. Either register the route or
change the emitter — and add a test to `scripts/smoke.mjs` that follows the link.

### T17 — The web server binds IPv6 `localhost` only
Vite listens on `[::1]:5173`. `http://localhost:5173` works; `http://127.0.0.1:5173` may not.
The API is the opposite (`0.0.0.0:8787`, and it also answers on `::1`). The helper scripts
already use the right hostnames — do not "tidy" them.

### T18 — Reading UTF-8 JSON with native Python on Windows
`curl … | python -c "json.load(sys.stdin)"` decodes stdin as **cp1252** and turns `Marín` into
`MarÃ­n`, which looks exactly like the T8 bug in the database. It is not — it is the shell.
Set `PYTHONIOENCODING=utf-8` and/or `open(path, encoding="utf-8")` before concluding the seed
is corrupt. Confirm with `node scripts/encscan.mjs`, which is the authority.

### T19 — `/tmp` is not the same path for Git Bash and native Windows tools
Git Bash's `/tmp` does not resolve for native `node`/`python`. Write scratch files to a
project-local path (`.tmp/`) when mixing the two.

### T20 — `inspect.mjs` and `shoot.mjs` need `MSYS_NO_PATHCONV=1`
Without it Git Bash rewrites the leading `/` of a route argument into a filesystem path and
the browser navigates nowhere — producing an empty audit that looks like a clean pass.

**Related gotcha:** an *empty* audit is not a clean audit. `inspect.mjs` prints
`height: 900` with every array empty when the page never rendered. Cross-check with
`shoot.mjs` (`panels` must be > 0) before believing an all-empty result. A cold Vite dev
server can take longer than the 1.8s the inspector waits; if everything is empty, re-run.

### T21 — `npm run seed` wipes the database
Any task, project or class you created while testing disappears, and every id changes. The
demo arcs in `docs/09-demo-data.md` are then invalid. Re-run `node scripts/shapes.mjs` after a
reseed if you need ids.

### T22 — Reviews go to the teacher, and the summary endpoint is teacher-only
`GET /api/projects/:id/reviews/summary` returns `403` for a student, so any screen that calls
it must pass `null` as the `useApi` path for non-teachers (see `src/routes/project/Reviews.tsx`).