import type {
  ChoiceId,
  NodeId,
  Outcome,
  Requirement,
  SchemaVersionId,
  WorkspaceId,
} from '@ngf/core';

export const RUNTIME_BUNDLE_FORMAT = 'ngf.runtime.bundle';
export const RUNTIME_BUNDLE_VERSION = 1;

export interface RuntimeBundleProfile {
  id: string;
  label: string;
}

export interface RuntimeBundle {
  format: typeof RUNTIME_BUNDLE_FORMAT;
  version: typeof RUNTIME_BUNDLE_VERSION;
  generatedAt: string;
  workspaceId: WorkspaceId;
  schemaVersionId: SchemaVersionId;
  profile: RuntimeBundleProfile;
  tables: {
    nodeIds: NodeId[];
    choiceIds: ChoiceId[];
  };
  entries: number[];
  nodes: RuntimeNode[];
}

export interface RuntimeNode {
  id: number;
  npcId: string;
  nodeIndex: number;
  title?: string;
  speaker: string;
  text: string;
  guardFlag?: string;
  autoNext?: number;
  choices: RuntimeChoice[];
}

export interface RuntimeChoice {
  id: number;
  choiceIndex: number;
  text: string;
  next?: number;
  requiredWorldFlag?: string;
  blockingWorldFlag?: string;
  requirements: Requirement[];
  outcomes: Outcome[];
}

export interface NormalizedGraphJson {
  format: 'ngf.normalized.graph';
  version: 1;
  workspaceId: WorkspaceId;
  schemaVersionId: SchemaVersionId;
  profile: RuntimeBundleProfile;
  nodes: Array<{
    id: NodeId;
    npcId: string;
    nodeIndex: number;
    nodeTitle?: string;
    speakerName: string;
    dialogueText: string;
    requiredWorldFlag?: string;
    autoNextNodeId?: NodeId;
    choices: Array<{
      id: ChoiceId;
      nodeId: NodeId;
      choiceIndex: number;
      text: string;
      nextNodeId?: NodeId;
      requiredWorldFlag?: string;
      blockingWorldFlag?: string;
      requirements: Requirement[];
      outcomes: Outcome[];
    }>;
  }>;
}

export interface RuntimePlayerState {
  worldFlags: Record<string, number>;
  itemTags: string[];
  persona: number;
}

export interface RuntimeRequirementCheck {
  label: string;
  met: boolean;
}

export interface RuntimeChoiceEvaluation {
  choice: RuntimeChoice;
  available: boolean;
  checks: RuntimeRequirementCheck[];
}

export interface RuntimeAdvanceResult {
  ok: boolean;
  state: RuntimePlayerState;
  currentNode: RuntimeNode | null;
  choice?: RuntimeChoice;
  appliedOutcomes: string[];
  message: string | null;
}

export interface BuildRuntimeBundleOptions {
  profile?: RuntimeBundleProfile;
  generatedAt?: string;
  entryNodeIds?: NodeId[];
  entryNodeMaxIndex?: number;
}

export interface NormalizedJsonOptions {
  profile?: RuntimeBundleProfile;
}
