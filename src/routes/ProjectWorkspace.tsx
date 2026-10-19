/**
 * The project workspace.
 *
 * One project, everything about it. The board is the centre of the screen and
 * the other tabs are the questions you ask about it: is the split fair, who is
 * on this, what has happened, and what did we each think of the work.
 *
 * The header carries the three acts the intelligence layer offers — plan from
 * the brief, place the unclaimed work, and add a task by hand — and each of them
 * opens a dialog rather than writing anything on its own.
 */
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { patch } from "../lib/api";
import { ApiError } from "../lib/api";
import { useApi, useToast } from "../lib/live";
import { hours, plural } from "../lib/format";
import { Avatar, EmptyState, LoadBar, Meter, Panel, Spinner, Stat, StateChip, Tag } from "../components/ui";
import { ActivityFeed, MoodTag, Nudges, PageHead, Quiet, ScoreMark, useTaskMoves } from "../components/blocks";
import { Menu } from "../components/overlays";
import { IconArrowRight, IconPlus, IconSparkle, IconWand } from "../components/icons";
import { TaskFormDialog } from "./project/TaskForm";
import { TaskSheet } from "./project/TaskSheet";
import { TaskBoard, TaskTable, ViewSwitch } from "./project/Board";
import { AutoAssignDialog, PlanDialog } from "./project/Plan";
import { ReviewsPanel } from "./project/Reviews";
import { EquityPanel } from "./project/Equity";
import type { ProjectWorkspace as Workspace, Skill, Task } from "../lib/types";

type Tab = "board" | "equity" | "people" | "activity" | "reviews";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "board", label: "Board" },
  { value: "equity", label: "Fairness" },
  { value: "people", label: "People" },
  { value: "activity", label: "What happened" },
  { value: "reviews", label: "Reviews" },
];

/**
 * The engines say `?panel=equity` and `?panel=plan`; this screen says `?tab=`. Both
 * are accepted, because notification rows written by an earlier version of the
 * server are already stored with the panel spelling and a broken link in a
 * notification is a bug no later fix can reach.
 */
const PANEL_TABS: Record<string, Tab> = {
  board: "board",
  plan: "board",
  equity: "equity",
  fairness: "equity",
  team: "people",
  people: "people",
  activity: "activity",
  reviews: "reviews",
};

function readTab(params: URLSearchParams): Tab {
  const requested = params.get("tab") ?? params.get("panel");
  if (requested && requested in PANEL_TABS) return PANEL_TABS[requested];
  return "board";
}

