# 02 — API contract

Every screen in the remaining work renders data that already exists. This file is the
map from endpoint to screen, with the exact keys the server returns. Verify anything
you are unsure of with `node scripts/shapes.mjs teacher` (see `docs/05-verification.md`).

Base URL in dev: `http://127.0.0.1:8787`. The Vite dev server proxies `/api` and
`/events`, so the browser uses relative paths (`/api/...`).

## Conventions

- **Auth** is a session cookie (`equita_session`). `requireAuth` returns `401` for API
  routes with no session. `POST /api/auth/demo {email}` signs in any `*@equita.demo`
  account with no password — it exists for demos and for the test scripts.
- **Money/effort unit is hours.** Effort values are floats (e.g. `3.5`). Scores are
  0–100 floats, usually rounded to 1dp. Shares are 0–1.
- **Errors** are always `{ "error": "a sentence written for a person" }`, with status
  `400` (bad input), `401` (not signed in), `403` (denied), `404` (missing), `409`
  (a rule conflict, e.g. review required).
- **Timestamps** are ISO strings, always UTC.
- **Live channel.** `GET /events` is an SSE stream (one JSON object per `data:` line,
  heartbeats included). Any write on the server emits an event scoped to the people
  who can see it. The client's `useApi` (default `live: true`) refetches on any event,
  so **every screen updates itself with no extra work** — as long as it uses `useApi`.
- **The two-step rule.** `POST /plan` and `POST /assign/auto` return a *proposal*.
  Only the matching `/apply` call writes. Never merge them.
- **`*` mounts.** `tasksRouter` and `planningRouter` are mounted at `/api` and declare
  full paths (`/projects/:id/tasks`, `/projects/:id/plan`). `projectsRouter` is mounted
  at `/api/projects` and declares `/:id/…`. Do not "fix" a 404 by assuming the wrong
  prefix — check `server/index.js`.

## Endpoint index

### Identity

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `{email, password, name, role?, school?, joinCode?}` | `{user, joined}` |
| POST | `/api/auth/login` | `{email, password}` | `{user}` |
| POST | `/api/auth/demo` | `{email}` | `{user}` |
| POST | `/api/auth/logout` | — | `{ok}` |
| GET | `/api/auth/me` | — | `{user, skills, memberships, counts, clusters, top}` |
| PATCH | `/api/auth/me` | `{name?, headline?, school?, capacity?, hue?}` | `{user}` |
| PUT | `/api/auth/me/skills` | `{skills: [{slug, level 1-5, appetite 1-5}]}` | `{skills, count}` |
| GET | `/api/skills` | — | `{clusters, skills, mine}` |
| GET | `/api/skills/clusters` | — | `{clusters: [{id, name, blurb, skills}]}` |

`GET /api/auth/me` is the session payload the shell reads. Key sub-shapes:

```
user      { id, name, email, role: "student"|"teacher", headline, school, hue, capacity, status, createdAt, skillCount }
skills     [{ slug, level, appetite, source }]
memberships[{ id, name, code, subject, term, ownerId, role, createdAt }]
counts    { projects, unread, openTasks }        ← drives the rail badges
clusters  [{ cluster, name, level, skills: [{slug, level, appetite}] }]   (top 4)
top       [{ slug, name, cluster, level, appetite }]                     (top 6)
```

