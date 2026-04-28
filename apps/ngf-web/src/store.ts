import { create } from 'zustand';
import { validate } from '@kimasill/ngf-validate';
import { choiceId, parseNodeId, sortGraph } from '@kimasill/ngf-core';
import type { Choice, ChoiceId, DialogueNode, NarrativeGraph, NodeId, Outcome, Requirement } from '@kimasill/ngf-core';
import type { ValidationFix, ValidationReport } from '@kimasill/ngf-validate';
import { computeLayout } from './utils/layout';
import {
  applyOutcomes,
  chooseNextNodeId,
  createEmptyPlayerState,
  evaluateChoice,
  indexGraph,
  resolveEntryNode,
  type ChoiceEvaluation,
  type PlaytestTraceEntry,
  type SerializablePlayerState,
} from './utils/playtest';
import {
  DEFAULT_GRAPH_VIEW,
  computeBranchLaneLayout,
  type GraphViewKey,
  type GraphViewState,
} from './utils/graphUx';
import {
  DEFAULT_SCHEMA_DRAFT,
  cloneSchemaDraft,
  createField,
  createRule,
  defaultWidgetForType,
  diffSchemaDraft,
  type MigrationChange,
  type SchemaDraft,
  type SchemaField,
  type SchemaFieldType,
  type SchemaRuleKind,
} from './utils/schemaDraft';
import {
  applyCopilotPatch,
  buildCopilotContext,
  createQuickProposal,
  explainValidationIssue,
  suggestSchemaNotes,
  type CopilotProposal,
  type CopilotQuickAction,
} from './utils/copilot';
import {
  DEFAULT_BRANCH_ID,
  canEdit,
  canReview,
  cloneGraph,
  createInitialCollaborationState,
  createLocalId,
  diffGraphs,
  summarizeDiff,
  updateBranchGraph,
  type AuditEntry,
  type CollaborationActor,
  type CollaborationRole,
  type CollaborationState,
  type GraphDiffItem,
  type GraphSnapshot,
  type ReviewComment,
} from './utils/collaboration';

export interface ImportSummary {
  sourceName: string;
  inputRows: number;
  nodeCount: number;
  issueCount: number;
}

