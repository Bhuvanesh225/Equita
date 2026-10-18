# ROADMAP

Where the project is going, in what order, and why that order. `TODO.md` is the checklist
this plan expands into; `AGENTS.md` holds the finish line.

## Where we are

The **intelligence layer is finished** (2,652 lines of engines), the **server is complete**
(7,457 lines), and the **client is complete for 8 of 18 routes**. The gap is rendering data
that already exists and already has types.

Two sittings have gone into the app proper:

- Sitting 1 (session `…01a14e88`): design record, marketing page, auth, dashboard, and the
  intelligence layer. 12 stubs.
- Sitting 2 (session `…01a14f2b`): `/projects`, the whole project workspace and its five
  panels, and the first version of the verification harness. 10 stubs.
- Sitting 3 (this one): the documentation system, `scripts/smoke.mjs`, viewport/scheme flags
  on the harnesses, and **the fix that made the workspace's write path work at all**
  (`planningRouter` was mounted at the wrong prefix — see `docs/06-traps.md` T15).

The remaining work is 10 screens and 3 missing routes. Nothing requires new engine code
except three small server changes listed at the end.

## The order, and the reasoning

```
P0  safety + the app's own links work ────────────────────────────────┐
      │  (git, broken links, verify the workspace write path, build)  │
      ▼                                                              │
P1  the core loop:  /projects/new → /classrooms → console → student  │   a teacher can run a class
      │                                                              │
      ▼                                                              │
P2  reach + fairness:  /insights · /people(/:id) · /profile ·        │   a person can find and fix
      │                /notifications · /settings                    │
      ▼                                                              │
P3  the group builder (new craft: @dnd-kit, balancing, commit)       │   the teacher's headline act
      ▼                                                              │
P4  finish: no stubs, delete _pending, mobile + ink sweep,           │   the definition of done
      │     liveness sweep, README                                     │
      ▼                                                              │
      done ◀──────────────────────────────────────────────────────────┘
```

### Why P0 comes first

Three reasons, in order of force:

1. **P0-1: there is no version control.** Every change so far has been one bad write away
   from being unrecoverable, and the write tool *has* dropped `path` on a large payload and
   destroyed `index.html` once. `git init` costs a minute.
2. **P0-2: the app's own links do not work.** `Nudges` renders `nudge.action.href` as a
   `Link`, and `href` is `/projects/:id/board?task=…`, which the router does not serve. **The
   single most prominent interactive element on the dashboard is a 404.** Fixing the router
   is a handful of lines and it makes six families of already-written links work at once —
   including the two links the built workspace already renders to `/people/:id`.
3. **P0-3: the workspace's write path was dead and now is not.** It is fixed, but nothing
   has been *clicked*. The lesson from T15 is that a `tsc` pass and a screenshot prove nothing
   about a write. Twenty minutes of clicking protects the highest-value screen in the product.

### Why P1 before P2

P1 is the teacher's core loop end to end: create an assignment → a class → groups → a
student's record. Whatever a demo judge does first, it is this. P2's screens are reach and
self-service; they make the product *usable* rather than *demonstrable*, and they are cheaper,
so they are the right second act rather than the first.

There is also a dependency: `/projects/new` and the console are the two places where a
*second* class and a *second* project can be created, which the P2 screens then have more to
show. A teacher with one class sees a comparison view full of one bar.

### Why P3 (the group builder) is not earlier

It is the most expensive single screen (drag-and-drop, coverage recomputation, a commit flow
that creates N projects), and it is the one screen whose value a judge can *infer* from the
console even before it is built. It is also the only screen where a wrong implementation is
worse than no implementation: forming bad groups and enforcing them is a product failure.
Give it the time it needs, after the cheap wins.

### Why P4 is not optional

A demo that fails on a phone, or in the darker scheme, or points at a link that 404s, loses
the room regardless of the engines behind it. The sweep is mechanical
(`inspect.mjs` over every route at 1440, 390, paper and ink) and it is the difference between
"we built a product" and "we built a product and checked it".

## Phase detail

