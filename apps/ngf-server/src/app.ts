import { Hono } from 'hono';
import type { Context } from 'hono';
import { importCsv, exportCsv } from '@kimasill/ngf-csv';
import { validate } from '@kimasill/ngf-validate';
import {
  listWorkspaces, getWorkspace, createWorkspace, updateWorkspace, deleteWorkspace,
  listSchemaVersions, getSchemaVersion, createSchemaVersion, deleteSchemaVersion,
  listNodes, getNode, upsertNodes, deleteNode, setNodePosition, patchGraph, loadGraph,
  listSnapshots, getSnapshot, saveSnapshot, deleteSnapshot,
} from '@kimasill/ngf-db';
import type { PatchOp } from '@kimasill/ngf-db';

const app = new Hono();

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function err400(c: Context<any, any, any>, msg: string) {
  return c.json({ error: msg }, 400);
}

/* ── Workspaces ──────────────────────────────────────────────────────────── */

app.get('/workspaces', (c) => c.json(listWorkspaces()));

app.post('/workspaces', async (c) => {
  const body = await c.req.json<{ name: string; activeSchemaVersionId?: string }>();
  if (!body.name) return err400(c, 'name is required');
  const ws = createWorkspace({
    id: uid(),
    name: body.name,
    activeSchemaVersionId: body.activeSchemaVersionId ?? '',
  });
  return c.json(ws, 201);
});

app.get('/workspaces/:id', (c) => {
  const ws = getWorkspace(c.req.param('id'));
  if (!ws) return c.json({ error: 'not found' }, 404);
  return c.json(ws);
});

app.patch('/workspaces/:id', async (c) => {
  const body = await c.req.json<{ name?: string; activeSchemaVersionId?: string }>();
  const updated = updateWorkspace(c.req.param('id'), body);
  if (!updated) return c.json({ error: 'not found' }, 404);
  return c.json(updated);
});

app.delete('/workspaces/:id', (c) => {
  const ok = deleteWorkspace(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
});

/* ── Schema Versions ─────────────────────────────────────────────────────── */

app.get('/workspaces/:wsId/schema-versions', (c) => {
  return c.json(listSchemaVersions(c.req.param('wsId')));
});

app.post('/workspaces/:wsId/schema-versions', async (c) => {
  const wsId = c.req.param('wsId');
  if (!getWorkspace(wsId)) return c.json({ error: 'workspace not found' }, 404);
  const body = await c.req.json<{ version: number; label?: string; data?: unknown }>();
  if (body.version === undefined) return err400(c, 'version is required');
  const sv = createSchemaVersion({
    id: uid(),
    workspaceId: wsId,
    version: body.version,
    label: body.label ?? '',
    data: body.data ?? {},
  });
  return c.json(sv, 201);
});

app.get('/workspaces/:wsId/schema-versions/:id', (c) => {
  const sv = getSchemaVersion(c.req.param('id'));
  if (!sv || sv.workspaceId !== c.req.param('wsId')) return c.json({ error: 'not found' }, 404);
  return c.json(sv);
});

app.delete('/workspaces/:wsId/schema-versions/:id', (c) => {
  const sv = getSchemaVersion(c.req.param('id'));
  if (!sv || sv.workspaceId !== c.req.param('wsId')) return c.json({ error: 'not found' }, 404);
  deleteSchemaVersion(c.req.param('id'));
  return c.json({ ok: true });
});

/* ── Graph Nodes ─────────────────────────────────────────────────────────── */

app.get('/workspaces/:wsId/nodes', (c) => {
  return c.json(listNodes(c.req.param('wsId')));
});

app.get('/workspaces/:wsId/nodes/:nodeId', (c) => {
  const node = getNode(c.req.param('wsId'), c.req.param('nodeId'));
  if (!node) return c.json({ error: 'not found' }, 404);
  return c.json(node);
});

app.delete('/workspaces/:wsId/nodes/:nodeId', (c) => {
  const ok = deleteNode(c.req.param('wsId'), c.req.param('nodeId'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
});

app.put('/workspaces/:wsId/nodes/:nodeId/position', async (c) => {
  const body = await c.req.json<{ x: number; y: number }>();
  if (body.x === undefined || body.y === undefined) return err400(c, 'x and y required');
  const ok = setNodePosition(c.req.param('wsId'), c.req.param('nodeId'), body.x, body.y);
  return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
});

/* ── Patch (batch graph operations) ─────────────────────────────────────── */

app.post('/workspaces/:wsId/patch', async (c) => {
  const body = await c.req.json<{ ops: PatchOp[] }>();
  if (!Array.isArray(body.ops)) return err400(c, 'ops must be an array');
  const result = patchGraph(c.req.param('wsId'), body.ops);
  return c.json(result, result.ok ? 200 : 422);
});

/* ── Full graph ──────────────────────────────────────────────────────────── */

app.get('/workspaces/:wsId/graph', (c) => {
  const ws = getWorkspace(c.req.param('wsId'));
  if (!ws) return c.json({ error: 'not found' }, 404);
  return c.json(loadGraph(c.req.param('wsId'), ws.activeSchemaVersionId));
});

/* ── CSV Import ──────────────────────────────────────────────────────────── */

app.post('/workspaces/:wsId/import-csv', async (c) => {
  const wsId = c.req.param('wsId');
  const ws = getWorkspace(wsId);
  if (!ws) return c.json({ error: 'workspace not found' }, 404);

  const text = await c.req.text();
  if (!text.trim()) return err400(c, 'request body must be CSV text');

  const { graph, issues, inputRows } = importCsv(text, {
    workspaceId: wsId,
    schemaVersionId: ws.activeSchemaVersionId,
  });

  upsertNodes(wsId, graph.nodes);

  const label = c.req.header('X-Snapshot-Label') ?? new Date().toISOString();
  const snapshot = saveSnapshot({ id: uid(), workspaceId: wsId, label, graph });

  return c.json(
    { snapshot: snapshot.id, inputRows, importIssues: issues.length, nodeCount: graph.nodes.length },
    201,
  );
});

/* ── CSV Export ──────────────────────────────────────────────────────────── */

app.get('/workspaces/:wsId/export-csv', (c) => {
  const ws = getWorkspace(c.req.param('wsId'));
  if (!ws) return c.json({ error: 'not found' }, 404);
  const csv = exportCsv(loadGraph(c.req.param('wsId'), ws.activeSchemaVersionId));
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8' } });
});

/* ── Validate ────────────────────────────────────────────────────────────── */

app.get('/workspaces/:wsId/validate', (c) => {
  const ws = getWorkspace(c.req.param('wsId'));
  if (!ws) return c.json({ error: 'not found' }, 404);
  return c.json(validate(loadGraph(c.req.param('wsId'), ws.activeSchemaVersionId)));
});

/* ── Import Snapshots ────────────────────────────────────────────────────── */

app.get('/workspaces/:wsId/snapshots', (c) => {
  return c.json(listSnapshots(c.req.param('wsId')));
});

app.get('/workspaces/:wsId/snapshots/:id', (c) => {
  const snap = getSnapshot(c.req.param('id'));
  if (!snap || snap.workspaceId !== c.req.param('wsId')) return c.json({ error: 'not found' }, 404);
  return c.json(snap);
});

app.delete('/workspaces/:wsId/snapshots/:id', (c) => {
  const snap = getSnapshot(c.req.param('id'));
  if (!snap || snap.workspaceId !== c.req.param('wsId')) return c.json({ error: 'not found' }, 404);
  deleteSnapshot(c.req.param('id'));
  return c.json({ ok: true });
});

export default app;
