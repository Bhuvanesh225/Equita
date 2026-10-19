# 05 — Verification

Four checks are automated, and two of them sign in through the real API and drive a real
Chromium. **Use them. Do not "eyeball it".** Every tool below was run successfully at the
time this file was written.

## The four scripts

| Script | What it proves | Command |
| --- | --- | --- |
| `scripts/shoot.mjs` | the screen renders, with no console errors and no page errors; writes a full-page PNG + `report.json` | `MSYS_NO_PATHCONV=1 node scripts/shoot.mjs teacher .shots /projects` |
| `scripts/inspect.mjs` | layout: clipped text, overflow, sibling overlap, hit-targets < 24px, unlabelled icon controls, sideways scroll | `MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher /projects` |
| `scripts/smoke.mjs` | every endpoint a screen depends on answers, with the right method and prefix | `node scripts/smoke.mjs teacher` |
| `scripts/shapes.mjs` | the exact keys of every API response (a type tree, not raw JSON) | `node scripts/shapes.mjs teacher` |

Plus two older ones: `scripts/probe.mjs` (raw DOM + console when a screen renders nothing)
and `scripts/encscan.mjs` (scans the DB for double-encoded UTF-8; re-run after any seed edit).

`npm run smoke` is the same as `node scripts/smoke.mjs`. `npm run selfcheck` is an alias.

### Accounts

`shoot`/`inspect`/`probe` take an account name; `shapes`/`smoke` take `teacher`|`student`.

| Name | Email | Use |
| --- | --- | --- |
| `teacher` | `amara@equita.demo` | most surfaces; owns Systems Design 2A |
| `teacher2` | `tobias@equita.demo` | the second class, for comparison |
| `student` | `maya@equita.demo` | the "carrying" member view |
| `free` | `june@equita.demo` | a student in no class |
| `none` | — | a stranger, for `/`, `/login`, `/signup` |

### Windows / Git Bash

- **`MSYS_NO_PATHCONV=1` is mandatory** for `shoot.mjs`, `inspect.mjs` and `probe.mjs`.
  Without it, Git Bash rewrites the leading `/` of a route into a filesystem path and the
  script navigates nowhere.
- `node` here is v24; the server needs 22.5+ for `node:sqlite`.

## Widths and schemes

`shoot.mjs` and `inspect.mjs` read the viewport from the environment, so the route arguments
stay routes (an `--width`-looking string would be indistinguishable from a path). Equita is
light-mode only; the paper palette is fixed before first paint:

```bash
# mobile
EQUITA_WIDTH=390 MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher /today /projects
EQUITA_WIDTH=390 MSYS_NO_PATHCONV=1 node scripts/shoot.mjs teacher .shots /today

```

Screenshots are suffixed `-390` so a mobile capture never silently overwrites the desktop
one. The audit row reports the viewport and fixed paper scheme.

## Reading the output

- `shoot.mjs` prints `report.json`; the fields that matter are **`problems`** (empty is the
  goal — it collects `pageerror`, non-extension `console` errors, and "still loading after
  15s"), and `panels`/`flags`/`empty` as a sanity check that content actually rendered.
  A `panels: 0` or a suspiciously tall `height: 900` means the screen was blank.
- **`shoot.mjs` waits for `main .spinner` to disappear.** `Spinner` renders `.row.spinner`,
  so any screen that shows a spinner correctly is waited for. If a screen never removes its
  spinner the harness reports "still loading after 15s" — that is a real finding.
- `inspect.mjs` prints one row per route. Every array must be empty:
  `clipped`, `overflow`, `overlap`, `small`, `unlabelled`. `hOverflow` must be `0`.
  It also prints `--- console noise ---` for 4xx+ responses and console warnings.

## The order to run them in

```bash
# 0. once per session
cd "E:/Hackathons/Neighborhood Hacks/equita"
npm run dev &            # or two terminals: npm run dev:api / npm run dev:web
curl -s http://127.0.0.1:8787/api/health

# 1. after every file
npx tsc --noEmit

# 2. after every screen
MSYS_NO_PATHCONV=1 node scripts/shoot.mjs teacher .shots <route>
MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher <route>
EQUITA_WIDTH=390 MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher <route>

# 3. before you believe a screen works at all
node scripts/smoke.mjs          # then: click the write path by hand (below)

# 4. before a delivery
npx tsc --noEmit && npm run build && node scripts/encscan.mjs && node scripts/smoke.mjs
```

## Exercise the write path — the check that find bugs a screenshot cannot

The single most expensive bug in this repository shipped because a screen was verified by
*looking* at it. A screenshot proves a page **read** correctly; it proves nothing about a
button that POSTs to a URL that does not exist.

For every interactive control on a screen you have built, do one of:

1. **Click it in a browser.** Open `http://localhost:5173`, sign in with a demo account,
   press the control, and confirm the toast is a success and the board changes.
2. **Call it with `curl`** using a session cookie:

```bash
J=.tmp/jar.txt
curl -s -c $J -X POST http://127.0.0.1:8787/api/auth/demo \
  -H 'content-type: application/json' -d '{"email":"amara@equita.demo"}' -o /dev/null

# a real id
PID=$(curl -s -b $J http://127.0.0.1:8787/api/projects | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).projects[0].id))")

# a non-destructive preview
curl -s -b $J -X POST "http://127.0.0.1:8787/api/projects/$PID/plan" \
  -H 'content-type: application/json' -d '{"utilisation":0.6}' | head -c 200
```

Add every new endpoint you rely on to the list in `scripts/smoke.mjs`, so the next person
does not have to rediscover it.

## Live updates

The `inspect.mjs` run reports `http 4xx` lines from the live channel if the session is bad.
To prove liveness properly:

1. Open two browsers side by side, signed in as different people (one teacher, one student).
2. Act in one (log hours, move a task, write a review).
3. The other must update **without a reload**.

If a screen does not update, it is almost certainly not using `useApi` (it defaults to
`live: true`) or it is caching data in `useState`.

## Repo hygiene checks

```bash
node scripts/encscan.mjs          # "clean" — no double-encoded UTF-8
npx tsc --noEmit                  # clean
npm run build                     # must succeed; note the chunk sizes
```

## Do not trust a stale server

A process holding port 8787 that was started before your edit silently serves the old code.
If a change appears to have no effect:

```bash
netstat -ano | grep 8787          # find the PID
# Windows: taskkill //F //PID <pid>     (Git Bash needs the doubled slashes)
```

Then restart `npm run dev` and verify with `curl -s http://127.0.0.1:8787/api/health`.

## Test fixture ids differ per account

Ids are generated by the seed and are **not** stable across a reseed. Never hard-code
`prj_hmw92qghy9sd9d` in a script or a doc example that has to keep working: read ids from
`GET /api/projects` / `GET /api/classrooms` first, as `shapes.mjs` and `smoke.mjs` do. The
ids in `docs/09-demo-data.md` are the ones the current database happens to hold.
