> **Superseded in parts — read `docs/00-state.md` for current state.**
>
> This file is the handoff written at the end of the **first** session. Everything it says
> about the engines, the design contract, the seed's stories and the environment is still
> true. Its *status table and next-steps list are out of date*, because a second and third
> sitting have happened since:
>
> - `/projects` and the whole project workspace (`src/routes/project/*`) are built.
> - `planningRouter` was mounted at the wrong prefix, so every plan / allocation / rebalance
>   endpoint was a 404 from the browser. **Fixed** (`server/index.js`).
> - `scripts/smoke.mjs` was added (28 endpoints, non-mutating) and `npm run selfcheck` now
>   points at it.
> - `scripts/shoot.mjs` and `scripts/inspect.mjs` accept `EQUITA_WIDTH` / `EQUITA_HEIGHT` /
>   `EQUITA_SCHEME`, so the mobile and ink-scheme passes are runnable.
> - `AGENTS.md`, `README.md`, `TODO.md`, `ROADMAP.md` and the `docs/` set were written. Start
>   at `AGENTS.md`.
>
> Everything below is kept as the record of the first session's reasoning.

---

# Equita — handoff

A form to be read by whoever (or whatever) picks this up next. Fill nothing in by hand;
every field below is already true of the repository as it stands.

---

## 1. Header

| Field | Value |
| --- | --- |
| Project | **Equita** — project coordination that keeps group work even |
| What it is | A platform for student teams *and* classrooms. Plans work in hours, places each task with a person whose skills and bandwidth match, and shows the group as a number when the split has tipped. |
| Repository | `E:/Hackathons/Neighborhood Hacks/equita` |
| Session | `pi-session-2026-10-18T10-22-12-060Z_01a14e88…` (886 entries, one sitting) |
| Date of session | 2026-10-18 |
| Working directory for dev | `E:/Hackathons/Neighborhood Hacks/equita` |
| Version control | **None.** `git init` was never run. Take a backup before large refactors. |
| Stack | React 19 + Vite 8 + TypeScript 5.9 + Tailwind v4 (client) · Express 5 + `node:sqlite` (server) |
| Node needed | **22.5+** — `node:sqlite` is used without a native build step |
| Typecheck | `npx tsc --noEmit` → **clean** (verified during handoff) |
| Overall status | **Server complete. Marketing site complete. Auth complete. Dashboard complete. 12 of 18 app screens are still stubs.** |

---

## 2. What "the whole app" means here

The session brief was: build the entire product, cut no corners, use the MCPs and skills
available, and keep it visible in the browser as it goes.

Read that against the current state:

- The **intelligence layer is finished and live.** 5,414 lines of engines and routes:
  skill matching, project context, the equity engine (5 weighted parts), the planner,
  the allocator, classroom grouping, nudges, and the copilot. Every number on the marketing
  page is computed by these engines from the seed dataset, not written by hand.
- The **front end is built for six surfaces and stubbed for twelve.** This is the gap.

Do not re-derive the engines. Do not touch the seed's *story*. The remaining work is
UI that renders data which already exists and already has types.

---

## 3. State of every screen

Legend: **built** = real screen · **stub** = renders `<Pending>` from `src/routes/_pending.tsx`.