### Projects

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/projects` | `?status=` | `{projects: ProjectSummary[]}` |
| POST | `/api/projects` | `{name, brief, dueAt?, classroomId?, members?, config?}` | `{project, members}` |
| GET | `/api/projects/:id` | — | the whole workspace (below) |
| PATCH | `/api/projects/:id` | `{name?, brief?, status?, dueAt?, config?}` | `{project}` |
| POST | `/api/projects/:id/members` | `{members: [email \| {email,name}]}` | `{added}` |
| PATCH | `/api/projects/:id/members/:userId` | `{role}` | `{ok}` |
| DELETE | `/api/projects/:id/members/:userId` | — | `{ok}` |
| GET | `/api/projects/:id/equity` | — | `{equity, history}` |
| POST | `/api/projects/:id/equity/snapshot` | — | `{week, equity}` |
| GET | `/api/projects/:id/activity` | `?limit=60` | `{activity}` |
| POST | `/api/projects/:id/checkin` | `{mood: ahead\|steady\|behind\|stuck, note?, blockers?}` | `{ok, week, mood}` |
| GET | `/api/projects/:id/reviews` | — | `{reviews}` |
| POST | `/api/projects/:id/reviews` | `{subjectId, reliability, quality, teamwork (1-5), note?}` | `{review}` |
| GET | `/api/projects/:id/reviews/summary` | — | `{spread, members: [{id,name,reviews,reliability,quality,teamwork,notes}]}` (teacher) |
| GET | `/api/projects/:id/nudges` | — | `{nudges}` |

`GET /api/projects/:id` — **one call returns everything the workspace renders.** Top-level
keys, with what each is for:

| Key | For |
| --- | --- |
| `project` | name, `brief`, `mode` (`standalone`\|`class`), `classroom` (or null), `ownerId`, `status`, `dueAt`, `config` |
| `config` | merged `{weights, allocator, policy}` — what the engines actually used |
| `members` | `[{id, name, email, role: lead\|member, hue, headline, capacity, status, skills, topSkills, clusters}]` |
| `tasks` | `[{id, projectId, title, detail, phase, status, assigneeId, effort, priority, dueAt, required:[{slug,weight}], dependsOn, deliverable, needsReview, position, createdBy, createdAt, updatedAt, startedAt, completedAt, assigneeName, assigneeHue, blockedBy:[{id,title?}]}]` |
| `equity` | see "Engine output: equity" |
| `history` | `[{week:"2026-W41", takenAt, score, gini, members:[{id, credited, committed}]}]` |
| `activity` | `[{id, verb, subject, meta, actorName, actorId}]` |
| `comments` | `[{id, taskId, authorId, authorName, authorHue, body, mentions, createdAt}]` |
| `checkins` | `[{id, userId, week, mood, note, blockers, createdAt, name, hue}]` |
| `latestCheckin` | `{ [userId]: checkin }` |
| `reviews` | `{all: [], mine: [], awaiting: [{id, name, hue}]}` — `awaiting` is who *you* still owe a review |
| `nudges` | `[{id, kind, severity, title, body, action:{label, href}, memberId?, projectId?, projectName?}]` |
| `nudgeCounts` | `{total, critical, warn, info}` |
| `insights` | `{demand:[{slug,name,weight,hours,tasks}], suggestions:[…]}` |
| `viewer` | `{id, role: "teacher"\|"lead"\|"member", isLead, canTeach}` — gate every write on this |

`GET /api/projects` → `ProjectSummary`:

```
{ id, name, brief, mode, classroomId, ownerId, status, dueAt, config, createdAt, updatedAt,
  memberCount, taskCount, openCount, myOpen, myNextDue,
  equity: {score, gini, parts, headline},
  myShare: null            // teacher
         | {committed, credited, even, state}   // member
  unassigned }
```

### Planning and allocation (the intelligence layer)

All of these are mounted at `/api/projects/…` (fixed — see `docs/00-state.md` F1).

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/projects/:id/plan` | `{brief?, dueAt?, utilisation? (0.2–1, default .6), members?}` | `{plan: PlanProposal}` |
| POST | `/api/projects/:id/plan/apply` | `{tasks: [{title, detail, phase, effort, priority, dueAt, required, needsReview}], brief?, autoAssign?}` | `{created, taskIds, assigned}` |
| POST | `/api/projects/:id/assign/auto` | `{apply?: false, floor?, taskIds?, onlyUnassigned?: true}` | `{result: AutoAssignResult, applied, note}` |
| GET | `/api/projects/:id/assign/:taskId` | — | one task's candidate shortlist (shape below) |
| POST | `/api/projects/:id/rebalance/apply` | `{taskId, toId \| null, note?}` | `{task, equity, expectedImprovement}` |
| GET | `/api/projects/:id/nudges` | — | `{nudges}` |

