/**
 * A dead end, handled as one.
 *
 * It names what was being looked for, offers the two or three places a person
 * was plausibly heading, and says what to do if a link is genuinely broken —
 * rather than apologising in the middle of an empty screen.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import { IconArrowRight, IconProjects, IconToday } from "../components/icons";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useSession();

  return (
    <div className="page">
      <div className="panel" style={{ maxWidth: "42rem" }}>
        <div className="panel__head">
          <span className="panel__title">No such page</span>
          <span className="label">404</span>
        </div>
        <div className="panel__body stack">
          <p style={{ fontSize: "var(--text-md)", lineHeight: 1.55 }}>
            Nothing lives at <code style={{ background: "var(--color-paper-2)", padding: "0.1rem 0.3rem" }}>{location.pathname}</code>.
          </p>
          <p style={{ color: "var(--color-ink-2)" }}>
            If you followed a link from inside Equita, that link is a bug and worth reporting. If you typed the address, one of these
            is probably what you wanted.
          </p>
          <div className="row row--wrap">
            {user ? (
              <>
                <Link to="/today" className="btn btn--primary btn--sm">
                  <IconToday size={14} />
                  Today
                </Link>
                <Link to="/projects" className="btn btn--outline btn--sm">
                  <IconProjects size={14} />
                  Projects
                </Link>
              </>
            ) : (
              <>
                <Link to="/" className="btn btn--primary btn--sm">
                  The front page
                  <IconArrowRight size={14} />
                </Link>
                <Link to="/login" className="btn btn--outline btn--sm">
                  Sign in
                </Link>
              </>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
