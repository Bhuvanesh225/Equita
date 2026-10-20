# 04 — Conventions

Patterns every existing screen already follows. Matching them is what makes a new screen look like it was always there. Read one built screen end to end before writing anything: `src/routes/Projects.tsx` (369 lines) is the smallest complete example; `src/routes/Dashboard.tsx` (609) is the richest.

## Screen Skeleton

```tsx
/**
 * A comment block at the top that says what the screen is for, in prose, and why
 * the decisions in it are the way they are. Every built screen in this repo has
 * one. Match the tone: plain sentences, no marketing.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { post, patch } from "../lib/api";
import { useApi, useToast, useAction } from "../lib/live";
import { hours, plural } from "../lib/format";
import { EmptyState, Panel, Spinner, Stat } from "../components/ui";
import { PageHead, Quiet } from "../components/blocks";
import type { Thing } from "../lib/types";

export default function Screen() {
  const { data, loading, error, refresh } = useApi<{ things: Thing[] }>("/api/things");

  if (loading && !data) return <div className="page"><Spinner label="Reading the …" /></div>;

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="That did not load"
          text={error ?? "It may have been deleted, or it may not be yours to see."}
          action={<>
            <button type="button" className="btn btn--outline" onClick={refresh}>Try again</button>
            <Link className="btn btn--primary" to="/today">Back to today</Link>
          </>}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead kicker="…" title="…" sub="…" actions={…} />
      <div className="grid grid--split">…</div>
    </div>
  );
}
```

Non-negotiable parts: **first-load only spinner** (`loading && !data`, so a live refresh never blanks the screen), **a visible error state** (never `return null`), and **a way out of it** (`refresh` plus a `Link`).

## Data

- `useApi<T>(path, opts?)` → `{data, error, loading, refreshing, refresh, setData}`. `live: true` by default — it refetches on every server event, so **live updates are free for any screen that uses it**. `poll: ms` if you ever need a timer. `path` may be `null` to defer (used for role-gated endpoints, e.g. `Reviews.tsx`).
- Writes: `post`, `patch`, `put`, `del` from `src/lib/api.ts`. `qs({...})` builds query strings and drops empty values.
- **Every failure is an `ApiError`** with `message` written for a person. Render `error.message`. Use `err.isInput` when the right response is to point at a field.
- **After a write, call `refresh()`** (or `setData`). The SSE event will also trigger a refetch, but calling `refresh()` makes the change land immediately.
- `useAction()` → `{run, busy, error}` for one-off writes. `run(() => post(...))` sets `busy`, catches, and rethrows so you can decide whether to toast.
- `useToast()` → `{push, dismiss}`. `push({title, detail?, tone: "neutral"|"good"|"bad", action?})`. Errors stay 9s; everything else 4.5s.

## Moving a Task — Use the Existing Hook

`useTaskMoves(refresh)` from `src/components/blocks.tsx` is the only correct way to change a task's status, assignee or hours. It already enforces:

- the confirm that a `409 needs-review` refusal needs (the server will not let the assignee close a review-gated task),
- the "say what it is blocked on" requirement,
- the hours ledger entry when logging time,
- the toast wording.

```tsx
const moves = useTaskMoves(refresh);
// …
<button onClick={() => moves.move(task.id, "doing")}>Start</button>
<button onClick={() => moves.assign(task.id, member.id)}>Give it to {member.name}</button>
<button onClick={() => moves.logHours(task.id, 2.5)}>Log 2.5h</button>
{moves.dialog}   {/* ← render this, always */}
```

## The Two-Step Rule

Anything that writes a plan or an allocation is two calls:

1. Preview: `POST …/plan` or `POST …/assign/auto {apply:false}` → a proposal object.
2. Apply: `POST …/plan/apply` or `POST …/assign/auto {apply:true}` → the write.

The UI must **show** the proposal and let a person confirm it. `src/routes/project/Plan.tsx` is the reference: `PlanDialog` is a two-step dialog (brief → ticked tasks), `AutoAssignDialog` shows before/after balance and the placements. Never collapse the two calls into one.

