# Equita

**Project coordination that keeps group work even.**

Equita is a working web app for the invisible labour of school group projects. It turns a brief into sized work, matches tasks to skills and capacity, shows each person's delivered hours against an even share, and gives a teacher or group a specific next move before the deadline.

It is deliberately more than a checklist: **visible imbalance → explainable recommendation → human-approved intervention → measurable refreshed state**.

> **Submission note:** the demo data is invented but deterministic in structure. It is clearly labelled in the product and is not presented as evidence from a real classroom pilot.

## Judge in five minutes

### Fastest route

```text
http://localhost:5173/login?demo=teacher
```

That shortcut uses the same real demo sign-in endpoint as the visible buttons on the login page. From there:

1. Open **Today**. The teacher sees class attention, not an empty personal task list.
2. Open **Classrooms → Systems Design 2A → Attention**.
3. Open the student or group with the clearest load gap.
4. Open the project’s **Fairness** panel.
5. Point out the even-share tick, five weighted measures, per-person load bars, and explainable suggestion.
6. Apply one suggested move. The receipt distinguishes the score before, fresh score after, moved task, and engine projection.

### The story to say out loud

> Group work problem → visible imbalance → explainable recommendation → teacher-approved intervention → measurable refreshed state.

### What to look for

- **Community relevance:** a familiar school problem — quiet overload and unequal credit in shared projects.
- **Impact potential:** the app catches pressure while there is still time to redistribute it.
- **Technical execution:** a real Express API, SQLite persistence, live SSE updates, two-step preview/apply writes, and reproducible checks.
- **Creativity:** fairness is expressed as hours, shares, signals, and a named intervention rather than another task list.
- **Accessibility:** responsive paper-first UI, labelled form controls, keyboard-friendly menus, visible focus states, and a non-drag path through group formation.

## Run locally

### Requirements

- Node **24.16.0**, pinned in `.nvmrc` (Node 22.13+ also supports this app’s `node:sqlite` usage).
- npm 10+.
- No database server, API key, or external service is required for the demo.

```bash
nvm install
nvm use
npm ci
npm run dev
```

Open:

- Web app: <http://localhost:5173>
- API health: <http://127.0.0.1:8787/api/health>

The first server boot creates and seeds `data/equita.db` if it has no accounts. Local database files are ignored by git. To intentionally reset the demo:

```bash
npm run seed
```

Resetting changes generated IDs and removes local changes in the demo database.

### Production-like local run

```bash
npm run build
npm start
```

The Express server serves `dist/`, the API, and the `/events` live channel on port 8787.

## Test and verification

The single offline acceptance command is:

```bash
make test
```

It runs the typecheck, production build, fresh-database API smoke test as teacher and student, the disposable write-path test, SSE verification, and the UTF-8 seed scan. It does not need a running server or network access.

Equivalent commands:

```bash
npm run typecheck
npm run build
npm test
node scripts/encscan.mjs
```

### Browser checks

Browser checks are project-local and no longer depend on a machine-specific Playwright installation:

```bash
npm ci
npx playwright install chromium

# screenshots and browser-console report
node scripts/shoot.mjs teacher .shots /today /classrooms /projects

# layout, overflow, hit-target, and accessible-name audit
node scripts/inspect.mjs teacher /today /classrooms /projects

# mobile pass
EQUITA_WIDTH=390 node scripts/inspect.mjs teacher /today /classrooms /projects
EQUITA_WIDTH=390 node scripts/shoot.mjs teacher .shots-mobile /today
```

On a minimal Linux machine, Chromium may also need its OS libraries. Use the matching Playwright system-dependency installation for that machine, or run the app in the supplied Docker image. `PLAYWRIGHT_EXECUTABLE_PATH` can point the harness at an existing browser.

For Windows Git Bash, prefix route-based browser commands with `MSYS_NO_PATHCONV=1` so `/today` is not rewritten as a filesystem path.

The reports are intentionally mechanical: `problems: []`, `hOverflow: 0`, and empty `clipped`, `overflow`, `overlap`, `small`, and `unlabelled` arrays are the target.

## Deploy with Docker

The Dockerfile pins the Node image, installs production dependencies from the lockfile, builds the client, runs as the unprivileged `node` user, and keeps SQLite in a named volume.

```bash
docker build -t equita:submission .
docker run -d --name equita-submission -p 8787:8787 -v equita-data:/app/data equita:submission
curl -fsS http://127.0.0.1:8787/api/health
docker rm -f equita-submission
```

Then open <http://localhost:8787>.

