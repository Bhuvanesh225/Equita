# 01 — Architecture

## Shape

```
browser (React 19 + Vite 8, TS, Tailwind v4)
  │  /                    marketing page — reads GET /api/public/story
  │  /login /signup /join auth screens
  │  /today, /projects, /classrooms, /insights, …  the app (behind one guard)
  │
  ├─ fetch  →  /api/**   proxied to the API
  └─ SSE    →  /events   proxied, one stream per signed-in person
                          │
                          ▼
                    Express 5 (node:sqlite)
                      server/index.js        app, mount table, static build
                      server/api.js          shared helpers: parse, access, shapers
                      server/auth.js         sessions, cookies, capability checks
                      server/db.js           node:sqlite + tx() + insert/update
                      server/events.js       record(): activity + notify + publish
                      server/bus.js          in-process SSE subscription registry
                      server/routes/*.js     HTTP surface
                      server/engines/*.js    the intelligence layer (2,652 lines)
                      server/data/*.js       the skill catalogue and the brief templates
                      data/equita.db         SQLite, WAL, seeded on first boot
```

Everything runs in one Node process. `npm run dev` runs two: `node --watch
server/index.js` (API on `:8787`) and `vite` (`:5173`, proxying `/api` and `/events`).

**No native build step.** `node:sqlite` is used directly, so Node 22.5+ is the only
requirement. `DatabaseSync` is synchronous — that is why routes are written with plain
`all`/`get`/`run` calls and no `await`.

## The request lifecycle for a read

1. Cookie `equita_session` → `currentUser(req)` in `server/auth.js`.
2. `requireAuth` (mounted on every non-public router) rejects with `401`.
3. The route builds identifiers, then asks an **engine** for the content:
   `loadProject(id)` → `computeEquity(ctx)` → shapers (`shapeTask`, `shapeActivity`, …).
4. The shape goes out. `GET /api/projects/:id` is deliberately **one call returning
   everything the workspace renders**, so a page has a single definition of truth and the
   live channel only needs to refetch that one URL.

## The request lifecycle for a write

1. Parse and validate the body with `zod` (`parse(Schema, req.body)` in `server/api.js`).
   A failure becomes `400 {error}` written for a person.
2. Authorise: `access()` (`server/routes/projects.js`) or `classroomAccess()`
   (`server/routes/school.js`) return `{row, memberRole, teaching, owner}`.
3. Mutate inside `tx(() => { … })` when more than one row is involved.
4. Call `record({verb, subject, projectId, actorId, meta, notify})` from `server/events.js`.
   That single call writes the `activity` row, creates any `notifications`, and publishes
   an event on `bus.js` to everyone in `projectAudience` / `classroomAudience`.
5. Respond with the shaped resource.

**Step 4 is why the whole app is live.** If you add a write path and skip `record`, the
screen will not update for anybody else — that is a bug, not an optimisation.

## Auth and capability

- Sessions are rows in `sessions`, keyed by a random id in an HttpOnly cookie.
  `createSession` / `destroySession` / `setSessionCookie` live in `server/auth.js`.
- `canTeach(userId, classroomId)` is the teacher capability; `memberships(userId)` lists a
  person's classes with their role in each.
- `POST /api/auth/demo {email}` signs in any `*@equita.demo` account with no password. It
  refuses any other domain. It exists because the only convincing thing about this product
  is what it says about a populated group.
- Access rules that matter:
  - a project is visible to its members, its owner, and the teacher of its class;
  - a student may only open **their own** student record (`403` otherwise);
  - only the lead or a teacher may plan, auto-assign or rebalance;
  - the `code` on a classroom is the join code; `POST /api/classrooms/join` is idempotent.

## The intelligence layer (`server/engines/`)

Do not re-derive these. Read the top-of-file comment before using one — each states what it
does and, more usefully, what it refuses to do.

| Engine | Lines | Exports | What it is for |
| --- | --- | --- | --- |
| `equity.js` | 566 | `memberLedgers`, `computeEquity`, `suggestRebalance`, `equityHistory`, `recordSnapshot`, `requiredSkillDemand`, `remainingWeeks`, `elapsedFraction` | the fairness score and everything behind it |
| `allocator.js` | 298 | `rankCandidates`, `autoAssign`, `bestFor` | who a task should go to, with a reason and a warning list |
| `nudges.js` | 335 | `projectNudges`, `personalNudges`, `classroomNudges`, `summarise`, `unreadNotifications` | the sentences that tell a person what needs doing |
| `copilot.js` | 324 | `ask`, `starterQuestions`, `pickProject` | question → answer built from real facts and links |
| `classroom.js` | 310 | `classroomOverview`, `studentRecord`, `classProjects`, `classStudents`, `classTrend` | the teacher's view of a class |
| `grouping.js` | 281 | `formGroups`, `suggestRoles`, `classGaps` | forming balanced groups from a roster |
| `context.js` | 229 | `loadProject`, `loadRoster`, `mergeConfig`, `normaliseRequired`, `DEFAULT_CONFIG`, `DEFAULT_CLASSROOM_POLICY` | hydration + config merging |
| `planner.js` | 177 | `planProject`, `planSummary` | brief → task list, from `server/data/templates.js` (not a model) |
| `skills.js` | 150 | `fitSkills`, `describeFit`, `growthOpportunity`, `teamSkillProfile`, `singlePointsOfFailure` | skill matching and the "who would grow" signal |
| `profiles.js` | 92 | `clusterStrength`, `topSkills`, `growthEdges`, `rosterCoverage`, `TRANSFER` | a person's profile reduced to clusters |

### The equity engine's five parts

