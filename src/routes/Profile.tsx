/**
 * Your strengths.
 *
 * This screen exists because of one fact about the product: the allocator can
 * only match work to a person if the person has said what they can do and how
 * much time they have. A project full of empty profiles is a project whose
 * allocation is guesswork — so this is not a settings page, it is the input the
 * intelligence layer runs on.
 *
 * Two numbers per skill, and the difference between them is the interesting
 * part. `level` is what somebody can already do; `appetite` is whether they want
 * more of it. The second one is what lets the allocator hand a person work they
 * have never done before without it reading as an imposition.
 *
 * Saves go through `useSession().saveProfile` / `saveSkills` rather than the API
 * directly, so the shell's copy of the person — the rail's name, the capacity
 * beside it — is the same copy this screen just wrote.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useApi, useToast } from "../lib/live";
import { useSession } from "../lib/session";
import { ApiError } from "../lib/api";
import { hours, plural } from "../lib/format";
import { EmptyState, Field, Meter, Panel, Spinner, Tag } from "../components/ui";
import { PageHead, Quiet } from "../components/blocks";
import { SkillPicker } from "./project/TaskForm";
import type { Cluster, MySkill, Skill } from "../lib/types";

/**
 * The hues this product already hands out to people, picked to be far enough
 * apart to tell two avatars apart at 20px. A swatch row rather than a number
 * input, because nobody thinks of their identity as `152`.
 */
const HUES = [8, 32, 48, 88, 128, 152, 172, 196, 240, 264, 300, 340];

const LEVEL_WORDS = ["", "just starting", "getting there", "solid", "strong", "can teach it"];
const APPETITE_WORDS = ["", "rather not", "if needed", "happy to", "want more", "want a lot more"];

interface Catalogue {
  clusters: Cluster[];
  skills: Skill[];
  mine: MySkill[];
}

