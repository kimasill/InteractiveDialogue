import { sortGraph } from '@ngf/core';
import type { ChoiceId, NarrativeGraph, NodeId } from '@ngf/core';
import {
  RUNTIME_BUNDLE_FORMAT,
  RUNTIME_BUNDLE_VERSION,
  type BuildRuntimeBundleOptions,
  type NormalizedGraphJson,
  type NormalizedJsonOptions,
  type RuntimeBundle,
  type RuntimeBundleProfile,
} from './types.js';

export const NPC_DIALOGUE_RUNTIME_PROFILE: RuntimeBundleProfile = {
  id: 'npc-dialogue-runtime-v1',
  label: 'NPC Dialogue Runtime v1',
};

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function resolveEntries(graph: NarrativeGraph, opts: BuildRuntimeBundleOptions): NodeId[] {
  if (opts.entryNodeIds && opts.entryNodeIds.length > 0) {
    const known = new Set(graph.nodes.map((node) => node.id));
    return opts.entryNodeIds.filter((id) => known.has(id));
  }

  if (opts.entryNodeMaxIndex !== undefined) {
    const maxIndex = opts.entryNodeMaxIndex;
    return graph.nodes.filter((node) => node.nodeIndex <= maxIndex).map((node) => node.id);
  }

  return graph.nodes
    .filter((node) => !node.requiredWorldFlag)
    .map((node) => node.id)
    .slice(0, 1);
}

export function exportNormalizedJson(
  graph: NarrativeGraph,
  opts: NormalizedJsonOptions = {},
): NormalizedGraphJson {
  const sorted = sortGraph(graph);
  return {
    format: 'ngf.normalized.graph',
    version: 1,
    workspaceId: sorted.workspaceId,
    schemaVersionId: sorted.schemaVersionId,
    profile: opts.profile ?? NPC_DIALOGUE_RUNTIME_PROFILE,
    nodes: sorted.nodes.map((node) =>
      compactObject({
        id: node.id,
        npcId: node.npcId,
        nodeIndex: node.nodeIndex,
        nodeTitle: node.nodeTitle,
        speakerName: node.speakerName,
        dialogueText: node.dialogueText,
        requiredWorldFlag: node.requiredWorldFlag,
        autoNextNodeId: node.autoNextNodeId,
        choices: node.choices.map((choice) =>
          compactObject({
            id: choice.id,
            nodeId: choice.nodeId,
            choiceIndex: choice.choiceIndex,
            text: choice.text,
            nextNodeId: choice.nextNodeId,
            requiredWorldFlag: choice.requiredWorldFlag,
            blockingWorldFlag: choice.blockingWorldFlag,
            requirements: choice.requirements,
            outcomes: choice.outcomes,
          }),
        ),
      }),
    ),
  };
}

export function buildRuntimeBundle(
  graph: NarrativeGraph,
  opts: BuildRuntimeBundleOptions = {},
): RuntimeBundle {
  const sorted = sortGraph(graph);
  const nodeIds = sorted.nodes.map((node) => node.id);
  const nodeIndexById = new Map<NodeId, number>(nodeIds.map((id, index) => [id, index]));
  const choiceIds: ChoiceId[] = [];
  for (const node of sorted.nodes) {
    for (const choice of node.choices) choiceIds.push(choice.id);
  }
  const choiceIndexById = new Map<ChoiceId, number>(choiceIds.map((id, index) => [id, index]));
  const entries = resolveEntries(sorted, opts)
    .map((id) => nodeIndexById.get(id))
    .filter((index): index is number => index !== undefined);

  return {
    format: RUNTIME_BUNDLE_FORMAT,
    version: RUNTIME_BUNDLE_VERSION,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    workspaceId: sorted.workspaceId,
    schemaVersionId: sorted.schemaVersionId,
    profile: opts.profile ?? NPC_DIALOGUE_RUNTIME_PROFILE,
    tables: { nodeIds, choiceIds },
    entries,
    nodes: sorted.nodes.map((node, nodeIndex) =>
      compactObject({
        id: nodeIndex,
        npcId: node.npcId,
        nodeIndex: node.nodeIndex,
        title: node.nodeTitle,
        speaker: node.speakerName,
        text: node.dialogueText,
        guardFlag: node.requiredWorldFlag,
        autoNext: node.autoNextNodeId ? nodeIndexById.get(node.autoNextNodeId) : undefined,
        choices: node.choices.map((choice) =>
          compactObject({
            id: choiceIndexById.get(choice.id)!,
            choiceIndex: choice.choiceIndex,
            text: choice.text,
            next: choice.nextNodeId ? nodeIndexById.get(choice.nextNodeId) : undefined,
            requiredWorldFlag: choice.requiredWorldFlag,
            blockingWorldFlag: choice.blockingWorldFlag,
            requirements: choice.requirements,
            outcomes: choice.outcomes,
          }),
        ),
      }),
    ),
  };
}
