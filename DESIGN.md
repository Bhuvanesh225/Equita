# Equita — design record

Written before building. Everything downstream references these decisions.

## The subject

Equita is a project coordination platform for students and schools. Its whole reason to exist is
**evenness**: work split so nobody carries the group, and a teacher able to see it.

Inventory of what only this subject has:

- its name: *equity* — fairness expressed as a number, a share, a remainder
- the numbers it produces: effort points, each person's share, the even share, the gap
- the artefact every student has actually held: **the group project brief** — a sheet with a course
  code, a deadline, a task table, a rubric and a signature line
- the other artefact every teacher has held: **the class list** — names in a column, a mark beside each
- the constraint it lives with: a term is fixed, a deadline does not move, a grade is shared
- its rituals: the first meeting where nobody volunteers, the night before, the peer review
- its materials: paper, graph paper, the timetable, the rubric, the allocation table
- its opposite: the passive checklist (Trello, Docs) that records work but never distributes it

## Direction (taste-skill `draw.mjs`, seed 68106341)

**`page-is-the-object`** for the marketing page. The page is the brief: paper on a contrasting
ground, print-like alignment, filled shapes with real edges, the allocation table as the centrepiece,
the footer as the back of the card.

**Idea sentence.** On this page, **the project brief handed out in class** becomes **the page itself** —
and the row of equal segments it carries (the *share bar*) becomes the mark of the whole product.

Competitor test: put Trello in the sentence and it breaks — Trello has no brief, no class list, no
share. It is Equita's.

**Live thing.** The allocator, embedded where the brief's task table belongs: enter a few classmates
and their strengths, add tasks, and watch the allocation even itself out. Real content, real maths,
works with a thumb, plain fallback.

### Redraws and adaptations, with reasons

| Slot | Change | Reason |
| --- | --- | --- |
| hero right half | real product interface (live, interactive) instead of a photograph of a room | the honest image of software is its own interface; a photograph here would be costume |
| hero stripe band | the band's bars become the **share bar** — equal segments, one held in ink | derives the ornament from the subject's own idea (equal division) instead of an invented ribbon |
| section 4 `proof` | prints the **class list** from real demo data, not invented testimonial names | house rules forbid invented proof; a class list is the subject's real artefact and demo data can be labelled as such |
| section 1 `features` | sheets carry a real interface fragment, not a photograph | same reason as the hero; keeps the stack geometry |
| motion | the slow crossfade runs across three **real app views** | the blueprint's "light shifting in a room" applied to the only principal image this product has |
| scalloped footer edge | kept | it is the shaped edge that makes the panel an object |

## Tokens

One ground, one ink, one accent, three signal colours, one member palette (functional, for identity).

- ground `--paper #FBFAF8` (brand continuity) · recessed `--paper-2 #F3F1EC` · surface `#FFFFFF`
- ink `--ink #14171A` · secondary `#4C5451` · meta `#6C7570`
- accent `--accent #0B7A63` (brand green→teal, deepened for 4.5:1 on paper)
- signals `--ok` accent · `--over #9A5A08` · `--risk #AD2418` (meaning, never decoration)
- member palette: eight desaturated hues, each ≥3:1 against both grounds
- **radius 0 everywhere.** Panels, cards, buttons, inputs. Circles only for avatars and the
  even-share marker. Decided once, applied once.
- no shadows except overlays (menu, dialog, command palette). Surfaces step in tone, never in lines.
- type: **Bricolage Grotesque** (display) + **Inter** (UI text, tabular figures). Two families.
- five steps on the marketing page, an app scale (13→30) inside the product, where density is the point.

## The signature component

The **load bar**: a member's effort share drawn against the even share, with a tick at the even
position. Repeated in the dashboard, the project panel, the class console and the landing page, so
the product has one mark instead of many.

## Type scale

| Step | Marketing | App |
| --- | --- | --- |
| display | clamp(2.6rem, 5.2vw, 4.9rem) | — |
| xl | clamp(1.75rem, 2.6vw, 2.5rem) | 30/24 |
| lg | 1.25rem | 20 |
| md | 1rem | 16 |
| sm | 0.8125rem (floor) | 13 |
| xs | — | 12 (labels only, non-essential) |