| Route | Component | State | LOC | Backing API |
| --- | --- | --- | --- | --- |
| `/` | `Landing` | built | 95 (+ `landing/*` 1,432) | `GET /api/public/story` |
| `/login` | `Login` | built | 113 | `POST /api/auth/login` |
| `/signup` | `Signup` | built | 140 | `POST /api/auth/signup` |
| `/join` | `Join` | built | 121 | `POST /api/classrooms/join` |
| `/today` | `Dashboard` | built | 609 | `GET /api/insights/dashboard`, `POST /api/projects/:id/checkin` |
| `*` | `NotFound` | built | 63 | — |
| `/projects` | `Projects` | **stub** | 5 | `GET /api/projects` |
| `/projects/new` | `NewProject` | **stub** | 5 | `GET /api/skills`, `POST /api/projects` |
| `/projects/:projectId` | `ProjectWorkspace` | **stub** | 5 | `GET /api/projects/:id` · `/equity` · `/activity` · `/reviews`; `POST /api/projects/:id/plan`, `/plan/apply`, `/assign/auto`, `/rebalance/apply`; `POST /api/projects/:id/tasks`; `POST /api/tasks/:id/*` |
| `/classrooms` | `Classrooms` | **stub** | 5 | `GET /api/classrooms`, `POST /api/classrooms` |
| `/classrooms/:classroomId` | `ClassroomConsole` | **stub** | 5 | `GET /api/classrooms/:id` · `/coverage` · `/analytics`; `POST /api/classrooms/:id/students`, `/projects` |
| `/classrooms/:classroomId/groups` | `GroupBuilder` | **stub** | 5 | `POST /api/classrooms/:id/groups/preview` |
| `/classrooms/:classroomId/students/:studentId` | `StudentRecord` | **stub** | 5 | `GET /api/classrooms/:id/students/:userId` |
| `/insights` | `Insights` | **stub** | 5 | `GET /api/projects/:id/equity`, `GET /api/classrooms/:id/analytics` |
| `/people` | `People` | **stub** | 5 | `GET /api/insights/search`, `GET /api/insights/people/:id` |
| `/profile` | `Profile` | **stub** | 5 | `GET/PATCH /api/auth/me`, `PUT /api/auth/me/skills`, `GET /api/skills/clusters` |
| `/notifications` | `Notifications` | **stub** | 5 | `GET /api/insights/notifications`, `POST /api/insights/notifications/read` |
| `/settings` | `Settings` | **stub** | 5 | `PATCH /api/auth/me` |

`src/routes/_pending.tsx` says it should be deleted when the last stub is replaced.
That is the finish line marker.

---

## 4. How to run it

```bash
cd "E:/Hackathons/Neighborhood Hacks/equita"
npm install          # already installed
npm run dev          # API :8787 + Vite :5173, both hot-reloading
```

- API: `http://127.0.0.1:8787` · Web: `http://localhost:5173`
- Vite proxies `/api` and `/events` (SSE) to the API.
- The database is seeded on first boot if empty: `data/equita.db`.

Other scripts:

```bash
npm run build        # vite build
npm run typecheck    # tsc --noEmit
npm run seed         # node server/seed.js --reset   (wipes and reseeds)
npm run selfcheck    # ⚠ BROKEN — server/selfcheck.js does not exist
```

### Demo accounts

All seeded accounts share the password **`equita2026`**.

| Role | Email | Use it for |
| --- | --- | --- |
| Teacher (primary) | `amara@equita.demo` | every teacher surface, class console |
| Teacher (second) | `tobias@equita.demo` | a second class, comparison |
| Student (primary) | `maya@equita.demo` | member view, "carrying" state |
| Student (free) | `june@equita.demo` | a student in no class |

`POST /api/auth/login { email, password }` · `POST /api/auth/demo { email }` skips the password
for any `*@equita.demo` address.

### Seed contents

20 people · 2 classrooms · 6 projects · 93 tasks · 51 assignments · 127 contributions ·
65 check-ins · 44 reviews · 21 notifications · 130 activity rows.

The dataset is **deliberately shaped** so each screen has a story to tell: one badly
overloaded group, one quiet group, one healthy group. `server/seed-stories.js` owns those
arcs. If you change the seed, verify the stories still read true.

---

## 5. Verification tooling (use it, don't eyeball)

Four scripts already exist in `scripts/`. They sign in through the real API and drive a
local Playwright Chromium — deliberate, so nothing depends on a browser tab you happen to
have open.

