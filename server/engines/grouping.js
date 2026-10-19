/**
 * Group formation.
 *
 * A teacher with thirty students and six weeks does not want to hand-pick eight
 * teams by eye and quietly give the strongest coder three weak teammates. This
 * builds teams that each cover the skills the assignment needs, that are close
 * to each other in total strength, and that do not all lean on the same person.
 *
 * Greedy placement, then a bounded local search. Deterministic for a given seed,
 * so re-running with the same number gives the same teams and a teacher can
 * explain the result to a class.
 */
import { TRANSFER_CLUSTERS, clusterStrength } from "./profiles.js";
import { CLUSTERS } from "../data/skills.js";
import { clamp, round, mean } from "../util.js";

/** Small deterministic PRNG so a seed reproduces the same teams. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STRENGTH_OF = (member) =>
  [...member.skills.values()]
    .map((s) => s.level)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((a, b) => a + b, 0);

const DOMINANT_CLUSTER = (member) => {
  const strengths = clusterStrength(member);
  return strengths[0]?.cluster ?? "core";
};

function evaluate(teams, requiredClusters, weights) {
  if (!teams.length) return { objective: 0, parts: {} };

  // Coverage: how well each team can meet the clusters the assignment needs.
  let coverage = 0;
  if (requiredClusters.length) {
    for (const team of teams) {
      let teamCoverage = 0;
      for (const cluster of requiredClusters) {
        const best = Math.max(0, ...team.map((m) => (clusterStrength(m).find((c) => c.cluster === cluster)?.level ?? 0)));
        teamCoverage += clamp(best / 4, 0, 1);
      }
      coverage += teamCoverage / requiredClusters.length;
    }
    coverage /= teams.length;
  } else {
    coverage = 1;
  }

  const strengths = teams.map((team) => team.reduce((a, m) => a + STRENGTH_OF(m), 0));
  const caps = teams.map((team) => team.reduce((a, m) => a + m.capacity, 0));
  const cv = (xs) => {
    const mu = mean(xs);
    if (!mu) return 1;
    return Math.sqrt(mean(xs.map((x) => (x - mu) ** 2))) / mu;
  };
  const strengthBalance = clamp(1 - cv(strengths) / 0.5, 0, 1);
  const capacityBalance = clamp(1 - cv(caps) / 0.5, 0, 1);

  // Diversity: teams should not all be one kind of person. Measured as the share
  // of distinct dominant clusters inside a team.
  const diversity = mean(
    teams.map((team) => {
      if (team.length <= 1) return 1;
      const clusters = team.map(DOMINANT_CLUSTER);
      return new Set(clusters).size / Math.min(team.length, CLUSTERS.length);
    }),
  );

  const parts = { coverage: round(coverage, 4), strengthBalance: round(strengthBalance, 4), capacityBalance: round(capacityBalance, 4), diversity: round(diversity, 4) };
  const objective = Object.entries(parts).reduce((a, [key, value]) => a + value * (weights[key] ?? 0), 0);
  return { objective: round(objective, 5), parts };
}

/**
 * @param {Array} roster    hydrated members from loadRoster()
 * @param {object} opts
 * @param {number} [opts.teams]            exact number of teams
 * @param {number} [opts.size]             or a target size, teams derived from it
 * @param {string[]} [opts.requiredClusters]
 * @param {number} [opts.seed]
 * @param {number} [opts.iterations]       local-search budget
 */
