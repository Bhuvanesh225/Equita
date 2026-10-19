/**
 * Classes.
 *
 * A class is the thing that turns Equita from a tool a group of friends use into
 * something a school runs. For a teacher this is the Monday list — is any group
 * drifting? For a student it is the door back into their class.
 *
 * The screen deliberately answers with the same three facts on every card:
 * how many people, how many groups, and what the groups' fairness reads. A class
 * with no groups says "no groups yet" rather than showing a zero, because a zero
 * would be a claim that the work is unfair rather than that there is none.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, post } from "../lib/api";
import { useApi, useToast } from "../lib/live";
import { useSession } from "../lib/session";
import { plural } from "../lib/format";
import { EmptyState, Field, Panel, Spinner, Stat, Tag } from "../components/ui";
import { JoinCode, PageHead, Quiet, ScoreMark } from "../components/blocks";
import { ComparisonBars } from "../components/charts";
import { Dialog } from "../components/overlays";
import { IconArrowRight, IconPlus } from "../components/icons";
import type { Classroom } from "../lib/types";

export default function Classrooms() {
  const { user, joinClass } = useSession();
  const { data, loading, error, refresh } = useApi<{ classrooms: Classroom[] }>("/api/classrooms");
  const { push } = useToast();

  const [startOpen, setStartOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const classrooms = data?.classrooms ?? [];
  const teaching = useMemo(() => classrooms.filter((classroom) => classroom.isTeacher), [classrooms]);

  const students = classrooms.reduce((sum, classroom) => sum + (classroom.students ?? 0), 0);
  const groups = classrooms.reduce((sum, classroom) => sum + (classroom.projects ?? 0), 0);
  const scored = classrooms.filter((classroom) => classroom.meanScore != null);
  const mean = scored.length ? scored.reduce((sum, classroom) => sum + (classroom.meanScore ?? 0), 0) / scored.length : null;

  if (loading && !data) {
    return (
      <div className="page">
        <Spinner label="Reading your classes" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="Your classes did not load"
          text={error ?? "Something went wrong reading them."}
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

  const isTeacherAccount = user?.role === "teacher";

  return (
    <div className="page">
      <PageHead
        kicker="Classes"
        title="Your classes"
        sub="A class holds the roster and the fairness policy every group in it is held to. The groups inside still run their own boards — that is the point."
        actions={
          <>
            {isTeacherAccount ? (
              <button type="button" className="btn btn--primary" onClick={() => setStartOpen(true)}>
                <IconPlus size={14} />
                Start a class
              </button>
            ) : null}
            <button type="button" className={isTeacherAccount ? "btn btn--outline" : "btn btn--primary"} onClick={() => setJoinOpen(true)}>
              Join with a code
            </button>
          </>
        }
      />

      {classrooms.length ? (
        <section className="grid grid--stats" aria-label="Across your classes">
          <Stat value={classrooms.length} label="Classes" note={teaching.length === classrooms.length ? "you teach them all" : `${teaching.length} of them you teach`} />
          <Stat
            value={students}
            label={teaching.length ? "Students on your rosters" : "Classmates"}
            note={teaching.length ? "everyone enrolled in a class you teach" : "everyone in a class with you"}
          />
          <Stat value={groups} label="Groups running" note="each one has its own board" />
          <Stat
            value={mean === null ? "—" : mean.toFixed(1)}
            label="Mean fairness"
            tone={mean === null ? undefined : mean >= 75 ? "accent" : mean >= 55 ? "over" : "risk"}
            note={scored.length ? `across ${plural(scored.length, "class", "classes")} with groups` : "no groups yet, so nothing to score"}
          />
        </section>
      ) : null}

      {scored.length > 1 ? (
        <Panel title="Side by side" hint="mean fairness of each class, weakest first">
          <ComparisonBars
            ariaLabel="Mean fairness of each of your classes"
            items={[...scored]
              .sort((a, b) => (a.meanScore ?? 0) - (b.meanScore ?? 0))
              .map((classroom) => ({
                id: classroom.id,
                label: (
                  <Link className="tap" to={`/classrooms/${classroom.id}`}>
                    {classroom.name}
                  </Link>
                ),
                value: classroom.meanScore ?? 0,
                tone: (classroom.meanScore ?? 0) >= 75 ? "var(--color-accent)" : (classroom.meanScore ?? 0) >= 55 ? "var(--color-over)" : "var(--color-risk)",
                note: `${plural(classroom.projects ?? 0, "group")} · ${plural(classroom.students ?? 0, "student")}`,
              }))}
          />
        </Panel>
      ) : null}

      {classrooms.length ? (
        <section className="grid grid--halves" aria-label="Your classes">
          {classrooms.map((classroom) => (
            <ClassCard key={classroom.id} classroom={classroom} />
          ))}
        </section>
      ) : (
        <Panel title="No classes yet">
          <EmptyState
            title={isTeacherAccount ? "You have no classes yet" : "You are not in a class yet"}
            text={
              isTeacherAccount
                ? "Start one and add your students by email, or hand them the join code and they add themselves. Then build the groups, and each group gets its own board."
                : "Your teacher can add you, or you can join with the code they gave you. Once you are in, the groups you are part of appear here and on Today."
            }
            action={
              isTeacherAccount ? (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setStartOpen(true)}>
                  Start a class
                </button>
              ) : (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setJoinOpen(true)}>
                  Join with a code
                </button>
              )
            }
          />
        </Panel>
      )}

      {classrooms.length && teaching.length === 0 && isTeacherAccount ? (
        <Panel title="Setting a class assignment" hint="needs a class you teach">
          <Quiet>
            You are a teacher account but you do not run a class yet. Start one to set assignments in it — the roster, the fairness policy
            and the group builder all belong to a class you own.
          </Quiet>
        </Panel>
      ) : null}

      <StartClassDialog open={startOpen} onClose={() => setStartOpen(false)} onDone={refresh} />
      <JoinClassDialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoin={async (code) => {
          const classroom = await joinClass(code);
          await refresh();
          push({ title: `You are in ${classroom.name}`, detail: "Your teacher can add you to a group now.", tone: "good" });
        }}
      />
    </div>
  );
}

/* ---------- one class ---------------------------------------------------- */

