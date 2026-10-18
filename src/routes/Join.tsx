/**
 * Join a class with a code.
 *
 * If the person is already signed in, this joins immediately. If they are not,
 * the code is carried to the sign-up form rather than being thrown away, because
 * the code is the reason they are here.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useSession } from "../lib/session";
import { useToast } from "../lib/live";
import { ApiError } from "../lib/api";
import { Field } from "../components/ui";
import { AuthLayout } from "./auth/parts";

export default function Join() {
  const { user, joinClass, memberships } = useSession();
  const { push } = useToast();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ id: string; name: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 3) {
      setError("That code looks too short. They look like SYS-2A.");
      return;
    }
    if (!user) {
      navigate(`/signup?code=${encodeURIComponent(clean)}`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const classroom = await joinClass(clean);
      setJoined(classroom);
      push({ title: `You are in ${classroom.name}`, tone: "good" });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That code did not match a class.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth__title">{joined ? "You are in" : "Join a class"}</h1>
      <p className="auth__sub">
        {joined
          ? "The groups your teacher has set up will appear here, with the hours you have each put in."
          : "Your teacher will have given you a short code — three letters and a number."}
      </p>

      {error ? (
        <div className="flag flag--critical" role="alert" style={{ marginBottom: "1rem" }}>
          <div className="flag__body">
            <span className="flag__title">That code did not work</span>
            <span className="flag__detail">{error}</span>
          </div>
        </div>
      ) : null}

      {joined ? (
        <div className="stack">
          <div className="callout callout--accent">
            You have joined <strong>{joined.name}</strong>. Nothing else is needed.
          </div>
          <div className="row row--wrap">
            <Link className="btn btn--primary" to={`/classrooms/${joined.id}`}>
              Open the class
            </Link>
            <Link className="btn btn--outline" to="/today">
              Go to Today
            </Link>
          </div>
        </div>
      ) : (
        <form className="auth__form" onSubmit={submit} noValidate>
          <Field label="Class code" htmlFor="code" hint="Letters and numbers, not case-sensitive.">
            <input
              id="code"
              className="input input--code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="SYS-2A"
              autoFocus
              style={{ fontSize: "var(--text-xl)", letterSpacing: "0.18em", fontVariantNumeric: "tabular-nums" }}
            />
          </Field>
          <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
            {busy ? "Checking…" : user ? "Join this class" : "Continue"}
          </button>
        </form>
      )}

      {user ? (
        <div className="auth__foot">
          {memberships.length ? (
            <>
              You are already in {memberships.map((c) => c.name).join(", ")}. <Link to="/classrooms">See your classes</Link>.
            </>
          ) : (
            <>
              Signed in as {user.name}. <Link to="/today">Go to Today</Link>.
            </>
          )}
        </div>
      ) : (
        <div className="auth__foot">
          No code yet? <Link to="/signup">Create an account</Link> and add it later, or <Link to="/login">sign in</Link>.
        </div>
      )}
    </AuthLayout>
  );
}