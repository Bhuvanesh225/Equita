/**
 * People.
 *
 * Two screens in one file because they are one idea: find somebody, then read
 * what they are good at. `/people` is the search and `/people/:personId` is the
 * record — the same component, switched on whether a person id is in the route.
 *
 * The default state of the search is not an empty box. The useful question is
 * "who am I working with?", so with no query the screen lists the people on the
 * groups you are already in, taken from the dashboard's own project cards rather
 * than a second endpoint that would answer a different question.
 *
 * The record is deliberately thin, and says so. `GET /api/insights/people/:id`
 * returns strengths, clusters and the groups you share — no hours, no fairness
 * score. The screen explains that in a sentence when you are not teammates,
 * because "why can I not see their hours?" deserves an answer rather than a
 * blank space where a number would be.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { useApi } from "../lib/live";
import { useSession } from "../lib/session";
import { hours, plural } from "../lib/format";
import { EmptyState, Meter, Panel, Spinner, Tag } from "../components/ui";
import { PageHead, PersonRow, Quiet } from "../components/blocks";
import { IconArrowRight, IconSearch } from "../components/icons";
import type { Dashboard, SearchResult } from "../lib/types";

interface PersonCard {
  person: { id: string; name: string; headline: string; hue: number; capacity: number; school?: string | null };
  top: Array<{ slug: string; name: string; cluster: string; level: number; appetite: number }>;
  clusters: Array<{ cluster: string; name: string; level: number }>;
  sharedProjects: Array<{ id: string; name: string }>;
  isTeammate: boolean;
}

export default function People() {
  const { personId } = useParams<{ personId?: string }>();
  return personId ? <PersonRecord personId={personId} /> : <PeopleSearch />;
}

/* ---------- the search --------------------------------------------------- */

