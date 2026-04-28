import {
  type Choice,
  type DialogueNode,
  type NarrativeGraph,
  type NodeId,
  type Outcome,
  type OutcomeType,
  type Requirement,
  type RequirementType,
  OUTCOME_TYPES,
  REQUIREMENT_TYPES,
  choiceId,
  ensureNode,
  nodeId,
  sortGraph,
} from '@kibbel/ngf-core';

import { NULL_NODE_INDEX, type NpcDialogueColumn } from './columns.js';
import { parseCsv, rowsToObjects, type RowMap } from './parse.js';

export interface ImportIssue {
  /** 0-based source row index in the CSV body (excluding header). */
  rowIndex: number;
  message: string;
}

export interface ImportResult {
  graph: NarrativeGraph;
  issues: ImportIssue[];
  /** Row count in the input, excluding header / blank rows. */
  inputRows: number;
}

export interface ImportOptions {
  workspaceId?: string;
  schemaVersionId?: string;
}

/**
 * Parse a raw CSV string into a normalized NarrativeGraph.
 *
 * Grouping rules:
 *   nodeKey   = `${NPCId}:${NodeIndex}`
 *   choiceKey = `${nodeKey}:${ChoiceIndex}:${ChoiceText}:${ChoiceNextNodeIndex}`
 *
 * Within a choice's row group, rows are folded by RequirementOrder /
 * OutcomeOrder. A row may carry both a requirement and an outcome (typical
 * when both exist at index 0); empty Order columns mean the row contributes
 * nothing to that side.
 */
export function importCsv(text: string, opts: ImportOptions = {}): ImportResult {
  const matrix = parseCsv(text);
  const rows = rowsToObjects(matrix);
  return importRows(rows, opts);
}

export function importRows(rows: RowMap[], opts: ImportOptions = {}): ImportResult {
  const issues: ImportIssue[] = [];
  const nodes = new Map<NodeId, DialogueNode>();
  /** Track per-choice req/outcome dedupe keys so duplicate rows don't double-add. */
  const seenReq = new Map<string, Set<number>>();
  const seenOutcome = new Map<string, Set<number>>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const issue = (msg: string) => issues.push({ rowIndex: i, message: msg });

    const npcId = str(r, 'NPCId');
    const nodeIdxRaw = str(r, 'NodeIndex');
    if (!npcId || nodeIdxRaw === '') {
      issue('row is missing NPCId or NodeIndex; skipped');
      continue;
    }
    const nodeIdx = toInt(nodeIdxRaw);
    if (nodeIdx === undefined) {
      issue(`NodeIndex is not an integer: ${nodeIdxRaw}`);
      continue;
    }

    const nId = nodeId(npcId, nodeIdx);
    const node = ensureNode(nodes, nId, () => ({
      id: nId,
      npcId,
      nodeIndex: nodeIdx,
      speakerName: str(r, 'SpeakerName'),
      dialogueText: str(r, 'DialogueText'),
      requiredWorldFlag: emptyToUndef(str(r, 'NodeRequiredWorldFlag')),
      autoNextNodeId: resolveNodeRef(npcId, str(r, 'NodeAutoNextNodeIndex')),
      choices: [],
    }));
    // First-seen wins for node-level fields; later duplicates only contribute
    // choice/req/outcome data, which is the source workbook's convention.

    const choiceIdxRaw = str(r, 'ChoiceIndex');
    if (choiceIdxRaw === '') continue; // node-only row (rare)
    const choiceIdx = toInt(choiceIdxRaw);
    if (choiceIdx === undefined) {
      issue(`ChoiceIndex is not an integer: ${choiceIdxRaw}`);
      continue;
    }

    const cId = choiceId(nId, choiceIdx);
    let choice = node.choices.find((c) => c.choiceIndex === choiceIdx);
    if (!choice) {
      choice = {
        id: cId,
        nodeId: nId,
        choiceIndex: choiceIdx,
        text: str(r, 'ChoiceText'),
        nextNodeId: resolveNodeRef(npcId, str(r, 'ChoiceNextNodeIndex')),
        requiredWorldFlag: emptyToUndef(str(r, 'ChoiceRequiredWorldFlag')),
        blockingWorldFlag: emptyToUndef(str(r, 'ChoiceBlockingWorldFlag')),
        requirements: [],
        outcomes: [],
      };
      node.choices.push(choice);
      seenReq.set(cId, new Set());
      seenOutcome.set(cId, new Set());
    }

    /* requirement on this row, if any */
    const reqOrderRaw = str(r, 'RequirementOrder');
    const reqType = str(r, 'ChoiceRequirementType') as RequirementType | '';
    if (reqOrderRaw !== '' && reqType !== '' && reqType !== 'None') {
      if (!isRequirementType(reqType)) {
        issue(`unknown ChoiceRequirementType: ${reqType}`);
      } else {
        const order = toInt(reqOrderRaw);
        if (order === undefined) {
          issue(`RequirementOrder not an integer: ${reqOrderRaw}`);
        } else if (!seenReq.get(cId)!.has(order)) {
          seenReq.get(cId)!.add(order);
          const req: Requirement = {
            order,
            type: reqType,
            tag: emptyToUndef(str(r, 'ChoiceRequirementTag')),
            thresholdValue: toFloat(str(r, 'ChoiceRequirementThresholdValue')),
            indicator: indicatorFromRow(r),
          };
          choice.requirements.push(req);
        }
      }
    }

    /* outcome on this row, if any */
    const outcomeOrderRaw = str(r, 'OutcomeOrder');
    const outcomeType = str(r, 'ChoiceOutcomeType') as OutcomeType | '';
    if (outcomeOrderRaw !== '' && outcomeType !== '' && outcomeType !== 'None') {
      if (!isOutcomeType(outcomeType)) {
        issue(`unknown ChoiceOutcomeType: ${outcomeType}`);
      } else {
        const order = toInt(outcomeOrderRaw);
        if (order === undefined) {
          issue(`OutcomeOrder not an integer: ${outcomeOrderRaw}`);
        } else if (!seenOutcome.get(cId)!.has(order)) {
          seenOutcome.get(cId)!.add(order);
          const outcome: Outcome = {
            order,
            type: outcomeType,
            worldFlag: emptyToUndef(str(r, 'ChoiceOutcomeWorldFlag')),
            intValue: toInt(str(r, 'ChoiceOutcomeIntValue')),
            floatValue: toFloat(str(r, 'ChoiceOutcomeFloatValue')),
            tagPayload: emptyToUndef(str(r, 'ChoiceOutcomeTagPayload')),
            stringPayload: emptyToUndef(str(r, 'ChoiceOutcomeStringPayload')),
          };
          choice.outcomes.push(outcome);
        }
      }
    }
  }

  const graph: NarrativeGraph = sortGraph({
    workspaceId: opts.workspaceId ?? 'workspace_local',
    schemaVersionId: opts.schemaVersionId ?? 'schema_v1_npc_dialogue',
    nodes: [...nodes.values()],
  });

  return { graph, issues, inputRows: rows.length };
}

