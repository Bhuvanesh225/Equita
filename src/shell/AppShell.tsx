/**
 * The shell.
 *
 * A rail on the left, a bar across the top, and one place that owns the two
 * things that can appear over anything: the command palette and the copilot.
 * Both are opened from anywhere through `useUi`, and both are reachable from the
 * keyboard, because a tool people keep open all lesson needs to be quick.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApi, useLive, useToast } from "../lib/live";
import { useSession } from "../lib/session";
import { post } from "../lib/api";
import { relativeTime } from "../lib/format";
import { Avatar, Kbd, Spinner } from "../components/ui";
import { Drawer, Menu } from "../components/overlays";
import {
  IconBell,
  IconClass,
  IconClose,
  IconLogout,
  IconMenu,
  IconMoon,
  IconPeople,
  IconPerson,
  IconProjects,
  IconScales,
  IconSearch,
  IconSettings,
  IconSparkle,
  IconSun,
  IconToday,
} from "../components/icons";
import type { Notification } from "../lib/types";

/* ---------- the things that float --------------------------------------- */

interface UiShape {
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  copilot: { open: boolean; projectId?: string | null; classroomId?: string | null; question?: string };
  openCopilot: (scope?: { projectId?: string | null; classroomId?: string | null; question?: string }) => void;
  closeCopilot: () => void;
  scheme: Scheme;
  setScheme: (next: Scheme) => void;
}

const UiContext = createContext<UiShape | null>(null);

export type Scheme = "paper" | "ink";

