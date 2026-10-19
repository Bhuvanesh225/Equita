/**
 * The shape of everything the API returns.
 *
 * Written out rather than inferred so a change on the server shows up as a type
 * error in the component that reads the field, which is the only way a payload
 * this wide stays honest.
 */

export type Role = "student" | "teacher";
export type ProjectMode = "standalone" | "class";
export type ProjectStatus = "draft" | "active" | "review" | "done" | "archived";
export type TaskStatus = "todo" | "doing" | "review" | "blocked" | "done";
export type Phase = "discover" | "define" | "build" | "review" | "ship";
export type Severity = "critical" | "warn" | "info";
export type MemberState = "on-track" | "carrying" | "behind" | "overloaded" | "quiet";

export interface SkillRef {
  slug: string;
  weight: number;
  name?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  headline: string;
  school: string;
  hue: number;
  capacity: number;
  status: string;
  skillCount?: number;
}

export interface Skill {
  id: string;
  slug: string;
  name: string;
  kind: "discipline" | "tool" | "practice";
  cluster: string;
  prompt: string;
  mine: { level: number; appetite: number } | null;
}

export interface Cluster {
  id: string;
  name: string;
  blurb: string;
  skills?: Array<{ slug: string; name: string; prompt: string }>;
}

export interface MySkill {
  slug: string;
  level: number;
  appetite: number;
  source?: string;
  name?: string;
}

export interface Classroom {
  id: string;
  name: string;
  code: string;
  subject: string;
  term: string;
  ownerId: string;
  role?: string;
  isTeacher?: boolean;
  students?: number;
  projects?: number;
  meanScore?: number | null;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  brief: string;
  mode: ProjectMode;
  classroomId: string | null;
  ownerId: string;
  status: ProjectStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  taskCount: number;
  openCount: number;
  myOpen: number;
  myNextDue: string | null;
  unassigned: number;
  equity: {
    score: number;
    parts: EquityParts;
    /** What each part is worth in the score — printed beside it on `/insights`. */
    weights?: EquityParts;
    gini: number;
    headline: string;
    daysLeft: number | null;
  } | null;
  myShare: { committed: number; credited: number; even: number; state: MemberState } | null;
}

export interface EquityParts {
  balance: number;
  delivery: number;
  spread: number;
  engagement: number;
  readiness: number;
}

export interface EquityMember {
  id: string;
  name: string;
  hue: number;
  role: string;
  capacity: number;
  skills: Array<{ slug: string; level: number; appetite: number }>;
  served: number;
  open: number;
  blocked: number;
  committed: number;
  credited: number;
  helped: number;
  shares: { committed: number; credited: number; open: number };
  even: { committed: number; credited: number; open: number };
  deltaHours: number;
  deltaCreditedHours: number;
  owedHours: number;
  owedCreditedHours: number;
  headroom: number;
  remainingCapacity: number;
  weeksNeeded: number;
  taskCount: number;
  doneCount: number;
  openTasks: Array<{ id: string; title: string; effort: number; status: TaskStatus; dueAt: string | null; priority: number; required: SkillRef[] }>;
  lateCloses: number;
  earlyCloses: number;
  reviewCount: number;
  commentCount: number;
  checkinCount: number;
  daysSinceSignal: number | null;
  startLatency: number | null;
  state: MemberState;
  flags: Array<{ kind: string; severity: Severity; detail: string }>;
  engagement: number;
}

export interface EquityFlag {
  scope: "project" | "member";
  kind: string;
  severity: Severity;
  detail: string;
  memberId?: string;
  memberName?: string;
}

export interface RebalanceSuggestion {
  kind: "move" | "fill";
  taskId: string;
  taskTitle: string;
  taskEffort: number;
  taskDueAt: string | null;
  taskStatus?: TaskStatus;
  fromId: string | null;
  fromName: string | null;
  toId: string;
  toName: string;
  fitScore: number | null;
  improvement: number;
  fromAfterHours: number | null;
  toAfterHours: number;
  evenHours: number;
  reason: string;
}