export default function ProjectWorkspace() {
  const { projectId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = readTab(params);
  const view = (params.get("view") as "board" | "table" | null) ?? "board";
  const taskParam = params.get("task");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  /*
   * `/projects/:id?plan=1` is how the "Plan from the brief" button on a toast
   * lands after a project is created with a brief on it. The parameter is
   * consumed on arrival — the dialog is a consequence of the press, not of the
   * URL staying there — so a later reload does not reopen it unbidden.
   */
  useEffect(() => {
    if (params.get("plan") !== "1") return;
    setPlanOpen(true);
    const next = new URLSearchParams(params);
    next.delete("plan");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const { data, loading, error, refresh } = useApi<Workspace>(`/api/projects/${projectId}`);
  const { data: skillData } = useApi<{ skills: Skill[] }>("/api/skills");
  const moves = useTaskMoves(refresh);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    // Switching tabs must also drop the engine's `panel` spelling, or choosing
    // "Board" (which means deleting `tab`) would fall back to the panel it arrived with.
    if (key === "tab") next.delete("panel");
    setParams(next, { replace: true });
  };

  const openTask = (id: string) => setParam("task", id);

  if (loading && !data) {
    return (
      <div className="page">
        <Spinner label="Reading the project" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="That project did not load"
          text={error ?? "It may have been deleted, or it may not be yours to see."}
          action={
            <>
              <button type="button" className="btn btn--outline" onClick={refresh}>
                Try again
              </button>
              <Link className="btn btn--primary" to="/projects">
                Back to your groups
              </Link>
            </>
          }
        />
      </div>
    );
  }

  const workspace = data;
  const openTasks = workspace.tasks.filter((task) => task.status !== "done");
  const unassigned = workspace.tasks.filter((task) => !task.assigneeId && task.status !== "done");
  const overdue = openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < Date.now());
  const lead = workspace.members.find((member) => member.role === "lead");

  return (
    <div className="page">
      <PageHead
        kicker={
          <>
            {workspace.project.mode === "class" ? "Class assignment" : "Your own group"}
            {workspace.project.classroom ? (
              <>
                {" · "}
                <Link className="tap" to={`/classrooms/${workspace.project.classroom.id}`}>
                  {workspace.project.classroom.name}
                </Link>
              </>
            ) : null}
          </>
        }
        title={workspace.project.name}
        sub={`${plural(workspace.members.length, "person", "people")} · ${hours(workspace.equity.totals.committed)} committed · an even share is ${hours(workspace.equity.distribution.evenShare)}`}
        actions={
          <>
            <ScoreMark score={workspace.equity.score} gini={workspace.equity.distribution.gini} />
            <button type="button" className="btn btn--outline" onClick={() => setPlanOpen(true)}>
              <IconSparkle size={13} />
              Plan from the brief
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setAssignOpen(true)} disabled={!unassigned.length || !workspace.viewer.isLead}>
              <IconWand size={13} />
              Place {unassigned.length ? `${unassigned.length} unclaimed` : "the work"}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setAddOpen(true)}>
              <IconPlus size={14} />
              Add a task
            </button>
            <ProjectMenu workspace={workspace} onChanged={refresh} />
          </>
        }
        tabs={
          <div className="tabs" role="tablist" aria-label="Sections of this project">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === item.value}
                onClick={() => setParam("tab", item.value === "board" ? null : item.value)}
              >
                {item.label}
                {item.value === "equity" ? <span className="label"> {workspace.equity.score}</span> : null}
                {item.value === "people" ? <span className="label"> {workspace.members.length}</span> : null}
                {item.value === "reviews" ? <span className="label"> {workspace.reviews.awaiting.length || ""}</span> : null}
              </button>
            ))}
          </div>
        }
      />

      {workspace.project.brief ? (
        <Panel title="The brief" hint={`${workspace.project.brief.length} characters`} recessed>
          <p style={{ fontSize: "var(--text-base)", lineHeight: 1.6, maxWidth: "78ch" }}>{workspace.project.brief}</p>
          {lead ? <p className="card__meta">Started by {lead.name}{workspace.project.dueAt ? ` · hand in ${new Date(workspace.project.dueAt).toLocaleDateString()}` : " · no hand-in date set"}</p> : null}
        </Panel>
      ) : (
        <Panel title="No brief yet" recessed>
          <div className="row row--between row--wrap" style={{ gap: "0.75rem" }}>
            <p className="card__meta" style={{ lineHeight: 1.5, maxWidth: "60ch" }}>
              The brief is what the group was actually asked to do. Paste it in and Equita can turn it into a plan — sized tasks, in stages,
              against your date.
            </p>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setPlanOpen(true)}>
              <IconSparkle size={12} />
              Write one from the brief
            </button>
          </div>
        </Panel>
      )}

      {workspace.nudges.length ? (
        <Panel title="What needs a person" hint={`${workspace.nudgeCounts.critical} serious of ${workspace.nudgeCounts.total}`} flush>
          <div className="panel__body">
            <Nudges nudges={workspace.nudges} compact />
          </div>
        </Panel>
      ) : null}

      {tab === "board" ? (
        <Panel
          title="The board"
          hint={`${openTasks.length} open · ${hours(workspace.equity.totals.open)} · ${overdue.length} past the date`}
          actions={
            <>
              {unassigned.length ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOnlyUnassigned((v) => !v)} aria-pressed={onlyUnassigned}>
                  {onlyUnassigned ? "Show everyone" : `Only the ${unassigned.length} unclaimed`}
                </button>
              ) : null}
              <ViewSwitch value={view} onChange={(next) => setParam("view", next === "board" ? null : next)} />
            </>
          }
        >
          {view === "board" ? (
            <TaskBoard workspace={workspace} moves={moves} onOpenTask={openTask} onlyUnassigned={onlyUnassigned} />
          ) : (
            <TaskTable workspace={workspace} onOpenTask={openTask} />
          )}
        </Panel>
      ) : null}

      {tab === "equity" ? (
        <EquityPanel projectId={workspace.project.id} equity={workspace.equity} history={workspace.history} onApplied={refresh} />
      ) : null}

      {tab === "people" ? <PeopleTab workspace={workspace} onOpenTask={openTask} /> : null}

      {tab === "activity" ? <ActivityTab workspace={workspace} /> : null}

      {tab === "reviews" ? <ReviewsPanel workspace={workspace} onDone={refresh} /> : null}

      <TaskFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        projectId={workspace.project.id}
        members={workspace.members}
        skills={skillData?.skills ?? []}
        onDone={refresh}
      />

      <PlanDialog open={planOpen} onClose={() => setPlanOpen(false)} workspace={workspace} onDone={refresh} />

      <AutoAssignDialog open={assignOpen} onClose={() => setAssignOpen(false)} workspace={workspace} onDone={refresh} />

      {taskParam ? (
        <TaskSheet
          taskId={taskParam}
          projectId={workspace.project.id}
          members={workspace.members}
          skills={skillData?.skills ?? []}
          moves={moves}
          onClose={() => setParam("task", null)}
          onChanged={refresh}
        />
      ) : null}

      {moves.dialog}
    </div>
  );
}

