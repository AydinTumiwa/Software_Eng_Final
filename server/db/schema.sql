-- Database schema for the AI Lab Booking System (SQLite).
-- Tables are created on server start if they do not exist yet.
-- To add a column later, add it here AND add an ALTER TABLE step to
-- server/db/migrations.ts so existing databases are upgraded.

CREATE TABLE IF NOT EXISTS users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT    NOT NULL,
  email                 TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash         TEXT    NOT NULL,
  role                  TEXT    NOT NULL,
  program               TEXT,
  student_id            TEXT,
  must_change_password  INTEGER NOT NULL DEFAULT 1,
  is_active             INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  category    TEXT    NOT NULL,
  cpu_cores   INTEGER NOT NULL,
  memory_gb   INTEGER NOT NULL,
  storage_gb  INTEGER NOT NULL,
  os          TEXT    NOT NULL,
  software    TEXT    NOT NULL DEFAULT '[]',  -- JSON array of names
  status      TEXT    NOT NULL DEFAULT 'available',
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  program      TEXT    NOT NULL,
  lecturer_id  INTEGER NOT NULL REFERENCES users(id),
  semester     TEXT    NOT NULL,
  day_of_week  INTEGER NOT NULL,  -- 1 = Monday ... 7 = Sunday
  start_time   TEXT    NOT NULL,  -- HH:MM
  end_time     TEXT    NOT NULL,
  start_date   TEXT    NOT NULL,  -- YYYY-MM-DD, first week of classes
  end_date     TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  type              TEXT    NOT NULL,            -- teaching | backup
  status            TEXT    NOT NULL,
  status_note       TEXT,                        -- e.g. rejection reason
  category          TEXT    NOT NULL,
  user_id           INTEGER NOT NULL REFERENCES users(id),  -- who the VM is for
  booked_by_id      INTEGER NOT NULL REFERENCES users(id),  -- who made the request
  vm_id             INTEGER REFERENCES vms(id),             -- NULL while queued
  course_id         INTEGER REFERENCES courses(id),
  start_date        TEXT    NOT NULL,
  end_date          TEXT    NOT NULL,
  start_time        TEXT,
  end_time          TEXT,
  req_cpu_cores     INTEGER NOT NULL,
  req_memory_gb     INTEGER NOT NULL,
  req_storage_gb    INTEGER NOT NULL,
  req_software      TEXT    NOT NULL DEFAULT '[]',
  purpose           TEXT    NOT NULL,
  notes             TEXT,
  ready_at          TEXT,
  reminder_sent_at  TEXT,
  purge_until       TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_vm_dates ON bookings(vm_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- History of every status change, for the booking timeline.
CREATE TABLE IF NOT EXISTS booking_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_id     INTEGER REFERENCES users(id),  -- NULL when the system made the change
  from_status  TEXT,
  to_status    TEXT    NOT NULL,
  note         TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  link        TEXT,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Every email the system sends (or would send when SMTP is not configured).
CREATE TABLE IF NOT EXISTS email_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email    TEXT    NOT NULL,
  subject     TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  status      TEXT    NOT NULL,  -- sent | logged | failed
  error       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
