/**
 * Create an account.
 *
 * The role choice changes what the account is for, so it is a real choice with
 * consequences described, not a dropdown. A student may already have a code from
 * a teacher, so the code field is here rather than on a screen afterwards.
 */
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useSession } from "../lib/session";
import { useToast } from "../lib/live";
import { ApiError } from "../lib/api";
import { Field } from "../components/ui";
import { AuthLayout } from "./auth/parts";

type Role = "student" | "teacher";

export default function Signup() {
  const { signUp } = useSession();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState("");
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problems: Record<string, string> = {};
    if (name.trim().length < 2) problems.name = "A name is needed — it is what the group sees.";
    if (!email.includes("@")) problems.email = "That does not look like an email address.";
    if (password.length < 8) problems.password = "At least eight characters.";
    setFieldErrors(problems);
    if (Object.keys(problems).length) return;

    setBusy(true);
    setError(null);
    try {
      const result = await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        school: school.trim() || undefined,
        joinCode: code.trim() || undefined,
      });
      push({
        title: result.joined ? `You are in ${result.joined.name}` : `Welcome, ${result.user.name}`,
        detail: result.joined ? "Your teacher's group work will appear on your Today screen." : undefined,
        tone: "good",
      });
      navigate("/today", { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That did not work. Try again.");
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth__title">Create an account</h1>
      <p className="auth__sub">Students can work in their own group without a school. Teachers get a class console.</p>

      {error ? (
        <div className="flag flag--critical" role="alert" style={{ marginBottom: "1rem" }}>
          <div className="flag__body">
            <span className="flag__title">That did not work</span>
            <span className="flag__detail">{error}</span>
          </div>
        </div>
      ) : null}

      <form className="auth__form" onSubmit={submit} noValidate>
        <div>
          <span className="field__label">I am</span>
          <div className="auth__role" style={{ marginTop: "0.35rem" }}>
            <button type="button" aria-pressed={role === "student"} onClick={() => setRole("student")}>
              <strong>A student</strong>
              <span>Work in a group, or on my own. Claim tasks by what I am good at.</span>
            </button>
            <button type="button" aria-pressed={role === "teacher"} onClick={() => setRole("teacher")}>
              <strong>A teacher</strong>
              <span>Set up classes, build groups, see which groups need help.</span>
            </button>
          </div>
        </div>

        <Field label="Name" htmlFor="name" error={fieldErrors.name} required>
          <input id="name" className="input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field label="Email" htmlFor="email" error={fieldErrors.email} required>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>

        <Field label="Password" htmlFor="password" error={fieldErrors.password} hint="At least eight characters." required>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field label="School" htmlFor="school" hint={role === "teacher" ? "Shown to the classes you own." : "Optional."}>
          <input id="school" className="input" value={school} onChange={(event) => setSchool(event.target.value)} placeholder="Riverside Sixth Form" />
        </Field>

        <Field label="Class code" htmlFor="code" hint="If a teacher gave you one. You can add it later.">
          <input
            id="code"
            className="input tnum"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="SYS-2A"
            style={{ letterSpacing: "0.08em" }}
          />
        </Field>

        <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <div className="auth__foot">
        Already have an account? <Link to="/login">Sign in</Link>.
      </div>
    </AuthLayout>
  );
}