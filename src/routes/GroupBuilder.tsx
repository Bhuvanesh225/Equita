/**
 * Forming groups.
 *
 * This is the one place where a lane means a team rather than a person. The
 * grouping engine makes a first arrangement from the class roster; a teacher
 * can then make the human adjustment the engine cannot know about, without
 * losing the coverage evidence that made the arrangement worth opening.
 *
 * Preview is deliberately separate from commit. Changing the size, required
 * clusters, or seed only replaces a proposal. The POST that creates classroom
 * projects happens in the commit dialog, after the teacher has seen the teams.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError, post } from "../lib/api";
import { useApi, useToast } from "../lib/live";
import { dateInput, decimal, hours, pct, plural } from "../lib/format";
import { Avatar, EmptyState, Field, Meter, Panel, Segmented, Spinner, Stat, Tag } from "../components/ui";
import { Menu, Dialog } from "../components/overlays";
import { PageHead, Quiet } from "../components/blocks";
import { IconDrag } from "../components/icons";
import type { ClassroomOverview, Cluster, GroupProposal, GroupTeam } from "../lib/types";

type TeamState = GroupTeam[];
type ClusterCatalogue = { clusters: Cluster[] };

const PARTS: Array<{ key: keyof GroupProposal["parts"]; label: string }> = [
  { key: "coverage", label: "Coverage" },
  { key: "strengthBalance", label: "Strength balance" },
  { key: "capacityBalance", label: "Capacity balance" },
  { key: "diversity", label: "Diversity" },
];

export default function GroupBuilder() {
  const { classroomId = "" } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const classroom = useApi<ClassroomOverview>(classroomId ? `/api/classrooms/${classroomId}` : null);
  const catalogue = useApi<ClusterCatalogue>("/api/skills/clusters");

  const [size, setSize] = useState(4);
  const [requiredClusters, setRequiredClusters] = useState<string[]>([]);
  const [seed, setSeed] = useState(20261018);
  const [proposal, setProposal] = useState<GroupProposal | null>(null);
  const [teams, setTeams] = useState<TeamState>([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const clusterKey = requiredClusters.join(",");
  const refreshPreview = useCallback(() => setSeed((current) => current + 1), []);

  useEffect(() => {
    if (!classroomId || classroom.data?.viewer.isTeacher === false) return;
    let active = true;
    setPreviewLoading(true);
    setPreviewError(null);
    void post<GroupProposal>(`/api/classrooms/${classroomId}/groups/preview`, {
      size,
      requiredClusters,
      seed,
    })
      .then((next) => {
        if (!active) return;
        setProposal(next);
        setTeams(cloneTeams(next.teams));
        setManual(false);
      })
      .catch((cause) => {
        if (!active) return;
        setPreviewError(cause instanceof ApiError ? cause.message : "The grouping preview could not be read.");
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
    // `clusterKey` is the stable representation of the selected clusters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId, size, seed, clusterKey, classroom.data?.viewer.isTeacher]);

  const clusterNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const cluster of catalogue.data?.clusters ?? []) names.set(cluster.id, cluster.name);
    for (const gap of proposal?.gaps ?? []) names.set(gap.cluster, gap.name);
    return names;
  }, [catalogue.data, proposal?.gaps]);

  const roleMap = useMemo(() => {
    const map = new Map<string, GroupTeam["roles"][number]>();
    for (const team of proposal?.teams ?? []) for (const role of team.roles) map.set(role.memberId, role);
    return map;
  }, [proposal?.teams]);

  const moveMember = useCallback(
    (memberId: string, targetId: string) => {
      const source = teams.find((team) => team.members.some((member) => member.id === memberId));
      const target = teams.find((team) => team.id === targetId);
      if (!source || !target || source.id === target.id) return;
      const member = source.members.find((item) => item.id === memberId);
      if (!member) return;
      const next = teams.map((team) => {
        if (team.id === source.id) return recomputeTeam(team, team.members.filter((item) => item.id !== memberId), requiredClusters, roleMap, clusterNames);
        if (team.id === target.id) return recomputeTeam(team, [...team.members, member], requiredClusters, roleMap, clusterNames);
        return team;
      });
      setTeams(next);
      setManual(true);
    },
    [clusterNames, requiredClusters, roleMap, teams],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const targetId = event.over?.id ? String(event.over.id) : null;
      if (targetId) moveMember(String(event.active.id), targetId);
    },
    [moveMember],
  );

  const commit = async (input: CommitInput) => {
    if (!proposal || !classroomId) return;
    setCommitBusy(true);
    setCommitError(null);
    try {
      const result = await post<{ created: Array<{ id: string; name: string; members: number; planned: number; placed: number }> }>(`/api/classrooms/${classroomId}/projects`, {
        name: input.name.trim(),
        brief: input.brief.trim(),
        dueAt: input.dueAt ? new Date(`${input.dueAt}T23:59:59`).toISOString() : null,
        teams: teams.map((team) => ({ name: team.name, memberIds: team.members.map((member) => member.id) })),
        autoPlan: input.autoPlan,
        autoAssign: input.autoAssign && input.autoPlan,
        requiredClusters,
      });
      push({ title: `${plural(result.created.length, "group")} set`, detail: input.autoPlan ? "The new boards are ready for their brief." : "The new boards are ready for the teacher to plan.", tone: "good" });
      setCommitOpen(false);
      navigate(`/classrooms/${classroomId}`);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Those groups could not be committed.";
      setCommitError(message);
      push({ title: "The groups were not set", detail: message, tone: "bad" });
    } finally {
      setCommitBusy(false);
    }
  };

  if (classroom.loading && !classroom.data) return <div className="page"><Spinner label="Opening the class" /></div>;
  if (classroom.error || !classroom.data) {
    return <div className="page"><EmptyState title="The class did not load" text={classroom.error ?? "That class may have been removed."} action={<><button type="button" className="btn btn--outline" onClick={classroom.refresh}>Try again</button><Link className="btn btn--primary" to="/classrooms">Back to classes</Link></>} /></div>;
  }
  if (!classroom.data.viewer.isTeacher) {
    return <div className="page"><EmptyState title="Only the teacher can form groups" text="The class view is shared, but forming groups changes every student's project boards." action={<Link className="btn btn--primary" to={`/classrooms/${classroomId}`}>Back to the class</Link>} /></div>;
  }
  if (previewLoading && !proposal) return <div className="page"><Spinner label="Finding a fair arrangement" /></div>;
  if (previewError && !proposal) return <div className="page"><EmptyState title="The preview did not load" text={previewError} action={<><button type="button" className="btn btn--outline" onClick={refreshPreview}>Try another arrangement</button><Link className="btn btn--primary" to={`/classrooms/${classroomId}`}>Back to the class</Link></>} /></div>;
  if (!proposal || proposal.teams.length < 2) return <div className="page"><EmptyState title="Not enough students to form groups" text="Add at least two students to the roster first. The allocator will keep the grouping honest rather than inventing a team." action={<Link className="btn btn--primary" to={`/classrooms/${classroomId}?tab=roster`}>Back to the roster</Link>} /></div>;

  const sizeOptions = range(proposal.sizeRange[0], proposal.sizeRange[1]);
  const valid = teams.every((team) => team.members.length > 0) && teams.flatMap((team) => team.members).length === proposal.rosterSize;

  return (
    <div className="page">
      <PageHead
        kicker={<Link className="tap" to={`/classrooms/${classroomId}`}>{classroom.data.classroom.name}</Link>}
        title="Form the groups"
        sub="Let the engine make the first fair arrangement, then make the human adjustment before it becomes a set of real boards."
        actions={<><button type="button" className="btn btn--primary" disabled={!valid || commitBusy} onClick={() => { setCommitError(null); setCommitOpen(true); }}>Commit the groups</button><Menu label="More" items={[{ label: "Try another arrangement", onSelect: refreshPreview, hint: "discards manual moves" }]} /></>}
      />

      {previewError ? <div className="callout callout--over" role="status">The latest preview failed: {previewError}. The last good arrangement is still on screen.</div> : null}
      {manual ? <Quiet>You have moved a person by hand. Running another preview will discard those moves and use the engine's new arrangement.</Quiet> : null}

      <Panel title="The brief for the allocator" hint="changing a control makes a new proposal" recessed stacked>
        <div className="stack">
          <div className="grid grid--split">
            <div className="stack stack--tight">
              <span className="label">Group size</span>
              <Segmented<string> ariaLabel="Target group size" value={String(size)} onChange={(next) => setSize(Number(next))} options={sizeOptions.map((value) => ({ value: String(value), label: value, title: `Aim for groups of ${value}` }))} />
              <span className="card__meta">The preview returned groups from {proposal.sizeRange[0]} to {proposal.sizeRange[1]} people.</span>
            </div>
            <div className="row row--wrap" style={{ gap: "1rem" }}>
              <Stat value={pct(proposal.objective)} label="Arrangement objective" note={proposal.balanced ? "the engine calls this balanced" : "the engine says it needs a look"} tone={proposal.balanced ? "accent" : "over"} />
              <Tag tone={proposal.balanced ? "accent" : "over"} dot>{proposal.balanced ? "balanced" : "review before commit"}</Tag>
            </div>
          </div>

          <div className="stack stack--tight">
            <span className="label">Skills the assignment needs</span>
            <div className="row row--wrap" style={{ gap: "0.4rem" }}>
              {(catalogue.data?.clusters ?? []).map((cluster) => {
                const selected = requiredClusters.includes(cluster.id);
                return <button key={cluster.id} type="button" className={`chip chip--accent${selected ? "" : ""}`} aria-pressed={selected} title={cluster.blurb} onClick={() => setRequiredClusters((current) => selected ? current.filter((id) => id !== cluster.id) : [...current, cluster.id])}>{cluster.name}</button>;
              })}
              {!catalogue.data?.clusters.length ? <span className="card__meta">No skill clusters were returned, so the preview is using the whole roster.</span> : null}
            </div>
          </div>

          <div className="grid grid--split">
            <div className="stack stack--tight">
              {PARTS.map((part) => <Meter key={part.key} label={part.label} value={proposal.parts[part.key] * 100} hint={`${part.label}: ${pct(proposal.parts[part.key])}`} />)}
            </div>
            <div className="stack stack--tight">
              <span className="label">What the engine noticed</span>
              {proposal.notes.map((note) => <Quiet key={note}>{note}</Quiet>)}
            </div>
          </div>
        </div>
      </Panel>

      {proposal.gaps.some((gap) => gap.needed) ? <div className="callout callout--over"><strong>Thin coverage:</strong> {proposal.gaps.filter((gap) => gap.needed).map((gap) => `${gap.name} (${gap.strong} strong)`).join(" · ")}. The groups can still be committed, but the warning will stay visible in the class coverage reading.</div> : null}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="board" aria-label="Proposed groups">
          {teams.map((team) => <TeamLane key={team.id ?? team.name} team={team} teams={teams} clusterNames={clusterNames} onMove={moveMember} />)}
        </div>
      </DndContext>

      <Quiet>Drag is an enhancement. Every member also has a <strong>Move to…</strong> menu, so a keyboard-only teacher can complete the same arrangement.</Quiet>

      <CommitDialog open={commitOpen} onClose={() => { if (!commitBusy) setCommitOpen(false); }} onCommit={commit} busy={commitBusy} error={commitError} classroomName={classroom.data.classroom.name} />
    </div>
  );
}

interface CommitInput {
  name: string;
  brief: string;
  dueAt: string;
  autoPlan: boolean;
  autoAssign: boolean;
}

function range(start: number, end: number): number[] {
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  return Array.from({ length: high - low + 1 }, (_, index) => low + index);
}

function cloneTeams(source: GroupTeam[]): TeamState {
  return source.map((team) => ({ ...team, members: team.members.map((member) => ({ ...member, topSkills: [...member.topSkills], clusters: member.clusters ? [...member.clusters] : undefined }),), roles: [...team.roles], coverage: { ...team.coverage } }));
}

function recomputeTeam(
  team: GroupTeam,
  members: GroupTeam["members"],
  requiredClusters: string[],
  roleMap: Map<string, GroupTeam["roles"][number]>,
  clusterNames: Map<string, string>,
): GroupTeam {
  const coverage: Record<string, number> = {};
  for (const member of members) {
    for (const cluster of member.clusters ?? []) coverage[cluster.cluster] = Math.max(coverage[cluster.cluster] ?? 0, cluster.level);
  }
  const keys = new Set([...Object.keys(coverage), ...requiredClusters]);
  for (const key of keys) coverage[key] ??= 0;
  const strengths = members.map((member) => member.strength);
  const totalStrength = strengths.reduce((sum, value) => sum + value, 0);
  const requiredCoverage = requiredClusters.length
    ? requiredClusters.reduce((sum, cluster) => sum + Math.max(0, Math.min(1, (coverage[cluster] ?? 0) / 4)), 0) / requiredClusters.length
    : 1;
  const weakestCluster = Object.entries(coverage).sort((left, right) => left[1] - right[1])[0]?.[0] ?? null;
  return {
    ...team,
    members: [...members],
    size: members.length,
    coverage,
    requiredCoverage,
    totalStrength,
    meanStrength: members.length ? totalStrength / members.length : 0,
    totalCapacity: members.reduce((sum, member) => sum + member.capacity, 0),
    weakestCluster,
    roles: members.map((member) => roleMap.get(member.id)).filter((role): role is GroupTeam["roles"][number] => !!role),
    name: team.name || clusterNames.get(weakestCluster ?? "") || "Group",
  };
}

function TeamLane({
  team,
  teams,
  clusterNames,
  onMove,
}: {
  team: GroupTeam;
  teams: TeamState;
  clusterNames: Map<string, string>;
  onMove: (memberId: string, targetId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: team.id ?? team.name });
  const id = team.id ?? team.name;
  const coverage = Object.entries(team.coverage).sort((left, right) => right[1] - left[1]).slice(0, 4);

  return (
    <section ref={setNodeRef} className={`lane${isOver ? " lane--active" : ""}`} aria-label={`${team.name}, ${plural(team.members.length, "member")}`}>
      <header className="lane__head">
        <div className="lane__who">
          <span className="lane__name">{team.name}</span>
          <Tag edge>{plural(team.members.length, "member")}</Tag>
        </div>
        <div className="lane__meta">
          <span className="lane__total">{hours(team.totalCapacity)} capacity</span>
          <span>{hours(team.meanStrength)} average strength</span>
        </div>
      </header>
      <div className="lane__body">
        {team.weakestCluster ? <div className="callout callout--over" style={{ marginBottom: "0.75rem" }}>Weakest coverage: {clusterNames.get(team.weakestCluster) ?? team.weakestCluster}</div> : null}
        <div className="stack stack--tight">
          {coverage.map(([cluster, value]) => <Meter key={cluster} label={clusterNames.get(cluster) ?? cluster} value={(value / 5) * 100} hint={`${clusterNames.get(cluster) ?? cluster}: ${decimal(value)} out of 5`} />)}
        </div>
        {team.members.map((member) => <MemberCard key={member.id} member={member} currentTeamId={id} teams={teams} onMove={onMove} />)}
        {!team.members.length ? <p className="lane__empty">Move somebody here before you commit.</p> : null}
      </div>
      {team.roles.length ? <footer className="panel__foot"><div className="stack stack--tight"><span className="label">Suggested roles</span>{team.roles.map((role) => <span key={`${role.role}-${role.memberId}`} className="card__meta"><strong>{role.label}</strong> · {role.name}</span>)}</div></footer> : null}
    </section>
  );
}

function MemberCard({
  member,
  currentTeamId,
  teams,
  onMove,
}: {
  member: GroupTeam["members"][number];
  currentTeamId: string;
  teams: TeamState;
  onMove: (memberId: string, targetId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: member.id });
  const destinations = teams.filter((team) => (team.id ?? team.name) !== currentTeamId);
  return (
    <div ref={setNodeRef} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.45 : 1 }}>
      <div className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto", alignItems: "center" }}>
        <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Drag ${member.name} to another group`} title="Drag to another group" {...listeners} {...attributes}>
          <IconDrag size={14} />
        </button>
        <span style={{ minWidth: 0 }}>
          <span className="rowitem__title"><Avatar name={member.name} hue={member.hue} size="sm" /> {member.name}</span>
          <span className="rowitem__sub">{member.headline || "no headline"} · {hours(member.capacity)} a week</span>
        </span>
        <Menu label="Move to…" items={destinations.map((team) => ({ label: team.name, onSelect: () => onMove(member.id, team.id ?? team.name) }))} />
      </div>
    </div>
  );
}

function CommitDialog({
  open,
  onClose,
  onCommit,
  busy,
  error,
  classroomName,
}: {
  open: boolean;
  onClose: () => void;
  onCommit: (input: CommitInput) => Promise<void>;
  busy: boolean;
  error: string | null;
  classroomName: string;
}) {
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [autoPlan, setAutoPlan] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);

  useEffect(() => {
    if (!open || name) return;
    setName(`${classroomName} assignment`);
  }, [classroomName, name, open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Commit the groups"
      sub="This creates one new project board per team. It does not change or delete an existing assignment."
      width="wide"
      footer={<div className="row row--between row--wrap"><span className="card__meta">The teacher can still change the plan on each board.</span><div className="row row--wrap"><button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="btn btn--primary" onClick={() => void onCommit({ name, brief, dueAt, autoPlan, autoAssign })} disabled={busy || name.trim().length < 2}>{busy ? "Setting the groups…" : "Set the groups"}</button></div></div>}
    >
      <div className="stack">
        {error ? <div className="callout callout--risk" role="alert">{error}</div> : null}
        <Field label="Assignment name" required htmlFor="group-assignment-name" hint="Each board is named with this plus its team name.">
          <input id="group-assignment-name" className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </Field>
        <Field label="The brief" hint="Optional here. If you add it, the planner can turn it into tasks on every new board.">
          <textarea className="textarea" value={brief} onChange={(event) => setBrief(event.target.value)} rows={6} placeholder="What has the class actually been asked to make?" />
        </Field>
        <Field label="Hand in" hint="A date is optional; leaving it blank keeps the boards open-ended.">
          <input className="input" type="date" value={dateInput(dueAt)} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
        <label className="row row--between" style={{ gap: "1rem", alignItems: "flex-start" }}>
          <span><strong>Plan the tasks from the brief</strong><span className="rowitem__sub">Create the planner's first proposal on each board.</span></span>
          <input type="checkbox" checked={autoPlan} onChange={(event) => { setAutoPlan(event.target.checked); if (!event.target.checked) setAutoAssign(false); }} aria-label="Plan the tasks from the brief" />
        </label>
        <label className="row row--between" style={{ gap: "1rem", alignItems: "flex-start", opacity: autoPlan ? 1 : 0.55 }}>
          <span><strong>Place the work with the allocator</strong><span className="rowitem__sub">Only available when there is a brief to plan from.</span></span>
          <input type="checkbox" checked={autoAssign} disabled={!autoPlan} onChange={(event) => setAutoAssign(event.target.checked)} aria-label="Place the work with the allocator" />
        </label>
      </div>
    </Dialog>
  );
}
