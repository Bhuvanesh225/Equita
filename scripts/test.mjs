/**
 * Offline integration test.
 *
 * It starts the real Express app against a disposable local SQLite database,
 * seeds the real demo stories, and runs the existing non-mutating endpoint
 * smoke test as both a teacher and a student. No browser, service, or network
 * connection is needed.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { rmSync } from "node:fs";

const exec = promisify(execFile);
const database = path.join(process.cwd(), "data", "equita-test.db");
process.env.EQUITA_NO_LISTEN = "1";
process.env.EQUITA_DB = database;
rmSync(database, { force: true });
rmSync(`${database}-wal`, { force: true });
rmSync(`${database}-shm`, { force: true });

const [{ app }, { seedIfEmpty }] = await Promise.all([import("../server/index.js"), import("../server/seed.js")]);
seedIfEmpty();

const server = await new Promise((resolve) => {
  const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
});
const { port } = server.address();

try {
  for (const account of ["teacher", "student"]) {
    const result = await exec(process.execPath, ["scripts/smoke.mjs", account], {
      env: { ...process.env, EQUITA_API: `http://127.0.0.1:${port}` },
      maxBuffer: 2 * 1024 * 1024,
    });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  }
  console.log("offline integration test passed");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
