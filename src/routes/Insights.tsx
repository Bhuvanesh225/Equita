/**
 * Fairness, as a subject.
 *
 * `/today` answers "what needs me in the next few days". This screen answers a
 * different question: how evenly is the work being shared across everything this
 * person can see, and is that getting better or worse. It is the screen the
 * marketing page's claims have to survive, so nothing here is asserted — every
 * figure is read out of the dashboard payload, and the one sentence that reads
 * like an opinion is `equity.headline`, which the engine wrote.
 *
 * The score is a weighted average of five measures, and a weighted average
 * nobody can see is a number nobody can argue with, so the weights are printed
 * beside each part. They travel in the payload (`equity.weights`) rather than
 * being hard-coded here, because a class can be given its own fairness policy.
 *
 * One request for the whole page. The per-class figures come from the same
 * dashboard `classes` block for the headline numbers, and one slim
 * `/analytics` call per class for the per-group comparison — the console's own
 * endpoint, reused rather than re-derived (see docs/10-decisions.md D-02).
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useApi } from "../lib/live";
import { hours, plural, pct, severityTone } from "../lib/format";
import { EmptyState, Meter, Panel, ScoreDial, ShareBar, Spinner, Stat, Tag } from "../components/ui";
import { Nudges, PageHead, PersonRow, Quiet } from "../components/blocks";
import { ComparisonBars, LineChart } from "../components/charts";
import { IconArrowRight, IconScales } from "../components/icons";
import type { Classroom, Dashboard, EquityParts } from "../lib/types";
import { PART_LABELS } from "./project/Equity";
import { ClassPanel, StudentClasses } from "./insights/Classes";

type Card = Dashboard["cards"][number];

export default function Insights() {
  const { data, loading, error, refresh } = useApi<Dashboard>("/api/insights/dashboard");
  const classList = useApi<{ classrooms: Classroom[] }>("/api/classrooms");

  if (loading && !data) {
    return (
      <div className="page">
        <Spinner label="Reading every group at once" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="The fairness reading did not load"
          text={error ?? "It is one request over every group you can see, so a failure here is the whole picture rather than one panel."}
          action={
            <>
              <button type="button" className="btn btn--outline" onClick={refresh}>
                Try again
              </button>
              <Link className="btn btn--primary" to="/today">
                Back to today
              </Link>
            </>
          }
        />
      </div>
    );
  }

  const dashboard = data;
  const cards = dashboard.cards.filter((card) => card.equity);
  const classes = dashboard.classes;
  const mine = cards.filter((card) => card.mine);
  const unclaimed = cards.filter((card) => card.unassigned > 0);
  const teacher = dashboard.user.role === "teacher";
  const studentClasses = (classList.data?.classrooms ?? []).filter((entry) => entry.role !== "teacher");
  const classListReady = teacher || !!classList.data;
  const nothingAtAll = classListReady && !cards.length && !classes.length && !studentClasses.length;

  return (
    <div className="page">
      <PageHead
        kicker="Fairness"
        title="Fairness"
        sub="Five weighted measures of how evenly the work is shared and how much of it has actually landed."
        actions={
          cards.length ? (
            <Link className="btn btn--outline" to="/projects">
              All your groups
              <IconArrowRight size={13} />
            </Link>
          ) : null
        }
      />

      {nothingAtAll ? (
        <Panel title="Nothing to measure yet">
          <EmptyState
            title="You are not in a group yet"
            text={
              teacher
                ? "Start a class, or a group of your own, and this page fills in with what the fairness engine can see. Every number here comes from work people actually logged."
                : "Fairness is a reading of work that exists. Make a group with two or three people, give it a deadline, and this page starts telling you something."
            }
            action={
              <>
                <Link className="btn btn--primary btn--sm" to="/projects/new">
                  Start a group
                </Link>
                <Link className="btn btn--outline btn--sm" to="/classrooms">
                  Your classes
                </Link>
              </>
            }
          />
        </Panel>
      ) : null}

      {cards.length ? <ScorePanel cards={cards} /> : null}
      {cards.length ? <GroupsPanel cards={cards} dashboard={dashboard} hasMine={mine.length > 0} /> : null}
      {unclaimed.length ? <UnclaimedPanel cards={unclaimed} /> : null}
      {dashboard.trend.length >= 2 ? <TrendPanel dashboard={dashboard} /> : null}

      {classes.length ? (
        <div className="stack stack--loose">
          <h2 className="section-title">
            Every class you teach
            <span className="label">{classes.length}</span>
          </h2>
          {classes.map((entry) => (
            <ClassPanel key={entry.id} summary={entry} />
          ))}
        </div>
      ) : null}

       {!teacher && classList.loading && !classList.data ? (
         <Panel title="Your classes">
           <Spinner label="Reading your classes" />
         </Panel>
       ) : null}

       {!teacher && classList.error ? (
         <Panel title="Your classes">
           <EmptyState
             title="Your classes did not load"
             text={classList.error}
             action={
               <button type="button" className="btn btn--outline btn--sm" onClick={classList.refresh}>
                 Try again
               </button>
             }
           />
         </Panel>
       ) : null}

       {!teacher && classList.data && studentClasses.length ? <StudentClasses classrooms={studentClasses} /> : null}

      <HandPanel dashboard={dashboard} />
    </div>
  );
}

/* ---------- the score, and what it is made of ---------------------------- */

