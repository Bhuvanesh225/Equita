/**
 * Sign in.
 *
 * The demo accounts are listed as buttons rather than described in prose,
 * because the only convincing thing about this product is what it says about a
 * group, and the fastest route to that is one click.
 */
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useSession } from "../lib/session";
import { useToast } from "../lib/live";
import { ApiError } from "../lib/api";
import { Field } from "../components/ui";
import { AuthLayout, DemoAccounts } from "./auth/parts";

export default function Login() {
  const { signIn, enterDemo } = useSession();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const comeFrom = (location.state as { from?: string } | null)?.from ?? "/today";

  const land = (name: string, to = comeFrom) => {
    push({ title: `Signed in as ${name}`, tone: "good" });
    navigate(to, { replace: true });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("form");
    setError(null);
    try {
      const user = await signIn(email.trim(), password);
      land(user.name);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That did not work. Try again.");
      setBusy(null);
    }
  };

  const demo = async (address: string) => {
    setBusy(address);
    setError(null);
    try {
      const user = await enterDemo(address);
      land(user.name);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That demonstration account could not be opened.");
      setBusy(null);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth__title">Sign in</h1>
      <p className="auth__sub">Your groups, the hours everybody has put in, and what to do next.</p>

      {error ? (
        <div className="flag flag--critical" role="alert" style={{ marginBottom: "1rem" }}>
          <div className="flag__body">
            <span className="flag__title">That sign-in did not work</span>
            <span className="flag__detail">{error}</span>
          </div>
        </div>
      ) : null}

      <form className="auth__form" onSubmit={submit} noValidate>
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@school.edu"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <button type="submit" className="btn btn--primary btn--lg" disabled={busy === "form" || !email || !password}>
          {busy === "form" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="auth__foot">
        New here? <Link to="/signup">Create an account</Link> — or, if your teacher gave you a code, <Link to="/join">join a class</Link>.
      </div>

      <div className="stack" style={{ marginTop: "1.6rem" }}>
        <p className="auth__rule">Or open a demonstration account</p>
        <DemoAccounts onPick={demo} busy={busy} />
        <p className="auth__small">All demonstration accounts use the password equita2026.</p>
      </div>
    </AuthLayout>
  );
}