export function formGroups(roster, opts = {}) {
  const { teams: wantedTeams, size = 4, requiredClusters = [], seed = 20261018, iterations = 1600 } = opts;
  const weights = { coverage: 0.45, strengthBalance: 0.25, capacityBalance: 0.15, diversity: 0.15 };
  const people = [...roster];

  if (people.length < 2) {
    return { teams: people.length ? [{ name: "Group 1", members: people.map(decorate), ...teamStats([people], requiredClusters) }] : [], objective: 0, notes: ["Not enough students to form groups."], gaps: [], unplaced: [] };
  }

  const k = clamp(wantedTeams ?? Math.ceil(people.length / Math.max(2, size)), 2, Math.max(2, Math.floor(people.length / 1)));
  const rand = mulberry32(seed);
  const teams = Array.from({ length: k }, () => []);

  // Seed each team with a strong student of a different dominant cluster where
  // possible, so the strongest people do not end up together.
  const byStrength = [...people].sort((a, b) => STRENGTH_OF(b) - STRENGTH_OF(a) || a.name.localeCompare(b.name));
  const usedClusters = new Set();
  for (let i = 0; i < k && byStrength.length; i++) {
    let pickIndex = byStrength.findIndex((p) => !usedClusters.has(DOMINANT_CLUSTER(p)));
    if (pickIndex === -1) pickIndex = 0;
    const [picked] = byStrength.splice(pickIndex, 1);
    usedClusters.add(DOMINANT_CLUSTER(picked));
    teams[i].push(picked);
  }

  // Place the rest, always into the team where they help most.
  const remaining = [...byStrength];
  while (remaining.length) {
    let bestMove = null;
    for (let i = 0; i < remaining.length; i++) {
      for (let t = 0; t < k; t++) {
        const before = evaluate(teams, requiredClusters, weights).objective;
        const candidateTeams = teams.map((team, index) => (index === t ? [...team, remaining[i]] : team));
        const after = evaluate(candidateTeams, requiredClusters, weights).objective;
        const sizePenalty = teams[t].length / Math.max(1, people.length / k);
        const gain = after - before - sizePenalty * 0.02;
        if (!bestMove || gain > bestMove.gain + 1e-9) bestMove = { personIndex: i, team: t, gain };
      }
    }
    if (!bestMove) break;
    const [person] = remaining.splice(bestMove.personIndex, 1);
    teams[bestMove.team].push(person);
    // A little noise keeps the order of placement from hardening into a pattern.
    if (rand() < 0.02) remaining.sort(() => rand() - 0.5);
  }

  // Local search: swap pairs of students between teams when it improves things.
  let current = teams.map((t) => [...t]);
  let bestScore = evaluate(current, requiredClusters, weights).objective;
  for (let step = 0; step < iterations; step++) {
    const a = Math.floor(rand() * k);
    const b = Math.floor(rand() * k);
    if (a === b || !current[a].length || !current[b].length) continue;
    const i = Math.floor(rand() * current[a].length);
    const j = Math.floor(rand() * current[b].length);
    const candidate = current.map((t) => [...t]);
    [candidate[a][i], candidate[b][j]] = [candidate[b][j], candidate[a][i]];
    const score = evaluate(candidate, requiredClusters, weights).objective;
    if (score > bestScore) {
      current = candidate;
      bestScore = score;
    }
  }

  const scored = current.map((members, index) => ({
    id: `group_${index + 1}`,
    name: `Group ${index + 1}`,
    members: [...members].sort((a, b) => STRENGTH_OF(b) - STRENGTH_OF(a) || a.name.localeCompare(b.name)).map(decorate),
    ...teamStats(members, requiredClusters),
  }));

  const evaluation = evaluate(current, requiredClusters, weights);
  const sizes = current.map((t) => t.length);
  const notes = [];
  notes.push(`${people.length} students into ${k} groups of ${Math.min(...sizes)} to ${Math.max(...sizes)}.`);
  if (requiredClusters.length) {
    notes.push(`Each group covers ${requiredClusters.map((c) => CLUSTERS.find((x) => x.id === c)?.name || c).join(", ")}.`);
  }
  const weakest = [...scored].sort((a, b) => a.coverage - b.coverage)[0];
  if (weakest) notes.push(`${weakest.name} is the least covered group — worth a look before you commit these.`);
  notes.push("Names are a placeholder; rename them however your class prefers.");

  return {
    teams: scored,
    objective: evaluation.objective,
    parts: evaluation.parts,
    sizeRange: [Math.min(...sizes), Math.max(...sizes)],
    notes,
    gaps: classGaps(roster, requiredClusters),
    balanced: evaluation.parts.strengthBalance > 0.7,
    seed,
  };
}

