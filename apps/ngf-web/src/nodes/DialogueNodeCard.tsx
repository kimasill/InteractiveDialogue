import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowDialogueNode } from '../utils/graphToFlow';
import './DialogueNodeCard.css';

// Layout constants — must match CSS values exactly
const HEADER_H = 40;
const BODY_H = 82;
const DIVIDER = 1;
const CHOICE_H = 34;
const AUTO_H = 30;

function choiceHandleTop(index: number): number {
  return HEADER_H + BODY_H + DIVIDER + index * CHOICE_H + CHOICE_H / 2;
}

const NPC_PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];

function npcColor(npcId: string): string {
  let h = 0;
  for (const ch of npcId) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return NPC_PALETTE[h % NPC_PALETTE.length] ?? '#6366f1';
}

export function DialogueNodeCard({ data, selected }: NodeProps<FlowDialogueNode>) {
  const n = data.node;
  const color = npcColor(n.npcId);
  const targetHandleTop = HEADER_H / 2;
  const autoHandleTop = HEADER_H + BODY_H + DIVIDER + n.choices.length * CHOICE_H + AUTO_H / 2;
  const unavailableChoiceIds = new Set(data.unavailableChoiceIds ?? []);
  const issueSeverity = data.issueSeverity;
  const hasOutcomes = n.choices.some((choice) => choice.outcomes.length > 0);
  const hasRequirements = n.choices.some((choice) => choice.requirements.length > 0);

  return (
    <div
      className={[
        'ngf-card',
        selected ? 'ngf-card--selected' : '',
        issueSeverity ? `ngf-card--${issueSeverity}` : '',
      ].filter(Boolean).join(' ')}
      style={{ '--npc-color': color } as React.CSSProperties}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="ngf-handle ngf-handle--target"
        style={{ top: targetHandleTop, background: color, border: `2px solid ${color}` }}
      />

      <div className="ngf-card-header">
        <div className="ngf-card-title-stack">
          <span className="ngf-card-id" style={{ color }}>{n.npcId}:{n.nodeIndex}</span>
          <span className="ngf-card-title">{n.nodeTitle || n.dialogueText || 'Untitled node'}</span>
        </div>
        <span className="ngf-card-badges">
          {data.branchGroupLabel && <span className="ngf-card-group">{data.branchGroupLabel}</span>}
          {n.uiState?.lockedPosition && <span className="ngf-card-flag" title="Locked position">L</span>}
          {n.uiState?.collapsed && <span className="ngf-card-flag" title="Collapsed subgraph">C</span>}
          {n.requiredWorldFlag && (
            <span className="ngf-card-flag" title={`Guard: ${n.requiredWorldFlag}`}>G</span>
          )}
          {issueSeverity && <span className={`ngf-card-issue ngf-card-issue--${issueSeverity}`}>{issueSeverity[0]}</span>}
        </span>
      </div>

      <div className="ngf-card-body">
        <div className="ngf-card-speaker-row">
          <span className="ngf-card-speaker">{n.speakerName || '—'}</span>
          <span className="ngf-card-meta">
            {n.choices.length} choices
            {hasRequirements ? ' / req' : ''}
            {hasOutcomes ? ' / out' : ''}
          </span>
        </div>
        <div className="ngf-card-text">{n.dialogueText || <em>no text</em>}</div>
      </div>

      {n.choices.length > 0 && (
        <div className="ngf-card-choices">
          {n.choices.map((c, i) => (
            <div
              key={c.id}
              className={[
                'ngf-card-choice',
                unavailableChoiceIds.has(c.id) ? 'ngf-card-choice--locked' : '',
                data.activeChoiceId === c.id ? 'ngf-card-choice--active' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="ngf-card-choice-idx">{c.choiceIndex}</span>
              <span className="ngf-card-choice-text">{c.text || <em>…</em>}</span>
              <span className="ngf-card-choice-meta">
                {c.requirements.length > 0 && <span className="ngf-card-chip ngf-card-chip--req">R{c.requirements.length}</span>}
                {c.outcomes.length > 0 && <span className="ngf-card-chip ngf-card-chip--out">O{c.outcomes.length}</span>}
                <span className={`ngf-card-chip ${c.nextNodeId ? 'ngf-card-chip--target' : 'ngf-card-chip--terminal'}`}>
                  {c.nextNodeId ? c.nextNodeId.split(':').at(-1) : 'end'}
                </span>
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`c${c.choiceIndex}`}
                className="ngf-handle ngf-handle--choice"
                style={{ top: choiceHandleTop(i), background: color }}
              />
            </div>
          ))}
        </div>
      )}

      {n.autoNextNodeId && (
        <div className="ngf-card-auto">
          <span>▶ auto-continue</span>
          <Handle
            type="source"
            position={Position.Right}
            id="auto"
            className="ngf-handle ngf-handle--auto"
            style={{ top: autoHandleTop, background: '#64748b' }}
          />
        </div>
      )}
    </div>
  );
}