function ClassCard({ classroom }: { classroom: Classroom }) {
  const teacher = !!classroom.isTeacher;
  const hasScore = classroom.meanScore != null;

  return (
    <Panel
      stacked
      title={<Link to={`/classrooms/${classroom.id}`}>{classroom.name}</Link>}
      hint={
        <span className="row" style={{ gap: "0.35rem" }}>
          <Tag edge>{teacher ? "you teach this" : "you are in this"}</Tag>
          {classroom.subject ? <Tag edge>{classroom.subject}</Tag> : null}
          {classroom.term ? <span className="card__meta">{classroom.term}</span> : null}
        </span>
      }
      actions={hasScore ? <ScoreMark score={classroom.meanScore as number} label="mean fairness" /> : <Tag tone="quiet" edge>no groups yet</Tag>}
      foot={
        <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
          <JoinCode code={classroom.code} />
          <span className="row" style={{ gap: "0.5rem" }}>
            {teacher && (classroom.students ?? 0) >= 2 ? (
              <Link className="btn btn--outline btn--sm" to={`/classrooms/${classroom.id}/groups`}>
                Build the groups
              </Link>
            ) : null}
            <Link className="btn btn--primary btn--sm" to={`/classrooms/${classroom.id}`}>
              Open
              <IconArrowRight size={12} />
            </Link>
          </span>
        </div>
      }
    >
      <div className="row row--wrap" style={{ gap: "1.25rem" }}>
        <Stat size="sm" value={classroom.students ?? 0} label="Students" note={(classroom.students ?? 0) === 0 ? "nobody on the roster yet" : "on the roster"} />
        <Stat size="sm" value={classroom.projects ?? 0} label="Groups" note={(classroom.projects ?? 0) === 0 ? "no groups built yet" : "with a board of their own"} />
      </div>

      {(classroom.students ?? 0) === 0 ? (
        <Quiet>
          {teacher
            ? "Nobody is on the roster yet. Add students by email, or send them the code above."
            : "The roster is empty, which usually means the teacher is still setting the class up."}
        </Quiet>
      ) : (classroom.projects ?? 0) === 0 ? (
        <Quiet>
          {teacher
            ? "No groups yet. Build them from the roster and each one becomes a board with its own fairness reading."
            : "No groups yet. When your teacher sets the assignment, your group appears here and on Today."}
        </Quiet>
      ) : null}
    </Panel>
  );
}

