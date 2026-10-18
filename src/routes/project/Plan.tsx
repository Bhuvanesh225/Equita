/**
 * The two-step intelligence flows.
 *
 * Both plan and allocation are proposals first and writes second, which is the
 * single most important thing about them: nobody should ever discover that
 * pressing a button re-wrote their board. The dialogs say what will happen and
 * wait to be told.
 */
import { useEffect, useState } from "react";

import { post } from "../../lib/api";
import { ApiError } from "../../lib/api";
import { useToast } from "../../lib/live";
import { PHASE_NAMES, hours, listJoin, plural } from "../../lib/format";
import { EmptyState, Field, Panel, Segmented, Spinner, Stat, Tag } from "../../components/ui";
import { Quiet } from "../../components/blocks";
import { Dialog } from "../../components/overlays";
import { IconCheck, IconSparkle } from "../../components/icons";
import type { AutoAssignResult, PlanProposal, ProjectWorkspace } from "../../lib/types";

/* ---------- planning from the brief -------------------------------------- */

export function PlanDialog({
  open,
  onClose,
  workspace,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  workspace: ProjectWorkspace;
  onDone: () => void;
}) {
  const { push } = useToast();
  const [step, setStep] = useState<"brief" | "proposal">("brief");
  const [brief, setBrief] = useState(workspace.project.brief ?? "");
  const [dueAt, setDueAt] = useState(workspace.project.dueAt ? workspace.project.dueAt.slice(0, 10) : "");
  const [utilisation, setUtilisation] = useState("0.6");
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [autoAssign, setAutoAssign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async () => {
    if (brief.trim().length < 20) {
      setError("Write at least a sentence of brief. The planner reads it, and it cannot read nothing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await post<PlanProposal>(`/api/projects/${workspace.project.id}/plan`, {
        brief: brief.trim(),
        dueAt: dueAt || null,
        utilisation: Number(utilisation),
        members: workspace.members.length || 1,
      });
      setProposal(result);
      setChosen(Object.fromEntries(result.plan.tasks.map((task) => [task.id, !task.duplicate])));
      setStep("proposal");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "The planner could not read that brief.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!proposal) return;
    const tasks = proposal.plan.tasks
      .filter((task) => chosen[task.id])
      .map((task) => ({
        title: task.title,
        detail: task.detail,
        phase: task.phase,
        effort: task.effort,
        priority: task.priority,
        dueAt: task.dueAt,
        required: task.required.map((skill) => ({ slug: skill.slug, weight: skill.weight })),
        needsReview: task.needsReview,
      }));
    if (!tasks.length) {
      setError("Nothing is ticked, so there is nothing to add.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post(`/api/projects/${workspace.project.id}/plan/apply`, { tasks, brief: brief.trim(), autoAssign });
      push({
        title: `Added ${plural(tasks.length, "task")} to the board`,
        detail: autoAssign ? "Equita placed them as well." : "Nobody has been given them yet.",
        tone: "good",
      });
      onDone();
      onClose();
      setStep("brief");
      setProposal(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That plan did not write.");
    } finally {
      setBusy(false);
    }
  };

  const picked = proposal ? proposal.plan.tasks.filter((task) => chosen[task.id]) : [];
  const pickedHours = picked.reduce((sum, task) => sum + task.effort, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="wide"
      title={step === "brief" ? "Plan from the brief" : "Here is what the brief implies"}
      sub={
        step === "brief"
          ? "Paste or write the assignment. The planner turns it into sized tasks, in stages, against your date."
          : "Nothing is written until you say so. Untick anything that does not belong."
      }
      footer={
        step === "brief" ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void read()} disabled={busy}>
              <IconSparkle size={13} />
              {busy ? "Reading the brief..." : "Read the brief"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setStep("brief")} disabled={busy}>
              Back to the brief
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void apply()} disabled={busy || !picked.length}>
              <IconCheck size={13} />
              {busy ? "Writing..." : `Add ${plural(picked.length, "task")}`}
            </button>
          </>
        )
      }
    >
      {step === "brief" ? (
        <div className="stack">
          <Field label="The brief" required error={error} hint="Course codes, deliverables, the rubric — anything the class was told.">
            <textarea className="textarea" rows={8} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Design a public information campaign for the city's bus corridor..." />
          </Field>
          <div className="grid grid--halves" style={{ gap: "1rem" }}>
            <Field label="Hand-in date">
              <input className="input" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </Field>
            <Field label="How full should the plan be?" hint="60% leaves room for the inevitable.">
              <Segmented
                ariaLabel="Utilisation"
                value={utilisation}
                onChange={setUtilisation}
                options={[
                  { value: "0.45", label: "Light" },
                  { value: "0.6", label: "Steady" },
                  { value: "0.8", label: "Full" },
                ]}
              />
            </Field>
          </div>
          <p className="field__hint">
            The planner will aim at {hours((workspace.members.reduce((sum, member) => sum + member.capacity, 0) || 8) * Number(utilisation))} of work,
            spread over {plural(workspace.members.length || 1, "person", "people")} already on this project.
          </p>
        </div>
      ) : null}

      {step === "proposal" && proposal ? (
        <div className="stack">
          <div className="row row--wrap" style={{ gap: "1.25rem" }}>
            <Stat size="sm" value={hours(proposal.plan.meta.totalHours)} label="Total work" note={`${plural(proposal.plan.tasks.length, "task")} proposed`} />
            <Stat size="sm" value={hours(proposal.plan.meta.perMemberHours)} label="Each person" note={`of ${hours(proposal.plan.meta.availableHours)} available`} />
            <Stat size="sm" value={`${Math.round(proposal.plan.meta.utilisation * 100)}%`} label="Full" note={`over ${proposal.plan.meta.weeks} week${proposal.plan.meta.weeks === 1 ? "" : "s"}`} />
            <Stat size="sm" value={proposal.context.existingTasks} label="Already on the board" note={`an even share is ${hours(proposal.context.evenShareHours)}`} />
          </div>

          {proposal.plan.meta.notes.length ? (
            <div className="callout callout--accent">{proposal.plan.meta.notes.join(" ")}</div>
          ) : null}

          {proposal.plan.meta.matchedWords.length ? (
            <p className="card__meta">
              Recognised in the brief: {listJoin(proposal.plan.meta.matchedWords.slice(0, 12))}.
            </p>
          ) : null}

          <div className="stack" style={{ gap: "0.75rem" }}>
            {proposal.plan.meta.phases.map((phase) => {
              const tasks = proposal.plan.tasks.filter((task) => task.phase === phase.id);
              if (!tasks.length) return null;
              return (
                <Panel key={phase.id} title={PHASE_NAMES[phase.id] ?? phase.id} hint={`${plural(tasks.length, "task")} · ${hours(phase.hours)}`} flush>
                  {tasks.map((task) => (
                    <label key={task.id} className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!chosen[task.id]} onChange={(event) => setChosen((current) => ({ ...current, [task.id]: event.target.checked }))} style={{ marginTop: "0.2rem" }} />
                      <span style={{ minWidth: 0 }}>
                        <span className="rowitem__title">
                          {task.title}
                          {task.duplicate ? <Tag tone="quiet" edge> already on the board</Tag> : null}
                        </span>
                        <span className="rowitem__sub">{task.detail}</span>
                        {task.required.length ? (
                          <span className="rowitem__sub" style={{ display: "block" }}>
                            needs {listJoin(task.required.map((skill) => skill.name ?? skill.slug))}
                          </span>
                        ) : null}
                      </span>
                      <span className="row" style={{ gap: "0.4rem" }}>
                        <span className="tnum card__meta">{hours(task.effort)}</span>
                        {task.needsReview ? <Tag tone="over">check it</Tag> : null}
                      </span>
                    </label>
                  ))}
                </Panel>
              );
            })}
          </div>

          <div className="row row--between row--wrap" style={{ gap: "1rem" }}>
            <span className="label tnum">{picked.length} ticked · {hours(pickedHours)}</span>
            <label className="switch">
              <input type="checkbox" checked={autoAssign} onChange={(event) => setAutoAssign(event.target.checked)} />
              Let Equita place them on people straight away
            </label>
          </div>
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}

/* ---------- placing the work --------------------------------------------- */

export function AutoAssignDialog({
  open,
  onClose,
  workspace,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  workspace: ProjectWorkspace;
  onDone: () => void;
}) {
  const { push } = useToast();
  const [result, setResult] = useState<AutoAssignResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // The preview is fetched once, when the dialog opens. It changes nothing.
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    setBusy(true);
    post<{ result: AutoAssignResult }>(`/api/projects/${workspace.project.id}/assign/auto`, { apply: false, onlyUnassigned: true })
      .then((payload) => setResult(payload.result))
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "The allocator could not run."))
      .finally(() => setBusy(false));
  }, [open, loaded, workspace.project.id]);

  const apply = async () => {
    setBusy(true);
    try {
      await post(`/api/projects/${workspace.project.id}/assign/auto`, { apply: true, onlyUnassigned: true });
      push({ title: "Work placed", detail: "Every person was notified of what landed on them.", tone: "good" });
      onDone();
      onClose();
      setResult(null);
      setLoaded(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "That did not write.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setResult(null);
        setLoaded(false);
        onClose();
      }}
      width="wide"
      title="Place the unclaimed work"
      sub="Every task nobody has taken, matched to the person who fits it, has room for it, and is behind their share."
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setResult(null);
              setLoaded(false);
              onClose();
            }}
          >
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void apply()} disabled={busy || !result?.assignments.length}>
            <IconCheck size={13} />
            {busy ? "Working..." : `Place ${plural(result?.assignments.length ?? 0, "task")}`}
          </button>
        </>
      }
    >
      {!result && !error ? (
        <div className="panel__body">
          <Spinner label="Weighing every person against every task" />
        </div>
      ) : null}

      {error ? (
        <EmptyState
          title="The allocator could not run"
          text={error}
          action={
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => {
                setError(null);
                setLoaded(false);
              }}
            >
              Try again
            </button>
          }
        />
      ) : null}

      {result && !error ? (
        <div className="stack">
          {result.balance ? (
            <div className={`callout callout--${result.balance.improved ? "accent" : "over"}`}>
              {result.balance.improved
                ? `This makes the split more even: Gini goes from ${result.balance.giniBefore.toFixed(2)} to ${result.balance.giniAfter.toFixed(2)}.`
                : `This does not improve the split — Gini moves from ${result.balance.giniBefore.toFixed(2)} to ${result.balance.giniAfter.toFixed(2)}. The board may be too small for the fix.`}
            </div>
          ) : null}

          {result.assignments.length ? (
            <Panel title="What it would do" hint={`${plural(result.assignments.length, "placement")}`} flush>
              {result.assignments.map((item) => (
                <div key={item.taskId} className="rowitem" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="rowitem__title">{item.taskTitle}</span>
                    <span className="rowitem__sub">{item.rationale}</span>
                    {item.alternatives.length ? (
                      <span className="rowitem__sub" style={{ display: "block" }}>
                        next best: {listJoin(item.alternatives.slice(0, 2).map((other) => `${other.name} (${Math.round(other.score)})`))}
                      </span>
                    ) : null}
                  </span>
                  <span className="row" style={{ gap: "0.4rem" }}>
                    <Tag tone="accent" dot>
                      {item.name}
                    </Tag>
                    <span className="tnum card__meta">{hours(item.effort)}</span>
                  </span>
                </div>
              ))}
            </Panel>
          ) : (
            <EmptyState title="Nothing to place" text={result.notes.join(" ") || "Every task already has an owner."} />
          )}

          {result.unassigned.length ? (
            <Panel title="Left where they are" hint={`${plural(result.unassigned.length, "task")} nobody fits`} flush>
              {result.unassigned.map((item) => (
                <div key={item.taskId} className="rowitem" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="rowitem__title">{item.title}</span>
                    <span className="rowitem__sub">{item.reason}</span>
                  </span>
                  <span className="tnum card__meta">{hours(item.effort)}</span>
                </div>
              ))}
            </Panel>
          ) : null}

          {result.load.length ? (
            <Panel title="After the move" hint="each person's open work against an even share">
              <div className="stack stack--tight">
                {result.load.map((row) => (
                  <div key={row.id} className="row row--between" style={{ gap: "0.5rem" }}>
                    <span className="label">{row.name}</span>
                    <span className="card__meta tnum">
                      {hours(row.open)} open · even share {hours(row.even)} · {row.tasks} tasks
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {result.notes.length ? <Quiet>{result.notes.join(" ")}</Quiet> : null}
        </div>
      ) : null}
    </Dialog>
  );
}