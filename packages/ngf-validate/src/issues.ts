import type { ChoiceId, NodeId } from '@kimasill/ngf-core';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'broken_edge_choice'
  | 'broken_edge_auto_continue'
  | 'broken_edge_required_world_flag_node'
  | 'unreachable_node'
  | 'dead_end_node'
  | 'flag_required_but_never_set'
  | 'item_required_but_never_given'
  | 'persona_threshold_may_be_unreachable'
  | 'duplicate_choice_index'
  | 'invalid_enum'
  | 'missing_required_field'
  | 'self_loop_auto_continue';

export interface ValidationIssue {
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  /** Primary subject of the issue. */
  nodeId?: NodeId;
  choiceId?: ChoiceId;
  /** Suggested actions a UI can offer. */
  fixes?: ValidationFix[];
}

export type ValidationFix =
  | { kind: 'create_node'; targetNodeId: NodeId }
  | { kind: 'change_target'; choiceId: ChoiceId }
  | { kind: 'remove_choice'; choiceId: ChoiceId }
  | { kind: 'create_setter_outcome'; flag: string; nodeId: NodeId };

export interface ValidationReport {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export function summarize(issues: ValidationIssue[]): ValidationReport {
  let errorCount = 0;
  let warningCount = 0;
  for (const i of issues) {
    if (i.severity === 'error') errorCount++;
    else if (i.severity === 'warning') warningCount++;
  }
  return { issues, errorCount, warningCount };
}