export default function Profile() {
  const { user, skills: mySkills, clusters, top, loading: sessionLoading, saveProfile, saveSkills } = useSession();
  const catalogue = useApi<Catalogue>("/api/skills");
  const { push } = useToast();

  const [selected, setSelected] = useState<string[]>([]);
  const [meta, setMeta] = useState<Record<string, { level: number; appetite: number }>>({});
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [school, setSchool] = useState("");
  const [capacity, setCapacity] = useState(8);
  const [hue, setHue] = useState(196);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * The form is filled from the session once, and never again. A live refresh of
   * the session — which happens on every server event — must not overwrite what
   * somebody is halfway through typing, so `saved` is the baseline the dirty
   * check compares against, not a value the form re-reads.
   */
  useEffect(() => {
    if (!user || saved !== null) return;
    setName(user.name);
    setHeadline(user.headline ?? "");
    setSchool(user.school ?? "");
    setCapacity(user.capacity);
    setHue(user.hue);
    setSelected(mySkills.map((skill) => skill.slug));
    setMeta(Object.fromEntries(mySkills.map((skill) => [skill.slug, { level: skill.level, appetite: skill.appetite }])));
    setSaved(serialise(user.name, user.headline ?? "", user.school ?? "", user.capacity, user.hue, mySkills));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mySkills, saved]);

  const snapshot = useMemo(
    () =>
      serialise(
        name,
        headline,
        school,
        capacity,
        hue,
        selected.map((slug) => ({ slug, level: meta[slug]?.level ?? 3, appetite: meta[slug]?.appetite ?? 3 })),
      ),
    [name, headline, school, capacity, hue, selected, meta],
  );

  const dirty = saved !== null && snapshot !== saved;
  const cat = catalogue.data;

  if (sessionLoading && !user) {
    return (
      <div className="page">
        <Spinner label="Opening your profile" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <EmptyState
          title="Nobody is signed in"
          text="This page reads and writes your own profile, so it needs to know who you are."
          action={
            <Link className="btn btn--primary" to="/login">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  if (catalogue.loading && !cat) {
    return (
      <div className="page">
        <Spinner label="Reading the skill list" />
      </div>
    );
  }

  if (catalogue.error || !cat) {
    return (
      <div className="page">
        <EmptyState
          title="The skill list did not load"
          text={catalogue.error ?? "The catalogue of skills could not be read just now."}
          action={
            <button type="button" className="btn btn--outline" onClick={catalogue.refresh}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const skillList = cat.skills;
  const bySlug = new Map(skillList.map((skill) => [skill.slug, skill]));
  const paused = user.status && user.status !== "active";

  const setLevel = (slug: string, key: "level" | "appetite", value: number) =>
    setMeta((current) => ({ ...current, [slug]: { level: current[slug]?.level ?? 3, appetite: current[slug]?.appetite ?? 3, [key]: value } }));

  const toggle = (next: string[]) => {
    setSelected(next);
    setMeta((current) => {
      const kept: Record<string, { level: number; appetite: number }> = {};
      for (const slug of next) kept[slug] = current[slug] ?? { level: 3, appetite: 3 };
      return kept;
    });
  };

  const save = async () => {
    if (name.trim().length < 2) {
      setError("Your name needs at least two characters — it is what everybody else sees.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveSkills(selected.map((slug) => ({ slug, level: meta[slug]?.level ?? 3, appetite: meta[slug]?.appetite ?? 3 })));
      await saveProfile({ name: name.trim(), headline: headline.trim(), school: school.trim(), capacity, hue });
      setSaved(
        serialise(
          name.trim(),
          headline.trim(),
          school.trim(),
          capacity,
          hue,
          selected.map((slug) => ({ slug, level: meta[slug]?.level ?? 3, appetite: meta[slug]?.appetite ?? 3 })),
        ),
      );
      push({
        title: "Saved",
        detail: `${plural(selected.length, "strength", "strengths")} and ${hours(capacity)} a week. The allocator will use them from now on.`,
        tone: "good",
      });
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "That did not save.";
      setError(message);
      push({ title: "That did not save", detail: message, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        kicker="What the allocator reads"
        title="Your strengths"
        sub="The allocator matches work to these. Nobody sees a level you did not set yourself, and nothing here is inferred from how much you have done."
        actions={
          <>
            <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? "Saving..." : dirty ? "Save changes" : "Saved"}
            </button>
          </>
        }
      />

      {paused ? (
        <div className="callout callout--over">
          A teacher paused this account, so it will not be handed new work. Everything below is still yours to edit — the adjective is about
          allocation, not about you.
        </div>
      ) : null}

      {error ? (
        <div className="callout callout--risk" role="alert">
          {error}
        </div>
      ) : null}

      <Panel
        title="What you can do"
        hint={`${plural(selected.length, "strength", "strengths")} chosen from the catalogue`}
        stacked
      >
        <div className="stack">
          <SkillPicker
            skills={skillList}
            value={selected}
            onChange={toggle}
            max={40}
            label="Pick the things you can do — three is a fine place to start"
          />

          {selected.length ? (
            <div className="stack stack--tight">
              <span className="label">Then give each one two numbers</span>
              <div className="table-wrap">
                <table className="table" style={{ minWidth: "34rem" }}>
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>What you can do</th>
                    <th>Want more of it</th>
                    <th>
                      <span className="visually-hidden">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((slug) => {
                    const skill = bySlug.get(slug);
                    const entry = meta[slug] ?? { level: 3, appetite: 3 };
                    return (
                      <tr key={slug}>
                        <td>
                          <span className="rowitem__title" style={{ whiteSpace: "normal" }}>
                            {skill?.name ?? slug}
                          </span>
                          <span className="rowitem__sub">{skill ? clusterWord(cat.clusters, skill.cluster) : ""}</span>
                        </td>
                        <td>
                          <label className="field" style={{ gap: "0.15rem" }}>
                            <span className="visually-hidden">{`Level for ${skill?.name ?? slug}`}</span>
                            <select
                              className="select"
                              value={entry.level}
                              aria-label={`How good you are at ${skill?.name ?? slug}`}
                              onChange={(event) => setLevel(slug, "level", Number(event.target.value))}
                            >
                              {[1, 2, 3, 4, 5].map((value) => (
                                <option key={value} value={value}>
                                  {value} · {LEVEL_WORDS[value]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </td>
                        <td>
                          <label className="field" style={{ gap: "0.15rem" }}>
                            <span className="visually-hidden">{`Appetite for ${skill?.name ?? slug}`}</span>
                            <select
                              className="select"
                              value={entry.appetite}
                              aria-label={`Whether you want more ${skill?.name ?? slug}`}
                              onChange={(event) => setLevel(slug, "appetite", Number(event.target.value))}
                            >
                              {[1, 2, 3, 4, 5].map((value) => (
                                <option key={value} value={value}>
                                  {value} · {APPETITE_WORDS[value]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            aria-label={`Remove ${skill?.name ?? slug}`}
                            onClick={() => toggle(selected.filter((item) => item !== slug))}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              title="No strengths set yet"
              text="Pick three from the list above. They are the whole input the allocator has for who should be given what — without them, work can only be placed by hand."
            />
          )}

          <Quiet>
            A level is what you can do today. An appetite is whether you want more of it — marking something low with a high appetite is how you
            ask for work you have not done before.
          </Quiet>
        </div>
      </Panel>

      <div className="grid grid--split">
        <Panel title="How much time you have" hint="hours a week you can give any one group">
          <div className="stack">
            <div className="row row--between" style={{ gap: "1rem" }}>
              <span className="stat__value" style={{ fontSize: "var(--text-xl)" }}>
                {hours(capacity)}
              </span>
              <span className="label">a week</span>
            </div>
            <input
              className="range"
              type="range"
              min={0.5}
              max={60}
              step={0.5}
              value={capacity}
              aria-label="Hours a week"
              onChange={(event) => setCapacity(Number(event.target.value))}
            />
            <p className="card__meta" style={{ lineHeight: 1.55 }}>
              The allocator compares the work you have taken on against this number, and calls anyone past it overloaded. It is a statement of
              your own limit, not a target: a small number honestly given beats a large one that gets everybody's dates moved.
            </p>
          </div>
        </Panel>

        <Panel title="You" hint="what everybody else reads beside your name">
          <div className="stack">
            <Field label="Your name" required htmlFor="profile-name">
              <input id="profile-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="A line about you" hint="Optional. “Happiest in the workshop” tells a group more than a job title.">
              <input className="input" value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="What you are like to work with" />
            </Field>
            <Field label="School" hint="Shown only to people you already share work with.">
              <input className="input" value={school} onChange={(event) => setSchool(event.target.value)} placeholder="Riverside Sixth Form" />
            </Field>
            <Field label="Your colour" hint="How your avatar is drawn wherever your name appears.">
              <div className="row row--wrap" style={{ gap: "0.4rem" }}>
                {HUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="swatch"
                    style={{ background: `hsl(${value} 46% 46%)` }}
                    aria-label={`Colour ${value}`}
                    aria-pressed={hue === value}
                    title={hue === value ? "This is your colour" : "Use this colour"}
                    onClick={() => setHue(value)}
                  />
                ))}
              </div>
            </Field>
          </div>
        </Panel>
      </div>

      <Panel title="Where you are strong" hint="computed from what you entered above — save to update it">
        {clusters.length ? (
          <div className="stack stack--tight">
            {clusters.map((cluster) => (
              <Meter
                key={cluster.cluster}
                label={cluster.name}
                value={(cluster.level / 5) * 100}
                hint={`Self-reported strength ${cluster.level.toFixed(1)} of 5 in ${cluster.name}`}
              />
            ))}
          </div>
        ) : (
          <Quiet>Nothing yet. Pick a few strengths above and save them, and this fills in.</Quiet>
        )}
        {top.length ? (
          <div className="row row--wrap" style={{ gap: "0.35rem", marginTop: "1rem" }}>
            <span className="label">Strongest</span>
            {top.map((skill) => (
              <Tag key={skill.slug} edge title={`Level ${skill.level} of 5 · appetite ${skill.appetite} of 5`}>
                {skill.name} · {skill.level}
              </Tag>
            ))}
          </div>
        ) : null}
        {!clusters.length && !top.length ? (
          <p className="card__meta" style={{ marginTop: "0.75rem", lineHeight: 1.55 }}>
            This panel is the allocator's view of you: the same numbers, after they have been averaged into clusters. Once there is something
            here, a group can be planned around it.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

/* ---------- helpers ------------------------------------------------------ */

function clusterWord(clusters: Cluster[], id: string): string {
  return clusters.find((cluster) => cluster.id === id)?.name ?? id;
}

/**
 * A stable string for the dirty check.
 *
 * The form is "changed" when the numbers a person typed differ from the numbers
 * the server last confirmed — not when a live refresh happened to arrive. That
 * distinction is the difference between a Save button that lights up when you
 * edit it and one that lights up on its own.
 */
function serialise(
  name: string,
  headline: string,
  school: string,
  capacity: number,
  hue: number,
  skills: Array<{ slug: string; level: number; appetite: number }>,
): string {
  const rows = [...skills].sort((a, b) => a.slug.localeCompare(b.slug)).map((skill) => `${skill.slug}:${skill.level}:${skill.appetite}`);
  return [name, headline, school, capacity, hue, ...rows].join("|");
}