/* ---------- starting a class --------------------------------------------- */

function StartClassDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { push } = useToast();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string; code: string } | null>(null);

  const close = () => {
    onClose();
    setName("");
    setSubject("");
    setTerm("");
    setError(null);
    setCreated(null);
  };

  const submit = async () => {
    if (name.trim().length < 2) {
      setError("Give the class a name of at least two characters — a subject and a set, like “Systems Design 2A”.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await post<{ classroom: { id: string; name: string; code: string } }>("/api/classrooms", {
        name: name.trim(),
        subject: subject.trim(),
        term: term.trim(),
      });
      setCreated(result.classroom);
      onDone();
      push({ title: `${result.classroom.name} is open`, detail: `Its join code is ${result.classroom.code}.`, tone: "good" });
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "That did not save.";
      setError(message);
      push({ title: "That class did not save", detail: message, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      width="narrow"
      title={created ? "The class is open" : "Start a class"}
      sub={created ? "Hand the code out, or add people by email from the console." : "The roster and the fairness policy live here. You can change both later."}
      footer={
        created ? (
          <button type="button" className="btn btn--primary" onClick={close}>
            Done
          </button>
        ) : (
          <>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
              {busy ? "Opening it…" : "Create the class"}
            </button>
          </>
        )
      }
    >
      {created ? (
        <div className="stack">
          <div className="callout callout--accent">
            <strong>{created.name}</strong> exists. Students join with the code <strong className="tnum">{created.code}</strong>.
          </div>
          <div className="row row--wrap">
            <Link className="btn btn--outline btn--sm" to={`/classrooms/${created.id}`} onClick={close}>
              Open the class console
              <IconArrowRight size={12} />
            </Link>
            <Link className="btn btn--ghost btn--sm" to={`/classrooms/${created.id}/groups`} onClick={close}>
              Build the groups
            </Link>
          </div>
        </div>
      ) : (
        <div className="stack">
          <Field label="What is the class called?" required htmlFor="class-name" error={error}>
            <input
              id="class-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Systems Design 2A"
              autoFocus
              autoComplete="off"
            />
          </Field>
          <div className="grid grid--halves" style={{ gap: "1rem" }}>
            <Field label="Subject" hint="Optional.">
              <input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Design & Systems" autoComplete="off" />
            </Field>
            <Field label="Term" hint="Optional.">
              <input className="input" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Autumn term" autoComplete="off" />
            </Field>
          </div>
          <Quiet>
            A class holds the roster and the policy every group is held to — how big a share gap is worth flagging, how many quiet days count
            as going quiet, and whether work must be checked before it closes.
          </Quiet>
        </div>
      )}
    </Dialog>
  );
}

/* ---------- joining a class ---------------------------------------------- */

function JoinClassDialog({ open, onClose, onJoin }: { open: boolean; onClose: () => void; onJoin: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    setCode("");
    setError(null);
  };

  const submit = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 3) {
      setError("That code looks too short. They look like SYS-2A.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onJoin(clean);
      close();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That code did not match a class.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      width="narrow"
      title="Join a class"
      sub="Your teacher will have given you a short code — letters and a number."
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={close}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Checking…" : "Join"}
          </button>
        </>
      }
    >
      <Field label="Class code" htmlFor="join-code" error={error} hint="Not case-sensitive. Spaces are ignored.">
        <input
          id="join-code"
          className="input"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="SYS-2A"
          autoFocus
          autoComplete="off"
          style={{ fontSize: "var(--text-xl)", letterSpacing: "0.18em", fontVariantNumeric: "tabular-nums" }}
        />
      </Field>
    </Dialog>
  );
}
