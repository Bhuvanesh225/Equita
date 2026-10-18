# 00 — State of the build (verified)

Snapshot taken **2026-10-18, after the second working session** (session id
`01a14f2b-0ad5-737a-a34e-7b9bb787e134`). Every claim below was checked against the
repository and, where possible, against the running servers — not from memory.

> If you are reading this later: re-verify before trusting it. Run the commands in
> `docs/05-verification.md` and update this file. A state file that is wrong is worse
> than no state file.

## Health

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | **clean** (0 errors) |
| `npm run build` | **clean** (last run: 2.7s, largest chunk `react` 301 kB / 95 kB gzip) |
| `npm run dev` | API `127.0.0.1:8787` + Vite `localhost:5173`, both up |
| `GET /api/health` | `{"ok":true,"tables":17}` |
| `node scripts/smoke.mjs` | **28/28** for `teacher` and for `student` |
| `node scripts/encscan.mjs` | `clean` (no double-encoded UTF-8 in the DB) |
| `npm run selfcheck` | works — now an alias for `scripts/smoke.mjs` |
| Version control | **none** — no `.git` directory (P0-1) |
| `README.md` | written; keep it accurate as screens land |

Database: `data/equita.db`. Seed on first boot if empty. 20 people · 2 classes ·
6 projects · 93 tasks · 51 assignments · 127 contributions · 65 check-ins ·
44 reviews · 21 notifications · 130 activity rows.

## Screens — 8 of 18 routes are real

Legend: **built** = real screen · **stub** = renders `<Pending>` from
`src/routes/_pending.tsx` (5 lines each).

| Route | Component | State | LOC | Backing API |
| --- | --- | --- | --- | --- |
| `/` | `Landing` | built | 95 + `landing/*` 1,432 | `GET /api/public/story` |
| `/login` | `Login` | built | 113 | `POST /api/auth/login` · `/demo` |
| `/signup` | `Signup` | built | 140 | `POST /api/auth/signup` |
| `/join` | `Join` | built | 121 | `POST /api/classrooms/join` |
| `/today` | `Dashboard` | built | 609 | `GET /api/insights/dashboard`, `POST /api/projects/:id/checkin` |
| `/projects` | `Projects` | built | 369 | `GET /api/projects` |
| `/projects/:projectId` | `ProjectWorkspace` | built | 539 + `project/*` 1,905 | see below |
| `*` | `NotFound` | built | 63 | — |
| `/projects/new` | `NewProject` | **stub** | 5 | `GET /api/skills`, `POST /api/projects` |
| `/classrooms` | `Classrooms` | **stub** | 5 | `GET /api/classrooms`, `POST /api/classrooms` |
| `/classrooms/:classroomId` | `ClassroomConsole` | **stub** | 5 | `GET /api/classrooms/:id` · `/analytics` · `/coverage`; `POST /students`, `/projects` |
| `/classrooms/:classroomId/groups` | `GroupBuilder` | **stub** | 5 | `POST /api/classrooms/:id/groups/preview`, `/projects` |
| `/classrooms/:classroomId/students/:studentId` | `StudentRecord` | **stub** | 5 | `GET /api/classrooms/:id/students/:userId` |
| `/insights` | `Insights` | **stub** | 5 | `GET /api/classrooms/:id/analytics`, `GET /api/projects/:id/equity` |
| `/people` | `People` | **stub** | 5 | `GET /api/insights/search`, `GET /api/insights/people/:id` |
| `/profile` | `Profile` | **stub** | 5 | `GET/PATCH /api/auth/me`, `PUT /api/auth/me/skills`, `GET /api/skills/clusters` |
| `/notifications` | `Notifications` | **stub** | 5 | `GET /api/insights/notifications`, `POST /api/insights/notifications/read` |
| `/settings` | `Settings` | **stub** | 5 | `PATCH /api/auth/me` |

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

## Integration debt — routes the app links to but does not have (P0)

The engine-generated links and the router disagree. These are live 404s — the
`*` catch-all renders `NotFound`. Verified by reading
`server/engines/nudges.js`, `server/routes/tasks.js`, `server/routes/planning.js`,
`server/routes/insights.js` against `src/App.tsx`.

