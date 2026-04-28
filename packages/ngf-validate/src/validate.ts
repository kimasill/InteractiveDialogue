import {
  type DialogueNode,
  type NarrativeGraph,
  type NodeId,
  OUTCOME_TYPES,
  REQUIREMENT_TYPES,
  indexNodes,
} from '@kibbel/ngf-core';

import {
  type ValidationIssue,
  type ValidationReport,
  summarize,
} from './issues.js';

export interface ValidateOptions {
  /**
   * NodeIds to treat as conversation entry points. If unset, every node with
   * `nodeIndex <= entryNodeMaxIndex` is considered an entry — this matches
   * the source workbook convention where the first few NodeIndex values are
   * dialogue start states keyed off WorldFlag guards.
   */
  entryNodeIds?: NodeId[];
  entryNodeMaxIndex?: number;
}

export function validate(graph: NarrativeGraph, opts: ValidateOptions = {}): ValidationReport {
  const issues: ValidationIssue[] = [];
  const nodes = indexNodes(graph);

  const entryIds = resolveEntryIds(graph, opts);
  const coverage = collectCoverage(graph);

  for (const node of graph.nodes) {
    checkNodeIntegrity(node, nodes, issues);
    checkChoices(node, nodes, coverage, issues);
  }

  // Reachability — only when at least one entry exists.
  if (entryIds.size > 0) {
    const reachable = bfsReachable(graph, entryIds);
    for (const node of graph.nodes) {
      if (!reachable.has(node.id) && !entryIds.has(node.id)) {
        issues.push({
          code: 'unreachable_node',
          severity: 'warning',
          message: `Node ${node.id} is not reachable from any entry node.`,
          nodeId: node.id,
        });
      }
    }
  }

  return summarize(issues);
}

/* -------------------------------------------------------------------------- */
/*  per-node checks                                                            */
/* -------------------------------------------------------------------------- */

function checkNodeIntegrity(
  node: DialogueNode,
  nodes: Map<NodeId, DialogueNode>,
  issues: ValidationIssue[],
): void {
  if (node.speakerName === '') {
    issues.push({
      code: 'missing_required_field',
      severity: 'warning',
      message: `Node ${node.id} has empty SpeakerName.`,
      nodeId: node.id,
    });
  }
  if (node.dialogueText === '') {
    issues.push({
      code: 'missing_required_field',
      severity: 'warning',
      message: `Node ${node.id} has empty DialogueText.`,
      nodeId: node.id,
    });
  }

  if (node.autoNextNodeId) {
    if (node.autoNextNodeId === node.id) {
      issues.push({
        code: 'self_loop_auto_continue',
        severity: 'warning',
        message: `Node ${node.id} auto-continues to itself.`,
        nodeId: node.id,
      });
    } else if (!nodes.has(node.autoNextNodeId)) {
      issues.push({
        code: 'broken_edge_auto_continue',
        severity: 'error',
        message: `Node ${node.id} auto-continues to missing ${node.autoNextNodeId}.`,
        nodeId: node.id,
        fixes: [{ kind: 'create_node', targetNodeId: node.autoNextNodeId }],
      });
    }
  }

  // Dead-end: no choices, no auto-continue.
  if (node.choices.length === 0 && !node.autoNextNodeId) {
    issues.push({
      code: 'dead_end_node',
      severity: 'info',
      message: `Node ${node.id} is a dead-end (no choices, no auto-continue).`,
      nodeId: node.id,
    });
  }

  // Duplicate choice indices.
  const seen = new Set<number>();
  for (const c of node.choices) {
    if (seen.has(c.choiceIndex)) {
      issues.push({
        code: 'duplicate_choice_index',
        severity: 'error',
        message: `Node ${node.id} has duplicate ChoiceIndex ${c.choiceIndex}.`,
        nodeId: node.id,
        choiceId: c.id,
      });
    }
    seen.add(c.choiceIndex);
  }
}

/* -------------------------------------------------------------------------- */
/*  per-choice checks                                                          */
/* -------------------------------------------------------------------------- */

