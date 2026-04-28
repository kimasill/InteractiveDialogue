import { useEffect, useMemo, useState } from 'react';
import { exportCsv, exportRows, importRows, NPC_DIALOGUE_COLUMNS, type NpcDialogueColumn } from '@kibbel/ngf-csv';
import type { DialogueNode, NarrativeGraph } from '@kibbel/ngf-core';
import type { ValidationFix, ValidationIssue } from '@kibbel/ngf-validate';
import { useAppStore } from '../store';
import { downloadTextFile } from '../utils/download';
import { CopilotPanel } from './CopilotPanel';
import { PlaytestPanel } from './PlaytestPanel';
import { ReviewPanel } from './ReviewPanel';
import { SchemaPanel } from './SchemaPanel';
import './BottomPanel.css';

type BottomTab = 'issues' | 'playtest' | 'schema' | 'copilot' | 'review' | 'table' | 'csv';
type ScopeKind = 'all' | 'npc' | 'branch';
type CsvRow = Record<NpcDialogueColumn, string>;

interface Scope {
  kind: ScopeKind;
  value?: string;
}

const EXPORT_PROFILE = {
  id: 'npc-dialogue-v1',
  label: 'NPC Dialogue v1',
  columns: NPC_DIALOGUE_COLUMNS.length,
};

function emptyRow(): CsvRow {
  return Object.fromEntries(NPC_DIALOGUE_COLUMNS.map((column) => [column, ''])) as CsvRow;
}

function normalizeRows(rows: Record<string, string>[]): CsvRow[] {
  return rows.map((row) => {
    const next = emptyRow();
    for (const column of NPC_DIALOGUE_COLUMNS) {
      next[column] = row[column] ?? '';
    }
    return next;
  });
}

function getReachableNodeIds(graph: NarrativeGraph, startId: string | null): Set<string> {
  const reachable = new Set<string>();
  if (!startId) return reachable;

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const queue = [startId];
  reachable.add(startId);

  for (let i = 0; i < queue.length; i++) {
    const node = nodes.get(queue[i]!);
    if (!node) continue;
    const targets = [
      node.autoNextNodeId,
      ...node.choices.map((choice) => choice.nextNodeId),
    ].filter((target): target is string => Boolean(target));

    for (const target of targets) {
      if (!nodes.has(target) || reachable.has(target)) continue;
      reachable.add(target);
      queue.push(target);
    }
  }

  return reachable;
}

function getScopedNodes(graph: NarrativeGraph, scope: Scope, selectedNodeId: string | null): DialogueNode[] {
  if (scope.kind === 'npc' && scope.value) {
    return graph.nodes.filter((node) => node.npcId === scope.value);
  }

  if (scope.kind === 'branch') {
    const reachable = getReachableNodeIds(graph, selectedNodeId);
    return graph.nodes.filter((node) => reachable.has(node.id));
  }

  return graph.nodes;
}

function mergeScopedGraph(
  current: NarrativeGraph,
  imported: NarrativeGraph,
  scope: Scope,
  selectedNodeId: string | null,
): NarrativeGraph {
  const positions = new Map(current.nodes.map((node) => [node.id, node.position]));
  const importedNodes = imported.nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));

  if (scope.kind === 'all') {
    return { ...current, nodes: importedNodes };
  }

  const removeIds = new Set(getScopedNodes(current, scope, selectedNodeId).map((node) => node.id));
  const untouchedNodes = current.nodes.filter((node) => !removeIds.has(node.id));

  return {
    ...current,
    nodes: [...untouchedNodes, ...importedNodes].sort((a, b) =>
      a.npcId === b.npcId ? a.nodeIndex - b.nodeIndex : a.npcId.localeCompare(b.npcId),
    ),
  };
}

function rowsToTsv(rows: CsvRow[]): string {
  return [
    NPC_DIALOGUE_COLUMNS.join('\t'),
    ...rows.map((row) => NPC_DIALOGUE_COLUMNS.map((column) => row[column]).join('\t')),
  ].join('\n');
}