function decorate(member) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    headline: member.headline,
    hue: member.hue,
    capacity: member.capacity,
    strength: STRENGTH_OF(member),
    dominant: DOMINANT_CLUSTER(member),
    topSkills: [...member.skills.entries()]
      .sort((a, b) => b[1].level - a[1].level)
      .slice(0, 4)
      .map(([slug, s]) => ({ slug, level: s.level })),
    /*
     * Their level in every cluster, which is what `teamStats()` reads to build a
     * group's coverage. The group builder lets a teacher drag somebody between
     * groups, and the preview endpoint has no way to be told "keep this person
     * here" — so the screen has to recompute one group's coverage itself. Sending
     * the levels is what lets it do that with the engine's own numbers instead
     * of a second, nearly-identical formula.
     */
    clusters: clusterStrength(member).map((entry) => ({ cluster: entry.cluster, name: entry.name, level: entry.level })),
  };
}

function teamStats(members, requiredClusters) {
  const coverage = {};
  for (const cluster of CLUSTERS) {
    const best = Math.max(0, ...members.map((m) => clusterStrength(m).find((c) => c.cluster === cluster.id)?.level ?? 0));
    coverage[cluster.id] = best;
  }
  const strengths = members.map(STRENGTH_OF);
  return {
    size: members.length,
    coverage,
    requiredCoverage: requiredClusters.length
      ? round(mean(requiredClusters.map((c) => clamp((coverage[c] ?? 0) / 4, 0, 1))), 3)
      : 1,
    totalStrength: strengths.reduce((a, b) => a + b, 0),
    meanStrength: round(mean(strengths), 2),
    totalCapacity: round(members.reduce((a, m) => a + m.capacity, 0), 1),
    weakestCluster: Object.entries(coverage).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null,
    roles: suggestRoles(members),
  };
}

/**
 * Suggest who does what inside a team, choosing distinct people so one strong
 * student is not nominated for every role.
 */
export function suggestRoles(members) {
  const wanted = [
    { id: "coordinator", label: "Keeps it moving", skills: ["planning", "facilitation", "logistics"] },
    { id: "researcher", label: "Finds things out", skills: ["research", "reading", "interviews", "survey"] },
    { id: "builder", label: "Makes the thing", skills: ["coding", "making", "frontend", "backend", "modelling"] },
    { id: "designer", label: "Makes it clear", skills: ["illustration", "brand", "ux", "visualisation", "slides"] },
    { id: "writer", label: "Writes it up", skills: ["writing", "editing", "notes", "documenting"] },
    { id: "presenter", label: "Says it out loud", skills: ["presenting", "slides", "audio", "photovideo"] },
  ];
  const taken = new Set();
  const out = [];
  for (const role of wanted) {
    let best = null;
    for (const member of members) {
      if (taken.has(member.id)) continue;
      const score = member.skills
        ? role.skills.reduce((a, slug) => a + (member.skills.get(slug)?.level ?? 0), 0)
        : (member.topSkills || []).filter((s) => role.skills.includes(s.slug)).reduce((a, s) => a + s.level, 0);
      if (score > 0 && (!best || score > best.score)) best = { member, score };
    }
    if (best) {
      taken.add(best.member.id);
      out.push({ role: role.id, label: role.label, memberId: best.member.id, name: best.member.name, strength: best.score });
    }
  }
  return out;
}

/** Whole-class gaps: clusters nobody is strong in. Worth teaching before assigning. */
export function classGaps(roster, requiredClusters) {
  const perCluster = new Map();
  for (const member of roster) {
    for (const { cluster, level } of clusterStrength(member)) {
      const entry = perCluster.get(cluster) || { cluster, strong: 0, total: 0, levels: [] };
      if (level >= 3) entry.strong++;
      entry.total++;
      entry.levels.push(level);
      perCluster.set(cluster, entry);
    }
  }
  return [...perCluster.values()]
    .map((entry) => ({
      cluster: entry.cluster,
      name: CLUSTERS.find((c) => c.id === entry.cluster)?.name || entry.cluster,
      strong: entry.strong,
      meanLevel: round(mean(entry.levels), 2),
      needed: requiredClusters.includes(entry.cluster),
    }))
    .filter((entry) => entry.strong <= Math.max(1, Math.floor(roster.length * 0.12)))
    .sort((a, b) => a.meanLevel - b.meanLevel);
}

export { TRANSFER_CLUSTERS };