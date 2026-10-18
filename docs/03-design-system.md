# 03 — Design system

`DESIGN.md` is the pre-build record and wins on direction. This file is the **inventory
of what already exists** — use it instead of inventing a new primitive, a new colour, or
a new class name.

## Direction, in one line

**`page-is-the-object`**: the marketing page *is* the project brief handed out in class;
the allocation table is its centrepiece. Seed 68106341. In the app, the equivalent is
that a project workspace *is* the brief — the board replaces the task table.

## Rules that are never negotiated

- **Radius 0 everywhere.** Panels, cards, buttons, inputs. Circles only for avatars and
  the even-share tick (`--radius-full`).
- **No shadows** except overlays (menu, dialog, drawer, palette). Surfaces step in
  **tone**, never in lines.
- **Colour carries meaning only.** The signal colours are not decoration.
- **The load bar is the signature.** One mark, everywhere, identical.
- **One scheme variable.** `data-scheme="paper" | "ink"` on `<html>`, set pre-paint in
  `index.html` from `localStorage["equita.scheme"]`. Everything must work in both.
- **Tabular figures for numbers** (`.tnum`), always, so columns line up.

## Tokens (`src/styles/theme.css`)

| Token | paper | ink |
| --- | --- | --- |
| `--color-paper` | `#fbfaf8` | `#14171a` |
| `--color-paper-2` | `#f3f1ec` | `#1b2023` |
| `--color-paper-3` | `#e9e6df` | `#232a2d` |
| `--color-surface` | `#ffffff` | `#191e21` |
| `--color-ink` | `#14171a` | `#f2f1ed` |
| `--color-ink-2` | `#4c5451` | `#b6bcb8` |
| `--color-ink-3` | `#6e756f` | `#8c938f` |
| `--color-line` | `#dedad2` | `#2c3437` |
| `--color-line-strong` | `#c8c3b9` | `#3d474a` |
| `--color-accent` | `#0b7a63` | `#3ecfa6` |
| `--color-accent-soft` | `#e2efeb` | `#143029` |
| `--color-over` | `#9a5a08` | `#e2ac52` |
| `--color-over-soft` | `#f7ecda` | `#352a15` |
| `--color-risk` | `#ad2418` | `#f28f83` |
| `--color-risk-soft` | `#f8e4e1` | `#3a201d` |
| `--color-quiet` | `#4a5560` | `#a8b1b6` |
| `--color-quiet-soft` | `#e8eaec` | `#262d31` |

Always reference `var(--color-…)`. **Never** a hex value in a component, except inside
the landing page's artwork where a photograph needs a fixed overlay.

Type: `--font-display` (Bricolage Grotesque) for headings and figures of speech;
`--font-sans` (Inter) for UI. App scale: `--text-xs .75` · `--text-sm .8125` ·
`--text-base .9375` · `--text-md 1` · `--text-lg 1.25` · `--text-xl 1.5` · `--text-2xl 1.875`.

`DESIGN.md` says the floor is 13px and 12px is for labels only, non-essential. Respect it:
`inspect.mjs` flags anything smaller.

## Primitives (`src/components/ui.tsx`)

| Component | Props | Notes |
| --- | --- | --- |
| `Avatar` | `{name, hue, size?: "sm"\|"md"\|"lg", title?}` | initials on a hue-tinted circle |
| `AvatarGroup` | `{people: [{id,name,hue}], max=5}` | overflow becomes `+n` |
| `MemberDot` | `{hue, tone?}` | the small identity dot in a feed row |
| `Tag` | `{children, tone?: Tone, dot?, edge?, title?}` | `edge` = outline form, `tone` = filled |
| `StateChip` | `{state, hours?}` | member state → label + tone. **Use this, not raw text, for `on-track/carrying/behind/overloaded/quiet`** |
| `Kbd` | `{children}` | keyboard hint |
| `Spinner` | `{label?}` | renders a `.row.spinner` — the screenshot harness waits on it |
| `Panel` | `{title?, hint?, actions?, children, foot?, className?, bodyClassName?, flush?, recessed?, stacked?, as?}` | `stacked` puts the hint on its own line (use in narrow cards); `flush` = no body padding |
| `Stat` | `{value, label, note?, tone?, size?: "md"\|"sm"}` | a big number with a caption |
| `Field` | `{label, hint?, error?, htmlFor?, children, required?}` | wraps inputs; renders `role="alert"` on error |
| `EmptyState` | `{title, text, action?, compact?}` | **every empty list uses this or `Quiet`** |
| `Segmented` | `{options:[{value,label,title?}], value, onChange, ariaLabel}` | generic T; `role="group"` |
| `LoadBar` | `{name, hue?, hours, even, capacity?, leftLabel?, valueLabel?, scaleMax?, showScale?, caption?}` | **the signature.** Tick = even share. Tone is automatic (`risk` over capacity, `over` >1.25×even, `under` <0.72×even) |
| `ShareBar` | `{segments:[{id,name,hue,hours}], unassigned?, showLegend?, height?}` | the whole group in one bar; `sharebar--even` when the split is even |
| `Meter` | `{label, value, mark?, tone?, showValue?, hint?}` | 0–100 with automatic tone; `mark` draws a guide tick |
| `ScoreDial` | `{score, label?, size=108, tone?}` | ring. **Used once per screen at most** (equity panel) |
| `ProgressLine` | `{value, expected?, label?}` | work closed vs time elapsed, as two separate facts |
| `BlockGrid` | `{rows, columns, values, tone?, title?}` | member × week heat table |
| `styleVars` | `(vars) => CSSProperties` | for CSS custom properties in `style` |

