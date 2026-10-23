# 06 — Traps

Bugs this project has already paid for. Each one cost real time and each one was mistaken for something else at first. **Keep them fixed. Add any new one the moment you fix it.**

## From the First Session (Still True)

### T1 — SQLite WAL Retriggered the Dev Server Forever
`data/equita.db-wal` is written on every request, and Vite's watcher counted it as a source change, so every open page reloaded about every two seconds. It read as "the site will not stay still".
**Fixed** in `vite.config.ts` by ignoring `**/data/**` (plus `.shots`, `.playwright-mcp`, `*.log`). If you add a watcher or a new generated directory, add it to the same list.

### T2 — Global `scroll-behavior: smooth`
It made every programmatic scroll animate indefinitely and fight scroll restoration.
**Removed.** Do not re-add it globally; scope it to a specific element if you ever need it.

### T3 — `signIn` Did Not Await the Session Refresh
The route guard redirected before the person landed, so signing in bounced you back to the form.
**Fixed** at the source in `src/lib/session.tsx` (`await refresh()` inside `signIn`, `signUp`, `enterDemo`). Any new auth call must await the refresh the same way.

### T4 — A Component Returning `null` While a Request Failed
`Dashboard.tsx` once returned `null` on a dashboard error, which masked a live crash as a blank page.
**Fixed** in `src/routes/Dashboard.tsx`: the screen now renders a retryable `EmptyState` with a route out.
**The rule:** every screen renders a visible error state with a retry and a way out. Never `return null`.

### T5 — A Stale Server on Port 8787
It silently serves pre-edit code. If a fix appears to have no effect, kill by port and restart **before** debugging anything else.

```bash
netstat -ano | grep 8787
# taskkill //F //PID <pid>
```

### T6 — The Playwright MCP Extension Tab Freezes When Backgrounded
`page.goto` inside a `browser_run_code` call never wakes it. Bring the tab forward through tool-level navigation, or — better — use `scripts/shoot.mjs`, which launches its own headless Chromium. Prefer `shoot.mjs`.

### T7 — Very Large `write` Payloads Drop `path`
A truncated write once deleted `index.html`.
**Rule:** keep each write modest; build a long file in two or three passes. Verify after a big write (`wc -l <file>`).

### T8 — Double-Encoded UTF-8 in the Seed
A name arrived as `Diego Marín` instead of `Diego Marín`. **Fixed**; `scripts/encscan.mjs` scans the whole database for the signature and printed `clean` at the time of writing. Re-run it after any seed edit.

### T9 — Random Allocation Contradicted the Demo's Own Story
A "carrying" group showed nobody carrying. Allocation is now **target-driven** so the story reads true. If you change the allocator, re-read the arcs in `server/seed-stories.js` and confirm each one still shows what its `note` claims.

### T10 — Prose That Overstates Is a Bug Here
Some suggestion kinds have no `from` member ("work nobody took on"), so every reason string must handle `fromId === null`. Check `src/routes/project/Equity.tsx` for how the existing render handles it.

## Found in the Second Session (Build of Projects/Workspace)

### T11 — Batch `edit` Calls Are Not Atomic
A failing edit later in a batch can still leave earlier edits applied. Prefer several small `edit` calls, and re-read the file after a failing one.

### T12 — Unused Imports Fail the Build
`noUnusedLocals` and `noUnusedParameters` are on. Nearly every file the second session wrote needed a cleanup pass for exactly this. Run `npx tsc --noEmit` after **every** file, not at the end of the screen.

### T13 — The Signature Tick Is Not Optional
`LoadBar` without the even-share tick says nothing ("9 hours" is only fair or unfair relative to everyone else). Never render a bare hours bar; use `LoadBar`/`ShareBar`.

### T14 — A Spinner That the Harness Cannot See
`scripts/shoot.mjs` waits for `main .spinner` to disappear before screenshotting. If a screen uses a hand-rolled loader without the `.spinner` class, the harness will not wait and will photograph a blank page — and the run will look like a pass.
**Rule:** the loading state is `<div className="page"><Spinner label="…" /></div>` from `src/components/ui`. This is also why `Spinner` renders `.row.spinner`.