`parts` is `{balance, delivery, spread, engagement, readiness}`, each 0–100, combined with
`weights` (project config; a classroom policy can move them). Labels used in the UI:
**Balance · Delivery · Spread · Engagement · Readiness**. `Meter` in `ui.tsx` picks its tone
automatically by value; do not pass a tone.

Two deliberate decisions, quoted from the engine and worth repeating because they show up in
the UI:

> 1. Equity is judged on *delivered* work, not on promises. Both numbers are reported,
>    because the gap between them is the single most useful signal a group has.
> 2. Nothing is a category. Every member gets a position on a continuous scale and a number
>    in hours.

So when you render a member, show **credited** against **even**, and **committed** as a
second number — never only one of them.

### Config

`config = mergeConfig(defaults, project.config, classroomPolicy?)`, with three groups:
`weights` (equity parts), `allocator` (skill/headroom/equity/deadline/continuity/growth) and
`policy` (`autoAssign`, `allowStretch`, `enforceCapacity`, `requireReview`, `shareGapFlag`,
`freeRiderShare`, `silenceDays`). A teacher's classroom defaults are more protective than a
self-organised group's (see `server/seed-stories.js`). Screens that show numbers should be
able to say which policy produced them.

## Database (`server/schema.sql`, 17 tables)

| Table | Holds |
| --- | --- |
| `users` | person: name, email, password hash, role, headline, school, hue, capacity, status |
| `sessions` | one row per signed-in browser |
| `skills` | the catalogue (35 skills in 8 clusters, `server/data/skills.js`) |
| `user_skills` | level 1–5 and appetite 1–5 per person, with `source` (self/peer/…) |
| `classrooms` | name, join `code`, subject, term, `owner_id`, `policy` (JSON) |
| `enrollments` | who is in a class, and as what |
| `projects` | name, `brief`, `mode` (standalone/class), `classroom_id`, `owner_id`, `status`, `due_at`, `config` (JSON) |
| `project_members` | membership + role (`lead`/`member`) |
| `tasks` | title, detail, `phase`, `status`, `assignee_id`, `effort` (hours), `priority`, `due_at`, `required_skills` (JSON), `depends_on`, `needs_review`, `position`, timestamps |
| `assignments` | every allocation decision: `kind` (auto/manual/…), `status`, `score`, `breakdown`, `rationale` |
| `contributions` | **the ledger.** Every hour: `kind`, `effort`, `note`. This is what equity is computed from |
| `comments` | task messages with `mentions` |
| `activity` | the project's memory: `verb`, a written `subject`, `meta`, actor |
| `notifications` | per-person bell entries with a `link` and `read_at` |
| `checkins` | one per person per project per week: `mood`, `note`, `blockers` |
| `reviews` | peer reviews: `reliability`, `quality`, `teamwork`, `note` (go to the teacher) |
| `equity_snapshots` | weekly frozen position, so the trend line exists without anyone recording it |

`contributions` deserves emphasis: **closing a task writes an hours row with a real number,
and it is never inferred later and never accepted from the client.** Every equity figure is
built from that table.

## Live channel (`server/bus.js` + `server/events.js`)

- One SSE stream per person at `GET /events`, filtered by `{userId, classroomIds}`.
- `record()` publishes `{type, at, …meta}`; the client increments a version and every
  `useApi` with `live: true` refetches after a 180 ms coalescing delay.
- The client rebuilds the stream on error (2.5 s retry) and on window focus, because an
  `EventSource` can sit dead after a server restart.
- **The trade is deliberate:** refetch the whole resource rather than apply a diff in the
  browser. Applying diffs is where live boards start disagreeing with the server.

## Client architecture

| Path | Role |
| --- | --- |
| `src/main.tsx` | mount |
| `src/App.tsx` | providers, `createBrowserRouter`, lazy routes, the one auth guard, the two overlays |
| `src/lib/api.ts` | `api`/`get`/`post`/`patch`/`put`/`del`/`qs`, `ApiError` |
| `src/lib/live.tsx` | `LiveProvider` (SSE), `useApi`, `useAction`, `useToast` |
| `src/lib/session.tsx` | `useSession` — the signed-in person, their skills, classes, counts |
| `src/lib/types.ts` | every server shape (724 lines) |
| `src/lib/format.ts` | every number, date and tone helper |
| `src/components/ui.tsx` | primitives incl. `LoadBar`, `ShareBar`, `Panel`, `Stat` |
| `src/components/blocks.tsx` | composed blocks incl. `PageHead`, `Nudges`, `useTaskMoves` |
| `src/components/charts.tsx` | hand-drawn SVG charts |
| `src/components/overlays.tsx` | `Dialog`, `Drawer`, `Menu`, `Confirm` |
| `src/components/icons.tsx` | hand-drawn icons (no icon dependency; `lucide-react` is installed and unused) |
| `src/shell/AppShell.tsx` | the rail, topbar, mobile nav, scheme switch, `UiProvider` |
| `src/shell/CommandPalette.tsx`, `src/shell/Copilot.tsx` | the two overlays |
| `src/styles/theme.css` | tokens + Tailwind `@theme` bridge |
| `src/styles/app.css`, `surfaces.css` | the furniture |
| `src/styles/landing.css`, `auth.css` | scoped to `/` and the auth screens |

Two dead dependencies worth knowing about: `lucide-react` (icons are hand-drawn in
`icons.tsx`) and `date-fns` (dates are handled in `format.ts`). `@dnd-kit/*` **is** used, by
`src/routes/project/Board.tsx` and intended for the group builder.

## Where the marketing page gets its numbers

`GET /api/public/story` runs the same engines against the seed and returns the figures the
landing page prints. Nothing on the landing page is written by hand — that is the house rule
about proof, enforced in code. `src/routes/landing/story.ts` is the client-side reader of
that payload.