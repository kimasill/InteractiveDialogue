import type { Workspace, WorkspaceId } from '@kimasill/ngf-core';
import { getDb } from './db.js';

interface WorkspaceRow {
  id: string;
  name: string;
  active_schema_version_id: string;
  created_at: string;
  updated_at: string;
}

function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    activeSchemaVersionId: row.active_schema_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listWorkspaces(): Workspace[] {
  const rows = getDb().prepare('SELECT * FROM workspaces ORDER BY created_at').all() as unknown as WorkspaceRow[];
  return rows.map(rowToWorkspace);
}

export function getWorkspace(id: WorkspaceId): Workspace | null {
  const row = getDb().prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as unknown as WorkspaceRow | undefined;
  return row ? rowToWorkspace(row) : null;
}

export function createWorkspace(ws: Omit<Workspace, 'createdAt' | 'updatedAt'>): Workspace {
  const now = new Date().toISOString();
  const full: Workspace = { ...ws, createdAt: now, updatedAt: now };
  getDb()
    .prepare(
      'INSERT INTO workspaces (id, name, active_schema_version_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(full.id, full.name, full.activeSchemaVersionId, full.createdAt, full.updatedAt);
  return full;
}

export function updateWorkspace(
  id: WorkspaceId,
  patch: Partial<Pick<Workspace, 'name' | 'activeSchemaVersionId'>>,
): Workspace | null {
  const existing = getWorkspace(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const merged: Workspace = { ...existing, ...patch, updatedAt: now };
  getDb()
    .prepare(
      'UPDATE workspaces SET name = ?, active_schema_version_id = ?, updated_at = ? WHERE id = ?',
    )
    .run(merged.name, merged.activeSchemaVersionId, merged.updatedAt, id);
  return merged;
}

export function deleteWorkspace(id: WorkspaceId): boolean {
  const result = getDb().prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  return (result as { changes: number }).changes > 0;
}
