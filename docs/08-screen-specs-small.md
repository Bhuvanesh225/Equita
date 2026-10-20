# 08 — Screen Specs (the Four Small Screens, and the Missing Routes)

The small screens are small because their surface is small, not because they matter less: `/people/:id` and `/notifications` are where engine-written prose actually reaches a person.

---

## P2 · `/people` and `/people/:personId` — `People`

**Purpose.** Find a person and see what they are good at, from anywhere in the product. `/people` is the search; `/people/:personId` is the record.

**Why This Is Also a Bug Fix.** `GET /api/insights/search` returns person results with `href: "/people/:id"`, and two built screens already link to `/people/:personId` (`src/routes/project/Equity.tsx:93`, `src/routes/ProjectWorkspace.tsx:307`). **No such route exists**, so every one of those links currently lands on `NotFound`. Registering it is P0-2 in `TODO.md`; do it before or with this screen.

**Data.**
- `GET /api/insights/search?q=` (min 2 chars) → `{results: SearchResult[]}`; filter to `kind: "person"` for this screen but keep the others as a "did you mean" group.
- `GET /api/insights/people/:id` → `{person: {id,name,headline,hue,capacity,school}, top, clusters, sharedProjects, isTeammate}`. Note `school` is only present when you share one, and `sharedProjects` is empty unless you are teammates — **which is itself the interesting fact to render**: *"You are not on a project with Diego, so you can see their strengths but not their hours."*

**Layout.**
- `/people`: `PageHead title="People"`, a search `Field` bound to `?q=` in the URL (debounce ~200 ms, and keep the query in the URL so the result is shareable). Results as `PersonRow` with `note={headline}` and the cluster chips of `top`. When `q` is empty: an `EmptyState` that explains the search searches projects, tasks, people and classes — or list the people you actually share work with, which is the useful default. Derive them from `GET /api/projects` + `workspace.members` only if you must; a plain empty state is honest and cheaper.
- `/people/:personId`: the record, either as a full page or a `Drawer` over the list — the full page is preferred because existing code links to it as a destination. Content: `PageHead` (name, `headline`, `capacity h a week`, `school` when shared), `clusters` as `Meter`s, `top` as `Tag`s, `sharedProjects` as rows linking to the workspace, and a closing sentence built from `isTeammate` explaining what is and is not visible. No hours, no fairness score — the endpoint does not return them, and inventing a number here would break the house rule.

**States.** `q` shorter than 2 → no request (the endpoint returns `[]`); show the default state, not an error. A person id that does not resolve → `EmptyState` with a link back to `/people`.

**Acceptance.**
- [ ] `/people/:personId` is registered in `src/App.tsx` and every existing link to it resolves (check `/projects/:id?tab=equity` and `/projects/:id?tab=people`).
- [ ] Typing in the search does not refetch the world: one request per settled query.
- [ ] `403`/missing person handled.
- [ ] `inspect` clean at 1440 and 390.

---

## P2 · `/profile` — `Profile` (labelled "Your strengths" in the rail)

**Purpose.** Fill in the two things the allocator is fed by: what you are good at, and how many hours a week you have. This screen is the reason the product works at all — a project with no skills has an allocator with nothing to match on.

**Data.** `GET /api/auth/me` (the session already holds `skills`, `clusters`, `top`), `GET /api/skills` (the catalogue: 35 skills in 8 clusters with `prompt` text), and the session's own `saveProfile` / `saveSkills` methods. **Use `useSession()`** — do not call `PATCH /api/auth/me` or `PUT /api/auth/me/skills` directly, or the shell's copy goes stale.

**Layout.**
- `PageHead title="Your strengths"`, `sub` = what this buys: *"The allocator matches work to these. Nobody sees a level you did not set yourself."*
- `Panel` "What you can do": reuse **`SkillPicker`** from `src/routes/project/TaskForm.tsx` (already exported, cluster-grouped chips with a search field) as the selection, then a table of the selected skills with a 1–5 level and a 1–5 appetite control each. If the picker's shape resists two numbers per skill, write a sibling component in `src/routes/profile/` rather than bending it — but do not write a second *catalogue* fetch.
- `Panel` "How much time you have": a `range` input for `capacity` (0.5–60, step 0.5) with a live `hours(capacity)` readout, and a hint that the allocator compares committed work against it and calls anyone over it overloaded.
- `Panel` "You": `name`, `headline`, `school` fields; the `hue` as a row of swatches (the eight member hues already used in the palette) rather than a number input.
- `Panel` "Where you are strong" (read-only): `clusters` as `Meter`s and `top` as `Tag`s — the computed view of what you just entered, so the effect of an edit is visible.
- One sticky `Save` (primary) in `PageHead actions`, disabled when nothing changed, with per-field validation. Mark `busy` while saving.

**States.** A person with no skills set: an `EmptyState` inside the picker panel with the catalogue already open, and a sentence that starting with three is fine. A paused account (`status: "paused"`) shows a `callout--over` explaining that a teacher paused it.

**Acceptance.**
- [ ] `saveSkills` round-trips: set a level, save, reload, still there (verify against `GET /api/auth/me`).
- [ ] `saveProfile` updates the rail's name/capacity without a reload (proves the session refresh path).
- [ ] The skill list is the catalogue from the server, not a hard-coded array.
- [ ] `inspect` clean at 1440 and 390; the level/appetite controls are ≥ 24px hit targets.
- [ ] Both schemes.

---

## P2 · `/notifications` — `Notifications`

**Purpose.** The bell, with a memory. Every notification carries a `link` the engines wrote.

**Data.** `GET /api/insights/notifications` → `{notifications: [{id, kind, title, body, link, meta, readAt, createdAt}], unread}`. `POST /api/insights/notifications/read` (`{ids: [...]}` or `{all: true}`).

