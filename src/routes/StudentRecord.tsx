/**
 * One person's record.
 *
 * A teacher opens this to decide whether to intervene; a student opens their own
 * to see what the group actually knows about them. The engine writes the reading
 * at the top, and everything below it is the evidence for that sentence — the
 * hours that were logged, the tasks that closed late, the check-ins where they
 * said they were stuck.
 *
 * The ledger is the honest part. A share of committed work is what somebody
 * agreed to take on; a share of delivered work is what they actually did. When a
 * project has no contributions yet this screen says so in words rather than
 * drawing a bar that would imply work happened.
 *
 * One request. The class's name comes from the session's memberships rather than
 * a second call to the class overview, which would run the equity engine over
 * every group in the class to answer a question this page does not ask.
 */
import { Link, useNavigate, useParams } from "react-router-dom";

import { useApi, useToast } from "../lib/live";
import { useSession } from "../lib/session";
import { decimal, hours, pct, plural, relativeTime } from "../lib/format";
import { EmptyState, LoadBar, Panel, Spinner, Stat, StateChip, Tag } from "../components/ui";
import { DueMark, MoodTag, PageHead, Quiet, ScoreMark, StatusTag } from "../components/blocks";
import { Sparkline } from "../components/charts";
import { Menu } from "../components/overlays";
import type { EquityMember, StudentRecord as StudentRecordShape } from "../lib/types";

const CONTRIBUTION_NAMES: Record<string, string> = {
  complete: "closed the work",
  help: "helped somebody else",
  progress: "logged time",
  review: "reviewed the work",
  unblock: "unblocked it",
  evidence: "added the evidence",
};

