/**
 * The roster.
 *
 * One row per student, ordered the way a teacher needs to read it: whoever is
 * furthest behind first, because that is who the lesson has to start with. The
 * load bar is the same mark as everywhere else, so "behind" here means the same
 * thing it means on a group's board.
 *
 * Removing somebody is deliberately hidden behind a confirm that says what
 * actually happens: their work stays on the record and their open tasks are
 * released, not deleted.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { del } from "../../lib/api";
import { ApiError } from "../../lib/api";
import { useToast } from "../../lib/live";
import { hours, plural } from "../../lib/format";
import { Avatar, EmptyState, LoadBar, Panel, StateChip, Tag } from "../../components/ui";
import { FlagList, Quiet } from "../../components/blocks";
import { Confirm, Menu } from "../../components/overlays";
import { IconPlus } from "../../components/icons";
import type { ClassStudent, ClassroomOverview } from "../../lib/types";

export function RosterTab({
  overview,
  onChanged,
  onAddStudents,
}: {
  overview: ClassroomOverview;
  onChanged: () => void;
  onAddStudents: () => void;
}) {
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<ClassStudent | null>(null);
  const [busy, setBusy] = useState(false);

  const students = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? overview.students.filter((student) => `${student.name} ${student.email} ${student.headline}`.toLowerCase().includes(needle))
      : overview.students;
    // Behind first, then quiet, then everybody else by name — the order a
    // teacher would ask for if they had to pick one.
    const rank = (student: ClassStudent) => (student.state === "behind" ? 0 : student.state === "overloaded" ? 1 : student.state === "quiet" ? 2 : 3);
    return [...list].sort((a, b) => rank(a) - rank(b) || b.owed - a.owed || a.name.localeCompare(b.name));
  }, [overview.students, query]);

  const behind = overview.students.filter((student) => student.state === "behind").length;

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await del(`/api/classrooms/${overview.classroom.id}/students/${removing.id}`);
      push({ title: `${removing.name} is off the roster`, detail: "Their work stays on the record and their open tasks were released.", tone: "good" });
      setRemoving(null);
      onChanged();
    } catch (cause) {
      push({ title: "That did not remove them", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  if (!overview.students.length) {
    return (
      <Panel title="Nobody is on the roster yet">
        <EmptyState
          title="Add your students to begin"
          text="Add them by email, or hand out the join code and they add themselves. Once they are on the roster you can build groups, and every number on this page starts to mean something."
          action={
            overview.viewer.isTeacher ? (
              <button type="button" className="btn btn--primary btn--sm" onClick={onAddStudents}>
                <IconPlus size={12} />
                Add students
              </button>
            ) : undefined
          }
        />
      </Panel>
    );
  }

  return (
    <div className="stack stack--loose">
      <Panel
        flush
        title="The roster"
        hint={`${plural(overview.students.length, "student")}${behind ? ` · ${behind} behind an even share` : ""}`}
        actions={
          <>
            <input
              className="input"
              style={{ maxWidth: "14rem" }}
              placeholder="Search by name or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search the roster"
            />
            {overview.viewer.isTeacher ? (
              <button type="button" className="btn btn--outline btn--sm" onClick={onAddStudents}>
                <IconPlus size={12} />
                Add students
              </button>
            ) : null}
          </>
        }
      >
        {students.map((student) => (
          <StudentRow
            key={student.id}
            student={student}
            classroomId={overview.classroom.id}
            canRemove={overview.viewer.isTeacher}
            onRemove={() => setRemoving(student)}
          />
        ))}
        {!students.length ? (
          <div className="panel__body">
            <Quiet>Nobody on the roster matches that.</Quiet>
          </div>
        ) : null}
      </Panel>

      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
        busy={busy}
        danger
        title={removing ? `Take ${removing.name} off this class?` : ""}
        confirmLabel="Take them off"
        body={
          removing
            ? `${removing.name} stops seeing the class and its groups. Everything they have already done stays on the record — the hours, the reviews and the closed tasks are not deleted. Any task still open on them is released back to its group to be picked up by somebody else.`
            : ""
        }
      />
    </div>
  );
}

function StudentRow({
  student,
  classroomId,
  canRemove,
  onRemove,
}: {
  student: ClassStudent;
  classroomId: string;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const active = student.projects.length;
  const to = `/classrooms/${classroomId}/students/${student.id}`;

  return (
    <div className="panel__body" style={{ borderBottom: "1px solid var(--color-line)" }}>
      <div className="stack stack--tight">
        <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
          <span className="row" style={{ gap: "0.5rem", minWidth: 0 }}>
            <Avatar name={student.name} hue={student.hue} size="sm" />
            <span style={{ minWidth: 0 }}>
              <Link className="tap" to={to} style={{ display: "block", fontWeight: 600, fontSize: "var(--text-sm)" }}>
                {student.name}
              </Link>
              <span className="card__meta truncate" style={{ display: "block", maxWidth: "28ch" }}>
                {student.headline || student.email}
              </span>
            </span>
          </span>

          <span className="row row--wrap" style={{ gap: "0.4rem" }}>
            <StateChip state={student.state} hours={student.owed} />
            {student.acrossGroups ? <Tag edge>in more than one group</Tag> : null}
            <span className="card__meta tnum nowrap" title="Hours delivered against an even share across every group they are in">
              {hours(student.totals.credited)} of {hours(student.totals.even)} even
              {Math.abs(student.owed) > 0.3 ? ` · ${hours(Math.abs(student.owed))} ${student.owed > 0 ? "behind" : "ahead"}` : " · level"}
            </span>
            {canRemove ? (
              <Menu
                label="More"
                align="right"
                items={[{ label: "Take them off the class", onSelect: onRemove, danger: true, hint: "their work stays" }]}
              />
            ) : (
              <Link className="btn btn--ghost btn--sm" to={to}>
                Record
              </Link>
            )}
          </span>
        </div>

        <LoadBar
          name={student.name}
          hue={student.hue}
          hours={student.totals.credited}
          even={student.totals.even}
          capacity={student.totals.available}
          leftLabel={<span className="label">Delivered against an even share</span>}
          caption={
            active
              ? `across ${plural(active, "group")}${student.totals.open ? ` · ${hours(student.totals.open)} still open` : ""}`
              : "not on a group yet"
          }
        />

        {student.flags.length ? <FlagList flags={student.flags} limit={2} /> : null}
        {!active ? (
          <Quiet>Not on a group yet, so there is nothing to split. An even share only means something once a group exists.</Quiet>
        ) : null}
      </div>
    </div>
  );
}