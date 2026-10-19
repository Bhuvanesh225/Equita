/**
 * The board and the table.
 *
 * Two readings of the same set of tasks. The board is grouped by person, because
 * the question this product exists to answer is "who is carrying what" — so the
 * lanes are people, not statuses, and a card can be dragged from one person to
 * another. The table is the same data when you need to scan it.
 */
import { useMemo, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

import { hours, hueStyle, listJoin, plural } from "../../lib/format";
import { Avatar, LoadBar, Segmented, Tag } from "../../components/ui";
import { DueMark, PhaseTag, Quiet, StatusTag, TaskCard, useTaskMoves } from "../../components/blocks";
import type { ProjectWorkspace, Task } from "../../lib/types";

type Moves = ReturnType<typeof useTaskMoves>;

const OPEN_ORDER: Record<Task["status"], number> = { blocked: 0, doing: 1, review: 2, todo: 3, done: 4 };

/* ---------- the board ---------------------------------------------------- */

export function TaskBoard({
  workspace,
  moves,
  onOpenTask,
  onlyUnassigned,
}: {
  workspace: ProjectWorkspace;
  moves: Moves;
  onOpenTask: (id: string) => void;
  onlyUnassigned: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const lanes = useMemo(() => {
    const byMember = workspace.members.map((member) => {
      const tasks = workspace.tasks
        .filter((task) => task.assigneeId === member.id)
        .sort((a, b) => OPEN_ORDER[a.status] - OPEN_ORDER[b.status] || a.position - b.position);
      const load = workspace.equity.members.find((entry) => entry.id === member.id);
      return { id: member.id, member, tasks, load };
    });
    const nobody = workspace.tasks
      .filter((task) => !task.assigneeId)
      .sort((a, b) => OPEN_ORDER[a.status] - OPEN_ORDER[b.status] || a.position - b.position);
    return { byMember, nobody };
  }, [workspace]);

  const onDragEnd = (event: DragEndEvent) => {
    const taskId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) return;
    const task = workspace.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const target = workspace.members.find((member) => member.id === overId);
    if (task.assigneeId === (target?.id ?? null)) return;
    void moves.assign(taskId, target?.id ?? null, target?.name ?? "nobody");
  };

  const onAssign = (taskId: string, memberId: string | null, label: string) => {
    void moves.assign(taskId, memberId, label);
  };

  const shown = onlyUnassigned ? lanes.nobody : null;

  return (
    <div className="stack">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="board">
          {shown
            ? null
            : lanes.byMember.map((lane) => (
                <Lane
                  key={lane.id}
                  id={lane.id}
                  member={lane.member}
                  load={lane.load}
                  tasks={lane.tasks}
                  members={workspace.members}
                  onOpenTask={onOpenTask}
                  onAssign={onAssign}
                />
              ))}
          <Lane
            id="nobody"
            tasks={onlyUnassigned ? shown ?? [] : lanes.nobody}
            members={workspace.members}
            onOpenTask={onOpenTask}
            onAssign={onAssign}
            nobody
          />
        </div>
      </DndContext>
      <p className="card__meta" style={{ lineHeight: 1.45 }}>
        Drag a card onto a person to hand the work over, or use its Assign menu to choose somebody without dragging. The bar at the top of each
        lane is that person's delivered hours against an even share — the same mark used on every other screen.
      </p>
    </div>
  );
}

function Lane({
  id,
  member,
  load,
  tasks,
  members,
  onOpenTask,
  onAssign,
  nobody,
}: {
  id: string;
  member?: ProjectWorkspace["members"][number];
  load?: ProjectWorkspace["equity"]["members"][number];
  tasks: Task[];
  members: ProjectWorkspace["members"];
  onOpenTask: (id: string) => void;
  onAssign: (taskId: string, memberId: string | null, label: string) => void;
  nobody?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const openTasks = tasks.filter((task) => task.status !== "done");
  const openHours = openTasks.reduce((sum, task) => sum + task.effort, 0);

  return (
    <section
      ref={setNodeRef}
      className={`lane${isOver ? " lane--active" : ""}${nobody ? " lane--nobody" : ""}${load && load.state === "overloaded" ? " lane--over" : ""}`}
      style={member ? hueStyle(member.hue) : undefined}
      aria-label={member ? `${member.name}'s lane` : "Nobody's lane"}
    >
      <header className="lane__head">
        {member ? (
          <>
            <div className="lane__who">
              <Avatar name={member.name} hue={member.hue} size="sm" />
              <span className="lane__name">{member.name}</span>
              {member.role === "lead" ? <Tag edge>lead</Tag> : null}
            </div>
            <LoadBar
              name={member.name}
              hue={member.hue}
              hours={load?.credited ?? 0}
              even={load?.even.credited ?? 0}
              leftLabel={<span className="label">delivered</span>}
            />
            <div className="lane__meta">
              <span className="lane__total">{hours(openHours)} open</span>
              <span>
                {plural(openTasks.length, "task")}
                {load && Math.abs(load.owedCreditedHours) > 0.3 ? ` · ${hours(Math.abs(load.owedCreditedHours))} ${load.owedCreditedHours > 0 ? "behind" : "ahead"}` : ""}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="lane__who">
              <span className="lane__name">Nobody</span>
            </div>
            <div className="lane__meta">
              <span className="lane__total">{hours(openHours)} unclaimed</span>
              <span>{plural(openTasks.length, "task")}</span>
            </div>
          </>
        )}
      </header>
      <div className="lane__body">
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            members={members}
            onOpen={() => onOpenTask(task.id)}
            onAssign={onAssign}
          />
        ))}
        {!tasks.length ? <p className="lane__empty">{nobody ? "every task has an owner" : "nothing on them"}</p> : null}
      </div>
      {!nobody && member ? (
        <div className="lane__body" style={{ paddingTop: 0 }}>
          <span className="label">capacity {hours(member.capacity)} a week</span>
        </div>
      ) : null}
    </section>
  );
}

