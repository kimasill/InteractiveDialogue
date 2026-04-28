import type { Choice, DialogueNode, NodeId, ChoiceId } from '@ngf/core';

export type PatchOp =
  | { op: 'set_position'; nodeId: NodeId; x: number; y: number }
  | { op: 'set_node_title'; nodeId: NodeId; title: string }
  | { op: 'set_dialogue_text'; nodeId: NodeId; text: string }
  | { op: 'set_speaker_name'; nodeId: NodeId; speakerName: string }
  | { op: 'set_required_world_flag'; nodeId: NodeId; flag: string | null }
  | { op: 'set_auto_next'; nodeId: NodeId; targetNodeId: NodeId | null }
  | { op: 'create_node'; node: DialogueNode }
  | { op: 'delete_node'; nodeId: NodeId }
  | { op: 'add_choice'; nodeId: NodeId; choice: Choice }
  | { op: 'remove_choice'; choiceId: ChoiceId }
  | { op: 'set_choice_text'; choiceId: ChoiceId; text: string }
  | { op: 'set_choice_next'; choiceId: ChoiceId; targetNodeId: NodeId | null };

export interface PatchResult {
  ok: boolean;
  errors: string[];
  /** Nodes whose data changed (so callers know what to persist). */
  dirtyNodeIds: NodeId[];
}

export function applyPatch(nodes: DialogueNode[], ops: PatchOp[]): PatchResult {
  const map = new Map<NodeId, DialogueNode>(nodes.map((n) => [n.id, structuredClone(n)]));
  const errors: string[] = [];
  const dirty = new Set<NodeId>();

  for (const op of ops) {
    switch (op.op) {
      case 'set_position': {
        const node = map.get(op.nodeId);
        if (!node) { errors.push(`set_position: node ${op.nodeId} not found`); break; }
        node.position = { x: op.x, y: op.y };
        dirty.add(op.nodeId);
        break;
      }
      case 'set_node_title': {
        const node = map.get(op.nodeId);
        if (!node) { errors.push(`set_node_title: node ${op.nodeId} not found`); break; }
        node.nodeTitle = op.title;
        dirty.add(op.nodeId);
        break;
      }
      case 'set_dialogue_text': {
        const node = map.get(op.nodeId);
        if (!node) { errors.push(`set_dialogue_text: node ${op.nodeId} not found`); break; }
        node.dialogueText = op.text;
        dirty.add(op.nodeId);
        break;
      }
      case 'set_speaker_name': {
        const node = map.get(op.nodeId);
        if (!node) { errors.push(`set_speaker_name: node ${op.nodeId} not found`); break; }
        node.speakerName = op.speakerName;
        dirty.add(op.nodeId);
        break;
      }
      case 'set_required_world_flag': {
        const node = map.get(op.nodeId);
        if (!node) { errors.push(`set_required_world_flag: node ${op.nodeId} not found`); break; }
        if (op.flag === null) delete node.requiredWorldFlag;
        else node.requiredWorldFlag = op.flag;
        dirty.add(op.nodeId);
        break;
      }
      case 'set_auto_next': {
        const node = map.get(op.nodeId);
        if (!node) { errors.push(`set_auto_next: node ${op.nodeId} not found`); break; }
        if (op.targetNodeId === null) delete node.autoNextNodeId;
        else node.autoNextNodeId = op.targetNodeId;
        dirty.add(op.nodeId);
        break;
      }
      case 'create_node': {
        if (map.has(op.node.id)) {
          errors.push(`create_node: node ${op.node.id} already exists`);
          break;
        }
        map.set(op.node.id, structuredClone(op.node));
        dirty.add(op.node.id);
        break;
      }
      case 'delete_node': {
        if (!map.has(op.nodeId)) { errors.push(`delete_node: node ${op.nodeId} not found`); break; }
        map.delete(op.nodeId);
        dirty.add(op.nodeId); // callers use 'not in map' to detect deletion
        break;
      }
      case 'add_choice': {
        const node = map.get(op.nodeId);
        if (!node) { errors.push(`add_choice: node ${op.nodeId} not found`); break; }
        node.choices.push(structuredClone(op.choice));
        dirty.add(op.nodeId);
        break;
      }
      case 'remove_choice': {
        const nodeId = op.choiceId.split(':c')[0]!;
        const node = map.get(nodeId);
        if (!node) { errors.push(`remove_choice: node ${nodeId} not found`); break; }
        const before = node.choices.length;
        node.choices = node.choices.filter((c) => c.id !== op.choiceId);
        if (node.choices.length === before) errors.push(`remove_choice: choice ${op.choiceId} not found`);
        dirty.add(nodeId);
        break;
      }
      case 'set_choice_text': {
        const nodeId = op.choiceId.split(':c')[0]!;
        const node = map.get(nodeId);
        if (!node) { errors.push(`set_choice_text: node ${nodeId} not found`); break; }
        const choice = node.choices.find((c) => c.id === op.choiceId);
        if (!choice) { errors.push(`set_choice_text: choice ${op.choiceId} not found`); break; }
        choice.text = op.text;
        dirty.add(nodeId);
        break;
      }
      case 'set_choice_next': {
        const nodeId = op.choiceId.split(':c')[0]!;
        const node = map.get(nodeId);
        if (!node) { errors.push(`set_choice_next: node ${nodeId} not found`); break; }
        const choice = node.choices.find((c) => c.id === op.choiceId);
        if (!choice) { errors.push(`set_choice_next: choice ${op.choiceId} not found`); break; }
        if (op.targetNodeId === null) delete choice.nextNodeId;
        else choice.nextNodeId = op.targetNodeId;
        dirty.add(nodeId);
        break;
      }
    }
  }

  // Write back to original array
  for (const [id, node] of map) {
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx >= 0) nodes[idx] = node;
    else nodes.push(node);
  }
  // Remove deleted nodes
  const keep = new Set(map.keys());
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (!keep.has(nodes[i]!.id)) nodes.splice(i, 1);
  }

  return { ok: errors.length === 0, errors, dirtyNodeIds: [...dirty] };
}
