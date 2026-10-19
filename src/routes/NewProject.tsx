/**
 * Starting a project.
 *
 * This page is the brief. Everything downstream — the plan, the placement of
 * each task, the fairness reading — is derived from what is typed here, so the
 * form is deliberately one piece of paper rather than a wizard of small steps.
 *
 * Nothing on this page is a claim: the only numbers it shows are the ones it is
 * about to send.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, post } from "../lib/api";
import { useToast } from "../lib/live";
import { useSession } from "../lib/session";
import { fullDate, plural } from "../lib/format";
import { parsePeople } from "../lib/people";
import { Field, Panel, Segmented, Tag } from "../components/ui";
import { PageHead, Quiet } from "../components/blocks";
import { IconArrowRight, IconSparkle } from "../components/icons";
import type { ProjectSummary } from "../lib/types";

type Mode = "standalone" | "class";

/** A date `days` from today, as the value an `<input type="date">` wants. */
function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function NewProject() {
  const { user, memberships } = useSession();
  const { push } = useToast();
  const navigate = useNavigate();

  const teachable = useMemo(
    () => memberships.filter((classroom) => classroom.role === "teacher" || classroom.ownerId === user?.id),
    [memberships, user?.id],
  );

  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [mode, setMode] = useState<Mode>("standalone");
  const [classroomId, setClassroomId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [memberText, setMemberText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: "name" | "class"; message: string } | null>(null);

  const members = useMemo(() => parsePeople(memberText), [memberText]);
  const isClass = mode === "class";
  const chosenClass = teachable.find((classroom) => classroom.id === classroomId) ?? null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) {
      setFieldError({ field: "name", message: "Give the project a name of at least two characters." });
      return;
    }
    if (isClass && !classroomId) {
      setFieldError({ field: "class", message: "Choose which class this assignment is for." });
      return;
    }

    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      const result = await post<{ project: ProjectSummary; members: Array<{ id: string; name: string; alreadyMember: boolean }> }>("/api/projects", {
        name: clean,
        brief: brief.trim(),
        dueAt: dueAt || null,
        classroomId: isClass ? classroomId : null,
        members: isClass ? undefined : members,
      });

      const added = result.members.filter((person) => !person.alreadyMember);
      push({
        title: `“${result.project.name}” is started`,
        detail: isClass
          ? `It is set inside ${chosenClass?.name ?? "the class"}. Add the groups from the class console.`
          : added.length
            ? `${plural(added.length, "person", "people")} joined, and were told.`
            : "You are the first person on it.",
        tone: "good",
        action: brief.trim()
          ? {
              label: "Plan from the brief",
              onClick: () => navigate(`/projects/${result.project.id}?plan=1`),
            }
          : undefined,
      });
      navigate(`/projects/${result.project.id}`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.isInput) {
        setFieldError({ field: "name", message: cause.message });
      } else {
        setError(cause instanceof ApiError ? cause.message : "That did not save. Try again in a moment.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        kicker="A new brief"
        title="Start a project"
        sub="Equita plans from the brief, so paste in what the group was actually asked to do. The tasks, the stages and the skills they need all come out of it."
        actions={
          <Link className="btn btn--ghost" to="/projects">
            Back to your groups
          </Link>
        }
      />

      <form onSubmit={submit} noValidate>
        <div className="grid grid--split">
          <Panel recessed title="The brief" hint="everything the allocator will read">
            <div className="stack stack--loose" style={{ maxWidth: "72ch" }}>
              <Field label="What is it called" required htmlFor="project-name" error={fieldError?.field === "name" ? fieldError.message : null}>
                <input
                  id="project-name"
                  className="input"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (fieldError?.field === "name") setFieldError(null);
                  }}
                  placeholder="Bus corridor campaign"
                  autoFocus
                  autoComplete="off"
                />
              </Field>

              <Field
                label="What were you asked to do"
                hint={
                  <>
                    Paste the assignment itself — Equita reads it for tasks, stages and the skills they need. Course codes, deliverables and the
                    rubric all help.
                    {brief.trim().length ? ` ${brief.trim().length} characters so far.` : " A sentence will do, but a paragraph reads better."}
                  </>
                }
              >
                <textarea
                  className="textarea"
                  rows={11}
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="Design a public information campaign for the city's bus corridor. Deliver a research summary, three poster concepts, a plain-language leaflet aimed at 14–18s, and a five-minute pitch. Hand in with a written reflection on what each person did."
                  style={{ lineHeight: 1.6 }}
                />
              </Field>

              <Field
                label="Who is it for"
                hint={
                  teachable.length
                    ? "A class assignment belongs to a class; your own group is just you and whoever you add."
                    : "You can still be added to a class later with the code your teacher gives you."
                }
              >
                <Segmented
                  ariaLabel="Who the project is for"
                  value={mode}
                  onChange={(next) => {
                    setMode(next);
                    if (fieldError?.field === "class") setFieldError(null);
                  }}
                  options={
                    teachable.length
                      ? [
                          { value: "standalone" as Mode, label: "Your own group" },
                          { value: "class" as Mode, label: "A class assignment" },
                        ]
                      : [{ value: "standalone" as Mode, label: "Your own group" }]
                  }
                />
              </Field>

              {isClass ? (
                <Field label="Which class" required error={fieldError?.field === "class" ? fieldError.message : null}>
                  <select
                    className="select"
                    value={classroomId}
                    onChange={(event) => {
                      setClassroomId(event.target.value);
                      if (fieldError?.field === "class") setFieldError(null);
                    }}
                  >
                    <option value="">Choose a class…</option>
                    {teachable.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                        {classroom.subject ? ` · ${classroom.subject}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <Field
                label="Hand in"
                hint="A date is what turns “how much work is left” into “how much work is left per week”."
              >
                <div className="row row--wrap" style={{ gap: "0.5rem" }}>
                  <input className="input" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} style={{ maxWidth: "12rem" }} />
                  <div className="btn-group">
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => setDueAt(inDays(7))}>
                      In a week
                    </button>
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => setDueAt(inDays(14))}>
                      In a fortnight
                    </button>
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => setDueAt(inDays(30))}>
                      In a month
                    </button>
                  </div>
                  {dueAt ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDueAt("")}>
                      Clear
                    </button>
                  ) : null}
                </div>
                {dueAt ? <p className="field__hint">Handing in on {fullDate(dueAt)}.</p> : null}
              </Field>

              {!isClass ? (
                <Field
                  label="Who is on it"
                  hint="One address per line. A name can go in front of the address: Diego Marín <diego@example.com>."
                >
                  <textarea
                    className="textarea"
                    rows={4}
                    value={memberText}
                    onChange={(event) => setMemberText(event.target.value)}
                    placeholder={"maya@equita.demo\njune@equita.demo"}
                  />
                </Field>
              ) : (
                <Quiet>
                  The people come from the class roster. Once the assignment exists you can build the groups in the class console and each
                  group gets its own board.
                </Quiet>
              )}

              {error ? (
                <div className="callout callout--risk" role="alert">
                  {error}
                </div>
              ) : null}

              <div className="row row--wrap" style={{ gap: "0.6rem" }}>
                <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
                  {busy ? "Writing it down…" : "Create it"}
                </button>
                <Link className="btn btn--ghost btn--lg" to="/projects">
                  Cancel
                </Link>
              </div>
            </div>
          </Panel>

          <div className="stack stack--loose">
            <Panel title="What happens next" hint="before anybody does any work">
              <ol className="stack stack--tight" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--text-sm)", lineHeight: 1.6, color: "var(--color-ink-2)" }}>
                <li>
                  The brief is saved and shown back on the board, with the hand-in date. {isClass ? "Each group you build gets the same one." : "Everyone you added is told they are on it."}
                </li>
                <li>
                  <strong>Plan from the brief</strong> turns it into sized tasks in stages, aimed at the date. It shows you the list before it
                  writes anything.
                </li>
                <li>
                  <strong>Place the unclaimed work</strong> then matches every task nobody has taken to the person whose skills and free hours
                  fit it best. That is also a preview, and also two steps.
                </li>
                <li>From then on the board shows each person&rsquo;s delivered hours against an even share — the same mark on every screen.</li>
              </ol>
              {brief.trim() ? (
                <Quiet>
                  Equita will read the brief for tasks and skills the moment you press <em>Plan from the brief</em>, and not before. It never
                  writes to a board on its own.
                </Quiet>
              ) : (
                <Quiet>
                  With no brief on it, this project will be an empty board you fill by hand. That is allowed — the plan step simply has nothing
                  to read.
                </Quiet>
              )}
            </Panel>

            <Panel title="What this page will send" hint="nothing is estimated here">
              <div className="stack stack--tight">
                <div className="row row--between">
                  <span className="label">Name</span>
                  <span className="card__meta">{name.trim() || "—"}</span>
                </div>
                <div className="row row--between">
                  <span className="label">For</span>
                  <span className="card__meta">
                    {isClass ? (chosenClass ? <Tag edge>{chosenClass.name}</Tag> : "a class, not chosen yet") : "your own group"}
                  </span>
                </div>
                <div className="row row--between">
                  <span className="label">Hand in</span>
                  <span className="card__meta">{dueAt ? fullDate(dueAt) : "no date"}</span>
                </div>
                <div className="row row--between">
                  <span className="label">People</span>
                  <span className="card__meta">
                    {isClass ? "from the class roster" : members.length ? plural(members.length, "added") : "just you"}
                  </span>
                </div>
                <div className="row row--between">
                  <span className="label">Brief</span>
                  <span className="card__meta tnum">{brief.trim().length ? `${brief.trim().length} characters` : "empty"}</span>
                </div>
              </div>
              <p className="field__hint" style={{ marginTop: "0.75rem" }}>
                Nothing on this page is guessed. There are no figures here until an engine has computed one.
              </p>
            </Panel>

            {teachable.length === 0 ? (
              <Panel title="Setting a class assignment" hint="why you cannot pick one">
                <p className="card__meta" style={{ lineHeight: 1.6 }}>
                  A class assignment belongs to a class, and only a teacher of that class can set one. If you teach, ask whoever runs the
                  account to switch your role — or join a class with the code the teacher gave you and it will appear here.
                </p>
              </Panel>
            ) : null}

            <Panel title="Looking for something else?" hint="two other ways in">
              <div className="stack stack--tight">
                <Link className="btn btn--outline btn--sm" to="/classrooms">
                  Join a class with a code
                  <IconArrowRight size={12} />
                </Link>
                <Link className="btn btn--outline btn--sm" to="/projects">
                  Open a group you are already in
                  <IconArrowRight size={12} />
                </Link>
              </div>
              <Quiet>
                <IconSparkle size={12} /> Everything Equita can do with a brief it can also do without one — you would just be writing the tasks
                yourself.
              </Quiet>
            </Panel>
          </div>
        </div>
      </form>
    </div>
  );
}