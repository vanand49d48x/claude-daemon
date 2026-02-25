import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db;

export function initDb(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id            TEXT PRIMARY KEY,
      prompt        TEXT NOT NULL,
      project_dir   TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',
      output        TEXT,
      error         TEXT,
      exit_code     INTEGER,
      session_id    TEXT,
      tokens_used   INTEGER,
      cost_usd      REAL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      started_at    TEXT,
      completed_at  TEXT,
      notified      INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
  `);

  console.log(`[db] Initialized at ${dbPath}`);
  return db;
}

export function getDb() {
  return db;
}

export function createTask({ id, prompt, projectDir }) {
  const stmt = db.prepare(`
    INSERT INTO tasks (id, prompt, project_dir, status, created_at)
    VALUES (?, ?, ?, 'pending', datetime('now'))
  `);
  stmt.run(id, prompt, projectDir || null);
  return getTask(id);
}

export function getTask(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

export function listTasks({ status, limit = 20, offset = 0 } = {}) {
  let query = 'SELECT * FROM tasks';
  let countQuery = 'SELECT COUNT(*) as total FROM tasks';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    countQuery += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  const tasks = db.prepare(query).all(...params, limit, offset);
  const { total } = db.prepare(countQuery).get(...params);
  return { tasks, total };
}

export function updateTask(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);

  db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...values, id);
}

export function deleteTask(id) {
  const task = getTask(id);
  if (!task) return null;
  if (task.status === 'running') return { error: 'Cannot delete a running task' };

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return { deleted: true };
}

export function getNextPending() {
  return db.prepare(
    "SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
  ).get();
}

export function resetStaleTasks() {
  const result = db.prepare(
    "UPDATE tasks SET status = 'pending', started_at = NULL WHERE status = 'running'"
  ).run();
  if (result.changes > 0) {
    console.log(`[db] Reset ${result.changes} stale running task(s) to pending`);
  }
}

export function getStats() {
  const row = db.prepare(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'running') as running,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed
    FROM tasks
  `).get();
  return row;
}

export function closeDb() {
  if (db) db.close();
}