`AutoAssignResult`:
```
{ assignments: [{taskId, taskTitle, userId, userName, score, parts, rationale, warnings}],
  unassigned:  [{taskId, taskTitle, effort, reason}],
  notes: [string],
  balance: {before, after} | null,
  load: [{userId, name, open, after, evenOpen}] }
```

### Tasks

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/projects/:id/tasks` | `{title, detail?, phase?, effort?, priority?, dueAt?, required?, needsReview?, deliverable?, assigneeId?, dependsOn?}` | `{task}` |
| GET | `/api/tasks/:id` | — | `{task, comments, contributions, requiredNames, blockedBy, candidates}` |
| PATCH | `/api/tasks/:id` | any subset of the create body | `{task}` |
| DELETE | `/api/tasks/:id` | — | `{ok}` |
| POST | `/api/tasks/:id/status` | `{status, note?, actualEffort?, deliverable?, verifiedBy?, force?}` | `{task, ledger?}` or `{task, unchanged}` or `409 needs-review` |
| POST | `/api/tasks/:id/assign` | `{userId \| null, force?}` | `{task, warning?}` |
| POST | `/api/tasks/:id/comments` | `{body}` | `{comment}` |
| POST | `/api/tasks/:id/log` | `{hours (0.25–40), note?}` | `{task, ledger?}` |

`GET /api/tasks/:id` → `candidates` is the allocator's ranked shortlist; **this is the
"who fits best" list and it is already computed server-side.** Each entry:

```
{ memberId, name, hue, role, capacity, state, score, parts: {skill, headroom, equity, deadline},
  rankedBy, fit: {score, matched, missing, notes}, growth: {score, offers, headline},
  warnings: [string], rationale, projection: {openAfter, evenOpen, headroomAfter, weeksNeeded},
  currentLoad: {open, committed, tasks} }
```

### Classrooms

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/classrooms` | — | `{classrooms: [{…, isTeacher, students, projects, meanScore}]}` |
| POST | `/api/classrooms` | `{name, subject?, term?, policy?}` | `{classroom}` (teacher only) |
| POST | `/api/classrooms/join` | `{code}` | `{classroom, already}` |
| GET | `/api/classrooms/:id` | — | the overview + `viewer` (below) |
| PATCH | `/api/classrooms/:id` | `{name?, subject?, term?, policy?}` | `{classroom}` |
| POST | `/api/classrooms/:id/students` | `{students: [email \| {email,name}]}` (1–60) | `{added}` |
| DELETE | `/api/classrooms/:id/students/:userId` | — | `{ok}` |
| GET | `/api/classrooms/:id/students/:userId` | — | `studentRecord` (below) |
| GET | `/api/classrooms/:id/coverage` | — | `{coverage, gaps, size}` |
| POST | `/api/classrooms/:id/groups/preview` | `{teams?, size (2–8, default 4), requiredClusters?, seed?}` | `GroupProposal` |
| POST | `/api/classrooms/:id/projects` | `{name, brief?, dueAt?, teams:[{name, memberIds}], autoPlan?, autoAssign?}` | `{created:[{id,name,members,planned,placed}]}` |
| GET | `/api/classrooms/:id/analytics` | — | `{analytics, trend, coverage, students, projects}` |

`GET /api/classrooms/:id` top-level keys:

