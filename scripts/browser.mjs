import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

function candidatePaths() {
  const home = os.homedir();
  const platformCache = process.platform === "win32"
    ? path.join(home, "AppData", "Local", "ms-playwright")
    : process.platform === "darwin"
      ? path.join(home, "Library", "Caches", "ms-playwright")
      : path.join(home, ".cache", "ms-playwright");

  return [
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    (() => {
      try {
        return chromium.executablePath();
      } catch {
        return undefined;
      }
    })(),
    process.platform === "linux" ? "/usr/bin/chromium" : undefined,
    process.platform === "linux" ? "/usr/bin/chromium-browser" : undefined,
    process.platform === "linux" ? "/usr/bin/google-chrome" : undefined,
    process.platform === "win32" ? path.join(process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "ms-playwright") : undefined,
    platformCache,
  ].filter((candidate) => candidate && existsSync(candidate));
}

export async function launchBrowser() {
  const executablePath = candidatePaths().find((candidate) => !candidate.endsWith("ms-playwright"));
  try {
    return await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new Error(
      `Could not launch Chromium (${detail}). Install the project browser with ` +
        "npx playwright install chromium", { cause: error },
    );
  }
}
