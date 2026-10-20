/**
 * The planning library.
 *
 * A brief is prose. These patterns turn that prose into a task list with real
 * effort estimates, ordered phases and the skills each piece needs. It is a
 * keyword-and-weight system, not a model: every task it produces can be traced
 * back to the words in the brief that caused it, which is what makes the result
 * editable rather than magic.
 *
 * `load` is a relative unit of effort, not hours. The planner scales every
 * pattern's loads against the hours the team actually has.
 */

export const PHASES = [
  { id: "discover", name: "Discover", blurb: "Work out what the question really is" },
  { id: "define", name: "Decide", blurb: "Agree the shape of the thing before building it" },
  { id: "build", name: "Build", blurb: "The long middle" },
  { id: "review", name: "Check", blurb: "Read it, test it, rehearse it" },
  { id: "ship", name: "Hand in", blurb: "Assemble and submit" },
];

/** Where in the timeline each phase sits, as a fraction of time remaining. */
export const PHASE_WINDOW = {
  discover: [0.0, 0.22],
  define: [0.15, 0.38],
  build: [0.3, 0.82],
  review: [0.7, 0.95],
  ship: [0.88, 1.0],
};

export const PATTERNS = [
  {
    id: "research",
    match: ["research", "sources", "literature", "background", "reading", "evidence", "investigate", "secondary"],
    tasks: [
      { title: "Agree the research question", detail: "One sentence everyone signs off on. Everything else hangs off it.", phase: "discover", load: 2, skills: [["planning", 3], ["subject", 1]] },
      { title: "Find and shortlist sources", detail: "Aim for more than you need, then cut to the ones worth citing.", phase: "discover", load: 5, skills: [["research", 3], ["reading", 2]] },
      { title: "Annotate the shortlist", detail: "Two lines per source: what it claims, and whether you believe it.", phase: "discover", load: 4, skills: [["reading", 3], ["writing", 2]] },
    ],
  },
  {
    id: "literature",
    match: ["literature review", "lit review", "prior work", "state of the art", "existing solutions"],
    tasks: [
      { title: "Theme the literature", detail: "Group the sources into three or four arguments, not one summary after another.", phase: "define", load: 4, skills: [["research", 3], ["reading", 2]] },
      { title: "Write the literature section", detail: "Lead with the argument each theme makes, then the evidence.", phase: "build", load: 6, skills: [["writing", 3], ["editing", 2]] },
    ],
  },
  {
    id: "survey",
    match: ["survey", "questionnaire", "respondents", "participants", "sample", "pilot"],
    tasks: [
      { title: "Draft the questionnaire", detail: "Short test first, then cut every question that does not change a decision.", phase: "define", load: 3, skills: [["survey", 3], ["subject", 1]] },
      { title: "Recruit and collect responses", detail: "Realistically this takes longer than the analysis. Start it first.", phase: "build", load: 4, skills: [["outreach", 3], ["logistics", 2]] },
      { title: "Clean and analyse responses", detail: "Check who is missing from the sample before you report any percentage.", phase: "build", load: 4, skills: [["analysis", 3], ["statistics", 2]] },
    ],
  },
  {
    id: "interviews",
    match: ["interview", "focus group", "stakeholder", "user testing", "workshop", "consultation"],
    tasks: [
      { title: "Write the interview guide", detail: "Open questions, and a plan for what happens when someone goes quiet.", phase: "define", load: 3, skills: [["interviews", 3], ["planning", 1]] },
      { title: "Book and run the interviews", detail: "Two people per session: one asking, one writing.", phase: "build", load: 5, skills: [["interviews", 2], ["outreach", 2], ["notes", 2]] },
      { title: "Code the transcripts", detail: "Pull the quotes that actually support or break the argument.", phase: "build", load: 4, skills: [["analysis", 3], ["reading", 2]] },
    ],
  },
  {
    id: "data",
    match: ["data", "dataset", "analysis", "statistics", "trend", "metric", "csv", "experiment", "results"],
    tasks: [
      { title: "Clean the dataset", detail: "Document every row you drop and why. This is the step that eats a week.", phase: "build", load: 5, skills: [["analysis", 3], ["spreadsheets", 2]] },
      { title: "Run the analysis", detail: "Answer the research question first; save the interesting side-findings for later.", phase: "build", load: 6, skills: [["statistics", 3], ["analysis", 2]] },
      { title: "Draw the charts", detail: "One chart per claim. If a chart needs explaining, redraw it.", phase: "build", load: 4, skills: [["visualisation", 3], ["illustration", 1]] },
    ],
  },
  {
    id: "code",
    match: ["app", "application", "software", "code", "program", "prototype", "website", "site", "system", "tool", "platform", "game", "script", "api"],
    tasks: [
      { title: "Agree what it does and what it does not", detail: "Write the three things it must do. Cut everything else now, not later.", phase: "define", load: 3, skills: [["planning", 3], ["subject", 1]] },
      { title: "Sketch the screens and the data", detail: "Rough boxes on paper, and the shape of the data underneath them.", phase: "define", load: 4, skills: [["ux", 3], ["illustration", 1]] },
      { title: "Build the core", detail: "The one path that has to work for the demo. Everything else is decoration.", phase: "build", load: 10, skills: [["coding", 3], ["backend", 2]] },
      { title: "Build the interface", detail: "Make it usable on the machine it will actually be shown on.", phase: "build", load: 8, skills: [["frontend", 3], ["ux", 2]] },
      { title: "Test it and fix what breaks", detail: "Give it to someone who has not seen it and say nothing.", phase: "review", load: 4, skills: [["testing", 3], ["reviewing", 1]] },
    ],
  },
  {
    id: "presentation",
    match: ["present", "presentation", "slides", "pitch", "demo", "viva", "talk", "defend", "showcase"],
    tasks: [
      { title: "Agree the story", detail: "Four beats: what we asked, what we did, what we found, what it means.", phase: "review", load: 3, skills: [["planning", 2], ["presenting", 2]] },
      { title: "Build the slides", detail: "One idea per slide. The slide is not the script.", phase: "review", load: 5, skills: [["slides", 3], ["illustration", 2]] },
      { title: "Write the script and the answers", detail: "Include the three hardest questions you expect, and who answers them.", phase: "review", load: 3, skills: [["writing", 2], ["presenting", 2]] },
      { title: "Rehearse out loud, timed", detail: "Twice, standing up, with a timer. It always runs long.", phase: "review", load: 3, skills: [["presenting", 3], ["facilitation", 1]] },
    ],
  },
  {
    id: "report",
    match: ["report", "essay", "write-up", "write up", "dissertation", "paper", "assignment", "documentation", "handbook"],
    tasks: [
      { title: "Agree the structure and word budget", detail: "Headings first, and how many words each gets. Then nobody writes 4,000 alone.", phase: "define", load: 3, skills: [["planning", 3], ["writing", 1]] },
      { title: "Write the first draft", detail: "Get it long and rough. Do not edit while drafting.", phase: "build", load: 9, skills: [["writing", 3], ["subject", 2]] },
      { title: "Edit to a single voice", detail: "One person reads every section against the others so it stops sounding like four people.", phase: "build", load: 5, skills: [["editing", 3], ["writing", 2]] },
      { title: "Check citations and references", detail: "Every claim traced, every citation formatted the same way.", phase: "review", load: 3, skills: [["editing", 2], ["research", 2]] },
    ],
  },
  {
    id: "video",
    match: ["video", "film", "documentary", "footage", "short film", "edit"],
    tasks: [
      { title: "Write the treatment and shot list", detail: "What each shot is for. Shoots without a list always need a second day.", phase: "define", load: 4, skills: [["writing", 2], ["photovideo", 2]] },
      { title: "Shoot", detail: "Book the kit, the people and the room before anything else.", phase: "build", load: 7, skills: [["photovideo", 3], ["logistics", 2]] },
      { title: "Edit and mix sound", detail: "Rough cut, then cut it again by a fifth. Then mix.", phase: "build", load: 8, skills: [["photovideo", 3], ["audio", 2], ["animation", 1]] },
    ],
  },
  {
    id: "podcast",
    match: ["podcast", "audio", "radio", "episode", "sound design"],
    tasks: [
      { title: "Plan the episode and running order", detail: "Timings per segment, and a plan for a guest who talks too long.", phase: "define", load: 3, skills: [["planning", 2], ["audio", 1]] },
      { title: "Record", detail: "Test the levels twice. Bad audio cannot be rescued later.", phase: "build", load: 4, skills: [["audio", 3]] },
      { title: "Edit and mix", detail: "Cut for pace, then add music and credits.", phase: "build", load: 6, skills: [["audio", 3], ["animation", 1]] },
    ],
  },
  {
    id: "poster",
    match: ["poster", "infographic", "exhibition", "display", "print", "zine", "leaflet", "visual identity"],
    tasks: [
      { title: "Work out what a passer-by must take away", detail: "One sentence, readable from two metres.", phase: "define", load: 3, skills: [["brand", 3], ["writing", 1]] },
      { title: "Design the layout", detail: "Grid, then type, then colour. In that order.", phase: "build", load: 7, skills: [["illustration", 3], ["brand", 2]] },
      { title: "Prepare the print files", detail: "Bleed, resolution, colour profile. Ask the print room before you send.", phase: "ship", load: 3, skills: [["illustration", 2], ["logistics", 2]] },
    ],
  },
  {
    id: "make",
    match: ["model", "physical", "wood", "3d print", "prop", "robot", "device", "machinery", "sculpture"],
    tasks: [
      { title: "Draw the plan and cost the materials", detail: "Include what you cannot get locally, and order it early.", phase: "define", load: 4, skills: [["planning", 2], ["budgeting", 2], ["making", 1]] },
      { title: "Make the thing", detail: "Mock-up in cheap material first, then the real one.", phase: "build", load: 10, skills: [["making", 3], ["modelling", 1]] },
      { title: "Test it and iterate", detail: "Break it on purpose. Write down what failed.", phase: "review", load: 4, skills: [["testing", 2], ["making", 2]] },
    ],
  },
  {
    id: "business",
    match: ["business plan", "startup", "market", "revenue", "pricing", "customers", "venture", "commercial"],
    tasks: [
      { title: "Size the market with real numbers", detail: "Bottom-up from something you can source, not a headline figure.", phase: "define", load: 5, skills: [["research", 3], ["analysis", 2]] },
      { title: "Build the financial model", detail: "Assumptions on one page, so a sceptical reader can change them.", phase: "build", load: 6, skills: [["spreadsheets", 3], ["budgeting", 3]] },
      { title: "Talk to five possible customers", detail: "Ask what they do now, not whether they would buy it.", phase: "build", load: 5, skills: [["interviews", 3], ["outreach", 2]] },
    ],
  },
  {
    id: "budget",
    match: ["budget", "cost", "funding", "sponsorship", "expenses", "grant"],
    tasks: [
      { title: "Build the budget", detail: "Every line has an owner and a quote behind it.", phase: "define", load: 3, skills: [["budgeting", 3], ["spreadsheets", 2]] },
      { title: "Chase quotes and receipts", detail: "Keep every receipt the day you get it.", phase: "build", load: 3, skills: [["outreach", 2], ["logistics", 2], ["budgeting", 1]] },
    ],
  },
  {
    id: "event",
    match: ["event", "show", "performance", "launch", "conference", "festival", "fundraiser"],
    tasks: [
      { title: "Set the date, place and running order", detail: "Everything downstream depends on these three.", phase: "define", load: 4, skills: [["logistics", 3], ["planning", 2]] },
      { title: "Book and confirm everything", detail: "Get confirmations in writing, and a phone number.", phase: "build", load: 5, skills: [["outreach", 3], ["logistics", 2]] },
      { title: "Run the day", detail: "One person runs it, one person fixes whatever is going wrong behind them.", phase: "ship", load: 5, skills: [["facilitation", 3], ["logistics", 2]] },
    ],
  },
  {
    id: "lab",
    match: ["lab", "fieldwork", "field work", "measurement", "specimen", "trial", "protocol"],
    tasks: [
      { title: "Write the protocol", detail: "So that someone else could repeat it exactly, including the mistakes.", phase: "define", load: 4, skills: [["lab", 2], ["writing", 2], ["planning", 1]] },
      { title: "Book the equipment and the time", detail: "Lab slots go first. Book before you plan anything else.", phase: "define", load: 2, skills: [["logistics", 3]] },
      { title: "Run the trials", detail: "Record everything, including the runs that failed. Those are results too.", phase: "build", load: 8, skills: [["lab", 3], ["notes", 2]] },
      { title: "Analyse and plot the results", detail: "State the uncertainty on every number you report.", phase: "build", load: 5, skills: [["statistics", 3], ["visualisation", 2]] },
    ],
  },
  {
    id: "debate",
    match: ["debate", "argument", "case for", "moot", "position paper", "policy"],
    tasks: [
      { title: "Build both sides of the case", detail: "You cannot argue against something you have not tried to believe.", phase: "discover", load: 4, skills: [["research", 3], ["reading", 2]] },
      { title: "Write the position paper", detail: "Claim, evidence, rebuttal. One page.", phase: "build", load: 5, skills: [["writing", 3], ["subject", 2]] },
      { title: "Prepare for cross-examination", detail: "List the ten questions that would hurt most.", phase: "review", load: 3, skills: [["presenting", 3], ["subject", 2]] },
    ],
  },
  {
    id: "teaching",
    match: ["teach", "lesson", "tutorial", "workshop for", "curriculum", "explain"],
    tasks: [
      { title: "Decide what they will be able to do afterwards", detail: "One observable sentence. Then cut everything that does not serve it.", phase: "define", load: 3, skills: [["planning", 3], ["subject", 2]] },
      { title: "Build the materials", detail: "Worksheet, worked example, and something for the person who finishes early.", phase: "build", load: 6, skills: [["writing", 2], ["illustration", 2], ["subject", 2]] },
      { title: "Run it and collect feedback", detail: "Three questions at the end. Read them properly.", phase: "review", load: 3, skills: [["facilitation", 3], ["reviewing", 2]] },
    ],
  },
];

