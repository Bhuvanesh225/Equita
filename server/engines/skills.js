/**
 * Skill matching.
 *
 * Answers one question: how much of a task can this person already do? A person
 * who has not done the exact thing is not a zero — adjacent experience counts,
 * at a stated discount, and the discount is visible in the output so nobody has
 * to trust a black box.
 */
import { transferWeight, SKILL_BY_SLUG } from "../data/skills.js";
import { clamp, round } from "../util.js";

/**
 * @param {Array<{slug:string, weight:number}>} required
 * @param {Map<string,{level:number, appetite:number}>} skills
 * @param {object} [opts]
 * @param {boolean} [opts.allowStretch] allow credit for unproven skills
 */
export function fitSkills(required, skills, opts = {}) {
  const { allowStretch = true } = opts;
  if (!required.length) {
    return { score: 0.5, matched: [], missing: [], notes: ["No particular skill is required for this."], stretch: false };
  }

  const totalWeight = required.reduce((a, r) => a + (r.weight || 1), 0) || 1;
  const matched = [];
  const missing = [];
  const notes = [];
  let earned = 0;
  let stretch = false;

  for (const req of required) {
    const weight = req.weight || 1;
    const own = skills.get(req.slug);

    if (own) {
      // Level does the work; appetite nudges it. Someone who enjoys a thing does
      // it more carefully than someone who merely can.
      const levelPart = (own.level - 1) / 4; // 1..5 -> 0..1
      const appetitePart = (3 - clamp(own.appetite, 1, 5)) / 4; // 1 = loves it -> +0.5
      const coverage = clamp(levelPart + appetitePart * 0.18, 0, 1);
      earned += weight * coverage;
      matched.push({ slug: req.slug, name: nameOf(req.slug), level: own.level, appetite: own.appetite, coverage: round(coverage, 3), via: "direct" });
      continue;
    }

    // Nothing exact. Look for the closest thing they do have.
    let best = null;
    for (const [slug, skill] of skills) {
      const transfer = transferWeight(slug, req.slug);
      if (transfer <= 0) continue;
      const coverage = ((skill.level - 1) / 4) * transfer;
      if (!best || coverage > best.coverage) best = { slug, transfer, coverage, level: skill.level };
    }

    if (best && allowStretch) {
      // Adjacent skill is real evidence, but it is not proof they can do this one.
      const discounted = best.coverage * 0.8;
      earned += weight * discounted;
      stretch = true;
      matched.push({
        slug: req.slug,
        name: nameOf(req.slug),
        level: best.level,
        coverage: round(discounted, 3),
        via: "transfer",
        from: nameOf(best.slug),
      });
      notes.push(`${nameOf(best.slug)} transfers to ${nameOf(req.slug)} at ${Math.round(best.transfer * 100)}%.`);
    } else {
      missing.push({ slug: req.slug, name: nameOf(req.slug) });
    }
  }

  return {
    score: round(earned / totalWeight, 4),
    matched,
    missing,
    notes,
    stretch,
  };
}

function nameOf(slug) {
  return SKILL_BY_SLUG.get(slug)?.name || slug;
}

/** Readable summary of a fit result, used in allocation rationales. */
export function describeFit(fit) {
  if (!fit.matched.length && !fit.missing.length) return "no specific skill needed";
  const strong = fit.matched.filter((m) => m.coverage >= 0.6 && m.via === "direct");
  const weak = fit.matched.filter((m) => m.via === "transfer");
  const parts = [];
  if (strong.length) parts.push(`shows ${strong.map((m) => `${m.name} ${m.level}/5`).join(", ")}`);
  if (weak.length) parts.push(`has ${weak.map((m) => m.from).join(", ")} next to it`);
  if (fit.missing.length) parts.push(`no ${fit.missing.map((m) => m.name.toLowerCase()).join(" or ")}`);
  return parts.join("; ") || "nothing on the list";
}

/**
 * What this person could learn from a task, and whether that is a good use of
 * them. A student is not a fixed resource; the whole point is that they improve.
 */
export function growthOpportunity(required, skills) {
  if (!required.length) return { score: 0, offers: [] };
  const offers = [];
  for (const req of required) {
    const own = skills.get(req.slug);
    const level = own?.level ?? 0;
    if (level > 3) continue; // not a learning opportunity for someone already strong
    const appetite = own?.appetite ?? 3;
    const wantsIt = appetite <= 2; // 1 = enjoys it a lot
    const adjacent = own ? false : hasAdjacent(skills, req.slug);
    if (level === 0 && !adjacent) continue; // too far away to be a favour
    offers.push({ slug: req.slug, name: nameOf(req.slug), level, wantsIt, adjacent, gain: (5 - level) / 5 });
  }
  if (!offers.length) return { score: 0, offers: [] };
  const best = offers.reduce((a, b) => (b.gain + (b.wantsIt ? 0.3 : 0) > a.gain + (a.wantsIt ? 0.3 : 0) ? b : a));
  return {
    score: round(clamp(best.gain * (best.wantsIt ? 1.15 : 0.8), 0, 1), 4),
    offers,
    headline: best.level === 0 ? `first go at ${best.name.toLowerCase()}` : `pushes their ${best.name.toLowerCase()} past ${best.level}/5`,
  };
}

function hasAdjacent(skills, targetSlug) {
  for (const slug of skills.keys()) if (transferWeight(slug, targetSlug) > 0.2) return true;
  return false;
}

/** Every skill the team holds, by strength — the coverage a project can draw on. */
export function teamSkillProfile(members) {
  const totals = new Map();
  for (const member of members) {
    for (const [slug, skill] of member.skills) {
      const entry = totals.get(slug) || { slug, name: nameOf(slug), total: 0, holders: [] };
      entry.total += skill.level;
      entry.holders.push({ id: member.id, name: member.name, level: skill.level });
      totals.set(slug, entry);
    }
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

/** Skills the project needs that only one person can cover — the bus factor. */
export function singlePointsOfFailure(members, requiredSlugs) {
  const profile = teamSkillProfile(members);
  return profile
    .filter((entry) => requiredSlugs.includes(entry.slug))
    .filter((entry) => entry.holders.filter((h) => h.level >= 3).length <= 1)
    .map((entry) => ({ slug: entry.slug, name: entry.name, heldBy: entry.holders.filter((h) => h.level >= 3) }));
}