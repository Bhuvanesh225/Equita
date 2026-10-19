/**
 * The fairness panel.
 *
 * This is the product's own answer to "is the work even?" — the same five
 * weighted measures the score is built from, then every person against an even
 * share, then the moves the engine would make to fix it. Nothing here is
 * decorative: each bar is a number the equity engine computed.
 */
import { useState } from "react";
import { Link } from "react-router-dom";

import { post } from "../../lib/api";
import { ApiError } from "../../lib/api";
import { useToast } from "../../lib/live";
import { describeGini, hours, pct, plural } from "../../lib/format";
import { LoadBar, Meter, Panel, ScoreDial, ShareBar, Stat, StateChip, Tag } from "../../components/ui";
import { FlagList, PhaseTag, Quiet } from "../../components/blocks";
import { LineChart } from "../../components/charts";
import { IconCheck, IconShuffle } from "../../components/icons";
import type { Equity, HistoryPoint, RebalanceSuggestion } from "../../lib/types";

const PART_LABELS: Array<{ key: keyof Equity["parts"]; label: string; blurb: string }> = [
  { key: "balance", label: "Balance", blurb: "how even the delivered hours are across the group" },
  { key: "delivery", label: "Delivery", blurb: "how much of the work has actually landed" },
  { key: "spread", label: "Spread", blurb: "how far the busiest person sits from the quietest" },
  { key: "engagement", label: "Engagement", blurb: "check-ins, comments and reviews — the signs of a group in touch" },
  { key: "readiness", label: "Readiness", blurb: "whether what is left can still be finished before the date" },
];

