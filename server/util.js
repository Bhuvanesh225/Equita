/**
 * Small shared helpers. Nothing here knows about the domain; it exists so the
 * routes and the engines can stay readable.
 */

let seq = 0;

/** Sortable, prefixed id. Encodes the creation instant so ORDER BY id works. */
export function newId(prefix, at = Date.now()) {
  const stamp = (Math.floor(at) * 1000 + (seq++ % 1000)).toString(36).padStart(9, "0");
  const tail = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${stamp}${tail}`;
}

export const nowIso = () => new Date().toISOString();

export const iso = (d) => new Date(d).toISOString();

/** SQLite only accepts null, number, string, bigint and bytes. Coerce the rest. */
export function val(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

/** Read a JSON column defensively: bad data must never take a request down. */
export function json(text, fallback) {
  if (text === null || text === undefined) return fallback;
  if (typeof text === "object") return text;
  try {
    const parsed = JSON.parse(text);
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);
export const round = (n, places = 1) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
export const sum = (list, pick = (x) => x) => list.reduce((a, x) => a + (pick(x) || 0), 0);
export const mean = (list, pick = (x) => x) => (list.length ? sum(list, pick) / list.length : 0);

/** Unique, order preserving. */
export const uniq = (list) => [...new Set(list)];

export const DAY = 86_400_000;
export const HOUR = 3_600_000;

export function hoursUntil(whenIso, from = Date.now()) {
  if (!whenIso) return null;
  return (new Date(whenIso).getTime() - from) / HOUR;
}

/** Days between two instants, as a fraction, so "1.5 days late" is expressible. */
export function daysBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / DAY;
}

/** ISO week key, e.g. 2026-W07. Used for check-ins and equity history. */
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Gini coefficient of a list of non-negative amounts. 0 = perfectly even. */
export function gini(values) {
  const xs = values.filter((v) => Number.isFinite(v)).map((v) => Math.max(0, v));
  const n = xs.length;
  if (n === 0) return 0;
  const total = xs.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  let acc = 0;
  for (let i = 0; i < n; i++) acc += (i + 1) * sorted[i];
  return clamp((2 * acc) / (n * total) - (n + 1) / n, 0, 1);
}

/** Deterministic string hash → stable pseudo-random in [0,1). For seeds, hues. */
export function hash01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Initials for an avatar, never more than two letters. */
export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A short, readable, human sortable code: XK4-9P2. */
export function joinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${pick(3)}-${pick(3)}`;
}

/** Human sentence list: "a, b and c". */
export function sentenceList(items) {
  const xs = items.filter(Boolean);
  if (xs.length <= 1) return xs[0] || "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Round to the nearest quarter hour, so effort reads like a real estimate. */
export const quarter = (n) => Math.round(n * 4) / 4;