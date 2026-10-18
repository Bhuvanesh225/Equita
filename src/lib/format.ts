/**
 * Turning numbers and dates into the words a person reads.
 *
 * Hours are the unit of this whole product, so they are formatted consistently
 * everywhere: one decimal place only when the fraction matters, and never a
 * trailing ".0".
 */

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** "12.5h" or "12h". The unit is always attached. */
export function hours(n: number | null | undefined, places = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const value = places === 1 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(places)}h`;
}

/** The number alone, for a table cell that already says "hours". */
export function hoursValue(n: number | null | undefined, places = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const value = places === 1 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(places);
}

export const pct = (n: number, places = 0) => `${(n * 100).toFixed(places)}%`;
export const pctOf = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/** "Thu 12 Jun" */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "no date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "no date";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** "12 Jun 2026" */
export function fullDate(iso: string | null | undefined): string {
  if (!iso) return "no date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "no date";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The value an <input type="date"> wants. */
export function dateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return ms / 86_400_000;
}

/** "due in 4 days", "due tomorrow", "3 days late". */
export function dueLabel(iso: string | null | undefined): string {
  const days = daysUntil(iso);
  if (days === null) return "no deadline";
  if (days < -1) return `${Math.abs(Math.round(days))} days late`;
  if (days < 0) return "overdue";
  if (days < 1) return "due today";
  if (days < 2) return "due tomorrow";
  if (days < 7) return `due in ${Math.round(days)} days`;
  if (days < 14) return "due next week";
  return `due in ${Math.round(days / 7)} weeks`;
}

/** "3 days ago", "just now". */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "never";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hoursAgo = Math.round(minutes / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  const days = Math.round(hoursAgo / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "last month" : `${months} months ago`;
}

/** A clock time for a message thread. */
export function clockTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function initials(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The CSS custom property every member-coloured element reads. */
export const hueStyle = (hue: number | null | undefined): React.CSSProperties =>
  ({ "--member-hue": String(((hue ?? 0) + 360) % 360) }) as React.CSSProperties;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function listJoin(items: string[], conjunction = "and"): string {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  if (list.length === 2) return `${list[0]} ${conjunction} ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} ${conjunction} ${list[list.length - 1]}`;
}

/* ---------- the vocabulary of the product ------------------------------- */

export const PHASE_NAMES: Record<string, string> = {
  discover: "Discover",
  define: "Decide",
  build: "Build",
  review: "Check",
  ship: "Hand in",
};

export const STATUS_NAMES: Record<string, string> = {
  todo: "Not started",
  doing: "In progress",
  review: "Needs checking",
  blocked: "Blocked",
  done: "Done",
};

export const STATE_NAMES: Record<string, string> = {
  "on-track": "on track",
  carrying: "carrying more",
  behind: "behind",
  overloaded: "overloaded",
  quiet: "gone quiet",
};

export const MOOD_NAMES: Record<string, string> = {
  ahead: "Ahead of plan",
  steady: "On track",
  behind: "Running behind",
  stuck: "Stuck",
};

/** Which signal colour a state or a score is drawn in. Meaning, not decoration. */
export type Tone = "accent" | "over" | "risk" | "quiet" | "ink";

export function stateTone(state: string | undefined): Tone {
  switch (state) {
    case "overloaded":
      return "risk";
    case "behind":
      return "over";
    case "quiet":
      return "quiet";
    case "carrying":
      return "over";
    default:
      return "accent";
  }
}

export function scoreTone(score: number): Tone {
  if (score >= 75) return "accent";
  if (score >= 60) return "ink";
  if (score >= 45) return "over";
  return "risk";
}

export function severityTone(severity: string | undefined): Tone {
  if (severity === "critical") return "risk";
  if (severity === "warn") return "over";
  return "quiet";
}

export const toneClass = (tone: Tone) =>
  tone === "accent" ? "tag--accent" : tone === "over" ? "tag--over" : tone === "risk" ? "tag--risk" : tone === "quiet" ? "tag--quiet" : "tag--ink";

/**
 * A tone carried by the text and nothing else.
 *
 * Chips shout — that is what they are for — but a column of figures should not:
 * the reader has to be able to run their eye down the numbers, and meaning is
 * better carried by the colour of the figure than by a filled block behind it.
 */
export const toneTextClass = (tone: Tone) =>
  tone === "accent" ? "tx-accent" : tone === "over" ? "tx-over" : tone === "risk" ? "tx-risk" : tone === "quiet" ? "tx-quiet" : "tx-ink";

export const toneVar = (tone: Tone) =>
  tone === "accent" ? "var(--color-accent)" : tone === "over" ? "var(--color-over)" : tone === "risk" ? "var(--color-risk)" : tone === "quiet" ? "var(--color-quiet)" : "var(--color-ink)";

/** The sentence a load bar is described with, for a screen reader. */
export function shareSentence(name: string, hoursOn: number, evenShare: number): string {
  const gap = hoursOn - evenShare;
  if (Math.abs(gap) < 0.3) return `${name} is level with an even share, at ${hours(gap === 0 ? hoursOn : hoursOn)}.`;
  return gap > 0
    ? `${name} is ${hours(gap)} above an even share of ${hours(evenShare)}.`
    : `${name} is ${hours(Math.abs(gap))} below an even share of ${hours(evenShare)}.`;
}

/** Gini described in words, because a coefficient on its own says nothing. */
export function describeGini(gini: number): string {
  if (gini < 0.1) return "almost exactly even";
  if (gini < 0.2) return "evenly shared";
  if (gini < 0.32) return "slightly uneven";
  if (gini < 0.45) return "clearly uneven";
  if (gini < 0.6) return "one or two people are carrying it";
  return "almost entirely on one person";
}