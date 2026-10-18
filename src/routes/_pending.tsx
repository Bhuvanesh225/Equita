/**
 * A placeholder for a screen that is still being written.
 *
 * It exists so the router can be complete from the first commit: every path in
 * the application resolves to something, and a half-built branch never leaves a
 * dead link behind in a demo. Each stub is replaced by its real module, and this
 * file is deleted when the last one is gone.
 */
import { Link } from "react-router-dom";

export default function Pending({ what }: { what: string }) {
  return (
    <div className="page">
      <div className="panel" style={{ maxWidth: "38rem" }}>
        <div className="panel__head">
          <span className="panel__title">{what}</span>
        </div>
        <div className="panel__body stack">
          <p style={{ color: "var(--color-ink-2)" }}>
            This screen is being built. The data engine behind it is finished and running — you can see it on the landing page and in
            the demonstration dataset.
          </p>
          <Link to="/" className="btn btn--outline btn--sm" style={{ justifySelf: "start" }}>
            Back to the front page
          </Link>
        </div>
      </div>
    </div>
  );
}
