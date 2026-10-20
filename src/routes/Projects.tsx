/**
 * Projects.
 *
 * Every group and class assignment in one list. The question a person arrives
 * with is "which of these needs me?", so the list is sortable by fairness and
 * the load bar — the same mark used everywhere else — sits on every card
 * showing the viewer's own share against an even one.
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useApi } from "../lib/live";
import { dateLabel, describeGini, hours, listJoin, plural } from "../lib/format";
import { EmptyState, LoadBar, Panel, ScoreDial, Segmented, Spinner, Stat, StateChip, Tag } from "../components/ui";
import { PageHead, Quiet, ScoreMark } from "../components/blocks";
import { ComparisonBars } from "../components/charts";
import { IconArrowRight, IconPlus } from "../components/icons";
import type { ProjectSummary } from "../lib/types";

type Filter = "all" | "active" | "attention" | "review" | "done";
type Sort = "attention" | "due" | "fairness" | "size";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "active", label: "Running" },
  { value: "attention", label: "Needs attention" },
  { value: "review", label: "Checking" },
  { value: "done", label: "Finished" },
];

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "attention", label: "Needs attention" },
  { value: "due", label: "Due soonest" },
  { value: "fairness", label: "Least fair" },
  { value: "size", label: "Biggest" },
];

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, refresh } = useApi<{ projects: ProjectSummary[] }>("/api/projects");
  const filter = (params.get("filter") as Filter | null) ?? "all";
  const sort = (params.get("sort") as Sort | null) ?? "attention";
  const [query, setQuery] = useState("");

  const projects = data?.projects ?? [];

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  const counts = useMemo(() => {
    const base = { all: projects.length, active: 0, attention: 0, review: 0, done: 0 };
    for (const project of projects) {
      if (project.status === "active") base.active += 1;
      if (project.status === "review") base.review += 1;
      if (project.status === "done" || project.status === "archived") base.done += 1;
      if (needsAttention(project)) base.attention += 1;
    }
    return base;
  }, [projects]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = projects.filter((project) => {
      if (needle && !`${project.name} ${project.brief}`.toLowerCase().includes(needle)) return false;
      if (filter === "active") return project.status === "active";
      if (filter === "review") return project.status === "review";
      if (filter === "done") return project.status === "done" || project.status === "archived";
      if (filter === "attention") return needsAttention(project);
      return true;
    });
    const rank = (project: ProjectSummary) => {
      switch (sort) {
        case "due":
          return project.dueAt ? new Date(project.dueAt).getTime() : Number.POSITIVE_INFINITY;
        case "fairness":
          return project.equity?.score ?? 100;
        case "size":
          return -(project.memberCount * 1000 + project.taskCount);
        default:
          return -(attentionRank(project));
      }
    };
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [projects, filter, sort, query]);

  const totalOpen = projects.reduce((sum, project) => sum + project.openCount, 0);
  const mineOpen = projects.reduce((sum, project) => sum + project.myOpen, 0);
  const unclaimed = projects.reduce((sum, project) => sum + project.unassigned, 0);
  const flagged = counts.attention;
  const weakest = [...projects]
    .filter((project) => project.equity && project.status !== "archived")
    .sort((a, b) => (a.equity!.score - b.equity!.score))[0];

  if (loading && !data) {
    return (
      <div className="page">
        <Spinner label="Gathering your groups" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="The list did not load"
          text={error ?? "Something went wrong reading your groups."}
          action={
            <button type="button" className="btn btn--primary" onClick={refresh}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead
        kicker="Groups & assignments"
        title="Projects"
        sub={
          projects.length
            ? `${plural(projects.length, "group")} · ${hours(totalOpen)} of open work · ${hours(mineOpen)} of it on you${unclaimed ? ` · ${unclaimed}h unclaimed` : ""}`
            : "Nothing here yet"
        }
        actions={
          <Link className="btn btn--primary" to="/projects/new">
            <IconPlus size={14} />
            Start a group
          </Link>
        }
      />

      <section className="grid grid--stats" aria-label="Across your groups">
        <Stat value={projects.length} label="Groups you are in" note={plural(counts.active, "still running")} />
        <Stat value={hours(mineOpen)} label="Open work on you" note="across every group below" />
        <Stat
          value={flagged}
          label="Need attention"
          tone={flagged ? "over" : "accent"}
          note={flagged ? "carrying someone, behind, or past the date" : "every group is within its own limits"}
        />
        <Stat
          value={unclaimed ? `${unclaimed}h` : "0h"}
          label="Nobody has taken"
          tone={unclaimed ? "over" : "accent"}
          note={unclaimed ? "work sitting on a board with no owner" : "every task has an owner"}
        />
      </section>

      <Panel
        title="Filter and order"
        hint={`showing ${shown.length} of ${projects.length}`}
        actions={
          <input
            className="input"
            style={{ maxWidth: "16rem" }}
            placeholder="Search by name or brief"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search projects"
          />
        }
      >
        <div className="row row--wrap row--between" style={{ gap: "0.75rem" }}>
          <Segmented ariaLabel="Filter groups" options={FILTERS.map((item) => ({ value: item.value, label: `${item.label}${counts[item.value] ? ` ${counts[item.value]}` : ""}` }))} value={filter} onChange={(next) => setParam("filter", next)} />
          <Segmented ariaLabel="Sort groups" options={SORTS.map((item) => ({ value: item.value, label: item.label }))} value={sort} onChange={(next) => setParam("sort", next)} />
        </div>
      </Panel>

      {weakest && weakest.equity && projects.length > 1 ? (
        <Panel
          title="Side by side"
          hint="fairness score, weakest first"
          actions={
            <Link className="btn btn--ghost btn--sm" to={`/projects/${weakest.id}`}>
              Open the weakest
              <IconArrowRight size={12} />
            </Link>
          }
        >
          <ComparisonBars
            ariaLabel="Fairness score of each group"
            items={[...projects]
              .filter((project) => project.equity)
              .sort((a, b) => a.equity!.score - b.equity!.score)
              .map((project) => ({
                id: project.id,
                label: (
                  <Link className="tap" to={`/projects/${project.id}`}>
                    {project.name}
                  </Link>
                ),
                value: project.equity!.score,
                tone: project.equity!.score >= 70 ? "var(--color-accent)" : project.equity!.score >= 55 ? "var(--color-over)" : "var(--color-risk)",
                note: `${plural(project.memberCount, "person", "people")} · ${hours(project.openCount === 0 ? project.taskCount : project.openCount)} open`,
              }))}
          />
        </Panel>
      ) : null}

      {shown.length ? (
        <section className="grid grid--halves" aria-label="Your groups">
          {shown.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      ) : (
        <Panel title="Nothing matches">
          <EmptyState
            title={projects.length ? "No group matches that" : "No groups yet"}
            text={
              projects.length
                ? "Nothing under this filter. Try “Everything”, or clear the search."
                : "A group can be a class assignment from a teacher, or three friends and a deadline you set yourselves. Either way, it starts the same way."
            }
            action={
              projects.length ? (
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    setQuery("");
                    setParams({}, { replace: true });
                  }}
                >
                  Clear the filters
                </button>
              ) : (
                <Link className="btn btn--primary btn--sm" to="/projects/new">
                  Start a group
                </Link>
              )
            }
          />
        </Panel>
      )}
    </div>
  );
}

/* ---------- one group ---------------------------------------------------- */

