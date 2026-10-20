# Equita — submission checklist

This is the live, small checklist for the submission. Historical build phases are preserved in git history; they are not repeated here as if they were unfinished.

## Before handing it in

- [x] Runtime pinned in `.nvmrc`.
- [x] `package-lock.json` committed and dependencies installed with `npm ci`.
- [x] Dockerfile builds the client and runs the API/client on one port.
- [x] `.env.example` documents optional configuration without secrets.
- [x] `README.md` covers setup, run, test, deploy, judge flow, architecture, seed limits, and accessibility.
- [x] No route renders `<Pending>`.
- [x] Browser scripts use the project-local Playwright dependency; no machine-specific paths remain.
- [x] Dashboard, project, classroom, group-builder, student, fairness, profile, notification, settings, and landing flows are implemented.
- [x] Group builder has a non-drag **Move to…** keyboard path.
- [x] API smoke, offline integration, write-path, SSE, and encoding checks pass.
- [x] Desktop and 390px browser audits pass for the primary teacher routes.
- [ ] Walk through the five-minute judge path immediately before submission.
- [ ] If presenting live updates, open teacher and student sessions side by side and demonstrate one update.

## Deliberate post-submission work

- Add automated contrast assertions and a full keyboard regression suite for composite widgets.
- Gather real student/educator feedback or pilot evidence; never replace the seeded-demo disclosure with invented proof.
- Add production privacy, retention, consent, and school-admin controls.
- Consider removing `legacy/` once its historical value is no longer useful.
