/**
 * One task, in full.
 *
 * Opened from the board, the table or a deep link. Everything a person can do to
 * a task lives here — move it, hand it on, log help against it, talk about it —
 * because the alternative is a dozen tiny controls scattered over a board.
 */
import { useState } from "react";

import { del, post } from "../../lib/api";
import { ApiError } from "../../lib/api";
import { useApi, useToast } from "../../lib/live";
import { STATUS_NAMES, clockTime, hours, listJoin, relativeTime } from "../../lib/format";
import { Avatar, EmptyState, Panel, Spinner, Tag } from "../../components/ui";
import { DueMark, PhaseTag, Quiet, StatusTag, useTaskMoves } from "../../components/blocks";
import { Drawer, Menu } from "../../components/overlays";
import { IconClock, IconMessage, IconPlus, IconTrash } from "../../components/icons";
import { TaskFormDialog } from "./TaskForm";
import type { Candidate, Comment, ProjectMember, Skill, Task, TaskStatus } from "../../lib/types";

type Moves = ReturnType<typeof useTaskMoves>;

interface Contribution {
  id: string;
  userId: string;
  userName: string | null;
  kind: string;
  effort: number;
  note: string;
  createdAt: string;
}

interface TaskDetail {
  task: Task & { history: Array<{ id: string; userId: string; userName: string; kind: string; rationale: string; createdAt: string }> };
  comments: Array<Comment & { authorHue?: number | null }>;
  contributions: Contribution[];
  requiredNames: Array<{ slug: string; weight: number; name: string }>;
  blockedBy: Array<{ id: string; title: string; status: TaskStatus }>;
  candidates: Candidate[];
}

