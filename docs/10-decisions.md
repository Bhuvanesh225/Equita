# 10 — Decisions

A log of decisions that a reasonable person would otherwise re-litigate. Each entry says what was decided, why, and what would have to change for the decision to be wrong. **Add an entry when you make a choice the next agent would question.**

---

## D-01 · The Plan and the Allocation Are Two-Step (Locked)

`POST /plan` and `POST /assign/auto` return a proposal and write nothing. A second explicit call applies it. `src/routes/project/Plan.tsx` implements both flows this way.

**Why.** Nobody should ever discover that pressing a button re-wrote their board. The plan's own file comment says it: "Nobody should ever discover that pressing a button re-wrote their board."

**Would change if** the product were a background service that acts on your behalf. It is not.

---

## D-02 · One Call per Screen, Not One Call per Panel

`GET /api/projects/:id` returns the project, its tasks, equity, history, activity, comments, check-ins, reviews, nudges, insight demand and the viewer's capabilities. The workspace renders from that alone.

**Why.** One definition of what a project looks like, no chance of two panels disagreeing, and the live channel only needs to refetch one URL. `server/routes/projects.js` states this explicitly.

**Consequence for new screens:** if a new screen needs project data, reuse `GET /api/projects/:id` rather than adding a narrower endpoint. It is cheaper to render less than to maintain a second shape.

---

## D-03 · The Live Channel Refetches, It Does Not Diff

A server event bumps a version; every `useApi` with `live: true` refetches its whole resource after a 180 ms coalesce. See `src/lib/live.tsx`.

**Why.** Applying diffs in the browser is where live boards start disagreeing with the server, and that class of bug is invisible until it is expensive. One small request is the cheaper trade.