/* ---------- the project menu -------------------------------------------- */

function ProjectMenu({ workspace, onChanged }: { workspace: Workspace; onChanged: () => void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: string) => {
    setBusy(true);
    try {
      await patch(`/api/projects/${workspace.project.id}`, { status });
      push({ title: `Marked ${status}`, tone: "good" });
      onChanged();
    } catch (cause) {
      push({ title: "That did not save", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/projects/${workspace.project.id}`;
    void navigator.clipboard?.writeText(url).then(
      () => push({ title: "Link copied", detail: url, tone: "good" }),
      () => push({ title: "Could not copy", detail: url, tone: "neutral" }),
    );
  };

  return (
    <Menu
      label={busy ? "Working..." : "More"}
      items={[
        { label: "Copy the link", onSelect: copyLink, hint: "for the group chat" },
        { label: "Mark as running", onSelect: () => void setStatus("active"), disabled: workspace.project.status === "active" },
        { label: "Mark as checking", onSelect: () => void setStatus("review"), disabled: workspace.project.status === "review" },
        { label: "Mark as finished", onSelect: () => void setStatus("done"), disabled: workspace.project.status === "done" },
        { label: "Archive it", onSelect: () => void setStatus("archived"), danger: true, disabled: workspace.project.status === "archived" },
      ]}
    />
  );
}

/* ---------- who is on this ---------------------------------------------- */

function PeopleTab({ workspace, onOpenTask }: { workspace: Workspace; onOpenTask: (id: string) => void }) {
  const demand = workspace.insights.demand;
  const maxDemand = Math.max(1, ...demand.map((entry) => entry.hours));

  return (
    <div className="grid grid--split">
      <div className="stack stack--loose">
        {workspace.members.map((member) => {
          const load = workspace.equity.members.find((entry) => entry.id === member.id);
          const own = workspace.tasks.filter((task) => task.assigneeId === member.id);
          const open = own.filter((task) => task.status !== "done");
          return (
            <Panel
              key={member.id}
              stacked
              title={
                <span className="row" style={{ gap: "0.5rem" }}>
                  <Avatar name={member.name} hue={member.hue} />
                  <Link to={`/people/${member.id}`}>{member.name}</Link>
                  {member.role === "lead" ? <Tag edge>lead</Tag> : null}
                  {load ? <StateChip state={load.state} hours={load.owedCreditedHours} /> : null}
                </span>
              }
              hint={`${member.headline || "no headline"} · ${hours(member.capacity)} a week`}
              foot={
                <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
                  <span className="card__meta">
                    {plural(open.length, "open task")} · {hours(load?.open ?? 0)} · room for {hours(load?.remainingCapacity ?? 0)} more
                  </span>
                  <span className="card__meta">{load ? `${load.doneCount} closed of ${load.taskCount}` : ""}</span>
                </div>
              }
            >
              <div className="stack stack--tight">
                {load ? (
                  <LoadBar
                    name={member.name}
                    hue={member.hue}
                    hours={load.credited}
                    even={load.even.credited}
                    capacity={load.remainingCapacity}
                    leftLabel={<span className="label">Delivered against an even share</span>}
                    caption={
                      Math.abs(load.owedCreditedHours) < 0.3
                        ? "level with the group"
                        : load.owedCreditedHours > 0
                          ? `${hours(load.owedCreditedHours)} behind their share`
                          : `${hours(Math.abs(load.owedCreditedHours))} ahead of their share`
                    }
                  />
                ) : null}

                <div className="row row--wrap" style={{ gap: "0.3rem" }}>
                  {member.topSkills.slice(0, 6).map((skill) => (
                    <Tag key={skill.slug} edge title={`${skill.name}, level ${skill.level}/5`}>
                      {skill.name} {skill.level}/5
                    </Tag>
                  ))}
                  {!member.topSkills.length ? <Quiet>They have not claimed any skills yet.</Quiet> : null}
                </div>

                {open.length ? (
                  <div className="rows">
                    {open.slice(0, 4).map((task) => (
                      <button key={task.id} type="button" className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto", width: "100%" }} onClick={() => onOpenTask(task.id)}>
                        <span
                          aria-hidden="true"
                          style={{ width: 8, height: 8, background: task.status === "blocked" ? "var(--color-risk)" : task.status === "doing" ? "var(--color-accent)" : "var(--color-line-strong)" }}
                        />
                        <span className="rowitem__title truncate" style={{ textAlign: "left" }}>
                          {task.title}
                        </span>
                        <span className="card__meta tnum nowrap">{hours(task.effort)}</span>
                      </button>
                    ))}
                    {open.length > 4 ? <span className="card__meta">and {open.length - 4} more</span> : null}
                  </div>
                ) : (
                  <Quiet>Nothing open on them.</Quiet>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="stack stack--loose">
        <Panel title="What this project demands" hint={`${demand.length} skills named across the board`}>
          {demand.length ? (
            <div className="stack stack--tight">
              {demand.slice(0, 10).map((entry) => (
                <div key={entry.slug} className="stack" style={{ gap: "0.2rem" }}>
                  <div className="row row--between" style={{ gap: "0.5rem" }}>
                    <span className="truncate" style={{ fontSize: "var(--text-sm)" }}>
                      {entry.name}
                    </span>
                    <span className="card__meta tnum">
                      {hours(entry.hours)} · {plural(entry.tasks.length, "task")}
                    </span>
                  </div>
                  <span className="meter__track" style={{ height: 4 }}>
                    <span className="meter__fill" style={{ width: `${Math.max(3, (entry.hours / maxDemand) * 100)}%`, background: "var(--color-ink)" }} />
                  </span>
                </div>
              ))}
              <p className="card__meta" style={{ lineHeight: 1.45 }}>
                Hours of work that name each skill. Where a demand has no strong holder on the group, the allocator will flag it rather than
                quietly hand it to whoever is free.
              </p>
            </div>
          ) : (
            <Quiet>No task on this board names a skill yet. Naming one is what lets the allocator match people to work.</Quiet>
          )}
        </Panel>

        <Panel title="The split as it stands" hint="committed against an even share">
          <div className="stack stack--tight">
            <Stat size="sm" value={workspace.equity.score} label="Fairness score" tone={workspace.equity.score >= 70 ? "accent" : workspace.equity.score >= 55 ? "over" : "risk"} note={workspace.equity.headline} />
            <Meter label="Balance" value={workspace.equity.parts.balance} />
            <Meter label="Delivery" value={workspace.equity.parts.delivery} />
            <Meter label="Spread" value={workspace.equity.parts.spread} />
            <Meter label="Engagement" value={workspace.equity.parts.engagement} />
            <Meter label="Readiness" value={workspace.equity.parts.readiness} />
            <Link className="btn btn--outline btn--sm" to={`/projects/${workspace.project.id}?tab=equity`} style={{ justifySelf: "start" }}>
              Open the full fairness panel
              <IconArrowRight size={12} />
            </Link>
          </div>
        </Panel>

        <Panel title="How they are working" hint="the signals behind the score">
          <div className="stack stack--tight">
            {workspace.equity.members.map((member) => (
              <div key={member.id} className="row row--between" style={{ gap: "0.5rem" }}>
                <span className="row" style={{ gap: "0.4rem", minWidth: 0 }}>
                  <Avatar name={member.name} hue={member.hue} size="sm" />
                  <span className="truncate" style={{ fontSize: "var(--text-sm)" }}>
                    {member.name}
                  </span>
                </span>
                <span className="card__meta tnum nowrap">
                  {member.checkinCount} check-ins · {member.commentCount} notes · {member.reviewCount} reviews
                  {member.daysSinceSignal !== null ? ` · last heard ${member.daysSinceSignal}d ago` : " · never heard from"}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {workspace.comments.length ? (
          <Panel title="The last thing said" hint="most recent messages" flush>
            <div className="stack">
              {workspace.comments.slice(-5).reverse().map((comment) => (
                <div key={comment.id} className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr)" }}>
                  <Avatar name={comment.authorName} hue={comment.authorHue ?? 0} size="sm" />
                  <span style={{ minWidth: 0 }}>
                    <span className="rowitem__title">{comment.authorName ?? "someone"}</span>
                    <span className="rowitem__sub" style={{ whiteSpace: "normal" }}>{comment.body}</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- what happened ------------------------------------------------ */

function ActivityTab({ workspace }: { workspace: Workspace }) {
  const latest = Object.values(workspace.latestCheckin);

  return (
    <div className="grid grid--split">
      <Panel title="Everything that has happened" hint={`${workspace.activity.length} entries`} flush>
        <ActivityFeed activity={workspace.activity} limit={60} />
        {!workspace.activity.length ? <Quiet>Nothing has happened on this project yet.</Quiet> : null}
      </Panel>

      <div className="stack stack--loose">
        <Panel title="This week's check-ins" hint={`${latest.length} of ${workspace.members.length} people`}>
          <div className="stack stack--tight">
            {latest.map((checkin) => (
              <div key={checkin.id} className="stack" style={{ gap: "0.2rem" }}>
                <span className="row" style={{ gap: "0.4rem" }}>
                  <Avatar name={checkin.name} hue={checkin.hue ?? 0} size="sm" />
                  <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{checkin.name}</span>
                  <MoodTag mood={checkin.mood} />
                </span>
                {checkin.note ? (
                  <p className="card__meta" style={{ marginLeft: "1.9rem", lineHeight: 1.45 }}>
                    {checkin.note}
                  </p>
                ) : null}
                {checkin.blockers ? (
                  <p className="card__meta" style={{ marginLeft: "1.9rem", lineHeight: 1.45, color: "var(--color-risk)" }}>
                    Blocker: {checkin.blockers}
                  </p>
                ) : null}
              </div>
            ))}
            {!latest.length ? <Quiet>Nobody has checked in this week. A check-in is four words and a sentence, and it is how the group can tell quiet from stuck.</Quiet> : null}
          </div>
        </Panel>

        <Panel title="Check-in history" hint={`${workspace.checkins.length} entries`} flush>
          <div className="stack">
            {workspace.checkins.slice(0, 12).map((checkin) => (
              <div key={checkin.id} className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                <Avatar name={checkin.name} hue={checkin.hue ?? 0} size="sm" />
                <span style={{ minWidth: 0 }}>
                  <span className="rowitem__title">{checkin.name}</span>
                  <span className="rowitem__sub">{checkin.note || checkin.blockers || "no note"}</span>
                </span>
                <span className="card__meta nowrap">{checkin.week.replace(/^\d{4}-/, "")}</span>
              </div>
            ))}
            {!workspace.checkins.length ? <Quiet>No check-ins have been posted yet.</Quiet> : null}
          </div>
        </Panel>

        <Panel title="Every message" hint={`${workspace.comments.length} across the board`} flush>
          <div className="stack">
            {workspace.comments.slice(-20).reverse().map((comment) => {
              const task = workspace.tasks.find((item) => item.id === comment.taskId);
              return (
                <div key={comment.id} className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr)" }}>
                  <Avatar name={comment.authorName} hue={comment.authorHue ?? 0} size="sm" />
                  <span style={{ minWidth: 0 }}>
                    <span className="rowitem__title">
                      {comment.authorName ?? "someone"}
                      {task ? <span className="card__meta"> on “{task.title}”</span> : null}
                    </span>
                    <span className="rowitem__sub" style={{ whiteSpace: "normal" }}>{comment.body}</span>
                  </span>
                </div>
              );
            })}
            {!workspace.comments.length ? <Quiet>Nobody has commented on a task yet.</Quiet> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Kept exported so other screens can reuse the shape of a reading of a task. */
export type { Task };