/**
 * The pieces every signed-in screen is built from.
 *
 * The application has one repeated object — a task — and one repeated question —
 * who is carrying what — so both are defined once here and reused, which is also
 * what keeps the fairness engine's verdicts looking the same wherever they
 * appear.
 */
import { type ReactNode, useCallback, useState } from "react";
import { Link } from "react-router-dom";

import { post } from "../lib/api";
import { useAction, useToast } from "../lib/live";
import { ApiError } from "../lib/api";
import {
  MOOD_NAMES,
  PHASE_NAMES,
  STATUS_NAMES,
  dateLabel,
  daysUntil,
  dueLabel,
  hours,
  hueStyle,
  relativeTime,
  stateTone,
  severityTone,
  toneTextClass,
  toneVar,
  type Tone,
} from "../lib/format";
import { Avatar, MemberDot, Panel, StateChip, Tag } from "./ui";
import { Confirm } from "./overlays";
import { IconAlert, IconArrowRight, IconBlocked, IconClock, IconCopy, IconInfo, IconLink } from "./icons";
import type { ActivityEntry, EquityFlag, Nudge, Task, TaskStatus } from "../lib/types";

/* ---------- page furniture ---------------------------------------------- */

export function PageHead({
  kicker,
  title,
  sub,
  actions,
  tabs,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head__title">
        {kicker ? <p className="page-head__kicker">{kicker}</p> : null}
        <h1 className="page-head__heading">{title}</h1>
        {sub ? <p className="page-head__sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-head__actions">{actions}</div> : null}
      {tabs ? <div className="page-head__tabs">{tabs}</div> : null}
    </header>
  );
}

/* ---------- small read-outs --------------------------------------------- */

export function PhaseTag({ phase }: { phase: string }) {
  return <Tag edge title={PHASE_NAMES[phase] ?? phase}>{PHASE_NAMES[phase] ?? phase}</Tag>;
}

const STATUS_TONE: Record<TaskStatus, "line" | "accent" | "over" | "risk" | "quiet"> = {
  todo: "line",
  doing: "accent",
  review: "over",
  blocked: "risk",
  done: "quiet",
};

export function StatusTag({ status, title }: { status: TaskStatus; title?: string }) {
  const tone = STATUS_TONE[status];
  return (
    <Tag tone={tone === "line" ? undefined : tone} edge={tone === "line"} dot={status === "blocked" || status === "doing"} title={title}>
      {STATUS_NAMES[status] ?? status}
    </Tag>
  );
}

/**
 * A check-in mood, worded as the person themselves said it.
 *
 * `stuck` and `behind` are the two a group needs to see, so they carry the
 * alarm colours; `ahead` and `steady` are the same good news and share one.
 * This lived inline in two screens with identical ternaries before it moved
 * here — a mood that reads as amber on one screen and plain on another is a
 * contradiction nobody would notice for weeks.
 */
export function MoodTag({ mood, title }: { mood: string; title?: string }) {
  const tone: Tone = mood === "stuck" ? "risk" : mood === "behind" ? "over" : "accent";
  return (
    <Tag tone={tone} dot title={title}>
      {MOOD_NAMES[mood] ?? mood}
    </Tag>
  );
}

/** A due date as a sentence a person would say, with the alarm only when real. */
export function DueMark({ dueAt, done }: { dueAt: string | null | undefined; done?: boolean }) {
  const days = daysUntil(dueAt);
  if (!dueAt || days === null) return <span className="card__meta">no date</span>;
  if (done) return <span className="card__meta">closed {dateLabel(dueAt)}</span>;
  const late = days < 0;
  const tone = late ? "var(--color-risk)" : days <= 1 ? "var(--color-over)" : "var(--color-ink-3)";
  // Whole days only: nobody needs to read "2.8830958912037037 days".
  const over = Math.max(1, Math.round(Math.abs(days)));
  const left = Math.round(days);
  return (
    <span className="card__meta" style={{ color: tone, fontWeight: late ? 600 : 400 }} title={dueLabel(dueAt)}>
      <IconClock size={12} />
      {late ? `${over} day${over === 1 ? "" : "s"} over` : days < 0.5 ? "today" : days < 1.5 ? "tomorrow" : `${left} days`}
    </span>
  );
}

