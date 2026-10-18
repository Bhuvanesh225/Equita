/**
 * Today.
 *
 * The screen answers three questions in order: what needs me now, is my group
 * fair, and what is happening that I have not looked at. Everything else on it
 * is a link away.
 */
import { useState } from "react";
import { Link } from "react-router-dom";

import { useApi, useToast } from "../lib/live";
import { useSession } from "../lib/session";
import { post } from "../lib/api";
import { ApiError } from "../lib/api";
import { dateLabel, hours, listJoin, plural } from "../lib/format";
import { Avatar, EmptyState, LoadBar, Panel, ProgressLine, ShareBar, Spinner, Stat, StateChip, Tag } from "../components/ui";
import { ActivityFeed, FlagList, Nudges, PageHead, PhaseTag, Quiet, ScoreMark, StatusTag, useTaskMoves } from "../components/blocks";
import { IconArrowRight, IconPlus, IconSparkle } from "../components/icons";
import type { Dashboard as DashboardPayload } from "../lib/types";

const MOODS = [
  { value: "ahead", label: "Ahead", blurb: "more done than I expected" },
  { value: "steady", label: "Steady", blurb: "roughly where I expected" },
  { value: "behind", label: "Behind", blurb: "slower than the plan" },
  { value: "stuck", label: "Stuck", blurb: "waiting on something" },
] as const;

