import { choiceId, parseNodeId, sortGraph } from '@ngf/core';
import type { Choice, ChoiceId, DialogueNode, NarrativeGraph, NodeId, Outcome } from '@ngf/core';
import type { ValidationIssue, ValidationReport } from '@ngf/validate';
import type { SchemaDraft } from './schemaDraft';

export type CopilotPatchOp =
  | { op: 'set_node_title'; nodeId: NodeId; title: string }
  | { op: 'set_dialogue_text'; nodeId: NodeId; text: string }
  | { op: 'set_speaker_name'; nodeId: NodeId; speakerName: string }
  | { op: 'set_required_world_flag'; nodeId: NodeId; flag: string | null }
  | { op: 'set_auto_next'; nodeId: NodeId; targetNodeId: NodeId | null }
  | { op: 'create_node'; node: DialogueNode }
  | { op: 'add_choice'; nodeId: NodeId; choice: Choice }
  | { op: 'remove_choice'; choiceId: ChoiceId }
  | { op: 'set_choice_text'; choiceId: ChoiceId; text: string }
  | { op: 'set_choice_next'; choiceId: ChoiceId; targetNodeId: NodeId | null }
  | { op: 'add_outcome'; choiceId: ChoiceId; outcome: Outcome };

export type CopilotQuickAction = 'title_selected' | 'terminal_choice' | 'repair_missing_targets' | 'fill_empty_fields';

export interface CopilotProposal {
  id: string;
  title: string;
  summary: string;
  source: 'quick_action' | 'chat';
  ops: CopilotPatchOp[];
  createdAt: string;
}

export interface CopilotPatchResult {
  graph: NarrativeGraph;
  errors: string[];
  touchedNodeIds: NodeId[];
}

function cloneGraph(graph: NarrativeGraph): NarrativeGraph {
  return JSON.parse(JSON.stringify(graph)) as NarrativeGraph;
}

function truncate(value: string, max = 72): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function nextChoiceIndex(node: DialogueNode): number {
  if (node.choices.length === 0) return 0;
  return Math.max(...node.choices.map((choice) => choice.choiceIndex)) + 1;
}

function makePlaceholderNode(id: NodeId, source?: DialogueNode): DialogueNode {
  const { npcId, nodeIndex } = parseNodeId(id);
  const sourcePosition = source?.position;

  return {
    id,
    npcId,
    nodeIndex,
    speakerName: source?.speakerName ?? npcId,
    dialogueText: '(Draft dialogue)',
    choices: [],
    position: sourcePosition ? { x: sourcePosition.x + 340, y: sourcePosition.y + 80 } : undefined,
  };
}

function nodeIdFromChoice(id: ChoiceId): NodeId {
  return id.split(':c')[0] as NodeId;
}

export function applyCopilotPatch(graph: NarrativeGraph, ops: CopilotPatchOp[]): CopilotPatchResult {
  const nextGraph = cloneGraph(graph);
  const nodes = new Map(nextGraph.nodes.map((node) => [node.id, node]));
  const errors: string[] = [];
  const touched = new Set<NodeId>();

  for (const op of ops) {
    switch (op.op) {
      case 'set_node_title': {
        const node = nodes.get(op.nodeId);
        if (!node) { errors.push(`Node ${op.nodeId} not found.`); break; }
        node.nodeTitle = op.title;
        touched.add(op.nodeId);
        break;
      }
      case 'set_dialogue_text': {
        const node = nodes.get(op.nodeId);
        if (!node) { errors.push(`Node ${op.nodeId} not found.`); break; }
        node.dialogueText = op.text;
        touched.add(op.nodeId);
        break;
      }
      case 'set_speaker_name': {
        const node = nodes.get(op.nodeId);
        if (!node) { errors.push(`Node ${op.nodeId} not found.`); break; }
        node.speakerName = op.speakerName;
        touched.add(op.nodeId);
        break;
      }
      case 'set_required_world_flag': {
        const node = nodes.get(op.nodeId);
        if (!node) { errors.push(`Node ${op.nodeId} not found.`); break; }
        if (op.flag) node.requiredWorldFlag = op.flag;
        else delete node.requiredWorldFlag;
        touched.add(op.nodeId);
        break;
      }
      case 'set_auto_next': {
        const node = nodes.get(op.nodeId);
        if (!node) { errors.push(`Node ${op.nodeId} not found.`); break; }
        if (op.targetNodeId) node.autoNextNodeId = op.targetNodeId;
        else delete node.autoNextNodeId;
        touched.add(op.nodeId);
        break;
      }
      case 'create_node': {
        if (nodes.has(op.node.id)) { errors.push(`Node ${op.node.id} already exists.`); break; }
        const node = structuredClone(op.node);
        nextGraph.nodes.push(node);
        nodes.set(node.id, node);
        touched.add(node.id);
        break;
      }
      case 'add_choice': {
        const node = nodes.get(op.nodeId);
        if (!node) { errors.push(`Node ${op.nodeId} not found.`); break; }
        if (node.choices.some((choice) => choice.id === op.choice.id)) {
          errors.push(`Choice ${op.choice.id} already exists.`);
          break;
        }
        node.choices.push(structuredClone(op.choice));
        touched.add(op.nodeId);
        break;
      }
      case 'remove_choice': {
        const nodeId = nodeIdFromChoice(op.choiceId);
        const node = nodes.get(nodeId);
        if (!node) { errors.push(`Node ${nodeId} not found.`); break; }
        const before = node.choices.length;
        node.choices = node.choices.filter((choice) => choice.id !== op.choiceId);
        if (node.choices.length === before) errors.push(`Choice ${op.choiceId} not found.`);
        touched.add(nodeId);
        break;
      }
      case 'set_choice_text': {
        const nodeId = nodeIdFromChoice(op.choiceId);
        const node = nodes.get(nodeId);
        const choice = node?.choices.find((candidate) => candidate.id === op.choiceId);
        if (!node || !choice) { errors.push(`Choice ${op.choiceId} not found.`); break; }
        choice.text = op.text;
        touched.add(nodeId);
        break;
      }
      case 'set_choice_next': {
        const nodeId = nodeIdFromChoice(op.choiceId);
        const node = nodes.get(nodeId);
        const choice = node?.choices.find((candidate) => candidate.id === op.choiceId);
        if (!node || !choice) { errors.push(`Choice ${op.choiceId} not found.`); break; }
        if (op.targetNodeId) choice.nextNodeId = op.targetNodeId;
        else delete choice.nextNodeId;
        touched.add(nodeId);
        break;
      }
      case 'add_outcome': {
        const nodeId = nodeIdFromChoice(op.choiceId);
        const node = nodes.get(nodeId);
        const choice = node?.choices.find((candidate) => candidate.id === op.choiceId);
        if (!node || !choice) { errors.push(`Choice ${op.choiceId} not found.`); break; }
        choice.outcomes.push(structuredClone(op.outcome));
        touched.add(nodeId);
        break;
      }
    }
  }

  return { graph: sortGraph(nextGraph), errors, touchedNodeIds: [...touched] };
}

