/**
 * The skill vocabulary.
 *
 * Broader than "coding / design / writing" on purpose: a group project is won or
 * lost on planning, note-taking, outreach and proofreading just as often as on
 * the headline skills, and a student who is only shown six options picks the one
 * that sounds most impressive.
 *
 * `cluster` groups transferable work, `near` names specific transfers the
 * matcher should credit at a discount when a student has not done the exact
 * thing before.
 */

export const SKILLS = [
  // ---- research -----------------------------------------------------------
  { slug: "research", name: "Research & sources", kind: "discipline", cluster: "research", prompt: "Finding good sources and judging whether they can be trusted" },
  { slug: "reading", name: "Reading & summarising", kind: "practice", cluster: "research", prompt: "Getting through long texts and writing down what matters", near: ["research", "writing"] },
  { slug: "interviews", name: "Interviewing people", kind: "practice", cluster: "research", prompt: "Asking people questions and getting useful answers out of them", near: ["survey", "outreach"] },
  { slug: "survey", name: "Surveys & questionnaires", kind: "practice", cluster: "research", prompt: "Writing questions and collecting responses", near: ["statistics", "spreadsheets"] },
  { slug: "lab", name: "Lab & fieldwork", kind: "practice", cluster: "research", prompt: "Running experiments, taking measurements or collecting samples", near: ["research", "statistics"] },
  { slug: "subject", name: "Subject knowledge", kind: "discipline", cluster: "research", prompt: "Already knowing this subject well" },

  // ---- words --------------------------------------------------------------
  { slug: "writing", name: "Writing", kind: "discipline", cluster: "words", prompt: "Turning notes into prose that reads well" },
  { slug: "editing", name: "Editing & proofreading", kind: "practice", cluster: "words", prompt: "Catching mistakes and making someone else's writing clearer", near: ["writing"] },
  { slug: "presenting", name: "Presenting", kind: "practice", cluster: "words", prompt: "Standing up and talking people through the work", near: ["facilitation"] },
  { slug: "facilitation", name: "Running meetings", kind: "practice", cluster: "people", prompt: "Keeping a discussion on track and getting to a decision", near: ["logistics", "planning"] },
  { slug: "notes", name: "Note-taking & minutes", kind: "practice", cluster: "words", prompt: "Writing down what was decided while it is happening", near: ["writing", "facilitation"] },
  { slug: "languages", name: "Translation & languages", kind: "practice", cluster: "words", prompt: "Working in more than one language", near: ["writing", "editing"] },

  // ---- code ---------------------------------------------------------------
  { slug: "coding", name: "Programming", kind: "discipline", cluster: "code", prompt: "Writing code that works" },
  { slug: "frontend", name: "Front-end & interfaces", kind: "discipline", cluster: "code", prompt: "Building what people see and click", near: ["coding", "ux"] },
  { slug: "backend", name: "Back-end & APIs", kind: "discipline", cluster: "code", prompt: "Servers, data and how the parts talk to each other", near: ["coding"] },
  { slug: "testing", name: "Testing & checking work", kind: "practice", cluster: "code", prompt: "Trying hard to break things before someone else does", near: ["coding", "reviewing"] },
  { slug: "modelling", name: "Mathematical modelling", kind: "discipline", cluster: "data", prompt: "Turning a real situation into equations or a model", near: ["statistics"] },

  // ---- data ---------------------------------------------------------------
  { slug: "analysis", name: "Data analysis", kind: "discipline", cluster: "data", prompt: "Making sense of a dataset" },
  { slug: "statistics", name: "Statistics", kind: "discipline", cluster: "data", prompt: "Deciding whether a result actually means anything", near: ["analysis", "modelling"] },
  { slug: "spreadsheets", name: "Spreadsheets", kind: "tool", cluster: "data", prompt: "Building a solid sheet that does not break", near: ["analysis", "budgeting"] },
  { slug: "visualisation", name: "Charts & visualisation", kind: "practice", cluster: "data", prompt: "Drawing a chart that shows the point clearly", near: ["analysis", "illustration"] },

  // ---- design -------------------------------------------------------------
  { slug: "ux", name: "UX & wireframing", kind: "discipline", cluster: "design", prompt: "Working out what the thing should do before making it look good" },
  { slug: "illustration", name: "Illustration & graphics", kind: "discipline", cluster: "design", prompt: "Drawing things that explain or decorate" },
  { slug: "brand", name: "Brand & visual identity", kind: "practice", cluster: "design", prompt: "Choosing the colours, type and tone so it looks like one thing", near: ["illustration", "ux"] },
  { slug: "slides", name: "Slide design", kind: "practice", cluster: "design", prompt: "Making slides people can actually read", near: ["illustration", "presenting"] },

  // ---- media --------------------------------------------------------------
  { slug: "photovideo", name: "Photo & video", kind: "tool", cluster: "media", prompt: "Filming and shooting, and getting decent light" },
  { slug: "animation", name: "Animation & motion", kind: "tool", cluster: "media", prompt: "Making things move", near: ["illustration", "photovideo"] },
  { slug: "audio", name: "Audio & podcast", kind: "tool", cluster: "media", prompt: "Recording and editing sound", near: ["photovideo"] },

  // ---- making -------------------------------------------------------------
  { slug: "making", name: "Building physical things", kind: "practice", cluster: "make", prompt: "Making models, props, sets or working prototypes by hand", near: ["lab"] },
  { slug: "outreach", name: "Reaching out to people", kind: "practice", cluster: "people", prompt: "Emailing and chasing people you have never met", near: ["interviews", "logistics"] },
  { slug: "logistics", name: "Organising the practical side", kind: "practice", cluster: "people", prompt: "Rooms, transport, kit, timing — the boring things that sink projects", near: ["planning", "facilitation"] },

  // ---- stewardship --------------------------------------------------------
  { slug: "planning", name: "Planning & scheduling", kind: "practice", cluster: "people", prompt: "Splitting the work up and setting dates" },
  { slug: "budgeting", name: "Budgeting", kind: "practice", cluster: "people", prompt: "Keeping track of money and costs", near: ["spreadsheets", "logistics"] },
  { slug: "reviewing", name: "Giving useful feedback", kind: "practice", cluster: "people", prompt: "Telling someone honestly what is not working, kindly", near: ["editing", "testing"] },
  { slug: "documenting", name: "Documenting & handover", kind: "practice", cluster: "people", prompt: "Writing things down so the next person is not stuck", near: ["writing", "notes"] },
];

