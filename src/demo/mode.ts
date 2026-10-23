/**
 * Which backend is answering?
 *
 * A live server wins. When the app is hosted as static files (Wasmer Edge,
 * GitHub Pages, a plain bucket) `/api/health` is not JSON, so the browser demo
 * takes over. The probe runs once per page load.
 */

export type BackendMode = "server" | "demo";

let mode: BackendMode | null = null;
let pending: Promise<BackendMode> | null = null;

const probe = async (): Promise<BackendMode> => {
  try {
    const response = await fetch("/api/health", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && type.includes("application/json")) {
      const body = (await response.clone().json()) as { ok?: boolean; service?: string };
      if (body?.ok && body.service === "equita") return "server";
    }
  } catch {
    /* static hosts answer HTML 404s or nothing at all */
  }
  return "demo";
};

export function resolveMode(): Promise<BackendMode> {
  if (mode) return Promise.resolve(mode);
  pending ??= (async () => {
    const resolved = await probe();
    mode = resolved;
    if (resolved === "demo") {
      const { demoFetch } = await import("./server/index");
      try {
        await demoFetch("/api/health");
      } catch {
        // A cold static host can drop the first WASM request. The seed is
        // transactional, so a second attempt is safe and spares the person a
        // blank page that only a refresh would clear.
        await new Promise((resolve) => setTimeout(resolve, 400));
        await demoFetch("/api/health");
      }
    }
    return resolved;
  })().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}

export const isDemoMode = () => mode === "demo";
