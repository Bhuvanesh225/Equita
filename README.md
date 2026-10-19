# Equita

**Project coordination that keeps group work even.**

Equita plans student project work in hours, places each task with a person whose skills and
bandwidth match it, and shows the group as a number when the split has tipped. It works for a
group of friends with no teacher (standalone) and for a class whose teacher needs to see every
group at once.

The short version of the thesis: *a checklist records work; it never distributes it.* Equita's
whole subject is the distribution — each person's hours against an even share, and the gap
between what was promised and what actually landed.

![The landing page](landing-hero.png)

## Run it

Node **24.16.0** is pinned in `.nvmrc` (22.5+ also works because the server uses `node:sqlite`, with no native build step).

```bash
npm install
npm run dev          # API on :8787 + Vite on :5173, both hot-reloading
```

- App: <http://localhost:5173>
- API: <http://127.0.0.1:8787>
- The database is created and seeded on first boot: `data/equita.db`

Other scripts:

```bash
npm run build        # production build
npm start             # serve the built app and API on :8787
npm run typecheck    # tsc --noEmit
npm run seed         # wipe and reseed the demo dataset
npm run smoke        # hit every endpoint the screens need and assert a status
npm test              # offline API + write-path test: fresh DB, real server, both demo roles, SSE
```

The same checks are available as `make test`. It starts its own local API and SQLite database,
so it does not need a running dev server or an internet connection.

## Deploy with Docker

The image builds the Vite client and runs the Express server that serves the client, API and live
event stream on one port. The SQLite data directory is a named volume so a container restart does
not erase work:

```bash
docker build -t equita .
docker run --rm -p 8787:8787 -v equita-data:/app/data equita
```

Open <http://localhost:8787>. The first boot seeds the demonstration dataset when the volume is
empty. Do not bake secrets into the image; this demo uses the built-in accounts listed below.

## Demo accounts

All seeded accounts share the password **`equita2026`**, and any `@equita.demo` address can be
opened with one click from the sign-in screen (no password). Start with:

| Account | Who |
| --- | --- |
| `amara@equita.demo` | a teacher with a class of 13 and four groups |
| `maya@equita.demo` | a student carrying more than her share across three projects |
| `june@equita.demo` | a student running an independent team with no class and no teacher |

## What is in it

| Surface | State |
| --- | --- |
| Marketing page (`/`) | built — every number on it is computed by the same engines from the same seed |
| Auth (`/login`, `/signup`, `/join`) | built |
| Today (`/today`) | built |
| Projects (`/projects`, `/projects/:id`) | built — board, fairness panel, planning, allocation, task sheet, reviews |
| Classes (`/classrooms`, console, group builder, student record) | built |
| Fairness, People, Profile, Notifications, Settings | built |

## How it is built

- **Client** React 19 · Vite 8 · TypeScript 5.9 · Tailwind v4. Hand-drawn icons and charts, no
  icon or chart dependency.
- **Server** Express 5 · `node:sqlite`. One session cookie, one SSE channel (`/events`) that
  every screen subscribes to, so the whole app updates live without anyone wiring a refresh.
- **The intelligence layer** (the part that is finished, and the reason the product is not a
  checklist): skill matching, project context, an equity engine scoring five weighted measures,
  a planner that turns a brief into a sized task list, an allocator that ranks candidates and
  explains itself, classroom grouping, nudges, and a copilot. Roughly 2,650 lines under
  `server/engines/`.

Read `docs/01-architecture.md` for the map, `DESIGN.md` for why it looks like this, and
`docs/02-api.md` for every endpoint and its exact response shape.

## The demo dataset is a set of situations

The seed is not filler. Each of the six projects is a case the product exists to reveal: one
group drifting with a member silently behind, one where a capable person has gone quiet, one
too early for unfairness but with 40% of the work unclaimed, one near a deadline nobody is
prioritising, one that is working well, and one independent team with no teacher at all.
`server/seed-stories.js` owns those arcs and `docs/09-demo-data.md` explains what each screen
should be able to show about them.

## Verification

Four harnesses, all of which sign in through the real API and drive a real headless Chromium or
the real endpoints — so none of them depends on a browser tab you happen to have open:

```bash
MSYS_NO_PATHCONV=1 node scripts/shoot.mjs teacher .shots /projects   # screenshots + console errors
MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher /projects        # clipped text, overlap, hit targets
node scripts/shapes.mjs teacher                                      # the shape of every response
node scripts/smoke.mjs teacher                                       # every endpoint answers
```

`MSYS_NO_PATHCONV=1` is required on Windows/Git Bash, or the leading `/` in a route is rewritten
into a filesystem path. Widths and schemes come from the environment:
`EQUITA_WIDTH=390 EQUITA_SCHEME=ink`. See `docs/05-verification.md`.

## Working on it

`AGENTS.md` is the contract for a coding agent (read order, non-negotiables, the definition of
done). `TODO.md` is the live task list and `ROADMAP.md` explains the order. Everything else is
in `docs/`:

| File | Contents |
| --- | --- |
| `docs/00-state.md` | **verified** state: what is built, what is stubbed, what is broken |
| `docs/01-architecture.md` | process, request lifecycle, database, the engines |
| `docs/02-api.md` | every endpoint, with exact keys, and which screen needs it |
| `docs/03-design-system.md` | tokens, primitives, furniture classes, the signature component |
| `docs/04-conventions.md` | the patterns every existing screen follows |
| `docs/05-verification.md` | how to check a screen, and how to exercise a write |
| `docs/06-traps.md` | bugs already paid for — do not rediscover them |
| `docs/07-screen-specs.md`, `docs/08-screen-specs-small.md` | a spec per remaining screen |
| `docs/09-demo-data.md` | accounts, ids, and the six situations |
| `docs/10-decisions.md` | decisions that should not be re-litigated, and the open ones |
