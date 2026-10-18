/**
 * The situations the demo data describes.
 *
 * Each project is written as a short spec rather than a list of rows: who is on
 * it, how far along it is, and how the work actually fell out between them. The
 * builder in seed.js turns each spec into tasks, a ledger, check-ins and a
 * history. Keeping the situations separate from the machinery is what makes it
 * possible to add a seventh group without writing any new code.
 */

export const CLASSROOMS = [
  {
    key: "systems",
    name: "Systems Design 2A",
    code: "SYS-2A",
    subject: "Design & Systems",
    term: "Autumn term",
    teacher: "amara",
    policy: {
      // A teacher's defaults are more protective than a self-organised group's.
      policy: { autoAssign: false, allowStretch: true, enforceCapacity: true, requireReview: true, shareGapFlag: 0.3, freeRiderShare: 0.6, silenceDays: 7 },
      weights: { balance: 0.3, delivery: 0.25, spread: 0.2, engagement: 0.15, readiness: 0.1 },
    },
    students: ["maya", "priya", "sam", "noor", "grace", "yusuf", "ana", "tom", "diego", "ravi", "aisha", "kai", "june"],
  },
  {
    key: "media",
    name: "Media Studies 1B",
    code: "MED-1B",
    subject: "Media Studies",
    term: "Autumn term",
    teacher: "tobias",
    policy: {
      policy: { autoAssign: false, allowStretch: true, enforceCapacity: false, requireReview: false, shareGapFlag: 0.35, freeRiderShare: 0.55, silenceDays: 10 },
    },
    students: ["imani", "bruno", "hana", "oliver", "lena"],
  },
];

