/**
 * The middle of the page: how the score is made, what the product does, and the
 * teacher's half of it. Every number here comes from the same payload as the
 * hero, so the page cannot drift out of step with the demo dataset.
 */
import { hours, scoreTone, stateTone, toneTextClass, toneVar } from "../../lib/format";
import { MemberDot, ShareBar, Tag } from "../../components/ui";
import { SectionHead, Sheet } from "./parts";
import { PART_DEFINITIONS } from "./story";
import type { Story, StorySituation } from "./types";

const short = (situation: StorySituation) => situation.lane.title.replace(/^The group (that |)/, "").replace(/^The /, "");

/* ---------- 02 · how a fairness score is made --------------------------- */

export function Scoring({ situations }: { situations: StorySituation[] }) {
  const weights = situations[0]?.weights ?? {};
  const weightLine = ["balance", "delivery", "spread", "engagement", "readiness"]
    .filter((key) => weights[key])
    .map((key) => `${Math.round(weights[key] * 100)}% ${key}`)
    .join(" · ");

  return (
    <section className="land__band" id="scoring">
      <div className="land__wrap stack-l">
        <SectionHead
          index="02"
          title="A fairness score you can argue with"
          sub="Five parts, each out of a hundred, each weighted. Nothing here is a black box — every part is defined below, and the three groups are the same three from the panel above, scored as they stand today."
        />

        <div className="roll land__reveal" data-reveal>
          <div className="roll__head">
            <span className="land__eyebrow">The five parts · each out of 100</span>
            <span className="land__eyebrow">weighted, then added</span>
          </div>

          <div className="scroll-x">
            <table className="roll__table">
              <thead>
                <tr>
                  <th style={{ minWidth: "6rem" }}>Part</th>
                  <th>What it measures</th>
                  {situations.map((situation) => (
                    <th key={situation.id} style={{ whiteSpace: "nowrap" }}>
                      {short(situation)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PART_DEFINITIONS.map(([key, label, what]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td style={{ color: "var(--color-ink-2)", fontVariantNumeric: "normal", minWidth: "17rem", lineHeight: 1.5 }}>
                      {what}
                    </td>
                    {situations.map((situation) => (
                      <td key={situation.id} className={toneTextClass(scoreTone(situation.parts[key]))}>
                        {situation.parts[key]}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Score</strong>
                  </td>
                  <td style={{ color: "var(--color-ink-2)", fontVariantNumeric: "normal", lineHeight: 1.5 }}>
                    the five, weighted {weightLine}
                  </td>
                  {situations.map((situation) => (
                    <td key={situation.id}>
                      <strong className={toneTextClass(scoreTone(situation.score))}>{situation.score}</strong>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Gini</td>
                  <td style={{ color: "var(--color-ink-2)", fontVariantNumeric: "normal", lineHeight: 1.5 }}>
                    the inequality of delivered work: 0 is identical, 1 is one person doing everything
                  </td>
                  {situations.map((situation) => (
                    <td key={situation.id}>{situation.distribution.gini.toFixed(2)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="roll__notes">
            {situations.map((situation) => (
              <p key={situation.id}>
                <b>{short(situation)}.</b> {situation.lane.note}
              </p>
            ))}
          </div>

          <p className="brief__copy" style={{ marginTop: "1.25rem", maxWidth: "72ch" }}>
            Two decisions worth knowing about. A group is judged on <strong>delivered</strong> work rather than on what people said
            they would do — otherwise whoever takes the easy half looks the more generous. But delivered work only becomes the measure
            once a third of the commitment is genuinely finished, because calling somebody “behind” two days into a project is both
            wrong and ignored. Until then, the score judges the split of what was taken on.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- 03 · what it does, as three stacked sheets ------------------ */

export function Capabilities({ situations, shareSegments }: { situations: StorySituation[]; shareSegments: Array<{ id: string; name: string; hue: number; hours: number }> }) {
  const drift = situations[0];
  const working = situations.find((situation) => situation.key === "working") ?? situations[0];

  return (
    <section className="land__band" id="how">
      <div className="land__wrap">
        <SectionHead
          index="03"
          title="What it does, in the order you need it"
          sub="Three sheets, pasted over each other as you scroll. Each is a working screen in the application, shown here with the demonstration group's own figures."
        />

        <div className="sheets">
          <Sheet
            number="01"
            title="Who should do what"
            body="A task asks for skills, not for a name. Everyone who fits is ranked on how well they match, how much time they honestly have left, how far taking it would bring them from an even share, the deadline, whether they already hold the thread, and whether it would teach them something. Nobody is handed work they cannot do, and nobody is handed work they have no time for."
            points={[
              "Thirty-five skills across eight clusters, with partial credit for adjacent experience.",
              "Every suggestion priced in hours on both sides of the move.",
              "Work is never placed on somebody already past their capacity for the week.",
            ]}
          >
            <div className="frag">
              <div className="frag__head">
                <span>{drift?.move ? "The move, and who else fits" : "Candidates"}</span>
                <span>{drift?.move?.taskTitle ?? "no task needs moving"}</span>
              </div>
              {(drift?.members ?? []).slice(0, 4).map((member, position) => (
                <div className="frag__row" key={member.fullName}>
                  <span className="frag__who">
                    <MemberDot hue={member.hue} />
                    <span className="frag__name">{member.fullName}</span>
                    {position === 0 ? <Tag tone="accent">holding most</Tag> : null}
                  </span>
                  <span className="tnum" style={{ color: "var(--color-ink-3)" }}>
                    {hours(member.committed)} committed
                  </span>
                  <span className="frag__why">
                    {member.silentFor !== null && member.silentFor > (drift?.policy.silenceDays ?? 7)
                      ? `Last signal ${member.silentFor} days ago, so their capacity is unknown and they rank lower.`
                      : `${hours(member.open)} still open · ${drift && drift.hours.delivered > 0 ? Math.round((member.delivered / drift.hours.delivered) * 100) : 0}% of the delivered work`}
                  </span>
                </div>
              ))}
              <div className="frag__foot">
                <span>six weighted terms</span>
                <span>
                  skill {Math.round((drift?.allocator.skill ?? 0.34) * 100)}% · headroom{" "}
                  {Math.round((drift?.allocator.headroom ?? 0.24) * 100)}% · equity{" "}
                  {Math.round((drift?.allocator.equity ?? 0.18) * 100)}%
                </span>
              </div>
            </div>
          </Sheet>

          <Sheet
            number="02"
            title="What it will take"
            body="Nobody commits to “help with the report”. A plan is written as tasks with an estimate in hours, a phase, the skills each needs and a date — and the total is checked against the hours the group actually has. If the arithmetic does not work, the planner says so in week one rather than week nine."
            points={[
              "Eighteen planning patterns, from a two-week poster to a term-long build.",
              "Every task carries an hour estimate, a phase and the skills it requires.",
              "Work nobody has taken on is counted separately, and it counts against the group.",
            ]}
          >
            <div className="frag">
              <div className="frag__head">
                <span>The arithmetic</span>
                <span>{drift?.name}</span>
              </div>
              {[
                ["Committed in total", drift ? hours(drift.hours.committed) : "—"],
                ["An even share, per person", drift ? hours(drift.hours.evenCommitted) : "—"],
                ["Delivered so far", drift ? hours(drift.hours.delivered) : "—"],
                ["Still open", drift ? hours(drift.hours.open) : "—"],
                ["Nobody has taken on", drift ? `${drift.counts.unassigned} tasks` : "—"],
              ].map(([label, value]) => (
                <div className="frag__row" key={label}>
                  <span className="frag__name" style={{ fontWeight: 450 }}>
                    {label}
                  </span>
                  <span className="tnum">{value}</span>
                </div>
              ))}
              <div className="frag__foot">
                <span>
                  {drift?.counts.done ?? 0} of {drift?.counts.tasks ?? 0} tasks closed
                </span>
                <span>{drift?.dueLabel}</span>
              </div>
            </div>
          </Sheet>

          <Sheet
            number="03"
            title="Who is carrying whom"
            body="This is the screen the product exists for. One bar for the group, a row for each person, and a tick at the even share. Above it, one sentence in plain English saying what the figures mean. Below it, the moves that would fix it, each priced — so accepting one is a decision rather than a leap of faith."
            points={[
              "Four states: on track, carrying too much, behind, gone quiet.",
              "Silence is a state of its own. A group rarely fails because somebody is slow; it fails because somebody stops answering.",
              "Snapshots are taken as the project moves, so the trend exists without anyone remembering to record it.",
            ]}
          >
            <div className="frag">
              <div className="frag__head">
                <span>The whole group, one bar</span>
                <span>Gini {working?.distribution.gini.toFixed(2) ?? "—"}</span>
              </div>
              <div style={{ padding: "1rem 0.75rem" }}>
                {shareSegments.length ? <ShareBar segments={shareSegments} showLegend height={24} /> : <span className="brief__copy">Reading…</span>}
              </div>
              <div className="frag__foot">
                <span>{working?.headline}</span>
              </div>
            </div>
          </Sheet>
        </div>
      </div>
    </section>
  );
}

/* ---------- 04 · the teacher's half ------------------------------------- */

export function Teachers({ story, shareSegments }: { story: Story | null; shareSegments: Array<{ id: string; name: string; hue: number; hours: number }> }) {
  const classroom = story?.classroom ?? null;
  const worst = classroom ? [...classroom.projects].sort((a, b) => a.balance - b.balance)[0] : null;

  return (
    <section className="land__band" id="schools">
      <div className="land__wrap stack-l">
        <SectionHead
          index="04"
          title="A teacher should not have to work out who did nothing"
          sub="Equita runs twice over. A group of friends can sign themselves up with no teacher anywhere in the picture. A class gets the same engine, plus the thing a teacher actually needs: every group at once, and the names that need a quiet word this week rather than at the marking."
        />

        <div className="teachers">
          <figure className="plate plate--tall plate--tipped land__reveal" data-reveal>
            <img
              src="/archive/the-headteacher-bringing-syrian-refugees-and-jordanian.jpg"
              width={1920}
              height={1280}
              alt="A headteacher standing in the corridor of the school she runs, in front of bunting and painted doorways."
            />
            <figcaption>The work this product is for happens in rooms like this one. A headteacher, in her own school.</figcaption>
          </figure>

          <div className="stack-m land__reveal" data-reveal>
            <div className="pair">
              <div className="stack-s">
                <span className="land__eyebrow">Forming the groups</span>
                <p className="land__sub">
                  The hardest argument in group work happens before any work starts. Equita proposes the groups: it balances the skills
                  in each one, spreads the students who usually end up carrying, keeps friendships intact where it can, and never
                  leaves one group with three of the same strength and another with none.
                </p>
                <ul className="sheet__list">
                  <li>Each proposed group is checked for skill coverage before it is suggested, not after.</li>
                  <li>A student can be left out deliberately and placed by hand later.</li>
                  <li>The proposal is a preview. Nothing is written until the teacher accepts it.</li>
                </ul>
              </div>
              <div className="stack-s">
                <span className="land__eyebrow">The class, at a glance</span>
                <p className="land__sub">
                  One screen per class: every group, every score, and every student who has gone quiet or taken on more than their
                  week allows. It is the same data the students see, read from the side that has to answer for it.
                </p>
                <ul className="sheet__list">
                  <li>Flags are explained in a sentence, never just coloured in.</li>
                  <li>Groups can be created from a class in one step, with the class policy already applied.</li>
                  <li>A student carrying too much across two projects is counted once, not twice.</li>
                </ul>
              </div>
            </div>

            {classroom ? (
              <div className="frag">
                <div className="frag__head">
                  <span>
                    {classroom.name} · {classroom.code}
                  </span>
                  <span>
                    {classroom.students.length} students · {classroom.projects.length} groups
                  </span>
                </div>
                {classroom.projects.map((project) => (
                  <div className="frag__row" key={project.name}>
                    <span className="frag__name">{project.name}</span>
                    <span className="tnum" style={{ color: "var(--color-ink-3)" }}>
                      {project.members} members
                    </span>
                    <span className="frag__why">
                      balance {project.balance} · Gini {project.gini.toFixed(2)} · score {project.score}
                      {worst && project.name === worst.name ? " — the one to look at first." : project.balance > 70 ? " — this one is holding." : ""}
                    </span>
                  </div>
                ))}
                {classroom.students.some((student) => student.state !== "on-track") ? (
                  <div className="frag__foot">
                    {classroom.students
                      .filter((student) => student.state !== "on-track")
                      .slice(0, 6)
                      .map((student) => (
                        <span key={student.fullName} className="row row--tight">
                          <span className="roll__swatch" style={{ background: toneVar(stateTone(student.state)) }} />
                          {student.name}
                        </span>
                      ))}
                    <span>and the rest</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {shareSegments.length ? (
              <p className="brief__copy" style={{ maxWidth: "62ch" }}>
                The roll above is the register of the demonstration class, read live: {classroom?.students.length ?? 0} invented
                students, {classroom?.projects.length ?? 0} groups, and the flags the engine currently raises.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

