# Project handoff

This file is intentionally short. The original multi-session handoff became a second, stale source of truth as the app was completed.

Read these current documents instead:

1. [`README.md`](README.md) — run, test, deploy, judge path, limitations.
2. [`AGENTS.md`](AGENTS.md) — repository contract and non-negotiables.
3. [`docs/00-state.md`](docs/00-state.md) — verified state and known limits.
4. [`docs/05-verification.md`](docs/05-verification.md) — browser and API checks.
5. [`docs/hackathon-judgement.md`](docs/hackathon-judgement.md) — rubric judgement and presentation plan.

The repository is a React 19 + Vite 8 + TypeScript client with an Express 5 + SQLite server. Node `24.16.0` is pinned in `.nvmrc`; use `npm ci` and `make test` on a clean checkout.
