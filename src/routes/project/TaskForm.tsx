/**
 * Writing a task.
 *
 * A task is the one object that appears on this screen more than anything else,
 * so the form that creates one and the form that edits one are the same form.
 */
import { useMemo, useState } from "react";

import { patch, post } from "../../lib/api";
import { ApiError } from "../../lib/api";
import { useToast } from "../../lib/live";
import { PHASE_NAMES, dateInput, hours, plural } from "../../lib/format";
import { Field, Segmented, Tag } from "../../components/ui";
import { Quiet } from "../../components/blocks";
import { Dialog } from "../../components/overlays";
import type { ProjectMember, ProjectWorkspace, Skill, Task } from "../../lib/types";

type Phase = ProjectWorkspace["tasks"][number]["phase"];

/* ---------- picking the skills a task needs ------------------------------ */

export function SkillPicker({
  skills,
  value,
  onChange,
  max = 4,
  label = "Skills this needs",
}: {
  skills: Skill[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle ? skills.filter((skill) => `${skill.name} ${skill.cluster}`.toLowerCase().includes(needle)) : skills;
    const map = new Map<string, Skill[]>();
    for (const skill of pool) {
      const list = map.get(skill.cluster) ?? [];
      list.push(skill);
      map.set(skill.cluster, list);
    }
    return [...map.entries()].slice(0, 6);
  }, [skills, query]);

  const toggle = (slug: string) => {
    if (value.includes(slug)) onChange(value.filter((item) => item !== slug));
    else if (value.length < max) onChange([...value, slug]);
  };

  return (
    <div className="stack stack--tight">
      <span className="field__label">
        {label}
        <span className="label">
          {" "}
          {value.length}/{max} chosen
        </span>
      </span>
      <input className="input" placeholder="Search the skill list" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search skills" />
      <div className="stack" style={{ gap: "0.5rem", maxHeight: "13rem", overflowY: "auto" }}>
        {groups.map(([cluster, items]) => (
          <div key={cluster} className="stack" style={{ gap: "0.3rem" }}>
            <span className="label">{cluster.replace(/[-_]/g, " ")}</span>
            <div className="row row--wrap" style={{ gap: "0.3rem" }}>
              {items.map((skill) => (
                <button
                  key={skill.slug}
                  type="button"
                  className={`chip${value.includes(skill.slug) ? " chip--accent" : ""}`}
                  aria-pressed={value.includes(skill.slug)}
                  onClick={() => toggle(skill.slug)}
                  title={skill.prompt}
                >
                  {skill.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!groups.length ? <Quiet>Nothing in the skill list matches that.</Quiet> : null}
      </div>
      {value.length ? (
        <div className="row row--wrap" style={{ gap: "0.3rem" }}>
          {value.map((slug) => (
            <Tag key={slug} tone="accent" dot>
              {skills.find((skill) => skill.slug === slug)?.name ?? slug}
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- the form ----------------------------------------------------- */

export function TaskFormDialog({
  open,
  onClose,
  projectId,
  members,
  skills,
  task,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  members: ProjectMember[];
  skills: Skill[];
  task?: Task;
  onDone: () => void;
}) {
  const { push } = useToast();
  const editing = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [detail, setDetail] = useState(task?.detail ?? "");
  const [phase, setPhase] = useState<Phase>(task?.phase ?? "build");
  const [effort, setEffort] = useState(String(task?.effort ?? 3));
  const [priority, setPriority] = useState(String(task?.priority ?? 2));
  const [dueAt, setDueAt] = useState(dateInput(task?.dueAt ?? null));
  const [required, setRequired] = useState<string[]>(task?.required.map((skill) => skill.slug) ?? []);
  const [needsReview, setNeedsReview] = useState(!!task?.needsReview);
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (title.trim().length < 2) {
      setError("Give the task a name of at least two characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      title: title.trim(),
      detail: detail.trim(),
      phase,
      effort: Number(effort) || 1,
      priority: Number(priority) || 2,
      dueAt: dueAt || null,
      required: required.map((slug) => ({ slug, weight: 1 })),
      needsReview,
      ...(editing ? {} : { assigneeId: assigneeId || null }),
    };
    try {
      if (editing && task) {
        await patch(`/api/tasks/${task.id}`, payload);
        push({ title: "Task updated", tone: "good" });
      } else {
        await post(`/api/projects/${projectId}/tasks`, payload);
        push({ title: "Task added", detail: `${hours(Number(effort) || 1)} of work on the board.`, tone: "good" });
      }
      onDone();
      onClose();
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "That did not save.";
      setError(message);
      push({ title: "That did not save", detail: message, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="wide"
      title={editing ? "Edit task" : "Add a task"}
      sub={editing ? "Changing the effort or the skills changes who fits it." : "Give it a size. The allocator matches people to that number."}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving..." : editing ? "Save changes" : "Add the task"}
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label="What is it?" required htmlFor="task-title" error={error}>
          <input id="task-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Write the first draft" autoFocus />
        </Field>

        <Field label="What does finishing it look like?" hint="Optional, but it is what the next person reads.">
          <textarea className="textarea" rows={3} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Get it long and rough. Do not edit while drafting." />
        </Field>

        <div className="grid grid--halves" style={{ gap: "1rem" }}>
          <Field label="Stage">
            <Segmented
              ariaLabel="Stage"
              value={phase}
              onChange={setPhase}
              options={(["discover", "define", "build", "review", "ship"] as Phase[]).map((value) => ({ value, label: PHASE_NAMES[value] }))}
            />
          </Field>
          <Field label="How long?" hint="Hours of one person's time. This number decides everything downstream.">
            <div className="row" style={{ gap: "0.5rem" }}>
              <input className="input" type="number" min={0.25} max={40} step={0.25} value={effort} onChange={(event) => setEffort(event.target.value)} style={{ maxWidth: "6rem" }} />
              <span className="label">hours</span>
            </div>
          </Field>
        </div>

        <div className="grid grid--halves" style={{ gap: "1rem" }}>
          <Field label="Priority">
            <Segmented
              ariaLabel="Priority"
              value={priority}
              onChange={setPriority}
              options={[
                { value: "1", label: "Whenever" },
                { value: "2", label: "Normal" },
                { value: "3", label: "Before the date" },
              ]}
            />
          </Field>
          <Field label="Due">
            <input className="input" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </Field>
        </div>

        <SkillPicker skills={skills} value={required} onChange={setRequired} />

        <div className="row row--wrap row--between" style={{ gap: "1rem" }}>
          <label className="switch">
            <input type="checkbox" checked={needsReview} onChange={(event) => setNeedsReview(event.target.checked)} />
            Someone else should check it before it closes
          </label>
          {!editing ? (
            <label className="field" style={{ maxWidth: "18rem" }}>
              <span className="field__label">Straight to somebody</span>
              <select className="select" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                <option value="">Nobody yet — leave it for the allocator</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {!editing && assigneeId && members.length ? (
          <p className="field__hint">
            Handing it over now records an assignment with your name on it. Leaving it open lets the allocator weigh{" "}
            {plural(members.length, "person", "people")} against the skills you named.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}