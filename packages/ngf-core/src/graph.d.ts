import type { Choice, DialogueNode, GraphEdge, NarrativeGraph, NodeId } from './types.js';
/** Build a NodeId -> DialogueNode lookup. */
export declare function indexNodes(graph: NarrativeGraph): Map<NodeId, DialogueNode>;
/** Derive the canonical edge list from the graph. */
export declare function deriveEdges(graph: NarrativeGraph): GraphEdge[];
/** Stable ordering: by npcId, then nodeIndex, then choiceIndex. */
export declare function sortGraph(graph: NarrativeGraph): NarrativeGraph;
/** Find or create a node when building a graph incrementally. */
export declare function ensureNode(nodes: Map<NodeId, DialogueNode>, id: NodeId, init: () => DialogueNode): DialogueNode;
/** Find an existing choice on a node (by choiceIndex). */
export declare function findChoice(node: DialogueNode, choiceIndex: number): Choice | undefined;
//# sourceMappingURL=graph.d.ts.map