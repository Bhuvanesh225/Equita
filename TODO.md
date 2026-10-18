# TODO — the live tracker

**This file is the task list. Tick items as you finish them; add items as you find them.**
A state file that is wrong is worse than no state file, so when something here stops being
true, fix it in the same change.

Status legend: `[ ]` open · `[x]` done · `[~]` partial (the note says what is left) ·
`[!]` blocked (the note says on what).

Every task names the files it touches, the endpoints it needs, and an acceptance test.
The phase order and its reasoning live in `ROADMAP.md`; the finish line is in `AGENTS.md`.

---

## P0 — Make the repository safe to work in, and make the built app actually work

### P0-1 · Version control
- [ ] `git init`, add a `.gitignore` (`node_modules/`, `dist/`, `data/`, `.shots/`, `.tmp/`,
      `*.log`, `.work*`), and commit the current state as the first commit.
      **No `.git` exists. Do this before any large refactor** — there is currently no way to
      undo a bad write.
      *Acceptance:* `git status` is clean; `data/` and `dist/` are untracked.

### P0-2 · Fix the six broken link families
Every one of these is a live 404 today. Best-effort fix is aliasing in the router (see
`docs/10-decisions.md` O-01 and `docs/08-screen-specs-small.md`).
- [ ] Register `/people/:personId` → `People` in detail mode (`src/App.tsx`). Already linked
      from `src/routes/project/Equity.tsx:93` and `src/routes/ProjectWorkspace.tsx:307`, and
      emitted by `GET /api/insights/search`.
- [ ] Register `/projects/:projectId/board` → the workspace element (emitted by `nudges.js`,
      `tasks.js`, `planning.js`, `insights.js`, `copilot.js`, always with `?task=`).
- [ ] Register `/classrooms/:classroomId/groups/:projectId` → `<Navigate to={`/projects/${projectId}`} replace />`.
- [ ] Accept `panel` as an alias for `tab` in `ProjectWorkspace`, mapping
      `equity→equity`, `plan→board`, `team→people`.
- [ ] Accept `?panel=attention` on the console (copilot emits it).
- [ ] Follow one engine-generated `href` per family in a test (add to `scripts/smoke.mjs` or
      as routes in a `shoot.mjs` run).
      *Acceptance:* clicking the first nudge on `/today` opens the project board with that
      task's sheet open; clicking a notification lands somewhere real; clicking a name in
      `?tab=people` opens a record.

### P0-3 · The workspace's write path, end to end
- [x] `planningRouter` mount fixed (`server/index.js`); `plan`, `plan/apply`, `assign/auto`,
      `assign/:taskId`, `rebalance/apply`, `nudges` now resolve. Verified with `curl` and
      `scripts/smoke.mjs`.
- [ ] **Click every control in the workspace** with the browser: `Plan from the brief` (both
      steps), `Place the unclaimed work` (preview then apply), `Add a task`, drag a card
      between lanes, `Give it to…`, log hours, comment, move a task to review and close it
      (confirm the `409 needs-review` path), delete a task, write a review, `Apply` a
      rebalance suggestion, change project status through the menu, copy the link.
      *Acceptance:* every one ends in a success toast and a changed board; no 4xx in the
      browser console. Note any that do not in this file.

### P0-4 · Health and hygiene
- [ ] `npm run build` must pass and be run before every delivery (it passes now: last run
      clean, largest chunk `react` 301 kB / 95 kB gzip).
- [ ] `README.md` — write it (see the final task in P4; a minimal accurate one is enough now).
- [x] `npm run selfcheck` fixed — it now points at `scripts/smoke.mjs`; `npm run smoke` added.
- [ ] Delete `legacy/` once you are sure nothing references it (`legacy/index.html`,
      `script.js`, `styles.css` — the previous static landing page).
- [ ] Decide on the hackathon-root junk (`../.work/` ~16 MB of screenshots,
      `../landing-hero.png`). Safe to clear; not part of the repo.

### P0-5 · Verification tooling
- [x] `scripts/smoke.mjs` written: 28 endpoints, non-mutating, passes for `teacher` and
      `student` (403s accepted where a role denial is correct).