export interface Equity {
  computedAt: string;
  measure: "credited" | "committed";
  score: number;
  parts: EquityParts;
  weights: EquityParts;
  totals: {
    committed: number;
    credited: number;
    served: number;
    open: number;
    blocked: number;
    unassigned: number;
    effort: number;
    tasks: number;
    done: number;
    overdue: number;
    members: number;
  };
  distribution: { gini: number; giniCommitted: number; giniOpen: number; maxGap: number; evenShare: number };
  timeline: {
    elapsed: number;
    actualProgress: number;
    daysLeft: number | null;
    remainingWeeks: number;
    scheduleScore: number;
    punctuality: number;
  };
  members: EquityMember[];
  unassigned: Array<{ id: string; title: string; effort: number; dueAt: string | null; phase: Phase; required: SkillRef[] }>;
  flags: EquityFlag[];
  suggestions: RebalanceSuggestion[];
  headline: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  detail: string;
  phase: Phase;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName?: string | null;
  assigneeHue?: number | null;
  effort: number;
  priority: number;
  dueAt: string | null;
  required: SkillRef[];
  dependsOn: string[];
  deliverable: string;
  needsReview: boolean;
  position: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  blockedBy?: Array<{ id: string; title: string; status: TaskStatus }>;
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: "lead" | "member" | "observer";
  hue: number;
  headline: string;
  capacity: number;
  status: string;
  skills: Array<{ slug: string; level: number; appetite: number }>;
  topSkills: Array<{ slug: string; name: string; cluster: string; level: number; appetite: number }>;
  clusters: Array<{ cluster: string; name: string; level: number }>;
}

export interface ActivityEntry {
  id: string;
  verb: string;
  subject: string;
  meta: Record<string, unknown>;
  actorId: string | null;
  actorName: string | null;
  actorHue?: number | null;
  projectId: string | null;
  classroomId: string | null;
  createdAt: string;
}

export interface Nudge {
  id: string;
  kind: string;
  severity: Severity;
  title: string;
  body: string;
  subjectId?: string;
  memberId?: string;
  projectId?: string | null;
  projectName?: string | null;
  action?: { label: string; href: string };
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  meta: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string | null;
  authorId: string;
  authorName: string | null;
  authorHue?: number | null;
  body: string;
  mentions: string[];
  createdAt: string;
}

export interface Checkin {
  id: string;
  userId: string;
  name?: string | null;
  hue?: number | null;
  week: string;
  mood: "ahead" | "steady" | "behind" | "stuck";
  note: string;
  blockers: string;
  createdAt: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string | null;
  subjectId: string;
  subjectName: string | null;
  reliability: number;
  quality: number;
  teamwork: number;
  note: string;
  createdAt: string;
}

export interface HistoryPoint {
  week: string;
  takenAt: string;
  score: number;
  gini: number;
  members: Array<{ id: string; credited: number; committed: number }> | null;
}

export interface ProjectConfig {
  weights: EquityParts;
  allocator: { skill: number; headroom: number; equity: number; deadline: number; continuity: number; growth: number };
  policy: {
    autoAssign: boolean;
    allowStretch: boolean;
    enforceCapacity: boolean;
    requireReview: boolean;
    shareGapFlag: number;
    freeRiderShare: number;
    silenceDays: number;
  };
}

