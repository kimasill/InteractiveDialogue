import type { SchemaVersionId, WorkspaceId } from '@kibbel/ngf-core';
import { getDb } from './db.js';

export interface SchemaVersion {
  id: SchemaVersionId;
  workspaceId: WorkspaceId;
  version: number;
  label: string;
  /** Arbitrary JSON data — the schema definition blob. */
  data: unknown;
  createdAt: string;
}

interface SchemaVersionRow {
  id: string;
  workspace_id: string;
  version: number;
  label: string;
  data: string;
  created_at: string;
}

function rowToSchemaVersion(row: SchemaVersionRow): SchemaVersion {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    version: row.version,
    label: row.label,
    data: JSON.parse(row.data) as unknown,
    createdAt: row.created_at,
  };
}

export function listSchemaVersions(workspaceId: WorkspaceId): SchemaVersion[] {
  const rows = getDb()
    .prepare('SELECT * FROM schema_versions WHERE workspace_id = ? ORDER BY version')
    .all(workspaceId) as unknown as SchemaVersionRow[];
  return rows.map(rowToSchemaVersion);
}

export function getSchemaVersion(id: SchemaVersionId): SchemaVersion | null {
  const row = getDb()
    .prepare('SELECT * FROM schema_versions WHERE id = ?')
    .get(id) as unknown as SchemaVersionRow | undefined;
  return row ? rowToSchemaVersion(row) : null;
}

export function createSchemaVersion(sv: Omit<SchemaVersion, 'createdAt'>): SchemaVersion {
  const now = new Date().toISOString();
  const full: SchemaVersion = { ...sv, createdAt: now };
  getDb()
    .prepare(
      'INSERT INTO schema_versions (id, workspace_id, version, label, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(full.id, full.workspaceId, full.version, full.label, JSON.stringify(full.data), full.createdAt);
  return full;
}

export function deleteSchemaVersion(id: SchemaVersionId): boolean {
  const result = getDb().prepare('DELETE FROM schema_versions WHERE id = ?').run(id);
  return (result as { changes: number }).changes > 0;
}