## Found in the Third Session (This Documentation Pass)

### T15 — A Router Mounted at a Sub-Path While Declaring Full Paths
**This was the biggest bug in the repository.** `server/routes/planning.js` declares `planningRouter.post("/projects/:id/plan", …)`, i.e. full paths including `/projects`. It was mounted with `app.use("/api/projects", planningRouter)`, so the real URL was `/api/projects/projects/:id/plan`. Every plan, auto-assign, rebalance and nudges call from the browser was a **404**, while the read endpoints next to them worked perfectly — which is why a typecheck and a screenshot both passed.

**Fixed:** mount it at `/api`, the same way `tasksRouter` is mounted (see `server/index.js`, which now carries a comment saying so).

**How to avoid repeating it:** before debugging a 404, read `server/index.js` and check whether the router's own paths already include the mount prefix. The two parallel cases in this repo are deliberate and different:

```js
app.use("/api", planningRouter);          // declares /projects/:id/plan
app.use("/api/projects", projectsRouter); // declares /:id/equity
app.use("/api", tasksRouter);             // declares /tasks/:id and /projects/:id/tasks
```

**The general lesson:** a screen verified only by `tsc` + a screenshot has not been verified. Run `node scripts/smoke.mjs` (which hits every write-shaped endpoint for real) and click the button.

### T16 — Engine-Generated Links Do Not Match the Router
`Nudges`, notifications, the copilot actions and search results once carried `href`s the router did not serve: `/projects/:id/board?task=…`, `?panel=equity`, `/people/:id`, `/classrooms/:id/groups/:projectId`.
**Fixed** in `src/App.tsx`, `src/routes/ProjectWorkspace.tsx`, and `src/routes/ClassroomConsole.tsx` with route aliases and panel-to-tab mapping. The browser harness and API checks now exercise the route families.

**The rule for new work:** a server-generated link is a contract. Either register the route or change the emitter — and add a browser or API assertion before calling it finished.

### T17 — The Web Server Binds IPv6 `localhost` Only
Vite listens on `[::1]:5173`. `http://localhost:5173` works; `http://127.0.0.1:5173` may not. The API is the opposite (`0.0.0.0:8787`, and it also answers on `::1`). The helper scripts already use the right hostnames — do not "tidy" them.

### T18 — Reading UTF-8 JSON with Native Python on Windows
`curl … | python -c "json.load(sys.stdin)"` decodes stdin as **cp1252** and turns `Marín` into `Marín`, which looks exactly like the T8 bug in the database. It is not — it is the shell. Set `PYTHONIOENCODING=utf-8` and/or `open(path, encoding="utf-8")` before concluding the seed is corrupt. Confirm with `node scripts/encscan.mjs`, which is the authority.

### T19 — `/tmp` Is Not the Same Path for Git Bash and Native Windows Tools
Git Bash's `/tmp` does not resolve for native `node`/`python`. Write scratch files to a project-local path (`.tmp/`) when mixing the two.

### T20 — `inspect.mjs` and `shoot.mjs` Need `MSYS_NO_PATHCONV=1`
Without it Git Bash rewrites the leading `/` of a route argument into a filesystem path and the browser navigates nowhere — producing an empty audit that looks like a clean pass.

**Related gotcha:** an *empty* audit is not a clean audit. `inspect.mjs` prints `height: 900` with every array empty when the page never rendered. Cross-check with `shoot.mjs` (`panels` must be > 0) before believing an all-empty result. A cold Vite dev server can take longer than the 1.8s the inspector waits; if everything is empty, re-run.

### T21 — `npm run seed` Wipes the Database
Any task, project or class you created while testing disappears, and every id changes. The demo arcs in `docs/09-demo-data.md` are then invalid. Re-run `node scripts/shapes.mjs` after a reseed if you need ids.

