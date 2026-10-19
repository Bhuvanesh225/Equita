/**
 * Who needs a person.
 *
 * The engine already wrote every sentence on this tab, and it already decided
 * how serious each one is, so nothing here is re-judged in the browser. The
 * three groups are the engine's own severities, in the order a teacher would
 * act on them.
 *
 * A student sees only the rows about themselves. Linking a classmate to a record
 * the server will refuse to open would be a broken promise, and the server is
 * right to refuse it.
 */
import { EmptyState, Panel, Tag } from "../../components/ui";
import { Nudges, PersonRow, Quiet } from "../../components/blocks";
import { IconArrowRight } from "../../components/icons";
import type { ClassroomOverview } from "../../lib/types";

const GROUPS: Array<{ severity: "critical" | "warn" | "info"; title: string; blurb: string }> = [
  { severity: "critical", title: "Needs looking at now", blurb: "somebody is past what they can finish, or far behind an even share" },
  { severity: "warn", title: "Worth a word", blurb: "drifting, or no sign of them for a while" },
  { severity: "info", title: "Not a problem, but knowable", blurb: "nobody's fault — they simply have no work yet" },
];

export function AttentionTab({ overview }: { overview: ClassroomOverview }) {
  const { attention, nudges, nudgeCounts, viewer, classroom } = overview;

  const visible = viewer.isTeacher ? attention : attention.filter((row) => row.studentId === viewer.id);
  const grouped = GROUPS.map((group) => ({
    ...group,
    rows: visible.filter((row) => row.severity === group.severity),
  }));

  const nothing = !visible.length && !nudges.length;

  return (
    <div className="stack stack--loose">
      {nothing ? (
        <Panel title="Nothing needs a person">
          <EmptyState
            title="Everyone is roughly where they should be"
            text={
              viewer.isTeacher
                ? "No group has tipped, nobody is past their capacity, and every task has an owner. This page fills in on its own the moment that changes."
                : "No group you are in has tipped, and nothing of yours is behind. This page fills in on its own if that changes."
            }
          />
        </Panel>
      ) : null}

      <Panel
        title="From the class engine"
        hint={`${nudgeCounts.critical} serious of ${nudgeCounts.total}`}
        actions={
          <Tag edge dot title="Every sentence here was written by the nudges engine">
            engine-written
          </Tag>
        }
        flush
      >
        {nudges.length ? (
          <div className="panel__body">
            <Nudges nudges={nudges} compact empty="Nothing the engine wants to raise about this class." />
          </div>
        ) : (
          <div className="panel__body">
            <Quiet>Nothing the engine wants to raise about this class right now.</Quiet>
          </div>
        )}
      </Panel>

      {grouped.map((group) =>
        group.rows.length ? (
          <Panel key={group.severity} title={group.title} hint={group.blurb} flush>
            {group.rows.map((row) => (
              <PersonRow
                key={`${row.kind}-${row.studentId}`}
                person={{ id: row.studentId, name: row.name, hue: row.hue }}
                note={row.detail}
                to={viewer.isTeacher ? `/classrooms/${classroom.id}/students/${row.studentId}` : undefined}
                right={
                  viewer.isTeacher ? (
                    /* The whole row is the link, so the arrow is decoration, not a second anchor. */
                    <span className="rowitem__go" aria-hidden="true">
                      <IconArrowRight size={14} />
                    </span>
                  ) : (
                    <Tag edge>{row.kind.replace(/-/g, " ")}</Tag>
                  )
                }
              />
            ))}
          </Panel>
        ) : null,
      )}

      {visible.length ? (
        <Quiet>
          Each of these is the equity engine reading hours that have actually been logged, not time spent. A quiet week with nothing logged
          looks the same as a quiet week with nothing done, which is why the check-in exists.
        </Quiet>
      ) : null}

      {!viewer.isTeacher && !visible.length && nudges.length ? (
        <Quiet>Nothing here is about you — the rows above are the class as a whole, which the engine writes for everybody in it.</Quiet>
      ) : null}
    </div>
  );
}