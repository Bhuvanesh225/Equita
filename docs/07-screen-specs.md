# 07 — Screen specs (the six large remaining screens)

Each spec states the purpose, the data, the layout, the states, the actions, and an
acceptance checklist. Read `docs/03-design-system.md` and `docs/04-conventions.md` first, and
copy the skeleton from `src/routes/Projects.tsx`.

Everything below is a *specification of intent*, not a dictated pixel layout — the built
screens are the reference for how a `PageHead` + `Panel` page feels. What is not negotiable:
the acceptance checklist at the end of each spec.

---

## P1 · `/projects/new` — `NewProject`

**Purpose.** Turn a brief into a project. This page is the *brief itself*: the same artefact
the product's whole direction is built on, so it is a form that reads like a piece of paper,
not a wizard.

**Data.** `GET /api/skills` (only if you offer task entry here), `GET /api/classrooms` (the
class picker, teachers only), `POST /api/projects`.

**Layout.** `PageHead` with `title="Start a project"` and a one-sentence `sub` explaining
that the brief is what Equita plans from. One `Panel` (`recessed`) holding a single column of
`Field`s, max width ~72ch, sentence-cased labels:

| Field | Control | Notes |
| --- | --- | --- |
| What is it called | text input | min 2 chars; server rejects shorter with a friendly message |
| The brief | `<textarea>` | the biggest field on the page. `hint` must say what it buys: *paste what you were actually asked to do — Equita reads it for tasks, phases and the skills they need* |
| Who is it for | `Segmented` `standalone` \| `class` | students may only choose standalone; a teacher sees `class` |
| Which class | `<select>` of memberships | only when `class` is chosen; `disabled` + a hint when the person teaches no class |
| Hand in | `<input type="date">` via `dateInput()` | plus two or three quick buttons ("in a week", "in a month") that fill it |
| Who is on it | emails, comma- or newline-separated | `POST /api/projects` accepts `members: [email \| {email,name}]`. For a class assignment, membership comes from the class later, so hide this |

**Actions.** One primary `Create it`. On success (`201`):
- `push` a toast with the project name, then `navigate(\`/projects/${project.id}\`)`.
- If the brief is non-empty, the toast's `action` should be "Plan from the brief" and the
  workspace's own `PlanDialog` is the place the plan is made — **do not** duplicate the
  two-step plan UI here. (If you do want to plan before landing, the honest way is to
  navigate with `?tab=board` and let the person press the button.)

**States.**
- `busy` on the button while the POST is in flight; disable the form.
- Field-level errors: if `ApiError.isInput`, show `error.message` against the brief/name
  field via `Field error=`.
- A student with no class sees `standalone` only, with a hint explaining they can still be
  added to a class later with a code.

**Number rule.** No invented figures anywhere on this page. A hint is prose, not a claim.

**Acceptance.**
- [ ] `tsc` clean; `shoot` clean at 1440 and 390; `inspect` `problems: []` (all five arrays empty, `hOverflow: 0`) in both schemes.
- [ ] `POST` verified live (create a project, see it appear in `/projects`).
- [ ] The created project is **not** empty: it has exactly one member (the creator) and shows
      the brief back on the workspace.
- [ ] Empty/error states exist; a network failure shows the retry + a way out.
- [ ] Works for `student` and `teacher`, and for `teacher2` (a second class).

---

## P1 · `/classrooms` — `Classrooms`

**Purpose.** A person's classes. For a teacher, this is the list they open on a Monday: is
any group drifting? For a student, it is the door back into their class.

**Data.** `GET /api/classrooms` → `{classrooms: [{id, name, code, subject, term, ownerId,
role, isTeacher, students, projects, meanScore}]}`. Writes: `POST /api/classrooms`
(teacher: `{name, subject?, term?, policy?}`), `POST /api/classrooms/join` (`{code}`).

**Layout.**
- `PageHead title="Classes"`, `sub` = a sentence about what a class gives you (the teacher
  can see every group; students each run their own board).
- `actions`:
  - teacher: `Start a class` (primary) → `Dialog` with name / subject / term fields.
  - teacher: `Join with a code` — a teacher can also be a student in another class, so keep it.
  - student: `Join with a code` (primary) → the same `Dialog`, or `Link` to `/join`.
- Body: a `ProjectCard`-like card per class (`Panel` with title link). Show:
  - `name`, and `subject · term` as the `hint`;
  - the join code as a `Tag` with a copy action (teachers only — students see it too, since
    they can share it with a classmate);
  - `Stat`s: students, groups, and `meanScore` rendered with `ScoreMark`;
  - when there is more than one class, a `ComparisonBars` panel comparing `meanScore`
    between classes with `note` = `worstScore` (the weakest group), so the teacher sees
    which class needs them.
