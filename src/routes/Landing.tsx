import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { MemberDot } from "../components/ui";
import { hours, scoreTone, stateTone, toneTextClass, toneVar } from "../lib/format";
import { useApi } from "../lib/live";
import { useSession } from "../lib/session";
import { MOMENTS, PART_DEFINITIONS, STATE_LABELS, buildQuestions } from "./landing/story";
import type { Story, StorySituation } from "./landing/types";

type Audience = "group" | "teacher";
type StoryStep = "split" | "pressure" | "move";

const STORY_STEPS: Array<{ id: StoryStep; label: string; title: string }> = [
  { id: "split", label: "See the split", title: "The work becomes visible." },
  { id: "pressure", label: "Find the pressure", title: "The numbers explain why." },
  { id: "move", label: "Make the move", title: "The next step is specific." },
];

function useReveal(ready: boolean) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready || typeof IntersectionObserver === "undefined") return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    root.dataset.armed = "true";
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).dataset.seen = "true";
        observer.unobserve(entry.target);
      }),
      { rootMargin: "-10% 0px -10% 0px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ready]);
  return rootRef;
}

function logo() {
  return (
    <svg className="eq-logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="currentColor" />
      <rect x="7" y="14" width="4.5" height="10" fill="var(--eq-paper)" />
      <rect x="13.75" y="14" width="4.5" height="10" fill="var(--eq-paper)" />
      <rect x="20.5" y="14" width="4.5" height="10" fill="var(--eq-paper)" />
      <rect x="5.5" y="12" width="21" height="2" fill="var(--eq-acid)" />
    </svg>
  );
}

function hue(hueValue: number) {
  return { background: `hsl(${hueValue} 58% 48%)` };
}

function cta(audience: Audience, signedIn: boolean) {
  if (signedIn) return { href: "/today", label: "Open workspace" };
  return audience === "teacher"
    ? { href: "/login?demo=teacher", label: "See the teacher view" }
    : { href: "/signup", label: "Start a group" };
}

function Header({ audience, setAudience, signedIn }: { audience: Audience; setAudience: (next: Audience) => void; signedIn: boolean }) {
  const action = cta(audience, signedIn);
  return (
    <header className="eq-header">
      <div className="eq-frame eq-header__inner">
        <Link className="eq-brand" to="/" aria-label="Equita home">{logo()}<span>Equita</span></Link>
        <nav className="eq-nav" aria-label="Landing page">
           <a href="#story">The story</a>
           <a href="#signals">The signals</a>
           <a href="#journey">The journey</a>
           <a href="#class-list">The class list</a>
           <a href="#classroom">Classrooms</a>
        </nav>
        <div className="eq-header__right">
          <div className="eq-audience eq-audience--header" role="group" aria-label="Choose your path">
            <button type="button" aria-pressed={audience === "group"} onClick={() => setAudience("group")}>Group</button>
            <button type="button" aria-pressed={audience === "teacher"} onClick={() => setAudience("teacher")}>Teacher</button>
          </div>
          <Link className="eq-header__link" to={signedIn ? "/today" : "/login"}>{signedIn ? "Workspace" : "Sign in"}</Link>
          <Link className="eq-button eq-button--dark eq-header__cta" to={action.href}>{action.label}</Link>
        </div>
      </div>
    </header>
  );
}