- [x] `EQUITA_WIDTH` / `EQUITA_HEIGHT` / `EQUITA_SCHEME` added to `scripts/shoot.mjs` and
      `scripts/inspect.mjs`, with `viewport`/`scheme` in the inspector's output.
- [ ] Add a `--follow-links` mode (or a small addition to `scripts/smoke.mjs`) that reads the
      `href`s out of a payload and asserts the corresponding client route exists. This is the
      permanent guard against P0-2 regressing.
- [ ] Add the first `/projects/new` and `/classrooms` routes to a `shoot.mjs` invocation in a
      documented "full sweep" command (a one-liner in `docs/05-verification.md`).

---

## P1 — The core surfaces a teacher or student would actually use

### P1-1 · `/projects/new` — `NewProject` *(spec: `docs/07-screen-specs.md`)*
- [ ] Build the brief-style form: name, brief, mode (standalone/class), class picker, hand-in
      date, members by email.
- [ ] Wire to `POST /api/projects`; on success toast + navigate to the workspace.
- [ ] Gate `mode=class` on `canTeach`; students get standalone only, with an honest hint.
- [ ] Field-level errors from `ApiError.isInput`; `busy` state.
      *Acceptance:* `tsc` + `shoot` + `inspect` (1440, 390, both schemes) clean; a created
      project appears in `/projects` with the brief intact and exactly one member.

### P1-2 · `/classrooms` — `Classrooms` *(spec)*
- [ ] List from `GET /api/classrooms`; teacher cards with `students`, `projects`, `meanScore`;
      student view without teacher-only controls.
- [ ] `Start a class` dialog → `POST /api/classrooms`.
- [ ] `Join with a code` dialog → `POST /api/classrooms/join` (and keep `/join` working).
- [ ] Join code shown + copyable; `comparisonBars` across classes when there is more than one.
- [ ] Handle `meanScore: null` as "no groups yet".
      *Acceptance:* create a class as `teacher`; join it with `free`; verify enrolment through
      `/api/auth/me`; `inspect` clean at both widths.

### P1-3 · `/classrooms/:classroomId` — `ClassroomConsole` *(spec; the largest remaining screen)*
- [ ] Shell: one `useApi("/api/classrooms/:id")`, `PageHead` (subject · term, name, counts,
      join code, `Add students`, `Build the groups`, `Set an assignment`, class menu).
- [ ] Tab **Overview**: `analytics` stats, `trend` `LineChart`, `ClassProject` panels with
      `modest` score/progress, per-member `LoadBar`, `attention`.
- [ ] Tab **Roster**: `ClassStudent` rows (`StateChip`, share, `owed`, `acrossGroups`,
      `FlagList` limit 2) linking to the record; `Add students` dialog; `Remove` behind a
      `Confirm` with the honest consequence described (their work stays, tasks are released).
- [ ] Tab **Coverage**: `coverage` rows (`holders`, `strong`, `meanLevel` `Meter`,
      `topHolders`), `gaps` as a `callout--over`, roster-size stats.
- [ ] Tab **Attention**: `attention` grouped by severity, class `nudges` via `Nudges compact`.
- [ ] Class menu: `Edit the class` and `Change the fairness policy` → `PATCH /api/classrooms/:id`.
- [ ] `Set an assignment` dialog → `POST /api/classrooms/:id/projects`.
      *Acceptance:* all four tabs render from **one** request; add/remove/policy/assignment all
      verified live; `inspect` clean at 1440 and 390 on every tab and both schemes; the roster
      scrolls in `.scroll-x` on mobile with `hOverflow: 0`.

### P1-4 · `/classrooms/:classroomId/students/:studentId` — `StudentRecord` *(spec)*
- [ ] Build from `GET /api/classrooms/:id/students/:userId`: `reading` sentence, `totals`
      stats, `clusters` meters, `top` and `growth`, per-project blocks with `LoadBar`,
      tasks (`late` flag), contributions (the ledger), check-ins, `history` sparkline.
