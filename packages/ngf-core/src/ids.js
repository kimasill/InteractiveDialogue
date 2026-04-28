export function nodeId(npcId, nodeIndex) {
    return `${npcId}:${nodeIndex}`;
}
export function choiceId(node, choiceIndex) {
    return `${node}:c${choiceIndex}`;
}
export function parseNodeId(id) {
    const lastColon = id.lastIndexOf(':');
    if (lastColon < 0)
        throw new Error(`invalid NodeId: ${id}`);
    const npcId = id.slice(0, lastColon);
    const idxRaw = id.slice(lastColon + 1);
    const nodeIndex = Number.parseInt(idxRaw, 10);
    if (!Number.isFinite(nodeIndex))
        throw new Error(`invalid NodeId index: ${id}`);
    return { npcId, nodeIndex };
}
//# sourceMappingURL=ids.js.map