## Blocks (`src/components/blocks.tsx`)

| Component | Props | Notes |
| --- | --- | --- |
| `PageHead` | `{kicker?, title, sub?, actions?, tabs?}` | **every app screen starts with this** |
| `PhaseTag` | `{phase}` | discover/define/build/review/ship → human names |
| `StatusTag` | `{status, title?}` | todo/doing/review/blocked/done, with dots where they mean something |
| `DueMark` | `{dueAt, done?}` | whole days only; risk colour when late |
| `ScoreMark` | `{score, gini?, label?}` | the small inline fairness mark for a header |
| `FlagList` | `{flags: EquityFlag[], limit=4}` | collapses long lists behind "and n more" |
| `flagTitle(kind)` | — | maps a flag `kind` to its human label |
| `Nudges` | `{nudges, empty?, compact?}` | **the only way to render nudges.** Renders `action.href` as a `Link` — see the broken-href note in `docs/00-state.md` |
| `ActivityFeed` | `{activity, limit=12, showPerson=true}` | ordered list of `rowitem`s |
| `PersonRow` | `{person:{id,name,hue,state?}, hoursOn?, even?, right?, note?, to?}` | `to` makes the whole row a link |
| `TaskRow` | `{task, href?, showAssignee=true, right?, meta?}` | the dense list form |
| `TaskCard` | `{task, href?, dragging?, handleProps?, onOpen?}` | the board card form (dnd-kit props) |
| `useTaskMoves(refresh)` | — | **the one way to move a task.** Returns `{move, assign, logHours, busy, dialog}`; `dialog` is a `Confirm` you must render, and it handles the `409 needs-review` refusal |
| `Quiet` | `{children}` | one grey sentence for an empty slot |
| `PanelOf` | `{title, hint?, children, foot?, actions?}` | `Panel` in the older shape |

## Charts (`src/components/charts.tsx`)

All are hand-drawn SVG, no dependency.

| Component | Props |
| --- | --- |
| `LineChart` | `{series: [{id,name,color,points:[{label,value}]}], height?, min?, max?, rules?:[{value,label}], yFormat?, area?, ariaLabel}` |
| `BarChart` | `{items:[{label,value,title?,tone?}], height?, max?, format?, tone?, ariaLabel, highlight?}` |
| `Sparkline` | `{values: number[], tone?, width?, height?}` |
| `ComparisonBars` | `{items:[{id,label,value,tone?,note?,href?}], max?, format?, ariaLabel}` |
| `RatioPill` | `{part, whole, label}` |

Every chart takes `ariaLabel` and is `role="img"`. Pass a real sentence.

## Overlays (`src/components/overlays.tsx`)

| Component | Props | Notes |
| --- | --- | --- |
| `Dialog` | `{open, onClose, title, sub?, children, footer?, width?: narrow\|md\|wide, labelledBy?}` | focus trap + Escape + scroll lock handled |
| `Drawer` | `{open, onClose, title, sub?, children, footer?, side?}` | the task sheet uses this |
| `Menu` | `{label, items:[{label,onSelect,danger?,hint?,disabled?}], align?, icon?, className?}` | the only dropdown primitive |
| `Confirm` | `{open, onClose, onConfirm, title, body, confirmLabel, danger?, busy?}` | for destructive or rule-refusing actions |
| `CloseIcon` | — | — |