/**
 * Matches found in the brief but whose work nobody has claimed yet. These are
 * the tasks teams forget, and forgetting them is what creates the last week.
 */
export const STEWARDSHIP = [
  { title: "Agree how the group works", detail: "Who decides when you disagree, how fast people reply, and what counts as late.", phase: "discover", load: 2, skills: [["planning", 3], ["facilitation", 2]] },
  { title: "Keep the decision log", detail: "One line per decision, with the date. It settles arguments later.", phase: "build", load: 2, skills: [["notes", 3], ["documenting", 2]] },
  { title: "Assemble and hand in", detail: "One person owns the final folder, the file names and the submission.", phase: "ship", load: 3, skills: [["documenting", 3], ["logistics", 2]] },
];

export const ALL_PATTERNS = [...PATTERNS];

/** Which patterns a brief triggers, with the words that triggered them. */
export function matchPatterns(brief, extraKeywords = []) {
  const text = `${brief} ${extraKeywords.join(" ")}`.toLowerCase();
  const hits = [];
  for (const pattern of PATTERNS) {
    const found = pattern.match.filter((word) => text.includes(word));
    if (found.length) hits.push({ pattern, evidence: found });
  }
  // Longer, more specific phrases win: "literature review" beats "research".
  hits.sort((a, b) => b.evidence[0].length - a.evidence[0].length || b.pattern.id.length - a.pattern.id.length);
  return hits;
}

export const PHASE_BY_ID = new Map(PHASES.map((p) => [p.id, p]));