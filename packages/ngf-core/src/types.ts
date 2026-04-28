/**
 * Narrative Graph Framework — canonical data model.
 *
 * Design:
 *   - CSV is an export/import projection; the graph is the source of truth.
 *   - A choice fans out edges (one port per choice), not a node-level edge.
 *   - Requirements/Outcomes are ordered child arrays, never separate rows.
 *   - Schema is versioned; Run 1 ships an embedded NPC-dialogue schema.
 */

export type NodeId = string;       // `${npcId}:${nodeIndex}`        e.g. "Jijibo:1"
export type ChoiceId = string;     // `${nodeId}:c${choiceIndex}`    e.g. "Jijibo:1:c1"
export type WorkspaceId = string;
export type SchemaVersionId = string;

export interface Workspace {
  id: WorkspaceId;
  name: string;
  activeSchemaVersionId: SchemaVersionId;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Dialogue domain                                                            */
/* -------------------------------------------------------------------------- */

export interface DialogueNode {
  id: NodeId;
  npcId: string;
  nodeIndex: number;

  /** Optional UI-only title (not in source CSV; safe to leave blank). */
  nodeTitle?: string;

  speakerName: string;
  dialogueText: string;

  /** Guard flag — node is active only if this world flag is set. */
  requiredWorldFlag?: string;

  /** Auto-continue / fallback target when no choice is selected. */
  autoNextNodeId?: NodeId;

  choices: Choice[];

  /** Canvas position; not used by runtime. */
  position?: { x: number; y: number };
  uiState?: NodeUiState;
}

export interface NodeUiState {
  collapsed?: boolean;
  groupId?: string;
  lockedPosition?: boolean;
}

export interface Choice {
  id: ChoiceId;
  nodeId: NodeId;
  choiceIndex: number;
  text: string;

  /** Edge target. Undefined means the choice is a terminal/dead-end. */
  nextNodeId?: NodeId;

  /** Visibility gate: choice is visible only if this flag is set. */
  requiredWorldFlag?: string;

  /** Visibility gate (negated): choice is hidden if this flag is set. */
  blockingWorldFlag?: string;

  requirements: Requirement[];
  outcomes: Outcome[];

  uiState?: { expanded?: boolean };
}

export type RequirementType =
  | 'None'
  | 'HasItemTag'
  | 'WorldFlagAtLeast'
  | 'PersonaAtLeast';

export const REQUIREMENT_TYPES = [
  'None',
  'HasItemTag',
  'WorldFlagAtLeast',
  'PersonaAtLeast',
] as const satisfies readonly RequirementType[];

export interface Requirement {
  order: number;
  type: RequirementType;
  tag?: string;
  thresholdValue?: number;

  indicator?: {
    type?: string;
    text?: string;
    icon?: string;
    showWhenMet?: boolean;
  };
}

export type OutcomeType =
  | 'None'
  | 'SetWorldFlag'
  | 'TakeItem'
  | 'AdjustPersona';

export const OUTCOME_TYPES = [
  'None',
  'SetWorldFlag',
  'TakeItem',
  'AdjustPersona',
] as const satisfies readonly OutcomeType[];

export interface Outcome {
  order: number;
  type: OutcomeType;
  worldFlag?: string;
  intValue?: number;
  floatValue?: number;
  tagPayload?: string;
  stringPayload?: string;
}

/* -------------------------------------------------------------------------- */
/*  Edge model (derived for canvas/runtime; canonical edges live on Choice)   */
/* -------------------------------------------------------------------------- */

export type EdgeType =
  | 'choice'
  | 'auto_continue'
  | 'guard_fallback'
  | 'portal';

export interface GraphEdge {
  id: string;
  type: EdgeType;
  sourceNodeId: NodeId;
  /** For 'choice' edges, the originating port. */
  sourceChoiceId?: ChoiceId;
  targetNodeId: NodeId | undefined;
  label?: string;
}

/* -------------------------------------------------------------------------- */
/*  Top-level container                                                        */
/* -------------------------------------------------------------------------- */

export interface NarrativeGraph {
  workspaceId: WorkspaceId;
  schemaVersionId: SchemaVersionId;
  nodes: DialogueNode[];
}

/* -------------------------------------------------------------------------- */
/*  Player state (used by Phase 6 Playtest; defined here so types compose)    */
/* -------------------------------------------------------------------------- */

export interface PlayerState {
  worldFlags: Record<string, number>;   // flag -> int value (0 = unset)
  itemTags: Set<string>;                // possessed item tags
  persona: number;
}