function BalanceBars({ situation, after = false }: { situation?: StorySituation; after?: boolean }) {
  const total = situation?.hours.delivered || 1;
  const move = situation?.move;
  const even = situation?.distribution.evenShare ?? 0.25;
  /*
   * A "fill" move takes work nobody had picked up (`from` is null), so the
   * projection's pool grows by that effort; a move between people leaves the
   * pool where it was. The axis and the even line follow the projected pool,
   * so an added task cannot push a bar past the end of the scale.
   */
  const projectedTotal = after && move && !move.from ? total + move.effort : total;
  const scale = after ? projectedTotal : total;
  const evenHours = after ? projectedTotal * even : situation?.hours.even ?? 0;
  /*
   * Bars are delivered hours. `member.share` is the engine's *scoring* share —
   * credited once delivery is meaningful, committed while it is still too
   * thin to judge — so multiplying it by the delivered total printed hours
   * nobody had delivered (Maya read 11.2h having delivered 14h). The headline
   * above the bars quotes delivered hours, so the bars use the same measure.
   */
  const deliveredAfter = (member: StorySituation["members"][number]) => {
    if (!after || !move) return member.delivered;
    const first = (name: string | null) => (name ? name.toLowerCase().split(" ")[0] : "");
    const isFrom = first(move.from) !== "" && member.fullName.toLowerCase().includes(first(move.from));
    const isTo = first(move.to) !== "" && member.fullName.toLowerCase().includes(first(move.to));
    const shifted = member.delivered + (isTo ? move.effort : isFrom ? -move.effort : 0);
    return Math.max(0, Math.min(scale, shifted));
  };
  return (
    <div className="eq-bars" aria-label={after ? "Projected balance after the suggested move" : "Current balance against the even share"}>
      <div className="eq-bars__scale"><span>0</span><span className="eq-bars__even-label" style={{ left: `${even * 100}%` }}>even share <b>{situation ? hours(evenHours) : "—"}</b></span><span>{hours(scale)}</span></div>
      {(situation?.members ?? []).map((member) => {
        const delivered = deliveredAfter(member);
        const share = delivered / scale;
        return (
          <div className="eq-bar" key={member.fullName}>
            <div className="eq-bar__label"><span><MemberDot hue={member.hue} />{member.name}</span><strong>{hours(delivered)}</strong></div>
            <div className="eq-bar__track"><span style={{ width: `${share > 0 ? Math.max(2, share * 100) : 0}%`, minWidth: share > 0 ? undefined : 0, ...hue(member.hue) }} /><i style={{ left: `${even * 100}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function Hero({ audience, story, signedIn, setAudience }: { audience: Audience; story: Story | null; signedIn: boolean; setAudience: (next: Audience) => void }) {
  const situation = audience === "teacher"
    ? story?.situations.find((item) => item.key === "quiet") ?? story?.situations[1] ?? story?.situations[0]
    : story?.situations[0];
  const action = cta(audience, signedIn);
  return (
    <section className="eq-hero">
      <div className="eq-frame eq-hero__grid">
        <div className="eq-hero__copy">
          <p className="eq-kicker">The shared-work operating system</p>
          <h1>{audience === "teacher" ? "See every group before the deadline." : "Stop guessing who is carrying the group."}</h1>
          <p className="eq-hero__lead">{audience === "teacher" ? "A classroom view that makes quiet signals, uneven load, and unfinished work visible while there is still time to change it." : "Equita turns tasks into hours, hours into a shared picture, and a wobble in the split into one clear next step."}</p>
          <div className="eq-hero__actions">
            <Link className="eq-button eq-button--acid" to={action.href}>{action.label}</Link>
            <Link className="eq-inline-link" to={audience === "teacher" ? "/signup" : "/join"}>{audience === "teacher" ? "Start a student group" : "Join a class with a code"}</Link>
          </div>
          <div className="eq-audience eq-audience--hero" role="group" aria-label="Choose who you are">
            <button type="button" aria-pressed={audience === "group"} onClick={() => setAudience("group")}><span>For groups</span><small>Make the split fair</small></button>
            <button type="button" aria-pressed={audience === "teacher"} onClick={() => setAudience("teacher")}><span>For classrooms</span><small>See every group</small></button>
          </div>
        </div>
        <div className="eq-hero__visual" data-reveal aria-busy={!story}>
          <div className="eq-visual__top"><span>Live balance</span><span>{story?.note ?? "Seeded demonstration data"}</span></div>
          <div className="eq-visual__title"><div><span className="eq-micro">{situation?.dueLabel ?? "Project in motion"}</span><h2>{situation?.name ?? "Reading the project"}</h2></div><strong className={`eq-score eq-score--${scoreTone(situation?.score ?? 0)}`}>{situation?.score ?? "—"}</strong></div>
          <p className="eq-visual__headline">{situation?.headline ?? "Preparing the demo dataset for this browser."}</p>
          <BalanceBars situation={situation} />
          <div className="eq-visual__caption"><span>The line is the even share.</span><span>{situation ? `${situation.members.length} people · ${situation.counts.tasks} tasks` : "First visit: loading the demo data."}</span></div>
        </div>
      </div>
      <div className="eq-frame eq-hero__proof"><span>One product, two rooms</span><span>Student groups</span><span>Teacher console</span><span>Every hour has a name</span></div>
    </section>
  );
}

function StorySection({ situation }: { situation?: StorySituation }) {
  const [step, setStep] = useState<StoryStep>("split");
  const stepIndex = STORY_STEPS.findIndex((item) => item.id === step);
  const part = situation?.parts ?? {};
  const move = situation?.move;
  return (
    <section className="eq-section eq-section--story" id="story">
      <div className="eq-frame">
        <div className="eq-section__intro"><p className="eq-kicker">A group, caught in the middle</p><h2>From tension to a next step.</h2><p>Equita is not a prettier checklist. It follows the work as it moves, shows the pressure building, and gives the group something practical to decide.</p></div>
        <div className="eq-story" data-reveal>
          <div className="eq-story__rail">
            <div className="eq-story__steps" role="group" aria-label="Equita story steps">
              {STORY_STEPS.map((item, index) => <button type="button" aria-pressed={item.id === step} className="eq-story__step" data-active={item.id === step} key={item.id} onClick={() => setStep(item.id)}><span>{String(index + 1).padStart(2, "0")}</span><b>{item.label}</b><small>{item.title}</small></button>)}
            </div>
            <div className="eq-story__controls"><button type="button" onClick={() => setStep(STORY_STEPS[Math.max(0, stepIndex - 1)].id)} disabled={stepIndex === 0}>Previous</button><span>{stepIndex + 1} / {STORY_STEPS.length}</span><button type="button" onClick={() => setStep(STORY_STEPS[Math.min(STORY_STEPS.length - 1, stepIndex + 1)].id)} disabled={stepIndex === STORY_STEPS.length - 1}>Next</button></div>
          </div>
          <div className="eq-story__stage" aria-live="polite">
            {step === "split" ? <><div className="eq-stage__heading"><span className="eq-micro">Current state</span><h3>The work is visible before the argument.</h3></div><BalanceBars situation={situation} /><p className="eq-stage__note">One bar per person. One baseline for the group. No retrospective guesswork.</p></> : null}
            {step === "pressure" ? <><div className="eq-stage__heading"><span className="eq-micro">Evidence, not judgement</span><h3>The score tells you where to look.</h3></div><div className="eq-pressure"><div className="eq-pressure__score"><strong>{situation?.score ?? "—"}</strong><span>fairness score</span></div><div className="eq-pressure__list">{PART_DEFINITIONS.slice(0, 5).map(([key, label, description]) => <div className="eq-pressure__row" key={key}><span>{label}</span><i><b style={{ width: `${part[key] ?? 0}%` }} /></i><strong className={toneTextClass(scoreTone(part[key] ?? 0))}>{part[key] ?? "—"}</strong><small>{description}</small></div>)}</div></div></> : null}
            {step === "move" ? <><div className="eq-stage__heading"><span className="eq-micro">A recommendation, not an order</span><h3>{move?.taskTitle ?? "Nothing to move right now."}</h3></div><div className="eq-before-after"><div><span className="eq-micro">Before</span><BalanceBars situation={situation} /></div><div className="eq-arrow" aria-hidden="true">→</div><div><span className="eq-micro">After the suggested move</span><BalanceBars situation={situation} after /></div></div><p className="eq-stage__note">{move?.reason ?? "When the group is holding, Equita stays quiet."}</p></> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function SignalsSection({ situation }: { situation?: StorySituation }) {
  const [active, setActive] = useState("balance");
  const selected = PART_DEFINITIONS.find(([key]) => key === active) ?? PART_DEFINITIONS[0];
  const score = situation?.parts[selected[0]] ?? 0;
  return (
    <section className="eq-section eq-section--signals" id="signals">
      <div className="eq-frame"><div className="eq-section__intro"><p className="eq-kicker">The reasoning layer</p><h2>Every signal earns its place.</h2><p>Open the parts of the score. Each one is a different way a group can drift, and each one points to a different conversation.</p></div><div className="eq-signals" data-reveal><div className="eq-signals__list" role="group" aria-label="Fairness score signals">{PART_DEFINITIONS.map(([key, label]) => <button type="button" aria-pressed={key === active} data-active={key === active} key={key} onClick={() => setActive(key)}><span>{label}</span><strong>{situation?.parts[key] ?? "—"}</strong></button>)}</div><div className="eq-signals__detail" aria-live="polite"><div className="eq-signals__detail-top"><span className="eq-micro">{selected[1]}</span><strong className={toneTextClass(scoreTone(score))}>{score}</strong></div><h3>{selected[2]}</h3><p>{situation?.lane.note ?? "The group story appears as soon as the demo dataset is ready."}</p><div className="eq-signal-meter"><span style={{ width: `${score}%` }} /><i style={{ left: `${situation?.distribution.evenShare ? Math.min(100, situation.distribution.evenShare * 100) : 25}%` }} /></div><div className="eq-signals__detail-foot"><span>Current group</span><span>{situation ? `${situation.counts.done} closed · ${hours(situation.hours.open)} open` : "Preparing…"}</span></div></div></div></div>
    </section>
  );
}

function ClassroomSection({ story }: { story: Story | null }) {
  const classroom = story?.classroom;
  const projects = classroom?.projects ?? [];
  const students = classroom?.students ?? [];
  const [view, setView] = useState<"teacher" | "student">("teacher");
  const [selectedName, setSelectedName] = useState(projects[0]?.name ?? "");
  const project = projects.find((item) => item.name === selectedName) ?? projects[0];
  return (
    <section className="eq-section eq-section--classroom" id="classroom">
       <div className="eq-frame"><div className="eq-section__intro"><p className="eq-kicker">One truth, read two ways</p><h2>The classroom view is not a different product.</h2><p>Students see their own work and their group's balance. Teachers see the same truth across every group, early enough to help.</p></div><div className="eq-console" data-reveal><div className="eq-console__bar"><span>{classroom?.name ?? "Demo classroom"}</span><div className="eq-console__switch" role="group" aria-label="Classroom preview view"><button type="button" aria-pressed={view === "teacher"} onClick={() => setView("teacher")}>Teacher view</button><button type="button" aria-pressed={view === "student"} onClick={() => setView("student")}>Student view</button></div></div><div className="eq-console__body"><aside className="eq-console__projects"><span className="eq-micro">{view === "teacher" ? "Every group" : "Your groups"}</span>{projects.map((item) => <button type="button" key={item.name} aria-pressed={item.name === project?.name} data-active={item.name === project?.name} onClick={() => setSelectedName(item.name)}><span>{item.name}</span><strong className={toneTextClass(scoreTone(item.score))}>{item.score}</strong></button>)}</aside><div className="eq-console__selected"><div className="eq-console__selected-head"><div><span className="eq-micro">{project?.members ?? 0} people · {classroom?.subject ?? "Project work"}</span><h3>{project?.name ?? "Preparing the class."}</h3></div><strong className={toneTextClass(scoreTone(project?.score ?? 0))}>{project?.score ?? "—"}</strong></div><div className="eq-console__selected-bar"><span style={{ width: `${project?.score ?? 0}%` }} /></div><p>{view === "teacher" ? "A teacher gets the context behind the score and the names worth a quiet conversation." : "A student gets the same baseline, with their own contribution and the next task in view."}</p><div className="eq-console__people">{students.filter((student) => view === "teacher" || student.groups > 0).slice(0, view === "teacher" ? 12 : 6).map((student) => <span key={student.fullName}><i style={{ background: toneVar(stateTone(student.state)) }} />{student.name}</span>)}</div><Link to={view === "teacher" ? "/login?demo=teacher" : "/signup"} className="eq-button eq-button--dark">{view === "teacher" ? "Open the teacher demo" : "Start a group"}</Link></div></div></div></div>
     </section>
  );
}

function JourneySection() {
  return (
    <section className="eq-section eq-section--journey" id="journey">
      <div className="eq-frame">
        <div className="eq-section__intro"><p className="eq-kicker">The project, in order</p><h2>From an empty page to a hand-in.</h2><p>The same brief stays visible from the first meeting to the final record. Nothing disappears into a private checklist.</p></div>
        <div className="eq-moments" data-reveal>
          {MOMENTS.map((moment) => <article className="eq-moment" key={moment.title}><h3>{moment.title}</h3><p>{moment.body}</p></article>)}
        </div>
      </div>
    </section>
  );
}

function RollSection({ story }: { story: Story | null }) {
  const classroom = story?.classroom;
  const students = classroom?.students ?? [];
  const states = ["on-track", "carrying", "behind", "quiet", "light"];
  const countOf = (state: string) => students.filter((student) => student.state === state).length;
  const carrying = countOf("carrying");
  const behind = countOf("behind");
  const quiet = countOf("quiet");
  const watch = students
    .filter((student) => student.state === "carrying" || student.state === "behind" || student.state === "quiet")
    .sort((a, b) => b.owed - a.owed)
    .slice(0, 4);
  return (
    <section className="eq-section eq-section--roll" id="class-list">
      <div className="eq-frame">
        <div className="eq-section__intro"><p className="eq-kicker">The class list, printed</p><h2>A record that can answer for the work.</h2><p>Equita gives the teacher the same picture the group is working from: every person, every project, and the state that the numbers explain.</p></div>
        <div className="eq-roll" data-reveal>
          <div className="eq-roll__head"><div className="eq-roll__title"><h3>{classroom?.name ?? "The demonstration class"}</h3><span>{classroom?.subject ?? "Class list"}</span></div><span className="eq-roll__count">{students.length ? `${students.length} students on the roll` : "Building the demo dataset."}</span></div>
          <div className="eq-roll__states">
            {states.map((state) => <div className="eq-roll__state" key={state}><strong>{countOf(state)}</strong><span><i className={`eq-state-dot eq-state-dot--${state}`} />{STATE_LABELS[state] ?? state}</span></div>)}
          </div>
          <div className="eq-roll__watch">
            <span className="eq-micro">Worth a conversation this week</span>
            {watch.length ? watch.map((student) => (
              <div className="eq-roll__row" key={student.fullName}>
                <span className="eq-person"><MemberDot hue={student.hue} />{student.fullName}</span>
                <span className={toneTextClass(stateTone(student.state))}>{STATE_LABELS[student.state] ?? student.state}</span>
                <span className="eq-roll__hours">{hours(student.delivered)}<i>/</i>{hours(student.committed)}</span>
              </div>
            )) : <p className="eq-roll__empty">Nobody is over their share. Every group is holding.</p>}
          </div>
        </div>
        <div className="eq-roll__note"><p><strong>{behind} behind, {carrying} carrying, {quiet} quiet.</strong> Those are not impressions. They are the conversations the record makes possible before the marking.</p></div>
      </div>
    </section>
  );
}

function StartSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="eq-section eq-section--start" id="start">
      <div className="eq-frame"><div className="eq-section__intro"><p className="eq-kicker">Start with the room you are in</p><h2>One engine, two ways in.</h2><p>Student groups can start on their own. A teacher can bring the same allocation, capacity and equity picture into a class.</p></div><div className="eq-start-grid" data-reveal><article><span className="eq-micro">For student teams</span><h3>Make the work fair before it feels personal.</h3><p>Write the brief, break it into hours, and keep the shared bar visible while the project is still moving.</p><Link className="eq-button eq-button--acid" to={signedIn ? "/today" : "/signup"}>{signedIn ? "Open your group" : "Start a group"}</Link></article><article><span className="eq-micro">For classrooms</span><h3>See every group before the deadline.</h3><p>Form groups with skill coverage, set a class policy, and give students a record that makes the final conversation easier.</p><Link className="eq-button eq-button--dark" to="/login?demo=teacher">Open the teacher demo</Link></article></div></div>
    </section>
  );
}

function QuestionsSection({ story }: { story: Story | null }) {
  const questions = useMemo(() => buildQuestions(story?.situations ?? []), [story]);
  const [open, setOpen] = useState(0);
  const current = questions[open] ?? questions[0];
  return (
    <section className="eq-section eq-section--questions" id="questions">
       <div className="eq-frame"><div className="eq-section__intro"><p className="eq-kicker">Questions worth answering</p><h2>Not a black box.</h2><p>The rules are part of the product. Read the answer, then open the live demo and check the numbers yourself.</p></div><div className="eq-questions" data-reveal><div className="eq-questions__list" role="group" aria-label="Questions about Equita">{questions.map((question, index) => <button type="button" aria-pressed={index === open} data-active={index === open} key={question.q} onClick={() => setOpen(index)}><span>{question.q}</span><strong>→</strong></button>)}</div><div className="eq-questions__answer" aria-live="polite"><span className="eq-micro">{current?.q}</span>{(current?.a ?? []).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></div></div>
    </section>
  );
}

function Closing({ audience, signedIn }: { audience: Audience; signedIn: boolean }) {
  const action = cta(audience, signedIn);
  return <section className="eq-closing"><div className="eq-frame eq-closing__inner"><div><p className="eq-kicker">Start with the next project</p><h2>Make the work fair while there is still time.</h2></div><Link to={action.href} className="eq-button eq-button--acid">{action.label}</Link></div></section>;
}

function Footer() {
  return <footer className="eq-footer"><div className="eq-frame eq-footer__grid"><div><Link className="eq-brand" to="/">{logo()}<span>Equita</span></Link><p>Project coordination built around one promise: every hour of work belongs to a named person.</p></div><div><span className="eq-micro">Navigate</span><a href="#story">The story</a><a href="#signals">The signals</a><a href="#journey">The journey</a><a href="#class-list">The class list</a></div><div><span className="eq-micro">Start</span><a href="#start">Choose your room</a><Link to="/signup">Create an account</Link><Link to="/join">Join a class</Link><Link to="/login">Sign in</Link></div><div><span className="eq-micro">Data note</span><p>Live figures on this page come from an invented, seeded dataset. The proof is real computation, not a fake screenshot.</p><p>Archive photographs are credited in the project assets.</p></div></div><div className="eq-frame eq-footer__bottom"><span>Equita · Neighbourhood Hacks</span><span>Light mode, deliberately.</span></div></footer>;
}

export default function Landing() {
  const { user } = useSession();
  const { data: story } = useApi<Story>("/api/public/story", { live: false });
  const rootRef = useReveal(!!story);
  const [audience, setAudience] = useState<Audience>("group");
  const situation = useMemo(() => audience === "teacher" ? story?.situations.find((item) => item.key === "quiet") ?? story?.situations[1] ?? story?.situations[0] : story?.situations[0], [audience, story]);
   return <div className="equita-landing" ref={rootRef}><Header audience={audience} setAudience={setAudience} signedIn={!!user} /><main><Hero audience={audience} story={story ?? null} signedIn={!!user} setAudience={setAudience} /><StorySection situation={situation} /><SignalsSection situation={situation} /><ClassroomSection story={story ?? null} /><JourneySection /><RollSection story={story ?? null} /><StartSection signedIn={!!user} /><QuestionsSection story={story ?? null} /><Closing audience={audience} signedIn={!!user} /></main><Footer /></div>;
}