function DraggableCard({
  task,
  members,
  onOpen,
  onAssign,
}: {
  task: Task;
  members: ProjectWorkspace["members"];
  onOpen: () => void;
  onAssign: (taskId: string, memberId: string | null, label: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`Drag to hand “${task.title}” to somebody else`}
      style={{
        opacity: isDragging ? 0.4 : 1,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      <TaskCard
        task={task}
        dragging={isDragging}
        onOpen={onOpen}
        assignees={members}
        onAssign={(memberId, label) => onAssign(task.id, memberId, label)}
      />
    </div>
  );
}

/* ---------- the table ---------------------------------------------------- */

type SortKey = "position" | "effort" | "due" | "status" | "owner";

export function TaskTable({ workspace, onOpenTask }: { workspace: ProjectWorkspace; onOpenTask: (id: string) => void }) {
  const [sort, setSort] = useState<SortKey>("position");
  const [descending, setDescending] = useState(false);

  const tasks = useMemo(() => {
    const list = [...workspace.tasks];
    const value = (task: Task): string | number => {
      switch (sort) {
        case "effort":
          return task.effort;
        case "due":
          return task.dueAt ? new Date(task.dueAt).getTime() : Number.POSITIVE_INFINITY;
        case "status":
          return OPEN_ORDER[task.status];
        case "owner":
          return (workspace.members.find((member) => member.id === task.assigneeId)?.name ?? "~nobody").toLowerCase();
        default:
          return task.position;
      }
    };
    list.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left === right) return a.position - b.position;
      return left > right ? 1 : -1;
    });
    return descending ? list.reverse() : list;
  }, [workspace, sort, descending]);

  const head = (key: SortKey, label: string, numeric?: boolean) => (
    <th
      className={numeric ? "table__num" : undefined}
      aria-sort={sort === key ? (descending ? "descending" : "ascending") : "none"}
      style={{ cursor: "pointer" }}
      onClick={() => {
        if (sort === key) setDescending((v) => !v);
        else {
          setSort(key);
          setDescending(false);
        }
      }}
    >
      {label}
      {sort === key ? (descending ? " ↓" : " ↑") : ""}
    </th>
  );

  if (!tasks.length) {
    return <Quiet>No tasks on this board yet. Add one, or plan the whole thing from the brief.</Quiet>;
  }

  return (
    <div className="table-wrap">
      <table className="table table--num" style={{ minWidth: "44rem" }}>
        <thead>
          <tr>
            {head("position", "Task")}
            {head("owner", "Who")}
            <th>Stage</th>
            {head("status", "Status")}
            {head("effort", "Hours", true)}
            {head("due", "Due")}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const member = workspace.members.find((entry) => entry.id === task.assigneeId);
            return (
              <tr key={task.id} style={{ cursor: "pointer" }} onClick={() => onOpenTask(task.id)}>
                <td>
                  <span className="row" style={{ gap: "0.4rem", minWidth: 0 }}>
                    <span
                      aria-hidden="true"
                      style={{ width: 3, height: "1.1rem", background: member ? `hsl(${member.hue} 40% 55%)` : "var(--color-line-strong)", flex: "none" }}
                    />
                    <span className="truncate" style={{ fontWeight: 550 }}>
                      {task.title}
                    </span>
                    {task.needsReview ? <Tag tone="over">check</Tag> : null}
                  </span>
                </td>
                <td>
                  {member ? (
                    <span className="row" style={{ gap: "0.35rem" }}>
                      <Avatar name={member.name} hue={member.hue} size="sm" />
                      <span className="truncate">{member.name}</span>
                    </span>
                  ) : (
                    <span className="card__meta" style={{ fontStyle: "italic" }}>
                      nobody
                    </span>
                  )}
                </td>
                <td>
                  <PhaseTag phase={task.phase} />
                </td>
                <td>
                  <StatusTag status={task.status} title={task.blockedBy?.length ? `Waiting on ${listJoin(task.blockedBy.map((item) => item.title))}` : undefined} />
                </td>
                <td className="table__num">{hours(task.effort)}</td>
                <td>
                  <DueMark dueAt={task.dueAt} done={task.status === "done"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- switching between them -------------------------------------- */

export function ViewSwitch({ value, onChange }: { value: "board" | "table"; onChange: (next: "board" | "table") => void }) {
  return (
    <Segmented
      ariaLabel="Board or table"
      value={value}
      onChange={onChange}
      options={[
        { value: "board", label: "Board", title: "One lane per person" },
        { value: "table", label: "Table", title: "Every task in one list" },
      ]}
    />
  );
}
