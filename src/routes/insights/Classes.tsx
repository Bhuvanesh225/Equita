/**
 * The class half of the fairness screen.
 *
 * A teacher's fairness question is not the same as a student's. A student wants
 * to know whether their own share is fair; a teacher wants to know which class,
 * and which group inside it, needs them this week. So each class gets one panel
 * built from the class's own `/analytics` endpoint — the same endpoint the class
 * console reads, so a number here and the same number there cannot disagree.
 *
 * It is a separate component per class, and each holds its own request. That is
 * deliberate: the number of classes is not known until the dashboard has loaded,
 * and a hook cannot be called in a loop. It also means a class that fails to
 * load is one panel, not the whole page.
 */
import { Link } from "react-router-dom";

import { useApi } from "../../lib/live";
import { decimal, hours, pct, plural } from "../../lib/format";
import { Panel, Spinner, Stat, Tag } from "../../components/ui";
import { Quiet, ScoreMark } from "../../components/blocks";
import { ComparisonBars, LineChart } from "../../components/charts";
import { IconArrowRight } from "../../components/icons";
import type { ClassAnalytics, Classroom, Dashboard } from "../../lib/types";

type ClassSummary = Dashboard["classes"][number];

export function ClassPanel({ summary }: { summary: ClassSummary }) {
  const { data, loading, error, refresh } = useApi<ClassAnalytics>(`/api/classrooms/${summary.id}/analytics`);

  const body = () => {
    if (error || (!data && !loading)) {
      return (
        <Quiet>
          The class&rsquo;s numbers did not load ({error ?? "no answer from the server"}).{" "}
          <button type="button" className="btn btn--ghost btn--sm" onClick={refresh}>
            Try again
          </button>
        </Quiet>
      );
    }
    if (!data) {
      return <Spinner label="Reading the class" />;
    }

    const { analytics, projects, coverage, trend } = data;
    const scored = trend;
    const weakest = [...coverage].sort((a, b) => a.meanLevel - b.meanLevel).slice(0, 3);
    const groupsScored = [...projects].sort((a, b) => a.score - b.score);

    return (
      <div className="stack stack--loose">
        <div className="grid grid--stats">
          <Stat
            value={analytics.groups ? decimal(analytics.meanScore) : "—"}
            label="Mean fairness"
            tone={analytics.meanScore >= 70 ? "accent" : analytics.meanScore >= 55 ? "over" : "risk"}
            note={analytics.groups ? `of ${plural(analytics.groups, "group")}` : "no groups yet"}
          />
          <Stat
            value={analytics.groups ? decimal(analytics.worstScore) : "—"}
            label="Weakest group"
            tone={analytics.worstScore >= 70 ? "accent" : analytics.worstScore >= 55 ? "over" : "risk"}
            note={groupsScored[0] ? groupsScored[0].name : "nothing to compare"}
          />
          <Stat
            value={analytics.behindCount}
            label="Behind their share"
            tone={analytics.behindCount ? "over" : "accent"}
            note={analytics.behindCount ? "delivered less than an even share of what landed" : "everybody is level or ahead"}
          />
          <Stat
            value={analytics.overloadedCount}
            label="Carrying too much"
            tone={analytics.overloadedCount ? "over" : "accent"}
            note={analytics.overloadedCount ? "more open work than the date allows" : "nobody is over their own limit"}
          />
          <Stat
            value={analytics.unplaced}
            label="In no group"
            tone={analytics.unplaced ? "over" : "accent"}
            note={analytics.unplaced ? "on the roster, on no board" : "everybody is in a group"}
          />
          <Stat
            value={analytics.neverReviewed}
            label="Never reviewed"
            tone={analytics.neverReviewed ? "over" : "accent"}
            note={analytics.neverReviewed ? "nobody has read their work" : "every group has been read"}
          />
        </div>

        {groupsScored.length ? (
          <div className="stack stack--tight">
            <span className="label">Every group in this class, weakest first</span>
            <ComparisonBars
              ariaLabel={`The fairness score of every group in ${summary.name}`}
              items={groupsScored.map((project) => ({
                id: project.id,
                label: (
                  <Link className="tap" to={`/projects/${project.id}?tab=equity`}>
                    {project.name}
                  </Link>
                ),
                value: project.score,
                tone: project.score >= 70 ? "var(--color-accent)" : project.score >= 55 ? "var(--color-over)" : "var(--color-risk)",
                note: `${plural(project.members.length, "person", "people")}${project.unassigned ? ` · ${hours(project.unassigned)} unowned` : ""}`,
              }))}
            />
          </div>
        ) : (
          <Quiet>This class has no groups yet, so there is nothing to compare. Set an assignment or build the groups from the console.</Quiet>
        )}

        {scored.length > 1 ? (
          <LineChart
             ariaLabel={`Mean fairness of ${summary.name} each week, from ${decimal(scored[0].score, 0)} to ${decimal(scored[scored.length - 1].score, 0)} out of 100`}
            min={0}
            max={100}
            height={148}
            series={[{ id: "score", name: "Mean fairness", color: "var(--color-accent)", points: scored.map((point) => ({ label: point.week, value: point.score })) }]}
            rules={[
              { value: 75, label: "75 · healthy" },
              { value: 50, label: "50 · needs a look" },
            ]}
          />
        ) : null}

        {weakest.length ? (
          <div className="stack stack--tight">
            <span className="label">Where this class is thinnest</span>
            {weakest.map((row) => (
              <div key={row.cluster} className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
                <span className="row" style={{ gap: "0.4rem", minWidth: 0 }}>
                  <span style={{ fontWeight: 550, fontSize: "var(--text-sm)" }}>{row.name}</span>
                  {row.strong === 0 ? <Tag tone="over" dot>nobody strong</Tag> : <Tag edge>{plural(row.strong, "strong")}</Tag>}
                </span>
                <span className="row" style={{ gap: "0.5rem", minWidth: 0 }}>
                  {/*
                   * A mini track rather than a `Meter`: a Meter's label column is
                   * 7.5rem wide, and inside a right-aligned row that left the bar
                   * itself a sliver wide with only its tick visible.
                   */}
                  <span
                    className="meter__track"
                    style={{ width: "4.5rem" }}
                     title={`Mean self-reported level ${decimal(row.meanLevel, 2)} of 5 across ${plural(row.holders, "holder")}. The tick is 3 of 5.`}
                  >
                    <span className="meter__fill meter--accent" style={{ width: `${Math.max(0, Math.min(100, (row.meanLevel / 5) * 100))}%` }} />
                    <span className="meter__mark" style={{ left: "60%" }} />
                  </span>
                  <span className="tnum card__meta nowrap">
                     {decimal(row.meanLevel)}/5 · {plural(row.holders, "holder")}
                  </span>
                </span>
              </div>
            ))}
            {data.analytics.totalOpenHours ? (
              <Quiet>
                {hours(analytics.totalOpenHours)} of work is open across this class, {pct(analytics.meanProgress)} of it done. A cluster nobody is
                strong at is not a fault — it is the part of the assignment somebody will be learning.
              </Quiet>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Panel
      stacked
      title={<Link to={`/classrooms/${summary.id}`}>{summary.name}</Link>}
      hint={
        <span className="row row--wrap" style={{ gap: "0.35rem" }}>
          <Tag edge>{summary.code}</Tag>
          <span className="card__meta">
            {plural(summary.students, "student")} · {plural(summary.groups, "group")}
            {summary.subject ? ` · ${summary.subject}` : ""}
          </span>
        </span>
      }
      actions={summary.groups ? <ScoreMark score={summary.meanScore} label="mean fairness" /> : <Tag edge>no groups yet</Tag>}
      foot={
        <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
          <span className="card__meta">
            {summary.urgent ? `${plural(summary.urgent, "thing")} the engine calls urgent` : "nothing urgent in this class"}
          </span>
          <Link className="btn btn--outline btn--sm" to={`/classrooms/${summary.id}?tab=attention`}>
            Open the class
            <IconArrowRight size={12} />
          </Link>
        </div>
      }
    >
      {body()}
    </Panel>
  );
}

/**
 * A student's own classes. They see the class summary — the same figures the
 * console shows them — and nothing about anybody else's hours, which is what
 * `GET /api/classrooms` returns for a member.
 */
export function StudentClasses({ classrooms }: { classrooms: Classroom[] }) {
  return (
    <Panel title="Your classes" hint="the summary view everybody in the class shares" flush>
      {classrooms.map((entry) => (
        <div key={entry.id} className="panel__body" style={{ borderBottom: "1px solid var(--color-line)" }}>
          <div className="row row--between row--wrap" style={{ gap: "0.75rem" }}>
            <span style={{ minWidth: 0 }}>
              <Link className="tap" to={`/classrooms/${entry.id}`} style={{ fontWeight: 550 }}>
                {entry.name}
              </Link>
              <span className="rowitem__sub" style={{ display: "block" }}>
                {entry.subject ? `${entry.subject} · ` : ""}
                {plural(entry.students ?? 0, "student")} · {plural(entry.projects ?? 0, "group")}
              </span>
            </span>
            <span className="row" style={{ gap: "0.5rem" }}>
              {entry.meanScore === null || entry.meanScore === undefined ? (
                <Tag edge>no groups yet</Tag>
              ) : (
                <ScoreMark score={entry.meanScore} label="class mean" />
              )}
              <Link className="btn btn--outline btn--sm" to={`/classrooms/${entry.id}`}>
                Open
              </Link>
            </span>
          </div>
        </div>
      ))}
    </Panel>
  );
}