| Emitted link | Where from | Correct app route today |
| --- | --- | --- |
| `/projects/:id/board?task=:taskId` | nudges, tasks, planning, insights search, copilot | `/projects/:id?tab=board&task=:taskId` |
| `/projects/:id?panel=equity` | nudges (`unassigned-work`, `share-gap`, `rebalance`) | `/projects/:id?tab=equity` |
| `/projects/:id?panel=plan` / `?panel=team` | nudges | `/projects/:id?tab=board` / `?tab=people` |
| `/people/:personId` | insights search, `Equity.tsx`, `ProjectWorkspace.tsx` | **no route at all** |
| `/classrooms/:classroomId/groups/:projectId` | nudges (`class-*`) | **no route at all** |
| `/classrooms/:classroomId?panel=attention` | copilot | `/classrooms/:classroomId` (ignores the param) |

Two ways to fix, both acceptable — pick one and record it in `docs/10-decisions.md`:

1. **Alias in the router (smallest, safest):** register `/projects/:projectId/board`
   → same element as the workspace; make `ProjectWorkspace` treat `panel` as an alias
   for `tab`; add `/people/:personId` → `People` in drawer mode; add
   `/classrooms/:classroomId/groups/:projectId` → redirect to `/projects/:projectId`.
2. **Change the emitters** in `server/engines/nudges.js`, `server/routes/{tasks,planning,insights}.js`,
   `server/engines/copilot.js` to match the router. More files, but one convention.

Aliasing is recommended: it also keeps old notification rows (already stored with the
old href) working.

## Fixed during this documentation pass (2026-10-18, third sitting)

| # | Defect | Fix |
| --- | --- | --- |
| F1 | **The whole intelligence write-path was 404 from the browser.** `planningRouter` declares full paths (`/projects/:id/plan`) but was mounted at `/api/projects`, so every endpoint was actually served at `/api/projects/projects/…`. `Plan from the brief`, `Place the unclaimed work`, `plan/apply`, `assign/auto`, `assign/:taskId`, `rebalance/apply` and `nudges` all 404'd, while the read endpoints beside them worked — which is why it survived a typecheck and a screenshot. | `server/index.js`: mount `planningRouter` at `/api`, like `tasksRouter`. Verified live: `POST /api/projects/:id/plan` → 200, `/assign/auto` → 200, `GET /api/projects/:id/nudges` → 200. |

That fix means the workspace's three headline actions now work end-to-end. **Everything
in the project workspace deserves a live click-through** — the previous session built it
under typecheck only, and this was the second bug of that class found. Use
`docs/05-verification.md` → "exercise the write path", not a screenshot.

## Known smaller defects

| # | Defect | Where |
| --- | --- | --- |
| D2 | `Dashboard.tsx` returns `null` on a dashboard error instead of a visible error state (masked a real crash before) | `src/routes/Dashboard.tsx` |
| D3 | `npm run selfcheck` points at a file that does not exist | `package.json` |
| D4 | `legacy/` (3 files, old static landing) is dead weight | `equita/legacy/` |
| D5 | no `README.md` | repo root |
| D6 | no `.git` | repo root |
| D7 | hackathon root has 16 MB of throwaway screenshots (`.work/`) and a stray `landing-hero.png` | `../` |
| D8 | `/api/projects/:id/reviews/summary` returns an empty `members: []` even for a teacher when no reviews exist yet — confirm it is intended and not an early return | `server/routes/projects.js:480` |

## What the next session should do

In order. The checklist with acceptance tests is `TODO.md`; the reasoning is in
`ROADMAP.md`.

1. **P0-1** — `git init`, `.gitignore`, first commit. There is no way to undo a bad write today.
2. **P0-2** — register the three missing routes and accept `panel` as an alias for `tab`
   (`docs/08-screen-specs-small.md`). Six families of already-written links start working.
3. **P0-3** — click everything in the project workspace. The mount bug (F1) is fixed, but the
   screen has never been exercised end to end.
4. **P1** — `/projects/new`, `/classrooms`, the class console, the student record.
5. **P2** — `/insights`, `/people` (+`/people/:id`), `/profile`, `/notifications`, `/settings`.
6. **P3** — the group builder (`@dnd-kit` is installed and used by the board; make it earn its
   place here, with a keyboard path).
7. **P4** — delete `_pending.tsx`, then a mobile + ink-scheme sweep over every route, a
   liveness sweep with two browsers, and `README.md` (already written — keep it accurate).

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