export interface ProjectWorkspace {
  project: {
    id: string;
    name: string;
    brief: string;
    mode: ProjectMode;
    classroomId: string | null;
    classroom: { id: string; name: string; code: string; subject: string; term: string } | null;
    ownerId: string;
    status: ProjectStatus;
    dueAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  config: ProjectConfig;
  members: ProjectMember[];
  tasks: Task[];
  equity: Equity;
  history: HistoryPoint[];
  activity: ActivityEntry[];
  comments: Comment[];
  checkins: Checkin[];
  latestCheckin: Record<string, Checkin>;
  reviews: { all: Review[]; mine: Review[]; awaiting: Array<{ id: string; name: string; hue: number }> };
  nudges: Nudge[];
  nudgeCounts: { total: number; critical: number; warn: number; info: number };
  insights: {
    demand: Array<{ slug: string; name: string; weight: number; hours: number; tasks: string[] }>;
    suggestions: RebalanceSuggestion[];
  };
  viewer: { id: string; role: string; isLead: boolean; canTeach: boolean };
}

export interface Candidate {
  memberId: string;
  name: string;
  hue: number;
  role: string;
  capacity: number;
  state: MemberState;
  score: number;
  parts: { skill: number; headroom: number; equity: number; deadline: number; continuity: number; growth: number };
  rankedBy: string;
  fit: {
    score: number;
    matched: Array<{ slug: string; name: string; level: number; coverage: number; via: "direct" | "transfer"; from?: string }>;
    missing: Array<{ slug: string; name: string }>;
    notes: string[];
    stretch: boolean;
  };
  growth: { score: number; headline?: string; offers: Array<{ slug: string; name: string; level: number; wantsIt: boolean }> };
  warnings: string[];
  rationale: string;
  projection: { openAfter: number; evenOpen: number; headroomAfter: number; weeksNeeded: number };
  currentLoad: { open: number; committed: number; tasks: number };
}

export interface CandidateList {
  taskId: string;
  taskTitle: string;
  effort: number;
  dueAt: string | null;
  required: SkillRef[];
  evenOpen: number;
  candidates: Candidate[];
  recommended: Candidate | null;
  alternatives: Candidate[];
  summary: string;
  requiredNames?: Array<{ slug: string; weight: number; name: string }>;
  assigneeId?: string | null;
}

export interface PlanTask {
  id: string;
  title: string;
  detail: string;
  phase: Phase;
  effort: number;
  priority: number;
  dueAt: string | null;
  required: SkillRef[];
  needsReview: boolean;
  source: string;
  evidence: string[];
  duplicate?: boolean;
}

export interface PlanProposal {
  plan: {
    tasks: PlanTask[];
    meta: {
      createdFrom: string | string[];
      matchedWords: string[];
      totalHours: number;
      perMemberHours: number;
      availableHours: number;
      utilisation: number;
      weeks: number;
      phases: Array<{ id: Phase; name: string; blurb: string; tasks: number; hours: number }>;
      fallback: boolean;
      notes: string[];
    };
  };
  context: {
    brief: string;
    dueAt: string | null;
    members: number;
    totalCapacity: number;
    existingTasks: number;
    evenShareHours: number;
    currentEvenShare: number;
  };
}

export interface AutoAssignResult {
  assignments: Array<{
    taskId: string;
    taskTitle: string;
    effort: number;
    dueAt: string | null;
    userId: string;
    name: string;
    score: number;
    parts: Candidate["parts"];
    rationale: string;
    warnings: string[];
    projection: Candidate["projection"];
    alternatives: Array<{ memberId: string; name: string; score: number }>;
  }>;
  unassigned: Array<{ taskId: string; title: string; effort: number; reason: string }>;
  notes: string[];
  balance: { giniBefore: number; giniAfter: number; improved: boolean } | null;
  load: Array<{ id: string; name: string; open: number; even: number; tasks: number }>;
}

export interface Dashboard {
  user: { id: string; name: string; role: Role; hue: number; capacity: number; headline: string };
  top: Array<{ slug: string; name: string; cluster: string; level: number; appetite: number }>;
  clusters: Array<{ cluster: string; name: string; level: number }>;
  skillCount: number;
  cards: Array<
    ProjectSummary & {
      members: Array<{ id: string; name: string; hue: number; state: MemberState; committed: number; credited: number; even: number; open: number }>;
      mine: {
        state: MemberState;
        committed: number;
        credited: number;
        open: number;
        even: number;
        owed: number;
        headroom: number;
        remainingCapacity: number;
        tasks: Array<{ id: string; title: string; status: TaskStatus; effort: number; dueAt: string | null; phase: Phase; priority: number; required: SkillRef[] }>;
        flags: Array<{ kind: string; severity: Severity; detail: string }>;
      } | null;
      unclaimedForMe: Array<{ id: string; title: string; effort: number; dueAt: string | null; phase: Phase; fit: number | null }>;
      flags: EquityFlag[];
    }
  >;
  agenda: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    effort: number;
    dueAt: string | null;
    phase: Phase;
    priority: number;
    projectId: string;
    projectName: string;
    required: SkillRef[];
    requiredNames: Array<{ slug: string; weight: number; name: string }>;
    overdue: boolean;
    hoursUntilDue: number | null;
  }>;
  week: Array<{ date: string; label: string; hours: number; isToday: boolean }>;
  nudges: Nudge[];
  nudgeCounts: { total: number; critical: number; warn: number; info: number };
  notifications: Notification[];
  unreadCount: number;
  classes: Array<{
    id: string;
    name: string;
    code: string;
    subject: string;
    term: string;
    students: number;
    groups: number;
    meanScore: number;
    worstScore: number;
    behind: number;
    overloaded: number;
    unplaced: number;
    urgent: number;
    attention: Array<{ kind: string; studentId: string; name: string; hue: number; detail: string; severity: Severity }>;
  }>;
  activity: ActivityEntry[];
  /**
   * The viewer's own line against an even share, week by week, summed over
   * every project they are on. `even` is the mean of the members the snapshot
   * recorded, so the rule line drawn from it is the same measure the bars use.
   */
  trend: Array<{ week: string; takenAt: string; credited: number; committed: number; even: number }>;
  summary: {
    projects: number;
    openHours: number;
    evenHours: number;
    creditedHours: number;
    dueToday: number;
    overdue: number;
    classes: number;
  };
}

