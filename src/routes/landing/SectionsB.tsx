/**
 * The bottom of the page: the order things happen in, the class roll printed as
 * proof, what it costs, the questions people actually ask, and the back of the
 * card. The credits live in the footer because six of the pictures are other
 * people's work.
 */
import { Link } from "react-router-dom";
import { hours, stateTone, toneTextClass, toneVar } from "../../lib/format";
import { MemberDot, Tag } from "../../components/ui";
import { SectionHead } from "./parts";
import { CREDITS, MOMENTS, STATE_KEY, STATE_LABELS } from "./story";
import type { Story } from "./types";

/* ---------- 05 · the order things happen in ----------------------------- */

export function Moments() {
  return (
    <section className="land__band" id="moments">
      <div className="land__wrap stack-m">
        <SectionHead
          index="05"
          title="From an empty page to a hand-in"
          sub="Six moments, in the order they actually happen. Drag the row sideways."
        />
      </div>
      <div className="moments land__reveal" data-reveal>
        {MOMENTS.map((moment, position) => (
          <article className="moment" key={moment.title}>
            <span className="moment__n">{String(position + 1).padStart(2, "0")}</span>
            <h3 className="moment__title">{moment.title}</h3>
            <p className="moment__body">{moment.body}</p>
            {moment.plate ? (
              <figure className="moment__plate">
                <img src={moment.plate.src} alt={moment.plate.alt} loading="lazy" decoding="async" />
                <figcaption className="brief__copy" style={{ paddingTop: "0.4rem" }}>
                  {moment.plate.caption}
                </figcaption>
              </figure>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- 06 · the roll, printed -------------------------------------- */

export function Roll({ story }: { story: Story | null }) {
  const classroom = story?.classroom ?? null;
  const students = classroom?.students ?? [];

  return (
    <section className="land__band" id="the-class">
      <div className="land__wrap stack-l">
        <SectionHead
          index="06"
          title="The class list, printed"
          sub="This is the register of the demonstration class, with each student coloured by the state the engine has put them in. It is the least flattering thing the product produces, which is rather the point of it."
        />

        <div className="roll land__reveal" data-reveal>
          <div className="roll__head">
            <span className="land__eyebrow">{classroom ? `${classroom.name} · ${classroom.subject}` : "The demonstration class"}</span>
            <span className="land__eyebrow">{students.length ? `${students.length} students on the roll` : "reading…"}</span>
          </div>

          <p className="roll__names">
            {students.map((student, position) => (
              <span key={student.fullName}>
                <b className={toneTextClass(stateTone(student.state))}>{student.name}</b>
                {position < students.length - 1 ? <i> ·</i> : null}
              </span>
            ))}
          </p>

          <div className="roll__key">
            {STATE_KEY.map(([state, label]) => (
              <span key={state}>
                <span className="roll__swatch" style={{ background: toneVar(stateTone(state)) }} />
                {label}
              </span>
            ))}
          </div>

          <div className="scroll-x">
            <table className="roll__table">
              <thead>
                <tr>
                  <th style={{ minWidth: "10rem" }}>Student</th>
                  <th>Groups</th>
                  <th>Committed</th>
                  <th>Delivered</th>
                  <th>Still open</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.fullName}>
                    <td>
                      <span className="row row--tight">
                        <MemberDot hue={student.hue} />
                        {student.fullName}
                      </span>
                    </td>
                    <td>{student.groups}</td>
                    <td>{hours(student.committed)}</td>
                    <td>{hours(student.delivered)}</td>
                    <td>{hours(student.open)}</td>
                    <td>
                      <Tag tone={stateTone(student.state)}>{STATE_LABELS[student.state] ?? student.state}</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pair">
          <figure className="plate plate--tipped-alt land__reveal" data-reveal>
            <img
              src="/archive/creston-national-fish-hatchey-outdoor-classroom-project.jpg"
              width={1920}
              height={1289}
              alt="Twelve young people in matching shirts standing and kneeling under the wooden gateway they built, beside a lake."
            />
            <figcaption>
              A youth conservation corps with the outdoor classroom they built. Twelve people, one finished thing — which is what all
              of this is in aid of.
            </figcaption>
          </figure>

          <div className="stack-s land__reveal" data-reveal style={{ paddingTop: "1rem" }}>
            <span className="land__eyebrow">What the roll above is for</span>
            <p className="land__sub">
              A grade for group work is normally defended in one of two ways: quietly, by trusting the group, or expensively, by
              making everybody write a reflection about nobody in particular. Equita replaces both with a record that already exists
              because the work was planned in it: every task, its estimate, who closed it, and when.
            </p>
            <p className="land__sub">
              The register above is the same record read from the top. {students.filter((s) => s.state === "behind").length} students
              owe hours against an even share, {students.filter((s) => s.state === "carrying").length} are carrying more than theirs, and{" "}
              {students.filter((s) => s.state === "quiet").length} have stopped answering. Nothing in that sentence had to be
              estimated, and none of it is anybody's recollection.
            </p>
            <p className="brief__copy">
              These are invented students in a seeded dataset. The engine has no knowledge of any real person, and the demo dataset
              ships with the project so that everything on this page can be checked.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 07 · the tickets -------------------------------------------- */

export function Tickets() {
  const free = [
    "Unlimited groups and projects",
    "Skill-based allocation with the six-term ranking",
    "The full equity panel, with the even-share tick",
    "Recommendations, priced in hours",
    "Honest weekly capacity per person",
    "The record: every task, every hour, to hand in",
  ];
  const school = [
    "Everything in the student plan, for every student",
    "Classes with a join code and a roll",
    "Group formation that checks skill coverage",
    "The class console: every group on one screen",
    "Flags explained, with a record per student",
    "A teacher's policy: capacity enforced, work reviewed",
  ];

  return (
    <section className="land__band" id="price">
      <div className="land__wrap stack-l">
        <SectionHead
          index="07"
          title="What it costs"
          sub="Students are not customers, so they are not charged. Schools are, because a school is where the money is and because a product nobody pays for is a product nobody maintains."
        />

        <div className="tickets land__reveal" data-reveal>
          <article className="ticket">
            <div className="ticket__perf" aria-hidden="true" />
            <div className="ticket__body">
              <span className="land__eyebrow">A group of students</span>
              <div className="ticket__price">
                Free<small>no card, no school, no account required from a teacher</small>
              </div>
              <span className="ticket__what">Start a group and go</span>
              <ul>
                {free.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="ticket__foot">
                <Link to="/signup" className="btn btn--primary">
                  Start a group
                </Link>
              </div>
            </div>
          </article>

          <article className="ticket ticket--ink">
            <div className="ticket__perf" aria-hidden="true" />
            <div className="ticket__body">
              <span className="land__eyebrow" style={{ color: "var(--color-quiet)" }}>
                A school
              </span>
              <div className="ticket__price">
                £2<small>per student, per term</small>
              </div>
              <span className="ticket__what">Per class, or the whole school</span>
              <ul>
                {school.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="ticket__foot row row--wrap">
                <Link to="/signup" className="btn btn--outline" style={{ borderColor: "var(--color-ink-3)", color: "var(--color-paper)" }}>
                  Open a class
                </Link>
                <Link to="/login" className="btn btn--ghost" style={{ color: "var(--color-paper-2)" }}>
                  Try the demo class
                </Link>
              </div>
            </div>
          </article>
        </div>

        <p className="brief__copy" style={{ maxWidth: "62ch" }}>
          The figure is stated rather than implied because a price you have to ask for is a price nobody trusts. There is no free tier
          for schools that quietly stops working in March, and no per-seat charge for students who are only in the room.
        </p>
      </div>
    </section>
  );
}

/* ---------- 08 · the questions ----------------------------------------- */

export function Questions({ questions, open, onOpen }: { questions: Array<{ q: string; a: string[] }>; open: number; onOpen: (next: number) => void }) {
  const current = questions[Math.min(open, Math.max(0, questions.length - 1))];

  return (
    <section className="land__band" id="questions">
      <div className="land__wrap stack-l">
        <SectionHead
          index="08"
          title="The questions people actually ask"
          sub="Answered from the engine's own settings rather than from a sales page, which is why some of the answers contain numbers."
        />

        <div className="cards land__reveal" data-reveal>
          <div className="cards__tabs" role="group" aria-label="Questions">
            {questions.map((question, position) => (
              <button
                key={question.q}
                type="button"
                aria-pressed={position === open}
                className="cards__tab"
                data-active={position === open}
                onClick={() => onOpen(position)}
              >
                <i>{String(position + 1).padStart(2, "0")}</i>
                <span>{question.q}</span>
              </button>
            ))}
          </div>

          <div className="cards__stack">
            <div className="cards__card" aria-live="polite">
              <span className="land__index">{String(Math.min(open, questions.length - 1) + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="cards__q">{current?.q}</h3>
                {(current?.a ?? []).map((paragraph, position) => (
                  <p className="cards__a" key={position}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- the reply card ---------------------------------------------- */

export function Reply({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="reply">
      <div className="land__wrap reply__inner">
        <div className="reply__card">
          <span className="land__eyebrow">Start here</span>
          <h2>Put the work on the page before it goes wrong.</h2>
          <p className="brief__lead" style={{ maxWidth: "44ch" }}>
            Write the brief, break it into hours, and let the work go to the people who can do it and have the time. Nobody has to be
            told they are doing too much, because the bar says it first.
          </p>
          <div className="reply__acts">
            <Link to={signedIn ? "/today" : "/signup"} className="btn btn--primary btn--lg">
              {signedIn ? "Your work" : "Start a group"}
            </Link>
            <Link to="/join" className="land__link">
              Join a class with a code
            </Link>
          </div>
        </div>

        <div className="reply__aside">
          <strong>Or open the demonstration</strong>
          Two teachers, eighteen students, six groups, ninety-three tasks and a hundred and fifty-eight logged hours — all invented,
          all computed live, all readable as any of the accounts in it.
        </div>
      </div>
    </section>
  );
}

/* ---------- the back of the card ---------------------------------------- */

export function Back() {
  return (
    <footer className="back">
      <div className="back__perf" aria-hidden="true" />
      <div className="land__wrap back__grid">
        <div className="back__col">
          <Link to="/" className="mast__brand" style={{ marginBottom: "0.75rem" }}>
            <svg className="mast__mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" fill="var(--color-ink)" />
              <rect x="5" y="13" width="5" height="14" fill="var(--color-paper)" />
              <rect x="11" y="9" width="5" height="18" fill="var(--color-paper)" />
              <rect x="17" y="13" width="5" height="14" fill="var(--color-paper)" />
              <rect x="23" y="13" width="5" height="14" fill="var(--color-accent)" />
            </svg>
            <span className="mast__word">Equita</span>
          </Link>
          <p className="back__note">
            Project coordination for students and schools, built around one idea: every hour of work belongs to a named person, and
            the even share is always visible. There is no language model anywhere in it, and there is no version of this that works
            without the numbers being true.
          </p>
        </div>

        <div className="back__col">
          <h3>The product</h3>
          <ul>
            <li>
              <a href="#scoring">How the score is made</a>
            </li>
            <li>
              <a href="#how">Allocation, planning, equity</a>
            </li>
            <li>
              <a href="#the-class">The class console</a>
            </li>
            <li>
              <Link to="/login">The demonstration</Link>
            </li>
          </ul>
        </div>

        <div className="back__col">
          <h3>Start</h3>
          <ul>
            <li>
              <Link to="/signup">Create an account</Link>
            </li>
            <li>
              <Link to="/login">Sign in</Link>
            </li>
            <li>
              <Link to="/join">Join with a class code</Link>
            </li>
            <li>
              <a href="#price">Price</a>
            </li>
          </ul>
        </div>

        <div className="back__col">
          <h3>About the data</h3>
          <p className="back__note" style={{ fontSize: "var(--text-xs)", lineHeight: 1.6 }}>
            Everything numeric on this page is computed at the moment you load it from a seeded dataset of invented students. The
            dataset ships with the project and can be rebuilt with <code>npm run seed</code>.
          </p>
        </div>
      </div>

      <div className="land__wrap back__credits">
        <p style={{ maxWidth: "96ch" }}>
          <strong>Pictures.</strong> Six of the photographs and scanned pages on this page are other people's work, used under the
          licences below. None of them shows this product, its users or any real student's data.{" "}
          {CREDITS.map((credit, position) => (
            <span key={credit.label}>
              <a href={credit.href} target="_blank" rel="noreferrer">
                {credit.label}
              </a>{" "}
              by {credit.who},{" "}
              <a href={credit.licenceHref} target="_blank" rel="noreferrer">
                {credit.licence}
              </a>
              , via Wikimedia Commons{position < CREDITS.length - 1 ? "; " : "."}
            </span>
          ))}
        </p>
        <p className="back__sign" style={{ marginTop: "1rem" }}>
          <span>Equita — a demonstration built for the Neighbourhood Hacks brief.</span>
          <span>Typefaces: Bricolage Grotesque and Inter.</span>
        </p>
      </div>
    </footer>
  );
}
