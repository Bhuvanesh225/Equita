/**
 * The live channel.
 *
 * Server-sent events rather than websockets: everything here is a one-way
 * notification that something changed, EventSource reconnects on its own, and
 * there is no handshake to get wrong behind a school proxy.
 *
 * Events are addressed. A publish names the people who should hear it, so a
 * student in one class never receives traffic from another.
 */
import { newId } from "./util.js";

const clients = new Map(); // clientId -> { res, userId, classroomIds:Set }

let heartbeat = null;

function startHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const client of clients.values()) {
      try {
        client.res.write(": ping\n\n");
      } catch {
        /* the close handler removes it */
      }
    }
  }, 25_000);
  heartbeat.unref?.();
}

export function subscribe(res, { userId, classroomIds = [] }) {
  const id = newId("sse");
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 3000\n\n`);
  res.write(`data: ${JSON.stringify({ type: "hello", clientId: id })}\n\n`);
  clients.set(id, { res, userId, classroomIds: new Set(classroomIds) });
  startHeartbeat();

  const close = () => {
    clients.delete(id);
  };
  res.on("close", close);
  res.on("error", close);
  return id;
}

/**
 * @param {object} event
 * @param {string} event.type      e.g. "task.updated"
 * @param {object} event.payload   what changed; keep it small, clients refetch
 * @param {string[]} [event.to]    user ids who should receive it
 * @param {string[]} [event.classrooms] classrooms whose members should receive it
 * @param {boolean} [event.broadcast]
 *
 * Frames are unnamed on purpose: an EventSource only fires `onmessage` for
 * unnamed frames, and a catch-all listener does not exist. The type travels in
 * the data instead, so adding a new event on the server never needs a matching
 * change in the client.
 */
export function publish(event) {
  const frame = `data: ${JSON.stringify({
    ...event.payload,
    type: event.type,
    at: new Date().toISOString(),
  })}\n\n`;
  const to = event.to ? new Set(event.to) : null;
  const rooms = event.classrooms ? new Set(event.classrooms) : null;
  for (const [id, client] of clients) {
    const addressed = to?.has(client.userId) ?? false;
    const inRoom = rooms ? [...rooms].some((c) => client.classroomIds.has(c)) : false;
    if (event.broadcast || addressed || inRoom) {
      try {
        client.res.write(frame);
      } catch {
        clients.delete(id);
      }
    }
  }
  return clients.size;
}

export const connectionCount = () => clients.size;