/**
 * Column spec for the NPC dialogue CSV (Run 1 baseline schema).
 *
 * 27 columns, ordered as in the source workbook.
 * `Name` is the table-level row identifier (e.g. "DT_Dialogue_Jijibo_Row_3"),
 * not part of the canonical model — we recompute it on export.
 */
export const NPC_DIALOGUE_COLUMNS = [
  'Name',
  'NPCId',
  'NodeIndex',
  'SpeakerName',
  'DialogueText',
  'NodeRequiredWorldFlag',
  'NodeAutoNextNodeIndex',
  'ChoiceIndex',
  'ChoiceText',
  'ChoiceRequiredWorldFlag',
  'ChoiceBlockingWorldFlag',
  'ChoiceNextNodeIndex',
  'OutcomeOrder',
  'RequirementOrder',
  'ChoiceOutcomeType',
  'ChoiceOutcomeWorldFlag',
  'ChoiceOutcomeIntValue',
  'ChoiceOutcomeFloatValue',
  'ChoiceOutcomeTagPayload',
  'ChoiceOutcomeStringPayload',
  'ChoiceRequirementType',
  'ChoiceRequirementTag',
  'ChoiceRequirementThresholdValue',
  'ChoiceRequirementIndicatorType',
  'ChoiceRequirementIndicatorText',
  'ChoiceRequirementIndicatorIcon',
  'bChoiceRequirementShowIndicatorWhenMet',
] as const;

export type NpcDialogueColumn = (typeof NPC_DIALOGUE_COLUMNS)[number];

export type RawRow = Partial<Record<NpcDialogueColumn, string>>;

/** Sentinel used by the source workbook for "no link". */
export const NULL_NODE_INDEX = -1;
