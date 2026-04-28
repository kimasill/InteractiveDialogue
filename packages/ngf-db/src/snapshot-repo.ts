import type { NarrativeGraph, WorkspaceId } from '@ngf/core';
import { getDb } from './db.js';

export interface ImportSnapshot {
  id: string;
  workspaceId: WorkspaceId;
  label: string;
  graph: NarrativeGraph;
  createdAt: string;
}

interface SnapshotRow {
  id: string;
  workspace_id: string;
  label: string;
  graph_data: string;
  created_at: string;
}

function rowToSnapshot(row: SnapshotRow): ImportSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    label: row.label,
    graph: JSON.parse(row.graph_data) as NarrativeGraph,
    createdAt: row.created_at,
  };
}

export function listSnapshots(workspaceId: WorkspaceId): ImportSnapshot[] {
  const rows = getDb()
    .prepare('SELECT * FROM import_snapshots WHERE workspace_id = ? ORDER BY created_at DESC')
    .all(workspaceId) as unknown as SnapshotRow[];
  return rows.map(rowToSnapshot);
}

export function getSnapshot(id: string): ImportSnapshot | null {
  const row = getDb()
    .prepare('SELECT * FROM import_snapshots WHERE id = ?')
    .get(id) as unknown as SnapshotRow | undefined;
  return row ? rowToSnapshot(row) : null;
}

export function saveSnapshot(snapshot: Omit<ImportSnapshot, 'createdAt'>): ImportSnapshot {
  const now = new Date().toISOString();
  const full: ImportSnapshot = { ...snapshot, createdAt: now };
  getDb()
    .prepare(
      'INSERT INTO import_snapshots (id, workspace_id, label, graph_data, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(full.id, full.workspaceId, full.label, JSON.stringify(full.graph), full.createdAt);
  return full;
}

export function deleteSnapshot(id: string): boolean {
  const result = getDb().prepare('DELETE FROM import_snapshots WHERE id = ?').run(id);
  return (result as { changes: number }).changes > 0;
}
