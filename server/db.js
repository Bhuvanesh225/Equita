/**
 * The database handle and the only place SQL is executed.
 *
 * Uses node:sqlite, which ships with Node 22.5+, so there is no native build
 * step and no dependency that can fail on a student's laptop.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { val } from "./util.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
mkdirSync(dataDir, { recursive: true });

export const DB_PATH = process.env.EQUITA_DB || path.join(dataDir, "equita.db");

export const db = new DatabaseSync(DB_PATH);
db.exec(readFileSync(path.join(here, "schema.sql"), "utf8"));

const cache = new Map();
const prepare = (sql) => {
  let stmt = cache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    cache.set(sql, stmt);
  }
  return stmt;
};

/** All rows. */
export const all = (sql, ...params) => prepare(sql).all(...params.map(val));

/** First row, or undefined. */
export const get = (sql, ...params) => prepare(sql).get(...params.map(val));

/** Write. Returns { changes, lastInsertRowid }. */
export const run = (sql, ...params) => prepare(sql).run(...params.map(val));

/** A single scalar from the first column of the first row. */
export const one = (sql, ...params) => {
  const row = get(sql, ...params);
  return row ? Object.values(row)[0] : undefined;
};

/**
 * Run a unit of work atomically. Nested calls join the outer transaction so a
 * route can compose helpers that each want to be atomic.
 */
let depth = 0;
export function tx(fn) {
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
  }
}

/** Insert helper: takes a table name and a plain object, returns the row id. */
export function insert(table, row, idColumn = "id") {
  const keys = Object.keys(row).filter((k) => row[k] !== undefined);
  const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
  run(sql, ...keys.map((k) => row[k]));
  return row[idColumn];
}

export function update(table, id, patch) {
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  if (!keys.length) return 0;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
  return run(sql, ...keys.map((k) => patch[k]), id).changes;
}

export const bool = (v) => v === 1 || v === true;

export function healthcheck() {
  const tables = all(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map((r) => r.name);
  return { path: DB_PATH, tables: tables.length, tableNames: tables };
}