- [ ] Handle `403` as a clean refusal (`EmptyState`), not a blank page.
- [ ] Verified as teacher, as the person themselves, and as a classmate (403).
      *Acceptance:* `inspect` clean at both widths, both schemes; no arithmetic in JSX.

---

## P2 — Reach and fairness

### P2-1 · `/insights` — `Insights` *(spec)*
- [ ] Build from `GET /api/insights/dashboard` + per-class `GET /api/classrooms/:id/analytics`.
- [ ] The score explained: `ScoreDial` + the five weighted parts as `Meter`s with their weights.
- [ ] Your projects compared (`ComparisonBars` on `equity.score`) and unassigned hours surfaced.
- [ ] Trend `LineChart` with an even-share rule line.
- [ ] Teacher-only class comparison; hidden entirely for a student with no classes.
- [ ] Cap at six sections (see O-07 in `docs/10-decisions.md`).
      *Acceptance:* verified as teacher and student (their payloads differ); `inspect` clean;
      every figure traceable to a payload field.

### P2-2 · `/people` + `/people/:personId` — `People` *(spec; depends on P0-2)*
- [ ] Search bound to `?q=` with a debounce; results as `PersonRow`.
- [ ] `PersonRow` → the person's record page from `GET /api/insights/people/:id`
      (`top`, `clusters`, `sharedProjects`, `isTeammate`, `school` when shared).
- [ ] Explain what is *not* visible when `isTeammate` is false — never invent hours.
      *Acceptance:* `/people/:personId` registered and every existing link to it resolves;
      one request per settled query.

### P2-3 · `/profile` — `Profile` (rail label "Your strengths") *(spec)*
- [ ] Skill selection (reuse `SkillPicker` from `src/routes/project/TaskForm.tsx`) with level
      1–5 and appetite 1–5 per skill, grouped by cluster, from `GET /api/skills`.
- [ ] `capacity` as a range with a live `hours()` readout.
- [ ] `name`, `headline`, `school`, `hue` (as swatches, not a number input).
- [ ] Save through `useSession().saveSkills` / `saveProfile` — **not** direct API calls.
- [ ] A read-only "where you are strong" panel computed from `clusters`/`top`.
      *Acceptance:* skills round-trip through a reload; profile edits update the rail without a
      reload; `inspect` clean at both widths, both schemes.

### P2-4 · `/notifications` — `Notifications` *(spec; depends on P0-2)*
- [ ] List from `GET /api/insights/notifications`; New vs Earlier; tone dot by `kind`.
- [ ] Row activation marks read (`POST …/read {ids}`) then navigates to the real route.
- [ ] `Mark all read` → `{all: true}`.
      *Acceptance:* the rail badge drops to 0 without a reload (this is the cheapest
      end-to-end proof of the live channel — do it deliberately).

### P2-5 · `/settings` — `Settings` *(spec)*
- [ ] You / Appearance (scheme via `useScheme`) / Your classes (with join codes) / Account
      (sign out behind a `Confirm`).
- [ ] Close out O-03 (student leaving a class) and O-04 (`role` on `PATCH /me`) or change the
      server sentence that promises the role switch.
      *Acceptance:* the scheme persists across a reload and applies before first paint; sign-out
      clears the session without the guard bouncing; `inspect` clean in both schemes.

---

## P3 — The group builder (the biggest single piece of new craft)

### P3-1 · `/classrooms/:classroomId/groups` — `GroupBuilder` *(spec)*
- [ ] Controls: group size `Segmented`, required clusters, `Try another arrangement`
      (`seed + 1`), objective `Stat` + four `parts` `Meter`s, `notes[]` as `Quiet`.
- [ ] Board: one `.lane` per team (the one deliberate exception to "lanes are people"),
      member cards with `@dnd-kit/core` (PointerSensor distance-6, as in
      `src/routes/project/Board.tsx`), per-team coverage bars, `weakestCluster` warning,
      `roles[]` rendered by `label`.
- [ ] Drag between lanes recomputes coverage client-side (the preview API has no pinning);
      say so in a `Quiet` line. Re-running the preview discards manual edits.
