# Equita — Neighborhood Hacks judge brief

## Verdict

**Strong finalist and credible prize contender.** Equita is unusually specific about a
real classroom problem: the invisible labour of group projects. It does not stop at a
dashboard. It plans work in hours, matches tasks to skills and capacity, makes the even
share visible, explains an intervention, and records what changed.

The main limitation is evidence, not product depth: the community stories and impact
history are seeded demonstrations rather than measurements from a real classroom pilot.
That should be said plainly in the presentation.

## Provisional rubric score

| Criterion | Weight | Score | Judgement |
| --- | ---: | ---: | --- |
| Community relevance | 25% | **22/25** | A concrete, familiar school problem with teacher and student views; no real user-research evidence yet. |
| Impact potential | 20% | **18/20** | Detect → explain → human approval → refreshed result is a real intervention loop. |
| Technical execution | 20% | **18/20** | React/Vite + Express/SQLite, live SSE updates, explainable engines, Docker, lockfile, offline checks. |
| Creativity | 15% | **14/15** | The even-share tick, people-based lanes, and brief-as-interface are memorable and coherent. |
| Presentation & clarity | 10% | **9/10** | Strong visual language, reproducible dataset, and a one-link teacher demo path. |
| Accessibility | 10% | **8/10** | Responsive paper/ink schemes, labelled fields, keyboard assignment path, and visible focus states; full automated contrast and tab-widget testing remain. |
| **Total** | **100%** | **89/100** | **Finalist / prize contender** |

## The judge demo

Open `/login?demo=teacher`, then show:

1. **Today** — the teacher's view is about class attention, not an empty personal task list.
2. **Class console → Attention** — open the student who is carrying or falling behind.
3. **Project → Fairness** — point to the score, its five weighted parts, the load bars, and the proposed move.
4. **Apply one move** — the intervention receipt separates the score before, fresh score after, task moved, and engine projection.

The story to say out loud is:

> Group work problem → visible imbalance → explainable recommendation → human-approved intervention → measurable refreshed state.

## What would raise the score next

- Add one real educator or student quote, or a small pilot result, without presenting invented
  demo data as field evidence.
- Complete the two-browser live-update and full 390px/ink route sweeps.
- Add automated contrast and keyboard interaction checks for the remaining composite widgets.
- Explain classroom privacy, retention, and who can see student-level attention in the pitch.