function patchRowsFromTsv(rows: CsvRow[], startRow: number, startColumn: number, text: string): CsvRow[] {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => line.length > 0);
  const hasHeader = rawLines[0] === NPC_DIALOGUE_COLUMNS.join('\t');
  const lines = hasHeader ? rawLines.slice(1) : rawLines;
  if (lines.length === 0) return rows;

  const next = rows.length > 0 ? rows.map((row) => ({ ...row })) : [emptyRow()];

  lines.forEach((line, lineOffset) => {
    const rowIndex = startRow + lineOffset;
    while (next.length <= rowIndex) next.push(emptyRow());
    const cells = line.split('\t');
    cells.forEach((cell, columnOffset) => {
      const column = NPC_DIALOGUE_COLUMNS[startColumn + columnOffset];
      if (!column) return;
      next[rowIndex]![column] = cell;
    });
  });

  return next;
}

function useScopedRows(graph: NarrativeGraph | null, scope: Scope, selectedNodeId: string | null) {
  return useMemo(() => {
    if (!graph) return [];
    const scopedGraph = { ...graph, nodes: getScopedNodes(graph, scope, selectedNodeId) };
    return normalizeRows(exportRows(scopedGraph));
  }, [graph, scope.kind, scope.value, selectedNodeId]);
}

function fixLabel(fix: ValidationFix): string {
  switch (fix.kind) {
    case 'create_node':
      return `Create ${fix.targetNodeId}`;
    case 'change_target':
      return 'Retarget';
    case 'remove_choice':
      return 'Remove choice';
    case 'create_setter_outcome':
      return `Set ${fix.flag}`;
  }
}

function issueTitle(issue: ValidationIssue): string {
  return issue.code.replace(/_/g, ' ');
}

