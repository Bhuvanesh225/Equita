/**
 * The one place the browser talks to the API.
 *
 * Every failure becomes an ApiError with a message written for a person, so a
 * component can render `error.message` without knowing anything about status
 * codes. The server's own messages are already written that way, so they are
 * passed through untouched.
 */
import { resolveMode } from "../demo/mode";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  payload: Record<string, unknown>;

  constructor(status: number, message: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.code = typeof payload.code === "string" ? payload.code : undefined;
    this.details = payload.details;
  }

  /** True when the failure is something the person can fix by changing input. */
  get isInput() {
    return this.status === 400 || this.status === 409 || this.status === 422;
  }
}

type Options = Omit<RequestInit, "body"> & { json?: unknown; signal?: AbortSignal };

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  const init: RequestInit = {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(json === undefined ? {} : { "Content-Type": "application/json" }),
      ...(headers ?? {}),
    },
    body: json === undefined ? undefined : JSON.stringify(json),
    ...rest,
  };

  let response: Response;
  try {
    const backend = await resolveMode();
    if (backend === "demo") {
      const { demoFetch } = await import("../demo/server");
      response = await demoFetch(path, init);
    } else {
      response = await fetch(path, init);
    }
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError(0, "Could not reach the server. Check that it is running, then try again.");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // A non-JSON body means something upstream failed. Say so plainly rather
      // than showing a parse error.
      throw new ApiError(
        response.status,
        response.ok ? "The server sent something this page could not read." : `The request failed (${response.status}).`,
      );
    }
  }

  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : `The request failed (${response.status}).`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

export const get = <T>(path: string, options?: Options) => api<T>(path, { ...options, method: "GET" });
export const post = <T>(path: string, json?: unknown, options?: Options) => api<T>(path, { ...options, method: "POST", json });
export const patch = <T>(path: string, json?: unknown, options?: Options) => api<T>(path, { ...options, method: "PATCH", json });
export const put = <T>(path: string, json?: unknown, options?: Options) => api<T>(path, { ...options, method: "PUT", json });
export const del = <T>(path: string, options?: Options) => api<T>(path, { ...options, method: "DELETE" });

/** Build a query string, dropping empty values so URLs stay readable. */
export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

