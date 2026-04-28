import type { DialogueNode } from '@ngf/core';

const COLUMN_GAP = 340;
const ROW_GAP = 210;

export function computeLayout(nodes: DialogueNode[]): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) return new Map();

  const nodeSet = new Set(nodes.map((n) => n.id));

  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    successors.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const n of nodes) {
    const targets = new Set<string>();
    for (const c of n.choices) {
      if (c.nextNodeId && nodeSet.has(c.nextNodeId)) targets.add(c.nextNodeId);
    }
    if (n.autoNextNodeId && nodeSet.has(n.autoNextNodeId)) targets.add(n.autoNextNodeId);

    for (const t of targets) {
      successors.get(n.id)!.push(t);
      inDegree.set(t, (inDegree.get(t) ?? 0) + 1);
    }
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      depth.set(id, 0);
      queue.push(id);
    }
  }

  // If everything is in a cycle, start from the first node
  if (queue.length === 0 && nodes[0]) {
    depth.set(nodes[0].id, 0);
    queue.push(nodes[0].id);
  }

  let qi = 0;
  while (qi < queue.length) {
    const id = queue[qi++]!;
    const d = depth.get(id)!;
    for (const next of successors.get(id) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }

  const maxDepth = depth.size > 0 ? Math.max(...depth.values()) : 0;
  for (const n of nodes) {
    if (!depth.has(n.id)) depth.set(n.id, maxDepth + 1);
  }

  const groups = new Map<number, string[]>();
  for (const [id, d] of depth) {
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(id);
  }
  for (const group of groups.values()) group.sort();

  const positions = new Map<string, { x: number; y: number }>();
  for (const [d, group] of groups) {
    const totalHeight = group.length * ROW_GAP;
    const startY = -totalHeight / 2;
    group.forEach((id, i) => {
      positions.set(id, { x: d * COLUMN_GAP, y: startY + i * ROW_GAP });
    });
  }

  return positions;
}