- A student's card uses `PersonRow`-style density and links straight into the console.

**States.** Empty → `EmptyState` with the real action: teacher *"You have no classes yet.
Start one and add your students by email — they can also join themselves with the code."*
Student: *"You are not in a class yet. Your teacher can add you, or you can join with the
code they gave you."* A `meanScore` of `null` must render as "no groups yet", not `0`.

**Acceptance.**
- [ ] `POST /api/classrooms` and `POST /api/classrooms/join` both verified live.
- [ ] The new class's `code` is visible and copyable, and joining with it from a second
      account actually enrols that account (verify via `/api/auth/me` memberships).
- [ ] `meanScore: null` handled; `students: 0` handled.
- [ ] `inspect` clean at 1440 **and** 390 (the card action row wraps rather than overflowing).
- [ ] A student sees no destructive or teacher-only controls.

---

## P1 · `/classrooms/:classroomId` — `ClassroomConsole` (the largest remaining screen)

**Purpose.** Everything a teacher needs about one class, in one screen: is anyone carrying,
who is behind, where the class is thin on skills, and what nothing has been handed in.

**Data.** `GET /api/classrooms/:id` — **one call**, `{classroom, projects, students, nudges,
nudgeCounts, coverage, analytics, trend, attention, viewer, gaps}`.
Also `PATCH /api/classrooms/:id` (`{name?, subject?, term?, policy?}`) for the policy panel,
`POST /:id/students` (`{students: [email | {email,name}]}`), `DELETE /:id/students/:userId`,
`GET /:id/coverage`, `POST /:id/projects` (set an assignment).

**Layout.** `PageHead` with:
- `kicker` = `subject · term`, `title` = `name`;
- `sub` = `plural(analytics.students, "student") · ${plural(analytics.groups, "group")} · mean fairness ${analytics.meanScore}`;
- `actions` = the join code `Tag` (+ copy), `Add students`, `Build the groups` (`Link` to
  `/classrooms/:id/groups`), `Set an assignment` (primary → `Dialog`), and a `Menu` with
  `Edit the class` / `Change the fairness policy`;
- `tabs` (`?tab=`) = **Overview · Roster · Coverage · Attention**, each with a count in a
  `.label` span where it means something (`attention.length`, `students.length`).

Tab contents:

**Overview**
- A `grid grid--stats` of `Stat`s from `analytics`: mean fairness, mean evenness (`meanGini`
  — say "spread" in the label, not "gini"), behind, overloaded, unplaced, never reviewed,
  groups without a hand-in date, open hours.
- `LineChart` of `trend` (score per week) with a `rules` guide line at 75 and at 50.
- The projects: one `Panel` per `ClassProject` — name (link to the workspace), `modest.score`
  with `ScoreMark`, a `ProgressLine` from `modest.progress`, `daysLeft`, open/unassigned
  counts, a `LoadBar` per member (`credited` against `even`), and the `attention` list.
- `gaps` and `coverage` get a one-line summary here with a link to the Coverage tab, rather
  than duplicating the tables.

**Roster** (the students)
- A dense table (`table table--num`) or `rows` of `PersonRow`: name, `state` via `StateChip`,
  a `LoadBar` on the row (or a compact `meter__track`), `totals.owed`, and a `Tag` when
  `acrossGroups` is true ("in more than one group"). `flags` render through `FlagList`
  (limit 2 on a row).
- Each row links to `/classrooms/:id/students/:studentId`.
- `Add students` `Dialog`: a `<textarea>` of emails (one per line), a hint that a name can
  follow the address, and a note that people already in the class are skipped (the server
  reports `added[].alreadyEnrolled`).
- `Remove` per row behind a `Confirm`, explaining honestly that their work stays on the
  record and their open tasks are released rather than deleted (that is what the server does).

**Coverage**
- One row per `coverage[]` entry: cluster `name`, `holders` and `strong` counts, `meanLevel`
  as a `Meter` (0–5 scaled to 100), and `topHolders` as small `Tag`s or avatars.
- `gaps` (where `needed` is true) as a `callout--over` at the top: *"Nobody in this class is
  strong at Making. Groups needing it will be handed the work with a warning."*
- `Stat`s: roster size, clusters covered `x of 8`.

**Attention**
- `attention[]` grouped by `severity` (critical / warn / info), each row linking to the
  person's record. Use `PersonRow` with `note={detail}`.
- The class `nudges` through `Nudges` with `compact` — the engine already wrote the sentence
  and the action; do not rewrite them.
- `nudgeCounts` as the panel hint: `${critical} serious of ${total}`.

