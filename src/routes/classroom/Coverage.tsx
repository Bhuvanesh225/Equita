/**
 * Where the class is thin.
 *
 * The group builder can only balance what the roster actually holds, so it is
 * worth seeing the shape of the roster before forming groups. A cluster nobody
 * is strong at is not an error — it is a fact the groups will have to work
 * around, and the engine already warns the groups that need it.
 */
import { plural } from "../../lib/format";
import { EmptyState, Meter, Panel, Stat, Tag } from "../../components/ui";
import { Quiet } from "../../components/blocks";
import { IconAlert } from "../../components/icons";
import type { ClassroomOverview } from "../../lib/types";

export function CoverageTab({ overview }: { overview: ClassroomOverview }) {
  const { coverage, gaps } = overview;
  const needed = gaps.filter((gap) => gap.needed);
  const covered = coverage.filter((row) => row.holders > 0);
  const empty = coverage.filter((row) => row.holders === 0);

  if (!coverage.length) {
    return (
      <Panel title="No coverage to read yet">
        <EmptyState
          title="Nobody's strengths are on file"
          text="Coverage is built from what each student says they are good at. Until somebody fills their strengths in, the class has no shape to measure."
        />
      </Panel>
    );
  }

  return (
    <div className="stack stack--loose">
      {needed.length ? (
        <div className="callout callout--over" role="status">
          <span className="row" style={{ gap: "0.5rem", alignItems: "flex-start" }}>
            <IconAlert size={15} />
            <span>
              Nobody in this class is strong at {needed.map((gap) => gap.name).join(", ")}. Groups that need it will be handed the work with a
              warning, and whoever takes it will be working outside what they have practised.
            </span>
          </span>
        </div>
      ) : null}

      <section className="grid grid--stats" aria-label="Coverage at a glance">
        <Stat value={overview.students.length} label="On the roster" note="everyone counts towards coverage" />
        <Stat
          value={`${covered.length} of ${coverage.length}`}
          label="Clusters covered"
          tone={covered.length === coverage.length ? "accent" : covered.length >= coverage.length * 0.75 ? "over" : "risk"}
          note="clusters with at least one holder"
        />
        <Stat
          value={empty.length}
          label="Nobody holds"
          tone={empty.length ? "over" : "accent"}
          note={empty.length ? "nobody named this at all" : "every cluster has somebody"}
        />
        <Stat value={needed.length} label="Groups will be warned about" tone={needed.length ? "over" : "accent"} note="clusters the groups need and the roster lacks" />
      </section>

      <Panel
        title="Every cluster the class could cover"
        hint="holders is anyone who named it; strong counts only the confident"
        flush
      >
        {coverage.map((row) => {
          const strength = Math.max(0, Math.min(100, (row.meanLevel / 5) * 100));
          return (
            <div key={row.cluster} className="panel__body" style={{ borderBottom: "1px solid var(--color-line)" }}>
              <div className="stack stack--tight">
                <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
                  <span className="row" style={{ gap: "0.4rem", minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{row.name}</span>
                    {row.holders === 0 ? <Tag tone="over" dot>nobody</Tag> : row.strong === 0 ? <Tag tone="quiet" edge>only just</Tag> : null}
                  </span>
                  <span className="card__meta tnum nowrap">
                    {plural(row.holders, "holder")} · {row.strong} strong · mean level {row.meanLevel.toFixed(1)} of 5
                  </span>
                </div>

                <Meter
                  label="Mean level"
                  value={strength}
                  mark={60}
                  showValue={false}
                  hint={`Mean self-reported level ${row.meanLevel.toFixed(2)} out of 5 across ${plural(row.holders, "holder")}. The tick is 3 out of 5.`}
                />

                {row.topHolders.length ? (
                  <div className="row row--wrap" style={{ gap: "0.35rem" }}>
                    <span className="label">Strongest</span>
                    {row.topHolders.map((holder) => (
                      <Tag key={holder.id} edge title={`Level ${holder.level} of 5`}>
                        {holder.name} · {holder.level}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <Quiet>Nobody in the class named this at all. Groups needing it will be flagged before they start.</Quiet>
                )}
              </div>
            </div>
          );
        })}
      </Panel>

      <Panel title="What to do about a gap" hint="the honest options">
        <div className="stack stack--tight">
          <Quiet>
            A gap is not a bug. It means the work that needs this cluster will be done by somebody learning it, which is slower and needs more
            of a teacher's eye. Equita flags it on the group rather than hiding it, and the allocator weights it as a stretch.
          </Quiet>
          <Quiet>
            If a student has skills on file that are wrong, their record is the place to fix them — coverage everywhere on this page is
            recomputed from the same list.
          </Quiet>
        </div>
      </Panel>
    </div>
  );
}