export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface AppState {
  graph: NarrativeGraph | null;
  selectedNodeId: NodeId | null;
  report: ValidationReport | null;
  importSummary: ImportSummary | null;
  importError: string | null;
  playtest: {
    currentNodeId: NodeId | null;
    playerState: SerializablePlayerState;
    trace: PlaytestTraceEntry[];
    message: string | null;
  };
  graphView: GraphViewState;
  schemaDraft: SchemaDraft;
  schemaBaseline: SchemaDraft;
  collaboration: CollaborationState;
  copilot: {
    apiKey: string;
    model: string;
    messages: CopilotMessage[];
    proposal: CopilotProposal | null;
    status: string | null;
    requireValidationGate: boolean;
  };

  importGraph: (graph: NarrativeGraph, summary?: Omit<ImportSummary, 'nodeCount'>) => void;
  replaceGraph: (graph: NarrativeGraph) => void;
  setImportError: (message: string | null) => void;
  applyAutoLayout: () => void;
  applyBranchLaneLayout: () => void;
  toggleGraphView: (key: GraphViewKey) => void;
  toggleSelectedCollapse: () => void;
  toggleSelectedLock: () => void;
  updateNodePosition: (nodeId: NodeId, position: { x: number; y: number }) => void;
  setSchemaName: (name: string) => void;
  addSchemaEntity: (name: string) => void;
  updateSchemaEntity: (entityId: string, patch: { name?: string; label?: string }) => void;
  removeSchemaEntity: (entityId: string) => void;
  addSchemaField: (entityId: string, name: string, type?: SchemaFieldType) => void;
  updateSchemaField: (entityId: string, fieldId: string, patch: Partial<SchemaField>) => void;
  removeSchemaField: (entityId: string, fieldId: string) => void;
  addSchemaEnum: (name: string) => void;
  updateSchemaEnum: (enumId: string, patch: { name?: string; values?: string[] }) => void;
  removeSchemaEnum: (enumId: string) => void;
  addSchemaRule: (entityId: string, fieldId: string, kind?: SchemaRuleKind) => void;
  removeSchemaRule: (entityId: string, fieldId: string, ruleId: string) => void;
  updateSchemaRule: (entityId: string, fieldId: string, ruleId: string, patch: { kind?: SchemaRuleKind; value?: string; message?: string }) => void;
  commitSchemaVersion: () => void;
  getSchemaMigrationPreview: () => MigrationChange[];
  setCopilotApiKey: (apiKey: string) => void;
  setCopilotModel: (model: string) => void;
  setCopilotValidationGate: (enabled: boolean) => void;
  askCopilot: (prompt: string) => void;
  createCopilotProposal: (kind: CopilotQuickAction) => void;
  rejectCopilotProposal: () => void;
  applyCopilotProposal: () => void;
  setCollaborationRole: (role: CollaborationRole) => void;
  createSnapshot: (label: string, actor?: CollaborationActor) => void;
  restoreSnapshot: (snapshotId: string) => void;
  createBranch: (name: string) => void;
  switchBranch: (branchId: string) => void;
  addReviewComment: (body: string, nodeId?: NodeId | null, actor?: CollaborationActor) => void;
  resolveReviewComment: (commentId: string) => void;
  getActiveDiff: () => GraphDiffItem[];
  updateNode: (nodeId: NodeId, patch: Partial<DialogueNode>) => void;
  replaceNode: (nodeId: NodeId, node: DialogueNode) => void;
  updateChoice: (choiceId: ChoiceId, patch: Partial<Choice>) => void;
  retargetChoice: (choiceId: ChoiceId, targetNodeId: NodeId | null) => void;
  retargetAutoNext: (nodeId: NodeId, targetNodeId: NodeId | null) => void;
  addRequirement: (choiceId: ChoiceId) => void;
  updateRequirement: (choiceId: ChoiceId, index: number, patch: Partial<Requirement>) => void;
  removeRequirement: (choiceId: ChoiceId, index: number) => void;
  addOutcome: (choiceId: ChoiceId) => void;
  updateOutcome: (choiceId: ChoiceId, index: number, patch: Partial<Outcome>) => void;
  removeOutcome: (choiceId: ChoiceId, index: number) => void;
  applyValidationFix: (fix: ValidationFix, context?: { nodeId?: NodeId; targetNodeId?: NodeId }) => void;
  startPlaytest: (startNodeId?: NodeId | null) => void;
  resetPlaytest: () => void;
  setPlaytestPersona: (persona: number) => void;
  setPlaytestWorldFlag: (flag: string, value: number) => void;
  removePlaytestWorldFlag: (flag: string) => void;
  addPlaytestItemTag: (tag: string) => void;
  removePlaytestItemTag: (tag: string) => void;
  choosePlaytestChoice: (choiceId: ChoiceId) => void;
  advancePlaytestAuto: () => void;
  getPlaytestChoices: () => ChoiceEvaluation[];
  selectNode: (id: NodeId | null) => void;
  runValidation: () => void;
}

function validateGraph(graph: NarrativeGraph): Pick<AppState, 'graph' | 'report'> {
  return { graph, report: validate(graph) };
}

function audit(action: string, detail: string, actor: CollaborationActor = 'user'): AuditEntry {
  return { id: createLocalId('audit'), actor, action, detail, createdAt: new Date().toISOString() };
}

function syncCollaborationGraph(
  collaboration: CollaborationState,
  graph: NarrativeGraph,
  entry: AuditEntry,
): CollaborationState {
  return {
    ...collaboration,
    branches: updateBranchGraph(collaboration.branches, collaboration.activeBranchId, graph),
    auditLog: [entry, ...collaboration.auditLog].slice(0, 80),
  };
}

function updateGraphNode(
  graph: NarrativeGraph,
  nodeId: NodeId,
  updater: (node: DialogueNode) => DialogueNode,
): NarrativeGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
  };
}

function updateGraphChoice(
  graph: NarrativeGraph,
  choiceId: ChoiceId,
  updater: (choice: Choice) => Choice,
): NarrativeGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!node.choices.some((choice) => choice.id === choiceId)) return node;
      return {
        ...node,
        choices: node.choices.map((choice) => (choice.id === choiceId ? updater(choice) : choice)),
      };
    }),
  };
}

function nextChildOrder(items: { order: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((item) => item.order)) + 1;
}

