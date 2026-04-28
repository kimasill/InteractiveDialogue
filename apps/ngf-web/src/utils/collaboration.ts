import type { Choice, DialogueNode, NarrativeGraph, NodeId } from '@ngf/core';

export type CollaborationActor = 'user' | 'ai' | 'system';
export type CollaborationRole = 'viewer' | 'editor' | 'reviewer' | 'owner';
export type ReviewCommentStatus = 'open' | 'resolved';
export type GraphDiffKind = 'added' | 'removed' | 'changed';

export interface GraphSnapshot {
  id: string;
  label: string;
  graph: NarrativeGraph;
  createdAt: string;
  actor: CollaborationActor;
  branchId: string;
}

export interface GraphBranch {
  id: string;
  name: string;
  graph: NarrativeGraph;
  baseSnapshotId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  actor: CollaborationActor;
  action: string;
  detail: string;
  createdAt: string;
}

export interface ReviewComment {
  id: string;
  nodeId: NodeId | null;
  body: string;
  status: ReviewCommentStatus;
  author: CollaborationActor;
  createdAt: string;
  resolvedAt?: string;
}

export interface GraphDiffItem {
  kind: GraphDiffKind;
  subject: string;
  detail: string;
}

export interface CollaborationState {
  activeBranchId: string;
  role: CollaborationRole;
  snapshots: GraphSnapshot[];
  branches: GraphBranch[];
  comments: ReviewComment[];
  auditLog: AuditEntry[];
}

export const DEFAULT_BRANCH_ID = 'main';

export function createInitialCollaborationState(): CollaborationState {
  const now = new Date().toISOString();
  return {
    activeBranchId: DEFAULT_BRANCH_ID,
    role: 'owner',
    snapshots: [],
    branches: [
      {
        id: DEFAULT_BRANCH_ID,
        name: 'main',
        graph: { workspaceId: 'ws-empty', schemaVersionId: 'schema-empty', nodes: [] },
        createdAt: now,
        updatedAt: now,
      },
    ],
    comments: [],
    auditLog: [
      {
        id: createLocalId('audit'),
        actor: 'system',
        action: 'init',
        detail: 'Initialized local collaboration workspace.',
        createdAt: now,
      },
    ],
  };
}

export function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function cloneGraph(graph: NarrativeGraph): NarrativeGraph {
  return JSON.parse(JSON.stringify(graph)) as NarrativeGraph;
}

export function canEdit(role: CollaborationRole): boolean {
  return role === 'editor' || role === 'owner';
}

export function canReview(role: CollaborationRole): boolean {
  return role === 'reviewer' || role === 'editor' || role === 'owner';
}

function choiceSignature(choice: Choice): string {
  return JSON.stringify({
    text: choice.text,
    nextNodeId: choice.nextNodeId,
    requiredWorldFlag: choice.requiredWorldFlag,
    blockingWorldFlag: choice.blockingWorldFlag,
    requirements: choice.requirements,
    outcomes: choice.outcomes,
  });
}

function nodeSignature(node: DialogueNode): string {
  return JSON.stringify({
    nodeTitle: node.nodeTitle,
    speakerName: node.speakerName,
    dialogueText: node.dialogueText,
    requiredWorldFlag: node.requiredWorldFlag,
    autoNextNodeId: node.autoNextNodeId,
    choices: node.choices.map(choiceSignature),
  });
}

export function diffGraphs(previous: NarrativeGraph | null, next: NarrativeGraph | null): GraphDiffItem[] {
  if (!previous && !next) return [];
  if (!previous && next) {
    return next.nodes.map((node) => ({ kind: 'added', subject: node.id, detail: 'Node added.' }));
  }
  if (previous && !next) {
    return previous.nodes.map((node) => ({ kind: 'removed', subject: node.id, detail: 'Node removed.' }));
  }

  const before = new Map(previous!.nodes.map((node) => [node.id, node]));
  const after = new Map(next!.nodes.map((node) => [node.id, node]));
  const diff: GraphDiffItem[] = [];

  for (const node of next!.nodes) {
    const old = before.get(node.id);
    if (!old) {
      diff.push({ kind: 'added', subject: node.id, detail: 'Node added.' });
      continue;
    }
    if (nodeSignature(old) !== nodeSignature(node)) {
      const choiceDelta = node.choices.length - old.choices.length;
      const details = [
        old.dialogueText !== node.dialogueText ? 'dialogue changed' : '',
        old.speakerName !== node.speakerName ? 'speaker changed' : '',
        old.autoNextNodeId !== node.autoNextNodeId ? 'auto-next changed' : '',
        choiceDelta !== 0 ? `choices ${choiceDelta > 0 ? '+' : ''}${choiceDelta}` : '',
      ].filter(Boolean);
      diff.push({ kind: 'changed', subject: node.id, detail: details.join(', ') || 'Node data changed.' });
    }
  }

  for (const node of previous!.nodes) {
    if (!after.has(node.id)) diff.push({ kind: 'removed', subject: node.id, detail: 'Node removed.' });
  }

  return diff;
}

export function summarizeDiff(diff: GraphDiffItem[]): string {
  const added = diff.filter((item) => item.kind === 'added').length;
  const changed = diff.filter((item) => item.kind === 'changed').length;
  const removed = diff.filter((item) => item.kind === 'removed').length;
  return `${added} added, ${changed} changed, ${removed} removed`;
}

export function updateBranchGraph(
  branches: GraphBranch[],
  branchId: string,
  graph: NarrativeGraph,
): GraphBranch[] {
  const now = new Date().toISOString();
  return branches.map((branch) =>
    branch.id === branchId ? { ...branch, graph: cloneGraph(graph), updatedAt: now } : branch,
  );
}