function checkChoices(
  node: DialogueNode,
  nodes: Map<NodeId, DialogueNode>,
  coverage: Coverage,
  issues: ValidationIssue[],
): void {
  for (const choice of node.choices) {
    if (choice.text === '') {
      issues.push({
        code: 'missing_required_field',
        severity: 'warning',
        message: `Choice ${choice.id} has empty ChoiceText.`,
        nodeId: node.id,
        choiceId: choice.id,
      });
    }
    if (choice.nextNodeId && !nodes.has(choice.nextNodeId)) {
      issues.push({
        code: 'broken_edge_choice',
        severity: 'error',
        message: `Choice ${choice.id} points to missing node ${choice.nextNodeId}.`,
        nodeId: node.id,
        choiceId: choice.id,
        fixes: [
          { kind: 'create_node', targetNodeId: choice.nextNodeId },
          { kind: 'change_target', choiceId: choice.id },
          { kind: 'remove_choice', choiceId: choice.id },
        ],
      });
    }

    // Flag requirement vs. setter coverage (heuristic).
    for (const req of choice.requirements) {
      if (!(REQUIREMENT_TYPES as readonly string[]).includes(req.type)) {
        issues.push({
          code: 'invalid_enum',
          severity: 'error',
          message: `Choice ${choice.id} has invalid requirement type "${req.type}".`,
          nodeId: node.id,
          choiceId: choice.id,
        });
        continue;
      }

      if (req.type === 'WorldFlagAtLeast' && req.tag && !coverage.flagsSet.has(req.tag)) {
        issues.push({
          code: 'flag_required_but_never_set',
          severity: 'warning',
          message:
            `Choice ${choice.id} requires WorldFlag "${req.tag}" >= ${req.thresholdValue ?? 1}, ` +
            `but no outcome anywhere in the graph sets that flag.`,
          nodeId: node.id,
          choiceId: choice.id,
          fixes: [{ kind: 'create_setter_outcome', flag: req.tag, nodeId: node.id }],
        });
      }

      if (req.type === 'HasItemTag' && req.tag && !coverage.itemsGiven.has(req.tag)) {
        issues.push({
          code: 'item_required_but_never_given',
          severity: 'warning',
          message: `Choice ${choice.id} requires item tag "${req.tag}", but no outcome gives that item tag.`,
          nodeId: node.id,
          choiceId: choice.id,
        });
      }

      if (
        req.type === 'PersonaAtLeast' &&
        req.thresholdValue !== undefined &&
        coverage.maxPersonaGain < req.thresholdValue
      ) {
        issues.push({
          code: 'persona_threshold_may_be_unreachable',
          severity: 'warning',
          message:
            `Choice ${choice.id} requires Persona >= ${req.thresholdValue}, ` +
            `but known AdjustPersona outcomes only add up to ${coverage.maxPersonaGain}.`,
          nodeId: node.id,
          choiceId: choice.id,
        });
      }
    }

    for (const outcome of choice.outcomes) {
      if (!(OUTCOME_TYPES as readonly string[]).includes(outcome.type)) {
        issues.push({
          code: 'invalid_enum',
          severity: 'error',
          message: `Choice ${choice.id} has invalid outcome type "${outcome.type}".`,
          nodeId: node.id,
          choiceId: choice.id,
        });
      }
    }

    if (choice.requiredWorldFlag && !coverage.flagsSet.has(choice.requiredWorldFlag)) {
      issues.push({
        code: 'flag_required_but_never_set',
        severity: 'warning',
        message:
          `Choice ${choice.id} is gated on flag "${choice.requiredWorldFlag}", ` +
          `but no outcome sets that flag.`,
        nodeId: node.id,
        choiceId: choice.id,
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  helpers                                                                    */
/* -------------------------------------------------------------------------- */

interface Coverage {
  flagsSet: Set<string>;
  itemsGiven: Set<string>;
  maxPersonaGain: number;
}

function collectCoverage(graph: NarrativeGraph): Coverage {
  const flagsSet = new Set<string>();
  const itemsGiven = new Set<string>();
  let maxPersonaGain = 0;

  for (const node of graph.nodes) {
    for (const choice of node.choices) {
      for (const o of choice.outcomes) {
        if (o.type === 'SetWorldFlag' && o.worldFlag) flagsSet.add(o.worldFlag);
        if (o.type === 'TakeItem' && o.tagPayload) itemsGiven.add(o.tagPayload);
        if (o.type === 'AdjustPersona') {
          const delta = o.intValue ?? o.floatValue ?? 0;
          if (delta > 0) maxPersonaGain += delta;
        }
      }
    }
  }

  return { flagsSet, itemsGiven, maxPersonaGain };
}

function resolveEntryIds(graph: NarrativeGraph, opts: ValidateOptions): Set<NodeId> {
  if (opts.entryNodeIds && opts.entryNodeIds.length > 0) {
    return new Set(opts.entryNodeIds);
  }
  const max = opts.entryNodeMaxIndex;
  if (max === undefined) return new Set();
  const out = new Set<NodeId>();
  for (const n of graph.nodes) {
    if (n.nodeIndex <= max) out.add(n.id);
  }
  return out;
}

function bfsReachable(graph: NarrativeGraph, entries: Set<NodeId>): Set<NodeId> {
  const reachable = new Set<NodeId>();
  const queue: NodeId[] = [];
  const nodes = indexNodes(graph);

  for (const id of entries) {
    if (nodes.has(id)) {
      reachable.add(id);
      queue.push(id);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes.get(id);
    if (!node) continue;
    if (node.autoNextNodeId && nodes.has(node.autoNextNodeId) && !reachable.has(node.autoNextNodeId)) {
      reachable.add(node.autoNextNodeId);
      queue.push(node.autoNextNodeId);
    }
    for (const c of node.choices) {
      if (c.nextNodeId && nodes.has(c.nextNodeId) && !reachable.has(c.nextNodeId)) {
        reachable.add(c.nextNodeId);
        queue.push(c.nextNodeId);
      }
    }
  }
  return reachable;
}
