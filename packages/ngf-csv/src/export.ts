import { parseNodeId, type Choice, type DialogueNode, type NarrativeGraph, type Outcome, type Requirement } from '@kibbel/ngf-core';

import { NPC_DIALOGUE_COLUMNS, NULL_NODE_INDEX, type NpcDialogueColumn } from './columns.js';
import { serializeCsv } from './serialize.js';

export interface ExportOptions {
  /**
   * If true (default), node-only rows are emitted for nodes that have zero
   * choices. Matches the source workbook convention.
   */
  emitChoicelessNodeRows?: boolean;
  /**
   * Prefix used to compute the per-row `Name` field. The source workbook uses
   * a DataTable-style row name; we follow the same shape but it's purely
   * cosmetic since import re-derives identity from NPCId+NodeIndex.
   */
  namePrefix?: string;
}

/** Flatten the graph back to CSV-ready row maps. */
export function exportRows(graph: NarrativeGraph, opts: ExportOptions = {}): Record<NpcDialogueColumn, string>[] {
  const emitChoiceless = opts.emitChoicelessNodeRows ?? true;
  const prefix = opts.namePrefix ?? 'NGF_Row_';
  const rows: Record<NpcDialogueColumn, string>[] = [];
  let seq = 0;

  for (const node of graph.nodes) {
    if (node.choices.length === 0) {
      if (!emitChoiceless) continue;
      rows.push(rowForNodeOnly(node, `${prefix}${seq++}`));
      continue;
    }
    for (const choice of node.choices) {
      const fanCount = Math.max(choice.requirements.length, choice.outcomes.length, 1);
      for (let i = 0; i < fanCount; i++) {
        const req = choice.requirements[i];
        const outcome = choice.outcomes[i];
        rows.push(rowForChoiceFan(node, choice, req, outcome, `${prefix}${seq++}`));
      }
    }
  }
  return rows;
}

/** Full CSV string (header + rows). */
export function exportCsv(graph: NarrativeGraph, opts: ExportOptions = {}): string {
  const rows = exportRows(graph, opts);
  const header = [...NPC_DIALOGUE_COLUMNS] as string[];
  const matrix: string[][] = [header];
  for (const r of rows) {
    matrix.push(NPC_DIALOGUE_COLUMNS.map((col) => r[col]));
  }
  return serializeCsv(matrix);
}

/* -------------------------------------------------------------------------- */
/*  per-row builders                                                           */
/* -------------------------------------------------------------------------- */

function rowForNodeOnly(node: DialogueNode, name: string): Record<NpcDialogueColumn, string> {
  return base({
    Name: name,
    NPCId: node.npcId,
    NodeIndex: String(node.nodeIndex),
    SpeakerName: node.speakerName,
    DialogueText: node.dialogueText,
    NodeRequiredWorldFlag: node.requiredWorldFlag ?? '',
    NodeAutoNextNodeIndex: nodeRefToIndex(node.npcId, node.autoNextNodeId),
  });
}

function rowForChoiceFan(
  node: DialogueNode,
  choice: Choice,
  req: Requirement | undefined,
  outcome: Outcome | undefined,
  name: string,
): Record<NpcDialogueColumn, string> {
  return base({
    Name: name,
    NPCId: node.npcId,
    NodeIndex: String(node.nodeIndex),
    SpeakerName: node.speakerName,
    DialogueText: node.dialogueText,
    NodeRequiredWorldFlag: node.requiredWorldFlag ?? '',
    NodeAutoNextNodeIndex: nodeRefToIndex(node.npcId, node.autoNextNodeId),

    ChoiceIndex: String(choice.choiceIndex),
    ChoiceText: choice.text,
    ChoiceRequiredWorldFlag: choice.requiredWorldFlag ?? '',
    ChoiceBlockingWorldFlag: choice.blockingWorldFlag ?? '',
    ChoiceNextNodeIndex: nodeRefToIndex(node.npcId, choice.nextNodeId),

    OutcomeOrder: outcome ? String(outcome.order) : '',
    RequirementOrder: req ? String(req.order) : '',

    ChoiceOutcomeType: outcome?.type ?? 'None',
    ChoiceOutcomeWorldFlag: outcome?.worldFlag ?? '',
    ChoiceOutcomeIntValue: numStr(outcome?.intValue),
    ChoiceOutcomeFloatValue: numStr(outcome?.floatValue),
    ChoiceOutcomeTagPayload: outcome?.tagPayload ?? '',
    ChoiceOutcomeStringPayload: outcome?.stringPayload ?? '',

    ChoiceRequirementType: req?.type ?? 'None',
    ChoiceRequirementTag: req?.tag ?? '',
    ChoiceRequirementThresholdValue: numStr(req?.thresholdValue),
    ChoiceRequirementIndicatorType: req?.indicator?.type ?? '',
    ChoiceRequirementIndicatorText: req?.indicator?.text ?? '',
    ChoiceRequirementIndicatorIcon: req?.indicator?.icon ?? '',
    bChoiceRequirementShowIndicatorWhenMet:
      req?.indicator?.showWhenMet === undefined ? '' : req.indicator.showWhenMet ? 'True' : 'False',
  });
}

/* -------------------------------------------------------------------------- */
/*  helpers                                                                    */
/* -------------------------------------------------------------------------- */

function base(partial: Partial<Record<NpcDialogueColumn, string>>): Record<NpcDialogueColumn, string> {
  const empty = Object.fromEntries(NPC_DIALOGUE_COLUMNS.map((c) => [c, ''])) as Record<NpcDialogueColumn, string>;
  return { ...empty, ...partial };
}

function nodeRefToIndex(sourceNpc: string, target: string | undefined): string {
  if (!target) return String(NULL_NODE_INDEX);
  const { npcId, nodeIndex } = parseNodeId(target);
  // Cross-NPC links aren't representable in this 27-column schema; we fall
  // back to the index alone, which matches the source workbook's behavior.
  if (npcId !== sourceNpc) return String(nodeIndex);
  return String(nodeIndex);
}

function numStr(n: number | undefined): string {
  if (n === undefined) return '';
  if (Number.isInteger(n)) return String(n);
  return String(n);
}