export interface GroupTeam {
  id?: string;
  name: string;
  members: Array<{
    id: string;
    name: string;
    email: string;
    headline: string;
    hue: number;
    capacity: number;
    strength: number;
    dominant: string;
    topSkills: Array<{ slug: string; level: number }>;
    /**
     * Their level in each cluster. The group builder reads this to recompute a
     * group's coverage after somebody is dragged between groups — the preview
     * endpoint takes no "pin this person" input, so the arithmetic has to happen
     * in the browser (see `src/routes/groupbuilder/Lanes.tsx`).
     */
    clusters?: Array<{ cluster: string; name: string; level: number }>;
  }>;
  size?: number;
  coverage: Record<string, number>;
  requiredCoverage: number;
  totalStrength: number;
  meanStrength: number;
  totalCapacity: number;
  weakestCluster: string | null;
  roles: Array<{ role: string; label: string; memberId: string; name: string; strength: number }>;
}

export interface GroupProposal {
  teams: GroupTeam[];
  objective: number;
  parts: { coverage: number; strengthBalance: number; capacityBalance: number; diversity: number };
  sizeRange: [number, number];
  notes: string[];
  gaps: Array<{ cluster: string; name: string; strong: number; meanLevel: number; needed: boolean }>;
  balanced: boolean;
  seed: number;
  rosterSize: number;
}

export interface ClassStudent {
  id: string;
  name: string;
  email: string;
  headline: string;
  hue: number;
  capacity: number;
  top: Array<{ slug: string; name: string; cluster: string; level: number; appetite: number }>;
  clusters: Array<{ cluster: string; name: string; level: number }>;
  growth: Array<{ slug: string; name: string; level: number; appetite: number }>;
  projects: Array<{
    id: string;
    name: string;
    state: MemberState;
    committed: number;
    credited: number;
    even: number;
    owed: number;
    open: number;
    flags: Array<{ kind: string; severity: Severity; detail: string }>;
  }>;
  totals: { committed: number; credited: number; even: number; evenCommitted?: number; open: number; capacity: number; available?: number; tasks?: number; done?: number };
  state: MemberState;
  flags: Array<{ kind: string; severity: Severity; detail: string; projectName?: string; projectId?: string }>;
  owed: number;
  share?: number;
  acrossGroups?: boolean;
}

export interface ClassProject {
  id: string;
  name: string;
  brief: string;
  status: ProjectStatus;
  dueAt: string | null;
  memberCount: number;
  /** How many peer reviews have been written on this group. */
  reviewCount?: number;
  equity: Equity;
  modest: {
    score: number;
    gini: number;
    daysLeft: number | null;
    progress: number;
    done: number;
    tasks: number;
    unassigned: number;
    open: number;
  };
  members: Array<{
    id: string;
    name: string;
    hue: number;
    state: MemberState;
    committed: number;
    credited: number;
    /** The even share of *delivered* work — what every load bar draws. */
    even: number;
    /** The even share of work taken on, which is a different number. */
    evenCommitted?: number;
    owedCreditedHours: number;
    open: number;
    capacity: number;
    flags: Array<{ kind: string; severity: Severity; detail: string }>;
  }>;
  attention: Array<{ id: string; name: string; state: MemberState; detail: string }>;
  weakest: string | null;
  strongest: string | null;
}

