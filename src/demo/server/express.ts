/**
 * The slice of Express the API modules actually use.
 *
 * Routers, middleware, `req.params`, `req.query`, `res.status().json()` and the
 * session cookie are all here. There is no HTTP server: the static build calls
 * `dispatch()` directly with the path and body the browser would have sent.
 */
import type { HttpError } from "../../../server/api.js";

export type DemoRequest = {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  cookies: Record<string, string>;
  headers: Record<string, string>;
  secure: boolean;
  user?: unknown;
  _user?: unknown;
};

export type DemoResponse = {
  statusCode: number;
  payload: unknown;
  raw: string | null;
  headers: Record<string, string>;
  sent: boolean;
  cookies: Record<string, string>;
  req: DemoRequest;
  status(code: number): DemoResponse;
  json(value: unknown): DemoResponse;
  set(name: string, value: string): DemoResponse;
  cookie(name: string, value: string, options?: Record<string, unknown>): DemoResponse;
  clearCookie(name: string): DemoResponse;
  end(value?: string): DemoResponse;
};

type Next = (error?: unknown) => void;
type Handler = (req: DemoRequest, res: DemoResponse, next: Next) => void;

const COOKIES_KEY = "equita.demo.cookies.v1";

export const readCookies = () => {
  try {
    const stored = localStorage.getItem(COOKIES_KEY);
    return stored ? (JSON.parse(stored) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const writeCookies = (cookies: Record<string, string>) => {
  try {
    localStorage.setItem(COOKIES_KEY, JSON.stringify(cookies));
  } catch {
    /* nothing to do; the session just will not survive a reload */
  }
};

class Response implements DemoResponse {
  statusCode = 200;
  payload: unknown = null;
  raw: string | null = null;
  headers: Record<string, string> = {};
  sent = false;
  cookies: Record<string, string>;

  constructor(public req: DemoRequest) {
    this.cookies = readCookies();
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(value: unknown) {
    this.payload = value;
    this.headers["content-type"] = "application/json";
    this.sent = true;
    return this;
  }

  set(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  cookie(name: string, value: string) {
    this.cookies[name] = value;
    writeCookies(this.cookies);
    return this;
  }

  clearCookie(name: string) {
    delete this.cookies[name];
    writeCookies(this.cookies);
    return this;
  }

  end(value?: string) {
    if (value !== undefined) this.raw = value;
    this.sent = true;
    return this;
  }
}

type Route = { method: string; path: string; handlers: Handler[] };

export class RouterImpl {
  routes: Route[] = [];
  guards: Handler[] = [];

  use(handler: Handler) {
    this.guards.push(handler);
    return this;
  }

  add(method: string, path: string, handlers: Handler[]) {
    this.routes.push({ method, path, handlers: [...this.guards, ...handlers] });
    return this;
  }

  get(path: string, ...handlers: Handler[]) {
    return this.add("GET", path, handlers);
  }

  post(path: string, ...handlers: Handler[]) {
    return this.add("POST", path, handlers);
  }

  patch(path: string, ...handlers: Handler[]) {
    return this.add("PATCH", path, handlers);
  }

  put(path: string, ...handlers: Handler[]) {
    return this.add("PUT", path, handlers);
  }

  delete(path: string, ...handlers: Handler[]) {
    return this.add("DELETE", path, handlers);
  }
}

export function Router() {
  return new RouterImpl();
}

const normalise = (path: string) => `/${path.split("/").filter(Boolean).join("/")}`;

export function joinPath(prefix: string, path: string) {
  const joined = normalise(`${prefix}/${path}`);
  return joined === "/" ? "/" : joined;
}

/** Match `/projects/:id/equity` against `/projects/prj_123/equity`. */
export function matchPath(pattern: string, path: string) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const expected = patternParts[i];
    const actual = pathParts[i];
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(actual);
      continue;
    }
    if (expected !== actual) return null;
  }
  return params;
}

export type App = {
  mount(prefix: string, router: RouterImpl): void;
  fallback(handler: Handler): void;
  handle(req: DemoRequest): DemoResponse;
  routes: Route[];
};

export function createApp(): App {
  const routes: Route[] = [];
  let fallbackHandler: Handler | null = null;

  const run = (handlers: Handler[], req: DemoRequest, res: DemoResponse) => {
    let index = 0;
    const next: Next = (error?: unknown) => {
      if (error) throw error;
      if (res.sent) return;
      const handler = handlers[index++];
      if (!handler) return;
      handler(req, res, next);
    };
    next();
  };

  return {
    routes,
    mount(prefix, router) {
      for (const route of router.routes) {
        routes.push({ ...route, path: joinPath(prefix, route.path) });
      }
    },
    fallback(handler) {
      fallbackHandler = handler;
    },
    handle(req) {
      const res = new Response(req);
      try {
        for (const route of routes) {
          if (route.method !== req.method) continue;
          const params = matchPath(route.path, req.path);
          if (!params) continue;
          req.params = params;
          run(route.handlers, req, res);
          if (res.sent) return res;
        }
        if (fallbackHandler) run([fallbackHandler], req, res);
      } catch (error) {
        const httpError = error as HttpError & { type?: string };
        if (typeof httpError?.status === "number") {
          res.status(httpError.status).json({ error: httpError.message, details: httpError.details });
        } else {
          console.error("[equita demo]", error);
          res.status(500).json({ error: "Something went wrong in the demo. Reload to start again." });
        }
      }
      if (!res.sent) res.status(404).json({ error: "No such endpoint." });
      return res;
    },
  };
}
