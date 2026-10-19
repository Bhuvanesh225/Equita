import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { useApi } from "../lib/live";
import { useSession } from "../lib/session";
import { hours, scoreTone, stateTone, toneTextClass, toneVar } from "../lib/format";
import { MemberDot } from "../components/ui";
import type { Story, StorySituation } from "./landing/types";
import { PART_DEFINITIONS } from "./landing/story";

function useReveal(ready: boolean) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready || typeof IntersectionObserver === "undefined") return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!nodes.length) return;
    root.dataset.armed = "true";

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.seen = "true";
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "-8% 0px -12% 0px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ready]);

  return rootRef;
}

function mark(hue: number) {
  return { background: `hsl(${hue} 55% 46%)` };
}

function shortTitle(situation: StorySituation) {
  return situation.lane.title.replace(/^The group (that |)/, "").replace(/^The /, "");
}

function logo() {
  return (
    <svg className="landing__logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="currentColor" />
      <rect x="5" y="13" width="5" height="14" fill="var(--landing-paper)" />
      <rect x="11" y="9" width="5" height="18" fill="var(--landing-paper)" />
      <rect x="17" y="13" width="5" height="14" fill="var(--landing-paper)" />
      <rect x="23" y="13" width="5" height="14" fill="var(--landing-lime)" />
    </svg>
  );
}

function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="landing__header">
      <div className="landing__frame landing__header-inner">
        <Link to="/" className="landing__brand" aria-label="Equita home">
          {logo()}
          <span>Equita</span>
        </Link>
        <nav className="landing__nav" aria-label="Landing page">
          <a href="#how">How it works</a>
          <a href="#schools">For classrooms</a>
          <a href="#price">Plans</a>
        </nav>
        <div className="landing__header-actions">
          <span className="landing__status"><i /> Demo data</span>
          <Link className="landing__button landing__button--small landing__button--dark" to={signedIn ? "/today" : "/login"}>
            {signedIn ? "Open workspace" : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  );
}