**States.** Empty class (0 students): every tab must still render, with `EmptyState`s that
name the next action (add students, then build groups). A class with students but no projects:
an `EmptyState` on Overview offering `Set an assignment`.

**Acceptance.**
- [ ] All four tabs render from the single `GET /:id` call (no extra request per tab).
- [ ] `Add students`, `Remove student`, `Set an assignment` and `Save policy` verified live
      (use `teacher2`/`free` accounts to check enrolment actually happens).
- [ ] `policy` edits round-trip: change `requireReview` and confirm the returned policy shows it.
- [ ] No wall of colour: at most one filled signal colour per row; `Nudges compact` for lists.
- [ ] `inspect` clean at 1440 and 390; the roster table scrolls in `.scroll-x` on mobile
      rather than overflowing the page (`hOverflow` must stay `0`).
- [ ] Both schemes, on every tab.

---

## P3 · `/classrooms/:classroomId/groups` — `GroupBuilder`

**Purpose.** Form balanced groups from a roster, and let the teacher override the machine.
This is the screen that makes `@dnd-kit` earn its place in `package.json`.

**Data.** `POST /api/classrooms/:id/groups/preview` → `{teams, objective, parts, sizeRange,
notes, gaps, balanced, seed, rosterSize}`. `GET /api/classrooms/:id/coverage` for the
before/after. Commit with `POST /api/classrooms/:id/projects` →
`{name, brief?, dueAt?, teams: [{name, memberIds}], autoPlan?, autoAssign?}`.

**Layout.**
- `PageHead title="Form the groups"` for `classroom.name`, `actions` = `Commit the groups`
  (primary, disabled until the arrangement is valid) and a `Menu` / button `Try another
  arrangement` (re-preview with `seed + 1`).
- A control `Panel`: `Segmented` for group size (3/4/5, from `sizeRange`), a required-skills
  control (chips per cluster — `requiredClusters`), and the objective readout: `objective`
  as a `Stat`, plus `parts` as four `Meter`s (Coverage, Strength balance, Capacity balance,
  Diversity). `notes[]` render as `Quiet` lines; `balanced` gets a `Tag tone="accent"`.
- The board: `.board` / `.lane` — **one lane per team** (this is the one place the lane
  metaphor is used for teams rather than people; say so in the file comment). Each lane shows:
  the team name, `meanStrength`, `totalCapacity`, `weakestCluster` as a warning, member cards
  (draggable, `@dnd-kit/core` with `PointerSensor` distance-6, exactly as
  `src/routes/project/Board.tsx` does it), the per-cluster `coverage` as a small block of
  bars, and `roles[]` rendered with their `label` ("Keeps it moving").
- Dragging a member between lanes is a **client-side** edit: the preview API has no "pinned
  member" input. Recompute each lane's coverage from the members' `topSkills` when a drop
  happens, and mark the lane `lane--active` for the drop target. Re-running the preview
  discards manual edits — say so in a `Quiet` line near the button.

**Commit.** A `Dialog`: assignment name (required), brief, hand-in date, then two switches
mirroring the API: `Plan the tasks from the brief` (`autoPlan`) and `Place the work with the
allocator` (`autoAssign`, disabled unless `autoPlan`). On success show a toast
`${created.length} groups set` and `navigate(\`/classrooms/${id}\`)`.

**States.** Fewer than 2 students → `EmptyState` linking back to the roster. `gaps` render as
a warning list above the board. After commit, the screen must not be reachable-and-editable
for the same assignment without a warning — a `Quiet` line that committing creates *new*
projects is honest and enough.

**Acceptance.**
- [ ] Preview verified live with two different `seed`s and two different `size`s.
- [ ] Commit verified live: `POST /projects` creates one project per team, each member is on
      the right team, and each new project appears in `/classrooms/:id` and in `/projects`.
- [ ] Drag-and-drop works with a mouse **and** a touch/pointer emulation; there are buttons as
      well (`Move to…` in a `Menu`) so the screen is usable without dragging — dnd is an
      enhancement, not the only path.
- [ ] Keyboard: dragging is not required for any outcome.
- [ ] `inspect` clean at 1440 and 390.

---

## P2 · `/classrooms/:classroomId/students/:studentId` — `StudentRecord`

**Purpose.** One person's record, for a teacher deciding whether to intervene, or for the
person themselves reading their own.

**Data.** `GET /api/classrooms/:id/students/:userId` → `{student, top, growth, clusters,
totals, projects, reading}`. Note the server rule: a teacher of the class, or the person
themselves. Anyone else gets `403` — so a student following a link to a classmate must get a
clean refusal, not a blank page.

