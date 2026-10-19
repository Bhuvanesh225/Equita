/**
 * The command palette.
 *
 * One keystroke to anywhere. It searches projects, tasks, classes and people
 * through the API, and offers the handful of commands that would otherwise be
 * buried — starting a project or joining a class.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../lib/live";
import { useSession } from "../lib/session";
import { qs } from "../lib/api";
import { useUi } from "./AppShell";
import { Avatar, Kbd, Spinner } from "../components/ui";
import {
  IconArrowRight,
  IconClass,
  IconPerson,
  IconPlus,
  IconProjects,
  IconScales,
  IconSearch,
  IconSettings,
  IconSparkle,
  IconToday,
} from "../components/icons";
import type { SearchResult } from "../lib/types";

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
  keepOpen?: boolean;
}

export function CommandPalette() {
  const { paletteOpen, closePalette, openCopilot } = useUi();
  const { signOut, memberships } = useSession();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const { data, loading } = useApi<{ results: SearchResult[] }>(
    paletteOpen && trimmed.length >= 2 ? `/api/insights/search${qs({ q: trimmed })}` : null,
    { live: false },
  );

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setCursor(0);
      // Focus after the node exists, so the caret is in the field immediately.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [paletteOpen]);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => {
      navigate(to);
      closePalette();
    };
    const list: Command[] = [
      { id: "today", title: "Today", group: "Go to", icon: <IconToday size={15} />, run: go("/") },
      { id: "projects", title: "Projects", group: "Go to", icon: <IconProjects size={15} />, run: go("/projects") },
      { id: "classes", title: "Classes", group: "Go to", icon: <IconClass size={15} />, run: go("/classrooms") },
      { id: "fairness", title: "Fairness across everything", group: "Go to", icon: <IconScales size={15} />, run: go("/insights") },
      { id: "people", title: "People", group: "Go to", icon: <IconPerson size={15} />, run: go("/people") },
      { id: "profile", title: "Your strengths", group: "Go to", icon: <IconPerson size={15} />, run: go("/profile") },
      { id: "settings", title: "Settings", group: "Go to", icon: <IconSettings size={15} />, run: go("/settings") },
      { id: "new-project", title: "Start a project", subtitle: "A team of friends, or your class", group: "Do", icon: <IconPlus size={15} />, run: go("/projects/new") },
      { id: "join", title: "Join a class with a code", group: "Do", icon: <IconClass size={15} />, run: go("/join") },
      {
        id: "ask",
        title: "Ask about the work",
        subtitle: "Who is overloaded, what is at risk, who owes hours",
        group: "Do",
        icon: <IconSparkle size={15} />,
        run: () => {
          closePalette();
          openCopilot();
        },
      },
      { id: "signout", title: "Sign out", group: "Do", icon: <IconSettings size={15} />, run: () => void signOut() },
    ];
    for (const classroom of memberships) {
      list.push({
        id: `class-${classroom.id}`,
        title: classroom.name,
        subtitle: classroom.code,
        group: "Your classes",
        icon: <IconClass size={15} />,
        run: go(`/classrooms/${classroom.id}`),
      });
    }
    return list;
  }, [navigate, closePalette, openCopilot, signOut, memberships]);

  const matchedCommands = useMemo(() => {
    if (!trimmed) return commands.slice(0, 7);
    const needle = trimmed.toLowerCase();
    return commands.filter((command) => `${command.title} ${command.subtitle ?? ""}`.toLowerCase().includes(needle)).slice(0, 6);
  }, [commands, trimmed]);

  const results = (data?.results ?? []).map<Command>((result) => ({
    id: `${result.kind}-${result.id}`,
    title: result.title,
    subtitle: result.subtitle,
    group: result.kind === "project" ? "Projects" : result.kind === "task" ? "Tasks" : result.kind === "class" ? "Classes" : "People",
    icon:
      result.kind === "project" ? (
        <IconProjects size={15} />
      ) : result.kind === "class" ? (
        <IconClass size={15} />
      ) : result.kind === "person" ? (
        <Avatar name={result.title} hue={result.hue ?? 0} size="sm" />
      ) : (
        <IconArrowRight size={15} />
      ),
    run: () => {
      navigate(result.href);
      closePalette();
    },
  }));

  const flat = [...matchedCommands, ...results];

  useEffect(() => {
    setCursor(0);
  }, [query, data]);

  if (!paletteOpen) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = flat[cursor];
      if (chosen) {
        chosen.run();
        if (!chosen.keepOpen) closePalette();
        else setQuery("");
      }
    } else if (event.key === "Escape") {
      closePalette();
    }
  };

  let lastGroup = "";
  let runningIndex = -1;

  return (
    <>
      <div className="scrim" onClick={closePalette} aria-hidden="true" />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search and commands">
        <div className="palette__field">
          <IconSearch size={16} />
          <input
            ref={inputRef}
            className="palette__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search, or type a command…"
            aria-label="Search everything"
            autoComplete="off"
            spellCheck={false}
          />
          {loading ? <Spinner /> : <Kbd>esc</Kbd>}
        </div>

        <div className="palette__list" ref={listRef}>
          {flat.length === 0 ? (
            <p style={{ padding: "1rem 0.75rem", fontSize: "var(--text-sm)", color: "var(--color-ink-2)" }}>
              {trimmed.length < 2 ? "Type at least two letters to search." : `Nothing matches “${trimmed}”.`}
            </p>
          ) : (
            flat.map((item) => {
              runningIndex += 1;
              const index = runningIndex;
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {header ? <p className="palette__group">{header}</p> : null}
                  <button
                    type="button"
                    className="palette__item"
                    data-active={index === cursor}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => {
                      item.run();
                      if (!item.keepOpen) closePalette();
                    }}
                  >
                    <span aria-hidden="true" style={{ color: "var(--color-ink-3)", display: "flex" }}>
                      {item.icon}
                    </span>
                    <span className="palette__item-title">
                      {item.title}
                      {item.subtitle ? <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--color-ink-3)" }}>{item.subtitle}</span> : null}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="panel__foot row row--wrap" style={{ gap: "0.75rem" }}>
          <span className="row" style={{ gap: "0.3rem" }}>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span className="row" style={{ gap: "0.3rem" }}>
            <Kbd>↵</Kbd> to open
          </span>
          <span className="row" style={{ gap: "0.3rem" }}>
            <Kbd>⌘J</Kbd> to ask
          </span>
        </div>
      </div>
    </>
  );
}