### T22 — Reviews Go to the Teacher, and the Summary Endpoint Is Teacher-Only
`GET /api/projects/:id/reviews/summary` returns `403` for a student, so any screen that calls it must pass `null` as the `useApi` path for non-teachers (see `src/routes/project/Reviews.tsx`).

## From the Fourth Session (2026-10-19 — the Remaining Screens)

### T23 — A Figure the Engine Filled in with a Literal Zero
`classroomOverview()` returned `neverReviewed: 0` as a constant. Nothing failed, because a stub that returns zero is indistinguishable from a classroom that reviews everything — and the console printed "every group has been read" for classes where nobody had read anything.
**Fixed** in `server/engines/classroom.js`: `classProjects()` now carries `reviewCount` (how many peer reviews the group has) and the overview counts the groups with none.
**The rule this broke is the house rule:** a number on screen has to be traceable to data. If you find a second constant standing in for a computation, treat it as a bug, not a placeholder.

### T24 — One Word, Two Measures: `even` Was the Committed Share in One Place and the Delivered Share in Another
`classProjects()` exposed `members[].even` as `m.even.committed`, but `owed` is `even − credited` and every load bar in the product draws `credited` against `even.credited`. The class roster therefore read "11.3h behind an even share" on a student whose equity flag, one line below, said "4.7h behind an even share of delivered work". Both numbers were real; they answered different questions with the same words.
**Fixed** in `server/engines/classroom.js`: `even` is the even share **of delivered work** (the one every load bar draws), and the committed share is exposed separately as `evenCommitted`. **The rule:** when a payload field is named after a measure, check which measure — `EquityMember` carries `even.committed` and `even.credited` separately for exactly this reason.