function nodeIdFromChoiceId(id: ChoiceId): NodeId {
  return id.split(':c')[0] as NodeId;
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
    speakerName: source?.speakerName ?? '',
    dialogueText: '',
    choices: [],
    position: sourcePosition ? { x: sourcePosition.x + 340, y: sourcePosition.y } : undefined,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  graph: null,
  selectedNodeId: null,
  report: null,
  importSummary: null,
  importError: null,
  playtest: {
    currentNodeId: null,
    playerState: createEmptyPlayerState(),
    trace: [],
    message: null,
  },
  graphView: DEFAULT_GRAPH_VIEW,
  schemaDraft: cloneSchemaDraft(DEFAULT_SCHEMA_DRAFT),
  schemaBaseline: cloneSchemaDraft(DEFAULT_SCHEMA_DRAFT),
  collaboration: createInitialCollaborationState(),
  copilot: {
    apiKey: '',
    model: 'local-draft-copilot',
    messages: [
      {
        role: 'assistant',
        content: 'Ready. I can explain validation issues, summarize the selected node, suggest schema improvements, or draft patch proposals from quick actions.',
        createdAt: new Date().toISOString(),
      },
    ],
    proposal: null,
    status: null,
    requireValidationGate: true,
  },

  importGraph(graph, summary) {
    const collaboration = get().collaboration;
    set({
      ...validateGraph(graph),
      selectedNodeId: null,
      importError: null,
      importSummary: summary
        ? {
            ...summary,
            nodeCount: graph.nodes.length,
          }
        : null,
      collaboration: syncCollaborationGraph(
        collaboration,
        graph,
        audit('import_graph', `Imported ${graph.nodes.length} node(s).`, 'user'),
      ),
    });
  },

  replaceGraph(graph) {
    const { collaboration } = get();
    set({
      ...validateGraph(graph),
      collaboration: syncCollaborationGraph(
        collaboration,
        graph,
        audit('replace_graph', `Replaced graph: ${graph.nodes.length} node(s).`, 'user'),
      ),
    });
  },

  setImportError(message) {
    set({ importError: message });
  },

  applyAutoLayout() {
    const { graph } = get();
    if (!graph) return;

    const layout = computeLayout(graph.nodes);
    const nodes = graph.nodes.map((node) => {
      const position = layout.get(node.id);
      return position ? { ...node, position } : node;
    });

    set({ graph: { ...graph, nodes } });
  },

  applyBranchLaneLayout() {
    const { graph } = get();
    if (!graph) return;

    const layout = computeBranchLaneLayout(graph.nodes);
    const nodes = graph.nodes.map((node) => {
      if (node.uiState?.lockedPosition) return node;
      const position = layout.get(node.id);
      return position ? { ...node, position } : node;
    });

    set({ graph: { ...graph, nodes } });
  },

  toggleGraphView(key) {
    const { graphView } = get();
    set({ graphView: { ...graphView, [key]: !graphView[key] } });
  },

  toggleSelectedCollapse() {
    const { graph, selectedNodeId } = get();
    if (!graph || !selectedNodeId) return;
    const nextGraph = updateGraphNode(graph, selectedNodeId, (node) => ({
      ...node,
      uiState: {
        ...node.uiState,
        collapsed: !node.uiState?.collapsed,
      },
    }));
    set(validateGraph(nextGraph));
  },

  toggleSelectedLock() {
    const { graph, selectedNodeId } = get();
    if (!graph || !selectedNodeId) return;
    const nextGraph = updateGraphNode(graph, selectedNodeId, (node) => ({
      ...node,
      uiState: {
        ...node.uiState,
        lockedPosition: !node.uiState?.lockedPosition,
      },
    }));
    set(validateGraph(nextGraph));
  },

  updateNodePosition(nodeId, position) {
    const { graph } = get();
    if (!graph) return;
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (node?.uiState?.lockedPosition) return;
    const nextGraph = updateGraphNode(graph, nodeId, (candidate) => ({ ...candidate, position }));
    set({ graph: nextGraph });
  },

  setSchemaName(name) {
    const { schemaDraft } = get();
    set({ schemaDraft: { ...schemaDraft, name } });
  },

  addSchemaEntity(name) {
    const { schemaDraft } = get();
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || `entity_${schemaDraft.entities.length + 1}`;
    set({
      schemaDraft: {
        ...schemaDraft,
        entities: [...schemaDraft.entities, { id, name: name.trim() || 'NewEntity', label: name.trim() || 'New Entity', fields: [] }],
      },
    });
  },

  updateSchemaEntity(entityId, patch) {
    const { schemaDraft } = get();
    set({
      schemaDraft: {
        ...schemaDraft,
        entities: schemaDraft.entities.map((entity) => (entity.id === entityId ? { ...entity, ...patch } : entity)),
      },
    });
  },

  removeSchemaEntity(entityId) {
    const { schemaDraft } = get();
    set({ schemaDraft: { ...schemaDraft, entities: schemaDraft.entities.filter((entity) => entity.id !== entityId) } });
  },

  addSchemaField(entityId, name, type = 'string') {
    const { schemaDraft } = get();
    set({
      schemaDraft: {
        ...schemaDraft,
        entities: schemaDraft.entities.map((entity) =>
          entity.id === entityId ? { ...entity, fields: [...entity.fields, createField(name, type)] } : entity,
        ),
      },
    });
  },

  updateSchemaField(entityId, fieldId, patch) {
    const { schemaDraft } = get();
    set({
      schemaDraft: {
        ...schemaDraft,
        entities: schemaDraft.entities.map((entity) =>
          entity.id === entityId
            ? {
                ...entity,
                fields: entity.fields.map((field) =>
                  field.id === fieldId
                    ? {
                        ...field,
                        ...patch,
                        widget: patch.type && !patch.widget ? defaultWidgetForType(patch.type) : patch.widget ?? field.widget,
                      }
                    : field,
                ),
              }
            : entity,
        ),
      },
    });
  },

  removeSchemaField(entityId, fieldId) {
    const { schemaDraft } = get();
    set({
      schemaDraft: {
        ...schemaDraft,
        entities: schemaDraft.entities.map((entity) =>
          entity.id === entityId ? { ...entity, fields: entity.fields.filter((field) => field.id !== fieldId) } : entity,
        ),
      },
    });
  },

  addSchemaEnum(name) {
    const { schemaDraft } = get();
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || `enum_${schemaDraft.enums.length + 1}`;
    set({ schemaDraft: { ...schemaDraft, enums: [...schemaDraft.enums, { id, name: name.trim() || 'NewEnum', values: ['None'] }] } });
  },

  updateSchemaEnum(enumId, patch) {
    const { schemaDraft } = get();
    set({
      schemaDraft: {
        ...schemaDraft,
        enums: schemaDraft.enums.map((item) => (item.id === enumId ? { ...item, ...patch } : item)),
      },
    });
  },

  removeSchemaEnum(enumId) {
    const { schemaDraft } = get();
    set({ schemaDraft: { ...schemaDraft, enums: schemaDraft.enums.filter((item) => item.id !== enumId) } });
  },

  addSchemaRule(entityId, fieldId, kind = 'required') {
    const { schemaDraft } = get();
    set({
      schemaDraft: {
        ...schemaDraft,
        entities: schemaDraft.entities.map((entity) =>
          entity.id === entityId
            ? {
                ...entity,
                fields: entity.fields.map((field) =>
                  field.id === fieldId ? { ...field, rules: [...field.rules, createRule(kind)] } : field,
                ),
              }
            : entity,
        ),
      },
    });
  },

  removeSchemaRule(entityId, fieldId, ruleId) {
    const { schemaDraft } = get();
    set({
      schemaDraft: {
        ...schemaDraft,
        entities: schemaDraft.entities.map((entity) =>
          entity.id === entityId
            ? {
                ...entity,
                fields: entity.fields.map((field) =>
                  field.id === fieldId ? { ...field, rules: field.rules.filter((rule) => rule.id !== ruleId) } : field,
                ),
              }
            : entity,
        ),
      },
    });
  },

  updateSchemaRule(entityId, fieldId, ruleId, patch) {
    const { schemaDraft } = get();
    set({
      schemaDraft: {
        ...schemaDraft,
        entities: schemaDraft.entities.map((entity) =>
          entity.id === entityId
            ? {
                ...entity,
                fields: entity.fields.map((field) =>
                  field.id === fieldId
                    ? { ...field, rules: field.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)) }
                    : field,
                ),
              }
            : entity,
        ),
      },
    });
  },

  commitSchemaVersion() {
    const { schemaDraft } = get();
    const next = { ...schemaDraft, version: schemaDraft.version + 1 };
    set({ schemaDraft: cloneSchemaDraft(next), schemaBaseline: cloneSchemaDraft(next) });
  },

  getSchemaMigrationPreview() {
    const { schemaBaseline, schemaDraft } = get();
    return diffSchemaDraft(schemaBaseline, schemaDraft);
  },

  setCopilotApiKey(apiKey) {
    const { copilot } = get();
    set({ copilot: { ...copilot, apiKey } });
  },

  setCopilotModel(model) {
    const { copilot } = get();
    set({ copilot: { ...copilot, model } });
  },

  setCopilotValidationGate(enabled) {
    const { copilot } = get();
    set({ copilot: { ...copilot, requireValidationGate: enabled } });
  },

  askCopilot(prompt) {
    const { graph, selectedNodeId, report, schemaDraft, copilot } = get();
    const text = prompt.trim();
    if (!text) return;

    const createdAt = new Date().toISOString();
    let content = 'Import or create a graph first so I can build a useful context.';

    if (graph) {
      const lower = text.toLowerCase();
      const context = buildCopilotContext(graph, selectedNodeId, report, schemaDraft);
      const issues = report?.issues ?? [];
      const selectedIssues = selectedNodeId ? issues.filter((issue) => issue.nodeId === selectedNodeId) : issues;

      if (lower.includes('schema')) {
        content = suggestSchemaNotes(schemaDraft).join('\n');
      } else if (lower.includes('validation') || lower.includes('issue') || lower.includes('error')) {
        const top = selectedIssues[0] ?? issues[0];
        content = top
          ? `${top.code}: ${explainValidationIssue(top)}\nSubject: ${top.nodeId ?? 'graph'}${top.choiceId ? ` / ${top.choiceId}` : ''}`
          : 'No validation issues are currently reported.';
      } else if (lower.includes('patch') || lower.includes('fix')) {
        content = 'Use a quick action to generate a patch proposal, then review the diff and approve it. I will run the validation gate before applying.';
      } else {
        content = context;
      }
    }

    set({
      copilot: {
        ...copilot,
        status: null,
        messages: [
          ...copilot.messages,
          { role: 'user', content: text, createdAt },
          { role: 'assistant', content, createdAt: new Date().toISOString() },
        ],
      },
    });
  },

  createCopilotProposal(kind) {
    const { graph, selectedNodeId, report, copilot } = get();
    if (!graph) {
      set({ copilot: { ...copilot, status: 'Import a graph before asking for a patch proposal.' } });
      return;
    }
    const proposal = createQuickProposal(kind, graph, selectedNodeId, report);
    set({
      copilot: {
        ...copilot,
        proposal,
        status: proposal ? `Drafted proposal: ${proposal.title}.` : 'No matching changes were found for that quick action.',
      },
    });
  },

  rejectCopilotProposal() {
    const { copilot } = get();
    set({ copilot: { ...copilot, proposal: null, status: 'Proposal discarded.' } });
  },

  applyCopilotProposal() {
    const { graph, report, copilot, collaboration } = get();
    if (!graph || !copilot.proposal) return;

    const result = applyCopilotPatch(graph, copilot.proposal.ops);
    if (result.errors.length > 0) {
      set({ copilot: { ...copilot, status: `Patch rejected: ${result.errors.join(' ')}` } });
      return;
    }

    const nextReport = validate(result.graph);
    const currentErrorCount = report?.errorCount ?? validate(graph).errorCount;
    if (copilot.requireValidationGate && nextReport.errorCount > currentErrorCount) {
      set({
        copilot: {
          ...copilot,
          status: `Patch blocked by validation gate: errors would increase from ${currentErrorCount} to ${nextReport.errorCount}.`,
        },
      });
      return;
    }

    set({
      graph: result.graph,
      report: nextReport,
      selectedNodeId: result.touchedNodeIds[0] ?? get().selectedNodeId,
      collaboration: syncCollaborationGraph(
        collaboration,
        result.graph,
        audit('apply_ai_patch', `${copilot.proposal.title}: ${summarizeDiff(diffGraphs(graph, result.graph))}.`, 'ai'),
      ),
      copilot: {
        ...copilot,
        proposal: null,
        status: `Applied ${result.touchedNodeIds.length} node change(s). Validation: ${nextReport.errorCount} errors, ${nextReport.warningCount} warnings.`,
      },
    });
  },

  setCollaborationRole(role) {
    const { collaboration } = get();
    set({
      collaboration: {
        ...collaboration,
        role,
        auditLog: [audit('set_role', `Local role changed to ${role}.`, 'system'), ...collaboration.auditLog].slice(0, 80),
      },
    });
  },

  createSnapshot(label, actor = 'user') {
    const { graph, collaboration } = get();
    if (!graph || !canReview(collaboration.role)) return;
    const snapshot: GraphSnapshot = {
      id: createLocalId('snapshot'),
      label: label.trim() || `Snapshot ${collaboration.snapshots.length + 1}`,
      graph: cloneGraph(graph),
      createdAt: new Date().toISOString(),
      actor,
      branchId: collaboration.activeBranchId,
    };
    set({
      collaboration: {
        ...collaboration,
        snapshots: [snapshot, ...collaboration.snapshots].slice(0, 50),
        auditLog: [audit('snapshot', `Created snapshot "${snapshot.label}".`, actor), ...collaboration.auditLog].slice(0, 80),
      },
    });
  },

  restoreSnapshot(snapshotId) {
    const { collaboration } = get();
    if (!canEdit(collaboration.role)) return;
    const snapshot = collaboration.snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return;
    const graph = cloneGraph(snapshot.graph);
    set({
      ...validateGraph(graph),
      selectedNodeId: null,
      collaboration: syncCollaborationGraph(
        collaboration,
        graph,
        audit('rollback', `Restored snapshot "${snapshot.label}".`, 'user'),
      ),
    });
  },

  createBranch(name) {
    const { graph, collaboration } = get();
    if (!graph || !canEdit(collaboration.role)) return;
    const branchName = name.trim() || `branch-${collaboration.branches.length + 1}`;
    const branch = {
      id: createLocalId('branch'),
      name: branchName,
      graph: cloneGraph(graph),
      baseSnapshotId: collaboration.snapshots[0]?.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({
      collaboration: {
        ...collaboration,
        activeBranchId: branch.id,
        branches: [...collaboration.branches, branch],
        auditLog: [audit('create_branch', `Created branch "${branch.name}".`, 'user'), ...collaboration.auditLog].slice(0, 80),
      },
    });
  },

  switchBranch(branchId) {
    const { collaboration } = get();
    const branch = collaboration.branches.find((item) => item.id === branchId);
    if (!branch) return;
    const graph = cloneGraph(branch.graph);
    set({
      ...validateGraph(graph),
      selectedNodeId: null,
      collaboration: {
        ...collaboration,
        activeBranchId: branch.id,
        auditLog: [audit('switch_branch', `Switched to branch "${branch.name}".`, 'user'), ...collaboration.auditLog].slice(0, 80),
      },
    });
  },

  addReviewComment(body, nodeId = null, actor = 'user') {
    const { collaboration } = get();
    if (!canReview(collaboration.role)) return;
    const text = body.trim();
    if (!text) return;
    const comment: ReviewComment = {
      id: createLocalId('comment'),
      nodeId,
      body: text,
      status: 'open',
      author: actor,
      createdAt: new Date().toISOString(),
    };
    set({
      collaboration: {
        ...collaboration,
        comments: [comment, ...collaboration.comments],
        auditLog: [audit('comment', `Added review comment${nodeId ? ` on ${nodeId}` : ''}.`, actor), ...collaboration.auditLog].slice(0, 80),
      },
    });
  },

  resolveReviewComment(commentId) {
    const { collaboration } = get();
    if (!canReview(collaboration.role)) return;
    set({
      collaboration: {
        ...collaboration,
        comments: collaboration.comments.map((comment) =>
          comment.id === commentId ? { ...comment, status: 'resolved', resolvedAt: new Date().toISOString() } : comment,
        ),
        auditLog: [audit('resolve_comment', `Resolved comment ${commentId}.`, 'user'), ...collaboration.auditLog].slice(0, 80),
      },
    });
  },

  getActiveDiff() {
    const { graph, collaboration } = get();
    const snapshot = collaboration.snapshots.find((item) => item.branchId === collaboration.activeBranchId);
    return diffGraphs(snapshot?.graph ?? null, graph);
  },

  updateNode(nodeId, patch) {
    const { graph } = get();
    if (!graph) return;
    const nextGraph = updateGraphNode(graph, nodeId, (node) => ({ ...node, ...patch }));
    set(validateGraph(nextGraph));
  },

  replaceNode(nodeId, node) {
    const { graph } = get();
    if (!graph) return;
    const nextGraph = updateGraphNode(graph, nodeId, () => node);
    set(validateGraph(nextGraph));
  },

  updateChoice(choiceId, patch) {
    const { graph } = get();
    if (!graph) return;
    const nextGraph = updateGraphChoice(graph, choiceId, (choice) => ({ ...choice, ...patch }));
    set(validateGraph(nextGraph));
  },

  retargetChoice(choiceId, targetNodeId) {
    const { graph, collaboration } = get();
    if (!graph) return;
    const nextGraph = updateGraphChoice(graph, choiceId, (choice) => ({
      ...choice,
      nextNodeId: targetNodeId ?? undefined,
    }));
    set({
      ...validateGraph(nextGraph),
      collaboration: syncCollaborationGraph(
        collaboration,
        nextGraph,
        audit('retarget_choice', `${choiceId} -> ${targetNodeId ?? 'terminal'}.`, 'user'),
      ),
    });
  },

  retargetAutoNext(nodeId, targetNodeId) {
    const { graph, collaboration } = get();
    if (!graph) return;
    const nextGraph = updateGraphNode(graph, nodeId, (node) => ({
      ...node,
      autoNextNodeId: targetNodeId ?? undefined,
    }));
    set({
      ...validateGraph(nextGraph),
      collaboration: syncCollaborationGraph(
        collaboration,
        nextGraph,
        audit('retarget_auto_next', `${nodeId} auto -> ${targetNodeId ?? 'none'}.`, 'user'),
      ),
    });
  },

  addRequirement(choiceId) {
    const { graph } = get();
    if (!graph) return;
    const nextGraph = updateGraphChoice(graph, choiceId, (choice) => ({
      ...choice,
      requirements: [
        ...choice.requirements,
        { order: nextChildOrder(choice.requirements), type: 'None' },
      ],
    }));
    set(validateGraph(nextGraph));
  },

  updateRequirement(choiceId, index, patch) {
    const { graph } = get();
    if (!graph) return;
    const nextGraph = updateGraphChoice(graph, choiceId, (choice) => ({
      ...choice,
      requirements: choice.requirements.map((requirement, i) =>
        i === index ? { ...requirement, ...patch } : requirement,
      ),
    }));
    set(validateGraph(nextGraph));
  },

  removeRequirement(choiceId, index) {
    const { graph } = get();
    if (!graph) return;
    const nextGraph = updateGraphChoice(graph, choiceId, (choice) => ({
      ...choice,
      requirements: choice.requirements.filter((_, i) => i !== index),
    }));
    set(validateGraph(nextGraph));
  },

  addOutcome(choiceId) {
    const { graph } = get();
    if (!graph) return;
    const nextGraph = updateGraphChoice(graph, choiceId, (choice) => ({
      ...choice,
      outcomes: [
        ...choice.outcomes,
        { order: nextChildOrder(choice.outcomes), type: 'None' },
      ],
    }));
    set(validateGraph(nextGraph));
  },

  updateOutcome(choiceId, index, patch) {
    const { graph } = get();
    if (!graph) return;
    const nextGraph = updateGraphChoice(graph, choiceId, (choice) => ({
      ...choice,
      outcomes: choice.outcomes.map((outcome, i) =>
        i === index ? { ...outcome, ...patch } : outcome,
      ),
    }));
    set(validateGraph(nextGraph));
  },

  removeOutcome(choiceId, index) {
    const { graph } = get();
    if (!graph) return;
    const nextGraph = updateGraphChoice(graph, choiceId, (choice) => ({
      ...choice,
      outcomes: choice.outcomes.filter((_, i) => i !== index),
    }));
    set(validateGraph(nextGraph));
  },

  applyValidationFix(fix, context = {}) {
    const { graph } = get();
    if (!graph) return;

    let nextGraph = graph;

    switch (fix.kind) {
      case 'create_node': {
        if (graph.nodes.some((node) => node.id === fix.targetNodeId)) return;
        const source = context.nodeId ? graph.nodes.find((node) => node.id === context.nodeId) : undefined;
        nextGraph = sortGraph({
          ...graph,
          nodes: [...graph.nodes, makePlaceholderNode(fix.targetNodeId, source)],
        });
        break;
      }

      case 'change_target': {
        if (!context.targetNodeId) return;
        nextGraph = updateGraphChoice(graph, fix.choiceId, (choice) => ({
          ...choice,
          nextNodeId: context.targetNodeId,
        }));
        break;
      }

      case 'remove_choice': {
        const nodeId = nodeIdFromChoiceId(fix.choiceId);
        nextGraph = updateGraphNode(graph, nodeId, (node) => ({
          ...node,
          choices: node.choices.filter((choice) => choice.id !== fix.choiceId),
        }));
        break;
      }

      case 'create_setter_outcome': {
        nextGraph = updateGraphNode(graph, fix.nodeId, (node) => {
          const outcome: Outcome = {
            order: node.choices[0] ? nextChildOrder(node.choices[0].outcomes) : 0,
            type: 'SetWorldFlag',
            worldFlag: fix.flag,
            intValue: 1,
          };

          if (node.choices[0]) {
            return {
              ...node,
              choices: node.choices.map((choice, index) =>
                index === 0 ? { ...choice, outcomes: [...choice.outcomes, outcome] } : choice,
              ),
            };
          }

          const choiceIndex = nextChoiceIndex(node);
          const newChoice: Choice = {
            id: choiceId(node.id, choiceIndex),
            nodeId: node.id,
            choiceIndex,
            text: `Set ${fix.flag}`,
            requirements: [],
            outcomes: [outcome],
          };

          return { ...node, choices: [newChoice] };
        });
        break;
      }
    }

    set(validateGraph(nextGraph));
  },

  startPlaytest(startNodeId) {
    const { graph, playtest } = get();
    if (!graph) return;
    const entry = resolveEntryNode(graph, playtest.playerState, startNodeId);
    set({
      selectedNodeId: entry?.id ?? null,
      playtest: {
        ...playtest,
        currentNodeId: entry?.id ?? null,
        trace: entry ? [{ nodeId: entry.id, outcomes: [] }] : [],
        message: entry ? null : 'No active entry node for the current player state.',
      },
    });
  },

  resetPlaytest() {
    set({
      playtest: {
        currentNodeId: null,
        playerState: createEmptyPlayerState(),
        trace: [],
        message: null,
      },
    });
  },

  setPlaytestPersona(persona) {
    const { playtest } = get();
    set({ playtest: { ...playtest, playerState: { ...playtest.playerState, persona } } });
  },

  setPlaytestWorldFlag(flag, value) {
    const key = flag.trim();
    if (!key) return;
    const { playtest } = get();
    set({
      playtest: {
        ...playtest,
        playerState: {
          ...playtest.playerState,
          worldFlags: { ...playtest.playerState.worldFlags, [key]: value },
        },
      },
    });
  },

  removePlaytestWorldFlag(flag) {
    const { playtest } = get();
    const { [flag]: _removed, ...worldFlags } = playtest.playerState.worldFlags;
    set({ playtest: { ...playtest, playerState: { ...playtest.playerState, worldFlags } } });
  },

  addPlaytestItemTag(tag) {
    const key = tag.trim();
    if (!key) return;
    const { playtest } = get();
    const itemTags = [...new Set([...playtest.playerState.itemTags, key])].sort();
    set({ playtest: { ...playtest, playerState: { ...playtest.playerState, itemTags } } });
  },

  removePlaytestItemTag(tag) {
    const { playtest } = get();
    set({
      playtest: {
        ...playtest,
        playerState: {
          ...playtest.playerState,
          itemTags: playtest.playerState.itemTags.filter((item) => item !== tag),
        },
      },
    });
  },

  choosePlaytestChoice(choiceIdToChoose) {
    const { graph, playtest } = get();
    if (!graph || !playtest.currentNodeId) return;

    const nodes = indexGraph(graph);
    const node = nodes.get(playtest.currentNodeId);
    const choice = node?.choices.find((candidate) => candidate.id === choiceIdToChoose);
    if (!node || !choice) return;

    const evaluation = evaluateChoice(choice, playtest.playerState);
    if (!evaluation.available) {
      set({ playtest: { ...playtest, message: 'Choice is not available for the current player state.' } });
      return;
    }

    const applied = applyOutcomes(playtest.playerState, choice.outcomes);
    const nextNodeId = chooseNextNodeId(choice);
    const nextNode = nextNodeId ? nodes.get(nextNodeId) : undefined;
    const traceEntry: PlaytestTraceEntry = {
      nodeId: node.id,
      choiceId: choice.id,
      choiceText: choice.text,
      outcomes: applied.labels,
    };

    set({
      selectedNodeId: nextNode?.id ?? node.id,
      playtest: {
        ...playtest,
        playerState: applied.state,
        currentNodeId: nextNode?.id ?? null,
        trace: nextNode
          ? [...playtest.trace, traceEntry, { nodeId: nextNode.id, outcomes: [] }]
          : [...playtest.trace, traceEntry],
        message: nextNode ? null : 'Reached a terminal choice.',
      },
    });
  },

  advancePlaytestAuto() {
    const { graph, playtest } = get();
    if (!graph || !playtest.currentNodeId) return;
    const nodes = indexGraph(graph);
    const node = nodes.get(playtest.currentNodeId);
    const nextNode = node?.autoNextNodeId ? nodes.get(node.autoNextNodeId) : undefined;

    if (!node || !nextNode) {
      set({ playtest: { ...playtest, message: 'No auto-continue target is available.' } });
      return;
    }

    set({
      selectedNodeId: nextNode.id,
      playtest: {
        ...playtest,
        currentNodeId: nextNode.id,
        trace: [
          ...playtest.trace,
          { nodeId: node.id, choiceText: 'auto-continue', outcomes: [] },
          { nodeId: nextNode.id, outcomes: [] },
        ],
        message: null,
      },
    });
  },

  getPlaytestChoices() {
    const { graph, playtest } = get();
    if (!graph || !playtest.currentNodeId) return [];
    const node = graph.nodes.find((candidate) => candidate.id === playtest.currentNodeId);
    if (!node) return [];
    return node.choices.map((choice) => evaluateChoice(choice, playtest.playerState));
  },

  selectNode(id) {
    set({ selectedNodeId: id });
  },

  runValidation() {
    const { graph } = get();
    if (!graph) return;
    set({ report: validate(graph) });
  },
}));