export const PROJECTS = [
  {
    key: "greenhouse",
    name: "Regenerating the greenhouse site",
    classroom: "systems",
    lead: "maya",
    members: ["maya", "priya", "sam", "noor"],
    dueInDays: 11,
    createdDaysAgo: 34,
    brief:
      "The old greenhouse behind the science block has been shut for four years. Our brief is to research what it could become, work out whether a school can run it, and present a proposal with a costed model and a visual identity for the site. Deliverables: a written proposal with a literature review of similar community growing schemes, a costed analysis with charts, a simple interactive site plan, and a fifteen minute presentation.",
    progress: 0.44,
    // The case the product exists for: one person carrying three others, and one
    // member who is behind on delivered work without ever saying so.
    share: { maya: 2.6, priya: 0.4, sam: 1.0, noor: 1.0 },
    silent: ["priya"],
    lateFraction: 0.35,
    reviews: true,
    note: "the drifting group — Maya is carrying it, Priya is behind on delivered work",
  },
  {
    key: "transit",
    name: "Transit audit for the 42 bus corridor",
    classroom: "systems",
    lead: "grace",
    members: ["grace", "yusuf", "ana", "tom"],
    dueInDays: 11,
    createdDaysAgo: 33,
    brief:
      "Audit the reliability of the 42 bus corridor against the timetable the council publishes. Collect a fortnight of observations, analyse the delay pattern, and produce a report with a recommendation. The report needs a survey of at least sixty regular passengers and a presentation to the transport committee.",
    progress: 0.52,
    // Not a free-rider: someone who is capable and simply not there. The silence
    // is the signal, and it is only visible because everybody checks in.
    share: { grace: 1.9, yusuf: 0.45, ana: 1.0, tom: 1.0 },
    silent: ["tom"],
    lateFraction: 0.2,
    reviews: true,
    unassignedFraction: 0.08,
    note: "the quiet group — Tom has stopped contributing and stopped checking in",
  },
  {
    key: "archive",
    name: "Digitising the school archive",
    classroom: "systems",
    lead: "diego",
    members: ["diego", "ravi", "aisha", "kai"],
    dueInDays: 32,
    createdDaysAgo: 9,
    brief:
      "Catalogue and photograph the school archive, then build a simple searchable site so the collection can be browsed. Produce a short video introduction for the open evening and present the finished catalogue to the archivist.",
    progress: 0.12,
    // Early enough that nothing is unfair yet. What is visible instead is the
    // work nobody has picked up, which is the thing to catch early.
    unassignedFraction: 0.4,
    share: { diego: 1.1, ravi: 0.9, aisha: 1.1, kai: 1.0 },
    lateFraction: 0,
    reviews: false,
    checkinWeeks: 2,
    note: "the early group — forty percent of the work has no owner yet",
  },
  {
    key: "critique",
    name: "Critique panel: mid-term peer review",
    classroom: "systems",
    lead: "grace",
    members: ["maya", "grace", "diego", "noor", "yusuf"],
    dueInDays: 3,
    createdDaysAgo: 14,
    brief:
      "Read the other groups' drafts and write a structured critique of each: what the argument is, where the evidence is thin, and what you would change. Present the combined critique as a written report and a ten minute presentation to the class.",
    progress: 0.3,
    // A short assignment that everybody treats as secondary. It is the reason
    // Maya is over capacity once the audit, the panel and the bike co-op are
    // added up — which is exactly what a teacher cannot see in a checklist.
    share: { maya: 1.7, grace: 1.3, diego: 0.7, noor: 0.8, yusuf: 0.6 },
    silent: [],
    lateFraction: 0.5,
    reviews: false,
    checkinWeeks: 2,
    note: "a short assignment nobody is prioritising, due in three days",
  },
  {
    key: "podcast",
    name: "Podcast pilot: six episodes",
    classroom: "media",
    lead: "imani",
    members: ["imani", "bruno", "hana", "oliver", "lena"],
    dueInDays: 18,
    createdDaysAgo: 26,
    brief:
      "Plan and record a pilot podcast about how the local news covered the flood last spring. Write the script and the running order, interview at least two people who were there, record and edit the episodes, design cover art, and publish a three minute trailer.",
    progress: 0.76,
    // A group that is working. Included so the product is not only a detector of
    // problems: a good group should also be able to see that it is doing well.
    share: { imani: 1.0, bruno: 1.0, hana: 1.0, oliver: 1.0, lena: 1.0 },
    silent: [],
    lateFraction: 0.1,
    reviews: true,
    checkinWeeks: 4,
    note: "a group that is working — included so 'good' is visible too",
  },
  {
    key: "bikecoop",
    name: "Bike co-op website rebuild",
    classroom: null,
    lead: "june",
    members: ["june", "maya", "ana"],
    dueInDays: 24,
    createdDaysAgo: 18,
    brief:
      "The bike co-op's site is eight years old and nobody can update it. Rebuild it: a simple page for opening times and repairs, a way for people to book a slot, a rebuilt booking flow, and a short launch video for their social accounts. The co-op has no budget, so it has to be free to host.",
    progress: 0.34,
    // The independent mode: three friends, no teacher, no class, no grades. The
    // same engines apply, which is the whole point of the dual-mode design.
    share: { june: 1.5, maya: 1.25, ana: 0.6 },
    silent: [],
    lateFraction: 0.25,
    reviews: false,
    checkinWeeks: 3,
    allowStretch: true,
    note: "the independent team — no class, no teacher, same fairness maths",
  },
];

const DEFAULTS = {
  progress: 0.4,
  unassignedFraction: 0.1,
  lateFraction: 0.25,
  checkinWeeks: 3,
  silent: [],
  reviews: false,
  note: "",
  allowStretch: true,
};

export function normalizeStory(story, members = []) {
  const merged = { ...DEFAULTS, ...story };
  // Every member gets a share weight, defaulting to an equal one, so a spec only
  // has to name the people who are unusual.
  const share = {};
  for (const member of members) share[member] = merged.share?.[member] ?? 1;
  return { ...merged, share };
}

export const STORY_BY_KEY = new Map(PROJECTS.map((p) => [p.key, p]));
export const CLASSROOM_BY_KEY = new Map(CLASSROOMS.map((c) => [c.key, c]));