export function describeCopilotOp(op: CopilotPatchOp): string {
  switch (op.op) {
    case 'set_node_title':
      return `${op.nodeId}: title -> "${op.title}"`;
    case 'set_dialogue_text':
      return `${op.nodeId}: dialogue -> "${truncate(op.text)}"`;
    case 'set_speaker_name':
      return `${op.nodeId}: speaker -> "${op.speakerName}"`;
    case 'set_required_world_flag':
      return `${op.nodeId}: guard flag -> ${op.flag ?? 'none'}`;
    case 'set_auto_next':
      return `${op.nodeId}: auto next -> ${op.targetNodeId ?? 'none'}`;
    case 'create_node':
      return `Create node ${op.node.id}`;
    case 'add_choice':
      return `${op.nodeId}: add choice "${truncate(op.choice.text)}"`;
    case 'remove_choice':
      return `Remove choice ${op.choiceId}`;
    case 'set_choice_text':
      return `${op.choiceId}: text -> "${truncate(op.text)}"`;
    case 'set_choice_next':
      return `${op.choiceId}: next -> ${op.targetNodeId ?? 'terminal'}`;
    case 'add_outcome':
      return `${op.choiceId}: add outcome ${op.outcome.type}`;
  }
}

export function buildCopilotContext(
  graph: NarrativeGraph,
  selectedNodeId: NodeId | null,
  report: ValidationReport | null,
  schema: SchemaDraft,
): string {
  const selected = selectedNodeId ? graph.nodes.find((node) => node.id === selectedNodeId) : undefined;
  const issues = report?.issues ?? [];
  const selectedIssues = selected ? issues.filter((issue) => issue.nodeId === selected.id) : [];

  return [
    `Workspace: ${graph.workspaceId}`,
    `Schema: ${schema.name} v${schema.version}`,
    `Graph: ${graph.nodes.length} nodes, ${issues.length} validation issues`,
    selected
      ? `Selected: ${selected.id} / ${selected.speakerName || '(no speaker)'} / ${truncate(selected.dialogueText, 140)}`
      : 'Selected: none',
    selected ? `Choices: ${selected.choices.map((choice) => `${choice.choiceIndex}:${truncate(choice.text, 36)}`).join(' | ') || 'none'}` : '',
    selectedIssues.length > 0 ? `Selected issues: ${selectedIssues.map((issue) => issue.code).join(', ')}` : 'Selected issues: none',
  ].filter(Boolean).join('\n');
}

