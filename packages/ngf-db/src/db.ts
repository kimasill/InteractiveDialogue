import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let _db: DatabaseSync | null = null;

export function getDb(path = process.env['NGF_DB_PATH'] ?? './ngf.db'): DatabaseSync {
  if (_db) return _db;
  if (path !== ':memory:') {
    mkdirSync(dirname(resolve(path)), { recursive: true });
  }
  _db = new DatabaseSync(path);
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  migrate(_db);
  return _db;
}

/** Allows injecting an in-memory DB in tests. */
export function setDb(db: DatabaseSync): void {
  _db = db;
  migrate(_db);
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      active_schema_version_id TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_versions (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      version      INTEGER NOT NULL,
      label        TEXT NOT NULL DEFAULT '',
      data         TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      UNIQUE(workspace_id, version)
    );

    CREATE TABLE IF NOT EXISTS graph_nodes (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      npc_id       TEXT NOT NULL,
      node_index   INTEGER NOT NULL,
      data         TEXT NOT NULL,
      pos_x        REAL,
      pos_y        REAL,
      updated_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_graph_nodes_workspace ON graph_nodes(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_graph_nodes_npc      ON graph_nodes(workspace_id, npc_id);

    CREATE TABLE IF NOT EXISTS import_snapshots (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      label        TEXT NOT NULL DEFAULT '',
      graph_data   TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
  `);
}

export function txn(db: DatabaseSync, fn: () => void): void {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