export function UiProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilot, setCopilot] = useState<UiShape["copilot"]>({ open: false });
  const [scheme, setSchemeState] = useState<Scheme>(() => (document.documentElement.dataset.scheme === "ink" ? "ink" : "paper"));

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const openCopilot = useCallback((scope?: { projectId?: string | null; classroomId?: string | null; question?: string }) => {
    setCopilot({ open: true, projectId: scope?.projectId ?? null, classroomId: scope?.classroomId ?? null, question: scope?.question });
  }, []);
  const closeCopilot = useCallback(() => setCopilot((c) => ({ ...c, open: false })), []);
  const setScheme = useCallback((next: Scheme) => {
    document.documentElement.dataset.scheme = next;
    try {
      localStorage.setItem("equita.scheme", next);
    } catch {
      /* private browsing; the choice simply does not persist */
    }
    setSchemeState(next);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (meta && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setCopilot((c) => ({ ...c, open: !c.open }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<UiShape>(
    () => ({ paletteOpen, openPalette, closePalette, copilot, openCopilot, closeCopilot, scheme, setScheme }),
    [paletteOpen, openPalette, closePalette, copilot, openCopilot, closeCopilot, scheme, setScheme],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiShape {
  const context = useContext(UiContext);
  if (!context) throw new Error("useUi was used outside UiProvider");
  return context;
}

/* ---------- the scheme -------------------------------------------------- */

export function useScheme() {
  const { scheme, setScheme } = useUi();
  return { scheme, setScheme };
}

/* ---------- notifications ----------------------------------------------- */

function NotificationBell() {
  const { refresh } = useSession();
  const [open, setOpen] = useState(false);
  const { data, refresh: reload } = useApi<{ notifications: Notification[]; unread: number }>("/api/insights/notifications", { poll: 60_000 });
  const { push } = useToast();

  const unread = data?.unread ?? 0;

  const markRead = async (ids?: string[], all = false) => {
    await post("/api/insights/notifications/read", all ? { all: true } : { ids });
    reload();
    refresh();
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn--ghost btn--icon"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell size={17} />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              background: "var(--color-risk)",
              color: "#fff",
              fontSize: "0.625rem",
              fontWeight: 700,
              lineHeight: 1.3,
              padding: "0 3px",
              minWidth: "1rem",
              textAlign: "center",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="scrim scrim--soft" style={{ zIndex: 88 }} onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="menu" style={{ right: 0, top: "calc(100% + 0.4rem)", width: "min(24rem, calc(100vw - 2rem))", padding: 0, zIndex: 89 }} role="dialog" aria-label="Notifications">
            <div className="panel__head" style={{ minHeight: "2.5rem" }}>
              <span className="panel__title" style={{ fontSize: "var(--text-sm)" }}>
                Notifications
              </span>
              <div className="row">
                {unread > 0 ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={async () => {
                      await markRead(undefined, true);
                      push({ title: "All caught up", tone: "good" });
                    }}
                  >
                    Mark all read
                  </button>
                ) : null}
                <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label="Close" onClick={() => setOpen(false)}>
                  <IconClose size={12} />
                </button>
              </div>
            </div>
            <div style={{ maxHeight: "22rem", overflowY: "auto" }}>
              {!data ? (
                <div className="panel__body">
                  <Spinner label="Loading" />
                </div>
              ) : data.notifications.length === 0 ? (
                <p className="panel__body" style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-2)" }}>
                  Nothing yet. When something needs you — a task assigned, a check-in missed, a load that has tipped — it appears here.
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {data.notifications.slice(0, 20).map((item) => (
                    <li key={item.id} style={{ borderBottom: "1px solid var(--color-line)" }}>
                      <a
                        href={item.link || "#"}
                        className="rowitem"
                        style={{ gridTemplateColumns: "minmax(0,1fr) auto", opacity: item.readAt ? 0.62 : 1 }}
                        onClick={(event) => {
                          if (!item.link) event.preventDefault();
                          if (!item.readAt) void markRead([item.id]);
                          setOpen(false);
                        }}
                      >
                        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                          <span className="rowitem__title" style={{ whiteSpace: "normal" }}>
                            {item.title}
                          </span>
                          {item.body ? <span className="rowitem__sub" style={{ whiteSpace: "normal" }}>{item.body}</span> : null}
                        </span>
                        <span className="label nowrap">{relativeTime(item.createdAt)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="panel__foot">
              <NavLink to="/notifications" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
                See everything
              </NavLink>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ---------- the rail ---------------------------------------------------- */

function navItems(counts: { projects: number; unread: number; openTasks: number }) {
  return {
    main: [
      { to: "/today", label: "Today", icon: <IconToday size={16} />, end: true },
      { to: "/projects", label: "Projects", icon: <IconProjects size={16} />, count: counts.projects },
      { to: "/classrooms", label: "Classes", icon: <IconClass size={16} /> },
    ],
    insight: [
      { to: "/insights", label: "Fairness", icon: <IconScales size={16} /> },
      { to: "/people", label: "People", icon: <IconPeople size={16} /> },
    ],
    you: [
      { to: "/profile", label: "Your strengths", icon: <IconPerson size={16} /> },
      { to: "/notifications", label: "Notifications", icon: <IconBell size={16} />, count: counts.unread, alert: counts.unread > 0 },
      { to: "/settings", label: "Settings", icon: <IconSettings size={16} /> },
    ],
  };
}

function RailLink({ item }: { item: { to: string; label: string; icon: ReactNode; count?: number; alert?: boolean; end?: boolean } }) {
  return (
    <NavLink to={item.to} end={item.end} className="rail__item">
      {({ isActive }) => (
        <>
          <span className="rail__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="rail__name">{item.label}</span>
          {item.count !== undefined && item.count > 0 ? (
            <span className={`rail__count${item.alert ? " rail__count--alert" : ""}`}>{item.count > 99 ? "99+" : item.count}</span>
          ) : null}
          {isActive ? null : <span className="visually-hidden"> </span>}
        </>
      )}
    </NavLink>
  );
}

function Brand() {
  return (
    <NavLink to="/" className="rail__brand" aria-label="Equita home">
      <svg className="rail__mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" fill="var(--color-ink)" />
        {/* the product's own mark: four equal shares, one held */}
        <rect x="5" y="13" width="5" height="14" fill="var(--color-paper)" />
        <rect x="11" y="9" width="5" height="18" fill="var(--color-paper)" />
        <rect x="17" y="13" width="5" height="14" fill="var(--color-paper)" />
        <rect x="23" y="13" width="5" height="14" fill="var(--color-accent)" />
      </svg>
      <span className="rail__wordmark">Equita</span>
    </NavLink>
  );
}

function Rail({ counts }: { counts: { projects: number; unread: number; openTasks: number } }) {
  const { user } = useSession();
  const { scheme, toggle } = useSchemeMenu();
  const items = navItems(counts);

  return (
    <aside className="rail" aria-label="Sections">
      <Brand />
      <nav className="rail__group">
        {items.main.map((item) => (
          <RailLink key={item.to} item={item} />
        ))}
      </nav>
      <nav className="rail__group">
        <span className="rail__label">Insight</span>
        {items.insight.map((item) => (
          <RailLink key={item.to} item={item} />
        ))}
      </nav>
      <nav className="rail__group">
        <span className="rail__label">You</span>
        {items.you.map((item) => (
          <RailLink key={item.to} item={item} />
        ))}
      </nav>
      <div className="rail__spacer" />
      <div className="rail__foot">
        {user ? (
          <NavLink to="/profile" className="row" style={{ padding: "0.35rem 0.5rem", gap: "0.5rem" }}>
            <Avatar name={user.name} hue={user.hue} />
            <span style={{ minWidth: 0 }}>
              <span className="rail__name" style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 550 }}>
                {user.name}
              </span>
              <span className="label" style={{ display: "block" }}>
                {user.role === "teacher" ? "Teacher" : "Student"} · {user.capacity}h a week
              </span>
            </span>
          </NavLink>
        ) : null}
        <button type="button" className="rail__item" onClick={toggle} aria-pressed={scheme === "ink"}>
          <span className="rail__icon">{scheme === "ink" ? <IconSun size={16} /> : <IconMoon size={16} />}</span>
          <span className="rail__name">{scheme === "ink" ? "Light" : "Dark"}</span>
        </button>
      </div>
    </aside>
  );
}

/** The rail and the account menu toggle the scheme the same way. */
function useSchemeMenu() {
  const { scheme, setScheme } = useScheme();
  return { scheme, toggle: () => setScheme(scheme === "ink" ? "paper" : "ink") };
}

/* ---------- the top bar ------------------------------------------------- */

function TopBar({ counts }: { counts: { unread: number; openTasks: number } }) {
  const { user, signOut } = useSession();
  const { openPalette, openCopilot } = useUi();
  const { connected } = useLive();
  const { scheme, setScheme } = useScheme();
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMobileNav(false), [location.pathname]);

  const items = navItems({ projects: 0, unread: counts.unread, openTasks: counts.openTasks });

  return (
    <>
      <header className="topbar">
        <div className="shell topbar__inner">
          <button type="button" className="btn btn--ghost btn--icon topbar__burger" aria-label="Open navigation" onClick={() => setMobileNav(true)}>
            <IconMenu size={18} />
          </button>

          <button type="button" className="topbar__search search" onClick={openPalette} aria-label="Search everything">
            <span className="search__icon" aria-hidden="true">
              <IconSearch size={15} />
            </span>
            <span className="input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
              <span style={{ color: "var(--color-ink-3)" }}>Search projects, tasks, people…</span>
              <Kbd>⌘K</Kbd>
            </span>
          </button>

          <div className="topbar__actions">
            <span className={`live${connected ? " live--on" : " live--off"}`} title={connected ? "Live updates are flowing" : "Reconnecting to the live stream"}>
              <span className="live__dot" aria-hidden="true" />
              <span className="visually-hidden">{connected ? "Live updates connected" : "Live updates reconnecting"}</span>
            </span>

            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => openCopilot()}
              title="Ask about any project or class. Every answer is computed from the real numbers."
            >
              <IconSparkle size={14} />
              Ask
            </button>

            <NotificationBell />

            {user ? (
              <Menu
                align="right"
                className="tip"
                label={<Avatar name={user.name} hue={user.hue} size="sm" />}
                items={[
                  { label: "Your strengths", onSelect: () => navigate("/profile"), hint: `${user.capacity}h/week` },
                  { label: "Settings", onSelect: () => navigate("/settings") },
                  { label: scheme === "ink" ? "Switch to light" : "Switch to dark", onSelect: () => setScheme(scheme === "ink" ? "paper" : "ink") },
                  { label: "Sign out", onSelect: () => void signOut(), danger: true },
                ]}
              />
            ) : null}
          </div>
        </div>
      </header>

      {mobileNav ? (
        <div className="mobile-nav">
          <div className="scrim" onClick={() => setMobileNav(false)} aria-hidden="true" style={{ position: "absolute" }} />
          <div className="mobile-nav__panel" role="dialog" aria-label="Sections" style={{ position: "relative", zIndex: 1 }}>
            <div className="row row--between" style={{ paddingBottom: "0.5rem" }}>
              <Brand />
              <button type="button" className="btn btn--ghost btn--icon" aria-label="Close navigation" onClick={() => setMobileNav(false)}>
                <IconClose size={16} />
              </button>
            </div>
            <nav className="rail__group">
              {[...items.main, ...items.insight, ...items.you].map((item) => (
                <RailLink key={item.to} item={item} />
              ))}
            </nav>
            <div className="rail__spacer" />
            <button type="button" className="rail__item" onClick={() => void signOut()}>
              <span className="rail__icon">
                <IconLogout size={16} />
              </span>
              <span className="rail__name">Sign out</span>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ---------- the shell --------------------------------------------------- */

export function AppShell() {
  const { user, counts } = useSession();

  if (!user) return null;

  return (
    <div className="app">
      <Rail counts={counts} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar counts={counts} />
        <main id="main" className="shell" style={{ flex: "1 1 auto", minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** A drawer the routes can use for the mobile rail when needed. */
export function MobileDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      {children}
    </Drawer>
  );
}