| Key | For |
| --- | --- |
| `classroom` | `{id, name, code, subject, term, ownerId, policy, createdAt}` — `code` is the join code to display |
| `projects` | `ClassProject[]` — each with `equity`, `modest:{score,gini,daysLeft,progress,done,tasks,unassigned,open}`, `members[]`, `attention[]`, `weakest`, `strongest` |
| `students` | `ClassStudent[]` — `top`, `clusters`, `growth`, `projects[]` (per-project `{state,committed,credited,even,owed,flags}`), `totals`, `state`, `flags[]`, `owed`, `share`, `acrossGroups` |
| `nudges` | class-scoped nudges, with `subjectId`, `action.href` |
| `nudgeCounts` | `{total, critical, warn, info}` |
| `coverage` | `[{cluster, name, holders, strong, meanLevel, topHolders:[{id,name,level}]}]` |
| `analytics` | `{groups, students, meanScore, worstScore, bestScore, meanGini, meanProgress, behindCount, overloadedCount, unplaced, neverReviewed, spreadOfStates, projectsWithoutDeadline, totalOpenHours}` |
| `trend` | `[{week, takenAt, score, gini, projects}]` |
| `attention` | `[{kind, studentId, name, hue, detail, severity}]` |
| `viewer` | `{id, isTeacher, role}` |
| `gaps` | `[{cluster, name, strong, meanLevel, needed}]` |

`GET /api/classrooms/:id/analytics` is the same numbers minus the roster bodies, plus a
slim `students[]` and `projects[]` — use it for `/insights`, use `/:id` for the console.

`GET /api/classrooms/:id/students/:userId` → `studentRecord`:

```
{ student: {id, name, email, headline, hue, capacity, status},
  top, growth, clusters,
  totals: {credited, committed, even, done, late, open, owed},
  projects: [{ id, name, equityScore, member: EquityMember|null,
               contributions:[{id,kind,effort,note,createdAt,taskTitle}],
               checkins: Checkin[],
               tasks:[{id,title,status,effort,dueAt,completedAt,late}],
               history:[{week, credited, committed}] }],
  reading: "a written sentence about this student" }
```

### Insights, notifications, copilot

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/insights/dashboard` | — | everything `/today` renders (below) |
| GET | `/api/insights/nudges` | `?projectId=&classroomId=` | `{nudges, counts}` |
| GET | `/api/insights/notifications` | — | `{notifications, unread}` |
| POST | `/api/insights/notifications/read` | `{ids?: [id], all?: bool}` | `{ok, unread}` |
| POST | `/api/insights/copilot` | `{question, projectId?, classroomId?}` | `{intent, answer, facts:[{label,value}], actions:[{label,href}]}` |
| GET | `/api/insights/copilot/starters` | `?projectId=&classroomId=` | `{questions: [string]}` |
| GET | `/api/insights/search` | `?q=` (min 2 chars) | `{results: SearchResult[]}` |
| GET | `/api/insights/people/:id` | — | one person's record (for `/people/:id`) |

`SearchResult` = `{kind: "project"|"task"|"person"|"class", id, title, subtitle, href, hue?}`.
`href` values are the ones listed as broken in `docs/00-state.md` — **fix the router or
the emitter before you wire a screen to them.**

`GET /api/insights/dashboard` keys: `user`, `top`, `clusters`, `skillCount`, `cards`
(project cards with `mine` and `unclaimedForMe`), `agenda` (the viewer's open tasks with
`overdue` and `hoursUntilDue`), `week` (7 days of `hours`), `nudges`, `nudgeCounts`,
`notifications`, `unreadCount`, `classes` (teacher only: `{students, groups, meanScore,
worstScore, behind, overloaded, unplaced, urgent, attention[]}`), `activity`, `trend`,
`summary` (`{projects, openHours, evenHours, creditedHours, dueToday, overdue, classes}`).

### Public

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/public/story` | the numbers the landing page prints (no auth) |
| GET | `/api/health` | `{ok, tables, tableNames, at}` |

## Engine output: `equity`

The single most reused shape. Defined in `src/lib/types.ts` as `Equity`.

