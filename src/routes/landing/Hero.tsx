/**
 * The masthead and the hero.
 *
 * The hero is the direction's first move: the left column is a project brief on
 * paper, and the right column is the product reading a real dataset — the same
 * three groups, scored, with their even-share ticks and the move the engine
 * would make. It advances on its own until a reader takes hold of a tab, at which
 * point it stops, because from then on the choice is theirs.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hours, hueStyle, pct, scoreTone, toneTextClass } from "../../lib/format";
import { MembersOf, Move } from "./parts";
import { IconArrowRight } from "../../components/icons";
import type { Story } from "./types";

export function Masthead({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="mast">
      <div className="land__wrap mast__inner">
        <Link to="/" className="mast__brand" aria-label="Equita, home">
          <svg className="mast__mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" fill="var(--color-ink)" />
            <rect x="5" y="13" width="5" height="14" fill="var(--color-paper)" />
            <rect x="11" y="9" width="5" height="18" fill="var(--color-paper)" />
            <rect x="17" y="13" width="5" height="14" fill="var(--color-paper)" />
            <rect x="23" y="13" width="5" height="14" fill="var(--color-accent)" />
          </svg>
          <span className="mast__word">Equita</span>
        </Link>
        <nav className="mast__nav" aria-label="Sections">
          <a className="land__link" href="#scoring">
            How it scores
          </a>
          <a className="land__link" href="#how">
            What it does
          </a>
          <a className="land__link" href="#schools">
            For schools
          </a>
          <a className="land__link" href="#price">
            Price
          </a>
        </nav>
        <span className="mast__tag">demo dataset</span>
        <Link to={signedIn ? "/today" : "/login"} className="btn btn--ink btn--sm">
          {signedIn ? "Your work" : "Sign in"}
        </Link>
      </div>
    </header>
  );
}

/** Advance on its own until the reader interferes. */
function useRotation(count: number) {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held || count < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), 7000);
    return () => window.clearInterval(timer);
  }, [count, held]);

  return {
    index,
    choose: (next: number) => {
      setIndex(next);
      setHeld(true);
    },
    hold: setHeld,
  };
}

export function Hero({ story, signedIn }: { story: Story | null; signedIn: boolean }) {
  const situations = story?.situations ?? [];
  const { index, choose, hold } = useRotation(situations.length);
  const totals = story?.totals;
  const active = situations[index];

  // The band across the top of the brief is the demonstration group's own split:
  // a level share, one segment per person, in each person's own colour.
  const band = (situations.find((item) => item.key === "working") ?? situations[0])?.members ?? [];

  return (
    <section className="hero land__wrap">
      <div className="brief">
        <div className="brief__band" aria-hidden="true">
          {band.length ? (
            band.map((member) => (
              <span key={member.fullName} style={{ width: pct(1 / band.length), ...hueStyle(member.hue) }} />
            ))
          ) : (
            <span style={{ width: "100%", background: "var(--color-line)" }} />
          )}
        </div>

        <div className="brief__body">
          <div className="brief__rule">
            <span className="land__eyebrow">Fair group work</span>
            <span className="brief__rule-line" />
            <span className="land__eyebrow">student teams · and schools</span>
          </div>

          {/* The break is deliberate: one idea, two lines, and the accent carries
              the word the whole product is about. */}
          <h1>
            Group work,
            <br />
            split <em>fairly</em>.
          </h1>

          <p className="brief__lead">
            Every task carries an estimate in hours, and every hour is credited to the person who did it — so the split is a figure
            rather than an opinion, and it is one everybody can see halfway through rather than at the marking.
          </p>

          <div className="brief__acts">
            <Link to={signedIn ? "/today" : "/signup"} className="btn btn--primary btn--lg">
              {signedIn ? "Go to your work" : "Start a group"}
              <IconArrowRight size={15} />
            </Link>
            <Link to="/join" className="land__link">
              Join a class with a code
            </Link>
          </div>

          <div className="brief__facts">
            <div className="brief__fact">
              <b>{totals?.skills ?? 35}</b>
              <span>skills a student can claim</span>
            </div>
            <div className="brief__fact">
              <b>
                {totals?.hoursLogged ?? 0}
                <span style={{ fontSize: "0.75rem", color: "var(--color-ink-3)" }}>h</span>
              </b>
              <span>logged in the demo dataset</span>
            </div>
            <div className="brief__fact">
              <b>{totals?.tasks ?? 0}</b>
              <span>tasks placed by skill, not by luck</span>
            </div>
          </div>

          <p className="brief__copy">
            Every figure on this page is real computation over a seeded demonstration dataset — {totals?.students ?? 18} invented
            students in {totals?.classes ?? 2} classes, {totals?.projects ?? 6} groups. No mock-ups, no invented percentages, nobody
            who exists.{" "}
            <Link to="/login?demo=teacher" className="land__link">
              Open the teacher demo
            </Link>
          </p>
        </div>
      </div>

      <div
        className="monitor"
        onMouseEnter={() => hold(true)}
        onMouseLeave={() => hold(false)}
        aria-label="The equity panel, reading the demonstration dataset"
      >
        <div className="monitor__chrome">
          <span className="monitor__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="land__eyebrow">equity panel</span>
          <span className="monitor__chrome-text">{story?.classroom?.name ?? "the demo"}</span>
        </div>

        <div className="monitor__tabs" role="tablist" aria-label="Three groups in the dataset">
          {situations.map((situation, position) => (
            <button
              key={situation.id}
              type="button"
              role="tab"
              aria-selected={position === index}
              className="monitor__tab"
              data-active={position === index}
              onClick={() => choose(position)}
            >
              <span>{situation.lane.title.replace(/^The group (that |)/, "").replace(/^The /, "")}</span>
              <b className={position === index ? undefined : toneTextClass(scoreTone(situation.score))}>{situation.score}</b>
            </button>
          ))}
        </div>

        <div className="monitor__stage">
          {situations.map((situation, position) => (
            <div key={situation.id} className="situation" data-active={position === index} aria-hidden={position !== index}>
              <div className="situation__meta">
                <span className="situation__title">{situation.name}</span>
                <span className="land__eyebrow">{situation.dueLabel}</span>
              </div>
              <p className="situation__said">{situation.headline}</p>
              <MembersOf situation={situation} />
              <Move situation={situation} />
              <div className="frag__foot" style={{ padding: 0, border: 0 }}>
                <span>
                  {situation.members.length} people · {situation.counts.tasks} tasks · Gini {situation.distribution.gini.toFixed(2)}
                </span>
                <span>
                  {situation.counts.done} closed · {hours(situation.hours.open)} still open
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="monitor__foot">
          <span className="monitor__live" aria-hidden="true" />
          {active ? `Scored ${active.score} by the same engine the application runs` : "Reading the dataset…"}
        </div>
      </div>
    </section>
  );
}