export default function Dashboard() {
  const { user } = useSession();
  const { data, loading, error, refresh } = useApi<DashboardPayload>("/api/insights/dashboard");
  const moves = useTaskMoves(refresh);
  const [checkinProject, setCheckinProject] = useState<string | null>(null);

  if (loading && !data) return <div className="page"><Spinner label="Adding up the week" /></div>;
  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="The dashboard did not load"
          text={error ?? "Something went wrong reading your work."}
          action={
            <button type="button" className="btn btn--primary" onClick={refresh}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const teacher = user?.role === "teacher";
  const overdue = data.agenda.filter((task) => task.overdue);
  const soon = data.agenda.filter((task) => !task.overdue);
  const openAll = data.cards.reduce((sum, card) => sum + (card.mine?.open ?? 0), 0);
  const owed = data.cards.reduce((sum, card) => sum + Math.max(0, (card.mine?.owed ?? 0)), 0);
  // Students a teacher's classes have flagged. Used when their own list is clear.
  const watching = data.classes.flatMap((klass) => klass.attention);
  /*
   * A teacher usually holds no tasks of their own — that is the point of the
   * job. Four columns of zeros say nothing, so when that is the case the strip
   * reports on the classes instead, which is what they came here to see.
   */
  const classRoll = teacher && data.classes.length
    ? {
        students: data.classes.reduce((sum, klass) => sum + klass.students, 0),
        groups: data.classes.reduce((sum, klass) => sum + klass.groups, 0),
        mean: Math.round(data.classes.reduce((sum, klass) => sum + klass.meanScore, 0) / data.classes.length),
        weakest: Math.min(...data.classes.map((klass) => klass.worstScore)),
        behind: data.classes.reduce((sum, klass) => sum + klass.behind, 0),
        over: data.classes.reduce((sum, klass) => sum + klass.overloaded, 0),
        unplaced: data.classes.reduce((sum, klass) => sum + klass.unplaced, 0),
      }
    : null;
  const mineIsQuiet = !data.agenda.length && data.summary.creditedHours === 0;

  const summary = [
    `${data.summary.projects} ${data.summary.projects === 1 ? "group" : "groups"}`,
    `${hours(data.summary.openHours)} of open work`,
    data.summary.evenHours > 0 ? `an even share is ${hours(data.summary.evenHours)}` : null,
    overdue.length ? `${overdue.length} past the date` : null,
  ].filter(Boolean);

  return (
    <div className="page">
      <PageHead
        kicker={dateLabel(new Date().toISOString())}
        title={`Good to see you, ${data.user.name.split(" ")[0]}`}
        sub={summary.join(" · ")}
        actions={
          <>
            <Link className="btn btn--outline" to="/projects/new">
              <IconPlus size={14} />
              Start a group
            </Link>
            <Link className="btn btn--primary" to="/projects">
              {teacher ? "Your assignments" : "Your groups"}
            </Link>
          </>
        }
      />

      <section className="grid grid--stats" aria-label={classRoll && mineIsQuiet ? "Your classes at a glance" : "This week at a glance"}>
        {classRoll && mineIsQuiet ? (
          <>
            <Stat
              value={classRoll.students}
              label="Students you teach"
              note={`across ${plural(data.classes.length, "class", "classes")} and ${plural(classRoll.groups, "group")}`}
            />
            <Stat
              value={classRoll.mean}
              label="Mean fairness"
              note="averaged over every group you run"
              tone={classRoll.mean >= 70 ? "accent" : classRoll.mean >= 55 ? "over" : "risk"}
            />
            <Stat
              value={classRoll.behind}
              label="Behind their share"
              tone={classRoll.behind ? "over" : "accent"}
              note="students who have delivered less than an even split"
            />
            <Stat
              value={classRoll.over}
              label="Over capacity"
              tone={classRoll.over ? "risk" : "accent"}
              note={classRoll.unplaced ? `${plural(classRoll.unplaced, "student")} not in a group yet` : "everyone is placed in a group"}
            />
          </>
        ) : (
          <>
            <Stat
              value={hours(data.summary.openHours)}
              label="Open work on you"
              note={
                owed > 0.05
                  ? `${hours(owed)} behind an even share, across ${plural(data.cards.length, "group")}`
                  : openAll > 0
                    ? `across ${plural(data.cards.length, "group")}`
                    : "nothing outstanding"
              }
            />
            <Stat
              value={hours(data.summary.evenHours)}
              label="Your even share"
              note="what a fair split of the open work would be"
              tone={openAll > data.summary.evenHours * 1.3 ? "over" : openAll < data.summary.evenHours * 0.7 ? "quiet" : "accent"}
            />
            <Stat value={hours(data.summary.creditedHours)} label="Delivered so far" note="hours actually closed off" />
            <Stat
              value={data.summary.dueToday || data.summary.overdue ? `${data.summary.dueToday} · ${data.summary.overdue}` : "0"}
              label="Due today · overdue"
              tone={data.summary.overdue > 0 ? "risk" : data.summary.dueToday > 0 ? "over" : "accent"}
            />
          </>
        )}
      </section>

      <div className="grid grid--split">
        <div className="stack stack--loose">
          <WeekStrip week={data.week} />

          <Panel
            title="What needs you"
            hint={data.agenda.length ? `${data.agenda.length} open on you` : "nothing open"}
            actions={
              <Link className="btn btn--ghost btn--sm" to="/projects">
                All groups
                <IconArrowRight size={12} />
              </Link>
            }
            flush
          >
            {data.agenda.length === 0 ? (
              <div className="panel__body">
                {/*
                 * A teacher with nothing of their own left still has work in
                 * front of them: the students their classes have flagged. The
                 * empty state says so rather than pretending the page is done.
                 */}
                {teacher && watching.length ? (
                  <EmptyState
                    compact
                    title="Nothing on you personally"
                    text={`${plural(watching.length, "student")} in ${data.classes.length === 1 ? "your class" : "your classes"} ${
                      watching.length === 1 ? "needs" : "need"
                    } a look — carrying more than their share, or behind it. The console is where that gets sorted.`}
                    action={
                      <Link className="btn btn--primary btn--sm" to={`/classrooms/${data.classes[0].id}`}>
                        Open the console
                      </Link>
                    }
                  />
                ) : (
                  <EmptyState
                    compact
                    title="Nothing is on you"
                    text={
                      data.cards.length
                        ? "Every task assigned to you is closed. If a group needs a hand, the board shows what nobody has taken."
                        : "Start a group or join a class, and the work you take on will collect here."
                    }
                    action={
                      <Link className="btn btn--outline btn--sm" to="/projects/new">
                        Start a group
                      </Link>
                    }
                  />
                )}
              </div>
            ) : (
              <div>
                {overdue.length ? (
                  <p className="panel__body card__meta" style={{ paddingBottom: 0, color: "var(--color-risk)", fontWeight: 600 }}>
                    Past the date
                  </p>
                ) : null}
                {overdue.map((task) => (
                  <div key={task.id} className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                    <PhaseTag phase={task.phase} />
                    <span style={{ minWidth: 0 }}>
                      <span className="rowitem__title">{task.title}</span>
                      <span className="rowitem__sub">
                        {task.projectName} · {hours(task.effort)}
                        {task.requiredNames.length ? ` · ${listJoin(task.requiredNames.map((s) => s.name))}` : ""}
                      </span>
                    </span>
                    <span className="row" style={{ gap: "0.35rem" }}>
                      <DueMarkInline dueAt={task.dueAt} overdue />
                      <Link className="btn btn--outline btn--sm" to={`/projects/${task.projectId}`}>
                        Open
                      </Link>
                    </span>
                  </div>
                ))}
                {soon.length ? <p className="panel__body card__meta" style={{ paddingBottom: 0 }}>Next up</p> : null}
                {soon.map((task) => (
                  <div key={task.id} className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                    <PhaseTag phase={task.phase} />
                    <span style={{ minWidth: 0 }}>
                      <span className="rowitem__title">{task.title}</span>
                      <span className="rowitem__sub">
                        {task.projectName} · {hours(task.effort)}
                      </span>
                    </span>
                    <span className="row" style={{ gap: "0.35rem" }}>
                      <span className="card__meta nowrap">{task.dueAt ? dateLabel(task.dueAt) : "no date"}</span>
                      <StatusTag status={task.status} />
                      {task.status === "todo" ? (
                        <button type="button" className="btn btn--outline btn--sm" onClick={() => void moves.move(task.id, "doing")}>
                          Start
                        </button>
                      ) : task.status === "doing" ? (
                        <button type="button" className="btn btn--outline btn--sm" onClick={() => void moves.move(task.id, "review")}>
                          For review
                        </button>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <section className="stack">
            <h2 className="section-title">Your groups</h2>
            <div className="grid grid--halves">
              {data.cards.map((card) => (
                <Panel
                  key={card.id}
                  stacked
                  title={<Link to={`/projects/${card.id}`}>{card.name}</Link>}
                  hint={card.mode === "class" ? "class assignment" : "your own group"}
                  actions={card.equity ? <ScoreMark score={card.equity.score} /> : null}
                  foot={
                    <div className="row row--between">
                      <span className="card__meta">
                        {card.memberCount} people · {card.openCount} open · {card.unassigned ? `${card.unassigned} unclaimed` : "all claimed"}
                      </span>
                      <span className="row" style={{ gap: "0.35rem" }}>
                        <MemberFaces members={card.members} />
                        {card.dueAt ? <span className="card__meta nowrap">{dateLabel(card.dueAt)}</span> : <span className="card__meta">no date</span>}
                      </span>
                    </div>
                  }
                >
                  <div className="stack stack--tight">
                    {card.mine ? (
                      <>
                        <div className="row row--between">
                          <span className="row" style={{ gap: "0.4rem" }}>
                            <span className="label">You</span>
                            <StateChip state={card.mine.state} hours={card.mine.owed} />
                          </span>
                          <span className="card__meta tnum">
                            {hours(card.mine.credited)} delivered of {hours(card.mine.committed)}
                          </span>
                        </div>
                        <LoadBar
                          name="Your share"
                          hue={data.user.hue}
                          hours={card.mine.credited}
                          even={card.mine.even}
                          capacity={card.mine.remainingCapacity}
                          leftLabel={<span className="label">Delivered against an even share</span>}
                          caption={
                            card.mine.headroom > 0
                              ? `${hours(card.mine.headroom)} of room before you are carrying more than your share`
                              : "You are at the front of this group's work"
                          }
                        />
                      </>
                    ) : (
                      <ProgressLine
                        value={card.taskCount ? (card.taskCount - card.openCount) / card.taskCount : 0}
                        expected={card.equity ? card.equity.parts.delivery / 100 : undefined}
                        label="Tasks closed"
                      />
                    )}

                    <ShareBar
                      segments={card.members.map((member) => ({ id: member.id, name: member.name, hue: member.hue, hours: member.credited }))}
                      height={12}
                    />
                    <p className="card__meta" style={{ lineHeight: 1.45 }}>
                      {card.equity?.headline}
                    </p>
                    {card.flags.length ? <FlagList flags={card.flags} limit={2} /> : null}
                    {card.unclaimedForMe.length ? (
                      <div className="callout callout--accent">
                        {card.unclaimedForMe.length} task{card.unclaimedForMe.length === 1 ? "" : "s"} here have nobody on them, and you fit{" "}
                        {card.unclaimedForMe.length === 1 ? "it" : "them"}: {listJoin(card.unclaimedForMe.slice(0, 2).map((t) => `“${t.title}”`))}.{" "}
                        <Link to={`/projects/${card.id}`}>Take one on</Link>.
                      </div>
                    ) : null}
                  </div>
                </Panel>
              ))}
              {!data.cards.length ? (
                <Panel title="No groups yet">
                  <EmptyState
                    compact
                    title="Nothing here yet"
                    text="A group can be a class assignment from a teacher, or three friends and a deadline you set yourselves."
                    action={
                      <Link className="btn btn--primary btn--sm" to="/projects/new">
                        Start a group
                      </Link>
                    }
                  />
                </Panel>
              ) : null}
            </div>
          </section>

          {teacher && data.classes.length ? (
            <section className="stack">
              <h2 className="section-title">Your classes</h2>
              {data.classes.map((klass) => (
                <Panel
                  key={klass.id}
                  title={<Link to={`/classrooms/${klass.id}`}>{klass.name}</Link>}
                  hint={`${klass.students} students · ${klass.groups} groups · ${klass.code}`}
                  actions={
                    <Link className="btn btn--outline btn--sm" to={`/classrooms/${klass.id}`}>
                      Open the console
                    </Link>
                  }
                >
                  <div className="stack stack--tight">
                    <div className="row row--wrap" style={{ gap: "1.25rem" }}>
                      <Stat size="sm" value={klass.meanScore} label="Mean fairness" tone={klass.meanScore >= 70 ? "accent" : klass.meanScore >= 55 ? "over" : "risk"} />
                      <Stat size="sm" value={klass.worstScore} label="Weakest group" tone={klass.worstScore >= 60 ? "accent" : "risk"} />
                      <Stat size="sm" value={klass.behind} label="Behind their share" tone={klass.behind ? "over" : "accent"} />
                      <Stat size="sm" value={klass.overloaded} label="Over capacity" tone={klass.overloaded ? "risk" : "accent"} />
                      <Stat size="sm" value={klass.unplaced} label="Not in a group" tone={klass.unplaced ? "quiet" : "accent"} />
                    </div>
                    <Nudges nudges={klass.attention.map((item, index) => ({
                      id: `${klass.id}-${index}`,
                      kind: item.kind,
                      severity: item.severity,
                      title: item.name,
                      body: item.detail,
                      action: { label: "Open their record", href: `/classrooms/${klass.id}/students/${item.studentId}` },
                    }))} empty="Nothing needs a teacher here." compact />
                  </div>
                </Panel>
              ))}
            </section>
          ) : null}
        </div>

        <div className="stack stack--loose">
          <Panel
            title="Ask about this week"
            hint="computed, not guessed"
            actions={
              <Link className="btn btn--ghost btn--sm" to="/insights">
                Fairness
              </Link>
            }
          >
            <div className="stack stack--tight">
              <p className="card__meta" style={{ lineHeight: 1.5 }}>
                Every answer comes from the same figures on this page — no model, no guesswork. Ask what to do next, who is behind, or where the hours
                actually went.
              </p>
              <Link className="btn btn--outline btn--sm" to="/insights">
                <IconSparkle size={13} />
                Open the copilot
              </Link>
            </div>
          </Panel>

          {checkinProject ? (
            <CheckinCard
              projectId={checkinProject}
              onDone={() => {
                setCheckinProject(null);
                refresh();
              }}
            />
          ) : (
            <Panel title="Your week" hint="one line a week, per group">
              <div className="stack stack--tight">
                {data.cards.length ? (
                  <>
                    <p className="card__meta" style={{ lineHeight: 1.5 }}>
                      A check-in is four words and a sentence. It is how the group — and the engine — can tell the difference between quiet and stuck.
                    </p>
                    <div className="row row--wrap">
                      {data.cards.map((card) => (
                        <button key={card.id} type="button" className="btn btn--outline btn--sm" onClick={() => setCheckinProject(card.id)}>
                          Check in to {card.name.length > 22 ? `${card.name.slice(0, 22)}…` : card.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <Quiet>Once you are in a group, a weekly check-in is how the group stays legible.</Quiet>
                )}
              </div>
            </Panel>
          )}

          <Panel title="Your strengths" hint={`${data.skillCount} claimed`} actions={<Link className="btn btn--ghost btn--sm" to="/profile">Edit</Link>}>
            <div className="stack stack--tight">
              {data.top.slice(0, 5).map((skill) => (
                <div key={skill.slug} className="row row--between" style={{ gap: "0.5rem" }}>
                  <span className="row" style={{ gap: "0.4rem", minWidth: 0 }}>
                    <span className="label" style={{ minWidth: "2.25rem" }}>
                      {skill.level}/5
                    </span>
                    <span className="truncate" style={{ fontSize: "var(--text-sm)" }}>
                      {skill.name}
                    </span>
                  </span>
                  {skill.appetite > 0 ? <Tag tone="accent" edge title="Wants more of this">keen</Tag> : null}
                </div>
              ))}
              {!data.top.length ? <Quiet>Claim what you are good at, and tasks in this group get matched to it.</Quiet> : null}
            </div>
          </Panel>

          {data.nudges.length ? (
            <Panel title="Worth knowing" hint={`${data.nudgeCounts.critical} serious`}>
              <Nudges nudges={data.nudges} />
            </Panel>
          ) : null}

          <Panel title="Recent activity" flush>
            <ActivityFeed activity={data.activity} limit={10} />
            {!data.activity.length ? <Quiet>Nothing has happened in your groups yet.</Quiet> : null}
          </Panel>
        </div>
      </div>

      {moves.dialog}
    </div>
  );
}

/* ---------- pieces used only here --------------------------------------- */

/**
 * Seven days of committed hours.
 *
 * Bars are only drawn for days that actually hold work, against a single rule:
 * a chart of seven empty columns reads as broken, and it asks the reader to
 * work out that nothing is due when the sentence can simply say so.
 */
function WeekStrip({ week }: { week: DashboardPayload["week"] }) {
  const max = Math.max(1, ...week.map((day) => day.hours));
  const total = week.reduce((sum, day) => sum + day.hours, 0);
  const heaviest = week.reduce((best, day) => (day.hours > best.hours ? day : best), week[0] ?? { hours: 0, label: "", date: "" });

  return (
    <Panel
      title="The week ahead"
      hint={total > 0 ? `${hours(total)} due in the next seven days` : "nothing dated this week"}
      flush
    >
      {total === 0 ? (
        <div className="panel__body">
          <Quiet>
            No deadlines fall in the next seven days. Dates appear here as soon as a task in one of your groups is given one.
          </Quiet>
        </div>
      ) : (
        <div className="week">
          <div
            className="week__cols"
            role="img"
            aria-label={`Hours due each day for the next seven days: ${week
              .filter((day) => day.hours > 0)
              .map((day) => `${day.label} ${hours(day.hours)}`)
              .join(", ")}. Heaviest day: ${heaviest.label} at ${hours(heaviest.hours)}.`}
          >
            {week.map((day) => (
              <div key={day.date} className={`week__col${day.isToday ? " week__col--today" : ""}`} title={`${dateLabel(day.date)}: ${hours(day.hours)} due`}>
                <span className="week__value tnum">{day.hours > 0 ? hours(day.hours) : "–"}</span>
                <span className="week__track">
                  {day.hours > 0 ? (
                    <span className="week__bar" style={{ height: `${Math.max((day.hours / max) * 100, 5)}%` }} />
                  ) : null}
                </span>
                <span className="week__label">{day.isToday ? "Today" : day.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function DueMarkInline({ dueAt, overdue }: { dueAt: string | null; overdue?: boolean }) {
  if (!dueAt) return <span className="card__meta">no date</span>;
  return (
    <span className="card__meta nowrap" style={{ color: overdue ? "var(--color-risk)" : "var(--color-ink-3)", fontWeight: overdue ? 600 : 400 }}>
      {dateLabel(dueAt)}
    </span>
  );
}

function MemberFaces({ members }: { members: DashboardPayload["cards"][number]["members"] }) {
  return (
    <span className="row" style={{ gap: "0.15rem" }} aria-hidden="true">
      {members.slice(0, 5).map((member) => (
        <Avatar key={member.id} name={member.name} hue={member.hue} size="sm" />
      ))}
    </span>
  );
}

function CheckinCard({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const { push } = useToast();
  const [mood, setMood] = useState<(typeof MOODS)[number]["value"]>("steady");
  const [note, setNote] = useState("");
  const [blockers, setBlockers] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await post(`/api/projects/${projectId}/checkin`, { mood, note, blockers });
      push({ title: "Checked in", detail: "Your group can see it on the project.", tone: "good" });
      onDone();
    } catch (cause) {
      push({ title: "That did not save", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
      setBusy(false);
    }
  };

  return (
    <Panel title="Check in" hint="once a week, per group">
      <div className="stack stack--tight">
        <div className="checkin-moods">
          {MOODS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="checkin-mood"
              aria-pressed={mood === option.value}
              onClick={() => setMood(option.value)}
              title={option.blurb}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field__label">How is it going?</span>
          <textarea className="textarea" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="roughly where I expected to be" />
        </label>
        <label className="field">
          <span className="field__label">Anything in the way?</span>
          <input className="input" value={blockers} onChange={(event) => setBlockers(event.target.value)} placeholder="waiting on the shared folder" />
        </label>
        <div className="row">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving…" : "Save check-in"}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onDone}>
            Cancel
          </button>
        </div>
      </div>
    </Panel>
  );
}