```
{ computedAt, measure: "credited",
  score: 0-100,
  parts:   { balance, delivery, spread, engagement, readiness },   // each 0-100
  weights: { balance, delivery, spread, engagement, readiness },   // sum to 1
  totals:  { committed, credited, served, open, blocked, unassigned, effort, tasks, done, overdue, members },
  distribution: { gini, giniCommitted, giniOpen, maxGap, evenShare },
  timeline: { elapsed, actualProgress, daysLeft, remainingWeeks, scheduleScore, punctuality },
  members: [{ id, name, hue, role, skills, served, open, blocked, committed, credited, helped,
              shares: {committed, credited}, even: {committed, credited},
              owedCommittedHours, owedCreditedHours, remainingCapacity, state, checkinCount,
              commentCount, reviewCount, daysSinceSignal, taskCount, doneCount, flags }],
  unassigned: [{ id, title, effort, dueAt }],
  flags:  [{ scope, memberId, memberName, kind, severity?, detail? }],
  suggestions: [{ kind, taskId, taskTitle, taskEffort, fromId, fromName, toId, toName, reason, improvement }],
  headline: "one sentence, written by the engine" }
```

**`headline` is prose written by the engine.** Print it; do not write your own summary
sentence next to it.

`EquityFlag.kind` values seen in the seed: `member-overloaded`, `member-behind`,
`member-quiet`, `share-gap`, `free-rider`, `work-unclaimed`, `project-overdue`,
`capacity-exceeded`, `never-reviewed`. `flagTitle(kind)` in `src/components/blocks.tsx`
maps them to human labels — use it.

`RebalanceSuggestion.kind`: `move` | `claim` | `share`. **`fromId` is `null` for work
nobody took on** — every reason string must handle that (it already does server-side).

## Group proposal (group builder)

`POST /api/classrooms/:id/groups/preview` → `GroupProposal`:

```
{ teams: [{ id, name, members: [{id, name, email, headline, hue, capacity, strength,
           dominant, topSkills:[{slug,level}]}],
           size, coverage: {cluster: number}, requiredCoverage, totalStrength,
           meanStrength, totalCapacity, weakestCluster,
           roles: [{role, label, memberId, name, strength}] }],
  objective: number,
  parts: { coverage, strengthBalance, capacityBalance, diversity },
  sizeRange: [min, max],
  notes: [string],
  gaps: [{cluster, name, strong, meanLevel, needed}],
  balanced: boolean,
  seed: number,
  rosterSize: number }
```

Role ids to render: `coordinator` ("Keeps it moving"), `builder` ("Makes the thing"), and
others the engine picks — always print `label`, never the raw `role`, unless the label is
absent.

## Screen → endpoint map for the unbuilt work

| Screen | Endpoints |
| --- | --- |
| `/projects/new` | `GET /api/skills`, `GET /api/classrooms` (for the class picker), `POST /api/projects`, then optional `POST /api/projects/:id/plan` |
| `/classrooms` | `GET /api/classrooms`, `POST /api/classrooms`, `POST /api/classrooms/join` |
| `/classrooms/:id` | `GET /api/classrooms/:id`, `PATCH /api/classrooms/:id`, `POST /students`, `DELETE /students/:userId`, `GET /coverage`, `POST /projects` |
| `/classrooms/:id/groups` | `POST /groups/preview`, `POST /projects` (to commit the teams), `GET /coverage` |
| `/classrooms/:id/students/:uid` | `GET /api/classrooms/:id/students/:userId` |
| `/insights` | `GET /api/insights/dashboard`, `GET /api/classrooms` (+`/:id/analytics` per class), `GET /api/projects` |
| `/people` (+`/people/:id`) | `GET /api/insights/search?q=`, `GET /api/insights/people/:id` |
| `/profile` | `GET /api/auth/me`, `PATCH /api/auth/me`, `PUT /api/auth/me/skills`, `GET /api/skills` |
| `/notifications` | `GET /api/insights/notifications`, `POST /api/insights/notifications/read` |
| `/settings` | `GET /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/logout` |