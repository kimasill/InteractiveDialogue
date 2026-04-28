import type { Choice, DialogueNode, NarrativeGraph, NodeId, Outcome, PlayerState, Requirement } from '@kimasill/ngf-core';

export interface SerializablePlayerState {
  worldFlags: Record<string, number>;
  itemTags: string[];
  persona: number;
}

export interface RequirementCheck {
  label: string;
  met: boolean;
}

export interface ChoiceEvaluation {
  choice: Choice;
  available: boolean;
  checks: RequirementCheck[];
}

export interface PlaytestTraceEntry {
  nodeId: NodeId;
  choiceId?: string;
  choiceText?: string;
  outcomes: string[];
}

export function createEmptyPlayerState(): SerializablePlayerState {
  return { worldFlags: {}, itemTags: [], persona: 0 };
}

export function toRuntimeState(state: SerializablePlayerState): PlayerState {
  return {
    worldFlags: state.worldFlags,
    itemTags: new Set(state.itemTags),
    persona: state.persona,
  };
}

export function fromRuntimeState(state: PlayerState): SerializablePlayerState {
  return {
    worldFlags: state.worldFlags,
    itemTags: [...state.itemTags].sort(),
    persona: state.persona,
  };
}

export function indexGraph(graph: NarrativeGraph): Map<NodeId, DialogueNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

export function isNodeActive(node: DialogueNode, state: PlayerState): boolean {
  if (!node.requiredWorldFlag) return true;
  return (state.worldFlags[node.requiredWorldFlag] ?? 0) > 0;
}

export function resolveEntryNode(graph: NarrativeGraph, state: SerializablePlayerState, preferredNodeId?: NodeId | null): DialogueNode | null {
  const runtime = toRuntimeState(state);
  const byId = indexGraph(graph);
  const preferred = preferredNodeId ? byId.get(preferredNodeId) : undefined;
  if (preferred && isNodeActive(preferred, runtime)) return preferred;

  const active = [...graph.nodes]
    .filter((node) => isNodeActive(node, runtime))
    .sort((a, b) => a.nodeIndex - b.nodeIndex || a.npcId.localeCompare(b.npcId));

  return active[0] ?? null;
}

export function evaluateRequirement(req: Requirement, state: PlayerState): RequirementCheck {
  switch (req.type) {
    case 'None':
      return { label: 'No requirement', met: true };
    case 'HasItemTag': {
      const tag = req.tag ?? '';
      return { label: `Has item ${tag || '(missing tag)'}`, met: tag.length > 0 && state.itemTags.has(tag) };
    }
    case 'WorldFlagAtLeast': {
      const tag = req.tag ?? '';
      const threshold = req.thresholdValue ?? 1;
      return {
        label: `${tag || '(missing flag)'} >= ${threshold}`,
        met: tag.length > 0 && (state.worldFlags[tag] ?? 0) >= threshold,
      };
    }
    case 'PersonaAtLeast': {
      const threshold = req.thresholdValue ?? 0;
      return { label: `Persona >= ${threshold}`, met: state.persona >= threshold };
    }
  }
}

export function evaluateChoice(choice: Choice, state: SerializablePlayerState): ChoiceEvaluation {
  const runtime = toRuntimeState(state);
  const checks: RequirementCheck[] = [];

  if (choice.requiredWorldFlag) {
    checks.push({
      label: `Requires flag ${choice.requiredWorldFlag}`,
      met: (runtime.worldFlags[choice.requiredWorldFlag] ?? 0) > 0,
    });
  }

  if (choice.blockingWorldFlag) {
    checks.push({
      label: `Blocked by flag ${choice.blockingWorldFlag}`,
      met: (runtime.worldFlags[choice.blockingWorldFlag] ?? 0) <= 0,
    });
  }

  for (const req of choice.requirements) {
    checks.push(evaluateRequirement(req, runtime));
  }

  return {
    choice,
    checks,
    available: checks.every((check) => check.met),
  };
}

export function evaluateChoices(node: DialogueNode, state: SerializablePlayerState): ChoiceEvaluation[] {
  return node.choices.map((choice) => evaluateChoice(choice, state));
}

function describeOutcome(outcome: Outcome): string {
  switch (outcome.type) {
    case 'None':
      return 'No outcome';
    case 'SetWorldFlag':
      return `Set flag ${outcome.worldFlag ?? '(missing flag)'}`;
    case 'TakeItem':
      return `Take item ${outcome.tagPayload ?? outcome.stringPayload ?? '(missing item)'}`;
    case 'AdjustPersona':
      return `Adjust persona ${outcome.intValue ?? outcome.floatValue ?? 0}`;
  }
}

export function applyOutcomes(state: SerializablePlayerState, outcomes: Outcome[]): { state: SerializablePlayerState; labels: string[] } {
  const next: SerializablePlayerState = {
    worldFlags: { ...state.worldFlags },
    itemTags: [...state.itemTags],
    persona: state.persona,
  };
  const itemTags = new Set(next.itemTags);
  const labels: string[] = [];

  for (const outcome of outcomes) {
    labels.push(describeOutcome(outcome));
    if (outcome.type === 'SetWorldFlag' && outcome.worldFlag) {
      next.worldFlags[outcome.worldFlag] = outcome.intValue ?? outcome.floatValue ?? 1;
    }
    if (outcome.type === 'TakeItem') {
      const tag = outcome.tagPayload ?? outcome.stringPayload;
      if (tag) itemTags.add(tag);
    }
    if (outcome.type === 'AdjustPersona') {
      next.persona += outcome.intValue ?? outcome.floatValue ?? 0;
    }
  }

  next.itemTags = [...itemTags].sort();
  return { state: next, labels };
}

export function chooseNextNodeId(choice: Choice): NodeId | null {
  return choice.nextNodeId ?? null;
}