### T25 — `overflow: hidden` + `text-overflow: ellipsis` on a `<span>`
`.rowitem__title` and `.rowitem__sub` are spans, and both carry the ellipsis pair. Neither property does anything on an inline box, so a long activity-feed subject never truncated and pushed the page sideways on a phone (a 109px horizontal scroll on the project's Activity tab that only appeared at 390px). **Fixed** in `src/styles/surfaces.css` by making both `display: block`. If you put the truncation trio on an element, it must be a block or a flex item — not an inline span.

### T26 — A Grid with No `grid-template-columns` Cannot Shrink
`.grid` set `display: grid` and a gap, and left the columns to the implicit `auto` sizing. For items that cannot shrink, `auto` resolves to max-content, so at 390px a panel holding a name, a chip and a figure pushed the whole page sideways — the page scrolled instead of the row wrapping. It only showed on narrow screens, which is why the desktop sweeps missed it. **Fixed** in `src/styles/app.css`: `.grid { grid-template-columns: minmax(0, 1fr); }`. The `@media (min-width: 56rem)` modifiers still override it.

### T27 — Five Filter Chips Are Wider Than a Phone
`.seg` is an `inline-flex` with no wrapping, so the five filters on `/projects` measured 369px inside a 316px column and gave the page a 16px horizontal scroll. **Fixed** in `src/styles/surfaces.css` with `flex-wrap: wrap; max-width: 100%`.

### T28 — A Link That Is Only as Tall as Its Line of Type
Twenty-ish pixels of inline text is under the 24px floor every target in this product is held to, and it is the most-tapped thing on the screen. `.panel__title a` had already solved this with padding paid back by a negative margin; the same trick is now a class, `.tap`, in `src/styles/app.css`. **Use `.tap` on any link that is a name, a row label or a link at the end of a sentence** — not on a `.btn`, which carries its own padding and centring.

### T29 — `inspect.mjs` Flags *Every* Interactive Element Under 24px Tall
Including a link inside a sentence, which WCAG 2.5.8 exempts. Rather than weaken the checker, the project fixed the targets: `.tap` (above), the board card's title button, and the five weight labels on the equity meter, which were clipping ("Engagement 15% weight" is 150px of type in a 120px column). **Do not add an exemption to `inspect.mjs` to make a screen pass.** Either the target grows or the layout around it changes.

### T30 — `publish()` Was Called with the Wrong Argument Shape
The live stream's `publish` function takes one event object (`{ type, payload, to, classrooms }`). `events.js` passed the type as the first argument and the payload as the second, which meant the server built a frame from `event.payload` on a string and every connected browser silently missed the update. Read-only endpoints and screenshots still passed, so this only appeared in a two-browser write test.
**Fixed:** `server/events.js` now passes the documented event object. `scripts/write-path.mjs` keeps a student SSE connection open while a teacher writes a comment and asserts that the addressed `comment` frame arrives.

### T31 — Raw Task Rows and Hydrated Task Shapes Use Different Dependency Keys
`taskAccess()` returns the SQLite row with `depends_on`; the engine's hydrated task shape calls the same field `dependsOn`. The status route used the latter on the raw row, so closing a newly created task crashed with a 500 before it could return a dependency refusal or complete the ledger write.
**Fixed:** `server/routes/tasks.js` parses `task.depends_on` before checking blocked dependencies. The disposable write-path test now creates, assigns, starts, closes, reads back, and deletes a task, including the completion contribution.

### T32 — `share` and `evenShare` Are Two Different Kinds of Number
The public story payload carries `members[].share` and `distribution.evenShare`, and the landing console formatted both as hours. They are neither of them hours:

- `distribution.evenShare` is the **fraction** `1/n` (0.25 for four members). It exists to place the tick on a 0–100% axis. As hours it printed "even share 0.3h".
- `members[].share` is the engine's **scoring** share — `shares[equity.measure]`, i.e. `credited` once delivery is meaningful and `committed` before that. Multiplying it by the delivered total produces a third number that matches neither measure, so a student who delivered 14h was drawn at 11.2h.

Hours live in `hours.even` and `members[].delivered`. **Rule:** before formatting a payload field, name its unit out loud. A field called `share` is a ratio of *something* — find the denominator before you put "h" after it. Load bars draw delivered hours against `hours.even`; scoring appears only as equity flags and scores.
**Fixed:** `src/routes/Landing.tsx` (`BalanceBars`) and `src/routes/landing/Sections.tsx`.

## From the Submission Pass (2026-10-20)

### T33 — Browser Harnesses Must Not Borrow a Developer's Global Install

The screenshot and inspection scripts originally imported Playwright from an absolute Windows path under the desktop user's profile. That made a clean Linux checkout fail before it could open a page.

**Fixed:** `playwright` is a project dev dependency and all three browser scripts use `scripts/browser.mjs`, which resolves the managed Playwright browser, common system paths, or `PLAYWRIGHT_EXECUTABLE_PATH`. The Dockerfile and README keep the clean-machine setup explicit.
### T34 - A Debounced Save Could Fire Inside a Transaction
`src/demo/server/db.ts` scheduled a localStorage export 350 ms after any write. During the seed (or a plan apply) those writes are inside `BEGIN`/`COMMIT`, so the timer could export rows the transaction had not committed — or still roll back. A refresh could then keep a half-built database.
**Fixed:** `scheduleSave()` is a no-op while `depth > 0`, and the outer transaction writes once in `finally` after `COMMIT` or `ROLLBACK`. Any new background writer must respect the same rule.

### T35 - The Landing Page Waited for the API Probe Before Loading the Demo
On a static host the first figure cannot exist until `sql.js` and the demo router arrive, but both were only requested after `/api/health` failed. On a cold edge that put the landing page's numbers seconds behind its text.
**Fixed:** the build injects `modulepreload` for the demo router and `preload` for the SQLite WASM into `index.html` and `404.html`; the browser now fetches them alongside the app bundle. If the demo chunk is renamed, `spaFallback()` finds the new hash automatically.


### T36 - A Failed First Boot Was Cached Forever
`ensureReady()` memoised its seed promise and `resolveMode()` memoised its own. If the first WASM load or seed failed, every later call reused the rejected promise, so the landing stayed blank until a full reload.
**Fixed:** both memoised promises clear themselves on failure, `resolveMode()` retries `/api/health` once after 400 ms, and the landing retries the story once after 1.5 s. A refresh should never be the only way back.
