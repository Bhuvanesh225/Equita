/**
 * Reading a person's profile.
 *
 * The board, the class console and the grouping engine all need the same thing:
 * "how strong is this student across the kinds of work a project asks for".
 * Strength in a cluster is not simply the best single skill — someone with four
 * solid research skills is more useful than someone with one strong one — so the
 * top few in a cluster are combined with a decay.
 */
import { SKILL_BY_SLUG, SKILLS, CLUSTERS } from "../data/skills.js";
import { round } from "../util.js";

const DECAY = [0.6, 0.25, 0.15];

const asMap = (skills) => (skills instanceof Map ? skills : new Map((skills || []).map((s) => [s.slug, s])));

/**
 * @returns {Array<{cluster:string, level:number, skills:Array<{slug:string,level:number,appetite:number}>}>}
 *          sorted strongest first. `level` is 0–5 and may be fractional.
 */
export function clusterStrength(member) {
  const skills = asMap(member.skills);
  const buckets = new Map(CLUSTERS.map((c) => [c.id, []]));
  for (const [slug, value] of skills) {
    const meta = SKILL_BY_SLUG.get(slug);
    if (!meta) continue;
    buckets.get(meta.cluster)?.push({ slug, level: value.level, appetite: value.appetite });
  }
  return CLUSTERS.map((cluster) => {
    const list = (buckets.get(cluster.id) || []).sort((a, b) => b.level - a.level);
    const level = list.reduce((a, entry, index) => a + entry.level * (DECAY[index] ?? 0), 0);
    return { cluster: cluster.id, name: cluster.name, level: round(level, 2), skills: list };
  })
    .filter((entry) => entry.skills.length > 0)
    .sort((a, b) => b.level - a.level || a.cluster.localeCompare(b.cluster));
}

/** The headline skill labels for a person, used on cards and in the roster. */
export function topSkills(member, count = 5) {
  return [...asMap(member.skills).entries()]
    .sort((a, b) => b[1].level - a[1].level || (a[1].appetite ?? 3) - (b[1].appetite ?? 3))
    .slice(0, count)
    .map(([slug, value]) => ({
      slug,
      name: SKILL_BY_SLUG.get(slug)?.name || slug,
      cluster: SKILL_BY_SLUG.get(slug)?.cluster || "core",
      level: value.level,
      appetite: value.appetite,
    }));
}

/** Skills this person enjoys and is middling at — where to point new work. */
export function growthEdges(member, count = 4) {
  return [...asMap(member.skills).entries()]
    .filter(([, value]) => value.appetite <= 2 && value.level <= 3)
    .sort((a, b) => a[1].level - b[1].level)
    .slice(0, count)
    .map(([slug, value]) => ({ slug, name: SKILL_BY_SLUG.get(slug)?.name || slug, level: value.level, appetite: value.appetite }));
}

/**
 * Coverage gaps across a whole roster: which kinds of work the class as a whole
 * cannot staff. Shown to a teacher before groups are built, because it is the
 * difference between a fair assignment and an impossible one.
 */
export function rosterCoverage(roster) {
  const perCluster = new Map(CLUSTERS.map((c) => [c.id, { cluster: c.id, name: c.name, holders: [], levels: [] }]));
  for (const member of roster) {
    for (const { cluster, level } of clusterStrength(member)) {
      const entry = perCluster.get(cluster);
      if (!entry) continue;
      entry.levels.push(level);
      entry.holders.push({ id: member.id, name: member.name, level });
    }
  }
  return [...perCluster.values()].map((entry) => ({
    cluster: entry.cluster,
    name: entry.name,
    holders: entry.holders.length,
    strong: entry.holders.filter((h) => h.level >= 3).length,
    meanLevel: entry.levels.length ? round(entry.levels.reduce((a, b) => a + b, 0) / entry.levels.length, 2) : 0,
    topHolders: entry.holders.sort((a, b) => b.level - a.level).slice(0, 3),
  }));
}

export const TRANSFER_CLUSTERS = SKILLS.reduce((acc, skill) => {
  const list = acc.get(skill.cluster) || [];
  if (!list.includes(skill.slug)) list.push(skill.slug);
  acc.set(skill.cluster, list);
  return acc;
}, new Map());

export { CLUSTERS };