**Overlays position themselves.** Do not add shadows, radii, or z-indexes of your own.

## Furniture classes (use these before writing styles)

`src/styles/app.css` (layout + form + charts): `.page`, `.shell`, `.grid`, `.grid--stats`,
`.grid--split`, `.stack`, `.stack--loose`, `.stack--tight`, `.row`, `.row--between`,
`.row--wrap`, `.spacer`, `.panel*`, `.stat*`, `.tag*`, `.btn` (+ `--primary --outline
--ghost --ink --danger --icon --sm --lg`), `.btn-group`, `.field*`, `.input`, `.select`,
`.textarea`, `.range`, `.switch`, `.search`, `.avatar*`, `.loadbar*`, `.sharebar*`,
`.meter*`, `.week*`, `.page-head*`, `.tabs`/`.tab`, `.section-title`, `.checkin-mood*`,
`.tx-{accent,ink,over,risk,quiet}`, `.label` (the small caps label), `.tnum`, `.truncate`,
`.clamp-2`, `.clamp-3`, `.nowrap`, `.visually-hidden`, `.scroll-x`, `.skip-link`.

`src/styles/surfaces.css` (surfaces + overlays): `.app`, `.board`, `.lane*` (`.lane--active
--over --nobody`), `.card*` (`.card--blocked --done --ghost --picked --review`),
`.rowitem*` (`.rowitem--overdue --compact`), `.rows`, `.table`, `.table--num`, `.table-wrap`,
`.chip`/`.chip--accent`, `.callout`/`.callout--{accent,over,risk}`, `.flag*`, `.empty*`,
`.donut*`, `.progress-line*`, `.chart*`, `.live*`, `.palette*`, `.copilot*`, `.rail*`,
`.topbar*`, `.mobile-nav*`, `.toast*`, `.menu*`, `.dialog*`, `.drawer*`, `.scrim*`,
`.tip`, `.kbd`, `.dot*`, `.seg*`, `.scoremark`, `.drag-overlay`.

`src/styles/theme.css` defines the tokens and the Tailwind `@theme` bridge.
`src/styles/landing.css` and `auth.css` are scoped to `/` and the auth screens — do not
reach into them from app screens.

## Formatting helpers (`src/lib/format.ts`)

Use these and nothing else for text that shows a number or a date.

`hours(n)` → `"3.5h"` · `hoursValue(n)` · `pct(n)` → `"62%"` · `pctOf(part, whole)` ·
`round1` · `plural(n, one, many?)` · `listJoin(items, conjunction?)` · `dateLabel` ·
`fullDate` · `dateInput` (for `<input type="date">`) · `daysUntil` · `dueLabel` ·
`relativeTime` · `clockTime` · `initials` · `hueStyle(hue)` · `shareSentence(name, hoursOn,
evenShare)` · `describeGini(gini)`.

Maps: `PHASE_NAMES`, `STATUS_NAMES`, `STATE_NAMES`, `MOOD_NAMES`.
Tone helpers: `stateTone(state)`, `scoreTone(score)`, `severityTone(severity)`,
`toneClass(tone)`, `toneTextClass(tone)`, `toneVar(tone)`.

`Tone = "accent" | "over" | "risk" | "quiet" | "ink"`.

## The two marks, drawn correctly

```tsx
// one person against the even share
<LoadBar name={member.name} hue={member.hue} hours={load.credited}
         even={load.even.credited} capacity={load.remainingCapacity}
         caption={load.owedCreditedHours > 0 ? `${hours(load.owedCreditedHours)} behind their share` : "ahead of their share"} />

// the group in one bar
<ShareBar segments={members.map(m => ({ id: m.id, name: m.name, hue: m.hue, hours: m.credited }))}
          unassigned={equity.totals.unassigned} showLegend />
```

## Screen composition recipe

Every app screen follows the same skeleton — copy it from an existing screen
(`src/routes/Projects.tsx` is the shortest complete example, `Dashboard.tsx` the richest):

1. `useApi<T>("/api/…")`.
2. `if (loading && !data)` → `.page` + `Spinner label="…"`.
3. `if (error || !data)` → `.page` + `EmptyState` with a retry (`refresh`) and a way out.
4. `<div className="page">` → `PageHead` → `grid`/`stack` of `Panel`s.
5. Every list has an empty branch — `EmptyState` for a whole screen, `Quiet` for a slot.
6. Every write goes through `useAction`/`useTaskMoves` + `useToast`.