### P0 — Ground truth (half a day)

| Task | Then you can |
| --- | --- |
| `git init` + first commit + `.gitignore` | undo, and see what changed |
| Register the 3 missing routes; accept `panel` as an alias for `tab` | click anything the engines told you to click |
| Click every control in the workspace | believe that screen exists |
| `npm run build` before deliveries | catch a production-only break |
| Keep `scripts/smoke.mjs` green | never rediscover T15 |

Deliverable: the built app works when you use it, and the repository can be rewound.

### P1 — The core loop (two to three days)

| Screen | Why it is here | Depends on |
| --- | --- | --- |
| `/projects/new` | without it a demo cannot make a second project; the brief form is also the product's thesis as a UI | `POST /api/projects` |
| `/classrooms` | the door into the console; two dialogs (create, join) | `POST /api/classrooms`, `/join` |
| `/classrooms/:id` (console) | the teacher's Monday screen; the biggest remaining surface | `GET /api/classrooms/:id` |
| `/classrooms/:id/students/:uid` | the record a teacher opens when they decide to intervene | `GET …/students/:userId` |

Deliverable: a teacher can create a class, add students, set an assignment, watch it drift, and
open the person who is drifting — without leaving the product.

### P2 — Reach and fairness (two days)

| Screen | Why |
| --- | --- |
| `/insights` | the product's thesis stated once, with the score explained; also the screen the landing page's claims must survive |
| `/people` + `/people/:id` | closes the two links the workspace already renders, and makes engine-written prose about a person reachable from anywhere |
| `/profile` | the only screen that feeds the allocator; without it the intelligence layer has nothing to match on |
| `/notifications` | where every engine-written nudge actually lands |
| `/settings` | account, appearance, and the honest answer to "can I leave this class?" |

Deliverable: any person, on any screen, can find out who someone is, fix their own profile, and
see everything the engines have ever told them — and the `panel`/`tab` vocabulary is consistent.

### P3 — The group builder (one to two days)

Deliverable: a teacher turns a roster into balanced groups, overrides the machine by hand, and
commits the arrangement into real projects with real tasks and real allocations.

### P4 — Finish (half a day)

Deliverable: no stub, no 404, no clipped text at 390px, both schemes checked, live updates
proven with two browsers, and a `README.md` a stranger can follow.

## Three small server changes worth folding in as you pass

Each is a few lines and each closes a contradiction already visible in the product. Record the
decision in `docs/10-decisions.md`.

1. **`PATCH /api/auth/me` should accept `role`** (guarded: not while owning a class).
   `POST /api/classrooms` already tells non-teachers to "switch your role in settings".
   *(O-04)*
2. **A student should be able to leave a class** — allow `userId === req.user.id` on
   `DELETE /api/classrooms/:id/students/:userId`. Otherwise `/settings` cannot offer it honestly.
   *(O-03)*
3. **Confirm or fix `GET /api/projects/:id/reviews/summary` returning `members: []`** for a
   teacher with no reviews yet. *(O-05, `docs/00-state.md` D8)*

## What "done" looks like

Not a list of features — the checklist at the end of `AGENTS.md`. In prose: every route is
real, every link resolves, every number is computed, every screen survives a 390px viewport in
both schemes, and two browsers kept open side by side never disagree.

## Risks, honestly

| Risk | Mitigation |
| --- | --- |
| The console becomes a wall of colour and readable names disappear | `Nudges compact`, `FlagList limit`, one filled signal colour per row. This is already called out in the components' own comments. |
| `/insights` turns into a second `/today` | Cap it at six sections; if it duplicates, fold it back and redirect (O-07). |
| Drag-and-drop ships without a keyboard path | Ship the `Move to…` menu first; drag is the enhancement. |
| The workspace write path has more silent 404s of the T15 kind | `scripts/smoke.mjs` plus a link-following check (P0-5). |
| Context is spent on docs rather than screens | The docs exist **because** state was reconstructed twice; a screen added without them costs the next sitting more than it gains. Keep them terse and update them as you go. |