import { useEffect, useMemo, useState } from 'react';
import {
  OUTCOME_TYPES,
  REQUIREMENT_TYPES,
  type Choice,
  type DialogueNode,
  type Outcome,
  type OutcomeType,
  type Requirement,
  type RequirementType,
} from '@kibbel/ngf-core';
import { useAppStore } from '../store';
import { getNodeEntity, type SchemaField } from '../utils/schemaDraft';
import './Inspector.css';

type InspectorMode = 'simple' | 'raw';

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function formatJson(node: DialogueNode): string {
  return JSON.stringify(node, null, 2);
}

function parseNodeJson(text: string, expectedId: string): { node?: DialogueNode; error?: string } {
  try {
    const parsed = JSON.parse(text) as Partial<DialogueNode>;
    if (parsed.id !== expectedId) return { error: 'Raw JSON must keep the same node id.' };
    if (!Array.isArray(parsed.choices)) return { error: 'Raw JSON must include a choices array.' };
    if (typeof parsed.npcId !== 'string' || typeof parsed.nodeIndex !== 'number') {
      return { error: 'Raw JSON is missing npcId or nodeIndex.' };
    }
    return { node: parsed as DialogueNode };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
}

function NodeIdOptions({ ids }: { ids: string[] }) {
  return (
    <datalist id="ngf-node-targets">
      {ids.map((id) => (
        <option key={id} value={id} />
      ))}
    </datalist>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="inspector-field-label">{children}</label>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  list,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  list?: string;
}) {
  return (
    <input
      className="inspector-input"
      value={value}
      placeholder={placeholder}
      list={list}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <input
      className="inspector-input inspector-input--number"
      type="number"
      value={value ?? ''}
      onChange={(event) => onChange(optionalNumber(event.target.value))}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      className="inspector-textarea"
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function RequirementEditor({
  choice,
  requirement,
  index,
  updateRequirement,
  removeRequirement,
}: {
  choice: Choice;
  requirement: Requirement;
  index: number;
  updateRequirement: ReturnType<typeof useAppStore.getState>['updateRequirement'];
  removeRequirement: ReturnType<typeof useAppStore.getState>['removeRequirement'];
}) {
  return (
    <div className="inspector-nested-editor">
      <div className="inspector-row inspector-row--compact">
        <FieldLabel>Req #{index + 1}</FieldLabel>
        <select
          className="inspector-select"
          value={requirement.type}
          onChange={(event) =>
            updateRequirement(choice.id, index, { type: event.target.value as RequirementType })
          }
        >
          {REQUIREMENT_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <button className="inspector-icon-btn" onClick={() => removeRequirement(choice.id, index)} title="Remove requirement">
          x
        </button>
      </div>
      <div className="inspector-grid">
        <div>
          <FieldLabel>Order</FieldLabel>
          <NumberInput
            value={requirement.order}
            onChange={(value) => updateRequirement(choice.id, index, { order: value ?? 0 })}
          />
        </div>
        <div>
          <FieldLabel>Tag</FieldLabel>
          <TextInput
            value={requirement.tag ?? ''}
            onChange={(value) => updateRequirement(choice.id, index, { tag: optionalText(value) })}
          />
        </div>
        <div>
          <FieldLabel>Threshold</FieldLabel>
          <NumberInput
            value={requirement.thresholdValue}
            onChange={(value) => updateRequirement(choice.id, index, { thresholdValue: value })}
          />
        </div>
      </div>
    </div>
  );
}

function OutcomeEditor({
  choice,
  outcome,
  index,
  updateOutcome,
  removeOutcome,
}: {
  choice: Choice;
  outcome: Outcome;
  index: number;
  updateOutcome: ReturnType<typeof useAppStore.getState>['updateOutcome'];
  removeOutcome: ReturnType<typeof useAppStore.getState>['removeOutcome'];
}) {
  return (
    <div className="inspector-nested-editor">
      <div className="inspector-row inspector-row--compact">
        <FieldLabel>Out #{index + 1}</FieldLabel>
        <select
          className="inspector-select"
          value={outcome.type}
          onChange={(event) => updateOutcome(choice.id, index, { type: event.target.value as OutcomeType })}
        >
          {OUTCOME_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <button className="inspector-icon-btn" onClick={() => removeOutcome(choice.id, index)} title="Remove outcome">
          x
        </button>
      </div>
      <div className="inspector-grid">
        <div>
          <FieldLabel>Order</FieldLabel>
          <NumberInput
            value={outcome.order}
            onChange={(value) => updateOutcome(choice.id, index, { order: value ?? 0 })}
          />
        </div>
        <div>
          <FieldLabel>World Flag</FieldLabel>
          <TextInput
            value={outcome.worldFlag ?? ''}
            onChange={(value) => updateOutcome(choice.id, index, { worldFlag: optionalText(value) })}
          />
        </div>
        <div>
          <FieldLabel>Int</FieldLabel>
          <NumberInput
            value={outcome.intValue}
            onChange={(value) => updateOutcome(choice.id, index, { intValue: value })}
          />
        </div>
        <div>
          <FieldLabel>Float</FieldLabel>
          <NumberInput
            value={outcome.floatValue}
            onChange={(value) => updateOutcome(choice.id, index, { floatValue: value })}
          />
        </div>
        <div>
          <FieldLabel>Tag Payload</FieldLabel>
          <TextInput
            value={outcome.tagPayload ?? ''}
            onChange={(value) => updateOutcome(choice.id, index, { tagPayload: optionalText(value) })}
          />
        </div>
        <div>
          <FieldLabel>String Payload</FieldLabel>
          <TextInput
            value={outcome.stringPayload ?? ''}
            onChange={(value) => updateOutcome(choice.id, index, { stringPayload: optionalText(value) })}
          />
        </div>
      </div>
    </div>
  );
}

function ChoiceEditor({
  choice,
  nodeIds,
}: {
  choice: Choice;
  nodeIds: string[];
}) {
  const { updateChoice, addRequirement, updateRequirement, removeRequirement, addOutcome, updateOutcome, removeOutcome } =
    useAppStore();

  return (
    <div className="inspector-choice-editor">
      <div className="inspector-choice-heading">
        <span className="inspector-choice-idx">{choice.choiceIndex}</span>
        <span className="inspector-choice-id">{choice.id}</span>
      </div>
      <div className="inspector-field">
        <FieldLabel>Choice Text</FieldLabel>
        <TextInput value={choice.text} onChange={(value) => updateChoice(choice.id, { text: value })} />
      </div>
      <div className="inspector-grid">
        <div>
          <FieldLabel>Next Node</FieldLabel>
          <TextInput
            value={choice.nextNodeId ?? ''}
            list="ngf-node-targets"
            onChange={(value) => updateChoice(choice.id, { nextNodeId: optionalText(value) })}
          />
        </div>
        <div>
          <FieldLabel>Required Flag</FieldLabel>
          <TextInput
            value={choice.requiredWorldFlag ?? ''}
            onChange={(value) => updateChoice(choice.id, { requiredWorldFlag: optionalText(value) })}
          />
        </div>
        <div>
          <FieldLabel>Blocking Flag</FieldLabel>
          <TextInput
            value={choice.blockingWorldFlag ?? ''}
            onChange={(value) => updateChoice(choice.id, { blockingWorldFlag: optionalText(value) })}
          />
        </div>
      </div>
      <div className="inspector-subsection">
        <div className="inspector-subsection-head">
          <span>Requirements</span>
          <button className="inspector-small-btn" onClick={() => addRequirement(choice.id)}>Add</button>
        </div>
        {choice.requirements.length === 0 ? (
          <div className="inspector-empty-line">None</div>
        ) : (
          choice.requirements.map((requirement, index) => (
            <RequirementEditor
              key={`${choice.id}:req:${index}`}
              choice={choice}
              requirement={requirement}
              index={index}
              updateRequirement={updateRequirement}
              removeRequirement={removeRequirement}
            />
          ))
        )}
      </div>
      <div className="inspector-subsection">
        <div className="inspector-subsection-head">
          <span>Outcomes</span>
          <button className="inspector-small-btn" onClick={() => addOutcome(choice.id)}>Add</button>
        </div>
        {choice.outcomes.length === 0 ? (
          <div className="inspector-empty-line">None</div>
        ) : (
          choice.outcomes.map((outcome, index) => (
            <OutcomeEditor
              key={`${choice.id}:out:${index}`}
              choice={choice}
              outcome={outcome}
              index={index}
              updateOutcome={updateOutcome}
              removeOutcome={removeOutcome}
            />
          ))
        )}
      </div>
      <NodeIdOptions ids={nodeIds} />
    </div>
  );
}

function EmptyInspector() {
  const report = useAppStore((state) => state.report);

  return (
    <div className="inspector inspector--empty">
      <div className="inspector-hint">Select a node to inspect</div>
      {report && (
        <div className="inspector-summary">
          <div className="inspector-summary-row">
            <span className="badge badge--error">{report.errorCount} errors</span>
            <span className="badge badge--warn">{report.warningCount} warnings</span>
            <span className="badge badge--info">
              {report.issues.filter((issue) => issue.severity === 'info').length} info
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function schemaFieldValue(node: DialogueNode, field: SchemaField): string {
  const value = (node as unknown as Record<string, unknown>)[field.name];
  if (value === undefined || value === null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function SchemaDrivenSummary({ node }: { node: DialogueNode }) {
  const schemaDraft = useAppStore((state) => state.schemaDraft);
  const entity = getNodeEntity(schemaDraft);
  if (!entity) return null;

  return (
    <div className="inspector-section">
      <div className="inspector-label">Schema Form ({schemaDraft.name} v{schemaDraft.version})</div>
      <div className="schema-driven-list">
        {entity.fields.map((field) => (
          <div key={field.id} className="schema-driven-field">
            <div>
              <span className="schema-driven-label">{field.label}</span>
              {field.required && <span className="schema-driven-required">required</span>}
            </div>
            <div className="schema-driven-value">{schemaFieldValue(node, field)}</div>
            <div className="schema-driven-meta">{field.type} / {field.widget}{field.enumId ? ` / ${field.enumId}` : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Inspector() {
  const {
    graph,
    selectedNodeId,
    report,
    updateNode,
    replaceNode,
  } = useAppStore();
  const [mode, setMode] = useState<InspectorMode>('simple');
  const [rawText, setRawText] = useState('');
  const [rawError, setRawError] = useState<string | null>(null);

  const node = selectedNodeId ? graph?.nodes.find((n) => n.id === selectedNodeId) ?? null : null;
  const nodeIds = useMemo(() => graph?.nodes.map((n) => n.id).sort() ?? [], [graph]);
  const nodeIssues = report?.issues.filter((issue) => issue.nodeId === selectedNodeId) ?? [];

  useEffect(() => {
    if (node && mode === 'raw') {
      setRawText(formatJson(node));
      setRawError(null);
    }
  }, [mode, node?.id]);

  if (!graph) return null;
  if (!node) return <EmptyInspector />;

  function applyRawJson() {
    if (!node) return;
    const result = parseNodeJson(rawText, node.id);
    if (result.error) {
      setRawError(result.error);
      return;
    }
    replaceNode(node.id, result.node!);
    setRawError(null);
  }

  return (
    <div className="inspector">
      <div className="inspector-top">
        <div>
          <div className="inspector-label">Node</div>
          <div className="inspector-value inspector-value--mono">{node.id}</div>
        </div>
        <div className="inspector-mode" role="tablist" aria-label="Inspector mode">
          <button
            className={`inspector-mode-btn${mode === 'simple' ? ' inspector-mode-btn--active' : ''}`}
            onClick={() => setMode('simple')}
          >
            Simple
          </button>
          <button
            className={`inspector-mode-btn${mode === 'raw' ? ' inspector-mode-btn--active' : ''}`}
            onClick={() => setMode('raw')}
          >
            Raw
          </button>
        </div>
      </div>

      {mode === 'simple' ? (
        <>
          <div className="inspector-section">
            <div className="inspector-label">Node Fields</div>
            <div className="inspector-field">
              <FieldLabel>Title</FieldLabel>
              <TextInput
                value={node.nodeTitle ?? ''}
                onChange={(value) => updateNode(node.id, { nodeTitle: optionalText(value) })}
              />
            </div>
            <div className="inspector-field">
              <FieldLabel>Speaker</FieldLabel>
              <TextInput value={node.speakerName} onChange={(value) => updateNode(node.id, { speakerName: value })} />
            </div>
            <div className="inspector-field">
              <FieldLabel>Dialogue</FieldLabel>
              <TextArea value={node.dialogueText} onChange={(value) => updateNode(node.id, { dialogueText: value })} />
            </div>
            <div className="inspector-grid">
              <div>
                <FieldLabel>Guard Flag</FieldLabel>
                <TextInput
                  value={node.requiredWorldFlag ?? ''}
                  onChange={(value) => updateNode(node.id, { requiredWorldFlag: optionalText(value) })}
                />
              </div>
              <div>
                <FieldLabel>Auto Next</FieldLabel>
                <TextInput
                  value={node.autoNextNodeId ?? ''}
                  list="ngf-node-targets"
                  onChange={(value) => updateNode(node.id, { autoNextNodeId: optionalText(value) })}
                />
              </div>
            </div>
            <NodeIdOptions ids={nodeIds} />
          </div>

          <SchemaDrivenSummary node={node} />

          <div className="inspector-section">
            <div className="inspector-label">Choices ({node.choices.length})</div>
            {node.choices.length === 0 ? (
              <div className="inspector-empty-line">No choices on this node</div>
            ) : (
              node.choices.map((choice) => <ChoiceEditor key={choice.id} choice={choice} nodeIds={nodeIds} />)
            )}
          </div>
        </>
      ) : (
        <div className="inspector-section">
          <div className="inspector-label">Raw Node JSON</div>
          <TextArea value={rawText} onChange={setRawText} rows={20} />
          {rawError && <div className="inspector-raw-error">{rawError}</div>}
          <button className="inspector-apply-btn" onClick={applyRawJson}>Apply JSON</button>
        </div>
      )}

      {nodeIssues.length > 0 && (
        <div className="inspector-section">
          <div className="inspector-label">Issues</div>
          {nodeIssues.map((issue, i) => (
            <div key={`${issue.code}:${i}`} className={`inspector-issue inspector-issue--${issue.severity}`}>
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