**Layout.**
- `PageHead` with `kicker` = a `Link` back to the class roster ("Systems Design 2A · roster"),
  `title` = the person's name, `sub` = `headline · `${capacity}h a week``, and
  `actions` = `StateChip state={…}` from the owning `ClassStudent` if you have it, plus a
  `Menu` (copy link, open their project).
- `Panel` "How they are going": the `reading` sentence set in `--text-md`, followed by a
  `Stat` row from `totals`: credited, committed, even, owed, open, done, late. Then
  `clusters` as `Meter`s (or a `BarChart`), `top` skills as `Tag`s, `growth` as a distinct
  block labelled *"where they want to grow"* (appetite ≥ 3 is the signal).
- `Panel` per project in `projects[]`:
  - name (link to `/projects/:id`), `equityScore` with `ScoreMark`;
  - `member` → a `LoadBar` (`credited` against `even.credited`) and the `state`;
  - `tasks[]` as `TaskRow`s with `DueMark` (the `late` flag is already computed);
  - `contributions[]` (the ledger) as an `ActivityFeed`-like list — this is the honest record
    of hours, so show `kind`, `effort`, `note`, `createdAt`;
  - `checkins[]` as rows with the mood `Tag` and the blocker in risk colour;
  - `history[]` as a `Sparkline` of `credited`.
- A closing `Quiet` line when a project has no contributions: *"No hours have been logged on
  this project yet, so the share above is a commitment, not a record."* — that is the
  engine's own distinction and worth saying out loud.

**States.** `403` → `EmptyState title="That record is not yours to read"` with a link back to
the class or to `/today`. Never render a blank page. Loading → `Spinner`.

**Acceptance.**
- [ ] Verified as `teacher` (a real record), as the student themselves
      (`/classrooms/:id/students/<your own id>`), and as a classmate (a clean `403`).
- [ ] `totals.owed` sign and wording match `LoadBar`'s caption convention (behind vs ahead).
- [ ] `inspect` clean at 1440 and 390, both schemes.
- [ ] Every number on the page comes from the payload; no arithmetic in JSX beyond formatting.

---

## P2 · `/insights` — `Insights`

**Purpose.** Fairness as a subject: across a person's own projects, and (for a teacher)
across their classes. This is where the product's thesis is visible in one place, so it is
the screen the landing page's claims have to survive.

**Data.** `GET /api/insights/dashboard` (already used by `/today` — reuse it, do not add an
endpoint), plus `GET /api/classrooms` and `GET /api/classrooms/:id/analytics` when the viewer
has classes. `GET /api/projects` if you want the per-project parts.

**Layout.**
- `PageHead title="Fairness"`, `sub` explains the score honestly: *"Five weighted measures of
  how evenly the work is shared and how much of it has actually landed."*
- **The score, explained.** A `Panel` containing the aggregate: `ScoreDial` for the mean
  score, and the five parts as `Meter`s (**Balance · Delivery · Spread · Engagement ·
  Readiness**) with the weights printed beside them (`Math.round(weight*100)%`), because a
  weighted average nobody can see is a number nobody can argue with.
- **Your projects.** `ComparisonBars` of `dashboard.cards` by `equity.score`, each with
  `note` = member count and a link. Then `ShareBar` per project (or one `Panel` per project)
  showing `equity.totals.unassigned` — "work nobody owns" is the thing to catch early.
- **Where it is going.** A `LineChart` of the trend: from `dashboard.trend`
  (credited/committed/even per week) for a student, from each class `trend` for a teacher.
  Include a `rules` line at the even share.
- **Classes** (teacher only): one `Panel` per class from `GET /api/classrooms/:id/analytics`
  with `Stat`s (mean, worst, behind, overloaded, unplaced, never reviewed), a
  `ComparisonBars` of the class's projects by score, and the top three from `coverage`'s
  weakest clusters. Students see their own classes' summary only, or nothing at all when they
  have none.
- **Who needs a hand.** Deltas worth acting on: `dashboard.classes[].attention` for a teacher;
  otherwise the person's own `nudges`.

**States.** No projects → `EmptyState` offering `/projects/new`. No classes (student) → hide
the section entirely rather than showing an empty panel; a section that says "you have no
classes" on a student's screen is noise.

**Acceptance.**
- [ ] The page is readable in one screenful of sections — it must not become a dashboard of
      dashboards. Cap it at the six sections above.
- [ ] Every `Meter` value is a real `parts` value; the labels match `ProjectWorkspace`'s exactly.
- [ ] `inspect` clean at 1440 and 390, both schemes.
- [ ] Teacher and student each verified (their payloads differ: `trend`, `classes`).
- [ ] No number appears that is not in a payload.