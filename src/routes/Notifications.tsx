/**
 * Notifications.
 *
 * Every notification is a sentence an engine already wrote — "Critique panel:
 * mid-term peer review: 5 tasks past the date" — with a link to the place where
 * the fact became true. This screen is where those links are actually reachable,
 * which is why it is small and why it does not rewrite any of the prose.
 *
 * A row is a link, and activating it marks itself read. Marking read is a
 * fire-and-forget write: the navigation must not wait for it, because a person
 * follows the notification to see the project, not to file the receipt. The
 * `Mark as read` control sits *beside* the link rather than inside it — a button
 * nested in an anchor is a lie to a screen reader about what it is.
 *
 * The unread count is deliberately not held in local state: it comes from the
 * payload and from the session's own `counts`, so the rail badge drops when the
 * server says it has.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { post } from "../lib/api";
import { useApi, useToast } from "../lib/live";
import { useSession } from "../lib/session";
import { relativeTime, type Tone } from "../lib/format";
import { EmptyState, Panel, Spinner, Tag } from "../components/ui";
import { PageHead, Quiet } from "../components/blocks";
import { IconCheck } from "../components/icons";
import type { Notification } from "../lib/types";

/** The three kinds the server writes, and the colour meaning each one carries. */
const KIND_TONE: Record<string, Tone> = { urgent: "risk", warn: "over", info: "quiet" };

const KIND_WORD: Record<string, string> = { urgent: "urgent", warn: "worth a look", info: "for you" };

export default function Notifications() {
  const { refresh: refreshSession } = useSession();
  const { push } = useToast();
  const { data, loading, error, status, refresh } = useApi<{ notifications: Notification[]; unread: number }>("/api/insights/notifications");

  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  const groups = useMemo(() => {
    const fresh: Notification[] = [];
    const earlier: Notification[] = [];
    for (const item of notifications) (item.readAt ? earlier : fresh).push(item);
    return { fresh, earlier };
  }, [notifications]);

  /** Marking read never blocks the navigation and never fails loudly. */
  const markRead = async (body: { ids?: string[]; all?: boolean }) => {
    try {
      await post("/api/insights/notifications/read", body);
      await refresh();
      refreshSession();
    } catch {
      push({ title: "That did not stick", detail: "The notification is still unread. Try again in a moment.", tone: "bad" });
    }
  };

  if (loading && !data) {
    return (
      <div className="page">
        <Spinner label="Reading your notices" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="The notices did not load"
          text={error ?? "The list of notifications could not be read just now."}
          action={
            <>
              <button type="button" className="btn btn--outline" onClick={refresh}>
                Try again
              </button>
              <Link className="btn btn--primary" to="/today">
                Back to Today
              </Link>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead
        kicker="The bell, with a memory"
        title="Notifications"
        sub={
          notifications.length
            ? `${unread ? `${unread} unread` : "Everything read"} · ${notifications.length} in the last few weeks`
            : "Nothing has arrived yet"
        }
        actions={
          <>
            <button type="button" className="btn btn--outline btn--sm" disabled={!unread} onClick={() => void markRead({ all: true })}>
              Mark all read
            </button>
          </>
        }
      />

      {status === 0 ? (
        <Panel>
          <Quiet>The server could not be reached, so this list may be as old as the last time it answered. It will refresh itself when it comes back.</Quiet>
        </Panel>
      ) : null}

      {notifications.length ? (
        <>
          <Panel
            title="New"
            hint={groups.fresh.length ? `${groups.fresh.length} waiting for you` : "nothing unread"}
            flush
          >
            {groups.fresh.length ? (
              <ul className="rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {groups.fresh.map((item) => (
                  <Row key={item.id} item={item} onRead={() => void markRead({ ids: [item.id] })} />
                ))}
              </ul>
            ) : (
              <div className="panel__body">
                <Quiet>Nothing new. Everything below has been read.</Quiet>
              </div>
            )}
          </Panel>

          {groups.earlier.length ? (
            <Panel title="Earlier" hint={`${groups.earlier.length} kept as a record`} flush>
              <ul className="rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {groups.earlier.map((item) => (
                  <Row key={item.id} item={item} onRead={() => {}} />
                ))}
              </ul>
            </Panel>
          ) : null}

          <Quiet>
            Nothing here is invented: each notice was written by the same engines that score a project, at the moment a deadline slipped or a
            share tipped. Following one takes you to the exact place it happened.
          </Quiet>
        </>
      ) : (
        <Panel>
          <EmptyState
            title="Nothing yet"
            text="Notifications arrive when somebody moves your work, mentions you, or a deadline slips. A quiet screen means a quiet group — that is the honest reading."
            action={
              <Link className="btn btn--primary btn--sm" to="/today">
                Go to Today
              </Link>
            }
          />
        </Panel>
      )}
    </div>
  );
}

/* ---------- one notice --------------------------------------------------- */

function Row({ item, onRead }: { item: Notification; onRead: () => void }) {
  const tone = KIND_TONE[item.kind] ?? "quiet";
  const target = item.link && item.link !== "#" ? item.link : "/today";

  return (
    <li className={`rowitem notif${item.readAt ? " notif--read" : ""}`}>
      <Link className="notif__link" to={target} onClick={() => !item.readAt && onRead()} title={item.body || item.title}>
        <span className={`dot dot--${tone === "quiet" ? "quiet" : tone}`} aria-hidden="true" />
        <span style={{ minWidth: 0 }}>
          <span className="rowitem__title notif__prose">{item.title}</span>
          {item.body ? <span className="rowitem__sub notif__prose">{item.body}</span> : null}
        </span>
      </Link>

      <span className="row" style={{ gap: "0.5rem", justifySelf: "end" }}>
        <span className="label nowrap" title={item.createdAt}>
          {relativeTime(item.createdAt)}
        </span>
        {item.readAt ? (
          <Tag edge title={`Read ${relativeTime(item.readAt)}`}>
            read
          </Tag>
        ) : (
          <>
            <Tag tone={tone} dot title="Not read yet">
              {KIND_WORD[item.kind] ?? "new"}
            </Tag>
            <button type="button" className="btn btn--ghost btn--sm notif__read" onClick={onRead} aria-label={`Mark “${item.title}” as read`}>
              <IconCheck size={12} />
              Mark read
            </button>
          </>
        )}
      </span>
    </li>
  );
}