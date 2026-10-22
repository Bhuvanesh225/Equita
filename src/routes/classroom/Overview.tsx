/**
 * The class, at a glance.
 *
 * The teacher's first question is never "show me everything" — it is "is anyone
 * being left to carry this, and is anything about to be missed?" So the overview
 * leads with the class's own numbers, then the trend, then one block per group
 * with the same load bar that is on every other screen.
 */
import { Link } from "react-router-dom";

import { describeGini, hours, pct, plural } from "../../lib/format";
import { LoadBar, Panel, ProgressLine, Stat, StateChip, Tag } from "../../components/ui";
import { Quiet, ScoreMark } from "../../components/blocks";
import { LineChart } from "../../components/charts";
import { IconArrowRight, IconPlus } from "../../components/icons";
import type { ClassProject, ClassroomOverview } from "../../lib/types";

export function OverviewTab({
  overview,
  onGoToCoverage,
  onSetAssignment,
}: {
  overview: ClassroomOverview;
  onGoToCoverage: () => void;
  onSetAssignment: () => void;
}) {
  const { analytics, trend, projects, coverage, gaps } = overview;
  const uncovered = gaps.filter((gap) => gap.needed);
  const scored = trend.filter((point) => point.score > 0);

  return (
    <div className="stack stack--loose">
      <section className="grid grid--stats" aria-label="How this class is doing">
        <Stat
          value={analytics.groups ? analytics.meanScore.toFixed(1) : "—"}
          label="Mean fairness"
          tone={analytics.groups ? (analytics.meanScore >= 75 ? "accent" : analytics.meanScore >= 55 ? "over" : "risk") : undefined}
          note={analytics.groups ? `worst group ${analytics.worstScore.toFixed(1)} · best ${analytics.bestScore.toFixed(1)}` : "no groups yet"}
        />
        <Stat
          value={analytics.groups ? analytics.meanGini.toFixed(2) : "—"}
          label="Spread of the work"
          note={analytics.groups ? describeGini(analytics.meanGini) : "nothing to measure"}
        />
        <Stat
          value={analytics.behindCount}
          label="Behind an even share"
          tone={analytics.behindCount ? "over" : "accent"}
          note={analytics.behindCount ? "delivered less than their share" : "nobody is short"}
        />
        <Stat
          value={analytics.overloadedCount}
          label="Overloaded"
          tone={analytics.overloadedCount ? "risk" : "accent"}
          note={analytics.overloadedCount ? "holding more than they can finish" : "nobody is past capacity"}
        />
        <Stat
          value={analytics.unplaced}
          label="Work nobody has"
          tone={analytics.unplaced ? "over" : "accent"}
          note={analytics.unplaced ? "tasks sitting with no owner" : "every task has an owner"}
        />
        <Stat
          value={analytics.totalOpenHours ? hours(analytics.totalOpenHours) : "0h"}
          label="Still open"
          note={`${plural(analytics.groups, "group")} across the class`}
        />
        <Stat
          value={analytics.projectsWithoutDeadline}
          label="Groups with no hand-in date"
          tone={analytics.projectsWithoutDeadline ? "over" : "accent"}
          note={analytics.projectsWithoutDeadline ? "without a date, nothing can be late" : "every group has a date"}
        />
        <Stat
          value={analytics.neverReviewed}
          label="Never reviewed"
          tone={analytics.neverReviewed ? "over" : "accent"}
          note={analytics.neverReviewed ? "nobody has read their work" : "every group has been read"}
        />
      </section>

      {scored.length > 1 ? (
        <Panel title="Fairness over the term" hint="the class mean, week by week">
          <LineChart
            ariaLabel={`Mean fairness of this class each week, from ${scored[0].score.toFixed(0)} to ${scored[scored.length - 1].score.toFixed(0)} out of 100`}
            min={0}
            max={100}
            height={168}
            series={[
              {
                id: "score",
                name: "Mean fairness",
                color: "var(--color-accent)",
                points: scored.map((point) => ({ label: point.week, value: point.score })),
              },
            ]}
            rules={[
              { value: 75, label: "75 · healthy" },
              { value: 50, label: "50 · needs a look" },
            ]}
            yFormat={(value) => String(Math.round(value))}
            area
          />
          <p className="card__meta" style={{ marginTop: "0.5rem", lineHeight: 1.5 }}>
            A score above 75 means the work is landing on people roughly in proportion to what they took on. Below 50, the group has tipped and
            someone is carrying more than their share.
          </p>
        </Panel>
      ) : (
        <Panel title="Fairness over the term">
          <Quiet>Nothing to plot yet. Snapshots are taken as the groups work, so this fills in over the term.</Quiet>
        </Panel>
      )}

      <section className="grid grid--stats" aria-label="Where the class is thin on skills">
        <Stat value={coverage.filter((row) => row.holders > 0).length} label="Clusters covered" note={`of ${coverage.length} the class could cover`} />
        <Stat
          value={uncovered.length}
          label="Nobody is strong at"
          tone={uncovered.length ? "over" : "accent"}
          note={uncovered.length ? "groups that need it are warned" : "every cluster has somebody"}
        />
        <div className="row" style={{ gap: "0.5rem" }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={onGoToCoverage}>
            See the coverage
            <IconArrowRight size={12} />
          </button>
        </div>
      </section>

      {projects.length ? (
        <div className="stack stack--loose">
          <h2 className="section-title">
            The groups
            <span className="label">{projects.length}</span>
          </h2>
          {projects.map((project) => (
            <ClassProjectPanel key={project.id} project={project} classroomId={overview.classroom.id} />
          ))}
        </div>
      ) : (
        <Panel title="No groups yet">
          {overview.viewer.isTeacher ? (
            <>
              <Quiet>
                Build the groups from the roster and each one becomes a project with its own board. Everything you see on this page then fills
                in by itself.
              </Quiet>
              <div className="row row--wrap" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
                <Link className="btn btn--primary btn--sm" to={`/classrooms/${overview.classroom.id}/groups`}>
                  Build the groups
                </Link>
                <button type="button" className="btn btn--outline btn--sm" onClick={onSetAssignment}>
                  <IconPlus size={12} />
                  Set an assignment
                </button>
              </div>
            </>
          ) : (
            <Quiet>Your teacher has not set the assignment yet. When they do, your group appears here.</Quiet>
          )}
        </Panel>
      )}
    </div>
  );
}

/* ---------- one group ---------------------------------------------------- */

function ClassProjectPanel({ project, classroomId }: { project: ClassProject; classroomId: string }) {
  const { modest, equity, members, attention } = project;
  const overloaded = members.filter((member) => member.state === "overloaded").length;

  return (
    <Panel
      stacked
      title={<Link to={`/projects/${project.id}`}>{project.name}</Link>}
      hint={
        <span className="row" style={{ gap: "0.35rem" }}>
          <Tag edge>{project.status}</Tag>
          <span className="card__meta">
            {plural(project.memberCount, "person", "people")} · {plural(modest.tasks, "task")} · {modest.open} open
            {modest.unassigned ? ` · ${modest.unassigned} unclaimed` : ""}
          </span>
          {project.dueAt ? (
            <span className="card__meta" style={{ color: (modest.daysLeft ?? 0) < 0 ? "var(--color-risk)" : undefined, fontWeight: (modest.daysLeft ?? 0) < 0 ? 600 : undefined }}>
              {modest.daysLeft === null
                ? "no hand-in date"
                : modest.daysLeft < 0
                  ? `${Math.round(Math.abs(modest.daysLeft))} days past the date`
                  : `hand in in ${Math.round(modest.daysLeft)} days`}
            </span>
          ) : null}
          {overloaded ? <Tag tone="risk" dot>{overloaded} overloaded</Tag> : null}
        </span>
      }
      actions={<ScoreMark score={modest.score} gini={modest.gini} />}
      foot={
        <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
          <span className="card__meta">
            {modest.done} of {modest.tasks} closed · {pct(modest.progress, 0)} of the work delivered
          </span>
          <span className="row" style={{ gap: "0.5rem" }}>
            {project.weakest ? <Tag edge title="The cluster this group is thinnest on">thin on {project.weakest}</Tag> : null}
            <Link className="btn btn--outline btn--sm" to={`/projects/${project.id}`}>
              Open the board
            </Link>
          </span>
        </div>
      }
    >
      <div className="stack stack--tight">
        <ProgressLine
          value={modest.progress}
          expected={equity.timeline.elapsed}
          label={`An even share here is ${hours(equity.totals.credited / Math.max(1, equity.totals.members))}`}
        />

        <div className="stack" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
          {members.map((member) => (
            <div key={member.id} className="stack stack--tight">
              <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
                <span className="row row--wrap" style={{ gap: "0.4rem", minWidth: 0 }}>
                  <Link className="tap" to={`/classrooms/${classroomId}/students/${member.id}`} style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                    {member.name}
                  </Link>
                  <StateChip state={member.state} hours={member.owedCreditedHours} />
                </span>
                <span className="card__meta tnum nowrap">
                  {hours(member.credited)} delivered of {hours(member.committed)} committed · {member.open} open
                </span>
              </div>
              <LoadBar
                name={member.name}
                hue={member.hue}
                hours={member.credited}
                even={member.even}
                capacity={member.capacity}
                leftLabel={<span className="label">Delivered against an even share</span>}
                caption={
                  Math.abs(member.owedCreditedHours) < 0.3
                    ? "level with an even share"
                    : member.owedCreditedHours > 0
                      ? `${hours(member.owedCreditedHours)} behind their share`
                      : `${hours(Math.abs(member.owedCreditedHours))} ahead of their share`
                }
              />
            </div>
          ))}
          {!members.length ? <Quiet>Nobody is on this group yet.</Quiet> : null}
        </div>

        {attention.length ? (
          <div className="callout callout--over">
            {attention.map((item) => (
              <span key={item.id} style={{ display: "block" }}>
                <Link className="tap" to={`/classrooms/${classroomId}/students/${item.id}`} style={{ fontWeight: 600 }}>
                  {item.name}
                </Link>{" "}
                — {item.detail}
              </span>
            ))}
          </div>
        ) : (
          <Quiet>Nobody in this group needs a person to step in.</Quiet>
        )}
      </div>
    </Panel>
  );
}