```bash
# Screenshots, one PNG per route, into .shots/
node scripts/shoot.mjs teacher .shots /today /projects /projects/new

# Layout inspector: clipped text, overflow, overlap, hit-targets, sideways scroll
MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher /today /projects /projects/new

# Print the exact shape of every API response a screen must render
node scripts/shapes.mjs            # teacher
node scripts/shapes.mjs student    # student

# Raw DOM dump when a screen renders nothing and a screenshot cannot say why
MSYS_NO_PATHCONV=1 node scripts/probe.mjs teacher /today
```

`MSYS_NO_PATHCONV=1` is **required** for `inspect.mjs` and `probe.mjs` on Windows/Git Bash,
otherwise the leading `/` in the route is rewritten into a filesystem path.

`inspect.mjs` writes `.shots/report.json`. Read the `problems` array — it is the mechanical
substitute for "looks fine to me". Run it after every screen.

---

## 6. Traps found this session — do not rediscover them

These cost real time. They are fixed; keep them fixed.

1. **SQLite WAL retriggered the dev server forever.** `data/equita.db-wal` is touched on every
   write, and Vite's watcher counted it as a source change → every open page reloaded ~every
   2s, which read as "the site won't stay still". Fixed in `vite.config.ts` by ignoring
   `**/data/**` (plus `.shots`, logs).
2. **Global `scroll-behavior: smooth`** made every programmatic scroll animate indefinitely,
   fighting scroll restoration. Removed.
3. **`signIn` did not await the session refresh**, so the route guard redirected before the
   user landed. Fixed at the source in `src/lib/session.tsx`.
4. **`Dashboard.tsx` renders `null` when the dashboard payload errored** — this masked a live
   crash as a blank page during development. Prefer a visible error state.
5. **Stale server holding port 8787** silently serves pre-edit code. If a fix appears to have
   no effect, kill by port and restart before debugging.
6. **The Playwright MCP extension tab freezes when backgrounded** — `page.goto` inside a
   `browser_run_code` call never wakes it. Either bring the tab forward through the tool-level
   navigation, or use `scripts/shoot.mjs` (the local-CHROMIUM harness) instead.
7. **Component tree cannot be rewritten wholesale** — the write tool drops `path` on very large
   payloads, and a truncated write once deleted `index.html`. Write large files in chunks.
8. **Double-encoded UTF-8 in the seed** (a name like `Diego Marín` had arrived as
   `Diego Marín`). Found and fixed; `scripts/encscan.mjs` scans the whole database for the
   signature. Re-run it after any seed edit.
9. **Random allocation made the demo contradict its own story.** Allocation is now
   target-driven so the "carrying" group actually shows someone carrying.
10. **Prose that overstates is a bug here.** Some suggestion kinds have no `from` member
    ("work nobody took on"), so reason strings must handle `from === null`.

---

## 7. Design contract (already decided — extend, don't relitigate)

`DESIGN.md` is the record, written before the build. The binding parts:

- Direction: **`page-is-the-object`** — the marketing page *is* the project brief handed out in
  class; the allocation table is its centrepiece. Seed 68106341.
- **Radius 0 everywhere.** Panels, cards, buttons, inputs. Circles only for avatars and the
  even-share marker.
- No shadows except overlays. Surfaces step in **tone**, never in lines.
- Tokens: ground `--paper #FBFAF8` · ink `#14171A` · accent `--accent #0B7A63`;
  signals `--ok` / `--over #9A5A08` / `--risk #AD2418`, used for meaning only.
- Type: **Bricolage Grotesque** (display) + **Inter** (UI, tabular figures). App scale 12→30.
- The **signature component is the load bar**: a member's effort share against the even share,
  with a tick at the even position. It must appear in the project panel, the class console and
  the insights screen so the product has one mark, not four.
- House rule: **no invented proof.** Claims print numbers the engine computed, or they do not
  appear.
- The darker scheme (`data-scheme="ink"`) is set before first paint in `index.html`. New
  components must work in both schemes — check the ink scheme on every screen.

### Client conventions

