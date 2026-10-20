/**
 * The primitives.
 *
 * Two of these carry the product's identity and appear on almost every screen:
 *
 *   LoadBar  — one person's hours against an even share, with a tick at the even
 *              position. It answers "is this fair?" before any number is read.
 *   ShareBar — the whole group in one bar, split into each person's slice.
 *
 * They are built once and used everywhere, so a discrepancy between two screens
 * is impossible rather than merely unlikely.
 */
import { Children, cloneElement, isValidElement, useId, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { hours, hueStyle, initials, pct, stateTone, STATE_NAMES, toneClass, type Tone } from "../lib/format";

/* ---------- identity ---------------------------------------------------- */

export function Avatar({
  name,
  hue,
  size = "md",
  title,
}: {
  name: string | null | undefined;
  hue: number | null | undefined;
  size?: "sm" | "md" | "lg";
  title?: string;
}) {
  return (
    <span
      className={`avatar${size === "lg" ? " avatar--lg" : size === "sm" ? " avatar--sm" : ""} member-soft member-ink`}
      style={hueStyle(hue)}
      title={title ?? name ?? undefined}
      aria-hidden={title ? undefined : "true"}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarGroup({ people, max = 5 }: { people: Array<{ id: string; name: string; hue: number }>; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="avatar-group">
      {shown.map((person) => (
        <Avatar key={person.id} name={person.name} hue={person.hue} size="sm" title={person.name} />
      ))}
      {rest > 0 ? <span className="avatar avatar--sm member-soft member-ink" style={hueStyle(200)} title={`${rest} more`}>{`+${rest}`}</span> : null}
    </span>
  );
}

export function MemberDot({ hue, tone }: { hue: number | null | undefined; tone?: Tone }) {
  if (tone) return <span className={`dot dot--${tone === "accent" ? "ok" : tone === "quiet" ? "quiet" : tone}`} />;
  return <span className="dot" style={{ background: `hsl(${hue ?? 0} 46% 46%)` }} />;
}

/* ---------- small pieces ------------------------------------------------ */

export function Tag({ children, tone, dot, edge, title }: { children: ReactNode; tone?: Tone; dot?: boolean; edge?: boolean; title?: string }) {
  const cls = tone ? toneClass(tone) : edge ? "tag tag--line" : "tag";
  return (
    <span className={`${cls}${dot ? " tag--dot" : ""}`} title={title}>
      {children}
    </span>
  );
}

export function StateChip({ state, hours: owed }: { state: string | undefined; hours?: number }) {
  const tone = stateTone(state);
  const label = STATE_NAMES[state ?? "on-track"] ?? state ?? "";
  return (
    <Tag tone={tone} dot title={owed !== undefined && Math.abs(owed) > 0.3 ? `${state}: ${hours(Math.abs(owed))} ${owed > 0 ? "below" : "above"} an even share` : label}>
      {label}
    </Tag>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row spinner" role="status">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="spin">
        <circle cx="8" cy="8" r="6" fill="none" stroke="var(--color-line-strong)" strokeWidth="2" />
        <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      </svg>
      {label ? <span className="label">{label}</span> : null}
      <style>{`.spin{animation:spin 0.7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

export function Panel({
  title,
  hint,
  actions,
  children,
  foot,
  className,
  bodyClassName,
  flush,
  recessed,
  stacked,
  as: Tag_ = "section",
}: {
  title?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  recessed?: boolean;
  /**
   * Put the hint on its own line under the title. In a narrow card the inline
   * form squeezes a long title into a column of single words, because the
   * hint and the action are both competing for the same row.
   */
  stacked?: boolean;
  as?: "section" | "div" | "article" | "aside";
}) {
  return (
    <Tag_
      className={`panel${flush ? " panel--flush" : ""}${recessed ? " panel--recessed" : ""}${className ? ` ${className}` : ""}`}
    >
      {title ? (
        <header className={`panel__head${stacked ? " panel__head--stacked" : ""}`}>
          {stacked ? (
            <div className="panel__lead">
              <h3 className="panel__title">{title}</h3>
              {hint ? <span className="panel__hint">{hint}</span> : null}
            </div>
          ) : (
            <h3 className="panel__title">
              {title}
              {hint ? <span className="panel__hint">{hint}</span> : null}
            </h3>
          )}
          {actions ? <div className="row">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName ?? "panel__body"}>{children}</div>
      {foot ? <footer className="panel__foot">{foot}</footer> : null}
    </Tag_>
  );
}

export function Stat({
  value,
  label,
  note,
  tone,
  size = "md",
}: {
  value: ReactNode;
  label: ReactNode;
  note?: ReactNode;
  tone?: Tone;
  size?: "md" | "sm";
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ""}`}>
      <span className={`stat__value${size === "sm" ? " stat__value--sm" : ""}`}>{value}</span>
      <span className="stat__label">{label}</span>
      {note ? <span className="stat__note">{note}</span> : null}
    </div>
  );
}

const FIELD_CONTROL_TAGS = new Set(["input", "select", "textarea"]);

function firstFieldControlId(children: ReactNode): string | undefined {
  let found: string | undefined;
  Children.forEach(children, (child) => {
    if (found || !isValidElement(child)) return;
    const props = child.props as { id?: unknown; children?: ReactNode };
    if (typeof child.type === "string" && FIELD_CONTROL_TAGS.has(child.type) && typeof props.id === "string" && props.id) {
      found = props.id;
      return;
    }
    found = firstFieldControlId(props.children);
  });
  return found;
}

function connectFieldControl(
  children: ReactNode,
  controlId: string,
  describedBy: string | undefined,
  invalid: boolean,
  required: boolean,
): ReactNode {
  let connected = false;

  const visit = (child: ReactNode): ReactNode => {
    if (!isValidElement(child)) return child;
    const props = child.props as Record<string, unknown> & { children?: ReactNode };

    if (!connected && typeof child.type === "string" && FIELD_CONTROL_TAGS.has(child.type)) {
      connected = true;
      const existingDescription = typeof props["aria-describedby"] === "string" ? props["aria-describedby"] : undefined;
      const nextDescription = [existingDescription, describedBy].filter(Boolean).join(" ") || undefined;
      return cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: typeof props.id === "string" && props.id ? props.id : controlId,
        "aria-describedby": nextDescription,
        "aria-invalid": invalid ? true : props["aria-invalid"],
        "aria-required": required ? true : props["aria-required"],
      });
    }

    if (!connected && props.children !== undefined) {
      return cloneElement(child as ReactElement<Record<string, unknown>>, {}, Children.map(props.children, visit));
    }

    return child;
  };

  return Children.map(children, visit);
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  required,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
}) {
  const generatedId = `field-${useId().replace(/:/g, "")}`;
  const controlId = htmlFor ?? firstFieldControlId(children) ?? generatedId;
  const descriptionId = error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined;
  const connectedChildren = connectFieldControl(children, controlId, descriptionId, !!error, !!required);

  return (
    <div className="field">
      <label className="field__label" htmlFor={controlId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {connectedChildren}
      {error ? (
        <p className="field__error" id={descriptionId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={descriptionId}>{hint}</p>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, text, action, compact }: { title: ReactNode; text: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className="empty" style={compact ? { padding: "1rem 0.875rem" } : undefined}>
      <p className="empty__title">{title}</p>
      <p className="empty__text">{text}</p>
      {action ? <div className="row row--wrap">{action}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="seg__item"
          aria-pressed={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- the signature: the load bar -------------------------------- */

export interface LoadBarProps {
  name: string;
  hue?: number | null;
  hours: number;
  even: number;
  capacity?: number | null;
  leftLabel?: ReactNode;
  valueLabel?: ReactNode;
  scaleMax?: number;
  showScale?: boolean;
  caption?: ReactNode;
}

/**
 * A person's hours against an even share.
 *
 * The tick is the even share. It is the one element of the design that is not
 * negotiable: without it, a bar of hours says nothing, because "9 hours" is only
 * fair or unfair relative to what everybody else has.
 */
export function LoadBar({ name, hue, hours: value, even, capacity, leftLabel, valueLabel, scaleMax, showScale, caption }: LoadBarProps) {
  const scale = (scaleMax ?? Math.max(value, even, capacity ?? 0, 1)) * 1.12;
  const width = Math.max(0, Math.min(100, (value / scale) * 100));
  const evenAt = Math.max(0, Math.min(100, (even / scale) * 100));

  const tone: "over" | "risk" | "under" | "normal" =
    capacity != null && capacity > 0 && value > capacity ? "risk" : value > even * 1.25 ? "over" : value < even * 0.72 ? "under" : "normal";

  const gap = value - even;
  const description =
    Math.abs(gap) < 0.3
      ? `${name}: level with an even share, ${hours(value)}`
      : `${name}: ${hours(Math.abs(gap))} ${gap > 0 ? "above" : "below"} an even share of ${hours(even)}, at ${hours(value)}`;

  return (
    <div className={`loadbar${tone === "normal" ? "" : ` loadbar--${tone}`}`} style={hueStyle(hue)}>
      <div className="loadbar__top">
        <span>{leftLabel ?? name}</span>
        <span className="loadbar__value">{valueLabel ?? hours(value)}</span>
      </div>
      <div
        className="loadbar__track"
        role="img"
        aria-label={description}
        title={`${description}${capacity != null ? `. ${hours(capacity)} of time left before the deadline.` : ""}`}
      >
        <div className="loadbar__fill" style={{ width: `${width}%` }} />
        <span className="loadbar__even" style={{ left: `${evenAt}%` }} />
      </div>
      {showScale ? (
        <div className="loadbar__scale">
          <span>0h</span>
          <span>even {hours(even)}</span>
          <span>{hours(scale)}</span>
        </div>
      ) : null}
      {caption ? <span className="loadbar__scale">{caption}</span> : null}
    </div>
  );
}

/** The whole group in one bar. Equal slices are the ideal state. */
export function ShareBar({
  segments,
  unassigned,
  showLegend,
  height,
}: {
  segments: Array<{ id: string; name: string; hue: number; hours: number }>;
  unassigned?: number;
  showLegend?: boolean;
  height?: number;
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.hours), 0) + Math.max(0, unassigned ?? 0);
  if (total <= 0) {
    return (
      <div className="sharebar" style={height ? { height } : undefined}>
        <span className="sharebar__seg sharebar__seg--empty" style={{ width: "100%" }} />
      </div>
    );
  }
  const evenCount = segments.length;
  const isEven = evenCount > 0 && segments.every((s) => Math.abs(s.hours / total - 1 / evenCount) < 0.12) && !unassigned;

  return (
    <div className="stack stack--tight">
      <div className={`sharebar${isEven ? " sharebar--even" : ""}`} style={height ? { height } : undefined}>
        {segments.map((segment) => (
          <span
            key={segment.id}
            className="sharebar__seg"
            style={{ width: `${(Math.max(0, segment.hours) / total) * 100}%`, ...hueStyle(segment.hue) }}
            title={`${segment.name}: ${hours(segment.hours)} (${pct(segment.hours / total)})`}
          >
            <span className="visually-hidden">
              {segment.name}, {hours(segment.hours)}
            </span>
          </span>
        ))}
        {unassigned && unassigned > 0 ? (
          <span className="sharebar__seg sharebar__seg--empty" style={{ width: `${(unassigned / total) * 100}%` }} title={`Nobody: ${hours(unassigned)}`} />
        ) : null}
      </div>
      {showLegend ? (
        <div className="sharebar__legend">
          {segments.map((segment) => (
            <span key={segment.id} className="sharebar__legend-item">
              <span className="sharebar__swatch" style={hueStyle(segment.hue)} />
              {segment.name} <span className="tnum" style={{ color: "var(--color-ink-3)" }}>{hours(segment.hours)}</span>
            </span>
          ))}
          {unassigned && unassigned > 0 ? (
            <span className="sharebar__legend-item">
              <span className="sharebar__swatch" style={{ background: "var(--color-line-strong)" }} />
              Nobody <span className="tnum" style={{ color: "var(--color-ink-3)" }}>{hours(unassigned)}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- meters and dials ------------------------------------------- */

export function Meter({
  label,
  value,
  mark,
  tone,
  showValue = true,
  hint,
}: {
  label: ReactNode;
  value: number;
  mark?: number;
  tone?: Tone;
  showValue?: boolean;
  hint?: string;
}) {
  const auto: Tone = value >= 75 ? "accent" : value >= 55 ? "ink" : value >= 40 ? "over" : "risk";
  const chosen = tone ?? auto;
  return (
    <div className="meter" title={hint}>
      <span className="meter__label">{label}</span>
      <span className="meter__track">
        <span className={`meter__fill${chosen === "accent" ? " meter--accent" : chosen === "over" ? " meter--over" : chosen === "risk" ? " meter--risk" : ""}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        {mark !== undefined ? <span className="meter__mark" style={{ left: `${Math.max(0, Math.min(100, mark))}%` }} title={`Guide: ${Math.round(mark)}`} /> : null}
      </span>
      {showValue ? <span className="meter__value">{Math.round(value)}</span> : <span />}
    </div>
  );
}

/** A score as a ring. Used once, at the top of the equity panel. */
export function ScoreDial({
  score,
  label,
  size = 108,
  tone,
}: {
  score: number;
  label?: string;
  size?: number;
  tone?: Tone;
}) {
  const radius = size / 2 - 9;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const auto: Tone = clamped >= 75 ? "accent" : clamped >= 60 ? "ink" : clamped >= 45 ? "over" : "risk";
  const chosen = tone ?? auto;
  const stroke = chosen === "accent" ? "var(--color-accent)" : chosen === "over" ? "var(--color-over)" : chosen === "risk" ? "var(--color-risk)" : "var(--color-ink)";
  return (
    <svg className="donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? "Score"}: ${Math.round(clamped)} out of 100`}>
      <circle className="donut__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth="8" />
      <circle
        className="donut__seg"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth="8"
        strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text className="donut__value" x="50%" y={label ? "50%" : "56%"} textAnchor="middle" dominantBaseline="middle">
        {Math.round(clamped)}
      </text>
      {label ? (
        <text className="donut__label" x="50%" y="66%" textAnchor="middle">
          {label}
        </text>
      ) : null}
    </svg>
  );
}

/** Work through, with a mark for how far through the time it should be. */
export function ProgressLine({ value, expected, label }: { value: number; expected?: number; label?: string }) {
  return (
    <div className="stack" style={{ gap: "0.3rem" }}>
      <div className="row row--between" style={{ fontSize: "var(--text-xs)", color: "var(--color-ink-3)" }}>
        <span>{label ?? "Work delivered"}</span>
        {/*
         * Two facts, kept apart: how much of the work is closed, and how much
         * of the clock has gone. The old wording ran them together into a
         * sentence nobody could parse.
         */}
        <span className="tnum">
          <span style={{ color: "var(--color-ink-2)", fontWeight: 600 }}>{pct(value)}</span>
          {expected !== undefined ? <span> closed · {pct(expected)} of the time gone</span> : null}
        </span>
      </div>
      <div
        className="progress-line"
        role="img"
        aria-label={`${pct(value)} of the work is delivered${expected !== undefined ? `, against ${pct(expected)} of the time elapsed` : ""}`}
      >
        <span className="progress-line__fill" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
        {expected !== undefined ? <span className="progress-line__expected" style={{ left: `${Math.max(0, Math.min(100, expected * 100))}%` }} title={`${pct(expected)} of the time has gone`} /> : null}
      </div>
    </div>
  );
}

/** A dense set of blocks, one per member and week. Reads as a heat map. */
export function BlockGrid({
  rows,
  columns,
  values,
  tone,
  title,
}: {
  rows: Array<{ id: string; name: string }>;
  columns: string[];
  values: Array<{ row: string; column: string; value: number; label: string }>;
  tone?: Tone;
  title?: string;
}) {
  const lookup = new Map(values.map((v) => [`${v.row}|${v.column}`, v]));
  const max = Math.max(1, ...values.map((v) => v.value));
  const fill = tone === "risk" ? "var(--color-risk)" : "var(--color-accent)";
  return (
    <div className="scroll-x" title={title}>
      <table className="table" style={{ minWidth: `${(columns.length + 1) * 2.6}rem` }}>
        <thead>
          <tr>
            <th />
            {columns.map((column) => (
              <th key={column} style={{ textAlign: "center", fontSize: "0.6875rem" }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ fontSize: "var(--text-xs)", whiteSpace: "nowrap", paddingRight: "0.75rem" }}>{row.name}</td>
              {columns.map((column) => {
                const cell = lookup.get(`${row.id}|${column}`);
                const ratio = cell ? cell.value / max : 0;
                return (
                  <td key={column} style={{ padding: "0.2rem" }} title={cell?.label ?? `${row.name}, ${column}: nothing`}>
                    <span
                      style={{
                        display: "block",
                        height: "1.1rem",
                        background: cell && cell.value > 0 ? fill : "var(--color-paper-3)",
                        opacity: cell && cell.value > 0 ? 0.25 + ratio * 0.75 : 1,
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const styleVars = (vars: Record<string, string | number>): CSSProperties => vars as CSSProperties;
