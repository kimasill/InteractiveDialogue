import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionLineType,
  MarkerType,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, Edge, OnReconnect } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppStore } from './store';
import { graphToFlow } from './utils/graphToFlow';
import type { FlowEdgeData, FlowGraphNode } from './utils/graphToFlow';
import { getCollapsedHiddenNodeIds, getFocusNodeIds } from './utils/graphUx';
import { importCsvFile, isCsvFile } from './utils/csvImport';
import { DialogueNodeCard } from './nodes/DialogueNodeCard';
import { PortalNodeCard } from './nodes/PortalNodeCard';
import { Inspector } from './panels/Inspector';
import { Toolbar } from './panels/Toolbar';
import { BottomPanel } from './panels/BottomPanel';
import './App.css';

const nodeTypes = { dialogue: DialogueNodeCard, portal: PortalNodeCard };

function severityRank(severity: 'error' | 'warning' | 'info' | undefined): number {
  if (severity === 'error') return 3;
  if (severity === 'warning') return 2;
  if (severity === 'info') return 1;
  return 0;
}

function GraphCanvas() {
  const {
    graph,
    selectedNodeId,
    selectNode,
    importGraph,
    setImportError,
    importError,
    playtest,
    graphView,
    updateNodePosition,
    retargetChoice,
    retargetAutoNext,
    report,
  } = useAppStore();
  const { fitView } = useReactFlow();
  const [dragState, setDragState] = useState<'idle' | 'ready' | 'reject'>('idle');
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowGraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const hiddenNodeIds = graph ? getCollapsedHiddenNodeIds(graph) : new Set<string>();
    const focusNodeIds =
      graphView.focusMode && graph ? getFocusNodeIds(graph, playtest.currentNodeId ?? selectedNodeId) : new Set<string>();
    const updated = graph
      ? graphToFlow(graph, {
          hiddenNodeIds,
          showBranchGroups: graphView.branchGroups,
          showPortalNodes: graphView.portalNodes,
          edgeBundling: graphView.edgeBundling,
          conditionFilter: graphView.conditionFilter,
          playerState: playtest.playerState,
        })
      : { nodes: [], edges: [] };
    const traceIds = new Set(playtest.trace.map((entry) => entry.nodeId));
    const issueSeverityByNode = new Map<string, 'error' | 'warning' | 'info'>();
    for (const issue of report?.issues ?? []) {
      if (!issue.nodeId) continue;
      const current = issueSeverityByNode.get(issue.nodeId);
      if (severityRank(issue.severity) > severityRank(current)) {
        issueSeverityByNode.set(issue.nodeId, issue.severity);
      }
    }
    const activeEdge = activeEdgeId ? updated.edges.find((edge) => edge.id === activeEdgeId) : undefined;
    const activeData = activeEdge?.data as FlowEdgeData | undefined;
    const highlightedNodes: FlowGraphNode[] = updated.nodes.map((node) => {
      const className = [
        node.id === playtest.currentNodeId
          ? 'flow-node--playtest-current'
          : traceIds.has(node.id)
            ? 'flow-node--playtest-trace'
            : undefined,
        focusNodeIds.size > 0 && !focusNodeIds.has(node.id) ? 'flow-node--dimmed' : undefined,
        activeEdge?.source === node.id ? 'flow-node--edge-source' : undefined,
        activeEdge?.target === node.id ? 'flow-node--edge-target' : undefined,
      ].filter(Boolean).join(' ') || undefined;

      if (node.type !== 'dialogue') return { ...node, className };

      return {
        ...node,
        data: {
          ...node.data,
          issueSeverity: issueSeverityByNode.get(node.id),
          activeChoiceId: activeEdge?.source === node.id ? activeData?.choiceId : undefined,
        },
        className,
      };
    });
    const highlightedEdges = updated.edges.map((edge) => ({
      ...edge,
      label: edge.id === activeEdgeId ? (edge.data as FlowEdgeData | undefined)?.label : undefined,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: (edge.data as FlowEdgeData | undefined)?.color ?? String(edge.style?.stroke ?? '#94a3b8'),
      },
      className: [
        edge.className,
        traceIds.has(edge.source) && traceIds.has(edge.target)
          ? 'flow-edge--playtest-trace'
          : focusNodeIds.size > 0 && (!focusNodeIds.has(edge.source) || !focusNodeIds.has(edge.target))
            ? 'flow-edge--dimmed'
            : undefined,
        edge.id === activeEdgeId ? 'flow-edge--active' : undefined,
      ].filter(Boolean).join(' ') || undefined,
      interactionWidth: graphView.edgeBundling ? 24 : edge.interactionWidth,
      style: {
        ...edge.style,
        strokeWidth: edge.id === activeEdgeId ? 3.2 : edge.style?.strokeWidth,
        opacity:
          focusNodeIds.size > 0 && (!focusNodeIds.has(edge.source) || !focusNodeIds.has(edge.target))
            ? 0.16
            : edge.style?.opacity,
      },
    }));
    setNodes(highlightedNodes);
    setEdges(highlightedEdges);
  }, [activeEdgeId, graph, graphView, playtest.currentNodeId, playtest.playerState, playtest.trace, report, selectedNodeId, setNodes, setEdges]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: FlowGraphNode) => {
      if (node.type !== 'dialogue') return;
      updateNodePosition(node.id, node.position);
    },
    [updateNodePosition],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || !params.sourceHandle) return;
      if (params.sourceHandle === 'auto') {
        retargetAutoNext(params.source, params.target);
        return;
      }
      if (!graph) return;
      const sourceNode = graph.nodes.find((node) => node.id === params.source);
      const choiceIndex = Number.parseInt(params.sourceHandle.replace(/^c/, ''), 10);
      const choice = sourceNode?.choices.find((candidate) => candidate.choiceIndex === choiceIndex);
      if (!choice) return;
      retargetChoice(choice.id, params.target);
    },
    [graph, retargetAutoNext, retargetChoice],
  );

  const onReconnect = useCallback<OnReconnect>(
    (oldEdge, newConnection) => {
      if (!newConnection.target) return;
      const data = oldEdge.data as FlowEdgeData | undefined;
      if (data?.edgeKind === 'auto') {
        retargetAutoNext(oldEdge.source, newConnection.target);
        return;
      }
      if (data?.choiceId) {
        retargetChoice(data.choiceId, newConnection.target);
      }
    },
    [retargetAutoNext, retargetChoice],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        const data = edge.data as FlowEdgeData | undefined;
        if (data?.edgeKind === 'auto') retargetAutoNext(edge.source, null);
        if (data?.choiceId) retargetChoice(data.choiceId, null);
      }
    },
    [retargetAutoNext, retargetChoice],
  );

  const importFile = useCallback(
    async (file: File) => {
      try {
        const { graph: g, issues, inputRows, sourceName } = await importCsvFile(file);
        if (issues.length > 0) {
          console.warn(`Import: ${issues.length} issue(s)`, issues);
        }
        importGraph(g, { sourceName, inputRows, issueCount: issues.length });
        setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'CSV import failed.');
      }
    },
    [fitView, importGraph, setImportError],
  );

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.items?.[0];
    const acceptsDrop = file?.kind === 'file' && (file.type === '' || file.type.includes('csv') || file.type === 'text/plain');
    e.dataTransfer.dropEffect = acceptsDrop ? 'copy' : 'none';
    setDragState(acceptsDrop ? 'ready' : 'reject');
  }

  function onDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragState('idle');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragState('idle');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!isCsvFile(file)) {
      setImportError('Only CSV files can be imported.');
      return;
    }
    void importFile(file);
  }

  return (
    <div className="canvas-container" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onEdgesDelete={onEdgesDelete}
        onEdgeMouseEnter={(_, edge) => setActiveEdgeId(edge.id)}
        onEdgeMouseLeave={() => setActiveEdgeId(null)}
        onEdgeClick={(_, edge) => setActiveEdgeId(edge.id)}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        edgesReconnectable
        reconnectRadius={18}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: '#38bdf8', strokeWidth: 2.4 }}
        defaultEdgeOptions={{
          type: 'default',
          interactionWidth: 28,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e1e2e" />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const nodeData = n.data as { node?: { npcId: string } };
            if (!nodeData?.node) return '#2a2a3e';
            let h = 0;
            for (const ch of nodeData.node.npcId) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
            const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];
            return palette[h % palette.length] ?? '#6366f1';
          }}
          maskColor="rgba(0,0,0,0.6)"
          style={{ bottom: 12, right: 12 }}
        />
      </ReactFlow>

      {(!graph || dragState !== 'idle') && (
        <div className={`drop-zone drop-zone--${dragState}`}>
          <div className="drop-zone-inner">
            <div className="drop-zone-mark">CSV</div>
            <div className="drop-zone-title">
              {dragState === 'reject' ? 'CSV files only' : importError ?? 'Drop a CSV here'}
            </div>
            <div className="drop-zone-sub">Import creates a local graph preview</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <ReactFlowProvider>
      <div className="app-layout">
        <Toolbar />
        <div className="app-body">
          <div className="app-workspace">
            <GraphCanvas />
            <BottomPanel />
          </div>
          <Inspector />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