export function EquityPanel({
  projectId,
  equity,
  history,
  onApplied,
}: {
  projectId: string;
  equity: Equity;
  history: HistoryPoint[];
  onApplied: () => void;
}) {
  const [showAllMembers, setShowAllMembers] = useState(false);
  const members = showAllMembers ? equity.members : equity.members.slice(0, 6);
  const projectFlags = equity.flags.filter((flag) => flag.scope === "project");
  const measured = equity.measure === "credited" ? "delivered hours" : "committed hours";

  return (
    <div className="stack stack--loose">
      <Panel
        title="Fairness"
        hint={`measured on ${measured}`}
        actions={<Link className="btn btn--ghost btn--sm" to="/insights">How this is computed</Link>}
      >
        <div className="work-equity">
          <div className="stack" style={{ alignItems: "center", gap: "0.5rem" }}>
            <ScoreDial score={equity.score} label="fairness" />
            <p className="card__meta" style={{ textAlign: "center", lineHeight: 1.45, maxWidth: "22ch" }}>
              {equity.headline}
            </p>
          </div>

          <div className="stack stack--tight">
            {PART_LABELS.map((part) => (
              <Meter
                key={part.key}
                label={
                  /*
                   * The weight has to be on screen — a weighted average nobody
                   * can see is a number nobody can argue with — but the meter's
                   * label column is 7.5rem wide, and "Engagement 15% weight" is
                   * 150px of type in a 120px slot, which clipped it. The
                   * abbreviation fits, and the full sentence moves to the hint.
                   */
                  <span className="row" style={{ gap: "0.35rem" }}>
                    {part.label}
                    <span className="label" title={`${Math.round((equity.weights[part.key] ?? 0) * 100)}% of the fairness score`}>
                      {Math.round((equity.weights[part.key] ?? 0) * 100)}%
                    </span>
                  </span>
                }
                value={equity.parts[part.key]}
                hint={`${part.blurb} — worth ${Math.round((equity.weights[part.key] ?? 0) * 100)}% of the score`}
              />
            ))}
          </div>

          <div className="stack stack--tight">
            <Stat size="sm" value={equity.distribution.evenShare.toFixed(1)} label="Even share" note={`hours each, of ${plural(equity.totals.members, "person", "people")}`} />
            <Stat size="sm" value={equity.distribution.gini.toFixed(2)} label="Gini of delivered work" note={describeGini(equity.distribution.gini)} />
            <Stat size="sm" value={equity.totals.unassigned ? hours(equity.totals.unassigned) : "0h"} label="Nobody's yet" tone={equity.totals.unassigned ? "over" : "accent"} note="unclaimed work on the board" />
          </div>
        </div>
      </Panel>

      <div className="grid grid--split">
        <Panel title="Every person against an even share" flush>
          <div className="stack" style={{ gap: "0" }}>
            {members.map((member) => (
              <div key={member.id} className="panel__body" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <div className="stack stack--tight">
                  <div className="row row--between" style={{ gap: "0.5rem" }}>
                    <span className="row" style={{ gap: "0.4rem", minWidth: 0 }}>
                      <Link to={`/people/${member.id}`} className="truncate tap" style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                        {member.name}
                      </Link>
                      <StateChip state={member.state} hours={member.owedCreditedHours} />
                      {member.role === "lead" ? <Tag edge>lead</Tag> : null}
                    </span>
                    <span className="card__meta tnum nowrap">
                      {member.taskCount} tasks · {member.doneCount} closed
                      {member.blocked ? ` · ${member.blocked} blocked` : ""}
                    </span>
                  </div>

                  <LoadBar
                    name={member.name}
                    hue={member.hue}
                    hours={member.credited}
                    even={member.even.credited}
                    capacity={member.remainingCapacity}
                    leftLabel={<span className="label">Delivered</span>}
                    caption={
                      Math.abs(member.owedCreditedHours) < 0.3
                        ? "level with an even share"
                        : member.owedCreditedHours > 0
                          ? `${hours(member.owedCreditedHours)} behind · ${hours(member.open)} still open`
                          : `${hours(Math.abs(member.owedCreditedHours))} ahead · ${hours(member.open)} still open`
                    }
                  />

                  <div className="row row--wrap" style={{ gap: "0.75rem" }}>
                    <span className="label tnum">committed {hours(member.committed)}</span>
                    <span className="label tnum">open {hours(member.open)}</span>
                    <span className="label tnum">room {hours(member.remainingCapacity)}</span>
                    {member.helped > 0 ? <span className="label tnum">helped {hours(member.helped)}</span> : null}
                    {member.daysSinceSignal !== null && member.daysSinceSignal >= 4 ? <span className="label tnum">quiet {member.daysSinceSignal}d</span> : null}
                    {member.lateCloses > 0 ? <span className="label tnum" style={{ color: "var(--color-over)" }}>{member.lateCloses} late</span> : null}
                  </div>

                  {member.flags.length ? <FlagList flags={member.flags.map((flag) => ({ ...flag, scope: "member" as const, memberName: member.name }))} limit={3} /> : null}
                </div>
              </div>
            ))}
          </div>
          {equity.members.length > 6 ? (
            <div className="panel__foot">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowAllMembers((v) => !v)}>
                {showAllMembers ? "Show fewer" : `Show all ${equity.members.length}`}
              </button>
            </div>
          ) : null}
        </Panel>

        <div className="stack stack--loose">
          <Panel title="The whole group in one bar" hint="equal slices are the ideal">
            <div className="stack stack--tight">
              <ShareBar
                segments={equity.members.map((member) => ({ id: member.id, name: member.name, hue: member.hue, hours: member.credited }))}
                unassigned={equity.totals.unassigned}
                showLegend
                height={16}
              />
              <p className="card__meta" style={{ lineHeight: 1.45 }}>
                {equity.totals.credited} hours delivered between {plural(equity.totals.members, "person", "people")}. An even split is{" "}
                {hours(equity.distribution.evenShare)} each. The gap between the busiest and the quietest is {hours(equity.distribution.maxGap)}.
              </p>
            </div>
          </Panel>

          <Panel title="Where the time went" hint={equity.timeline.daysLeft !== null ? `${Math.round(equity.timeline.daysLeft)} days left` : "no date set"}>
            <div className="stack stack--tight">
              <Stat
                size="sm"
                value={pct(equity.timeline.actualProgress)}
                label="Delivered"
                note={`against ${pct(equity.timeline.elapsed)} of the time gone`}
                tone={equity.timeline.actualProgress >= equity.timeline.elapsed ? "accent" : "over"}
              />
              <Meter label="On-time closes" value={equity.timeline.punctuality} hint="share of tasks closed on or before their date" />
              <Meter label="Keeping to the plan" value={equity.timeline.scheduleScore} hint="whether progress matches the calendar" />
              <div className="row row--wrap" style={{ gap: "0.75rem" }}>
                <span className="label tnum">{equity.totals.done} of {equity.totals.tasks} closed</span>
                {equity.totals.overdue ? <span className="label tnum" style={{ color: "var(--color-risk)" }}>{equity.totals.overdue} past the date</span> : null}
                {equity.totals.blocked ? <span className="label tnum" style={{ color: "var(--color-over)" }}>{equity.totals.blocked} blocked</span> : null}
              </div>
            </div>
          </Panel>

          {history.length >= 2 ? (
            <Panel title="Fairness over the project" hint={`${history.length} readings`}>
              <LineChart
                ariaLabel="Fairness score over the life of the project"
                height={132}
                min={0}
                max={100}
                rules={[{ value: 70, label: "steady" }]}
                series={[
                  {
                    id: "score",
                    name: "Fairness",
                    color: "var(--color-accent)",
                    points: history.map((point) => ({ label: point.week.replace(/^\d{4}-/, ""), value: point.score })),
                  },
                  {
                    id: "gini",
                    name: "Gini ×100",
                    color: "var(--color-over)",
                    points: history.map((point) => ({ label: point.week.replace(/^\d{4}-/, ""), value: Math.round(point.gini * 100) })),
                  },
                ]}
              />
            </Panel>
          ) : null}

          {projectFlags.length ? (
            <Panel title="What the engine noticed" hint={plural(projectFlags.length, "reading")}>
              <FlagList flags={projectFlags} limit={6} />
            </Panel>
          ) : null}
        </div>
      </div>

      <RebalancePanel projectId={projectId} equity={equity} onApplied={onApplied} />

      {equity.unassigned.length ? (
        <Panel title="Work nobody has taken" hint={`${equity.unassigned.length} on the board`} flush>
          {equity.unassigned.map((task) => (
            <div key={task.id} className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
              <PhaseTag phase={task.phase} />
              <span style={{ minWidth: 0 }}>
                <span className="rowitem__title">{task.title}</span>
                <span className="rowitem__sub">
                  {hours(task.effort)}
                  {task.required.length ? ` · needs ${task.required.map((skill) => skill.name ?? skill.slug).join(", ")}` : ""}
                </span>
              </span>
              <span className="card__meta nowrap">{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "no date"}</span>
            </div>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}

/* ---------- the moves the engine would make ------------------------------ */

export function RebalancePanel({ projectId, equity, onApplied }: { projectId: string; equity: Equity; onApplied: () => void }) {
  const suggestions = equity.suggestions;

  if (!suggestions.length) {
    return (
      <Panel title="Evening it out" hint="nothing to move">
        <Quiet>
          The engine has no move worth making: no task sits so badly with its owner that handing it on would help. This panel fills in when it
          does — usually when one person is carrying, or when a task has nobody on it.
        </Quiet>
      </Panel>
    );
  }

  return (
    <Panel
      title="Evening it out"
      hint={`${suggestions.length} ${suggestions.length === 1 ? "move" : "moves"} the engine would make`}
    >
      <div className="stack stack--tight">
        {suggestions.map((suggestion) => (
          <div key={`${suggestion.taskId}-${suggestion.toId}`} className="callout callout--accent">
            <div className="row row--between row--wrap" style={{ gap: "0.5rem", alignItems: "flex-start" }}>
              <div className="stack" style={{ gap: "0.25rem", minWidth: 0, flex: "1 1 18rem" }}>
                <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{suggestion.taskTitle}</span>
                <span className="card__meta" style={{ lineHeight: 1.45 }}>
                  {suggestion.kind === "fill"
                    ? `Nobody has this. ${suggestion.reason}`
                    : `${suggestion.fromName ?? "Unassigned"} → ${suggestion.toName}. ${suggestion.reason}`}
                </span>
                <span className="row row--wrap" style={{ gap: "0.75rem" }}>
                  <span className="label tnum">{hours(suggestion.taskEffort)} of work</span>
                  {suggestion.fitScore !== null ? <span className="label tnum">fit {Math.round(suggestion.fitScore)}</span> : null}
                  <span className="label tnum" style={{ color: "var(--color-accent-deep)" }}>
                    fairness +{suggestion.improvement}
                  </span>
                  <span className="label tnum">
                    {suggestion.toName} would hold {hours(suggestion.toAfterHours)} against an even {hours(suggestion.evenHours)}
                  </span>
                </span>
              </div>
              <MoveButton projectId={projectId} suggestion={suggestion} onApplied={onApplied} />
            </div>
          </div>
        ))}
        <p className="card__meta" style={{ lineHeight: 1.45 }}>
          Applying a move writes an assignment entry with the expected improvement attached, so in three weeks the group can see not just that
          a task moved but what it was meant to fix.
        </p>
      </div>
    </Panel>
  );
}

function MoveButton({ projectId, suggestion, onApplied }: { projectId: string; suggestion: RebalanceSuggestion; onApplied: () => void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const move = async () => {
    setBusy(true);
    try {
      await post(`/api/projects/${projectId}/rebalance/apply`, { taskId: suggestion.taskId, toId: suggestion.toId, note: "" });
      push({
        title: suggestion.kind === "fill" ? `Handed to ${suggestion.toName}` : `Moved to ${suggestion.toName}`,
        detail: `Expected fairness +${suggestion.improvement}`,
        tone: "good",
      });
      onApplied();
    } catch (cause) {
      push({ title: "That move did not land", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="btn btn--primary btn--sm" onClick={() => void move()} disabled={busy} style={{ flex: "none" }}>
      {busy ? "Moving..." : suggestion.kind === "fill" ? <IconCheck size={12} /> : <IconShuffle size={12} />}
      {busy ? "" : suggestion.kind === "fill" ? "Hand it over" : "Move it"}
    </button>
  );
}

