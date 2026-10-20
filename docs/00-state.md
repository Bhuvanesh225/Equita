# 00 — State of the build (verified)

Snapshot taken **2026-10-19, after the continued build pass**. Every claim below was checked
against the repository and, where possible, against the running servers — not from memory.

> If you are reading this later: re-verify before trusting it. Run the commands in
> `docs/05-verification.md` and update this file. A state file that is wrong is worse
> than no state file.

## Health

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | **clean** (0 errors) |
| `npm run build` | clean at the third sitting; re-run before a delivery |
| `npm run dev` | API `127.0.0.1:8787` + Vite `localhost:5173`, both up |
| `GET /api/health` | `{"ok":true,...}` |
| `node scripts/smoke.mjs` | 28/28 for `teacher` and for `student` |
| `node scripts/encscan.mjs` | `clean` |
| Version control | **yes** — continued commits through group builder, privacy fixes, and reproducible test setup |
| `README.md` | written; keep it accurate as screens land |
| `npm test` | **clean** — fresh disposable SQLite database, real server, smoke as teacher and student |
| Docker/runtime | `.nvmrc`, `Dockerfile`, `Makefile`, and `scripts/test.mjs` present |
| Write-path test | **clean** — plan/apply, task lifecycle + ledger, assignment, profile, classes, groups, notifications, deletion, and SSE |

Database: `data/equita.db`. Seed on first boot if empty. 20 people · 2 classes ·
6 projects · 93 tasks · 51 assignments · 127 contributions · 65 check-ins ·
44 reviews · 21 notifications · 130 activity rows.

**Every id in this file and in `docs/09-demo-data.md` changes on `npm run seed`.** Re-read
ids with `node scripts/shapes.mjs teacher` after a reseed (T21).

## Screens — all 18 application routes are real

Legend: **built** = real screen · **stub** = renders `<Pending>` from
`src/routes/_pending.tsx` (5 lines each).

| Route | Component | State | LOC | Backing API |
| --- | --- | --- | --- | --- |
| `/` | `Landing` | built | 95 + `landing/*` 1,432 | `GET /api/public/story` |
| `/login` | `Login` | built | 113 | `POST /api/auth/login` · `/demo` |
| `/signup` | `Signup` | built | 140 | `POST /api/auth/signup` |
| `/join` | `Join` | built | 121 | `POST /api/classrooms/join` |
| `/today` | `Dashboard` | built | 609 | `GET /api/insights/dashboard`, `POST /api/projects/:id/checkin` |
| `/projects` | `Projects` | built | 372 | `GET /api/projects` |
| `/projects/new` | `NewProject` | **built** | 372 | `POST /api/projects` |
| `/projects/:projectId` | `ProjectWorkspace` | built | 560 + `project/*` 1,905 | see below |
| `/projects/:projectId/board` | (alias → `ProjectWorkspace`) | built | — | same |
| `/classrooms` | `Classrooms` | **built** | 380 | `GET /api/classrooms`, `POST /api/classrooms`, `POST /api/classrooms/join` |
| `/classrooms/:classroomId` | `ClassroomConsole` | **built** | 250 + `classroom/*` 1,290 | `GET /api/classrooms/:id` (one call, four tabs), `PATCH`, `POST /students`, `DELETE /students/:userId`, `POST /projects` |
| `/people/:personId` | `People` | built | 436 | `GET /api/insights/people/:id` |
| `/classrooms/:classroomId/groups` | `GroupBuilder` | built | 407 | `POST /groups/preview`, `POST /projects` |
| `/classrooms/:classroomId/students/:studentId` | `StudentRecord` | built | 428 | `GET /api/classrooms/:id/students/:userId` |
| `/insights` | `Insights` | built | 460 + `insights/Classes` | dashboard, classroom analytics |
| `/people` | `People` | built | 436 | `GET /api/insights/search`, `GET /api/insights/people/:id` |
| `/profile` | `Profile` | built | 448 | `GET/PATCH /api/auth/me`, `PUT /api/auth/me/skills` |
| `/notifications` | `Notifications` | built | 206 | `GET /api/insights/notifications`, `POST .../read` |
| `/settings` | `Settings` | built | 344 | `PATCH /api/auth/me`, class leave, sign out |
| `*` | `NotFound` | built | 63 | — |

All four tabs of `/classrooms/:id` render from the single `GET /api/classrooms/:id` call.
Verified clean by `scripts/inspect.mjs` at 1440 and 390 in light mode, for `teacher`
and for `student`.


