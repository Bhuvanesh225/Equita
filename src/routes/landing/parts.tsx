/**
 * The small pieces the landing page reuses.
 *
 * The one worth reading twice is `MembersOf`: the same `LoadBar` the application
 * uses on its boards and equity panels, with its tick at the even share. The
 * landing page does not get its own simplified version of the product's central
 * idea — it uses the real one, so what is demonstrated is what ships.
 */
import type { ReactNode } from "react";
import { hours, scoreTone, toneTextClass } from "../../lib/format";
import { LoadBar, MemberDot } from "../../components/ui";
import type { StorySituation } from "./types";

export function SectionHead({ index, title, sub }: { index: string; title: string; sub?: ReactNode }) {
  return (
    <div className="land__head land__reveal" data-reveal>
      <span className="land__index">{index}</span>
      <div className="stack-s">
        <h2 className="land__name">{title}</h2>
        {sub ? <p className="land__sub">{sub}</p> : null}
      </div>
    </div>
  );
}

export function Figure({ value, unit, note }: { value: ReactNode; unit?: string; note: string }) {
  return (
    <div className="brief__fact">
      <b>
        {value}
        {unit ? <span style={{ fontSize: "0.75rem", color: "var(--color-ink-3)", marginLeft: "0.1rem" }}>{unit}</span> : null}
      </b>
      <span>{note}</span>
    </div>
  );
}

/** A person's hours against the even share — the signature element, reused. */
export function MembersOf({ situation }: { situation: StorySituation }) {
  return (
    <div className="situation__rows">
      {situation.members.map((member) => (
        <LoadBar
          key={member.fullName}
          name={member.fullName}
          hue={member.hue}
          hours={member.delivered}
          even={situation.hours.even}
          leftLabel={
            <span className="row row--tight" style={{ minWidth: 0 }}>
              <MemberDot hue={member.hue} />
              <span className="truncate">{member.name}</span>
            </span>
          }
          valueLabel={hours(member.delivered)}
        />
      ))}
    </div>
  );
}

/** The engine's suggestion, priced. Nothing is suggested without the arithmetic. */
export function Move({ situation }: { situation: StorySituation }) {
  const move = situation.move;

  if (!move) {
    return (
      <div className="situation__move">
        <span className="land__eyebrow">Nothing to move</span>
        <span>
          Every task on this project already sits with somebody inside their week, so the engine has no move to offer. Whatever is
          wrong here is not the allocation.
        </span>
      </div>
    );
  }

  const first = (name: string | null) => (name ? name.split(" ")[0] : null);
  const to = first(move.to) ?? "somebody";

  return (
    <div className="situation__move">
      <span className="land__eyebrow">
        {move.from ? "Recommended move" : "Work still unclaimed"}
      </span>
      <span>
        <b>{move.taskTitle}</b> — {hours(move.effort)}, {move.from ? `from ${first(move.from)} to ${to}` : `offered to ${to}`}
      </span>
      <span className="tnum" style={{ color: "var(--color-ink-3)" }}>
        {move.from
          ? `${first(move.from)} ${hours(move.fromAfter)} \u2192 ${to} ${hours(move.toAfter)} · even ${hours(situation.hours.evenCommitted)}`
          : `${to} would land on ${hours(move.toAfter)} against an even ${hours(situation.hours.evenCommitted)}`}
      </span>
    </div>
  );
}

/** One of the three capability sheets. They stack as the reader scrolls. */
export function Sheet({
  number,
  title,
  body,
  points,
  children,
}: {
  number: string;
  title: string;
  body: string;
  points: string[];
  children: ReactNode;
}) {
  return (
    <article className="sheet land__reveal" data-reveal>
      <div>
        <span className="sheet__num">Sheet {number}</span>
        <h3 className="sheet__title">{title}</h3>
        <p className="sheet__body">{body}</p>
        <ul className="sheet__list">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <div>{children}</div>
    </article>
  );
}

export function ScoreTag({ score }: { score: number }) {
  return <strong className={toneTextClass(scoreTone(score))}>{score}</strong>;
}
