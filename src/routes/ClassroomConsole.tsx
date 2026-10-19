/**
 * The class console.
 *
 * Everything a teacher needs about one class, in one screen and from one
 * request: is anyone carrying, who is behind, where is the class thin on
 * skills, and what has nobody been given. The four tabs are readings of the
 * same payload — switching tabs issues no new request, so the numbers on
 * different tabs cannot disagree with each other.
 *
 * Students reach the same screen, with the class-wide view of everybody's
 * hours. The engine writes those sentences for the whole class on purpose:
 * a board that only ever shows you your own share is how a group drifts without
 * anyone noticing.
 */
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { useApi } from "../lib/live";
import { plural } from "../lib/format";
import { EmptyState, Panel, Spinner, Tag } from "../components/ui";
import { JoinCode, PageHead } from "../components/blocks";
import { Menu } from "../components/overlays";
import { IconPlus, IconSplit } from "../components/icons";
import type { ClassroomOverview } from "../lib/types";
import { OverviewTab } from "./classroom/Overview";
import { RosterTab } from "./classroom/Roster";
import { CoverageTab } from "./classroom/Coverage";
import { AttentionTab } from "./classroom/Attention";
import { AddStudentsDialog, AssignmentDialog, EditClassDialog, PolicyDialog } from "./classroom/Dialogs";

type Tab = "overview" | "roster" | "coverage" | "attention";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "roster", label: "Roster" },
  { value: "coverage", label: "Coverage" },
  { value: "attention", label: "Attention" },
];

/**
 * The copilot links to `/classrooms/:id?panel=attention`; this screen says
 * `?tab=`. Both are accepted, and the class console's own tabs always write
 * `tab`, so an old link is readable but never rewrites what a person chose.
 */
const PANEL_TABS: Record<string, Tab> = {
  overview: "overview",
  roster: "roster",
  students: "roster",
  coverage: "coverage",
  skills: "coverage",
  attention: "attention",
};

function readTab(params: URLSearchParams): Tab {
  const requested = params.get("tab") ?? params.get("panel");
  if (requested && requested in PANEL_TABS) return PANEL_TABS[requested];
  return "overview";
}

export default function ClassroomConsole() {
  const { classroomId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = readTab(params);
  const { data, loading, error, refresh } = useApi<ClassroomOverview>(`/api/classrooms/${classroomId}`);

  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const setTab = (next: Tab) => {
    const params2 = new URLSearchParams(params);
    if (next === "overview") params2.delete("tab");
    else params2.set("tab", next);
    params2.delete("panel");
    setParams(params2, { replace: true });
  };

  if (loading && !data) {
    return (
      <div className="page">
        <Spinner label="Reading the class" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="That class did not load"
          text={error ?? "It may have been archived, or it may not be yours to see."}
          action={
            <>
              <button type="button" className="btn btn--outline" onClick={refresh}>
                Try again
              </button>
              <Link className="btn btn--primary" to="/classrooms">
                Back to your classes
              </Link>
            </>
          }
        />
      </div>
    );
  }

  const overview = data;
  const { classroom, analytics, nudgeCounts, viewer } = overview;
  const teach = viewer.isTeacher;
  const subjectTerm = [classroom.subject, classroom.term].filter(Boolean).join(" · ");

  return (
    <div className="page">
      <PageHead
        kicker={
          <>
            <Link className="tap" to="/classrooms">
              Your classes
            </Link>
            {subjectTerm ? ` · ${subjectTerm}` : ""}
          </>
        }
        title={classroom.name}
        sub={
          analytics.groups
            ? `${plural(analytics.students, "student")} · ${plural(analytics.groups, "group")} · mean fairness ${analytics.meanScore.toFixed(1)}`
            : `${plural(analytics.students, "student")} · no groups yet`
        }
        actions={
          <>
            <JoinCode code={classroom.code} />
            {teach ? (
              <>
                <button type="button" className="btn btn--outline" onClick={() => setAddOpen(true)}>
                  <IconPlus size={13} />
                  Add students
                </button>
                <Link className="btn btn--outline" to={`/classrooms/${classroom.id}/groups`}>
                  <IconSplit size={13} />
                  Build the groups
                </Link>
                <button type="button" className="btn btn--primary" onClick={() => setAssignOpen(true)}>
                  Set an assignment
                </button>
                <Menu
                  label="More"
                  items={[
                    { label: "Edit the class", onSelect: () => setEditOpen(true), hint: classroom.code },
                    { label: "Change the fairness policy", onSelect: () => setPolicyOpen(true) },
                  ]}
                />
              </>
            ) : null}
          </>
        }
        tabs={
          <div className="tabs" role="tablist" aria-label="Sections of this class">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === item.value}
                onClick={() => setTab(item.value)}
              >
                {item.label}
                {item.value === "roster" ? <span className="label"> {overview.students.length}</span> : null}
                {item.value === "attention" && nudgeCounts.total ? <span className="label"> {nudgeCounts.total}</span> : null}
              </button>
            ))}
          </div>
        }
      />

      {teach && overview.students.length === 0 ? (
        <div className="callout callout--over">
          Nothing can be measured until somebody is on the roster. Add students by email, or give out the join code {classroom.code} and they
          add themselves.
        </div>
      ) : null}

      {tab === "overview" ? <OverviewTab overview={overview} onGoToCoverage={() => setTab("coverage")} onSetAssignment={() => setAssignOpen(true)} /> : null}
      {tab === "roster" ? <RosterTab overview={overview} onChanged={refresh} onAddStudents={() => setAddOpen(true)} /> : null}
      {tab === "coverage" ? <CoverageTab overview={overview} /> : null}
      {tab === "attention" ? <AttentionTab overview={overview} /> : null}

      {!teach ? (
        <Panel title="What you can see here" hint="the class, not just your group">
          <p className="card__meta" style={{ lineHeight: 1.6 }}>
            Everybody in a class can see how the class as a whole is going — the mean fairness, where the class is thin on skills, and who the
            engine thinks needs a hand. What nobody can see is another person&rsquo;s private record: the hour-by-hour ledger and the reviews of
            their work belong to them and to the teacher.
          </p>
          <div className="row row--wrap" style={{ gap: "0.5rem", marginTop: "0.75rem" }}>
            <Link className="btn btn--outline btn--sm" to={`/classrooms/${classroom.id}/students/${viewer.id}`}>
              Open your own record
            </Link>
            <Tag edge>the class view is shared</Tag>
            <Tag edge>a person&rsquo;s record is not</Tag>
          </div>
        </Panel>
      ) : null}

      <AddStudentsDialog open={addOpen} onClose={() => setAddOpen(false)} classroomId={classroom.id} onDone={refresh} />
      <EditClassDialog open={editOpen} onClose={() => setEditOpen(false)} overview={overview} onDone={refresh} />
      <PolicyDialog open={policyOpen} onClose={() => setPolicyOpen(false)} overview={overview} onDone={refresh} />
      <AssignmentDialog open={assignOpen} onClose={() => setAssignOpen(false)} overview={overview} onDone={refresh} />
    </div>
  );
}