## Role Gating

`workspace.viewer` / `classroom.viewer` tell you what a person may do: `{id, role, isLead, canTeach}` (project) and `{id, isTeacher, role}` (classroom).

- Gate the button, not just the request. `disabled={!viewer.isLead}`.
- A student may see a class, but may only open their own student record (the server enforces it, `403` otherwise).
- Reviews: a student writes a review of a peer; the aggregated summary is teacher-only.

## Identity and Session

`useSession()` gives `{user, skills, memberships, counts, clusters, top, loading, error, refresh, signIn, signUp, enterDemo, signOut, saveProfile, saveSkills, joinClass}`.

- **`saveProfile` and `saveSkills` already exist** — `/profile` and `/settings` must use them rather than calling the API directly, so the shell's copy stays in step.
- `counts` drives the rail badges. Anything that changes unread/projects should not need to update it — the session refetches on live events.
- Appearance: the light paper palette is fixed before first paint in `index.html`. The UI shell state (command palette open, nav) is `useUi()`.

## Routing

- Every screen is `lazy()` in `src/App.tsx` and wrapped with `page(<X />)`.
- Signed-in routes live inside the `<Guarded />` route, `*` last.
- **Screen state lives in the URL**, not in React state: `?tab=`, `?view=`, `?task=`, `?q=`. `ProjectWorkspace` and `Projects` both do this so a link is shareable and back works. Use `useSearchParams` + a `setParam(key, value|null)` helper.
- Unknown routes render `NotFound`, which names what was being looked for and offers two or three plausible destinations. Keep that behaviour.

## Formatting

Anything that displays a number or date uses `src/lib/format.ts`. Do not write `${n}h`, `.toLocaleDateString()` or `Math.round` inline — `hours`, `plural`, `pct`, `dateLabel`, `dueLabel`, `relativeTime` already handle the edge cases (null dates, singular/plural, the 13px floor).

Add `.tnum` to any number in a column.

## Copy

- Sentence case, plain, British English (`colour`, `organisation`, `hand in`).
- **No invented proof.** A number appears only if an engine computed it. A sentence that claims a fact must be traceable to a field.
- Prefer the engine's own prose: `equity.headline`, `nudge.body`, `nudge.title`, `studentRecord.reading`, `copilot.answer`. Do not paraphrase them into a second summary line — two sentences saying the same thing in different words is the most common defect in this codebase's draft state.
- Empty states explain *why* the thing is empty and what to do, e.g. "Naming a skill is what lets the allocator match people to work."
- Never say "Oops", "Something went wrong" alone, or "No data".

## TypeScript

- `strict`, `noUnusedLocals`, `noUnusedParameters` are on. Remove unused imports — the previous session lost time to exactly this.
- `npx tsc --noEmit` after **every** file. It is fast and it is the gate.
- Import types with `import type { … }` where they are only types.
- Do not add `any`. If the API shape is not typed, add it to `src/lib/types.ts` first.

## Files and Size

- One screen per file in `src/routes/`, panels that only make sense inside one screen in `src/routes/<screen>/`. Existing example: `src/routes/project/`.
- **Keep each `write` payload modest.** Very large writes can drop `path`, and a truncated write once destroyed `index.html`. Write a big file in two or three passes.
- Add a top-of-file comment block. Every existing file has one; it is the house style.

## Accessibility (Already Enforced by `inspect.mjs`)

- Icon-only buttons need `aria-label`.
- Interactive elements are `<button>` or `<Link>`, never a click handler on a `<div>`.
- Hit targets ≥ 24px in both axes (`.btn--sm` and `.btn--icon` satisfy this — do not hand-roll a smaller one).
- Charts and bars take a real `ariaLabel` sentence.
- `role="tab"` needs `aria-selected`; `Segmented` needs `ariaLabel`.
- Never rely on colour alone: pair a signal colour with a word or a `dot`.