/**
 * Peer review.
 *
 * Three numbers and a sentence per person. The reviews are shown to the teacher
 * rather than to the person reviewed — the point is early intervention, not a
 * public score — and the screen says so, because a student filling this in
 * deserves to know who reads it.
 */
import { useState } from "react";

import { post } from "../../lib/api";
import { ApiError } from "../../lib/api";
import { useApi, useToast } from "../../lib/live";
import { plural, relativeTime } from "../../lib/format";
import { Avatar, EmptyState, Meter, Panel } from "../../components/ui";
import { Quiet } from "../../components/blocks";
import { Dialog } from "../../components/overlays";
import { IconSparkle } from "../../components/icons";
import type { ProjectWorkspace, Review } from "../../lib/types";

const DIMENSIONS: Array<{ key: "reliability" | "quality" | "teamwork"; label: string; blurb: string }> = [
  { key: "reliability", label: "Reliability", blurb: "did they do what they said they would, when they said it" },
  { key: "quality", label: "Quality", blurb: "was the work good enough to build on" },
  { key: "teamwork", label: "Teamwork", blurb: "did they make the group easier to be in" },
];

export function ReviewsPanel({ workspace, onDone }: { workspace: ProjectWorkspace; onDone: () => void }) {
  const { push } = useToast();
  const [subject, setSubject] = useState<{ id: string; name: string; hue: number } | null>(null);
  const [scores, setScores] = useState({ reliability: 3, quality: 3, teamwork: 3 });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const summary = useApi<{
    spread: boolean;
    members: Array<{ id: string; name: string; hue: number; reviews: number; reliability: number; quality: number; teamwork: number; notes: string[] }>;
  }>(workspace.viewer.canTeach ? `/api/projects/${workspace.project.id}/reviews/summary` : null);

  const submit = async () => {
    if (!subject) return;
    setBusy(true);
    try {
      await post(`/api/projects/${workspace.project.id}/reviews`, { subjectId: subject.id, ...scores, note: note.trim() });
      push({ title: `Review of ${subject.name} saved`, detail: "It goes to the teacher, not to them.", tone: "good" });
      setSubject(null);
      setNote("");
      setScores({ reliability: 3, quality: 3, teamwork: 3 });
      summary.refresh();
      onDone();
    } catch (cause) {
      push({ title: "That review did not save", detail: cause instanceof ApiError ? cause.message : undefined, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack stack--loose">
      <Panel title="Who is left to review" hint={workspace.reviews.awaiting.length ? `${plural(workspace.reviews.awaiting.length, "person", "people")}` : "everyone is reviewed"}>
        <div className="stack stack--tight">
          <p className="card__meta" style={{ lineHeight: 1.5 }}>
            A peer review is three numbers and a sentence. It is shared with the teacher rather than with the person reviewed, which is the
            point: it is early intervention, not a public score.
          </p>
          {workspace.reviews.awaiting.length ? (
            <div className="rows">
              {workspace.reviews.awaiting.map((person) => (
                <div key={person.id} className="rowitem" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                  <Avatar name={person.name} hue={person.hue} size="sm" />
                  <span className="rowitem__title">{person.name}</span>
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => setSubject(person)}>
                    <IconSparkle size={12} />
                    Review
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Quiet>You have reviewed everyone on this project. A review can be changed until the project closes.</Quiet>
          )}
        </div>
      </Panel>

      <div className="grid grid--halves">
        <Panel title="Reviews you have given" hint={`${workspace.reviews.mine.length} written`} flush>
          <ReviewsList reviews={workspace.reviews.mine} empty="You have not reviewed anybody yet." />
        </Panel>

        {workspace.viewer.canTeach && summary.data ? (
          <Panel title="What the class said" hint={summary.data.spread ? `${summary.data.members.length} reviewed` : "nothing yet"} flush>
            {summary.data.members.length ? (
              <div className="stack">
                {summary.data.members.map((member) => (
                  <div key={member.id} className="panel__body stack stack--tight" style={{ borderBottom: "1px solid var(--color-line)" }}>
                    <div className="row row--between" style={{ gap: "0.5rem" }}>
                      <span className="row" style={{ gap: "0.4rem" }}>
                        <Avatar name={member.name} hue={member.hue} size="sm" />
                        <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{member.name}</span>
                      </span>
                      <span className="label">{plural(member.reviews, "review")}</span>
                    </div>
                    <Meter label="Reliability" value={(member.reliability / member.reviews) * 20} showValue={false} />
                    <Meter label="Quality" value={(member.quality / member.reviews) * 20} showValue={false} />
                    <Meter label="Teamwork" value={(member.teamwork / member.reviews) * 20} showValue={false} />
                    {member.notes.slice(0, 2).map((text, index) => (
                      <p key={index} className="card__meta" style={{ lineHeight: 1.45 }}>
                        “{text}”
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel__body">
                <Quiet>No reviews have been written on this project yet. The aggregated view appears here as they arrive.</Quiet>
              </div>
            )}
          </Panel>
        ) : (
          <Panel title="Your review of the work" hint="what the teacher sees">
            <Quiet>
              Reviews are collected per person and shown to the teacher who owns the class. On a group you started yourselves, they are
              collected but only you can read your own.
            </Quiet>
          </Panel>
        )}
      </div>

      <Dialog
        open={!!subject}
        onClose={() => setSubject(null)}
        title={subject ? `Review ${subject.name}` : "Review"}
        sub="Three numbers and a sentence. Honest is more useful than kind — this is how a teacher spots someone who needs help."
        width="md"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setSubject(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
              {busy ? "Saving..." : "Save the review"}
            </button>
          </>
        }
      >
        <div className="stack">
          {DIMENSIONS.map((dimension) => (
            <div key={dimension.key} className="stack stack--tight">
              <div className="row row--between">
                <span className="field__label">{dimension.label}</span>
                <span className="label tnum">{scores[dimension.key]} of 5</span>
              </div>
              <input
                className="range"
                type="range"
                min={1}
                max={5}
                step={1}
                value={scores[dimension.key]}
                aria-label={dimension.label}
                onChange={(event) => setScores((current) => ({ ...current, [dimension.key]: Number(event.target.value) }))}
              />
              <span className="field__hint">{dimension.blurb}</span>
            </div>
          ))}
          <label className="field">
            <span className="field__label">Anything worth saying</span>
            <textarea className="textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Carried the writing when the rest of us were stuck." />
          </label>
        </div>
      </Dialog>
    </div>
  );
}

function ReviewsList({ reviews, empty }: { reviews: Review[]; empty: string }) {
  if (!reviews.length) {
    return (
      <div className="panel__body">
        <Quiet>{empty}</Quiet>
      </div>
    );
  }
  return (
    <div className="stack">
      {reviews.map((review) => (
        <div key={review.id} className="panel__body stack stack--tight" style={{ borderBottom: "1px solid var(--color-line)" }}>
          <div className="row row--between" style={{ gap: "0.5rem" }}>
            <span className="row" style={{ gap: "0.4rem" }}>
              <Avatar name={review.reviewerName} hue={0} size="sm" />
              <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{review.reviewerName ?? "someone"}</span>
              <span className="label">reviewed</span>
              <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{review.subjectName ?? "someone"}</span>
            </span>
            <span className="card__meta nowrap">{relativeTime(review.createdAt)}</span>
          </div>
          <div className="row row--wrap" style={{ gap: "0.75rem" }}>
            <span className="label tnum">reliability {review.reliability}/5</span>
            <span className="label tnum">quality {review.quality}/5</span>
            <span className="label tnum">teamwork {review.teamwork}/5</span>
          </div>
          {review.note ? <p className="card__meta" style={{ lineHeight: 1.45 }}>“{review.note}”</p> : null}
        </div>
      ))}
    </div>
  );
}

/** Shown when a project has no members to review at all. */
export function NoReviews() {
  return (
    <EmptyState
      title="Nobody to review"
      text="A peer review needs at least two people on the project. Add somebody to the group and this screen fills in."
    />
  );
}