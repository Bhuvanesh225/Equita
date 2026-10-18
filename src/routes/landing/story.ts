/**
 * The landing page's copy, types and constants.
 *
 * Kept apart from the markup so that every claim on the page sits next to the
 * others and can be checked in one place. Where a sentence states a number, the
 * number comes from the API response; where it states a rule, the rule is the
 * one the engine implements.
 */
import type { StorySituation } from "./types";

export type { Story, StorySituation, StoryMember } from "./types";

/** The five parts of a project's fairness score, in the order they are weighted. */
export const PART_DEFINITIONS: Array<[string, string, string]> = [
  [
    "balance",
    "Balance",
    "Whether delivered work is spread across the group, measured as a Gini coefficient. One person doing nearly everything drives it to zero.",
  ],
  [
    "delivery",
    "Delivery",
    "Whether tasks are landing — partly whether the group is where the calendar says it should be, partly whether things were closed by their date.",
  ],
  [
    "spread",
    "Spread",
    "Whether the work still to be done is spread evenly, as opposed to the next three weeks sitting on one person.",
  ],
  [
    "engagement",
    "Engagement",
    "Whether people are saying anything. Check-ins, comments, and how recently each person last acted, averaged per person so one talkative member cannot hide three silent ones.",
  ],
  [
    "readiness",
    "Readiness",
    "How much of the work is still unassigned or blocked. Both count against the group, because both are the group's to solve.",
  ],
];

export const STATE_LABELS: Record<string, string> = {
  "on-track": "On track",
  carrying: "Carrying too much",
  behind: "Behind",
  quiet: "Gone quiet",
  light: "Light load",
};

export const STATE_KEY: Array<[string, string]> = [
  ["on-track", "holding an even share"],
  ["carrying", "carrying more than their share"],
  ["behind", "owing hours against an even share"],
  ["quiet", "not answering"],
  ["light", "lighter than the rest"],
];

export interface Moment {
  title: string;
  body: string;
  plate?: { src: string; alt: string; caption: string };
}

/**
 * Six moments. Four of them carry a photograph, and each photograph is of the
 * world this product is for — a printed course catalogue, a scanned volume, a
 * school building, a newspaper page. None of them is presented as our screen.
 */
export const MOMENTS: Moment[] = [
  {
    title: "Somebody writes the brief",
    body:
      "What is actually being made, for whom, by when, and how many hours it is worth. It is one page, and it is the page everybody else reads from that point on.",
    plate: {
      src: "/archive/the-oist-1922-14565256198.jpg",
      alt: "A scanned page from a 1922 school volume, dense with type and figures.",
      caption: "A scanned page from a 1922 school annual, via the Internet Archive.",
    },
  },
  {
    title: "The work becomes hours",
    body:
      "The brief is broken into tasks. Every task gets an estimate, a phase, a set of skills it needs, and a date. The total is checked against the hours the group actually has.",
    plate: {
      src: "/archive/course-catalog-1974-14577484449.jpg",
      alt: "A student bent over an open exercise book at a library table, pen in hand, in a halftone photograph.",
      caption: "A student at work, from the 1974 catalogue of Northeastern University.",
    },
  },
  {
    title: "Work goes where the skills are",
    body:
      "Each task is offered to the people who can do it and have room for it, ranked so that the group moves towards an even share rather than away from it. Every suggestion is priced in hours.",
  },
  {
    title: "Everybody can see the split",
    body:
      "One bar for the group. One row each. A tick at the even share. The moment one person's bar runs past the tick and the others do not, it is a conversation, not a discovery at the marking.",
    plate: {
      src: "/archive/csenki-relief-petofistrasse-40-2025-puspokladany.jpg",
      alt: "The gable end of an elementary art school building, its relief in shadow.",
      caption: "An elementary art school in Püspökladány, Hungary.",
    },
  },
  {
    title: "The quiet get noticed early",
    body:
      "Silence is measured as its own state. A student who has stopped checking in is flagged to the group and, if there is a teacher, to the teacher — in week two rather than week nine.",
  },
  {
    title: "The hand-in, with the record behind it",
    body:
      "The group hands in the work. What is left behind is a record of who did what, in hours, with the log to back it up — which is what makes the grade defensible.",
    plate: {
      src: "/archive/the-chicago-sunday-bee-about-books-13.jpg",
      alt: "A full newspaper page about books from October 1946, set in narrow columns.",
      caption: "A page of the Chicago Sunday Bee, 1946. Work, printed and dated.",
    },
  },
];

