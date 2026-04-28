import type { Node, Edge } from '@xyflow/react';
import type { DialogueNode, NarrativeGraph, NodeId } from '@kibbel/ngf-core';
import { computeLayout } from './layout';
import type { SerializablePlayerState } from './playtest';

const NPC_PALETTE = ['#5b7cfa', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#c084fc', '#f97316', '#14b8a6'];

function npcColor(npcId: string): string {
  let h = 0;
  for (const ch of npcId) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return NPC_PALETTE[h % NPC_PALETTE.length] ?? '#5b7cfa';
}

function choiceColor(npcId: string, choiceIndex: number): string {
  const baseIndex = NPC_PALETTE.indexOf(npcColor(npcId));
  return NPC_PALETTE[(baseIndex + choiceIndex) % NPC_PALETTE.length] ?? '#5b7cfa';
}

// @xyflow/react requires data to extend Record<string, unknown>
export interface FlowNodeData extends Record<string, unknown> {
  node: DialogueNode;
  branchGroupLabel?: string;
  unavailableChoiceIds?: string[];
  activeChoiceId?: string;
  issueSeverity?: 'error' | 'warning' | 'info';
}

export type FlowDialogueNode = Node<FlowNodeData, 'dialogue'>;

export interface FlowPortalNodeData extends Record<string, unknown> {
  targetNodeId: NodeId;
  sourceNodeId: NodeId;
}

export type FlowPortalNode = Node<FlowPortalNodeData, 'portal'>;

export type FlowGraphNode = FlowDialogueNode | FlowPortalNode;

export interface GraphToFlowOptions {
  hiddenNodeIds?: Set<NodeId>;
  showBranchGroups?: boolean;
  showPortalNodes?: boolean;
  edgeBundling?: boolean;
  conditionFilter?: boolean;
  playerState?: SerializablePlayerState;
}

export interface FlowEdgeData extends Record<string, unknown> {
  edgeKind: 'choice' | 'auto';
  choiceId?: string;
  choiceIndex?: number;
  sourceNodeId: NodeId;
  targetNodeId?: NodeId;
  label: string;
  color: string;
}

function unavailableChoiceIds(graph: NarrativeGraph, playerState: SerializablePlayerState | undefined): Set<string> {
  const unavailable = new Set<string>();
  if (!playerState) return unavailable;

  const itemTags = new Set(playerState.itemTags);
  for (const node of graph.nodes) {
    for (const choice of node.choices) {
      let available = true;
      if (choice.requiredWorldFlag && (playerState.worldFlags[choice.requiredWorldFlag] ?? 0) <= 0) available = false;
      if (choice.blockingWorldFlag && (playerState.worldFlags[choice.blockingWorldFlag] ?? 0) > 0) available = false;
      for (const req of choice.requirements) {
        if (req.type === 'HasItemTag' && (!req.tag || !itemTags.has(req.tag))) available = false;
        if (req.type === 'WorldFlagAtLeast' && (!req.tag || (playerState.worldFlags[req.tag] ?? 0) < (req.thresholdValue ?? 1))) available = false;
        if (req.type === 'PersonaAtLeast' && playerState.persona < (req.thresholdValue ?? 0)) available = false;
      }
      if (!available) unavailable.add(choice.id);
    }
  }

  return unavailable;
}

export function graphToFlow(graph: NarrativeGraph): {
  nodes: FlowGraphNode[];
  edges: Edge[];
};
export function graphToFlow(graph: NarrativeGraph, opts: GraphToFlowOptions): {
  nodes: FlowGraphNode[];
  edges: Edge[];
};
export function graphToFlow(graph: NarrativeGraph, opts: GraphToFlowOptions = {}): {
  nodes: FlowGraphNode[];
  edges: Edge[];
} {
  const layout = computeLayout(graph.nodes);
  const hidden = opts.hiddenNodeIds ?? new Set<NodeId>();
  const visibleNodeIds = new Set(graph.nodes.filter((node) => !hidden.has(node.id)).map((node) => node.id));
  const unavailable = opts.conditionFilter ? unavailableChoiceIds(graph, opts.playerState) : new Set<string>();

  const nodes: FlowGraphNode[] = graph.nodes.filter((n) => !hidden.has(n.id)).map((n) => ({
    id: n.id,
    type: 'dialogue',
    position: n.position ?? layout.get(n.id) ?? { x: 0, y: 0 },
    draggable: !n.uiState?.lockedPosition,
    data: {
      node: n,
      branchGroupLabel: opts.showBranchGroups ? n.uiState?.groupId ?? n.npcId : undefined,
      unavailableChoiceIds: [...unavailable],
    },
  }));

  const edges: Edge[] = [];
  const portalTargets = new Map<NodeId, { source: NodeId; index: number }>();

  function resolveTarget(sourceId: NodeId, targetId: NodeId | undefined): NodeId | undefined {
    if (!targetId) return undefined;
    if (visibleNodeIds.has(targetId)) return targetId;
    if (!opts.showPortalNodes || hidden.has(targetId)) return undefined;
    if (!portalTargets.has(targetId)) portalTargets.set(targetId, { source: sourceId, index: portalTargets.size });
    return `portal:${targetId}`;
  }

  for (const n of graph.nodes) {
    if (hidden.has(n.id)) continue;
    for (const c of n.choices) {
      if (c.nextNodeId) {
        if (opts.conditionFilter && unavailable.has(c.id)) continue;
        const target = resolveTarget(n.id, c.nextNodeId);
        if (!target) continue;
        edges.push({
          id: `e-${c.id}`,
          source: n.id,
          sourceHandle: `c${c.choiceIndex}`,
          target,
          type: opts.edgeBundling ? 'smoothstep' : 'default',
          className: opts.edgeBundling ? 'flow-edge--bundled flow-edge--choice' : 'flow-edge--choice',
          reconnectable: true,
          data: {
            edgeKind: 'choice',
            choiceId: c.id,
            choiceIndex: c.choiceIndex,
            sourceNodeId: n.id,
            targetNodeId: c.nextNodeId,
            label: c.text,
            color: choiceColor(n.npcId, c.choiceIndex),
          } satisfies FlowEdgeData,
          style: { stroke: choiceColor(n.npcId, c.choiceIndex), strokeWidth: 1.8 },
          labelStyle: { fill: '#94a3b8', fontSize: 11 },
          labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.85 },
          interactionWidth: 28,
        });
      }
    }

    if (n.autoNextNodeId) {
      const target = resolveTarget(n.id, n.autoNextNodeId);
      if (!target) continue;
      edges.push({
        id: `e-auto-${n.id}`,
        source: n.id,
        sourceHandle: 'auto',
        target,
        type: opts.edgeBundling ? 'smoothstep' : 'default',
        className: opts.edgeBundling ? 'flow-edge--bundled flow-edge--auto' : 'flow-edge--auto',
        reconnectable: true,
        data: {
          edgeKind: 'auto',
          sourceNodeId: n.id,
          targetNodeId: n.autoNextNodeId,
          label: 'auto-continue',
          color: '#94a3b8',
        } satisfies FlowEdgeData,
        style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '5 3' },
        labelStyle: { fill: '#64748b', fontSize: 10 },
        labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.85 },
        interactionWidth: 26,
      });
    }
  }

  if (opts.showPortalNodes) {
    for (const [targetNodeId, meta] of portalTargets) {
      const sourcePos = graph.nodes.find((node) => node.id === meta.source)?.position ?? layout.get(meta.source) ?? { x: 0, y: 0 };
      nodes.push({
        id: `portal:${targetNodeId}`,
        type: 'portal',
        position: { x: sourcePos.x + 340, y: sourcePos.y + 120 + meta.index * 80 },
        data: { targetNodeId, sourceNodeId: meta.source },
        selectable: false,
        draggable: false,
      });
    }
  }

  return { nodes, edges };
}
