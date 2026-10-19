/**
 * Settings.
 *
 * The landing point for everything that is not about the work itself: who you
 * are, how the product is drawn, which classes you are in, and the way out. It
 * is deliberately four short panels rather than a tabbed maze — a person arrives
 * here with one of four questions and should see the answer without navigating.
 *
 * Two things live here that exist nowhere else, and both are honesty fixes:
 *
 *   - **Leaving a class.** The server now allows a member to remove themselves
 *     (`DELETE /api/classrooms/:id/students/:userId` where the id is your own).
 *     Without this control, `/classrooms` would have offered a membership with no
 *     way to end it.
 *   - **Switching role.** `POST /api/classrooms` already told non-teachers to
 *     "switch your role in settings". This panel is the switch it was promising,
 *     and the server refuses the one case that would strand a class: an account
 *     that owns one cannot stop being a teacher.
 *
 * Appearance is the one control that must not be reimplemented: `useScheme` owns
 * the pre-paint read in `index.html`, so the switch here is the same switch the
 * rail's moon button uses.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { del, ApiError } from "../lib/api";
import { useToast } from "../lib/live";
import { useSession } from "../lib/session";
import { hours, plural } from "../lib/format";
import { EmptyState, Field, Panel, Segmented, Spinner } from "../components/ui";
import { JoinCode, PageHead, Quiet } from "../components/blocks";
import { Confirm } from "../components/overlays";
import { useScheme } from "../shell/AppShell";
import type { Classroom } from "../lib/types";

type Scheme = "paper" | "ink";

export default function Settings() {
  const { user, memberships, loading, saveProfile, refresh, signOut } = useSession();
  const { scheme, setScheme } = useScheme();
  const { push } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [school, setSchool] = useState("");
  const [capacity, setCapacity] = useState(8);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Classroom | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    if (!user || ready) return;
    setName(user.name);
    setHeadline(user.headline ?? "");
    setSchool(user.school ?? "");
    setCapacity(user.capacity);
    setReady(true);
  }, [user, ready]);

  if (loading && !user) {
    return (
      <div className="page">
        <Spinner label="Opening your settings" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <EmptyState
          title="Nobody is signed in"
          text="Settings belong to a person, so this page needs to know who you are."
          action={
            <Link className="btn btn--primary" to="/login">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  const changed =
    name.trim() !== user.name ||
    headline.trim() !== (user.headline ?? "") ||
    school.trim() !== (user.school ?? "") ||
    capacity !== user.capacity;

  const saveYou = async () => {
    if (name.trim().length < 2) {
      setError("Your name needs at least two characters — it is what everybody else sees.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveProfile({ name: name.trim(), headline: headline.trim(), school: school.trim(), capacity });
      push({ title: "Saved", detail: "The rail and every group you are in now say the same thing.", tone: "good" });
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "That did not save.";
      setError(message);
      push({ title: "That did not save", detail: message, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (role: "student" | "teacher") => {
    if (role === user.role) return;
    try {
      await saveProfile({ role });
      push({
        title: role === "teacher" ? "You are a teacher now" : "You are a student now",
        detail: role === "teacher" ? "You can start a class and own a roster." : "Your classes stay; you just cannot start new ones.",
        tone: "good",
      });
    } catch (cause) {
      push({ title: "The role did not change", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
    }
  };

  const leave = async () => {
    const target = leaving;
    if (!target) return;
    setBusy(true);
    try {
      await del(`/api/classrooms/${target.id}/students/${user.id}`);
      await refresh();
      push({
        title: `Left ${target.name}`,
        detail: "Your work stays on the record, and anything still open has been released rather than deleted.",
        tone: "good",
      });
      setLeaving(null);
    } catch (cause) {
      push({ title: "You could not leave", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  const signOutNow = async () => {
    setConfirmOut(false);
    await signOut();
    navigate("/login");
  };

  return (
    <div className="page">
      <PageHead
        kicker="Your account"
        title="Settings"
        sub={`${user.email} · ${user.role === "teacher" ? "teacher account" : "student account"} · ${hours(user.capacity)} a week`}
      />

      <div className="grid grid--split">
        <Panel
          title="You"
          hint="the formal version; your strengths live on their own screen"
          actions={
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void saveYou()} disabled={busy || !changed}>
              {busy ? "Saving..." : changed ? "Save" : "Saved"}
            </button>
          }
        >
          <div className="stack">
            <Field label="Name" required htmlFor="settings-name" error={error}>
              <input id="settings-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Headline" hint="One line, shown beside your name.">
              <input className="input" value={headline} onChange={(event) => setHeadline(event.target.value)} />
            </Field>
            <Field label="School">
              <input className="input" value={school} onChange={(event) => setSchool(event.target.value)} />
            </Field>
            <Field label="Hours a week" hint="What the allocator weighs committed work against.">
              <div className="row" style={{ gap: "0.6rem" }}>
                <input
                  className="input"
                  type="number"
                  min={0.5}
                  max={60}
                  step={0.5}
                  value={capacity}
                  style={{ maxWidth: "7rem" }}
                  aria-label="Hours a week"
                  onChange={(event) => setCapacity(Number(event.target.value))}
                />
                <span className="label">a week</span>
              </div>
            </Field>
            <Quiet>
              What you can do, and how much you want more of it, is on{" "}
              <Link className="tap" to="/profile">
                your strengths
              </Link>
              . That page is the allocator's input; this one is your account.
            </Quiet>
          </div>
        </Panel>

        <div className="stack stack--loose">
          <Panel title="Appearance" hint="applies before the page paints, and is remembered">
            <div className="stack stack--tight">
              <Segmented<Scheme>
                ariaLabel="Colour scheme"
                value={scheme === "ink" ? "ink" : "paper"}
                onChange={(next) => setScheme(next)}
                options={[
                  { value: "paper", label: "Paper", title: "Dark text on a light ground" },
                  { value: "ink", label: "Ink", title: "Light text on a dark ground" },
                ]}
              />
              <p className="card__meta" style={{ lineHeight: 1.55 }}>
                Both schemes are drawn from the same tokens, so every figure, bar and signal colour means the same thing in either. Choose
                whichever is kinder to the room you are in.
              </p>
            </div>
          </Panel>

          <Panel title="Account" hint="what this account can do">
            <div className="stack">
              <Field label="Email" hint="The address you sign in with. It cannot be changed here.">
                <input className="input" value={user.email} readOnly aria-readonly="true" />
              </Field>
              <Field
                label="Role"
                hint={
                  user.role === "teacher"
                    ? "A teacher account can own a class and its roster."
                    : "A student account can be added to a class, or join one with a code. Teachers can start classes."
                }
              >
                <Segmented<"student" | "teacher">
                  ariaLabel="Account role"
                  value={user.role}
                  onChange={(next) => void changeRole(next)}
                  options={[
                    { value: "student", label: "Student", title: "Join classes, run your own groups" },
                    { value: "teacher", label: "Teacher", title: "Own a class and its roster" },
                  ]}
                />
              </Field>
              <div className="row row--between row--wrap" style={{ gap: "0.5rem" }}>
                <span className="card__meta">Signing out clears this browser's session; nothing is deleted.</span>
                <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirmOut(true)}>
                  Sign out
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Your classes"
        hint={memberships.length ? plural(memberships.length, "class", "classes") : "you are not in one yet"}
        flush
      >
        {memberships.length ? (
          <div className="rows">
            {memberships.map((classroom) => {
              const owner = classroom.ownerId === user.id;
              const teaching = classroom.role === "teacher" || owner;
              return (
                <div key={classroom.id} className="rowitem" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span style={{ minWidth: 0 }}>
                    <Link className="rowitem__title tap" to={`/classrooms/${classroom.id}`}>
                      {classroom.name}
                    </Link>
                    <span className="rowitem__sub">
                      {teaching ? "You teach this class" : "You are a student in this class"}
                      {classroom.subject ? ` · ${classroom.subject}` : ""}
                      {classroom.term ? ` · ${classroom.term}` : ""}
                    </span>
                  </span>
                  <span className="row row--wrap" style={{ gap: "0.5rem", justifySelf: "end" }}>
                    <JoinCode code={classroom.code} compact />
                    {owner ? (
                      <span className="label">owner</span>
                    ) : (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLeaving(classroom)}>
                        Leave
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel__body">
            <EmptyState
              compact
              title="No classes yet"
              text="A teacher can add you, or you can join with the code they gave you. Your own groups live under Projects either way."
              action={
                <>
                  <Link className="btn btn--primary btn--sm" to="/classrooms">
                    Go to Classes
                  </Link>
                  <Link className="btn btn--outline btn--sm" to="/join">
                    Join with a code
                  </Link>
                </>
              }
            />
          </div>
        )}
      </Panel>

      <Confirm
        open={!!leaving}
        onClose={() => setLeaving(null)}
        onConfirm={() => void leave()}
        busy={busy}
        danger
        title={leaving ? `Leave ${leaving.name}?` : "Leave this class?"}
        confirmLabel="Leave the class"
        body={
          <>
            You come off the roster and out of every group in this class. Your logged hours stay on the record — the work happened — and any
            task still open on you is released to the group rather than deleted. Nothing can undo this from your side.
          </>
        }
      />

      <Confirm
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        onConfirm={() => void signOutNow()}
        danger
        title="Sign out?"
        confirmLabel="Sign out"
        body="This clears the session in this browser. Your groups, your hours and your class memberships all stay exactly as they are — signing back in puts you where you left off."
      />
    </div>
  );
}