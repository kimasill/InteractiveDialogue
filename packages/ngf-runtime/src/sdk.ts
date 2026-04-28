import type { Outcome, Requirement } from '@ngf/core';
import type {
  RuntimeAdvanceResult,
  RuntimeBundle,
  RuntimeChoice,
  RuntimeChoiceEvaluation,
  RuntimeNode,
  RuntimePlayerState,
  RuntimeRequirementCheck,
} from './types.js';

export function createRuntimePlayerState(seed: Partial<RuntimePlayerState> = {}): RuntimePlayerState {
  return {
    worldFlags: { ...(seed.worldFlags ?? {}) },
    itemTags: [...new Set(seed.itemTags ?? [])].sort(),
    persona: seed.persona ?? 0,
  };
}

export function getRuntimeNode(bundle: RuntimeBundle, node: number | string): RuntimeNode | null {
  if (typeof node === 'number') return bundle.nodes[node] ?? null;
  const index = bundle.tables.nodeIds.indexOf(node);
  return index >= 0 ? bundle.nodes[index] ?? null : null;
}

export function getRuntimeChoice(bundle: RuntimeBundle, choice: number | string): RuntimeChoice | null {
  if (typeof choice === 'number') {
    for (const node of bundle.nodes) {
      const found = node.choices.find((candidate) => candidate.id === choice);
      if (found) return found;
    }
    return null;
  }

  const index = bundle.tables.choiceIds.indexOf(choice);
  return index >= 0 ? getRuntimeChoice(bundle, index) : null;
}

export function isRuntimeNodeActive(node: RuntimeNode, state: RuntimePlayerState): boolean {
  if (!node.guardFlag) return true;
  return (state.worldFlags[node.guardFlag] ?? 0) > 0;
}

export function resolveRuntimeEntry(
  bundle: RuntimeBundle,
  state: RuntimePlayerState,
  preferredNode?: number | string | null,
): RuntimeNode | null {
  const preferred = preferredNode !== undefined && preferredNode !== null ? getRuntimeNode(bundle, preferredNode) : null;
  if (preferred && isRuntimeNodeActive(preferred, state)) return preferred;

  for (const entry of bundle.entries) {
    const node = bundle.nodes[entry];
    if (node && isRuntimeNodeActive(node, state)) return node;
  }

  return bundle.nodes.find((node) => isRuntimeNodeActive(node, state)) ?? null;
}

export function evaluateRuntimeRequirement(
  requirement: Requirement,
  state: RuntimePlayerState,
): RuntimeRequirementCheck {
  switch (requirement.type) {
    case 'None':
      return { label: 'No requirement', met: true };
    case 'HasItemTag': {
      const tag = requirement.tag ?? '';
      return { label: `Has item ${tag || '(missing tag)'}`, met: tag.length > 0 && state.itemTags.includes(tag) };
    }
    case 'WorldFlagAtLeast': {
      const tag = requirement.tag ?? '';
      const threshold = requirement.thresholdValue ?? 1;
      return {
        label: `${tag || '(missing flag)'} >= ${threshold}`,
        met: tag.length > 0 && (state.worldFlags[tag] ?? 0) >= threshold,
      };
    }
    case 'PersonaAtLeast': {
      const threshold = requirement.thresholdValue ?? 0;
      return { label: `Persona >= ${threshold}`, met: state.persona >= threshold };
    }
  }
}

export function evaluateRuntimeChoice(
  choice: RuntimeChoice,
  state: RuntimePlayerState,
): RuntimeChoiceEvaluation {
  const checks: RuntimeRequirementCheck[] = [];

  if (choice.requiredWorldFlag) {
    checks.push({
      label: `Requires flag ${choice.requiredWorldFlag}`,
      met: (state.worldFlags[choice.requiredWorldFlag] ?? 0) > 0,
    });
  }

  if (choice.blockingWorldFlag) {
    checks.push({
      label: `Blocked by flag ${choice.blockingWorldFlag}`,
      met: (state.worldFlags[choice.blockingWorldFlag] ?? 0) <= 0,
    });
  }

  for (const requirement of choice.requirements) {
    checks.push(evaluateRuntimeRequirement(requirement, state));
  }

  return { choice, checks, available: checks.every((check) => check.met) };
}

export function getRuntimeChoices(
  node: RuntimeNode,
  state: RuntimePlayerState,
): RuntimeChoiceEvaluation[] {
  return node.choices.map((choice) => evaluateRuntimeChoice(choice, state));
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

export function applyRuntimeOutcomes(
  state: RuntimePlayerState,
  outcomes: Outcome[],
): { state: RuntimePlayerState; labels: string[] } {
  const next = createRuntimePlayerState(state);
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

export function advanceRuntimeChoice(
  bundle: RuntimeBundle,
  state: RuntimePlayerState,
  currentNode: number | string,
  choice: number | string,
): RuntimeAdvanceResult {
  const node = getRuntimeNode(bundle, currentNode);
  if (!node) {
    return { ok: false, state, currentNode: null, appliedOutcomes: [], message: 'Current node was not found.' };
  }

  const selected = typeof choice === 'number'
    ? node.choices.find((candidate) => candidate.id === choice || candidate.choiceIndex === choice)
    : node.choices.find((candidate) => bundle.tables.choiceIds[candidate.id] === choice);

  if (!selected) {
    return { ok: false, state, currentNode: node, appliedOutcomes: [], message: 'Choice was not found on the current node.' };
  }

  const evaluation = evaluateRuntimeChoice(selected, state);
  if (!evaluation.available) {
    return { ok: false, state, currentNode: node, choice: selected, appliedOutcomes: [], message: 'Choice is not available.' };
  }

  const applied = applyRuntimeOutcomes(state, selected.outcomes);
  const nextNode = selected.next !== undefined ? bundle.nodes[selected.next] ?? null : null;
  return {
    ok: true,
    state: applied.state,
    currentNode: nextNode,
    choice: selected,
    appliedOutcomes: applied.labels,
    message: nextNode ? null : 'Reached a terminal choice.',
  };
}

export function advanceRuntimeAuto(
  bundle: RuntimeBundle,
  state: RuntimePlayerState,
  currentNode: number | string,
): RuntimeAdvanceResult {
  const node = getRuntimeNode(bundle, currentNode);
  if (!node) {
    return { ok: false, state, currentNode: null, appliedOutcomes: [], message: 'Current node was not found.' };
  }
  if (node.autoNext === undefined) {
    return { ok: false, state, currentNode: node, appliedOutcomes: [], message: 'No auto-continue target is available.' };
  }
  return {
    ok: true,
    state: createRuntimePlayerState(state),
    currentNode: bundle.nodes[node.autoNext] ?? null,
    appliedOutcomes: [],
    message: bundle.nodes[node.autoNext] ? null : 'Auto-continue target was not found.',
  };
}