`ProjectWorkspace` panels (all built, in `src/routes/project/`):

| File | LOC | What it is |
| --- | --- | --- |
| `Board.tsx` | 313 | `TaskBoard` (dnd-kit, one lane per member + "Nobody"), `TaskTable`, `ViewSwitch` |
| `Equity.tsx` | 320 | `EquityPanel` (dial, 5 part meters, per-member `LoadBar`, flags, history chart), `RebalancePanel` |
| `Plan.tsx` | 414 | `PlanDialog` (brief → plan → apply), `AutoAssignDialog` (preview → apply) |
| `TaskSheet.tsx` | 383 | task drawer: status, assign, candidates, hours, comments, delete |
| `TaskForm.tsx` | 259 | `SkillPicker` + `TaskFormDialog` (create/edit) |
| `Reviews.tsx` | 216 | `ReviewsPanel`, `ReviewsList`, aggregated summary for teachers |

## Built surface (counts)

| Layer | Lines |
| --- | --- |
| `server/` total | 7,457 |
| `server/engines/` (the intelligence layer) | 2,652 |
| `src/` total | ~7,000 |
| `src/lib/types.ts` | 724 |
| `src/components/` (ui, blocks, charts, overlays, icons) | 2,023 |
| built routes + panels | 5,466 |

## Integration debt — remaining verification rather than missing screens (P0)

The engine-generated links are now registered by the router. The remaining P0 work is
verification: follow one generated link from each family in a browser and exercise every
workspace write control rather than assuming a successful screenshot proves a POST exists.

| Emitted link | Where from | Correct app route today |
| --- | --- | --- |
| `/projects/:id/board?task=:taskId` | nudges, tasks, planning, insights search, copilot | `/projects/:id?tab=board&task=:taskId` |
| `/projects/:id?panel=equity` | nudges (`unassigned-work`, `share-gap`, `rebalance`) | `/projects/:id?tab=equity` |
| `/projects/:id?panel=plan` / `?panel=team` | nudges | `/projects/:id?tab=board` / `?tab=people` |
| `/people/:personId` | insights search, `Equity.tsx`, `ProjectWorkspace.tsx` | `People` record |
| `/classrooms/:classroomId/groups/:projectId` | nudges (`class-*`) | redirect to `/projects/:projectId` |
| `/classrooms/:classroomId?panel=attention` | copilot | `/classrooms/:classroomId` (ignores the param) |

The alias-in-the-router approach is implemented in `src/App.tsx`, preserving old notification
rows without rewriting stored links.

## Fixed during this documentation pass (2026-10-18, third sitting)

| # | Defect | Fix |
| --- | --- | --- |
| F1 | **The whole intelligence write-path was 404 from the browser.** `planningRouter` declares full paths (`/projects/:id/plan`) but was mounted at `/api/projects`, so every endpoint was actually served at `/api/projects/projects/…`. `Plan from the brief`, `Place the unclaimed work`, `plan/apply`, `assign/auto`, `assign/:taskId`, `rebalance/apply` and `nudges` all 404'd, while the read endpoints beside them worked — which is why it survived a typecheck and a screenshot. | `server/index.js`: mount `planningRouter` at `/api`, like `tasksRouter`. Verified live: `POST /api/projects/:id/plan` → 200, `/assign/auto` → 200, `GET /api/projects/:id/nudges` → 200. |

That fix means the workspace's three headline actions now work end-to-end. **Everything
in the project workspace deserves a live click-through** — the previous session built it
under typecheck only, and this was the second bug of that class found. Use
`docs/05-verification.md` → "exercise the write path", not a screenshot.

## Fixed during the fourth sitting (2026-10-19)