/**
 * The mean of the parts across every group in view, and the weights that turn
 * them into a score. Both are averages of engine output rather than a second
 * opinion about fairness, and the labels say so.
 */
function ScorePanel({ cards }: { cards: Card[] }) {
  const { meanScore, meanParts, weights, mixedWeights } = useMemo(() => {
    const scored = cards.filter((card) => card.equity).map((card) => card.equity!);
    const keys: Array<keyof EquityParts> = ["balance", "delivery", "spread", "engagement", "readiness"];
    const avg = (read: (entry: (typeof scored)[number]) => number) => scored.reduce((sum, entry) => sum + read(entry), 0) / Math.max(1, scored.length);

    const parts = Object.fromEntries(keys.map((key) => [key, avg((entry) => entry.parts[key])])) as unknown as EquityParts;
    const sets = scored.map((entry) => entry.weights).filter((set): set is EquityParts => !!set);
    const weights = Object.fromEntries(
      keys.map((key) => {
        const values = sets.map((set) => set[key]);
        return [key, values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0];
      }),
    ) as unknown as EquityParts;
    const mixed = sets.some((set) => keys.some((key) => Math.abs(set[key] - (sets[0]?.[key] ?? 0)) > 0.001));

    return { meanScore: avg((entry) => entry.score), meanParts: parts, weights, mixedWeights: mixed };
  }, [cards]);

  const weakest = [...cards].filter((card) => card.equity).sort((a, b) => a.equity!.score - b.equity!.score)[0];

  return (
    <Panel
      title="The score, and what it is made of"
      hint={`the mean of ${plural(cards.length, "group")} you can see`}
      recessed
    >
      <div className="grid grid--split">
        <div className="row row--wrap" style={{ gap: "1.5rem", alignItems: "center" }}>
          <ScoreDial score={meanScore} label="mean fairness" />
          <div className="stack stack--tight" style={{ minWidth: 0, maxWidth: "40ch" }}>
            <p className="card__meta" style={{ lineHeight: 1.6 }}>
              A group&rsquo;s score is these five measures, weighted the way the group&rsquo;s own policy says. The dial is the average across the
              groups above; a single group can be well above it or well below.
            </p>
            {weakest?.equity ? (
              <p className="card__meta" style={{ lineHeight: 1.6 }}>
                <span className="label">Weakest · {weakest.equity.score}</span> <Link className="tap" to={`/projects/${weakest.id}`}>{weakest.name}</Link>{" "}
                — {weakest.equity.headline}
              </p>
            ) : null}
          </div>
        </div>

        <div className="stack stack--tight">
          {PART_LABELS.map((part) => (
            <Meter
              key={part.key}
              label={
                /*
                 * The weight has to be on screen — see the same note in
                 * `routes/project/Equity.tsx`, whose wording this deliberately
                 * matches so the two screens cannot describe one measure twice.
                 */
                <span className="row" style={{ gap: "0.35rem" }}>
                  {part.label}
                  <span className="label" title={`${pct(weights[part.key] ?? 0)} of the fairness score`}>
                    {pct(weights[part.key] ?? 0)}
                  </span>
                </span>
              }
              value={meanParts[part.key]}
              hint={`${part.blurb} — worth ${pct(weights[part.key] ?? 0)} of the score`}
            />
          ))}
          {mixedWeights ? (
            <Quiet>
              These groups do not all weight the five measures the same way, so the percentages above are the average weighting across them.
            </Quiet>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/* ---------- every group, against every other ----------------------------- */

function GroupsPanel({ cards, dashboard, hasMine }: { cards: Card[]; dashboard: Dashboard; hasMine: boolean }) {
  const ranked = [...cards].sort((a, b) => a.equity!.score - b.equity!.score);
  const summary = dashboard.summary;
  const unclaimedCount = cards.filter((card) => card.unassigned > 0).length;

  return (
    <Panel
      title="Every group, side by side"
      hint="weakest first — the one at the top is the one to open"
      actions={
        <Link className="btn btn--ghost btn--sm" to={`/projects/${ranked[0]?.id ?? ""}`}>
          Open the weakest
          <IconArrowRight size={12} />
        </Link>
      }
    >
      <div className="stack stack--loose">
        <ComparisonBars
          ariaLabel="The fairness score of each group, weakest first"
          items={ranked.map((card) => ({
            id: card.id,
            label: (
              <Link className="tap" to={`/projects/${card.id}`}>
                {card.name}
              </Link>
            ),
            value: card.equity!.score,
            tone: card.equity!.score >= 70 ? "var(--color-accent)" : card.equity!.score >= 55 ? "var(--color-over)" : "var(--color-risk)",
            note: `${plural(card.memberCount, "person", "people")}${card.unassigned ? ` · ${hours(card.unassigned)} unowned` : ""}`,
          }))}
        />

        <div className="grid grid--stats">
          {hasMine ? (
            <>
              <Stat value={hours(summary.openHours)} label="Open work on you" note={`${plural(summary.projects, "group")} in view`} />
              <Stat
                value={hours(summary.evenHours)}
                label="An even share of it"
                note="what your share would be if it were split evenly"
              />
              <Stat
                value={hours(summary.creditedHours)}
                label="Delivered so far"
                tone={summary.creditedHours >= summary.evenHours ? "accent" : "ink"}
                note={`${pct(summary.creditedHours / Math.max(1, summary.evenHours))} of an even share`}
              />
              <Stat
                value={summary.overdue}
                label="Past their date"
                tone={summary.overdue ? "over" : "accent"}
                note={summary.overdue ? "open work whose deadline has gone" : "nothing has slipped"}
              />
            </>
          ) : (
            <>
              <Stat value={cards.length} label="Groups in view" note="every group you can see, not just your own" />
              <Stat
                value={ranked[0]?.equity ? ranked[0].equity.score : "—"}
                label="Weakest score"
                tone={ranked[0]?.equity && ranked[0].equity.score < 55 ? "over" : "ink"}
                note={ranked[0] ? ranked[0].name : "no groups yet"}
              />
              <Stat
                value={ranked[ranked.length - 1]?.equity ? ranked[ranked.length - 1].equity!.score : "—"}
                label="Strongest score"
                tone="accent"
                note={ranked[ranked.length - 1] ? ranked[ranked.length - 1].name : "no groups yet"}
              />
              <Stat
                value={unclaimedCount}
                label="Groups with unowned work"
                tone={unclaimedCount ? "over" : "accent"}
                note={unclaimedCount ? "boards where no person holds some of the work" : "every task has an owner"}
              />
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ---------- work nobody has taken on ------------------------------------- */

/**
 * The earliest, cheapest thing to catch: hours sitting on a board with no owner.
 * The bar is the whole group in one strip, with the unclaimed part left grey, so
 * the shape of the problem is visible before any number is read.
 */
function UnclaimedPanel({ cards }: { cards: Card[] }) {
  const total = cards.reduce((sum, card) => sum + card.unassigned, 0);

  return (
    <Panel
      title="Work nobody has taken on"
      hint={`${hours(total)} across ${plural(cards.length, "group")}`}
      actions={
        <Tag tone="over" dot>
          unowned
        </Tag>
      }
    >
      <div className="stack stack--loose">
        {cards.map((card) => (
          <div key={card.id} className="stack stack--tight">
            <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
              <Link className="tap" to={`/projects/${card.id}?tab=board`} style={{ fontWeight: 550 }}>
                {card.name}
              </Link>
              <span className="card__meta tnum nowrap">
                {hours(card.unassigned)} unowned of {plural(card.taskCount, "task")}
              </span>
            </div>
            <ShareBar
              segments={card.members.map((member) => ({ id: member.id, name: member.name, hue: member.hue, hours: member.credited }))}
              unassigned={card.unassigned}
              showLegend={card.members.length <= 6}
            />
          </div>
        ))}
        <Quiet>
          This is the earliest thing worth catching. Nobody has done anything unfair here yet — there is simply work on the board that no person
          has agreed to hold, and it will land on whoever is nearest when the date arrives.
        </Quiet>
      </div>
    </Panel>
  );
}

/* ---------- where it is going ------------------------------------------- */

/**
 * A person's own line, week by week, against the even share of the same weeks.
 * The even share moves as the group changes, so it is a series rather than a
 * fixed rule line; the figures come from the equity snapshots the engine writes.
 */
function TrendPanel({ dashboard }: { dashboard: Dashboard }) {
  const trend = dashboard.trend;
  const even = trend.map((point) => point.even);
  const last = trend[trend.length - 1];
  const first = trend[0];
  const direction = last.credited - first.credited;

  return (
    <Panel
      title="Where it is going"
      hint="your delivered hours, what you took on, and an even share of the same weeks"
      actions={
        <Stat
          size="sm"
          value={`${direction >= 0 ? "+" : "−"}${hours(Math.abs(direction))}`}
          label="since the first week"
          tone={direction >= 0 ? "accent" : "ink"}
        />
      }
    >
      <div className="stack stack--tight">
        <LineChart
          ariaLabel="Your delivered hours, the hours you took on, and an even share, week by week"
          series={[
            { id: "credited", name: "Delivered", color: "var(--color-accent)", points: trend.map((point) => ({ label: point.week, value: point.credited })) },
            { id: "committed", name: "Taken on", color: "var(--color-ink-3)", points: trend.map((point) => ({ label: point.week, value: point.committed })) },
            { id: "even", name: "An even share", color: "var(--color-over)", points: trend.map((point) => ({ label: point.week, value: point.even })) },
          ]}
          max={Math.max(...trend.map((point) => point.committed), ...even, 1) * 1.1}
        />
        <p className="card__meta" style={{ lineHeight: 1.55 }}>
          The gap between the grey line and the green one is the work you agreed to hold that has not landed yet
          {last.committed > last.credited
            ? ` — ${hours(last.committed - last.credited)} of it in the last week the engine recorded.`
            : "."}
          {even[even.length - 1] > 0
            ? ` An even share in that week was ${hours(even[even.length - 1])}, so you are ${
                Math.abs(last.credited - even[even.length - 1]) < 0.3
                  ? "level with it"
                  : `${hours(Math.abs(last.credited - even[even.length - 1]))} ${last.credited > even[even.length - 1] ? "above" : "below"} it`
              }.`
            : ""}
        </p>
      </div>
    </Panel>
  );
}

/* ---------- who needs a hand -------------------------------------------- */

function HandPanel({ dashboard }: { dashboard: Dashboard }) {
  const attention = dashboard.classes.flatMap((entry) =>
    entry.attention.map((item) => ({ ...item, className: entry.name, classId: entry.id })),
  );

  return (
    <Panel
      title="Who needs a hand"
      hint={attention.length ? `${plural(attention.length, "person", "people")} the engine has flagged` : "the engine has nothing to flag"}
      actions={<IconScales size={15} />}
    >
      <div className="stack stack--loose">
        {attention.length ? (
          <div className="rows">
            {attention.map((item) => (
              <PersonRow
                key={`${item.classId}-${item.kind}-${item.studentId}`}
                person={{ id: item.studentId, name: item.name, hue: item.hue }}
                note={`${item.detail} · ${item.className}`}
                to={`/classrooms/${item.classId}/students/${item.studentId}`}
                right={
                  <Tag tone={severityTone(item.severity)} dot>
                    {item.severity}
                  </Tag>
                }
              />
            ))}
          </div>
        ) : null}

        {dashboard.nudges.length ? (
          <div className="stack stack--tight">
            <span className="label">What the engine wrote for you</span>
            <Nudges compact nudges={dashboard.nudges} />
          </div>
        ) : null}

        {!attention.length && !dashboard.nudges.length ? (
          <Quiet>
             The engine returned no class attention or personal nudges for the data it can currently see.
          </Quiet>
        ) : null}
      </div>
    </Panel>
  );
}