export function explainValidationIssue(issue: ValidationIssue): string {
  switch (issue.code) {
    case 'broken_edge_choice':
      return 'A choice points to a node that does not exist. Create the missing node, retarget the choice, or remove the choice.';
    case 'broken_edge_auto_continue':
      return 'The auto-continue target is missing. Create that node or clear the auto-next target.';
    case 'missing_required_field':
      return 'A required text field is empty. Fill it before exporting or handing the graph to runtime.';
    case 'unreachable_node':
      return 'The node cannot be reached from the current entry assumptions. Connect it from an entry path or treat it as inactive draft content.';
    case 'flag_required_but_never_set':
      return 'A flag gate is used, but no known outcome sets that flag. Add a setter outcome or revise the requirement.';
    case 'item_required_but_never_given':
      return 'An item requirement is used, but no known outcome gives that item. Add a TakeItem outcome on an earlier path.';
    case 'persona_threshold_may_be_unreachable':
      return 'Persona requirements may be too high for the known positive AdjustPersona outcomes.';
    default:
      return issue.message;
  }
}

export function suggestSchemaNotes(schema: SchemaDraft): string[] {
  const notes: string[] = [];
  for (const entity of schema.entities) {
    const requiredWithoutRule = entity.fields.filter((field) => field.required && !field.rules.some((rule) => rule.kind === 'required'));
    if (requiredWithoutRule.length > 0) {
      notes.push(`${entity.label}: mirror required flags as explicit required rules for ${requiredWithoutRule.map((field) => field.label).join(', ')}.`);
    }
    const nodeRefs = entity.fields.filter((field) => field.type === 'nodeRef');
    if (nodeRefs.length > 0) {
      notes.push(`${entity.label}: node reference fields can use validation rules for missing targets.`);
    }
  }
  if (schema.enums.length === 0) notes.push('Add enums for requirement/outcome style fields so validation can catch typos.');
  return notes.length > 0 ? notes : ['Schema shape looks consistent for the current NPC dialogue MVP.'];
}

export function createQuickProposal(
  kind: CopilotQuickAction,
  graph: NarrativeGraph,
  selectedNodeId: NodeId | null,
  report: ValidationReport | null,
): CopilotProposal | null {
  const selected = selectedNodeId ? graph.nodes.find((node) => node.id === selectedNodeId) : undefined;
  const now = new Date().toISOString();

  if (kind === 'title_selected') {
    if (!selected) return null;
    const title = selected.nodeTitle?.trim()
      ? selected.nodeTitle
      : truncate(`${selected.speakerName || selected.npcId}: ${selected.dialogueText || 'Draft node'}`, 48);
    return {
      id: `proposal_${Date.now().toString(36)}`,
      title: 'Name selected node',
      summary: 'Creates a readable node title from speaker and dialogue text.',
      source: 'quick_action',
      ops: [{ op: 'set_node_title', nodeId: selected.id, title }],
      createdAt: now,
    };
  }

  if (kind === 'terminal_choice') {
    if (!selected) return null;
    const index = nextChoiceIndex(selected);
    const choice: Choice = {
      id: choiceId(selected.id, index),
      nodeId: selected.id,
      choiceIndex: index,
      text: 'Goodbye.',
      requirements: [],
      outcomes: [],
    };
    return {
      id: `proposal_${Date.now().toString(36)}`,
      title: 'Add terminal choice',
      summary: 'Adds a simple terminal exit choice to the selected node.',
      source: 'quick_action',
      ops: [{ op: 'add_choice', nodeId: selected.id, choice }],
      createdAt: now,
    };
  }

  if (kind === 'repair_missing_targets') {
    const ops: CopilotPatchOp[] = [];
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    for (const issue of report?.issues ?? []) {
      for (const fix of issue.fixes ?? []) {
        if (fix.kind !== 'create_node' || nodes.has(fix.targetNodeId) || ops.some((op) => op.op === 'create_node' && op.node.id === fix.targetNodeId)) {
          continue;
        }
        const source = issue.nodeId ? nodes.get(issue.nodeId) : undefined;
        ops.push({ op: 'create_node', node: makePlaceholderNode(fix.targetNodeId, source) });
      }
    }
    if (ops.length === 0) return null;
    return {
      id: `proposal_${Date.now().toString(36)}`,
      title: 'Create missing targets',
      summary: `Creates ${ops.length} placeholder node(s) for broken edge targets.`,
      source: 'quick_action',
      ops,
      createdAt: now,
    };
  }

  const ops: CopilotPatchOp[] = [];
  for (const issue of report?.issues ?? []) {
    if (issue.code !== 'missing_required_field') continue;
    if (issue.choiceId) {
      ops.push({ op: 'set_choice_text', choiceId: issue.choiceId, text: '(Draft choice)' });
      continue;
    }
    if (!issue.nodeId) continue;
    const node = graph.nodes.find((candidate) => candidate.id === issue.nodeId);
    if (!node) continue;
    if (!node.speakerName) ops.push({ op: 'set_speaker_name', nodeId: node.id, speakerName: node.npcId });
    if (!node.dialogueText) ops.push({ op: 'set_dialogue_text', nodeId: node.id, text: '(Draft dialogue)' });
    if (ops.length >= 12) break;
  }
  if (ops.length === 0) return null;
  return {
    id: `proposal_${Date.now().toString(36)}`,
    title: 'Fill empty required fields',
    summary: `Adds draft placeholders for ${ops.length} empty required field(s).`,
    source: 'quick_action',
    ops,
    createdAt: now,
  };
}

