import type { DialogueNode, NarrativeGraph, NodeId } from '@kimasill/ngf-core';
import { computeLayout } from './layout';

export interface GraphViewState {
  branchGroups: boolean;
  focusMode: boolean;
  conditionFilter: boolean;
  edgeBundling: boolean;
  portalNodes: boolean;
}

export const DEFAULT_GRAPH_VIEW: GraphViewState = {
  branchGroups: true,
  focusMode: false,
  conditionFilter: false,
  edgeBundling: false,
  portalNodes: true,
};

export type GraphViewKey = keyof GraphViewState;

function buildPredecessors(graph: NarrativeGraph): Map<NodeId, Set<NodeId>> {
  const predecessors = new Map<NodeId, Set<NodeId>>();
  for (const node of graph.nodes) predecessors.set(node.id, new Set());
  for (const node of graph.nodes) {
    const targets = [node.autoNextNodeId, ...node.choices.map((choice) => choice.nextNodeId)];
    for (const target of targets) {
      if (!target || !predecessors.has(target)) continue;
      predecessors.get(target)!.add(node.id);
    }
  }
  return predecessors;
}

function buildSuccessors(graph: NarrativeGraph): Map<NodeId, Set<NodeId>> {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const successors = new Map<NodeId, Set<NodeId>>();
  for (const node of graph.nodes) {
    const targets = [node.autoNextNodeId, ...node.choices.map((choice) => choice.nextNodeId)];
    successors.set(
      node.id,
      new Set(targets.filter((target): target is NodeId => target !== undefined && nodeIds.has(target))),
    );
  }
  return successors;
}

function walk(startId: NodeId, graphMap: Map<NodeId, Set<NodeId>>): Set<NodeId> {
  const seen = new Set<NodeId>();
  const queue = [startId];
  seen.add(startId);

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    for (const next of graphMap.get(id) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  return seen;
}

export function getDescendantNodeIds(graph: NarrativeGraph, nodeId: NodeId): Set<NodeId> {
  const descendants = walk(nodeId, buildSuccessors(graph));
  descendants.delete(nodeId);
  return descendants;
}

export function getCollapsedHiddenNodeIds(graph: NarrativeGraph): Set<NodeId> {
  const hidden = new Set<NodeId>();
  for (const node of graph.nodes) {
    if (!node.uiState?.collapsed) continue;
    for (const descendant of getDescendantNodeIds(graph, node.id)) hidden.add(descendant);
  }
  return hidden;
}

export function getFocusNodeIds(graph: NarrativeGraph, nodeId: NodeId | null): Set<NodeId> {
  if (!nodeId) return new Set();
  const forward = walk(nodeId, buildSuccessors(graph));
  const backward = walk(nodeId, buildPredecessors(graph));
  return new Set([...forward, ...backward]);
}

export function computeBranchLaneLayout(nodes: DialogueNode[]): Map<NodeId, { x: number; y: number }> {
  const byNpc = new Map<string, DialogueNode[]>();
  for (const node of nodes) {
    const group = byNpc.get(node.npcId) ?? [];
    group.push(node);
    byNpc.set(node.npcId, group);
  }

  const positions = new Map<NodeId, { x: number; y: number }>();
  const lanes = [...byNpc.entries()].sort(([a], [b]) => a.localeCompare(b));

  lanes.forEach(([, laneNodes], laneIndex) => {
    const laneLayout = computeLayout(laneNodes);
    const laneY = laneIndex * 620;
    for (const node of laneNodes) {
      const pos = laneLayout.get(node.id) ?? { x: node.nodeIndex * 340, y: 0 };
      positions.set(node.id, { x: pos.x, y: laneY + pos.y });
    }
  });

  return positions;
}
