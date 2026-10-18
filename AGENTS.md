# Equita — agent contract

Read this file first. It is written for the next agent, not for a human reader.
Everything else lives in [`docs/`](docs/) and the two trackers. Do not rely on memory
or on any handoff written before this file: verify against the repository.

## What this project is

**Equita** — project coordination that keeps group work even. A student team (or a
teacher with a class) plans work in hours, the allocator places each task with a
person whose skills and bandwidth match, and the product shows the group as numbers
when the split has tipped.

Repository root: `E:/Hackathons/Neighborhood Hacks/equita`
Stack: React 19 + Vite 8 + TypeScript 5.9 + Tailwind v4 (client) · Express 5 +
`node:sqlite` (server). Node 22.5+ is required (no native build step).

## Read in this order

| # | File | Why |
| --- | --- | --- |
| 1 | `docs/00-state.md` | What is built, what is a stub, what is broken. **Verified**, dated. |
| 2 | `TODO.md` | The live task list. Pick the top unchecked item in the current phase. |
| 3 | `ROADMAP.md` | Phase order and why it is in that order. |
| 4 | `docs/03-design-system.md` | Tokens, primitives, furniture classes. Do not invent new ones. |
| 5 | `docs/04-conventions.md` | Code patterns every existing screen already follows. |
| 6 | `docs/02-api.md` | Every endpoint a screen renders, with exact response keys. |
| 7 | `docs/06-traps.md` | Bugs already paid for. Do not rediscover them. |
| 8 | `docs/05-verification.md` | The four scripts, and how to exercise a write. |
| 9 | `docs/07-screen-specs.md` | Per-screen spec for the six large unbuilt routes. |
| 10 | `docs/08-screen-specs-small.md` | The four small screens, and the three missing routes. |
| 11 | `docs/09-demo-data.md` | Accounts, ids, and the six situations the seed tells. |
| 12 | `docs/10-decisions.md` | Locked decisions, and the open ones you may need to make. |

`DESIGN.md` is the pre-build design record — a contract, not a suggestion.
`HANDOFF.md` is the first session's handoff: still true about the engines and the design, but
superseded by `docs/` wherever the two disagree. `docs/00-state.md` is the authority on state.

## Non-negotiables

1. **Do not re-derive the engines.** `server/engines/*` (5,414 lines) are finished
   and correct. Do not touch `server/seed-stories.js` — it owns the demo's arcs.
2. **Build against `src/lib/types.ts`.** Every shape a screen needs already has a
   type there (724 lines). Never invent a parallel shape.
3. **The two-step rule.** `POST /plan` and `POST /assign/auto` write nothing until a
   second explicit apply call. Any UI that breaks this is a bug.
4. **Reviews go to the teacher, not the reviewee.** That is a design decision.
5. **Board lanes are people, not statuses.** Status lives on the card.
6. **No hard-coded numbers in JSX.** Every figure on screen is computed by an engine.
   House rule: *no invented proof.*
7. **Radius 0 everywhere.** Circles only for avatars and the even-share tick.
8. **Both schemes must work** (`data-scheme="paper"` and `"ink"`). Check ink on
   every screen.
9. **Reuse the primitives.** See `docs/03-design-system.md`. `LoadBar` is the
   signature component and must look the same on every surface.
10. **A stub is never acceptable in a delivery.** No route may render `<Pending>`.

## Definition of done (the finish line)

- [ ] `npx tsc --noEmit` clean.
- [ ] No route renders `<Pending>`; `src/routes/_pending.tsx` deleted.
- [ ] `scripts/inspect.mjs` returns `problems: []` for every route, at 1440 **and** 390.
- [ ] Both schemes checked on every screen.
- [ ] Every screen updates live over `/events` (act in one browser, watch another).
- [ ] Every number shown comes from an engine.
- [ ] `README.md` exists and is accurate.

## Working rules that save time

## Working rules that save time

```bash
cd "E:/Hackathons/Neighborhood Hacks/equita"
npm run dev                                    # API :8787 + Vite :5173
npx tsc --noEmit                               # after every file
node scripts/smoke.mjs                         # every endpoint a screen needs
MSYS_NO_PATHCONV=1 node scripts/shoot.mjs teacher .shots <route>
MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher <route>
EQUITA_WIDTH=390 EQUITA_SCHEME=ink MSYS_NO_PATHCONV=1 node scripts/inspect.mjs teacher <route>
npm run build                                  # before a delivery
node scripts/encscan.mjs                       # must print "clean"
```

- Run `MSYS_NO_PATHCONV=1 node scripts/shoot.mjs teacher .shots <route>` after every
  screen. **The `MSYS_NO_PATHCONV=1` prefix is mandatory** on Windows/Git Bash or the
  leading `/` is rewritten into a filesystem path.
- Read `.shots/report.json` → `problems`. It is the mechanical substitute for
  "looks fine to me".
- Kill any process on port 8787 before you debug an unchanged screen. A stale server
  silently serves pre-edit code.
- Sometimes a component `return`s `null` while a request fails; that hides a crash as
  a blank page. Render a visible error state instead (see `docs/06-traps.md`).
- Write large files in chunks. The `write` tool can drop `path` on very large payloads,
  and a truncated write once deleted `index.html`.
- `git` was never initialised. **Run `git init` and commit before a large refactor**
  (see `TODO.md` → P0-1).

## Update the docs as you go

The point of this doc system is that no agent has to reconstruct state twice.

- Tick items in `TODO.md` and add anything you discover as a new item.
- Add any new trap to `docs/06-traps.md` the moment you fix it.
- When you build a screen, update its row in `docs/00-state.md`.
- If you make a decision that others will question, record it in `docs/10-decisions.md`.
- If you change a screen's data needs, update `docs/02-api.md`.
- If a check passes because you looked at a screenshot, say so honestly — and then click it.