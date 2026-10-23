/**
 * The live channel for the browser demo.
 *
 * The server talks to open EventSource connections. In the static demo the
 * "connections" are listeners inside this tab, so a write can still refresh
 * every screen without a reload. The payload is identical to the server's.
 */

type Listener = (event: Record<string, unknown>) => void;

const listeners = new Set<Listener>();

export function subscribe(_res: unknown, _options?: unknown) {
  const id = `demo-${Math.random().toString(36).slice(2)}`;
  return id;
}

export function publish(event: { type?: string; payload?: Record<string, unknown>; [key: string]: unknown }) {
  const frame = {
    ...(event.payload ?? {}),
    type: event.type ?? "changed",
    at: new Date().toISOString(),
  };
  for (const listener of listeners) {
    try {
      listener(frame);
    } catch {
      /* one broken listener must not stop the others */
    }
  }
  return listeners.size;
}

export function onDemoEvent(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const connectionCount = () => listeners.size;