For a reverse proxy, set `TRUST_PROXY=1` (or the number of proxy hops). Set `COOKIE_SECURE=1` only when the public connection is HTTPS. All supported environment variables are listed in [`.env.example`](.env.example); the demo has no required secrets.

## Demo accounts

All seeded accounts use the password **`equita2026`**. The login page also offers one-click demo access.

| Email | Role | Best for |
| --- | --- | --- |
| `amara@equita.demo` | Teacher | Full classroom demo, attention, fairness, intervention |
| `tobias@equita.demo` | Teacher | Second class and comparison view |
| `maya@equita.demo` | Student | The carrying-member view across projects |
| `june@equita.demo` | Student | Standalone group with no teacher or class |

## What is real in the demo

The app is backed by a real local API and SQLite database. The seeded dataset contains 20 people, 2 classrooms, 6 projects, 93 tasks, 51 assignments, 127 contribution records, 65 check-ins, 44 reviews, 21 notifications, and 130 activity records.

The six seeded situations are intentionally different:

1. a drifting group where Maya is carrying the work;
2. a quiet but capable student;
3. unclaimed work before unfairness becomes visible;
4. a near deadline with overdue tasks;
5. a healthy group that shows what “good” looks like;
6. a standalone student team with no teacher.

The numbers are computed from this seed by the same engines used by the screens. The stories are not field research, and the product does not claim that they are.

## Architecture

- **Client:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS v4, React Router 7.
- **Server:** Express 5 and Node’s built-in SQLite API.
- **Persistence:** SQLite under `data/`, with deterministic seed stories in `server/seed-stories.js`.
- **Live updates:** authenticated Server-Sent Events at `/events`; the client refreshes API-backed screens after relevant writes.
- **Intelligence:** fairness scoring across five weighted measures, brief planning, skill/capacity allocation, classroom grouping, nudges, and copilot responses.
- **Deployment:** one Express process serves the built client, JSON API, and live stream.

For the detailed request lifecycle and data model, read [`docs/01-architecture.md`](docs/01-architecture.md) and [`docs/02-api.md`](docs/02-api.md).

## Design and accessibility

Equita’s visual language treats the school project brief as the interface: paper ground, ink, one teal accent, clear signal colours, and a repeated **load bar** that places each person’s delivered hours against the even-share tick. The radius-0 surfaces and hand-drawn icons are intentional; see [`DESIGN.md`](DESIGN.md).

The core workflows use semantic buttons and labelled fields. Group formation has a visible **Move to…** menu in addition to pointer dragging, so the outcome is available without drag-and-drop. Browser audits check hit targets, accessible names, overflow, clipping, and console errors. The next meaningful accessibility improvements would be automated contrast assertions and a complete multi-browser keyboard regression suite.

Privacy is deliberately simple in this demo: teachers can see class-level attention and student records; teammates only see the project information permitted by the API; the seed is local and disposable. A production deployment would need school consent, retention rules, and a clear policy for how attention signals are used.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/` | React app, routes, shared UI, live client state, CSS |
| `server/` | Express app, SQLite access, seed, engines, route modules |
| `scripts/test.mjs` | Offline integration test with a disposable database |
| `scripts/write-path.mjs` | Preview/apply, task, class, profile, notification, deletion, and SSE writes |
| `scripts/smoke.mjs` | Non-mutating endpoint contract check |
| `scripts/shoot.mjs` | Project-local Chromium screenshot harness |
| `scripts/inspect.mjs` | Mechanical layout and accessibility-adjacent audit |
| `docs/00-state.md` | Current verified build state |
| `docs/05-verification.md` | Verification commands and write-path guidance |
| `docs/09-demo-data.md` | Seed accounts and story arcs |
| `docs/hackathon-judgement.md` | Rubric score, judgement, and demo narrative |

## Submission judgement

**Current judgement: strong finalist and credible prize contender.** The concept is specific, technically deep, and unusually coherent for a hackathon submission. The main deduction is evidence: the community stories are seeded demonstrations rather than measured results from a real classroom pilot. Present that limitation plainly. The current provisional score is **89/100**; see the full criterion-by-criterion assessment in [`docs/hackathon-judgement.md`](docs/hackathon-judgement.md).

## Contributing safely

Read [`AGENTS.md`](AGENTS.md) before changing the project. Keep the runtime pinned, use `npm ci`, never commit `data/`, generated screenshots, credentials, or machine-specific paths, and run `make test` after every working step. Update the relevant `docs/` state record when behavior or verification changes.
