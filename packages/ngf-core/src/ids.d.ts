import type { ChoiceId, NodeId } from './types.js';
export declare function nodeId(npcId: string, nodeIndex: number): NodeId;
export declare function choiceId(node: NodeId, choiceIndex: number): ChoiceId;
export declare function parseNodeId(id: NodeId): {
    npcId: string;
    nodeIndex: number;
};
//# sourceMappingURL=ids.d.ts.map