export function BottomPanel() {
  const {
    graph,
    selectedNodeId,
    report,
    replaceGraph,
    setImportError,
    selectNode,
    runValidation,
    applyValidationFix,
  } = useAppStore();
  const [tab, setTab] = useState<BottomTab>('issues');
  const [scope, setScope] = useState<Scope>({ kind: 'all' });
  const [draftRows, setDraftRows] = useState<CsvRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [retargets, setRetargets] = useState<Record<string, string>>({});

  const npcIds = useMemo(() => {
    if (!graph) return [];
    return [...new Set(graph.nodes.map((node) => node.npcId))].sort();
  }, [graph]);

  const sourceRows = useScopedRows(graph, scope, selectedNodeId);
  const csvPreview = useMemo(() => {
    if (!graph) return '';
    return exportCsv({ ...graph, nodes: getScopedNodes(graph, scope, selectedNodeId) });
  }, [graph, scope.kind, scope.value, selectedNodeId]);

  useEffect(() => {
    setDraftRows(sourceRows);
    setStatus(null);
  }, [sourceRows]);

  useEffect(() => {
    if (scope.kind === 'branch' && !selectedNodeId) {
      setScope({ kind: 'all' });
    }
  }, [scope.kind, selectedNodeId]);

  if (!graph) return null;
  const currentGraph = graph;
  const issues = report?.issues ?? [];
  const infoCount = issues.filter((issue) => issue.severity === 'info').length;

  function updateCell(rowIndex: number, column: NpcDialogueColumn, value: string) {
    setDraftRows((rows) =>
      rows.map((row, index) => (index === rowIndex ? { ...row, [column]: value } : row)),
    );
  }

  function applyRows() {
    const { graph: imported, issues } = importRows(draftRows, {
      workspaceId: currentGraph.workspaceId,
      schemaVersionId: currentGraph.schemaVersionId,
    });
    if (issues.length > 0) {
      console.warn(`Table apply: ${issues.length} issue(s)`, issues);
    }
    replaceGraph(mergeScopedGraph(currentGraph, imported, scope, selectedNodeId));
    setStatus(`Applied ${draftRows.length} row(s)${issues.length > 0 ? ` with ${issues.length} issue(s)` : ''}.`);
  }

  async function copyTsv() {
    await navigator.clipboard.writeText(rowsToTsv(draftRows));
    setStatus(`Copied ${draftRows.length} row(s).`);
  }

  async function pasteTsv() {
    try {
      const text = await navigator.clipboard.readText();
      setDraftRows((rows) => patchRowsFromTsv(rows, 0, 0, text));
      setStatus('Pasted clipboard data into the table draft.');
    } catch {
      setStatus('Clipboard paste was blocked by the browser.');
    }
  }

  function downloadCsv() {
    downloadTextFile('ngf-export.csv', csvPreview, 'text/csv;charset=utf-8');
  }

  function applyFix(issue: ValidationIssue, fix: ValidationFix) {
    const targetNodeId = fix.kind === 'change_target' ? retargets[fix.choiceId] : undefined;
    applyValidationFix(fix, { nodeId: issue.nodeId, targetNodeId });
    if (fix.kind === 'create_node') {
      selectNode(fix.targetNodeId);
    } else if (issue.nodeId) {
      selectNode(issue.nodeId);
    }
    setStatus(`Applied fix: ${fixLabel(fix)}.`);
  }

  function handleScopeChange(value: string) {
    if (value === 'all') {
      setScope({ kind: 'all' });
      return;
    }
    if (value === 'branch') {
      setScope({ kind: 'branch' });
      return;
    }
    setScope({ kind: 'npc', value });
  }

  return (
    <div className="bottom-panel">
      <div className="bottom-panel-toolbar">
        <div className="bottom-panel-tabs" role="tablist" aria-label="Bottom panel view">
          <button className={`bottom-tab${tab === 'issues' ? ' bottom-tab--active' : ''}`} onClick={() => setTab('issues')}>
            Issues
          </button>
          <button className={`bottom-tab${tab === 'playtest' ? ' bottom-tab--active' : ''}`} onClick={() => setTab('playtest')}>
            Playtest
          </button>
          <button className={`bottom-tab${tab === 'schema' ? ' bottom-tab--active' : ''}`} onClick={() => setTab('schema')}>
            Schema
          </button>
          <button className={`bottom-tab${tab === 'copilot' ? ' bottom-tab--active' : ''}`} onClick={() => setTab('copilot')}>
            Copilot
          </button>
          <button className={`bottom-tab${tab === 'review' ? ' bottom-tab--active' : ''}`} onClick={() => setTab('review')}>
            Review
          </button>
          <button className={`bottom-tab${tab === 'table' ? ' bottom-tab--active' : ''}`} onClick={() => setTab('table')}>
            Table
          </button>
          <button className={`bottom-tab${tab === 'csv' ? ' bottom-tab--active' : ''}`} onClick={() => setTab('csv')}>
            CSV
          </button>
        </div>
        <div className="bottom-panel-profile">
          <span>{EXPORT_PROFILE.label}</span>
          <span>{EXPORT_PROFILE.columns} columns</span>
        </div>
        <select className="bottom-panel-select" value={scope.kind === 'npc' ? scope.value : scope.kind} onChange={(event) => handleScopeChange(event.target.value)}>
          <option value="all">All nodes</option>
          {selectedNodeId && <option value="branch">Selected branch</option>}
          {npcIds.map((npcId) => (
            <option key={npcId} value={npcId}>{npcId}</option>
          ))}
        </select>
        <div className="bottom-panel-spacer" />
        {status && <div className="bottom-panel-status">{status}</div>}
        {tab === 'issues' ? (
          <button className="bottom-panel-btn bottom-panel-btn--strong" onClick={runValidation}>Run Validation</button>
        ) : tab === 'playtest' || tab === 'schema' || tab === 'copilot' || tab === 'review' ? null : (
          <>
            <button className="bottom-panel-btn" onClick={copyTsv}>Copy TSV</button>
            <button className="bottom-panel-btn" onClick={pasteTsv}>Paste TSV</button>
            <button className="bottom-panel-btn" onClick={applyRows}>Apply Table</button>
            <button className="bottom-panel-btn bottom-panel-btn--strong" onClick={downloadCsv}>Download CSV</button>
          </>
        )}
      </div>

      {tab === 'issues' ? (
        <div className="validation-panel">
          <div className="validation-summary">
            <span className="validation-pill validation-pill--error">{report?.errorCount ?? 0} errors</span>
            <span className="validation-pill validation-pill--warning">{report?.warningCount ?? 0} warnings</span>
            <span className="validation-pill validation-pill--info">{infoCount} info</span>
          </div>
          {issues.length === 0 ? (
            <div className="validation-empty">No validation issues.</div>
          ) : (
            <div className="validation-list">
              {issues.map((issue, issueIndex) => (
                <div key={`${issue.code}:${issue.nodeId ?? ''}:${issue.choiceId ?? ''}:${issueIndex}`} className={`validation-item validation-item--${issue.severity}`}>
                  <button
                    className="validation-item-main"
                    onClick={() => issue.nodeId && selectNode(issue.nodeId)}
                  >
                    <span className="validation-item-code">{issueTitle(issue)}</span>
                    <span className="validation-item-message">{issue.message}</span>
                    <span className="validation-item-subject">
                      {issue.nodeId ?? 'graph'}{issue.choiceId ? ` / ${issue.choiceId}` : ''}
                    </span>
                  </button>
                  {issue.fixes && issue.fixes.length > 0 && (
                    <div className="validation-fixes">
                      {issue.fixes.map((fix, fixIndex) => (
                        <div key={`${fix.kind}:${fixIndex}`} className="validation-fix">
                          {fix.kind === 'change_target' && (
                            <select
                              className="validation-retarget"
                              value={retargets[fix.choiceId] ?? ''}
                              onChange={(event) =>
                                setRetargets((current) => ({ ...current, [fix.choiceId]: event.target.value }))
                              }
                            >
                              <option value="">Choose target</option>
                              {currentGraph.nodes.map((node) => (
                                <option key={node.id} value={node.id}>{node.id}</option>
                              ))}
                            </select>
                          )}
                          <button
                            className="validation-fix-btn"
                            disabled={fix.kind === 'change_target' && !retargets[fix.choiceId]}
                            onClick={() => applyFix(issue, fix)}
                          >
                            {fixLabel(fix)}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'playtest' ? (
        <PlaytestPanel />
      ) : tab === 'schema' ? (
        <SchemaPanel />
      ) : tab === 'copilot' ? (
        <CopilotPanel />
      ) : tab === 'review' ? (
        <ReviewPanel />
      ) : tab === 'table' ? (
        <div className="csv-table-wrap">
          <table className="csv-table">
            <thead>
              <tr>
                <th className="csv-table-rownum">#</th>
                {NPC_DIALOGUE_COLUMNS.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draftRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="csv-table-rownum">{rowIndex + 1}</td>
                  {NPC_DIALOGUE_COLUMNS.map((column, columnIndex) => (
                    <td key={column}>
                      <input
                        value={row[column]}
                        onChange={(event) => updateCell(rowIndex, column, event.target.value)}
                        onPaste={(event) => {
                          const text = event.clipboardData.getData('text/plain');
                          if (!text.includes('\t') && !text.includes('\n')) return;
                          event.preventDefault();
                          setDraftRows((rows) => patchRowsFromTsv(rows, rowIndex, columnIndex, text));
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <textarea
          className="csv-preview"
          readOnly
          value={csvPreview}
          onFocus={() => setImportError(null)}
        />
      )}
    </div>
  );
}