| # | Defect | Fix |
| --- | --- | --- |
| F2 | **Six families of engine-written links were 404s.** `/projects/:id/board?task=`, `/people/:id`, `/classrooms/:id/groups/:projectId`, and the engine's `?panel=` vocabulary were not routes the app answered. Fixed by aliasing in the router (option 1 in `docs/10-decisions.md` O-01) so notification rows already stored with the old links keep working. | `src/App.tsx`, `src/routes/ProjectWorkspace.tsx`, `src/routes/ClassroomConsole.tsx` |
| F3 | **`neverReviewed` was a literal `0`.** The console claimed every group had been read. | `server/engines/classroom.js` (T23) |
| F4 | **`even` meant two different measures.** The roster said "11.3h behind an even share" above the equity flag that said "4.7h behind". | `server/engines/classroom.js` (T24) |
| F5 | **The page scrolled sideways at 390px on three built screens.** Three separate causes: a grid with no explicit column template, an unwrapping segmented control, and `text-overflow: ellipsis` on inline spans that therefore never truncated. | `src/styles/app.css`, `src/styles/surfaces.css` (T25–T27) |
| F6 | **Inline text links were 19–20px tall**, under the 24px floor `inspect.mjs` enforces. `.tap` added, card titles grown, the equity meter's clipped weight labels shortened. | `src/styles/app.css`, `src/components/blocks.tsx`, `src/routes/Projects.tsx`, `src/routes/project/Equity.tsx`, `src/routes/ProjectWorkspace.tsx` (T28–T29) |
| F7 | **Live events never reached clients.** `events.js` called `publish()` with two arguments although the bus accepts one event object, so writes appeared in the database but open browsers did not refetch. | `server/events.js`, covered by `scripts/write-path.mjs` and the SSE assertion in T30 |
| F8 | **Closing a newly-created task could 500.** The status route read `task.dependsOn` from a raw SQLite row instead of parsing `task.depends_on`, so the dependency check called `.map` on `undefined`. | `server/routes/tasks.js`, covered by the task lifecycle write-path test and T31 |

`inspect.mjs` now returns `problems: []`-equivalent output at 1440 **and** 390, in **paper
and ink**, for `teacher` and for `student`, on every built route.

## Spacing pass (2026-10-20) — systemic rhythm, no route behaviour touched

A layout-harmony pass over the shared CSS only. Verified with `scripts/inspect.mjs` at
1440 **and** 390 (all app routes, `teacher` and `student`, `problems: []`), `npx tsc --noEmit`
and `npm run build`.