export function ScoreMark({ score, gini, label }: { score: number; gini?: number; label?: string }) {
  const tone = score >= 75 ? "accent" : score >= 60 ? "ink" : score >= 45 ? "over" : "risk";
  return (
    <span
      className="scoremark"
      title={`Fairness ${score} out of 100 — five weighted measures of how evenly the work is shared and how much of it has actually landed`}
    >
      <span className={`tnum ${toneTextClass(tone)}`} style={{ fontWeight: 650 }}>
        {score}
      </span>
      <span className="card__meta">{label ?? "fairness"}</span>
      {gini !== undefined ? (
        <span className="card__meta" title="Gini of delivered work: 0 is identical, 1 is one person doing everything">
          · Gini {gini.toFixed(2)}
        </span>
      ) : null}
    </span>
  );
}

/* ---------- the join code ----------------------------------------------- */

/**
 * A class's join code, with the one action anybody ever takes on it. It appears
 * on the class list and again in the console, so it is defined once here rather
 * than twice with two different copies of the failure message.
 */
export function JoinCode({ code, compact }: { code: string; compact?: boolean }) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true);
        push({ title: `Join code ${code} copied`, detail: "Anyone with an Equita account can use it to join this class.", tone: "good" });
        setTimeout(() => setCopied(false), 2000);
      },
      () => push({ title: "The clipboard was blocked", detail: `The code is ${code} — select it and copy by hand.`, tone: "bad" }),
    );
  };

  return (
    <span className="row" style={{ gap: "0.35rem", minWidth: 0 }}>
      {compact ? null : <span className="label">Code</span>}
      <Tag edge title={`Students type ${code} to join this class`}>
        <span className="tnum" style={{ letterSpacing: "0.08em" }}>
          {code}
        </span>
      </Tag>
      <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={copy} aria-label={`Copy the join code ${code}`} title={`Copy ${code}`}>
        {copied ? <span aria-hidden="true">✓</span> : <IconCopy size={13} />}
      </button>
    </span>
  );
}

/* ---------- flags and nudges -------------------------------------------- */

/**
 * The shape a flag actually has to have to be rendered.
 *
 * `scope` and the member fields are optional because the classroom engine hands
 * a student their flags from several groups at once, where the scope is not the
 * interesting part — the project it came from is. Widening the prop here keeps
 * the one flag renderer rather than growing a second one for that case.
 */
export type FlagLike = Pick<EquityFlag, "kind" | "severity" | "detail"> & Partial<Pick<EquityFlag, "scope" | "memberId" | "memberName">>;

export function FlagList({ flags, limit = 4 }: { flags: FlagLike[]; limit?: number }) {
  const [open, setOpen] = useState(false);
  if (!flags.length) return null;
  const shown = open ? flags : flags.slice(0, limit);

  return (
    <div className="stack stack--tight">
      {shown.map((flag, index) => (
        <div key={`${flag.kind}-${flag.memberId ?? index}`} className={`flag flag--${flag.severity}`}>
          <span style={{ color: toneVar(severityTone(flag.severity)), marginTop: "0.1rem" }} aria-hidden="true">
            {flag.severity === "critical" ? <IconAlert size={15} /> : flag.severity === "warn" ? <IconBlocked size={15} /> : <IconInfo size={15} />}
          </span>
          <div className="flag__body">
            <span className="flag__title">
              {flag.memberName ? `${flag.memberName}: ` : ""}
              {flagTitle(flag.kind)}
            </span>
            <span className="flag__detail">{flag.detail}</span>
          </div>
        </div>
      ))}
      {flags.length > limit ? (
        <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setOpen((v) => !v)}>
          {open ? "Show fewer" : `Show ${flags.length - limit} more`}
        </button>
      ) : null}
    </div>
  );
}

/** Flag kinds are machine names; people read sentences. */
export function flagTitle(kind: string): string {
  const titles: Record<string, string> = {
    "free-rider": "not carrying a share",
    "overloaded": "more than can be finished",
    "carrying": "carrying the group",
    "behind": "behind an even share",
    "quiet": "gone quiet",
    "concentration": "one person holds most of it",
    "unassigned": "work nobody has taken",
    "stalled": "nothing has moved",
    "review-backlog": "waiting on review",
    "late-closes": "closing work late",
    "overdue": "past the date",
    "blocked": "blocked",
    "no-deadline": "no deadline set",
    "delivery-lag": "delivering late in the project",
    "space": "space to take more on",
  };
  return titles[kind] ?? kind.replace(/-/g, " ");
}

