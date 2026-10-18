/**
 * Shared pieces for the three public screens: sign in, sign up, join a class.
 *
 * The right-hand column is not decoration. It runs the real equity engine over
 * the seeded demonstration dataset and shows one group's actual figures, so a
 * person deciding whether to try this can see what it does with a group before
 * they hand over an email address.
 */
import { type ReactNode } from "react";
import { Link } from "react-router-dom";

import { useApi } from "../../lib/live";
import { hours } from "../../lib/format";
import { LoadBar, Panel, ShareBar, Spinner } from "../../components/ui";
import type { Story } from "../landing/types";

export function AuthBrand() {
  return (
    <Link to="/" className="auth__brand">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="0" y="3" width="20" height="3" fill="var(--color-accent)" />
        <rect x="0" y="9" width="13" height="3" fill="var(--color-ink)" />
        <rect x="0" y="15" width="7" height="3" fill="var(--color-ink-3)" />
      </svg>
      Equita
    </Link>
  );
}

export function AuthLayout({ side, children }: { side?: ReactNode; children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth__form-col">
        <AuthBrand />
        <div className="auth__mid">{children}</div>
        <p className="auth__small">
          Equita runs on a demonstration dataset of invented students and classes. Every number on these screens is computed from it by the same
          engine the product uses. No real school data is involved.
        </p>
      </div>
      <aside className="auth__proof" aria-label="What the engine says about a real group">
        {side ?? <ProofColumn />}
      </aside>
    </div>
  );
}

const DEMOS = [
  { email: "amara@equita.demo", name: "Amara Okafor", note: "Teacher · Systems Design 2A", hue: 28 },
  { email: "maya@equita.demo", name: "Maya Okonkwo", note: "Student · carrying 5.8h of open work", hue: 210 },
  { email: "tobias@equita.demo", name: "Tobias Lund", note: "Teacher · Media Studies 1B", hue: 132 },
  { email: "june@equita.demo", name: "June Abara", note: "Student · leads a group outside class", hue: 300 },
];

export function DemoAccounts({ onPick, busy }: { onPick: (email: string) => void; busy?: string | null }) {
  return (
    <div className="auth__demos">
      {DEMOS.map((demo) => (
        <button key={demo.email} type="button" className="auth__demo" onClick={() => onPick(demo.email)} disabled={!!busy}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <rect width="22" height="22" fill={`hsl(${demo.hue} 40% 40%)`} />
            <text x="11" y="15" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">
              {demo.name.split(" ").map((part) => part[0]).join("")}
            </text>
          </svg>
          <span style={{ minWidth: 0 }}>
            <span className="auth__demo-name">{demo.name}</span>
            <span className="auth__demo-note">{demo.note}</span>
          </span>
          <span className="auth__demo-note nowrap">{busy === demo.email ? "Opening…" : "Open →"}</span>
        </button>
      ))}
    </div>
  );
}

/** The engine's own verdict on one real group from the dataset. */
function ProofColumn() {
  const { data, loading } = useApi<Story>("/api/public/story", { live: false });

  if (loading) {
    return (
      <Panel title="A group, as the engine sees it" flush>
        <div className="panel__body">
          <Spinner label="Scoring a real group" />
        </div>
      </Panel>
    );
  }

  const situation = data?.situations.find((s) => s.id === "working") ?? data?.situations[0];
  if (!situation) return null;

  return (
    <>
      <div className="auth__proof-head">
        <div>
          <p className="auth__eyebrow">From the demonstration dataset</p>
          <h2 className="auth__proof-title">{situation.name}</h2>
        </div>
        <span className="chip">
          {situation.members.length} people · {hours(situation.hours.committed)} committed
        </span>
      </div>

      <Panel title="Delivered work, per person" hint={`even share ${hours(situation.hours.even)}`} flush>
        <div className="panel__body stack">
          <ShareBar
            segments={situation.members.map((member) => ({ id: member.fullName, name: member.name, hue: member.hue, hours: member.delivered }))}
            height={16}
          />
          {situation.members.map((member) => (
            <LoadBar
              key={member.fullName}
              name={member.fullName}
              hue={member.hue}
              hours={member.delivered}
              even={situation.hours.even}
              capacity={situation.hours.evenCommitted * 2}
              leftLabel={<span style={{ fontSize: "var(--text-xs)" }}>{member.fullName}</span>}
            />
          ))}
        </div>
      </Panel>

      <div className="stack stack--tight">
        <p className="auth__eyebrow">What it says about this group</p>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", lineHeight: 1.5, color: "var(--color-ink-2)" }}>{situation.headline}</p>
        {situation.move ? (
          <div className="callout">
            <strong>{situation.move.taskTitle}</strong> — {hours(situation.move.effort)} from {situation.move.from ?? "nobody"} to{" "}
            {situation.move.to ?? "nobody"}. {situation.move.reason}
          </div>
        ) : null}
      </div>
    </>
  );
}