/**
 * Encoding scan: looks for double-encoded UTF-8 anywhere in the database.
 * The signature is a lead byte such as C3 or C2 followed by a continuation
 * byte, which is what text looks like after a UTF-8 file is read as latin1.
 */
import { DatabaseSync } from "node:sqlite";

// The verification suite creates a disposable seeded database. Prefer it when
// the Makefile supplies EQUITA_DB so the scan proves the same artifact the
// offline tests exercised rather than depending on a developer's live DB.
const dbPath = process.env.EQUITA_DB || "data/equita.db";
const db = new DatabaseSync(dbPath, { readOnly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
const suspect = /[\u00c2\u00c3\u00e2][\u0080-\u00bf]/;
let hits = 0;
for (const { name } of tables) {
  const rows = db.prepare(`SELECT * FROM "${name}"`).all();
  for (const row of rows) {
    for (const [column, value] of Object.entries(row)) {
      if (typeof value === "string" && suspect.test(value)) {
        hits++;
        console.log(`${name}.${column}: ${JSON.stringify(value).slice(0, 120)}`);
      }
    }
  }
}
console.log(hits ? `\n${hits} suspect values` : "clean");
