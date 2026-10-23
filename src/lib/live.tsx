/**
 * Live updates, data fetching and toasts.
 *
 * The whole app updates itself. Every change is pushed from the server as a
 * single event, and every screen that is open simply refetches. That is a
 * deliberate trade: refetching the whole project view costs one small request,
 * whereas trying to apply a diff in the browser is where live boards go wrong
 * and start disagreeing with the server.
 *
 * Fetches triggered by an event are silent — the current content stays on
 * screen and is replaced when the new one arrives, so nothing flashes.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api } from "./api";
import { resolveMode } from "../demo/mode";

/* ---------- the event stream -------------------------------------------- */

export interface LiveEvent {
  type: string;
  at: string;
  [key: string]: unknown;
}

interface LiveShape {
  version: number;
  connected: boolean;
  last: LiveEvent | null;
  recent: LiveEvent[];
}

const LiveContext = createContext<LiveShape>({ version: 0, connected: false, last: null, recent: [] });

export function LiveProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [last, setLast] = useState<LiveEvent | null>(null);
  const [recent, setRecent] = useState<LiveEvent[]>([]);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopDemo: (() => void) | null = null;
    let serverMode = false;
    let stopped = false;

    const receive = (event: LiveEvent) => {
      if (event.type === "hello") return;
      setConnected(true);
      setLast(event);
      setRecent((list) => [event, ...list].slice(0, 30));
      setVersion((n) => n + 1);
    };

    const open = () => {
      if (stopped) return;
      source = new EventSource("/events");
      source.onopen = () => setConnected(true);
      source.onmessage = (message) => {
        try {
          receive(JSON.parse(message.data) as LiveEvent);
        } catch {
          /* a malformed frame is not worth breaking the stream over */
        }
      };
      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        // EventSource reconnects on its own, but after a server restart it can
        // sit in a dead state, so the stream is rebuilt explicitly.
        if (!stopped) retry = setTimeout(open, 2500);
      };
    };

    void resolveMode().then(async (mode) => {
      if (stopped) return;
      if (mode === "demo") {
        const { onDemoEvent } = await import("../demo/server");
        if (stopped) return;
        stopDemo = onDemoEvent((event) => receive(event as LiveEvent));
        setConnected(true);
        return;
      }
      serverMode = true;
      open();
    });

    const onFocus = () => {
      if (!serverMode) return;
      if (!source || source.readyState === EventSource.CLOSED) open();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      stopped = true;
      window.removeEventListener("focus", onFocus);
      if (retry) clearTimeout(retry);
      stopDemo?.();
      source?.close();
    };
  }, [enabled]);

  const value = useMemo<LiveShape>(() => ({ version, connected, last, recent }), [version, connected, last, recent]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);

/* ---------- fetching ---------------------------------------------------- */

export interface Resource<T> {
  data: T | null;
  error: string | null;
  /**
   * The HTTP status of the failure, when there was one.
   *
   * Screens that must tell a refusal apart from a breakage need it: a student
   * opening a classmate's record gets a 403 that deserves a plain sentence
   * rather than a retry button, and the message alone cannot be matched on
   * reliably.
   */
  status: number | null;
  /** True only for the first load, so a refetch never blanks the screen. */
  loading: boolean;
  /** True while a background refresh is in flight. */
  refreshing: boolean;
  /** Resolves when the fresh payload has been stored, so callers can wait. */
  refresh: () => Promise<void>;
  setData: (next: T | null) => void;
}

/**
 * @param path  the endpoint, or null when it is not ready yet
 * @param opts  `live` refetches on any server event; `poll` refetches on a timer
 */
export function useApi<T>(path: string | null, opts: { live?: boolean; poll?: number; initial?: T | null } = {}): Resource<T> {
  const { live = true, poll } = opts;
  const { version } = useLive();
  const [data, setData] = useState<T | null>(opts.initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(!!path && opts.initial === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const seenVersion = useRef(version);

  const load = useCallback(
    async (silent: boolean) => {
      if (!path) return;
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const next = await api<T>(path, { signal: controller.signal });
        setData(next);
        setError(null);
        setStatus(null);
      } catch (cause) {
        if ((cause as Error)?.name === "AbortError") return;
        setError(cause instanceof ApiError ? cause.message : "Something went wrong loading this.");
        setStatus(cause instanceof ApiError ? cause.status : null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path],
  );

  useEffect(() => {
    if (!path) {
      setData(null);
      setError(null);
      setStatus(null);
      setLoading(false);
      return;
    }
    void load(opts.initial !== undefined);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, load]);

  // Refetch after a server event, coalesced so a burst becomes one request.
  useEffect(() => {
    if (!live || !path) return;
    if (seenVersion.current === version) return;
    seenVersion.current = version;
    const timer = setTimeout(() => void load(true), 180);
    return () => clearTimeout(timer);
  }, [version, live, path, load]);

  useEffect(() => {
    if (!poll || !path) return;
    const timer = setInterval(() => void load(true), poll);
    return () => clearInterval(timer);
  }, [poll, path, load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, error, status, loading, refreshing, refresh, setData };
}

/** Fire-and-refresh: for the many one-off writes that just need to land. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That did not work. Try again.");
      throw cause;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}

/* ---------- toasts ------------------------------------------------------ */

export interface Toast {
  id: string;
  title: string;
  detail?: string;
  tone?: "neutral" | "good" | "bad";
  action?: { label: string; onClick: () => void };
}

interface ToastShape {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastShape>({ toasts: [], push: () => {}, dismiss: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list.slice(-3), { ...toast, id }]);
      // Errors stay until they are dismissed: a message that vanishes before it
      // is read is the same as no message.
      const life = toast.tone === "bad" ? 9000 : 4500;
      setTimeout(() => dismiss(id), life);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast${toast.tone === "good" ? " toast--good" : toast.tone === "bad" ? " toast--bad" : ""}`}>
            <div className="toast__body">
              <p className="toast__title">{toast.title}</p>
              {toast.detail ? <p className="toast__detail">{toast.detail}</p> : null}
            </div>
            {toast.action ? (
              <button type="button" className="toast__action" onClick={toast.action.onClick}>
                {toast.action.label}
              </button>
            ) : null}
            <button type="button" className="btn btn--icon btn--sm" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" fill="none" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);