export const CREDITS = [
  {
    label: "“Course catalog (1974)”",
    href: "https://commons.wikimedia.org/wiki/File:Course_catalog_(1974)_(14577484449).jpg",
    who: "Internet Archive Book Images",
    licence: "no known copyright restrictions",
    licenceHref: "https://www.flickr.com/commons/usage/",
  },
  {
    label: "“The Chicago Sunday Bee About Books, 13 Oct. 1946”",
    href: "https://commons.wikimedia.org/wiki/File:The_Chicago_Sunday_Bee_About_Books_13_Oct._1946.jpg",
    who: "The Chicago Bee",
    licence: "CC0",
    licenceHref: "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
  },
  {
    label: "“Creston National Fish Hatchery Outdoor Classroom Project”",
    href: "https://commons.wikimedia.org/wiki/File:Creston_National_Fish_Hatchey_Outdoor_Classroom_Project_(8024279453).jpg",
    who: "USFWS Mountain Prairie",
    licence: "public domain",
    licenceHref: "https://creativecommons.org/publicdomain/mark/1.0/",
  },
  {
    label: "“The headteacher bringing Syrian refugees and Jordanian students together”",
    href: "https://commons.wikimedia.org/wiki/File:The_headteacher_bringing_Syrian_refugees_and_Jordanian_students_together_(16315504668).jpg",
    who: "DFID — UK Department for International Development",
    licence: "CC BY 2.0",
    licenceHref: "https://creativecommons.org/licenses/by/2.0",
  },
  {
    label: "“Csenki-Relief, Petőfistrasse 40, Püspökladány”",
    href: "https://commons.wikimedia.org/wiki/File:Csenki-Relief,_Pet%C5%91fistrasse_40,_2025_P%C3%BCsp%C3%B6klad%C3%A1ny.jpg",
    who: "Globetrotter19",
    licence: "CC BY-SA 4.0",
    licenceHref: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  {
    label: "“The oist (1922)”",
    href: "https://commons.wikimedia.org/wiki/File:The_oist_(1922)_(14565256198).jpg",
    who: "Internet Archive Book Images",
    licence: "no known copyright restrictions",
    licenceHref: "https://www.flickr.com/commons/usage/",
  },
];

/**
 * The questions in the lower half of the page, answered from the engine's own
 * policy settings rather than from a marketing voice.
 */
export function buildQuestions(situations: StorySituation[]): Array<{ q: string; a: string[] }> {
  const policy = situations[0]?.policy;
  const silence = policy?.silenceDays ?? 7;
  const gap = Math.round((policy?.shareGapFlag ?? 0.35) * 100);
  const freeRider = policy?.freeRiderShare ?? 0.6;
  const gini = situations[0]?.distribution.gini;

  return [
    {
      q: "Is this just a to-do list with colours?",
      a: [
        "No, and the difference is the unit. Everything in Equita is denominated in hours, because “I did loads” and “I did the slides” are arguments, whereas nine hours against an even share of eight is not.",
        "That single choice is what lets the product say “Maya is carrying this group” without anybody's opinion being involved.",
      ],
    },
    {
      q: "How does it decide somebody is carrying too much, or not doing enough?",
      a: [
        `Carrying is arithmetic: more than ${gap} points above an even share of the work taken on, or more than 1.4× an even share of the work delivered. Both are relative to the group, not to an absolute number, and both produce a sentence explaining the figure.`,
        `Falling behind means owing more than an hour against an even share of delivered work while holding under ${Math.round(
          freeRider * 100,
        )}% of what an even share would be. It is only ever applied to delivered work on a project far enough along for delivery to mean something — a third of the commitment genuinely finished.`,
        "Before that point nobody is accused of anything. What the group is judged on is the split of what people took on, which is the only thing that exists yet.",
      ],
    },
    {
      q: "What if someone is away, or ill, or honestly has less time?",
      a: [
        "Everybody sets an honest weekly capacity when they join, and the allocator will not hand work to somebody who is already past it — so the product's own suggestions stop adding to a full week before a person has to say so.",
        `And “gone quiet” is not the same as “behind”. Silence is measured separately, at ${silence} days without a signal, and it is deliberately its own state, because the group that fails is usually the group where somebody stopped answering rather than the group where somebody was slow.`,
      ],
    },
    {
      q: "Does the student see their own numbers?",
      a: [
        "Yes. Every figure a teacher can see, the student can see about themselves, and can see the group's bar as a whole. The suggestion of who should take what is visible too.",
        "This is a deliberate limit: the product is built to start a conversation in a group that is not going well, and a conversation that starts with one party holding information the other does not is not one that goes anywhere.",
      ],
    },
    {
      q: "Does a teacher have to use it the same way a student group does?",
      a: [
        "There are two modes. A group of friends can sign themselves up, with no teacher anywhere in the picture, and get the same allocation and the same equity panel.",
        "A class adds a teacher's view: every group at once, a class-wide policy that is more protective by default — work may not be handed to somebody already over capacity, and a task cannot be closed by the person who did it — plus group formation, which checks the skill coverage of each proposed group rather than leaving it to be discovered later.",
        gini !== undefined
          ? `The three groups shown at the top of this page are scored by exactly this engine, with a spread of Gini from ${situations
              .map((s) => s.distribution.gini.toFixed(2))
              .join(" to ")}.`
          : "",
      ].filter(Boolean),
    },
  ];
}
