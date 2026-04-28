import type { DialogueNode, NarrativeGraph, NodeId, WorkspaceId } from '@kibbel/ngf-core';
import { getDb, txn } from './db.js';
import { applyPatch, type PatchOp, type PatchResult } from './patch.js';

interface GraphNodeRow {
  id: string;
  workspace_id: string;
  npc_id: string;
  node_index: number;
  data: string;
  pos_x: number | null;
  pos_y: number | null;
  updated_at: string;
}

function rowToNode(row: GraphNodeRow): DialogueNode {
  const node = JSON.parse(row.data) as DialogueNode;
  if (row.pos_x !== null && row.pos_y !== null) {
    node.position = { x: row.pos_x, y: row.pos_y };
  }
  return node;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function listNodes(workspaceId: WorkspaceId): DialogueNode[] {
  const rows = getDb()
    .prepare('SELECT * FROM graph_nodes WHERE workspace_id = ? ORDER BY npc_id, node_index')
    .all(workspaceId) as unknown as GraphNodeRow[];
  return rows.map(rowToNode);
}

export function getNode(workspaceId: WorkspaceId, nodeId: NodeId): DialogueNode | null {
  const row = getDb()
    .prepare('SELECT * FROM graph_nodes WHERE workspace_id = ? AND id = ?')
    .get(workspaceId, nodeId) as unknown as GraphNodeRow | undefined;
  return row ? rowToNode(row) : null;
}

const UPSERT_SQL = `
  INSERT INTO graph_nodes (id, workspace_id, npc_id, node_index, data, pos_x, pos_y, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    data = excluded.data,
    pos_x = excluded.pos_x,
    pos_y = excluded.pos_y,
    updated_at = excluded.updated_at
`;

export function upsertNode(workspaceId: WorkspaceId, node: DialogueNode): void {
  getDb().prepare(UPSERT_SQL).run(
    node.id, workspaceId, node.npcId, node.nodeIndex,
    JSON.stringify(node),
    node.position?.x ?? null, node.position?.y ?? null,
    nowIso(),
  );
}

export function upsertNodes(workspaceId: WorkspaceId, nodes: DialogueNode[]): void {
  const db = getDb();
  const stmt = db.prepare(UPSERT_SQL);
  const now = nowIso();
  txn(db, () => {
    for (const node of nodes) {
      stmt.run(
        node.id, workspaceId, node.npcId, node.nodeIndex,
        JSON.stringify(node),
        node.position?.x ?? null, node.position?.y ?? null,
        now,
      );
    }
  });
}

export function deleteNode(workspaceId: WorkspaceId, nodeId: NodeId): boolean {
  const result = getDb()
    .prepare('DELETE FROM graph_nodes WHERE workspace_id = ? AND id = ?')
    .run(workspaceId, nodeId);
  return (result as { changes: number }).changes > 0;
}

export function setNodePosition(
  workspaceId: WorkspaceId,
  nodeId: NodeId,
  x: number,
  y: number,
): boolean {
  const result = getDb()
    .prepare('UPDATE graph_nodes SET pos_x = ?, pos_y = ?, updated_at = ? WHERE workspace_id = ? AND id = ?')
    .run(x, y, nowIso(), workspaceId, nodeId);
  return (result as { changes: number }).changes > 0;
}

export function patchGraph(workspaceId: WorkspaceId, ops: PatchOp[]): PatchResult {
  const nodes = listNodes(workspaceId);
  const result = applyPatch(nodes, ops);

  const db = getDb();
  const upsertStmt = db.prepare(UPSERT_SQL);
  const deleteStmt = db.prepare('DELETE FROM graph_nodes WHERE workspace_id = ? AND id = ?');
  const now = nowIso();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  txn(db, () => {
    for (const nodeId of result.dirtyNodeIds) {
      const node = nodeMap.get(nodeId);
      if (!node) {
        deleteStmt.run(workspaceId, nodeId);
      } else {
        upsertStmt.run(
          node.id, workspaceId, node.npcId, node.nodeIndex,
          JSON.stringify(node),
          node.position?.x ?? null, node.position?.y ?? null,
          now,
        );
      }
    }
  });

  return result;
}

export function loadGraph(workspaceId: WorkspaceId, schemaVersionId: string): NarrativeGraph {
  return { workspaceId, schemaVersionId, nodes: listNodes(workspaceId) };
}
