import type {
  Choice,
  DialogueNode,
  GraphEdge,
  NarrativeGraph,
  NodeId,
} from './types.js';

/** Build a NodeId -> DialogueNode lookup. */
export function indexNodes(graph: NarrativeGraph): Map<NodeId, DialogueNode> {
  const m = new Map<NodeId, DialogueNode>();
  for (const n of graph.nodes) m.set(n.id, n);
  return m;
}

/** Derive the canonical edge list from the graph. */
export function deriveEdges(graph: NarrativeGraph): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const node of graph.nodes) {
    if (node.autoNextNodeId) {
      edges.push({
        id: `${node.id}::auto`,
        type: 'auto_continue',
        sourceNodeId: node.id,
        targetNodeId: node.autoNextNodeId,
      });
    }
    for (const c of node.choices) {
      edges.push({
        id: `${c.id}::edge`,
        type: 'choice',
        sourceNodeId: node.id,
        sourceChoiceId: c.id,
        targetNodeId: c.nextNodeId,
        label: c.text,
      });
    }
  }
  return edges;
}

/** Stable ordering: by npcId, then nodeIndex, then choiceIndex. */
export function sortGraph(graph: NarrativeGraph): NarrativeGraph {
  const nodes = [...graph.nodes].sort((a, b) =>
    a.npcId === b.npcId ? a.nodeIndex - b.nodeIndex : a.npcId.localeCompare(b.npcId),
  );
  for (const n of nodes) {
    n.choices = [...n.choices].sort((a, b) => a.choiceIndex - b.choiceIndex);
    for (const c of n.choices) {
      c.requirements = [...c.requirements].sort((a, b) => a.order - b.order);
      c.outcomes = [...c.outcomes].sort((a, b) => a.order - b.order);
    }
  }
  return { ...graph, nodes };
}

/** Find or create a node when building a graph incrementally. */
export function ensureNode(
  nodes: Map<NodeId, DialogueNode>,
  id: NodeId,
  init: () => DialogueNode,
): DialogueNode {
  let n = nodes.get(id);
  if (!n) {
    n = init();
    nodes.set(id, n);
  }
  return n;
}

/** Find an existing choice on a node (by choiceIndex). */
export function findChoice(node: DialogueNode, choiceIndex: number): Choice | undefined {
  return node.choices.find((c) => c.choiceIndex === choiceIndex);
}
