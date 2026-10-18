/**
 * Charts, drawn by hand in SVG.
 *
 * No charting library: the four shapes this product needs are a line, a bar, a
 * ring and a block grid, and hand-drawing them means they inherit the design
 * tokens, stay crisp at any width, and cost nothing in bundle size. Each one
 * carries a text description rather than relying on colour alone.
 */
import { useState, type ReactNode } from "react";
import { pct } from "../lib/format";

export interface Point {
  label: string;
  value: number;
}

export interface Series {
  id: string;
  name: string;
  color: string;
  points: Point[];
}

/** A line chart with a value axis, optional guide rules and a hover readout. */
export function LineChart({
  series,
  height = 148,
  min,
  max,
  rules = [],
  yFormat = (v: number) => String(Math.round(v)),
  area,
  ariaLabel,
}: {
  series: Series[];
  height?: number;
  min?: number;
  max?: number;
  rules?: Array<{ value: number; label: string }>;
  yFormat?: (value: number) => string;
  area?: boolean;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 100; // viewBox units; the SVG scales to its container
  const padLeft = 0;

  const all = series.flatMap((s) => s.points.map((p) => p.value));
  if (!all.length) {
    return (
      <div className="empty" style={{ padding: "1.25rem" }}>
        <p className="empty__text">Not enough history yet. This fills in as the project runs.</p>
      </div>
    );
  }

  const lo = min ?? Math.min(0, ...all);
  const hi = max ?? Math.max(...all, 1);
  const span = hi - lo || 1;
  const count = Math.max(...series.map((s) => s.points.length));
  const x = (index: number) => padLeft + (index / Math.max(1, count - 1)) * (width - padLeft);
  const y = (value: number) => height - ((value - lo) / span) * (height - 14) - 7;

  const path = (points: Point[]) => points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");

  const labels = series[0]?.points ?? [];

  return (
    <div className="stack stack--tight">
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((fraction) => (
          <line key={fraction} className="chart__grid" x1={0} x2={width} y1={y(lo + span * fraction)} y2={y(lo + span * fraction)} vectorEffect="non-scaling-stroke" />
        ))}

        {rules.map((rule) => (
          <g key={rule.label}>
            <line className="chart__rule" x1={0} x2={width} y1={y(rule.value)} y2={y(rule.value)} vectorEffect="non-scaling-stroke" />
          </g>
        ))}

        {area && series.length === 1 ? (
          <path
            className="chart__area"
            d={`${path(series[0].points)} L${x(series[0].points.length - 1)},${height} L${x(0)},${height} Z`}
            opacity={0.6}
          />
        ) : null}

        {series.map((s) => (
          <path key={s.id} className="chart__line" d={path(s.points)} stroke={s.color} vectorEffect="non-scaling-stroke" />
        ))}

        {series.map((s) =>
          s.points.map((point, index) => (
            <circle
              key={`${s.id}-${index}`}
              cx={x(index)}
              cy={y(point.value)}
              r={hover === index ? 3 : 1.8}
              fill={s.color}
              stroke="var(--color-paper)"
              strokeWidth="1"
              onMouseEnter={() => setHover(index)}
            />
          )),
        )}

        {hover !== null ? (
          <line className="chart__rule" x1={x(hover)} x2={x(hover)} y1={0} y2={height} vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>

      <div className="row row--between" style={{ fontSize: "0.625rem", color: "var(--color-ink-3)" }}>
        <span>{labels[0]?.label ?? ""}</span>
        <span>
          {hover !== null
            ? series.map((s) => `${s.name} ${yFormat(s.points[hover]?.value ?? 0)}`).join(" · ")
            : `${yFormat(hi)} at the top, ${yFormat(lo)} at the bottom`}
        </span>
        <span>{labels[labels.length - 1]?.label ?? ""}</span>
      </div>

      {series.length > 1 || rules.length ? (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.id}>
              <span className="chart-legend__swatch" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
          {rules.map((rule) => (
            <span key={rule.label} style={{ color: "var(--color-ink-3)" }}>
              {rule.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Vertical bars, for the week ahead or any small set of totals. */
export function BarChart({
  items,
  height = 88,
  max,
  format = (v: number) => String(Math.round(v)),
  tone = "var(--color-ink)",
  ariaLabel,
  highlight,
}: {
  items: Array<{ label: string; value: number; title?: string; tone?: string }>;
  height?: number;
  max?: number;
  format?: (value: number) => string;
  tone?: string;
  ariaLabel: string;
  highlight?: string;
}) {
  const peak = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bars" style={{ height }} role="img" aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.label} className={`bars__col${highlight === item.label ? " bars__col--today" : ""}`} title={item.title ?? `${item.label}: ${format(item.value)}`}>
          <span className="bars__value" style={{ opacity: item.value > 0 ? 1 : 0.35 }}>
            {format(item.value)}
          </span>
          <span className="bars__bar" style={{ height: "100%" }}>
            <span
              className="bars__fill"
              style={{
                height: `${Math.max(2, (item.value / peak) * 100)}%`,
                background: item.value > 0 ? (item.tone ?? tone) : "transparent",
              }}
            />
          </span>
          <span className="bars__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A tiny inline line, for a card that needs a shape without a chart. */
export function Sparkline({ values, tone = "var(--color-accent)", width = 96, height = 26 }: { values: number[]; tone?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index / (values.length - 1)) * width},${height - ((value - lo) / span) * (height - 4) - 2}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ flex: "none" }}>
      <path d={path} fill="none" stroke={tone} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={width} cy={height - ((values[values.length - 1] - lo) / span) * (height - 4) - 2} r="2" fill={tone} />
    </svg>
  );
}

/** Horizontal comparison bars, labelled. Used for per-project score lists. */
export function ComparisonBars({
  items,
  max = 100,
  format = (v: number) => String(Math.round(v)),
  ariaLabel,
}: {
  items: Array<{ id: string; label: ReactNode; value: number; tone?: string; note?: ReactNode; href?: string }>;
  max?: number;
  format?: (value: number) => string;
  ariaLabel: string;
}) {
  return (
    <div className="stack stack--tight" role="img" aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "0.5rem", alignItems: "center" }}>
          <div className="stack" style={{ gap: "0.25rem", minWidth: 0 }}>
            <div className="row row--between" style={{ gap: "0.5rem" }}>
              <span className="truncate" style={{ fontSize: "var(--text-sm)" }}>
                {item.label}
              </span>
              {item.note ? <span className="label nowrap">{item.note}</span> : null}
            </div>
            <span className="meter__track" style={{ height: 6 }}>
              <span className="meter__fill" style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: item.tone ?? "var(--color-ink)" }} />
            </span>
          </div>
          <span className="tnum" style={{ fontWeight: 600, fontSize: "var(--text-sm)", minWidth: "2.2rem", textAlign: "right" }}>
            {format(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A single number that needs to say whether it is good. */
export function RatioPill({ part, whole, label }: { part: number; whole: number; label: string }) {
  const ratio = whole > 0 ? part / whole : 0;
  return (
    <span className="row" style={{ gap: "0.4rem" }}>
      <span className="meter__track" style={{ width: "2.5rem", height: 6 }}>
        <span className="meter__fill" style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="label nowrap">
        {label} {pct(ratio)}
      </span>
    </span>
  );
}