- [ ] **Non-drag path**: a `Menu` per member ("Move to Team 2") so the screen is fully usable
      by keyboard and without dragging. dnd is an enhancement.
- [ ] Commit dialog: assignment name, brief, hand-in date, `autoPlan` and `autoAssign` toggles
      → `POST /api/classrooms/:id/projects`; toast with the created count; navigate to console.
      *Acceptance:* preview verified with two seeds and two sizes; commit verified live (new
      projects appear in the console and in `/projects` with the right members); drag works with
      mouse and pointer; a keyboard-only user can complete every outcome; `inspect` clean at
      both widths, both schemes.

---

## P4 — Finish line

### P4-1 · Retire the stub layer
- [ ] No route renders `<Pending>`; delete `src/routes/_pending.tsx` (its own comment says it
      should be deleted when the last stub is gone).

### P4-2 · Mobile and scheme pass over **every** route
- [ ] `EQUITA_WIDTH=390 MSYS_NO_PATHCONV=1 node scripts/inspect.mjs <account> <all routes>` →
      `problems: []` everywhere.
- [ ] `EQUITA_SCHEME=ink MSYS_NO_PATHCONV=1 node scripts/inspect.mjs <account> <all routes>` →
      clean everywhere (run both together: `EQUITA_WIDTH=390 EQUITA_SCHEME=ink`).
- [ ] Re-run the sweep for both `teacher` and `student`.

### P4-3 · Liveness pass
- [ ] Two browsers, two accounts: act in one, the other updates with no reload, on **every**
      screen. Record any screen that does not and fix it (`useApi` defaults to `live: true`, so
      a miss means state was cached in `useState`).

### P4-4 · The definition of done (from `AGENTS.md`)
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` clean.
- [ ] `node scripts/smoke.mjs` passes for `teacher` and `student`.
- [ ] `node scripts/encscan.mjs` prints `clean`.
- [ ] No `<Pending>`; `_pending.tsx` deleted.
- [ ] `inspect.mjs` `problems: []` on every route at 1440 and 390, in both schemes.
- [ ] Every screen live-updates.
- [ ] No hard-coded figures in JSX (grep for digits inside JSX text nodes).
- [ ] `README.md` accurate.
- [ ] `TODO.md`, `docs/00-state.md` and `ROADMAP.md` all reflect the final state.

### P4-5 · `README.md`
- [ ] What Equita is, in two sentences, plus the screenshot (`../landing-hero.png` or a fresh
      `.shots/home.png`).
- [ ] How to run it (Node 22.5+, `npm install`, `npm run dev`, ports, the demo accounts).
- [ ] The architecture in ten lines (link `docs/01-architecture.md`).
- [ ] The design contract in five lines (link `DESIGN.md`, `docs/03-design-system.md`).
- [ ] How the data is seeded and what the six situations are (link `docs/09-demo-data.md`).
- [ ] The verification commands (link `docs/05-verification.md`).
- [ ] Do **not** duplicate `AGENTS.md`: `README.md` is for a person, `AGENTS.md` is for an
      agent.

---

## Backlog (real, not urgent — do not start these before P4)

- [ ] Server-side rate limiting / a session expiry sweep (`sessions` rows never expire).
- [ ] `PATCH /api/projects/:id/members/:userId` role changes are not surfaced in any UI.
- [ ] `POST /api/projects/:id/equity/snapshot` exists but no screen calls it (the board reloads
      snapshots automatically through other paths — confirm).
- [ ] `equity.suggestions` of kind `claim`/`share` (no `from` member) — verify `Equity.tsx`
      renders them as well as `move` suggestions do.
- [ ] The three seeded-but-unused skills clusters in `growthEdges`/`TRANSFER`.
- [ ] `lucide-react` and `date-fns` are unused dependencies; either use them or remove them
      from `package.json`.
- [ ] PWA: `public/manifest.webmanifest` exists; check the install experience on a phone.
- [ ] Print stylesheet for the brief (the direction says the page *is* the brief — a printed
      project brief would be very much on-thesis).