function ProjectCard({ project }: { project: ProjectSummary }) {
  const attention = needsAttention(project);
  const due = project.dueAt ? dateLabel(project.dueAt) : "no date";
  const daysLeft = project.equity?.daysLeft ?? null;

  return (
    <Panel
      stacked
      className={attention ? "panel--accent" : undefined}
      title={<Link to={`/projects/${project.id}`}>{project.name}</Link>}
      hint={
        <span className="row" style={{ gap: "0.35rem" }}>
          <Tag edge>{project.mode === "class" ? "class assignment" : "your own group"}</Tag>
          <Tag edge>{project.status}</Tag>
        </span>
      }
      actions={project.equity ? <ScoreMark score={project.equity.score} gini={project.equity.gini} /> : null}
      foot={
        <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
          <span className="card__meta">
            {plural(project.memberCount, "person", "people")} · {plural(project.taskCount, "task")} · {project.openCount} open
            {project.unassigned ? ` · ${project.unassigned} unclaimed` : ""}
          </span>
          <span className="row" style={{ gap: "0.5rem" }}>
            <span className="card__meta nowrap" style={{ color: attention ? "var(--color-risk)" : undefined, fontWeight: attention ? 600 : undefined }}>
              {due}
              {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 ? ` · ${Math.round(daysLeft)} days` : ""}
            </span>
            <Link className="btn btn--outline btn--sm" to={`/projects/${project.id}`}>
              Open
            </Link>
          </span>
        </div>
      }
    >
      <div className="stack stack--tight">
        <p className="card__meta clamp-2" style={{ lineHeight: 1.5 }}>
          {project.brief || "No brief written yet."}
        </p>

        {project.myShare ? (
          <div className="stack stack--tight">
            <div className="row row--between">
              <span className="row" style={{ gap: "0.4rem" }}>
                <span className="label">You</span>
                <StateChip state={project.myShare.state} hours={project.myShare.credited - project.myShare.even} />
              </span>
              <span className="card__meta tnum">
                {hours(project.myShare.credited)} delivered · {hours(project.myShare.committed)} committed
              </span>
            </div>
            <LoadBar
              name="Your share"
              hours={project.myShare.credited}
              even={project.myShare.even}
              leftLabel={<span className="label">Delivered against an even share</span>}
              caption={
                project.myOpen
                  ? `${hours(project.myOpen)} still open on you`
                  : "nothing open on you in this group"
              }
            />
          </div>
        ) : (
          <div className="row row--between">
            <span className="label">{project.openCount === 0 ? "Everything is closed" : "Work in flight"}</span>
            <span className="card__meta tnum">
              {project.taskCount - project.openCount} of {project.taskCount} closed
            </span>
          </div>
        )}

        {project.equity?.headline ? (
          <p className="card__meta" style={{ lineHeight: 1.45 }}>
            {project.equity.headline}
          </p>
        ) : null}

        {attention ? (
          <div className={`callout callout--${project.equity && project.equity.score < 45 ? "risk" : "over"}`}>
            {attentionSentence(project)}
            <Link className="tap" to={`/projects/${project.id}`}>
              Open the board.
            </Link>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/* ---------- the reading of a group -------------------------------------- */

function needsAttention(project: ProjectSummary): boolean {
  if (project.status === "archived" || project.status === "done") return false;
  if (project.unassigned > 0 && project.openCount > 0) return true;
  if (project.equity && project.equity.score < 58) return true;
  if (project.equity?.daysLeft !== null && project.equity?.daysLeft !== undefined && project.equity.daysLeft < 0 && project.openCount > 0) return true;
  if (project.myShare && project.myShare.state !== "on-track") return true;
  return false;
}

function attentionRank(project: ProjectSummary): number {
  let score = 0;
  if (project.unassigned > 0) score += 40;
  if (project.equity) score += Math.max(0, 70 - project.equity.score);
  if (project.equity?.daysLeft !== null && project.equity?.daysLeft !== undefined && project.equity.daysLeft < 3) score += 20;
  if (project.myShare && project.myShare.state !== "on-track") score += 15;
  return score;
}

function attentionSentence(project: ProjectSummary): string {
  const reasons: string[] = [];
  if (project.unassigned > 0) reasons.push(`${hours(project.unassigned)} has nobody on it`);
  if (project.equity && project.equity.score < 58) reasons.push(`fairness is ${project.equity.score} (${describeGini(project.equity.gini)})`);
  const daysLeft = project.equity?.daysLeft;
  if (daysLeft !== null && daysLeft !== undefined && daysLeft < 0 && project.openCount) reasons.push(`the date passed with ${project.openCount} still open`);
  if (project.myShare && project.myShare.state !== "on-track" && project.myShare.state !== undefined) reasons.push(`you are ${project.myShare.state.replace("-", " ")}`);
  return listJoin(reasons).replace(/^./, (char) => char.toUpperCase()) + ".";
}

/* ---------- a quiet ledger ---------------------------------------------- */

/** Kept for the fairness panel and any screen that needs a per-group dial. */
export function ProjectDial({ project }: { project: ProjectSummary }) {
  if (!project.equity) return <Quiet>No fairness reading yet.</Quiet>;
  return <ScoreDial score={project.equity.score} label={project.name.length > 16 ? `${project.name.slice(0, 14)}…` : project.name} size={96} />;
}