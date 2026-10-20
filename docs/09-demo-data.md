# 09 — The Demo Dataset

The seed is not filler. **Each project is a situation the product exists to reveal**, and a screen that renders it badly makes the product look pointless. `server/seed-stories.js` owns the arcs; read it before touching anything that changes what a screen shows.

## Accounts

All seeded accounts share the password **`equita2026`**. `POST /api/auth/demo {email}` skips the password for any `*@equita.demo` address — that is what the helper scripts use, and it is what a judge should be handed.

| Role | Email | Use It For |
| --- | --- | --- |
| Teacher | `amara@equita.demo` | every teacher surface; owns **Systems Design 2A** (13 students, 4 groups) |
| Teacher | `tobias@equita.demo` | the second class, **Media Studies 1B** (5 students, 1 group) — for comparison |
| Student | `maya@equita.demo` | the "carrying" member view; on 4 projects including the class's; a good default |
| Student | `june@equita.demo` | the independent (standalone, no class) team's lead |
| Student | `tobias`-class students | `imani`, `bruno`, `hana`, `oliver`, `lena` |
| Student | others | `priya`, `sam`, `noor`, `grace`, `yusuf`, `ana`, `tom`, `diego`, `ravi`, `aisha`, `kai` |

The demo accounts are listed as **buttons** on `/login`, not described in prose, because the most convincing thing about this product is what it says about a populated group and the fastest route to that is one click. Keep that.

## Contents (Verified Against `data/equita.db`)

| Table | Rows |
| --- | --- |
| `users` | 20 (2 teachers, 18 students) |
| `classrooms` | 2 · `enrollments` 20 |
| `projects` | 6 · `project_members` 25 |
| `tasks` | 93 · `assignments` 51 |
| `contributions` | 127 (the hours ledger) |
| `comments` | 33 · `checkins` 65 · `reviews` 44 |
| `notifications` | 21 · `activity` 130 · `equity_snapshots` 21 |
| `user_skills` | 86 |

## The Six Situations

From `server/seed-stories.js`, in the order they are listed there. Each `note` is the claim a screen must be able to make visible.

| # | Project | Mode | Situation | What Must Be Visible |
| --- | --- | --- | --- | --- |
| 1 | **Regenerating the greenhouse site** | class (Systems) | *the drifting group* — Maya is carrying it; Priya is behind on **delivered** work while never saying so | a `LoadBar` with a large gap, a `member-overloaded` flag on one person and a `behind` state on another, and the difference between committed and credited |
| 2 | **Transit audit for the 42 bus corridor** | class (Systems) | *the quiet group* — Tom is capable and simply not there | a `member-quiet` flag and `daysSinceSignal`, which is only visible because everybody checks in |
| 3 | **Digitising the school archive** | class (Systems) | *the early group* — 40% of the work has no owner yet; nothing is unfair yet | `equity.totals.unassigned > 0` and the unassigned list; "work nobody has taken on" is the thing to catch early |
| 4 | **Critique panel: mid-term peer review** | class (Systems) | *a near deadline nobody is prioritising* — due in 3 days, 5 overdue tasks; the reason Maya is over capacity across three projects | overdue nudges with a real day count, and an `overloaded` state that a single-project view would miss |
| 5 | **Podcast pilot: six episodes** | class (Media) | *a group that is working* (progress 0.76, even share) | a `sharebar--even` and a high score — a good group must be able to see that it is doing well |
| 6 | **Bike co-op website rebuild** | **standalone** | *the independent team* — no class, no teacher, no grades; the same engines apply | the same fairness maths on a screen with no teacher in it (this is the dual-mode proof) |

## Ids as They Stand Now

**Ids are generated at seed time and change on every reseed.** Never hard-code them in a script or a component; read them from `/api/projects` and `/api/classrooms` first (`scripts/shapes.mjs` and `scripts/smoke.mjs` do this). The table below is what the current database holds, for hand-testing with `curl`.

| Thing | Id |
| --- | --- |
| Class: Systems Design 2A (code `SYS-2A`) | `cls_hlurk79cvgvrke` |
| Class: Media Studies 1B (code `MED-1B`) | `cls_hlurk79dnnetyn` |
| Project: Regenerating the greenhouse site | `prj_hma78rvbrm2pu2` |
| Project: Transit audit for the 42 bus corridor | `prj_hmbaxo78tuj5d9` |
| Project: Digitising the school archive | `prj_hn1rj83qgdbuyx` |
| Project: Critique panel (due soonest) | `prj_hmw92qghy9sd9d` |
| Project: Podcast pilot: six episodes | `prj_hmj0ryiasse49y` |
| Project: Bike co-op website rebuild (standalone) | `prj_hmrub555sugym0` |
| Amara Okafor (teacher) | `usr_hm3l3djiy0eltn` |
| Tobias Lund (teacher) | `usr_hm3l3dk5bloprg` |
| Maya Okonkwo (student, carrying) | `usr_hm3l3dkq5m088s` |
| June Abara (student, standalone lead) | `usr_hm3l3dvj239wfq` |
| Diego Marín (student, overloaded across two groups) | `usr_hm3l3dn4kullh7` |

## Reseeding

```bash
npm run seed        # node server/seed.js --reset
```

`--reset` wipes and rebuilds. After a reseed:

1. every id in the table above is wrong — re-read them;
2. re-run `node scripts/encscan.mjs` (must print `clean`);
3. re-run `node scripts/smoke.mjs` for both accounts.

The seed is deterministic in story but the ids are time-based, so the *numbers* on screen (a score, a share, a gap) do move slightly between reseeds. When you assert on a number in a doc, assert on its *shape* ("a large gap", "score > 60"), never its exact value.

## The Tactical Rule for This Dataset

Your work should look like building software against data that already exists — which is literally true here: the engines, scores, candidates and prose are all computed. **Do not touch the seed's story.** If a screen cannot find the data it wants, the answer is almost always a field that already exists in `GET /api/projects/:id` or `GET /api/classrooms/:id`; look at `docs/02-api.md` before you consider changing the server.