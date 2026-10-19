/**
 * The console's four dialogs.
 *
 * They live together because they are all "change something about this class",
 * and because keeping them next to each other makes it obvious that every one of
 * them writes through the same two endpoints and refreshes the single overview
 * request the console already holds.
 *
 * The fairness policy is written as `{policy: {policy: {...}}}`, which looks
 * absurd but is what the server expects: the outer key is the classroom's config
 * column and the inner one is the policy block inside it. The server merges over
 * the defaults, so sending only what changed is enough.
 */
import { useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, patch, post } from "../../lib/api";
import { useToast } from "../../lib/live";
import { dateInput, hours, plural } from "../../lib/format";
import { parsePeople } from "../../lib/people";
import { Field, Segmented } from "../../components/ui";
import { Quiet } from "../../components/blocks";
import { Dialog } from "../../components/overlays";
import { IconArrowRight, IconCheck } from "../../components/icons";
import type { ClassStudent, ClassroomOverview } from "../../lib/types";

/* ---------- adding students --------------------------------------------- */

export function AddStudentsDialog({
  open,
  onClose,
  classroomId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  classroomId: string;
  onDone: () => void;
}) {
  const { push } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Array<{ name: string; email: string; alreadyEnrolled: boolean }> | null>(null);

  const students = parsePeople(text);

  const close = () => {
    onClose();
    setText("");
    setError(null);
    setResult(null);
  };

  const submit = async () => {
    if (!students.length) {
      setError("Add at least one address. One per line is easiest.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await post<{ added: Array<{ name: string; email: string; alreadyEnrolled: boolean }> }>(
        `/api/classrooms/${classroomId}/students`,
        { students },
      );
      setResult(payload.added);
      const fresh = payload.added.filter((person) => !person.alreadyEnrolled);
      push({
        title: fresh.length ? `${plural(fresh.length, "student")} added` : "Nobody new was added",
        detail: fresh.length
          ? fresh.map((person) => person.name).join(", ")
          : payload.added.length
            ? "Everybody on that list was already in the class."
            : undefined,
        tone: "good",
      });
      onDone();
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "That did not save.";
      setError(message);
      push({ title: "Those students were not added", detail: message, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      width="md"
      title={result ? "The roster is updated" : "Add students"}
      sub={result ? "Everyone who was not already in the class now has an account and can fill in their strengths." : "One address per line. A name can go in front of the address."}
      footer={
        result ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Done
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => {
                setResult(null);
                setText("");
              }}
            >
              Add more
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
              {busy ? "Adding…" : `Add ${students.length || ""}`.trim()}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="stack stack--tight">
          {result.map((person) => (
            <div key={person.email} className="row row--between" style={{ gap: "0.5rem" }}>
              <span style={{ minWidth: 0 }}>
                <span className="rowitem__title" style={{ display: "block" }}>
                  {person.name}
                </span>
                <span className="rowitem__sub">{person.email}</span>
              </span>
              <span className="card__meta nowrap">{person.alreadyEnrolled ? "already in the class" : "added"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="stack">
          <Field label="Their email addresses" required error={error} hint="People already in the class are skipped, not duplicated.">
            <textarea
              className="textarea"
              rows={7}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={"aisha@example.com\nDiego Marín <diego@example.com>"}
              autoFocus
            />
          </Field>
          <Quiet>
            An address that has never signed in gets an account with no password, and joins this class straight away. They fill in their own
            strengths — nobody can set a level for somebody else.
          </Quiet>
        </div>
      )}
    </Dialog>
  );
}

/* ---------- editing the class -------------------------------------------- */

export function EditClassDialog({
  open,
  onClose,
  overview,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  overview: ClassroomOverview;
  onDone: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState(overview.classroom.name);
  const [subject, setSubject] = useState(overview.classroom.subject);
  const [term, setTerm] = useState(overview.classroom.term);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim().length < 2) {
      setError("A class needs a name of at least two characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patch(`/api/classrooms/${overview.classroom.id}`, { name: name.trim(), subject: subject.trim(), term: term.trim() });
      push({ title: "The class is updated", tone: "good" });
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="narrow"
      title="Edit the class"
      sub="The name is what students see on their own screens."
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label="Class name" required error={error}>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </Field>
        <div className="grid grid--halves" style={{ gap: "1rem" }}>
          <Field label="Subject">
            <input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Design & Systems" />
          </Field>
          <Field label="Term">
            <input className="input" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Autumn term" />
          </Field>
        </div>
        <Quiet>The join code ({overview.classroom.code}) does not change, so nobody already holding it is locked out.</Quiet>
      </div>
    </Dialog>
  );
}

/* ---------- the fairness policy ------------------------------------------ */

export function PolicyDialog({
  open,
  onClose,
  overview,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  overview: ClassroomOverview;
  onDone: () => void;
}) {
  const { push } = useToast();
  const start = overview.classroom.policy.policy;
  const [autoAssign, setAutoAssign] = useState(start.autoAssign);
  const [allowStretch, setAllowStretch] = useState(start.allowStretch);
  const [enforceCapacity, setEnforceCapacity] = useState(start.enforceCapacity);
  const [requireReview, setRequireReview] = useState(start.requireReview);
  const [shareGapFlag, setShareGapFlag] = useState(start.shareGapFlag);
  const [freeRiderShare, setFreeRiderShare] = useState(start.freeRiderShare);
  const [silenceDays, setSilenceDays] = useState(start.silenceDays);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await patch(`/api/classrooms/${overview.classroom.id}`, {
        policy: { policy: { autoAssign, allowStretch, enforceCapacity, requireReview, shareGapFlag, freeRiderShare, silenceDays } },
      });
      push({ title: "The policy is updated", detail: "Every group in the class is held to it from now on — the change is meant to be retroactive.", tone: "good" });
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="md"
      title="The fairness policy"
      sub="What every group in this class is measured against. Changing it re-reads the work that already exists, on purpose: the rule was wrong, not the work."
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving…" : "Save the policy"}
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="switch">
          <input type="checkbox" checked={requireReview} onChange={(event) => setRequireReview(event.target.checked)} />
          Nothing closes without somebody else checking it first
        </label>
        <label className="switch">
          <input type="checkbox" checked={enforceCapacity} onChange={(event) => setEnforceCapacity(event.target.checked)} />
          Never hand work to somebody already past their hours
        </label>
        <label className="switch">
          <input type="checkbox" checked={allowStretch} onChange={(event) => setAllowStretch(event.target.checked)} />
          Allow work to go to somebody who has not done it before
        </label>
        <label className="switch">
          <input type="checkbox" checked={autoAssign} onChange={(event) => setAutoAssign(event.target.checked)} />
          Let the allocator place work without being asked
        </label>

        <Field
          label={`A share gap worth flagging: ${Math.round(shareGapFlag * 100)}%`}
          hint="When somebody carries this much more than an even share, the engine says so. Lower is stricter."
        >
          <input
            className="range"
            type="range"
            min={0.1}
            max={0.7}
            step={0.05}
            value={shareGapFlag}
            onChange={(event) => setShareGapFlag(Number(event.target.value))}
            aria-label="Share gap worth flagging"
          />
        </Field>

        <Field
          label={`Not carrying a share below: ${Math.round(freeRiderShare * 100)}%`}
          hint="Somebody delivering less than this fraction of their committed work is called out. Higher is stricter."
        >
          <input
            className="range"
            type="range"
            min={0.3}
            max={0.95}
            step={0.05}
            value={freeRiderShare}
            onChange={(event) => setFreeRiderShare(Number(event.target.value))}
            aria-label="Free-rider threshold"
          />
        </Field>

        <Field label="A silence is" hint="Days without a contribution or a check-in before the engine says somebody has gone quiet.">
          <div className="row" style={{ gap: "0.5rem" }}>
            <input
              className="input"
              type="number"
              min={2}
              max={21}
              value={silenceDays}
              onChange={(event) => setSilenceDays(Number(event.target.value))}
              style={{ maxWidth: "6rem" }}
              aria-label="Days of silence"
            />
            <span className="label">days</span>
          </div>
        </Field>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/* ---------- setting an assignment ---------------------------------------- */

/**
 * The console's own way of setting work for the whole class at once.
 *
 * The endpoint behind it always creates one project per team, so "the whole
 * class" is simply one team containing everybody. A teacher who wants several
 * groups wants the group builder, and the dialog says so rather than pretending
 * to do both.
 */
export function AssignmentDialog({
  open,
  onClose,
  overview,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  overview: ClassroomOverview;
  onDone: () => void;
}) {
  const { push } = useToast();
  const students: ClassStudent[] = overview.students;
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [dueAt, setDueAt] = useState(dateInput(overview.projects[0]?.dueAt ?? null));
  const [scope, setScope] = useState<"whole" | "builder">("whole");
  const [autoPlan, setAutoPlan] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    setName("");
    setBrief("");
    setError(null);
  };

  const submit = async () => {
    if (name.trim().length < 2) {
      setError("Name the assignment — it becomes the group name too, so “Bus corridor campaign” reads better than “Assignment 3”.");
      return;
    }
    if (!students.length) {
      setError("There is nobody on the roster yet, so there is nobody to give work to. Add students first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await post<{ created: Array<{ id: string; name: string }> }>(`/api/classrooms/${overview.classroom.id}/projects`, {
        name: name.trim(),
        brief: brief.trim(),
        dueAt: dueAt || null,
        teams: [{ name: "Everyone", memberIds: students.map((student) => student.id) }],
        autoPlan,
        autoAssign: autoPlan && autoAssign,
      });
      push({
        title: `${plural(result.created.length, "group")} set`,
        detail: autoPlan && brief.trim() ? "The brief was planned into tasks." : "The board starts empty and is yours to fill.",
        tone: "good",
      });
      onDone();
      close();
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "That did not write.";
      setError(message);
      push({ title: "That assignment did not save", detail: message, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      width="md"
      title="Set an assignment"
      sub="For the whole class at once. To split the class into groups, use the group builder instead."
      footer={
        scope === "builder" ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Cancel
            </button>
            <Link className="btn btn--primary" to={`/classrooms/${overview.classroom.id}/groups`}>
              Open the group builder
              <IconArrowRight size={12} />
            </Link>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
              <IconCheck size={13} />
              {busy ? "Setting it…" : "Set it"}
            </button>
          </>
        )
      }
    >
      <div className="stack">
        <Field label="Who is this for" hint="A class assignment is one project; groups are projects too.">
          <Segmented
            ariaLabel="Who the assignment is for"
            value={scope}
            onChange={setScope}
            options={[
              { value: "whole", label: `The whole class · ${plural(students.length, "student")}` },
              { value: "builder", label: "Split them into groups" },
            ]}
          />
        </Field>

        {scope === "builder" ? (
          <Quiet>
            The group builder forms balanced teams from the roster — you keep the arrangement you like, then commit it as an assignment. It
            writes the same kind of project this dialog would.
          </Quiet>
        ) : (
          <>
            <Field label="What is the assignment called?" required error={error}>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Bus corridor campaign" autoFocus />
            </Field>

            <Field
              label="The brief"
              hint="Paste what the class was told. With “Plan the tasks” on, this is read into sized tasks against the date."
            >
              <textarea className="textarea" rows={7} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Work in your group of four. Produce a poster, a leaflet and a five-minute pitch…" />
            </Field>

            <div className="grid grid--halves" style={{ gap: "1rem" }}>
              <Field label="Hand in">
                <input className="input" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
              </Field>
              <Field label="The board starts as" hint="Both steps are reversible from the board itself.">
                <div className="stack stack--tight">
                  <label className="switch">
                    <input type="checkbox" checked={autoPlan} onChange={(event) => setAutoPlan(event.target.checked)} />
                    Plan the tasks from the brief
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={autoPlan && autoAssign}
                      disabled={!autoPlan}
                      onChange={(event) => setAutoAssign(event.target.checked)}
                    />
                    Place the work with the allocator
                  </label>
                </div>
              </Field>
            </div>

            <Quiet>
              This creates one project for the whole class, so {plural(students.length, "student")} share one board and one even share of{" "}
              {hours(students.reduce((sum, student) => sum + student.capacity, 0) / Math.max(1, students.length))} a week each.
            </Quiet>
          </>
        )}
      </div>
    </Dialog>
  );
}