**Blocked on P0-2.** The stored `link` values are the broken ones (`/projects/:id/board?task=…`, `/classrooms/:id/groups/:projectId`, `/people/:id`). Until the router has those aliases, clicking a notification lands on `NotFound`. Fix the routes first; `Nudges` has the same problem and is used on `/today`.

**Layout.**
- `PageHead title="Notifications"`, `sub` = `${unread} unread`, `actions` = `Mark all read` (disabled at 0).
- Two groups: **New** (`readAt === null`) and **Earlier**. Each row: a tone dot from `kind` (`urgent` → risk, `warn` → over, else quiet), `title` at 600 weight, `body` in ink-2, `relativeTime(createdAt)`. The whole row is a `Link` to `link` **and** marks itself read (`POST …/read {ids:[id]}`) on activation — fire the write, do not block the navigation on it.
- A `Menu` per row is unnecessary; a single `Mark as read` on unread rows only is enough if the row-as-link pattern proves awkward with nested controls. Do not nest a `<button>` inside an `<a>` — that is an accessibility failure `inspect.mjs` will not catch but a person will.
- Empty: `EmptyState` — *"Nothing yet. Notifications arrive when somebody moves your work, mentions you, or a deadline slips."*

**Acceptance.**
- [ ] Clicking a notification marks it read and navigates somewhere real (after P0-2).
- [ ] `Mark all read` round-trips; the rail badge drops to 0 **without a reload** (this is the cheapest end-to-end proof of the live channel — do it).
- [ ] `Read` state is visually distinct without relying on colour alone.
- [ ] `inspect` clean at 1440 and 390.

---

## P2 · `/settings` — `Settings`

**Purpose.** Account and appearance. The landing point for everything that is not about work.

**Data.** `GET /api/auth/me`, `PATCH /api/auth/me` (via session `saveProfile`), `POST /api/auth/logout` (via session `signOut`). Appearance is the fixed light paper palette.

**Layout.** Four `Panel`s:
- **You** — name, headline, school, capacity (same fields as `/profile`, but here they are formal; keep the wording shorter and link to `/profile` for the skill profile).
- **Appearance** — a short explanation of the fixed paper palette. Do not add a scheme switch; the light mode is part of Equita's printed-brief metaphor.
- **Your classes** — one row per `memberships[]`: name, `role`, and the join `code` with a copy action. (Leaving a class has no endpoint today: `DELETE /api/classrooms/:id/students/:userId` requires teaching rights. Either leave the row read-only with an honest sentence, or add a self-leave branch server-side — see `docs/10-decisions.md`.)
- **Account** — the email (read-only), and **Sign out** (danger, behind a `Confirm`), then `navigate("/login")`.

**Known Gap to Close Here.** `POST /api/classrooms` refuses non-teachers with *"Switch your role in settings if you teach"*, but `PATCH /api/auth/me` does **not** accept `role`. Either add `role` to that schema (with a guard: only between `student` and `teacher`, and never while owning a class) or change that server message. Do not ship a settings screen that promises a switch it does not have.

**Acceptance.**
- [ ] The paper palette applies **before first paint**.
- [ ] Sign out clears the session and lands on `/login` with the guard not bouncing back.
- [ ] No field can be saved empty; `Field error` shows the server's sentence.
- [ ] `inspect` clean at 1440 and 390 in light mode.

---

## P0 · The Three Missing Routes (Fix Before the Screens That Need Them)

These are not screens; they are the wiring that makes already-written links work. Register all three in `src/App.tsx` inside the `<Guarded />` children, and record the choice in `docs/10-decisions.md`.

| Route | Behaviour | Why |
| --- | --- | --- |
| `/people/:personId` | `People` in detail mode (a full page; see the spec above) | emitted by `GET /api/insights/search`; already linked from `Equity.tsx` and `ProjectWorkspace.tsx` |
| `/projects/:projectId/board` | the same element as `/projects/:projectId` | emitted by `nudges.js`, `tasks.js`, `planning.js`, `insights.js` and `copilot.js`, always with `?task=…` |
| `/classrooms/:classroomId/groups/:projectId` | `<Navigate to={\`/projects/${projectId}\`} replace />` | emitted by `nudges.js` ("Open the group") — a class group *is* a project in this data model |

Then make the query-parameter vocabulary forgiving, because the emitters use two:

```ts
// ProjectWorkspace.tsx — accept the engine's `panel` as an alias for the app's `tab`
const tab = (params.get("tab") ?? params.get("panel") ?? "board") as Tab;
// and map the engine's names onto the app's tabs
//   panel=equity → tab=equity · panel=plan → tab=board · panel=team → tab=people
```

Also accept `/classrooms/:classroomId?panel=attention` on the console (map it to the Attention tab) — the copilot emits it.

**Alternative (choose one, not both).** Change the emitters in `server/engines/nudges.js`, `server/engines/copilot.js` and `server/routes/{tasks,planning,insights}.js` to the app's convention, and write a small mapper for notification rows **already stored** in the database with the old `link`. Aliasing in the router is fewer files and keeps old rows working, which is why it is recommended.

**Acceptance.**
- [ ] `node scripts/smoke.mjs` still passes, and a new check follows one engine-generated `href` per family (`nudges`, notifications, search, copilot) and asserts `200` on the rendered route — add it as a Playwright navigation in `scripts/shoot.mjs` routes list or as a route-table assertion in `scripts/smoke.mjs`.
- [ ] Clicking the first nudge on `/today` lands on the project board with that task's sheet open.
- [ ] Clicking a notification lands somewhere real.
- [ ] Clicking a person's name in `/projects/:id?tab=people` opens their record.