export default function StudentRecord() {
  const { classroomId = "", studentId = "" } = useParams();
  const { memberships, user } = useSession();
  const { push } = useToast();
  const navigate = useNavigate();
  const { data, loading, error, status, refresh } = useApi<StudentRecordShape>(`/api/classrooms/${classroomId}/students/${studentId}`);

  const classroom = memberships.find((entry) => entry.id === classroomId) ?? null;
  const own = user?.id === studentId;

  if (loading && !data) {
    return (
      <div className="page">
        <Spinner label="Reading the record" />
      </div>
    );
  }

  /*
   * A refusal is not a breakage. The server allows a teacher of the class and
   * the person themselves; anybody else gets a 403, and that deserves a plain
   * sentence with a way out rather than a retry button that will fail again the
   * same way.
   */
  if (status === 403) {
    return (
      <div className="page">
        <EmptyState
          title="That record is not yours to read"
          text="A person's hours, their check-ins and the reviews of their work are theirs and their teacher's. The class view is shared; this is not."
          action={
            <>
              <Link className="btn btn--primary" to={`/classrooms/${classroomId}`}>
                Back to the class
              </Link>
              <Link className="btn btn--outline" to="/today">
                Go to Today
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="That record did not load"
          text={error ?? "It may be that they left the class, or that the link is old."}
          action={
            <>
              <button type="button" className="btn btn--outline" onClick={refresh}>
                Try again
              </button>
              <Link className="btn btn--primary" to={`/classrooms/${classroomId}`}>
                Back to the class
              </Link>
            </>
          }
        />
      </div>
    );
  }

  const record = data;
  const { student, totals, top, growth, clusters, projects, reading } = record;
  const anyContributions = projects.some((project) => project.contributions.length > 0);

  const copyLink = () => {
    void navigator.clipboard?.writeText(`${window.location.origin}/classrooms/${classroomId}/students/${studentId}`).then(
      () => push({ title: "Link copied", detail: "It opens this record for anyone who may read it.", tone: "good" }),
      () => push({ title: "The clipboard was blocked", detail: "Copy the address bar instead.", tone: "bad" }),
    );
  };

  return (
    <div className="page">
      <PageHead
        kicker={
          <Link className="tap" to={`/classrooms/${classroomId}`}>
            {classroom ? classroom.name : "the class"} · roster
          </Link>
        }
        title={student.name}
        sub={
          <>
            {student.headline || "no headline"} · {hours(student.capacity)} a week
            {own ? " · this is you" : ""}
          </>
        }
        actions={
          <>
            {student.status && student.status !== "active" ? <Tag tone="over" dot>{student.status}</Tag> : null}
            <Menu
              label="More"
              items={[
                { label: "Copy a link to this record", onSelect: copyLink },
                { label: "Open the class", onSelect: () => navigate(`/classrooms/${classroomId}`), hint: classroom?.code },
              ]}
            />
          </>
        }
      />

      <Panel title="How they are going" hint="written by the engine from the numbers below it" recessed>
        <p style={{ fontSize: "var(--text-md)", lineHeight: 1.65, maxWidth: "76ch" }}>{reading}</p>
      </Panel>

      <section className="grid grid--stats" aria-label="Their totals across every group">
        <Stat
          value={hours(totals.credited)}
          label="Delivered"
          tone={totals.owed > 2 ? "over" : "accent"}
          note={`against an even share of ${hours(totals.even)}`}
        />
        <Stat value={hours(totals.committed)} label="Taken on" note={totals.evenCommitted ? `an even share of the work is ${hours(totals.evenCommitted)}` : "everything they agreed to hold"} />
        <Stat value={hours(totals.even)} label="Even delivered share" note="the comparison used by the load bars" />
        <Stat
          value={Math.abs(totals.owed) < 0.3 ? "level" : `${hours(Math.abs(totals.owed))} ${totals.owed > 0 ? "behind" : "ahead"}`}
          label="Against an even share"
          tone={Math.abs(totals.owed) < 0.3 ? "accent" : totals.owed > 0 ? "over" : "ink"}
          note="of the work that has actually landed"
        />
        <Stat value={hours(totals.open)} label="Still open" note={plural(totals.done, "task") + " closed"} />
        <Stat value={totals.done} label="Closed" note={totals.done ? "tasks they have finished" : "nothing closed yet"} />
        <Stat
          value={totals.late}
          label="Closed late"
          tone={totals.late ? "over" : "accent"}
          note={totals.late ? "past the date they were given" : "nothing has slipped"}
        />
      </section>

      <div className="grid grid--split">
        <Panel title="Where they are strong" hint={`${plural(clusters.length, "cluster")} from their own profile`}>
          {clusters.length ? (
            <div className="stack stack--tight">
              {clusters.map((cluster) => (
                <div key={cluster.cluster} className="row row--between" style={{ gap: "0.5rem" }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="rowitem__title">{cluster.name}</span>
                    <span className="rowitem__sub">
                      {plural(cluster.skills.length, "skill")} in this cluster
                    </span>
                  </span>
                  <span className="row" style={{ gap: "0.4rem" }}>
                    <span
                      className="meter__track"
                      style={{ width: "3.5rem" }}
                       title={`Self-reported strength ${decimal(cluster.level)} of 5 across ${plural(cluster.skills.length, "skill")} in ${cluster.name}`}
                    >
                      <span className="meter__fill meter--accent" style={{ width: pct(cluster.level / 5) }} />
                    </span>
                     <span className="tnum card__meta nowrap">{decimal(cluster.level)}/5</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Quiet>They have not set any strengths yet, so there is nothing to match work against.</Quiet>
          )}
          {top.length ? (
            <div className="row row--wrap" style={{ gap: "0.35rem", marginTop: "1rem" }}>
              <span className="label">Strongest</span>
              {top.map((skill) => (
                <Tag key={skill.slug} edge title={`Level ${skill.level} of 5 · appetite ${skill.appetite} of 5`}>
                  {skill.name} · {skill.level}
                </Tag>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel title="Where they want to grow" hint="what they said they want more of, not what they are good at">
          {growth.length ? (
            <div className="stack stack--tight">
              {growth.map((skill) => (
                <div key={skill.slug} className="row row--between" style={{ gap: "0.5rem" }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="rowitem__title">{skill.name}</span>
                    <span className="rowitem__sub">wants it · level {skill.level} of 5</span>
                  </span>
                  <span className="row" style={{ gap: "0.4rem" }}>
                    <span className="meter__track" style={{ width: "3.5rem" }} title={`Appetite ${skill.appetite} of 5`}>
                      <span className="meter__fill meter--accent" style={{ width: pct(skill.appetite / 5) }} />
                    </span>
                    <span className="tnum card__meta nowrap">{skill.appetite}/5</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Quiet>
              They have not marked any skill as one they want to grow into. That appetite is what lets the allocator hand somebody work
              they have not done before.
            </Quiet>
          )}
        </Panel>
      </div>

      {projects.length ? (
        <div className="stack stack--loose">
          <h2 className="section-title">
            Every group they are in
            <span className="label">{projects.length}</span>
          </h2>
          {projects.map((project) => (
            <ProjectBlock key={project.id} project={project} studentName={student.name} hue={student.hue} />
          ))}
        </div>
      ) : (
        <Panel title="Not in a group yet">
          <EmptyState
            title="They are on the roster but on no board"
            text="That is normal before the groups are built. Once they are in a group, this page fills in with the work they hold and the hours they log."
            action={
              <Link className="btn btn--outline btn--sm" to={`/classrooms/${classroomId}/groups`}>
                Build the groups
              </Link>
            }
          />
        </Panel>
      )}

      {anyContributions ? (
        <Quiet>
          Every hour above comes from a contribution somebody logged against a task. Nothing on this page is estimated from time spent, and no
          figure is entered by hand.
        </Quiet>
      ) : projects.length ? (
        <Quiet>
          No hours have been logged on any of these groups yet, so the shares above are commitments rather than a record. That distinction is the
          engine&rsquo;s own, and it is worth reading carefully.
        </Quiet>
      ) : null}
    </div>
  );
}

/* ---------- one group ---------------------------------------------------- */

function ProjectBlock({
  project,
  studentName,
  hue,
}: {
  project: StudentRecordShape["projects"][number];
  studentName: string;
  hue: number;
}) {
  const member: EquityMember | null = project.member;
  const open = project.tasks.filter((task) => task.status !== "done");
  const credited = project.history.filter((point) => point.credited !== null && point.credited !== undefined).map((point) => point.credited ?? 0);
  const hasLedger = project.contributions.length > 0;

  return (
    <Panel
      stacked
      title={<Link to={`/projects/${project.id}`}>{project.name}</Link>}
      hint={
        <span className="row" style={{ gap: "0.35rem" }}>
          {member ? <StateChip state={member.state} hours={member.owedCreditedHours} /> : null}
          <span className="card__meta">
            {plural(open.length, "task")} open · {project.tasks.length - open.length} closed
            {project.checkins.length ? ` · ${plural(project.checkins.length, "check-in")}` : ""}
          </span>
        </span>
      }
      actions={<ScoreMark score={project.equityScore} label="group fairness" />}
      foot={
        historyLength(credited) ? (
          <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
            <span className="card__meta">Delivered hours, week by week</span>
            <Sparkline values={credited} />
          </div>
        ) : (
          <span className="card__meta">No weekly snapshots yet — this group has just started.</span>
        )
      }
    >
      <div className="stack stack--loose">
        {member ? (
          <div className="stack stack--tight">
            <LoadBar
              name={studentName}
              hue={hue}
              hours={member.credited}
              even={member.even.credited}
              capacity={member.remainingCapacity}
              leftLabel={<span className="label">Delivered against an even share</span>}
              caption={
                Math.abs(member.owedCreditedHours) < 0.3
                  ? "level with an even share"
                  : member.owedCreditedHours > 0
                    ? `${hours(member.owedCreditedHours)} behind their share`
                    : `${hours(Math.abs(member.owedCreditedHours))} ahead of their share`
              }
            />
            <div className="row row--wrap" style={{ gap: "1.25rem" }}>
              <Stat size="sm" value={hours(member.committed)} label="Taken on" note={`an even share is ${hours(member.even.committed)}`} />
              <Stat size="sm" value={hours(member.open)} label="Open" note={`${plural(member.taskCount, "task")} in total`} />
              <Stat size="sm" value={member.doneCount} label="Closed" note={member.lateCloses ? `${plural(member.lateCloses, "close")} late` : "none closed late"} />
            </div>
          </div>
        ) : (
          <Quiet>They are not a member of this group any more, so the engine reports nothing about them here.</Quiet>
        )}

        <div className="grid grid--halves">
          <div className="stack stack--tight">
            <span className="label">What they hold</span>
            {project.tasks.length ? (
              project.tasks.map((task) => (
                <div key={task.id} className="rowitem" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="rowitem__title">{task.title}</span>
                    <span className="rowitem__sub">
                       <span>{hours(task.effort)}</span>
                       <DueMark dueAt={task.completedAt ?? task.dueAt} done={task.status === "done"} />
                       {task.late ? <Tag tone="risk" dot>late</Tag> : null}
                    </span>
                  </span>
                  <span className="row" style={{ gap: "0.4rem" }}>
                    <StatusTag status={task.status} />
                  </span>
                </div>
              ))
            ) : (
              <Quiet>Nothing is assigned to them on this board.</Quiet>
            )}
          </div>

          <div className="stack stack--tight">
            <span className="label">What they logged</span>
            {hasLedger ? (
              project.contributions.map((entry) => (
                <div key={entry.id} className="rowitem" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="rowitem__title">
                      {CONTRIBUTION_NAMES[entry.kind] ?? entry.kind}
                      {entry.taskTitle ? ` · ${entry.taskTitle}` : ""}
                    </span>
                    <span className="rowitem__sub">
                      {entry.note || "no note"}
                      {entry.createdAt ? ` · ${relativeTime(entry.createdAt)}` : ""}
                    </span>
                  </span>
                  <span className="tnum card__meta nowrap">{hours(entry.effort)}</span>
                </div>
              ))
            ) : (
              <Quiet>
                No hours have been logged on this group yet, so the share above is a commitment rather than a record of work done.
              </Quiet>
            )}
          </div>
        </div>

        {project.checkins.length ? (
          <div className="stack stack--tight">
            <span className="label">How they said it was going</span>
            {project.checkins.map((checkin) => (
              <div key={checkin.id} className="rowitem" style={{ gridTemplateColumns: "minmax(3rem,auto) minmax(0,1fr)" }}>
                <span className="label tnum" style={{ alignSelf: "start" }}>
                  {checkin.week}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="rowitem__title">
                    <MoodTag mood={checkin.mood} title="How they read their own week" />
                  </span>
                  {checkin.note ? <span className="rowitem__sub">{checkin.note}</span> : null}
                  {checkin.blockers ? (
                    <span className="rowitem__sub" style={{ color: "var(--color-risk)" }}>
                      Blocker: {checkin.blockers}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/** A sparkline needs two points to draw a line; one snapshot is not a trend. */
function historyLength(values: number[]): boolean {
  return values.length >= 2;
}
