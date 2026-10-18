/**
 * The types of the public story payload.
 * They mirror `server/routes/public.js` exactly — that endpoint is the only one
 * on the site that answers without a session, so it is also the only one whose
 * shape is declared away from `lib/types.ts`.
 */

export interface StoryMember {
  name: string;
  fullName: string;
  hue: number;
  committed: number;
  delivered: number;
  open: number;
  share: number;
  state: string;
  flag: string | null;
  detail: string | null;
  silentFor: number | null;
}

export interface StorySituation {
  id: string;
  key: string;
  lane: { title: string; note: string };
  name: string;
  mode: string;
  classroom: string | null;
  dueLabel: string | null;
  headline: string;
  score: number;
  parts: Record<string, number>;
  distribution: { gini: number; evenShare: number; maxGap: number };
  hours: { committed: number; delivered: number; even: number; evenCommitted: number; open: number };
  counts: { tasks: number; done: number; unassigned: number };
  members: StoryMember[];
  move: {
    kind: string;
    taskTitle: string;
    effort: number;
    /** null when this is work nobody has taken on yet. */
    from: string | null;
    to: string | null;
    fromAfter: number;
    toAfter: number;
    reason: string;
  } | null;
  weights: Record<string, number>;
  allocator: Record<string, number>;
  policy: { silenceDays: number; shareGapFlag: number; freeRiderShare: number };
}

export interface StoryStudent {
  name: string;
  fullName: string;
  hue: number;
  groups: number;
  delivered: number;
  committed: number;
  open: number;
  owed: number;
  state: string;
  detail: string | null;
}

export interface Story {
  generatedAt: string;
  demo: boolean;
  note: string;
  totals: {
    students: number;
    teachers: number;
    classes: number;
    projects: number;
    standalone: number;
    tasks: number;
    completed: number;
    hoursLogged: number;
    skills: number;
    logEntries: number;
  };
  situations: StorySituation[];
  classroom: {
    id: string;
    name: string;
    code: string;
    subject: string;
    students: StoryStudent[];
    projects: Array<{ name: string; members: number; score: number; balance: number; gini: number; dueAt: string | null }>;
  } | null;
}