export function Nudges({ nudges, empty, compact }: { nudges: Nudge[]; empty?: string; compact?: boolean }) {
  if (!nudges.length) {
    return empty ? <p className="panel__body card__meta">{empty}</p> : null;
  }
  /*
   * On a console with a dozen people in it, a stack of filled flag boxes turns
   * into a wall of colour and the names stop being readable. The compact form
   * keeps the same facts as one line each: name, why, and the way in.
   */
  if (compact) {
    return (
      <div className="rows">
        {nudges.map((nudge) => (
          <div key={nudge.id} className="rowitem rowitem--compact">
            <span className="flag__mark" style={{ color: toneVar(severityTone(nudge.severity)) }} aria-hidden="true">
              <IconAlert size={14} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="rowitem__title">{nudge.title}</span>
              <span className="rowitem__sub">{nudge.body}</span>
            </span>
            {nudge.action ? (
              <Link className="rowitem__go" to={nudge.action.href} aria-label={`${nudge.action.label}: ${nudge.title}`}>
                <IconArrowRight size={14} />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="stack stack--tight">
      {nudges.map((nudge) => (
        <div key={nudge.id} className={`flag flag--${nudge.severity === "critical" ? "critical" : nudge.severity === "warn" ? "warn" : "info"}`}>
          <span style={{ color: toneVar(severityTone(nudge.severity)), marginTop: "0.15rem" }} aria-hidden="true">
            <IconAlert size={15} />
          </span>
          <div className="flag__body">
            <span className="flag__title">{nudge.title}</span>
            <span className="flag__detail">{nudge.body}</span>
            {nudge.action ? (
              <Link className="btn btn--outline btn--sm" to={nudge.action.href} style={{ alignSelf: "flex-start", marginTop: "0.3rem" }}>
                {nudge.action.label}
                <IconLink size={12} />
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- activity ---------------------------------------------------- */

const VERB_TONE: Record<string, string> = {
  "task.completed": "var(--color-accent)",
  "task.blocked": "var(--color-risk)",
  "task.created": "var(--color-ink-3)",
  "task.assigned": "var(--color-ink-3)",
  "task.helped": "var(--color-accent)",
  "checkin.posted": "var(--color-ink-3)",
  "review.posted": "var(--color-accent)",
  "equity.snapshot": "var(--color-ink-3)",
  "project.created": "var(--color-ink-3)",
  "assignment.auto": "var(--color-ink-3)",
  "task.rebalanced": "var(--color-over)",
  "task.moved": "var(--color-ink-3)",
};

export function ActivityFeed({ activity, limit = 12, showPerson = true }: { activity: ActivityEntry[]; limit?: number; showPerson?: boolean }) {
  return (
    <ol className="rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {activity.slice(0, limit).map((entry) => (
        <li key={entry.id} className="rowitem" style={{ gridTemplateColumns: showPerson ? "auto minmax(0,1fr) auto" : "minmax(0,1fr) auto" }}>
          {showPerson ? <MemberDot hue={entry.actorHue ?? null} /> : null}
          <span style={{ minWidth: 0 }}>
            <span className="rowitem__title" style={{ color: VERB_TONE[entry.verb] ?? "var(--color-ink)" }}>
              {entry.subject}
            </span>
          </span>
          <span className="rowitem__sub nowrap" title={entry.createdAt}>
            {relativeTime(entry.createdAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- a person ---------------------------------------------------- */

export function PersonRow({
  person,
  hoursOn,
  even,
  right,
  note,
  to,
}: {
  person: { id: string; name: string; hue: number; state?: string };
  hoursOn?: number;
  even?: number;
  right?: ReactNode;
  note?: ReactNode;
  to?: string;
}) {
  const body = (
    <>
      <Avatar name={person.name} hue={person.hue} size="sm" />
      <span style={{ minWidth: 0 }}>
        <span className="rowitem__title" style={{ display: "block" }}>
          {person.name}
        </span>
        {note ? <span className="rowitem__sub" style={{ display: "block" }}>{note}</span> : null}
      </span>
      <span className="row" style={{ gap: "0.4rem" }}>
        {hoursOn !== undefined && even !== undefined ? (
          <span className="tnum card__meta" title={`${hours(hoursOn)} delivered against an even share of ${hours(even)}`}>
            {hours(hoursOn)}
          </span>
        ) : null}
        {person.state ? <StateChip state={person.state} /> : null}
        {right}
      </span>
    </>
  );

  return to ? (
    <Link className="rowitem" to={to} style={hueStyle(person.hue)}>
      {body}
    </Link>
  ) : (
    <div className="rowitem" style={hueStyle(person.hue)}>
      {body}
    </div>
  );
}

/* ---------- task rows and cards ----------------------------------------- */

export function TaskRow({
  task,
  href,
  showAssignee = true,
  right,
  meta,
}: {
  task: Task;
  href?: string;
  showAssignee?: boolean;
  right?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="rowitem" style={{ borderLeft: `3px solid ${task.assigneeHue != null ? `hsl(${task.assigneeHue} 40% 55%)` : "var(--color-line)"}`, ...hueStyle(task.assigneeHue) }}>
      <button
        type="button"
        className="btn btn--icon btn--sm"
        title={task.status === "done" ? "Closed" : "Mark closed"}
        aria-label={task.status === "done" ? `${task.title} is closed` : `Close ${task.title}`}
        disabled={task.status === "done"}
        style={{ color: task.status === "done" ? "var(--color-accent)" : "var(--color-ink-3)" }}
      >
        <span aria-hidden="true">{task.status === "done" ? "✓" : "○"}</span>
      </button>
      <span style={{ minWidth: 0 }}>
        <span className="rowitem__title">{href ? <Link to={href}>{task.title}</Link> : task.title}</span>
        <span className="rowitem__sub">
          {showAssignee && task.assigneeName ? `${task.assigneeName} · ` : ""}
          {hours(task.effort)}
          {meta ? <> · {meta}</> : null}
        </span>
      </span>
      <span className="row" style={{ gap: "0.4rem" }}>
        {right ?? (
          <>
            <DueMark dueAt={task.dueAt} done={task.status === "done"} />
            <StatusTag status={task.status} />
          </>
        )}
      </span>
    </div>
  );
}

export function TaskCard({
  task,
  href,
  dragging,
  handleProps,
  onOpen,
}: {
  task: Task;
  href?: string;
  dragging?: boolean;
  handleProps?: Record<string, unknown>;
  onOpen?: () => void;
}) {
  const stateClass =
    task.status === "done" ? " card--done" : task.status === "blocked" ? " card--blocked" : task.status === "review" ? " card--review" : dragging ? " card--picked" : "";

  return (
    <article className={`card${stateClass}`} style={hueStyle(task.assigneeHue)} {...(handleProps ?? {})}>
      <button
        type="button"
        className="card__title"
        /*
         * The title is the control that opens the task, so it carries the same
         * 24px floor as any other target. The padding is paid back with a
         * negative margin, which is the house trick for growing a hit box
         * without moving the type.
         */
        style={{ background: "none", border: 0, padding: "0.25rem 0", margin: "-0.25rem 0", textAlign: "left", cursor: onOpen ? "pointer" : "grab", font: "inherit", fontWeight: 550, color: "inherit" }}
        onClick={onOpen}
      >
        {task.title}
      </button>
      <div className="card__meta">
        <PhaseTag phase={task.phase} />
        {task.required.slice(0, 3).map((skill) => (
          <Tag key={skill.slug} edge title={`Requires ${skill.name ?? skill.slug}`}>
            {skill.name ?? skill.slug}
          </Tag>
        ))}
        {task.dependsOn.length ? <Tag edge title="Depends on other work">{task.dependsOn.length} before</Tag> : null}
      </div>
      <div className="card__foot">
        {task.assigneeName ? (
          <span className="row" style={{ gap: "0.3rem", minWidth: 0 }}>
            <Avatar name={task.assigneeName} hue={task.assigneeHue ?? 0} size="sm" />
            <span className="rowitem__sub truncate">{task.assigneeName}</span>
          </span>
        ) : (
          <span className="rowitem__sub" style={{ fontStyle: "italic" }}>
            nobody yet
          </span>
        )}
        <span className="card__hours">{hours(task.effort)}</span>
      </div>
      <DueMark dueAt={task.dueAt} done={task.status === "done"} />
      {href ? (
        <Link className="card__meta" to={href} style={{ color: "var(--color-accent-deep)" }}>
          Open
        </Link>
      ) : null}
    </article>
  );
}

/* ---------- moving a task ----------------------------------------------- */

/**
 * The two refusals the server can hand back — a task that needs a second pair of
 * eyes, and a person who is already past capacity — are not errors. They are the
 * product's opinion, so they come back as a dialog that explains the choice
 * rather than a red toast that says "failed".
 */
export function useTaskMoves(refresh: () => void) {
  const { push } = useToast();
  const { run, busy } = useAction();
  const [refusal, setRefusal] = useState<{ title: string; body: ReactNode; confirm: string; payload: unknown; code: string } | null>(null);

  const move = useCallback(
    async (taskId: string, status: TaskStatus, extra: Record<string, unknown> = {}) => {
      try {
        const result = await run(() => post<{ task: Task; ledger?: unknown }>(`/api/tasks/${taskId}/status`, { status, ...extra }));
        if (result) {
          refresh();
          push({ title: status === "done" ? "Closed" : `Moved to ${STATUS_NAMES[status].toLowerCase()}`, tone: "good" });
        }
        return true;
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === "needs-review") {
          setRefusal({
            code: "needs-review",
            title: "This one wants a second pair of eyes",
            body: (cause.message ?? "") + " You can move it to review, or close it and name who checked it.",
            confirm: "Move to review",
            payload: { taskId, status: "review" as TaskStatus },
          });
          return false;
        }
        push({ title: "That did not move", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
        return false;
      }
    },
    [push, refresh, run],
  );

  const assign = useCallback(
    async (taskId: string, userId: string | null, label: string, force = false) => {
      try {
        const result = await run(() => post<{ task: Task; warning?: string }>(`/api/tasks/${taskId}/assign`, { userId, force }));
        if (result) {
          refresh();
          push({ title: userId ? `Handed to ${label}` : "Owner removed", detail: result.warning ?? undefined, tone: result.warning ? "neutral" : "good" });
        }
        return true;
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === "capacity") {
          setRefusal({
            code: "capacity",
            title: "That would put somebody past what they can finish",
            body: cause.message ?? "",
            confirm: "Place it anyway",
            payload: { taskId, userId, label, force: true },
          });
          return false;
        }
        push({ title: "That did not work", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
        return false;
      }
    },
    [push, refresh, run],
  );

  const logTime = useCallback(
    async (taskId: string, time: number, note = "") => {
      const result = await run(() => post(`/api/tasks/${taskId}/log`, { hours: time, note }));
      if (result) {
        refresh();
        push({ title: `${hours(time)} logged`, detail: "It counts towards your share of the group's work.", tone: "good" });
      }
      return !!result;
    },
    [push, refresh, run],
  );

  const confirmRefusal = useCallback(async () => {
    if (!refusal) return;
    const payload = refusal.payload as { taskId: string; status?: TaskStatus; userId?: string | null; label?: string; force?: boolean };
    setRefusal(null);
    if (payload.status) await move(payload.taskId, payload.status);
    else if (payload.userId !== undefined) await assign(payload.taskId, payload.userId, payload.label ?? "", true);
  }, [assign, move, refusal]);

  const dialog = (
    <Confirm
      open={!!refusal}
      onClose={() => setRefusal(null)}
      onConfirm={() => void confirmRefusal()}
      title={refusal?.title ?? ""}
      body={refusal?.body ?? ""}
      confirmLabel={refusal?.confirm ?? "Continue"}
      busy={busy}
    />
  );

  return { move, assign, logTime, busy, dialog, refusal, clearRefusal: () => setRefusal(null) };
}

/** Shared empty state for a panel with nothing in it yet. */
export function Quiet({ children }: { children: ReactNode }) {
  return (
    <p className="card__meta" style={{ padding: "0.75rem 0.1rem", lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

export function PanelOf({ title, hint, children, foot, actions }: { title: ReactNode; hint?: ReactNode; children: ReactNode; foot?: ReactNode; actions?: ReactNode }) {
  return (
    <Panel title={title} hint={hint} actions={actions} foot={foot}>
      {children}
    </Panel>
  );
}

export { stateTone };