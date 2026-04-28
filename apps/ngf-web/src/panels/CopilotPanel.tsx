import { useMemo, useState } from 'react';
import type { ValidationIssue } from '@kibbel/ngf-validate';
import { useAppStore } from '../store';
import { buildCopilotContext, describeCopilotOp, explainValidationIssue, suggestSchemaNotes } from '../utils/copilot';

function issueLabel(issue: ValidationIssue): string {
  return `${issue.severity.toUpperCase()} / ${issue.code}`;
}

export function CopilotPanel() {
  const {
    graph,
    selectedNodeId,
    report,
    schemaDraft,
    copilot,
    setCopilotApiKey,
    setCopilotModel,
    setCopilotValidationGate,
    askCopilot,
    createCopilotProposal,
    rejectCopilotProposal,
    applyCopilotProposal,
  } = useAppStore();
  const [prompt, setPrompt] = useState('');

  const context = useMemo(() => {
    if (!graph) return 'No graph loaded.';
    return buildCopilotContext(graph, selectedNodeId, report, schemaDraft);
  }, [graph, selectedNodeId, report, schemaDraft]);

  const issues = report?.issues ?? [];
  const selectedIssues = selectedNodeId ? issues.filter((issue) => issue.nodeId === selectedNodeId) : issues;
  const explainableIssue = selectedIssues[0] ?? issues[0];
  const schemaNotes = useMemo(() => suggestSchemaNotes(schemaDraft), [schemaDraft]);

  function submitPrompt() {
    askCopilot(prompt);
    setPrompt('');
  }

  return (
    <div className="copilot-panel">
      <div className="copilot-column copilot-column--setup">
        <div className="copilot-head">
          <span className="copilot-title">AI Copilot</span>
          <span className="copilot-subtitle">{copilot.model}</span>
        </div>

        <label className="copilot-label">
          API Key
          <input
            className="copilot-input"
            type="password"
            value={copilot.apiKey}
            placeholder="Browser session only"
            onChange={(event) => setCopilotApiKey(event.target.value)}
          />
        </label>

        <label className="copilot-label">
          Model
          <input
            className="copilot-input"
            value={copilot.model}
            onChange={(event) => setCopilotModel(event.target.value)}
          />
        </label>

        <label className="copilot-check">
          <input
            type="checkbox"
            checked={copilot.requireValidationGate}
            onChange={(event) => setCopilotValidationGate(event.target.checked)}
          />
          Validation gate
        </label>

        <div className="copilot-action-grid">
          <button onClick={() => createCopilotProposal('title_selected')}>Title Node</button>
          <button onClick={() => createCopilotProposal('terminal_choice')}>Exit Choice</button>
          <button onClick={() => createCopilotProposal('repair_missing_targets')}>Repair Targets</button>
          <button onClick={() => createCopilotProposal('fill_empty_fields')}>Fill Drafts</button>
        </div>

        {copilot.status && <div className="copilot-status">{copilot.status}</div>}
      </div>

      <div className="copilot-column copilot-column--chat">
        <div className="copilot-context">
          <div className="copilot-section-head">Selected Context</div>
          <pre>{context}</pre>
        </div>

        <div className="copilot-chat-log">
          {copilot.messages.map((message, index) => (
            <div key={`${message.createdAt}:${index}`} className={`copilot-message copilot-message--${message.role}`}>
              <span>{message.role}</span>
              <p>{message.content}</p>
            </div>
          ))}
        </div>

        <div className="copilot-prompt-row">
          <input
            className="copilot-input"
            value={prompt}
            placeholder="Ask about validation, schema, selected context, or patch flow"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitPrompt();
            }}
          />
          <button className="copilot-btn copilot-btn--strong" onClick={submitPrompt}>Ask</button>
        </div>
      </div>

      <div className="copilot-column copilot-column--review">
        <div className="copilot-section">
          <div className="copilot-section-head">Validation Explanation</div>
          {explainableIssue ? (
            <div className="copilot-explain">
              <span>{issueLabel(explainableIssue)}</span>
              <p>{explainValidationIssue(explainableIssue)}</p>
            </div>
          ) : (
            <div className="copilot-empty">No issue to explain.</div>
          )}
        </div>

        <div className="copilot-section">
          <div className="copilot-section-head">Schema Suggestions</div>
          <div className="copilot-note-list">
            {schemaNotes.map((note) => (
              <div key={note} className="copilot-note">{note}</div>
            ))}
          </div>
        </div>

        <div className="copilot-section copilot-section--proposal">
          <div className="copilot-section-head">Patch Proposal</div>
          {copilot.proposal ? (
            <>
              <div className="copilot-proposal-title">{copilot.proposal.title}</div>
              <div className="copilot-proposal-summary">{copilot.proposal.summary}</div>
              <div className="copilot-diff-list">
                {copilot.proposal.ops.map((op, index) => (
                  <div key={`${op.op}:${index}`} className="copilot-diff-line">
                    <span>+</span>
                    {describeCopilotOp(op)}
                  </div>
                ))}
              </div>
              <div className="copilot-review-actions">
                <button className="copilot-btn" onClick={rejectCopilotProposal}>Reject</button>
                <button className="copilot-btn copilot-btn--strong" onClick={applyCopilotProposal}>Apply</button>
              </div>
            </>
          ) : (
            <div className="copilot-empty">No proposal drafted.</div>
          )}
        </div>
      </div>
    </div>
  );
}