export function TaskSheet({
  taskId,
  projectId,
  members,
  skills,
  moves,
  onClose,
  onChanged,
}: {
  taskId: string;
  projectId: string;
  members: ProjectMember[];
  skills: Skill[];
  moves: Moves;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { push } = useToast();
  const { data, loading, error, refresh } = useApi<TaskDetail>(`/api/tasks/${taskId}`);
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [logHours, setLogHours] = useState("1");
  const [logNote, setLogNote] = useState("");
  const [blockNote, setBlockNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading && !data) {
    return (
      <Drawer open onClose={onClose} title="Task">
        <Spinner label="Reading the task" />
      </Drawer>
    );
  }

  if (error || !data) {
    return (
      <Drawer open onClose={onClose} title="Task">
        <EmptyState
          title="That task did not load"
          text={error ?? "It may have been deleted."}
          action={
            <button type="button" className="btn btn--outline btn--sm" onClick={refresh}>
              Try again
            </button>
          }
        />
      </Drawer>
    );
  }

  const task = data.task;
  const assignee = members.find((member) => member.id === task.assigneeId);

  const move = async (status: TaskStatus) => {
    if (status === "blocked" && !blockNote.trim()) {
      push({ title: "Say what it is blocked on", detail: "A blocked task with no reason is just a stopped task.", tone: "bad" });
      return;
    }
    const ok = await moves.move(task.id, status, status === "blocked" ? { note: blockNote } : {});
    if (ok) {
      setBlockNote("");
      refresh();
      onChanged();
    }
  };

  const assign = async (userId: string | null, label: string) => {
    const ok = await moves.assign(task.id, userId, label);
    if (ok) {
      refresh();
      onChanged();
    }
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await post(`/api/tasks/${task.id}/comments`, { body: comment.trim() });
      setComment("");
      refresh();
      onChanged();
    } catch (cause) {
      push({ title: "That comment did not send", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  const submitLog = async () => {
    const amount = Number(logHours);
    if (!amount || amount <= 0) return;
    const ok = await moves.logTime(task.id, amount, logNote);
    if (ok) {
      setLogNote("");
      refresh();
      onChanged();
    }
  };

  const remove = async () => {
    try {
      await del(`/api/tasks/${task.id}`);
      push({ title: "Task deleted", tone: "neutral" });
      onChanged();
      onClose();
    } catch (cause) {
      push({ title: "Could not delete it", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
    }
  };

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={task.title}
        sub={
          <span className="row row--wrap" style={{ gap: "0.4rem" }}>
            <PhaseTag phase={task.phase} />
            <StatusTag status={task.status} />
            <Tag edge>{hours(task.effort)}</Tag>
            {task.needsReview ? <Tag tone="over">needs checking</Tag> : null}
          </span>
        }
        footer={
          <div className="row row--between" style={{ width: "100%", gap: "0.5rem" }}>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setEditing(true)}>
              Edit this task
            </button>
            <button type="button" className="btn btn--danger btn--sm" onClick={() => void remove()}>
              <IconTrash size={12} />
              Delete
            </button>
          </div>
        }
      >
        <div className="stack stack--loose">
          {task.detail ? <p style={{ fontSize: "var(--text-base)", lineHeight: 1.55 }}>{task.detail}</p> : <Quiet>Nobody wrote down what finishing this looks like.</Quiet>}

          <div className="row row--wrap" style={{ gap: "1rem" }}>
            <span className="label row" style={{ gap: "0.35rem" }}>
              <IconClock size={12} />
              <DueMark dueAt={task.dueAt} done={task.status === "done"} />
            </span>
            <span className="label">priority {task.priority === 3 ? "before the date" : task.priority === 1 ? "whenever" : "normal"}</span>
            {task.required.slice(0, 4).map((skill) => (
              <Tag key={skill.slug} edge>
                {skill.name ?? skill.slug}
              </Tag>
            ))}
          </div>

          {data.blockedBy.length ? (
            <div className="callout callout--over">
              This waits on {listJoin(data.blockedBy.map((other) => `“${other.title}”`))}, which {data.blockedBy.length === 1 ? "is" : "are"} still open.
            </div>
          ) : null}

          <Panel title="Who has it" hint={assignee ? `owned by ${assignee.name}` : "nobody yet"} flush>
            <div className="panel__body stack stack--tight">
              <div className="row row--between" style={{ gap: "0.5rem" }}>
                <span className="row" style={{ gap: "0.4rem" }}>
                  {assignee ? <Avatar name={assignee.name} hue={assignee.hue} size="sm" /> : <span className="label">Unassigned</span>}
                  {assignee ? <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{assignee.name}</span> : null}
                </span>
                <Menu
                  label="Hand it over"
                  items={[
                    ...members.map((member) => ({
                      label: member.name,
                      hint: member.id === assignee?.id ? "current" : "change to them",
                      onSelect: () => void assign(member.id, member.name),
                      disabled: member.id === assignee?.id,
                    })),
                    { label: "Nobody", hint: "release it", onSelect: () => void assign(null, "nobody") },
                  ]}
                />
              </div>
              <div className="row row--wrap" style={{ gap: "0.35rem" }}>
                {(["todo", "doing", "review", "blocked", "done"] as TaskStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`btn ${task.status === status ? "btn--primary" : "btn--outline"} btn--sm`}
                    onClick={() => void move(status)}
                    disabled={task.status === status}
                  >
                    {STATUS_NAMES[status]}
                  </button>
                ))}
              </div>
              {task.status !== "blocked" ? (
                <label className="field">
                  <span className="field__label">If it is blocked, on what?</span>
                  <input className="input" value={blockNote} onChange={(event) => setBlockNote(event.target.value)} placeholder="waiting on the shared folder" />
                </label>
              ) : null}
              <p className="field__hint">
                A task marked “someone else should check it” refuses to close under the owner's own hand. Move it to checking, and let another
                person close it.
              </p>
            </div>
          </Panel>

          {data.candidates.length ? (
            <Panel title="Who fits this best" hint="ranked on skills, room left, and fairness" flush>
              <div className="stack">
                {data.candidates.slice(0, 5).map((candidate) => (
                  <div key={candidate.memberId} className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                    <Avatar name={candidate.name} hue={candidate.hue} size="sm" />
                    <span style={{ minWidth: 0 }}>
                      <span className="rowitem__title">{candidate.name}</span>
                      <span className="rowitem__sub">{candidate.rationale}</span>
                      {candidate.fit.missing.length ? (
                        <span className="rowitem__sub" style={{ display: "block", color: "var(--color-over)" }}>
                          missing {listJoin(candidate.fit.missing.map((skill) => skill.name))}
                        </span>
                      ) : null}
                    </span>
                    <span className="row" style={{ gap: "0.4rem" }}>
                      <span className="tnum card__meta" title="Overall fit out of 100">
                        {Math.round(candidate.score)}
                      </span>
                      {candidate.memberId === task.assigneeId ? (
                        <Tag tone="accent" dot>
                          on it
                        </Tag>
                      ) : (
                        <button type="button" className="btn btn--outline btn--sm" onClick={() => void assign(candidate.memberId, candidate.name)}>
                          Give it
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel title="Work logged against it" hint={data.contributions.length ? `${data.contributions.length} entries` : "nothing logged"}>
            <div className="stack stack--tight">
              {data.contributions.map((entry) => (
                <div key={entry.id} className="row row--between" style={{ gap: "0.5rem" }}>
                  <span className="row" style={{ gap: "0.4rem", minWidth: 0 }}>
                    <span className="label tnum">{hours(entry.effort)}</span>
                    <span className="truncate" style={{ fontSize: "var(--text-sm)" }}>
                      {entry.note || entry.kind}
                    </span>
                  </span>
                  <span className="card__meta nowrap">
                    {entry.userName ?? "someone"} · {relativeTime(entry.createdAt)}
                  </span>
                </div>
              ))}
              {!data.contributions.length ? <Quiet>Nothing logged yet. Hours are counted from what is closed, plus anything logged here.</Quiet> : null}

              <div className="row row--wrap" style={{ gap: "0.5rem", alignItems: "flex-end" }}>
                <label className="field" style={{ maxWidth: "6rem" }}>
                  <span className="field__label">Hours</span>
                  <input className="input" type="number" min={0.25} max={40} step={0.25} value={logHours} onChange={(event) => setLogHours(event.target.value)} />
                </label>
                <label className="field" style={{ flex: "1 1 12rem" }}>
                  <span className="field__label">What did you do?</span>
                  <input className="input" value={logNote} onChange={(event) => setLogNote(event.target.value)} placeholder="helped redraft the middle" />
                </label>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => void submitLog()}>
                  <IconPlus size={12} />
                  Log it
                </button>
              </div>
              <p className="field__hint">Logging here records help you gave on somebody else's task. It counts towards your share.</p>
            </div>
          </Panel>

          <Panel title="Conversation" hint={`${data.comments.length} ${data.comments.length === 1 ? "message" : "messages"}`}>
            <div className="stack stack--tight">
              {data.comments.map((entry) => (
                <div key={entry.id} className="stack" style={{ gap: "0.2rem" }}>
                  <span className="row" style={{ gap: "0.4rem" }}>
                    <Avatar name={entry.authorName} hue={entry.authorHue ?? 0} size="sm" />
                    <span style={{ fontWeight: 600, fontSize: "var(--text-xs)" }}>{entry.authorName ?? "someone"}</span>
                    <span className="card__meta">{clockTime(entry.createdAt)}</span>
                  </span>
                  <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.5, marginLeft: "1.9rem" }}>{entry.body}</p>
                </div>
              ))}
              {!data.comments.length ? <Quiet>No messages yet. Anything you write here notifies the people you @name.</Quiet> : null}
              <div className="row" style={{ gap: "0.5rem", alignItems: "flex-end" }}>
                <textarea
                  className="textarea"
                  rows={2}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Use @name to pull somebody in"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn--primary btn--sm" onClick={() => void submitComment()} disabled={busy || !comment.trim()}>
                  <IconMessage size={12} />
                  Send
                </button>
              </div>
            </div>
          </Panel>

          {task.history.length ? (
            <Panel title="Where it has been" hint={`${task.history.length} assignments`}>
              <div className="stack stack--tight">
                {task.history
                  .slice(-6)
                  .reverse()
                  .map((entry) => (
                    <div key={entry.id} className="row row--between" style={{ gap: "0.5rem" }}>
                      <span className="label">
                        {entry.userName} · {entry.kind}
                      </span>
                      <span className="card__meta truncate">{entry.rationale}</span>
                      <span className="card__meta nowrap">{relativeTime(entry.createdAt)}</span>
                    </div>
                  ))}
              </div>
            </Panel>
          ) : null}
        </div>
      </Drawer>

      {editing ? (
        <TaskFormDialog
          open
          onClose={() => setEditing(false)}
          projectId={projectId}
          members={members}
          skills={skills}
          task={task}
          onDone={() => {
            refresh();
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}