- Server state goes through `useApi` / `get` / `post` / `patch` / `put` / `del` from
  `src/lib/api.ts`. `useApi` is live: it refreshes off the `/events` SSE channel.
- Types for **every** screen already exist in `src/lib/types.ts` (724 lines). Build against
  them; don't invent parallel shapes.
- Shared blocks: `src/components/ui.tsx` (primitives, `Panel`, `Spinner`, load bar),
  `blocks.tsx`, `charts.tsx`, `overlays.tsx`, `icons.tsx` (hand-drawn, no icon dependency).
- Screens are `lazy()`-loaded per route in `src/App.tsx`; the shell and the two overlays
  (command palette, copilot) live under the router so they can navigate.

---

## 8. Next steps, in order

1. **`/projects`** — the list. Cards with the load bar, filters by status, empty state.
2. **`/projects/:projectId`** — the workspace and the centrepiece: task table, the plan
   proposal → apply flow, auto-assign, rebalance suggestions, equity panel, activity, reviews.
   This is the highest-value screen in the product.
3. **`/projects/new`** — brief-style creation form (course code, deadline, tasks, members).
4. **`/classrooms`** and **`/classrooms/:id`** — the console: roster, coverage, analytics.
5. **`/classrooms/:id/groups`** — the group builder (draggable; `@dnd-kit` is installed and
   unused so far).
6. **`/classrooms/:id/students/:studentId`** — student record.
7. **`/insights`** — fairness across projects and classes.
8. **`/profile`**, **`/people`**, **`/notifications`**, **`/settings`** — the smaller screens.
9. Delete `src/routes/_pending.tsx`.
10. Mobile pass (390px) over every screen, then the ink scheme, then
    `node scripts/inspect.mjs <account> <every route…>` until `problems` is empty everywhere.

### Definition of done

- [ ] `npx tsc --noEmit` clean.
- [ ] No route renders `<Pending>`; `_pending.tsx` deleted.
- [ ] `scripts/inspect.mjs` returns no problems for every route, at 1440 and 390.
- [ ] Both schemes (`paper`, `ink`) checked on every screen.
- [ ] Every screen live-updates over `/events` (open two browsers, act in one).
- [ ] Every number shown is computed by the engine — no hard-coded figures in JSX.
- [ ] `README.md` written (it does not exist yet; `DESIGN.md` is not a substitute).

---

## 9. Open items and known gaps

| Item | Detail |
| --- | --- |
| `npm run selfcheck` is broken | `package.json` points at `server/selfcheck.js`, which was never written. Either write it or drop the script. |
| No `README.md` | Commands, accounts and architecture notes live only in this file and `DESIGN.md`. |
| No version control | No `.git`. Run `git init` and commit before the next large change. |
| `legacy/` | The previous static landing page, kept for reference (`legacy/index.html`, `script.js`, `styles.css`). Delete when it stops being useful. |
| `landing-hero.png` at the hackathon root | A stray capture outside the project. |
| `.work/` at the hackathon root | ~16 MB of progress screenshots (`v3`…`v8`, `shoot_*`). Reference only; safe to clear. |
| Untracked `public/archive/` | Downloaded archival photographs with `assets/credits.json` recording provenance. Keep the credits with the images. |

---

## 10. Where the session's evidence lives

| Artefact | Path |
| --- | --- |
| This session, full transcript | `../pi-session-2026-10-18T10-22-12-060Z_01a14e88-8459-737a-a34e-7b7a575c7f41.html` |
| Design decisions, written pre-build | `equita/DESIGN.md` |
| Screenshots of built screens | `equita/.shots/`, `../.work/` |
| Layout report for `/today` | `equita/.shots/report.json` |
| Browser console logs | `../.playwright-mcp/console-*.log` |
| Reference the user supplied | `../User provided context/The AI workspace that works for you_ _ Notion.html` |

---

*Handoff written at the end of the session, from the repository as it stands — not from memory.*