/* -------------------------------------------------------------------------- */
/*  helpers                                                                    */
/* -------------------------------------------------------------------------- */

function str(r: RowMap, k: NpcDialogueColumn): string {
  const v = r[k];
  return (v ?? '').trim();
}

function emptyToUndef(s: string): string | undefined {
  return s === '' ? undefined : s;
}

function toInt(s: string): number | undefined {
  if (s === '') return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

function toFloat(s: string): number | undefined {
  if (s === '') return undefined;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function resolveNodeRef(npcId: string, raw: string): NodeId | undefined {
  const idx = toInt(raw);
  if (idx === undefined) return undefined;
  if (idx === NULL_NODE_INDEX) return undefined;
  return nodeId(npcId, idx);
}

function isRequirementType(s: string): s is RequirementType {
  return (REQUIREMENT_TYPES as readonly string[]).includes(s);
}

function isOutcomeType(s: string): s is OutcomeType {
  return (OUTCOME_TYPES as readonly string[]).includes(s);
}

function indicatorFromRow(r: RowMap): Requirement['indicator'] | undefined {
  const type = emptyToUndef(str(r, 'ChoiceRequirementIndicatorType'));
  const text = emptyToUndef(str(r, 'ChoiceRequirementIndicatorText'));
  const icon = emptyToUndef(str(r, 'ChoiceRequirementIndicatorIcon'));
  const showRaw = str(r, 'bChoiceRequirementShowIndicatorWhenMet');
  const showWhenMet = showRaw === '' ? undefined : parseBool(showRaw);
  if (
    type === undefined &&
    text === undefined &&
    icon === undefined &&
    showWhenMet === undefined
  ) {
    return undefined;
  }
  return { type, text, icon, showWhenMet };
}

function parseBool(s: string): boolean | undefined {
  const lc = s.toLowerCase();
  if (lc === 'true' || lc === '1') return true;
  if (lc === 'false' || lc === '0') return false;
  return undefined;
}

/** Suppress the import of Choice in the public type — silence unused lint. */
export type { Choice as ImportedChoice };