function DataStrip({ story }: { story: Story | null }) {
  const totals = story?.totals;
  const values = [
    [totals?.students ?? 0, "students in the demo"],
    [totals?.tasks ?? 0, "tasks in motion"],
    [totals?.hoursLogged ?? 0, "hours with a name"],
  ];
  return (
    <div className="landing__data-strip" aria-label="Demo dataset totals">
      {values.map(([value, label]) => (
        <div className="landing__data-point" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function SituationPanel({ situations }: { situations: StorySituation[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = situations[activeIndex];

  useEffect(() => {
    if (situations.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActiveIndex((value) => (value + 1) % situations.length), 6500);
    return () => window.clearInterval(timer);
  }, [situations.length]);

  return (
    <div className="landing__readout" data-reveal>
      <div className="landing__readout-bar">
        <span className="landing__readout-dots" aria-hidden="true"><i /><i /><i /></span>
        <span>Equity readout</span>
        <span className="landing__readout-live"><i /> Live dataset</span>
      </div>
      <div className="landing__readout-tabs" role="tablist" aria-label="Demo project situations">
        {situations.map((situation, index) => (
          <button
            className="landing__readout-tab"
            data-active={index === activeIndex}
            aria-selected={index === activeIndex}
            role="tab"
            type="button"
            key={situation.id}
            onClick={() => setActiveIndex(index)}
          >
            <span>{shortTitle(situation)}</span>
            <strong className={index === activeIndex ? undefined : toneTextClass(scoreTone(situation.score))}>{situation.score}</strong>
          </button>
        ))}
      </div>
      <div className="landing__readout-body" aria-live="polite">
        {active ? (
          <>
            <div className="landing__readout-heading">
              <div>
                <span className="landing__micro">{active.dueLabel ?? "Project in motion"}</span>
                <h2>{active.name}</h2>
              </div>
              <div className={`landing__score landing__score--${scoreTone(active.score)}`}>
                <strong>{active.score}</strong>
                <span>fairness</span>
              </div>
            </div>
            <p className="landing__readout-quote">“{active.headline}”</p>
            <div className="landing__member-list">
              {active.members.map((member) => {
                const width = Math.max(8, Math.min(100, member.share * 100));
                return (
                  <div className="landing__member" key={member.fullName}>
                    <div className="landing__member-top">
                      <span><MemberDot hue={member.hue} />{member.name}</span>
                      <b>{hours(member.delivered)}</b>
                    </div>
                    <div className="landing__meter"><span style={{ width: `${width}%`, ...mark(member.hue) }} /><i style={{ left: `${Math.min(95, active.distribution.evenShare * 100)}%` }} /></div>
                  </div>
                );
              })}
            </div>
            {active.move ? (
              <div className="landing__move">
                <span className="landing__micro">Suggested move</span>
                <strong>{active.move.taskTitle}</strong>
                <p>{active.move.reason}</p>
              </div>
            ) : null}
            <div className="landing__readout-foot">
              <span>{active.members.length} people · {active.counts.tasks} tasks · Gini {active.distribution.gini.toFixed(2)}</span>
              <span>{active.counts.done} closed · {hours(active.hours.open)} open</span>
            </div>
          </>
        ) : <p>Reading the demonstration dataset…</p>}
      </div>
    </div>
  );
}

function Hero({ story, signedIn }: { story: Story | null; signedIn: boolean }) {
  return (
    <section className="landing__hero landing__frame">
      <div className="landing__hero-copy">
        <p className="landing__eyebrow">Project coordination for real group work</p>
        <h1>Make the split visible.</h1>
        <p className="landing__hero-lead">Equita turns group work into a shared, honest picture: what needs doing, who has the time, and when the balance starts to tip.</p>
        <div className="landing__actions">
          <Link to={signedIn ? "/today" : "/signup"} className="landing__button landing__button--lime">{signedIn ? "Open your workspace" : "Start a group"}</Link>
          <Link to="/join" className="landing__text-link">Join a class with a code</Link>
        </div>
        <DataStrip story={story} />
        <p className="landing__fineprint">Every figure below is computed from the seeded demo dataset, not a marketing mock-up. <Link to="/login?demo=teacher">Open the teacher demo</Link></p>
      </div>
      <SituationPanel situations={story?.situations ?? []} />
    </section>
  );
}

function SectionIntro({ title, children, dark = false }: { title: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className={`landing__section-intro${dark ? " landing__section-intro--dark" : ""}`}>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

function ScoreSection({ situations }: { situations: StorySituation[] }) {
  const weights = situations[0]?.weights ?? {};
  const weightLine = Object.entries(weights).map(([key, value]) => `${Math.round(value * 100)}% ${key}`).join(" · ");
  return (
    <section className="landing__section landing__section--ink" id="how">
      <div className="landing__frame">
        <SectionIntro title="The work is not a vibe. It is a picture.">
          Equita scores a project from the same signals a group already needs to discuss. The score is not a verdict; it is a starting point with the arithmetic left on the page.
        </SectionIntro>
        <div className="landing__score-layout" data-reveal>
          <div className="landing__score-copy">
            <span className="landing__micro">The fairness score</span>
            <h3>Five signals. One conversation.</h3>
            <p>Balance, delivery, spread, engagement and readiness are weighted together. A quiet student is not labelled “behind”; a person carrying too much is not hidden inside a group average.</p>
            <p className="landing__note">Current weighting: {weightLine || "loaded from the project policy"}.</p>
          </div>
          <div className="landing__score-table-wrap">
            <table className="landing__score-table">
              <thead><tr><th>Signal</th><th>What it watches</th>{situations.map((situation) => <th key={situation.id}>{shortTitle(situation)}</th>)}</tr></thead>
              <tbody>
                {PART_DEFINITIONS.map(([key, label, description]) => (
                  <tr key={key}>
                    <th>{label}</th>
                    <td>{description}</td>
                    {situations.map((situation) => <td key={situation.id} className={toneTextClass(scoreTone(situation.parts[key]))}>{situation.parts[key]}</td>)}
                  </tr>
                ))}
                <tr className="landing__score-total"><th>Score</th><td>The weighted total the group can act on.</td>{situations.map((situation) => <td key={situation.id}>{situation.score}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function MoveSection({ situation }: { situation?: StorySituation }) {
  return (
    <section className="landing__section landing__section--paper" id="move">
      <div className="landing__frame">
        <SectionIntro title="The move is the product.">
          A score is useful only when it changes what happens next. Equita turns the imbalance into a proposed move, prices it in hours, and leaves the decision with the group.
        </SectionIntro>
        <div className="landing__move-layout" data-reveal>
          <div className="landing__move-statement">
            <span className="landing__micro">What the engine sees</span>
            <p>{situation?.headline ?? "Reading the group's current balance…"}</p>
            <div className="landing__move-metrics">
              <div><strong>{situation ? hours(situation.hours.committed) : "—"}</strong><span>committed</span></div>
              <div><strong>{situation ? hours(situation.hours.delivered) : "—"}</strong><span>delivered</span></div>
              <div><strong>{situation ? hours(situation.hours.open) : "—"}</strong><span>still open</span></div>
            </div>
          </div>
          <div className="landing__move-card">
            <div className="landing__move-card-top"><span className="landing__micro">A recommendation, not an order</span><span>{situation?.move ? hours(situation.move.effort) : "—"}</span></div>
            <h3>{situation?.move?.taskTitle ?? "No move needed right now"}</h3>
            <p>{situation?.move?.reason ?? "When the group is holding, Equita stays quiet."}</p>
            <div className="landing__move-route">
              <span>{situation?.move?.from ?? "Unassigned"}</span><b>→</b><span>{situation?.move?.to ?? "Best fit"}</span>
            </div>
            <Link to={"/signup"} className="landing__button landing__button--dark">See the workbench</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClassroomSection({ story }: { story: Story | null }) {
  const classroom = story?.classroom;
  const students = classroom?.students ?? [];
  const projects = classroom?.projects ?? [];
  return (
    <section className="landing__section landing__section--wash" id="schools">
      <div className="landing__frame">
        <SectionIntro title="A classroom view that does not wait for the marking.">
          Teachers get the same truth students see, with the whole class in one place: projects, scores, quiet signals, and the groups that need a conversation this week.
        </SectionIntro>
        <div className="landing__classroom" data-reveal>
          <figure className="landing__archive">
            <img src="/archive/the-headteacher-bringing-syrian-refugees-and-jordanian.jpg" alt="A headteacher standing in a school corridor." />
            <figcaption>Group work happens in rooms like this. The record should be as present as the people in them.</figcaption>
          </figure>
          <div className="landing__classroom-console">
            <div className="landing__console-top"><span>{classroom?.name ?? "Demo classroom"}</span><span>{classroom?.subject ?? "Project work"} · {students.length} students</span></div>
            <div className="landing__project-list">
              {projects.map((project) => (
                <div className="landing__project-row" key={project.name}>
                  <span className="landing__project-name">{project.name}</span>
                  <span>{project.members} members</span>
                  <strong className={toneTextClass(scoreTone(project.score))}>{project.score}</strong>
                  <span className="landing__project-bar"><i style={{ width: `${project.score}%` }} /></span>
                </div>
              ))}
            </div>
            <div className="landing__student-cloud">
              {students.slice(0, 12).map((student) => <span key={student.fullName} className={`landing__student landing__student--${stateTone(student.state)}`}><i style={{ background: toneVar(stateTone(student.state)) }} />{student.name}</span>)}
            </div>
            <div className="landing__console-foot"><span>{students.filter((student) => student.state !== "on-track").length} signals worth a look</span><span>Data from the same engine</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Plans({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="landing__section landing__section--paper" id="price">
      <div className="landing__frame">
        <SectionIntro title="Start with the room you are in.">
          Students can start a group without waiting for a teacher. Schools can bring the same allocation and equity engine into a class, with a roll and a view across every group.
        </SectionIntro>
        <div className="landing__plans" data-reveal>
          <article className="landing__plan">
            <span className="landing__micro">For student teams</span>
            <h3>Make the work fair before it feels personal.</h3>
            <p>Write the brief, break it into hours, find the right owner for every task, and keep the shared bar visible.</p>
            <Link to={signedIn ? "/today" : "/signup"} className="landing__button landing__button--lime">{signedIn ? "Open your group" : "Start a group"}</Link>
          </article>
          <article className="landing__plan landing__plan--dark">
            <span className="landing__micro">For classrooms</span>
            <h3>See every group before the deadline.</h3>
            <p>Form groups with skill coverage, set a class policy, and give students a record that makes the final conversation easier.</p>
            <Link to="/login?demo=teacher" className="landing__button landing__button--paper">Open the teacher demo</Link>
          </article>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="landing__footer">
      <div className="landing__frame landing__footer-grid">
        <div><Link to="/" className="landing__brand landing__brand--footer">{logo()}<span>Equita</span></Link><p>Project coordination built around a simple promise: every hour has a name.</p></div>
        <div><span className="landing__micro">Explore</span><a href="#how">How it works</a><a href="#schools">For classrooms</a><a href="#price">Plans</a></div>
        <div><span className="landing__micro">Start</span><Link to="/signup">Create an account</Link><Link to="/login">Sign in</Link><Link to="/join">Join a class</Link></div>
        <div><span className="landing__micro">About this page</span><p>Numbers are computed from invented students in a seeded dataset. Images are archival context, not product screenshots.</p></div>
      </div>
      <div className="landing__frame landing__footer-bottom"><span>Equita · Neighbourhood Hacks</span><span>Light mode, by design.</span></div>
    </footer>
  );
}

export default function Landing() {
  const { user } = useSession();
  const { data: story } = useApi<Story>("/api/public/story", { live: false });
  const rootRef = useReveal(!!story);
  const working = useMemo(() => story?.situations.find((situation) => situation.key === "working") ?? story?.situations[0], [story]);

  return (
    <div className="landing" ref={rootRef}>
      <Header signedIn={!!user} />
      <main>
        <Hero story={story ?? null} signedIn={!!user} />
        <ScoreSection situations={story?.situations ?? []} />
        <MoveSection situation={working} />
        <ClassroomSection story={story ?? null} />
        <Plans signedIn={!!user} />
        <section className="landing__closing">
          <div className="landing__frame landing__closing-inner">
            <div><p className="landing__eyebrow">The next useful conversation</p><h2>Put the work on the page before it goes wrong.</h2></div>
            <Link to={user ? "/today" : "/signup"} className="landing__button landing__button--lime">{user ? "Open your workspace" : "Start a group"}</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
