# Equita — roadmap

The hackathon build is complete enough for submission. This roadmap now separates the verified submission surface from responsible next steps instead of listing already-built screens as unfinished.

## Submission surface

The current product loop is:

```text
brief → sized tasks → skill/capacity allocation → live fairness reading
     → explainable suggestion → human approval → refreshed state
```

The teacher path adds:

```text
class roster → coverage-aware group proposal → human adjustment
             → committed project boards → class attention
```

The student path keeps the same fairness model without requiring a class or teacher.

## Highest-value next work

1. **Evidence:** run a small, consented classroom pilot and report what changed. The current seed demonstrates computation, not impact evidence.
2. **Accessibility:** add automated contrast checks, full keyboard tests for tabs and drag-enhanced surfaces, and screen-reader review.
3. **Trust:** make privacy, retention, consent, and “conversation aid, not grade” language configurable for schools.
4. **Reliability:** add CI on a clean Linux machine that runs `npm ci`, `make test`, the build, and the browser harness.
5. **Product depth:** add print-friendly project briefs and teacher export only after the core intervention loop has real-world feedback.

## Guardrails

- Keep the five-minute teacher demo short and legible.
- Preserve the preview-then-apply rule for planner, allocator, and rebalance actions.
- Keep the seeded stories deterministic in structure and label them as demo data.
- Do not turn fairness scores into grades or disciplinary automation.