**Would change if** a payload became large enough for a refetch to be noticeable. Not true at this size (the workspace is ~64 kB of gzip'd JS and a few tens of kB of JSON).

---

## D-04 · Reviews Go to the Teacher, Not the Reviewee

`POST /api/projects/:id/reviews` writes a review that the subject does not read; the aggregated reading is teacher-only (`GET /reviews/summary`, `403` for students).

**Why.** This is the design decision that makes peers honest: a review written to be read by the person you are reviewing is a compliment, not a signal.

**Would change if** the product stopped being used in classrooms.

---

## D-05 · Board Lanes Are People, Not Statuses

`TaskBoard` has one lane per member plus a "Nobody" lane. Status is a property of the card (`StatusTag`), not the column.

**Why.** Every other project tool organises by status; organising by *who* is what makes the distribution visible, which is the entire subject of the product.

**Consequence:** `GroupBuilder` uses lanes for **teams** instead — the one deliberate exception. Say so in that file's comment block.

---

## D-06 · Equity Is Judged on Delivered Work, with Commitments Reported Beside It

The score uses `credited` (progress-weighted hours) and the API reports `committed` too, because the gap between them is the useful signal. From `server/engines/equity.js`:

> Equity is judged on *delivered* work, not on promises. A task somebody was given is not a task somebody did.

**Consequence for screens:** a member row must show both numbers (or at least be able to explain which one a bar is drawing). `LoadBar`'s `caption` is where that belongs.

---

## D-07 · Nothing Is a Category

Members get a continuous position and an hours number (`state` is a label derived from position, shown via `StateChip`), so somebody slightly behind is not "a free rider".

**Consequence:** never render a member as a binary (good/bad, contributor/free-rider). Use `StateChip` and the numbers.

---

## D-08 · Fixed: `planningRouter` Is Mounted at `/api`

See `docs/06-traps.md` T15. The router declares full paths, so mounting it at `/api/projects` made every write endpoint a 404. Fixed in `server/index.js`, with a comment stating the rule.

**Do not** "simplify" the mount table without reading it first — the two mount styles in this repo are deliberate:

```js
app.use("/api", planningRouter);          // declares /projects/:id/plan
app.use("/api/projects", projectsRouter); // declares /:id/equity
app.use("/api", tasksRouter);             // declares /tasks/:id and /projects/:id/tasks
```

---

## D-09 · Verification Tooling Is Part of the Deliverable

`scripts/` is not scratch. `shoot.mjs`, `inspect.mjs`, `shapes.mjs`, `probe.mjs`, `encscan.mjs` and now `smoke.mjs` are the mechanical substitute for "looks fine to me", and `package.json` exposes `smoke` and `selfcheck` for them.

**Why.** The most expensive bug in this repository shipped precisely because a screen was verified by looking at it. A screenshot proves a read; only a click or `smoke.mjs` proves a write.

**Consequence:** every new endpoint a screen depends on gets added to `scripts/smoke.mjs`, and every new class of layout bug found gets a check in `scripts/inspect.mjs`.

---

## D-10 · The Docs Are the Handoff

`AGENTS.md` + `docs/00…10` + `TODO.md` + `ROADMAP.md` replace the old single-file handoff. `HANDOFF.md` is kept only because it records the first session's reasoning; it is superseded where the two disagree, and `docs/00-state.md` is the authority on state.

**Consequence:** a change that makes the docs wrong is an incomplete change.

---

# Open Decisions (Not Yet Made — Make One and Record It Here)

## O-01 · Broken Engine Links: Alias the Router, or Change the Emitters?

Six link families emitted by engines/routes do not resolve (`docs/00-state.md`). `docs/08-screen-specs-small.md` argues for **aliasing in the router**: fewer files, and it keeps notification rows already stored with the old `link` working. The alternative — rewriting the emitters and migrating stored rows — is more correct long-term but touches five files plus a data migration.

**Recommendation:** alias. Then, later, switch the emitters and drop the aliases in one change. Either way, record the choice and add a check that follows a real link.

**Decided (fourth sitting): alias, in the router.** `/projects/:projectId/board` serves the same element as the workspace, `/people/:personId` serves `People` (still a stub), and `/classrooms/:classroomId/groups/:projectId` redirects to the group's board, because a class group *is* a project in this data model. `ProjectWorkspace` accepts `?panel=` as an alias for `?tab=` (with `plan→board`, `team→people`) and `ClassroomConsole` accepts `?panel=attention`. The emitters are unchanged, so every notification row already in the database still resolves. An unfinished piece of this decision: no check yet *follows* a real engine-written link (`TODO.md` P0-5).

**Would change if** the emitters get rewritten — at which point the aliases should be deleted in the same commit, not left as two vocabularies.

---

## O-01b · How Does a Toast Reach the Plan Dialog?

The screen that starts a project pushes a toast whose action is *Plan from the brief* (`docs/07-screen-specs.md`), but the dialog lives inside `ProjectWorkspace` and there was no URL that opened it. The alternative was to duplicate the two-step plan UI on `/projects/new`, which the spec forbids.

**Decided:** `?plan=1` on the workspace opens the plan dialog and is consumed on arrival (deleted from the URL with `replace`), so a later reload does not reopen it. This is the same pattern as `?task=`: screen state lives in the URL.

**Would change if** the workspace grows a general `?dialog=` vocabulary. If it does, `plan` should move under it rather than sit beside it.

---

## O-02 · Is a Class Group a Project?

`nudges.js` emits `/classrooms/:id/groups/:projectId` ("Open the group"), and `POST /api/classrooms/:id/projects` **creates one project per team**. So a class group *is* a project in this data model, and the missing route should redirect to the workspace.

**Recommendation:** redirect (spec'd in `docs/08-screen-specs-small.md`). If a "group" ever gains a distinct identity (a group without a project), this becomes a real screen instead.

---

## O-03 · Should a Student Be Able to Leave a Class?

`DELETE /api/classrooms/:id/students/:userId` requires teaching rights, so a student cannot remove themselves from a class, and `/settings` has no honest control to offer.

**Options:** (a) allow self-leave when `userId === req.user.id`; (b) leave it read-only and say so. (a) is better product behaviour and a ~6-line server change with a test.

---

## O-04 · Should `PATCH /api/auth/me` Accept `role`?

`POST /api/classrooms` tells non-teachers *"Switch your role in settings if you teach"*, but `PATCH /me` does not accept `role`, so the instruction is false. Either add the field (guarded so an account owning a class cannot stop being a teacher) or change the sentence.

**Recommendation:** add the field — a person who teaches and signs up as a student is a real case, and the sentence already promises it.

---

## O-05 · `GET /api/projects/:id/reviews/summary` Returns `members: []`

Even for a teacher, with no reviews yet. Confirm whether that is intended (nothing to aggregate) or an early return that hides members who could be reviewed. `docs/00-state.md` D8.

---

## O-06 · Where Does the Copilot's `classroomId` Context Come From?

`POST /api/insights/copilot` accepts `projectId` and `classroomId`, and `GET /copilot/starters` accepts the same. The console and the workspace should pass their own context when they add a copilot affordance (they do not yet). Decide whether the copilot panel is context-aware (`src/shell/Copilot.tsx`) or stays global.

---

## O-07 · Is `/insights` Worth a Screen of Its Own, or a Tab on `/today`?

The dashboard already contains `classes`, `cards`, `trend` and `nudges`. `/insights` risks being a second dashboard. `docs/07-screen-specs.md` caps it at six sections and gives it a distinct job (fairness as a subject, compared across projects and classes). If, while building it, it turns into a duplicate of `/today`, fold the useful parts into `/today` and redirect — and record that here.