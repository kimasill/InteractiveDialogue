import { useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { exportCsv } from '@ngf/csv';
import { useAppStore } from '../store';
import { importCsvFile } from '../utils/csvImport';
import { downloadTextFile } from '../utils/download';
import './Toolbar.css';

export function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    importGraph,
    setImportError,
    applyAutoLayout,
    runValidation,
    applyBranchLaneLayout,
    toggleGraphView,
    toggleSelectedCollapse,
    toggleSelectedLock,
    graph,
    graphView,
    selectedNodeId,
    report,
    importSummary,
    importError,
  } = useAppStore();
  const { fitView } = useReactFlow();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const { graph: g, issues, inputRows, sourceName } = await importCsvFile(file);
      if (issues.length > 0) {
        console.warn(`Import: ${issues.length} issue(s)`, issues);
      }
      importGraph(g, { sourceName, inputRows, issueCount: issues.length });
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'CSV import failed.');
    } finally {
      // Reset so the same file can be re-imported
      e.target.value = '';
    }
  }

  const errorCount = report?.errorCount ?? 0;
  const warnCount = report?.warningCount ?? 0;
  const nodeCount = graph?.nodes.length ?? 0;
  function handleAutoLayout() {
    applyAutoLayout();
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }

  function handleBranchLaneLayout() {
    applyBranchLaneLayout();
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }

  function handleExportCsv() {
    if (!graph) return;
    downloadTextFile('ngf-export.csv', exportCsv(graph), 'text/csv;charset=utf-8');
  }

  return (
    <div className="toolbar">
      <div className="toolbar-brand">NGF</div>

      <button className="toolbar-btn" onClick={() => fileRef.current?.click()}>
        Import CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {graph && (
        <>
          <button className="toolbar-btn" onClick={handleAutoLayout}>
            Auto Layout
          </button>
          <button className="toolbar-btn" onClick={handleBranchLaneLayout}>
            Branch Lane
          </button>
          <button
            className={`toolbar-btn toolbar-btn--toggle${graphView.focusMode ? ' toolbar-btn--active' : ''}`}
            onClick={() => toggleGraphView('focusMode')}
          >
            Focus
          </button>
          <button
            className={`toolbar-btn toolbar-btn--toggle${graphView.conditionFilter ? ' toolbar-btn--active' : ''}`}
            onClick={() => toggleGraphView('conditionFilter')}
          >
            Conditions
          </button>
          <button
            className={`toolbar-btn toolbar-btn--toggle${graphView.edgeBundling ? ' toolbar-btn--active' : ''}`}
            onClick={() => toggleGraphView('edgeBundling')}
          >
            Bundle
          </button>
          <button
            className={`toolbar-btn toolbar-btn--toggle${graphView.portalNodes ? ' toolbar-btn--active' : ''}`}
            onClick={() => toggleGraphView('portalNodes')}
          >
            Portals
          </button>
          <button className="toolbar-btn toolbar-btn--ghost" disabled={!selectedNodeId} onClick={toggleSelectedCollapse}>
            Collapse
          </button>
          <button className="toolbar-btn toolbar-btn--ghost" disabled={!selectedNodeId} onClick={toggleSelectedLock}>
            Lock
          </button>
          <button className="toolbar-btn" onClick={runValidation}>
            Validate
          </button>
          <button className="toolbar-btn" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button className="toolbar-btn toolbar-btn--ghost" onClick={() => fitView({ padding: 0.15, duration: 400 })}>
            Fit View
          </button>
        </>
      )}

      <div className="toolbar-spacer" />

      {graph && (
        <div className="toolbar-stats">
          <span className="toolbar-stat">{nodeCount} nodes</span>
          {importSummary && (
            <span className="toolbar-stat toolbar-stat--muted">
              {importSummary.sourceName} - {importSummary.inputRows} rows
            </span>
          )}
          {importSummary && importSummary.issueCount > 0 && (
            <span className="toolbar-stat toolbar-stat--warn">{importSummary.issueCount} import issues</span>
          )}
          {errorCount > 0 && <span className="toolbar-stat toolbar-stat--error">{errorCount} errors</span>}
          {warnCount > 0 && <span className="toolbar-stat toolbar-stat--warn">{warnCount} warnings</span>}
          {errorCount === 0 && warnCount === 0 && report && (
            <span className="toolbar-stat toolbar-stat--ok">✓ valid</span>
          )}
        </div>
      )}

      {importError && <div className="toolbar-error">{importError}</div>}
    </div>
  );
}