| # | Defect | Fix |
| --- | --- | --- |
| S1 | **Panel headers alternated 54/60/70px.** A head holding a small action button outgrew one without it, and a wrapping title outgrew both — so the header band and the body under it started on different lines down a column. | `.panel__head` now has one `min-height` (3.75rem; 4.4rem under `pointer: coarse`), in `overhaul.css`. |
| S2 | **Header, body and footer broke on three different left edges** (1.1rem vs 1.15rem inline padding). | Inline padding unified to 1.15rem across `.panel__head` / `.panel__body` / `.panel__foot`. |
| S3 | **`grid--halves` cards ended at ragged heights**, leaving a step-shaped notch down the middle of a row. | `.grid--halves` stretches again; `.panel__body` (`flex: 1 1 auto`) absorbs the slack so footers line up on the row baseline. |
| S4 | **The figure strip was lopsided** — ink divider on the final cell but an open left edge, and on two columns the first row kept its right divider. | The last cell (and each row's last cell at ≤40rem) drops its right divider; both ends now sit flush with the page content. |
| S5 | **The landing console score clipped** (`60.9` needed 40px in a 2.4rem column). | Number column widened to 3rem, `landing-redesign.css`. |

Known remaining, **intentional**: the `grid--split` rail is shorter than its main column on
`/today` and `/profile`, so the area beside the lower main panels is empty. That is content
balance, not a spacing bug; rebalance the panels themselves if it should close.

## Landing figures + one measure across the workspace (2026-10-20, second pass)

The landing console printed numbers it had not computed, and the desktop shell drew the page
header and the page body on two different left edges. Verified in the browser at 1920, 1440
and 390; `npx tsc --noEmit` and `npm run build` clean, `scripts/inspect.mjs` empty on every
route at all three widths.

| # | Defect | Fix |
| --- | --- | --- |
| L1 | **Hero read "even share 0.3h".** The label formatted `distribution.evenShare`, which is the *fraction* `1/n` (0.25 for four people), as if it were hours. | Label uses `situation.hours.even`. Now "6.7h" (group) and "5h" (teacher), matching the delivered total over the member count. `src/routes/Landing.tsx`. |
| L2 | **Bars plotted a different quantity than the axis.** They drew `member.share * total`, where `share` is the engine's *scoring* share (`credited`/`committed` per `equity.measure`) and `total` is delivered hours — so the teacher console showed Maya at 11.2h when she had delivered 14h. | Bars plot `member.delivered`; width is `delivered / scale`. Group: 19.5 / 7.3 / 0 / 0 = 26.8. Teacher: 14 / 4 / 2 / 0 = 20. |
| L3 | **The even-share tick and its label could disagree.** CSS pinned `.eq-bars__even-label` at `left: 25%`, which is only right for a four-person group; five members put the tick at 20%. | Label is positioned inline at `${evenShare * 100}%`, with `evenShare` the fraction. |
| L4 | **A member with zero hours still drew a 4px bar** (`.eq-bar__track span` carried `min-width: 0.25rem`), so "has done nothing" looked like "has done a little". | Zero hours renders width `0%` with `minWidth: 0`. |
| L5 | **"After the suggested move" could overflow its own axis.** A `fill` move (no `from` member) adds hours the delivered total does not include, so the projected bar passed the axis end. | The projection shifts delivered hours by `move.effort` and raises the scale by the same amount when `move.from` is null; values clamp to the scale. |
| L6 | **"…% of the delivered work" on the landing story** was computed from the scoring share. | `landing/Sections.tsx` divides `member.delivered` by `drift.hours.delivered`. |
| W1 | **Desktop pages had two empty bands down the sides.** `main.shell` took `padding-inline: clamp(2rem, 4vw, 4.5rem)` at ≥64rem while `.topbar__inner` kept 1.25rem, so the body sat 72px inside its own header and the header's borders stopped short of the content. | `overhaul.css` sets `--workspace-pad` on `.app` (1.25rem; 2.5rem ≥60rem; 1rem ≤40rem) and `.app .shell { padding-inline: var(--workspace-pad) }`, so header and body share one inset. Measured: at 1440 topbar/main `240..1440`, page `280..1400`; at 1920 page `280..1880`. |
| W2 | **The shell had no upper measure**, so on a 1920 display it stretched to 1680px of body. | `.app .shell { max-width: 108rem }` at ≥60rem. |
| L7 | **The landing frame stopped growing at 1312px** on any desktop wider than 1440 (`--eq-max: 82rem`), leaving 300px of dead margin at 1920. | `@media (min-width: 96rem) { .equita-landing { --eq-max: 100rem } }` — frame is 1600px at 1920, unchanged at 1440. |

Related trap: `T32` in `docs/06-traps.md` (a payload's `share` is a measure, not a fraction of
hours; `evenShare` is a fraction).

## Known smaller defects

| # | Defect | Where |
| --- | --- | --- |
| D2 | `Dashboard.tsx` returns `null` on a dashboard error instead of a visible error state (masked a real crash before) | `src/routes/Dashboard.tsx` |
| D4 | `legacy/` (3 files, old static landing) is dead weight | `equita/legacy/` |
| D7 | hackathon root has 16 MB of throwaway screenshots (`.work/`) and a stray `landing-hero.png` | `../` |
| D8 | `/api/projects/:id/reviews/summary` returns an empty `members: []` even for a teacher when no reviews exist yet — confirm it is intended and not an early return | `server/routes/projects.js:480` |

## What the next session should do

In order. The checklist with acceptance tests is `TODO.md`; the reasoning is in `ROADMAP.md`.

1. **P0-3** — click everything in the project workspace (the mount bug F1 is fixed, but the
   screen has never been exercised end to end with a mouse).
2. **P1-4** — `/classrooms/:id/students/:studentId`.
3. **P2** — `/insights`, `/people` (+`/people/:id`), `/profile`, `/notifications`, `/settings`.
4. **P3** — the group builder (`@dnd-kit` is installed and used by the board; make it earn its
   place here, with a keyboard path).
5. **P4** — delete `_pending.tsx`, then a mobile + ink-scheme sweep over the routes that
   exist, a liveness sweep with two browsers, and `README.md`.

## The doc set

| File | Read it for |
| --- | --- |
| `AGENTS.md` | the contract: read order, non-negotiables, definition of done |
| `TODO.md` | the live task list |
| `ROADMAP.md` | phase order and why |
| `docs/01-architecture.md` | process, request lifecycle, database, engines |
| `docs/02-api.md` | every endpoint, exact keys, screen → endpoint map |
| `docs/03-design-system.md` | tokens, primitives, furniture classes |
| `docs/04-conventions.md` | the patterns the existing screens follow |
| `docs/05-verification.md` | the harnesses, and how to exercise a write |
| `docs/06-traps.md` | 22 bugs already paid for |
| `docs/07-screen-specs.md` | the six large remaining screens |
| `docs/08-screen-specs-small.md` | the four small screens + the missing routes |
| `docs/09-demo-data.md` | accounts, ids, the six situations |
| `docs/10-decisions.md` | locked decisions and open questions |