export const SKILL_BY_SLUG = new Map(SKILLS.map((s) => [s.slug, s]));
export const SKILL_BY_ID = new Map(SKILLS.map((s) => [`skl_${s.slug}`, s]));

export const CLUSTERS = [
  { id: "research", name: "Research", blurb: "Finding out what is true" },
  { id: "words", name: "Words", blurb: "Getting it written and said" },
  { id: "code", name: "Code", blurb: "Building software" },
  { id: "data", name: "Data", blurb: "Numbers into meaning" },
  { id: "design", name: "Design", blurb: "How it looks and reads" },
  { id: "media", name: "Media", blurb: "Picture and sound" },
  { id: "make", name: "Making", blurb: "Things you can hold" },
  { id: "people", name: "Stewardship", blurb: "The work that keeps a team moving" },
];

/** Cluster adjacency: skills in neighbouring clusters transfer partially. */
const NEIGHBOURS = {
  research: ["data", "words"],
  data: ["research", "code"],
  code: ["data", "design"],
  design: ["media", "code"],
  media: ["design"],
  words: ["research", "people"],
  make: ["research"],
  people: ["words"],
};

const TRANSFER = 0.45;

/**
 * How much a student's existing skill substitutes for `targetSlug`.
 * 1 for the skill itself, a discount inside the cluster, a smaller one across
 * neighbouring clusters, 0 otherwise.
 */
export function transferWeight(haveSlug, targetSlug) {
  if (haveSlug === targetSlug) return 1;
  const have = SKILL_BY_SLUG.get(haveSlug);
  const target = SKILL_BY_SLUG.get(targetSlug);
  if (!have || !target) return 0;
  if (have.near?.includes(targetSlug)) return 0.7;
  if (target.near?.includes(haveSlug)) return 0.6;
  if (have.cluster === target.cluster) return TRANSFER;
  if (NEIGHBOURS[have.cluster]?.includes(target.cluster)) return 0.22;
  return 0;
}

export const skillId = (slug) => `skl_${slug}`;
export const slugOf = (id) => String(id).replace(/^skl_/, "");