export interface ClassroomOverview {
  classroom: { id: string; name: string; code: string; subject: string; term: string; ownerId: string; policy: ProjectConfig; createdAt: string };
  projects: ClassProject[];
  students: ClassStudent[];
  nudges: Nudge[];
  nudgeCounts: { total: number; critical: number; warn: number; info: number };
  coverage: Array<{ cluster: string; name: string; holders: number; strong: number; meanLevel: number; topHolders: Array<{ id: string; name: string; level: number }> }>;
  analytics: {
    groups: number;
    students: number;
    meanScore: number;
    worstScore: number;
    bestScore: number;
    meanGini: number;
    meanProgress: number;
    behindCount: number;
    overloadedCount: number;
    unplaced: number;
    neverReviewed: number;
    spreadOfStates: Record<string, number>;
    projectsWithoutDeadline: number;
    totalOpenHours: number;
  };
  trend: Array<{ week: string; takenAt: string; score: number; gini: number; projects: number }>;
  attention: Array<{ kind: string; studentId: string; name: string; hue: number; detail: string; severity: Severity }>;
  viewer: { id: string; isTeacher: boolean; role: string };
  gaps: Array<{ cluster: string; name: string; strong: number; meanLevel: number; needed: boolean }>;
}

/**
 * `GET /api/classrooms/:id/analytics` — the class console's numbers without the
 * roster bodies. The fairness screen reads one of these per class the viewer
 * teaches, which is why it carries slim students and projects.
 */
export interface ClassAnalytics {
  analytics: ClassroomOverview["analytics"];
  trend: ClassroomOverview["trend"];
  coverage: ClassroomOverview["coverage"];
  students: Array<{
    id: string;
    name: string;
    hue: number;
    state: MemberState;
    groups: number;
    credited: number;
    committed: number;
    even: number;
    owed: number;
    open: number;
    capacity: number;
    top: Array<{ slug: string; name: string; cluster: string; level: number; appetite: number }>;
  }>;
  projects: Array<{
    id: string;
    name: string;
    score: number;
    gini: number;
    parts: EquityParts;
    progress: number;
    daysLeft: number | null;
    open: number;
    unassigned: number;
    members: ClassProject["members"];
  }>;
}

export interface StudentRecord {
  student: { id: string; name: string; email: string; headline: string; hue: number; capacity: number; status: string };
  top: Array<{ slug: string; name: string; cluster: string; level: number; appetite: number }>;
  growth: Array<{ slug: string; name: string; level: number; appetite: number }>;
  clusters: Array<{ cluster: string; name: string; level: number; skills: Array<{ slug: string; level: number }> }>;
  totals: { credited: number; committed: number; even: number; evenCommitted?: number; done: number; late: number; open: number; owed: number };
  projects: Array<{
    id: string;
    name: string;
    equityScore: number;
    member: EquityMember | null;
    contributions: Array<{ id: string; kind: string; effort: number; note: string; createdAt: string; taskTitle: string | null }>;
    checkins: Checkin[];
    tasks: Array<{ id: string; title: string; status: TaskStatus; effort: number; dueAt: string | null; completedAt: string | null; late: boolean | null }>;
    history: Array<{ week: string; credited: number | null; committed: number | null }>;
  }>;
  reading: string;
}

export interface CopilotAnswer {
  intent: string;
  answer: string;
  facts: Array<{ label: string; value: string }>;
  actions: Array<{ label: string; href: string }>;
}

export interface SearchResult {
  kind: "project" | "task" | "person" | "class";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  hue?: number;
}

export interface SessionPayload {
  user: User | null;
  skills?: MySkill[];
  memberships?: Classroom[];
  counts?: { projects: number; unread: number; openTasks: number };
  clusters?: Array<{ cluster: string; name: string; level: number }>;
  top?: Array<{ slug: string; name: string; cluster: string; level: number; appetite: number }>;
}