function PeopleSearch() {
  const [params, setParams] = useSearchParams();
  const settled = params.get("q") ?? "";
  const [draft, setDraft] = useState(settled);

  useEffect(() => {
    setDraft(settled);
  }, [settled]);

  /*
   * The query lives in the URL so a search is shareable and the back button
   * works, but typing does not write to the URL on every keystroke. The draft is
   * local and settles into the URL after a beat; the request is keyed on the
   * settled value, so one query is one request.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = draft.trim();
      if (next === settled) return;
      const copy = new URLSearchParams(params);
      if (next) copy.set("q", next);
      else copy.delete("q");
      setParams(copy, { replace: true });
    }, 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const searching = settled.trim().length >= 2;
  const search = useApi<{ results: SearchResult[] }>(searching ? `/api/insights/search?q=${encodeURIComponent(settled.trim())}` : null);
  const dashboard = useApi<Dashboard>(searching ? null : "/api/insights/dashboard");

  return (
    <div className="page">
      <PageHead
        kicker="Who is who"
        title="People"
        sub="Search the projects, tasks, classes and people you can already see. A person's record shows what they are good at, and nothing you are not entitled to read."
      />

      <Panel title="Find somebody" hint="two letters is enough">
        <label className="field">
          <span className="field__label">Name, project, task or class</span>
          <span className="search" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="search__icon" aria-hidden="true">
              <IconSearch size={15} />
            </span>
            <input
              className="input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Start typing a name"
              aria-label="Search people, projects, tasks and classes"
              autoFocus
            />
            {draft ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft("")}>
                Clear
              </button>
            ) : null}
          </span>
        </label>
      </Panel>

      {searching ? <SearchResults query={settled} resource={search} /> : <Teammates resource={dashboard} />}

      <Quiet>
        A person's hours belong to them and their teacher. What is public — their strengths, their headline, the groups you already share — is
        all this screen can ever show, and it says when that is the case.
      </Quiet>
    </div>
  );
}

function SearchResults({ query, resource }: { query: string; resource: ReturnType<typeof useApi<{ results: SearchResult[] }>> }) {
  const { data, loading, error, refresh } = resource;

  if (loading && !data) {
    return (
      <Panel title={`Results for “${query}”`}>
        <Spinner label="Searching" />
      </Panel>
    );
  }

  if (error || !data) {
    return (
      <Panel title="That search did not run">
        <EmptyState
          title="The search failed"
          text={error ?? "Something went wrong reading the index."}
          action={
            <button type="button" className="btn btn--outline btn--sm" onClick={refresh}>
              Try again
            </button>
          }
        />
      </Panel>
    );
  }

  const people = data.results.filter((result) => result.kind === "person");
  const rest = data.results.filter((result) => result.kind !== "person");

  if (!data.results.length) {
    return (
      <Panel title={`Nothing matches “${query}”`}>
        <EmptyState
          compact
          title="No results"
          text="The search only looks at what you can already see: your groups, their tasks, your classes and the people in them. Try a shorter word, or a name."
        />
      </Panel>
    );
  }

  return (
    <>
      <Panel title="People" hint={people.length ? plural(people.length, "match", "matches") : "nobody by that name"} flush>
        {people.length ? (
          <div className="rows">
            {people.map((result) => (
              <PersonRow
                key={result.id}
                person={{ id: result.id, name: result.title, hue: result.hue ?? 0 }}
                note={result.subtitle}
                to={`/people/${result.id}`}
                right={<IconArrowRight size={14} />}
              />
            ))}
          </div>
        ) : (
          <div className="panel__body">
            <Quiet>
              No person matches “{query}”. Only people you share a group with are searchable — that is the boundary of this screen, and it is the
              right one.
            </Quiet>
          </div>
        )}
      </Panel>

      {rest.length ? (
        <Panel title="Also found" hint="projects, tasks and classes with that in the name" flush>
          <div className="rows">
            {rest.map((result) => (
              <Link key={`${result.kind}-${result.id}`} className="rowitem" to={result.href} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span style={{ minWidth: 0 }}>
                  <span className="rowitem__title">{result.title}</span>
                  <span className="rowitem__sub">
                    {result.subtitle} · {result.kind}
                  </span>
                </span>
                <IconArrowRight size={14} />
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function Teammates({ resource }: { resource: ReturnType<typeof useApi<Dashboard>> }) {
  const { data, loading, error, refresh } = resource;

  const people = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { id: string; name: string; hue: number; projects: string[] }>();
    for (const card of data.cards) {
      for (const member of card.members ?? []) {
        if (member.id === data.user.id) continue;
        const entry = map.get(member.id) ?? { id: member.id, name: member.name, hue: member.hue, projects: [] };
        if (!entry.projects.includes(card.name)) entry.projects.push(card.name);
        map.set(member.id, entry);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  if (loading && !data) {
    return (
      <Panel title="Who you work with">
        <Spinner label="Reading your groups" />
      </Panel>
    );
  }

  if (error || !data) {
    return (
      <Panel title="Who you work with">
        <EmptyState
          title="That did not load"
          text={error ?? "The list of people on your groups could not be read."}
          action={
            <button type="button" className="btn btn--outline btn--sm" onClick={refresh}>
              Try again
            </button>
          }
        />
      </Panel>
    );
  }

  return (
    <Panel title="Who you work with" hint={people.length ? plural(people.length, "person", "people") : "nobody yet"} flush>
      {people.length ? (
        <div className="rows">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} note={person.projects.join(" · ")} to={`/people/${person.id}`} right={<IconArrowRight size={14} />} />
          ))}
        </div>
      ) : (
        <div className="panel__body">
          <EmptyState
            compact
            title="Nobody on a group with you yet"
            text="Search above finds anyone you share a project with. Once you are on a board with somebody, they appear here too."
            action={
              <Link className="btn btn--primary btn--sm" to="/projects/new">
                Start a group
              </Link>
            }
          />
        </div>
      )}
    </Panel>
  );
}

/* ---------- one person's record ------------------------------------------ */

function PersonRecord({ personId }: { personId: string }) {
  const { user } = useSession();
  const { data, loading, error, status, refresh } = useApi<PersonCard>(`/api/insights/people/${personId}`);

  if (loading && !data) {
    return (
      <div className="page">
        <Spinner label="Reading their record" />
      </div>
    );
  }

  if (status === 404) {
    return (
      <div className="page">
        <EmptyState
          title="Nobody by that name"
          text="That link points at a person who is not in this database. It may be an old link, or a name that was never quite right."
          action={
            <>
              <Link className="btn btn--primary" to="/people">
                Search for somebody
              </Link>
              <Link className="btn btn--outline" to="/today">
                Go to Today
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <EmptyState
          title="That record did not load"
          text={error ?? "Something went wrong reading this person."}
          action={
            <>
              <button type="button" className="btn btn--outline" onClick={refresh}>
                Try again
              </button>
              <Link className="btn btn--primary" to="/people">
                Back to People
              </Link>
            </>
          }
        />
      </div>
    );
  }

  const { person, top, clusters, sharedProjects, isTeammate } = data;
  const own = user?.id === person.id;

  return (
    <div className="page">
      <PageHead
        kicker={
          <Link className="tap" to="/people">
            People
          </Link>
        }
        title={person.name}
        sub={
          <>
            {person.headline || "no headline yet"} · {hours(person.capacity)} a week
            {person.school ? ` · ${person.school}` : ""}
          </>
        }
        actions={
          own ? (
            <Tag tone="accent" dot title="This is your own record">
              this is you
            </Tag>
          ) : isTeammate ? (
            <Tag tone="accent" dot title="You are on a project together">
              on a group with you
            </Tag>
          ) : (
            <Tag edge title="You do not share a project, so their hours are not shown">
              not a teammate
            </Tag>
          )
        }
      />

      <div className="grid grid--split">
        <Panel title="Where they are strong" hint={`${plural(clusters.length, "cluster")} from their own profile`}>
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
            <Quiet>They have not set any strengths yet, so there is nothing to match work against.</Quiet>
          )}
        </Panel>

        <Panel title="Their strongest skills" hint="top six, as they set them">
          {top.length ? (
            <div className="row row--wrap" style={{ gap: "0.35rem" }}>
              {top.map((skill) => (
                <Tag key={skill.slug} edge title={`Level ${skill.level} of 5 · appetite ${skill.appetite} of 5`}>
                  {skill.name} · {skill.level}
                </Tag>
              ))}
            </div>
          ) : (
            <Quiet>No skills listed. Until somebody fills their strengths in, the allocator has nothing to match them to.</Quiet>
          )}
        </Panel>
      </div>

      <Panel
        title={own ? "Your groups" : isTeammate ? "Groups you share" : "What you can see, and why"}
        hint={own || isTeammate ? plural(sharedProjects.length, "group") : "the boundary is deliberate"}
      >
        {own || isTeammate ? (
          <div className="rows">
            {sharedProjects.map((project) => (
              <Link key={project.id} className="rowitem" to={`/projects/${project.id}`} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span className="rowitem__title" style={{ gridColumn: "1 / -1" }}>
                  {project.name}
                </span>
                <span className="rowitem__sub">Open the board — the hours are on it, {own ? "yours" : "theirs"} along with everybody else's</span>
                <IconArrowRight size={14} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="stack stack--tight">
            <p style={{ fontSize: "var(--text-base)", lineHeight: 1.6, maxWidth: "70ch" }}>
              You are not on a project with {person.name.split(" ")[0]}, so this screen shows what is public — the strengths they set
              themselves, and the headline they wrote. Their hours, their check-ins and the reviews of their work are theirs, and their
              teacher's.
            </p>
            <p className="card__meta" style={{ lineHeight: 1.6 }}>
              That is the whole reason the fairness score exists: it turns the question "who is carrying this?" into a number the group can
              argue with, without turning any single person's week into public reading.
            </p>
          </div>
        )}
      </Panel>

      {!clusters.length && !top.length ? (
        <Panel>
          <EmptyState
            compact
            title="An empty profile"
            text={`${person.name} has not filled their strengths in yet. That is the one input the allocator cannot invent — until it is there, work can only be placed by hand.`}
          />
        </Panel>
      ) : null}
    </div>
  );
}
