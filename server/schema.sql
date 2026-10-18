-- Equita schema. One file, applied idempotently at boot.
-- Conventions: ids are text (prefixed, sortable), timestamps are ISO-8601 UTC
-- strings, structured columns are JSON text parsed at the edge, never in SQL.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher')),
  headline      TEXT NOT NULL DEFAULT '',
  school        TEXT NOT NULL DEFAULT '',
  hue           INTEGER NOT NULL DEFAULT 0,
  capacity      REAL NOT NULL DEFAULT 8,      -- honest hours available per week
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','paused')),
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- The skill vocabulary. `kind` separates a discipline from a tool from a way of
-- working, and `near` lists skills that transfer, which the matcher uses to give
-- partial credit for adjacent experience.
CREATE TABLE IF NOT EXISTS skills (
  id       TEXT PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  name     TEXT NOT NULL,
  kind     TEXT NOT NULL DEFAULT 'discipline' CHECK (kind IN ('discipline','tool','practice')),
  cluster  TEXT NOT NULL DEFAULT 'core',
  -- asked of a student when picking strengths, in plain language
  prompt   TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level    INTEGER NOT NULL DEFAULT 3 CHECK (level BETWEEN 1 AND 5),
  -- 1 = they enjoy it, 5 = they would rather never do it again
  appetite INTEGER NOT NULL DEFAULT 3 CHECK (appetite BETWEEN 1 AND 5),
  source   TEXT NOT NULL DEFAULT 'self' CHECK (source IN ('self','peer','teacher')),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS classrooms (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  code           TEXT NOT NULL UNIQUE,       -- the join code a student types
  subject        TEXT NOT NULL DEFAULT '',
  term           TEXT NOT NULL DEFAULT '',
  owner_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- the teacher's fairness policy: weights, thresholds and what is enforced
  policy         TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  archived_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_classrooms_owner ON classrooms(owner_id);

CREATE TABLE IF NOT EXISTS enrollments (
  id            TEXT PRIMARY KEY,
  classroom_id  TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','assistant')),
  created_at    TEXT NOT NULL,
  UNIQUE (classroom_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  brief         TEXT NOT NULL DEFAULT '',
  -- standalone = a team that found each other; class = a graded assignment
  mode          TEXT NOT NULL DEFAULT 'standalone' CHECK (mode IN ('standalone','class')),
  classroom_id  TEXT REFERENCES classrooms(id) ON DELETE SET NULL,
  owner_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','review','done','archived')),
  due_at        TEXT,
  -- how the allocator is allowed to behave on this project
  config        TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_classroom ON projects(classroom_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead','member','observer')),
  joined_at  TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  detail         TEXT NOT NULL DEFAULT '',
  phase          TEXT NOT NULL DEFAULT 'build',
  status         TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','review','blocked','done')),
  assignee_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  effort         REAL NOT NULL DEFAULT 2,     -- hours of real work, the unit of equity
  priority       INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  due_at         TEXT,
  required_skills TEXT NOT NULL DEFAULT '[]',
  depends_on     TEXT NOT NULL DEFAULT '[]',
  deliverable    TEXT NOT NULL DEFAULT '',
  -- nobody may quietly close their own task when the project asks for a second pair of eyes
  needs_review   INTEGER NOT NULL DEFAULT 0,
  position       REAL NOT NULL DEFAULT 1000,  -- ordering inside a column
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  started_at     TEXT,
  completed_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);

-- Every hand-off is recorded, so "who was this given to, and why" is answerable
-- months later, and declined suggestions teach the matcher nothing quietly.
CREATE TABLE IF NOT EXISTS assignments (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','auto','suggested','rebalanced')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','accepted','declined','superseded')),
  score       REAL NOT NULL DEFAULT 0,
  breakdown   TEXT NOT NULL DEFAULT '{}',
  rationale   TEXT NOT NULL DEFAULT '',
  hours_left  REAL,       -- the member's projected headroom at the moment of allocation
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assignments_task ON assignments(task_id);

-- The ledger. Sharing is decided on what was actually contributed, not on what
-- was claimed, so completions, evidence and reviews all land here.
CREATE TABLE IF NOT EXISTS contributions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('complete','progress','review','evidence','unblock','help')),
  effort      REAL NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contrib_project ON contributions(project_id);
CREATE INDEX IF NOT EXISTS idx_contrib_user ON contributions(user_id);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id    TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  mentions   TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);

CREATE TABLE IF NOT EXISTS activity (
  id           TEXT PRIMARY KEY,
  project_id   TEXT REFERENCES projects(id) ON DELETE CASCADE,
  classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
  actor_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  verb         TEXT NOT NULL,
  subject      TEXT NOT NULL DEFAULT '',
  meta         TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_classroom ON activity(classroom_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT '',
  meta       TEXT NOT NULL DEFAULT '{}',
  read_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- A weekly check-in. Short on purpose: the point is that everyone says something
-- in the same place, so silence becomes visible instead of invisible.
CREATE TABLE IF NOT EXISTS checkins (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week       TEXT NOT NULL,
  mood       TEXT NOT NULL DEFAULT 'steady' CHECK (mood IN ('ahead','steady','behind','stuck')),
  note       TEXT NOT NULL DEFAULT '',
  blockers   TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (project_id, user_id, week)
);

CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reliability INTEGER NOT NULL DEFAULT 4 CHECK (reliability BETWEEN 1 AND 5),
  quality     INTEGER NOT NULL DEFAULT 4 CHECK (quality BETWEEN 1 AND 5),
  teamwork    INTEGER NOT NULL DEFAULT 4 CHECK (teamwork BETWEEN 1 AND 5),
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  UNIQUE (project_id, reviewer_id, subject_id)
);

-- Equity over time, so a chart can show whether a team is drifting apart rather
-- than only where it stands today.
CREATE TABLE IF NOT EXISTS equity_snapshots (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  taken_at   TEXT NOT NULL,
  week       TEXT NOT NULL,
  score      REAL NOT NULL,
  gini       REAL NOT NULL,
  payload    TEXT NOT NULL,
  UNIQUE (project_id, week)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_project ON equity_snapshots(project_id, taken_at);