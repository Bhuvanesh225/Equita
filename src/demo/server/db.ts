/**
 * The browser stand-in for `server/db.js`.
 *
 * The routes and engines are unchanged: they still call `all`, `get`, `run`
 * and `tx` exactly as they do on the server. The only difference is that the
 * SQLite engine is `sql.js` (WASM) and the database lives in this browser.
 *
 * Vite aliases `server/db.js` to this module so a static build can run the real
 * product logic without an HTTP server. The Node build keeps using node:sqlite.
 */
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import schemaText from "../../../server/schema.sql?raw";
import { val } from "../../../server/util.js";

export type Row = Record<string, unknown>;

const STORAGE_KEY = "equita.demo.database.v2";

/** True when this tab has no saved demo database yet. */
export const coldStart = (() => {
  try {
    return typeof window !== "undefined" && !window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
})();

const SQL = await initSqlJs({ locateFile: () => wasmUrl });

const decode = (text: string) => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const encode = (bytes: Uint8Array) => {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
};

const restore = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? decode(saved) : null;
  } catch {
    return null;
  }
};

const schema = schemaText.replace(/PRAGMA\s+journal_mode\s*=\s*WAL\s*;/i, "");

let database: InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]> | null = null;

const open = () => {
  if (database) return database;
  const saved = restore();
  database = saved ? new SQL.Database(saved) : new SQL.Database();
  if (!saved) database.exec(schema);
  return database;
};

export const DB_PATH = "browser://equita.db";

/* ---------- persistence ------------------------------------------------ */

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, encode(open().export()));
  } catch {
    /* A full or unavailable localStorage must not break the session. */
  }
}

function scheduleSave() {
  if (saveTimer || depth > 0) return;
  saveTimer = setTimeout(saveNow, 350);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveNow();
  });
}

/* ---------- the DatabaseSync-shaped handle ----------------------------- */

class Statement {
  constructor(private sql: string) {}

  all(...params: unknown[]): Row[] {
    const stmt = open().prepare(this.sql);
    try {
      if (params.length) stmt.bind(params as never);
      const rows: Row[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as Row);
      return rows;
    } finally {
      stmt.free();
    }
  }

  get(...params: unknown[]): Row | undefined {
    const stmt = open().prepare(this.sql);
    try {
      if (params.length) stmt.bind(params as never);
      if (!stmt.step()) return undefined;
      return stmt.getAsObject() as Row;
    } finally {
      stmt.free();
    }
  }

  run(...params: unknown[]) {
    const db = open();
    db.run(this.sql, params as never);
    const changes = db.getRowsModified();
    const result = db.exec("SELECT last_insert_rowid() AS id");
    const lastInsertRowid = Number(result[0]?.values[0]?.[0] ?? 0);
    scheduleSave();
    return { changes, lastInsertRowid };
  }
}

export const db = {
  exec(sql: string) {
    open().exec(sql);
    // A transaction is a single unit: exporting the database halfway through it
    // would persist rows the transaction may still roll back. `COMMIT` is the
    // first point at which the new state is real.
    if (/^\s*(BEGIN|SAVEPOINT|RELEASE|ROLLBACK)\b/i.test(sql)) return;
    if (!/^\s*(SELECT|PRAGMA)\b/i.test(sql)) scheduleSave();
  },
  prepare(sql: string) {
    return new Statement(sql);
  },
};

/* ---------- the same exports as server/db.js --------------------------- */

const cache = new Map<string, Statement>();
const prepare = (sql: string) => {
  let statement = cache.get(sql);
  if (!statement) {
    statement = new Statement(sql);
    cache.set(sql, statement);
  }
  return statement;
};

/** All rows. */
export const all = (sql: string, ...params: unknown[]) => prepare(sql).all(...params.map(val));

/** First row, or undefined. */
export const get = (sql: string, ...params: unknown[]) => prepare(sql).get(...params.map(val));

/** Write. Returns { changes, lastInsertRowid }. */
export const run = (sql: string, ...params: unknown[]) => prepare(sql).run(...params.map(val));

/** A single scalar from the first column of the first row. */
export const one = (sql: string, ...params: unknown[]) => {
  const row = get(sql, ...params);
  return row ? Object.values(row)[0] : undefined;
};

let depth = 0;

export function tx<T>(fn: () => T): T {
  if (depth > 0) return fn();
  depth++;
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* the transaction is already gone; the original error is the useful one */
    }
    throw error;
  } finally {
    depth--;
    // The first transaction to finish is the moment the database is coherent
    // again. Writing it now means a refresh cannot land between COMMIT and the
    // debounced save and throw the work away.
    if (depth === 0) saveNow();
  }
}

export function insert(table: string, row: Row, idColumn = "id") {
  const keys = Object.keys(row).filter((key) => row[key] !== undefined);
  const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
  run(sql, ...keys.map((key) => row[key]));
  return row[idColumn];
}

export function update(table: string, id: unknown, patch: Row) {
  const keys = Object.keys(patch).filter((key) => patch[key] !== undefined);
  if (!keys.length) return 0;
  const sql = `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`;
  return run(sql, ...keys.map((key) => patch[key]), id).changes;
}

export const bool = (value: unknown) => value === 1 || value === true;

export function healthcheck() {
  const tables = all(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map((row) => row.name);
  return { path: DB_PATH, tables: tables.length, tableNames: tables };
}

/** The asynchronous start-up the synchronous handle above cannot do itself. */
export async function openDemoDatabase() {
  open();
  return db;
}

export default db;





