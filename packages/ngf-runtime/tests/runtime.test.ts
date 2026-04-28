import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { NarrativeGraph } from '@ngf/core';
import { importCsv } from '@ngf/csv';
import {
  advanceRuntimeChoice,
  applyRuntimeOutcomes,
  buildRuntimeBundle,
  createRuntimePlayerState,
  evaluateRuntimeChoice,
  exportNormalizedJson,
  getRuntimeNode,
  resolveRuntimeEntry,
} from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = resolve(here, '../../../assets/samples/NPC_Dialogue_Jijibo.csv');

function graphFixture(): NarrativeGraph {
  return {
    workspaceId: 'ws',
    schemaVersionId: 'sv',
    nodes: [
      {
        id: 'N:0',
        npcId: 'N',
        nodeIndex: 0,
        speakerName: 'Guide',
        dialogueText: 'Start',
        choices: [
          {
            id: 'N:0:c0',
            nodeId: 'N:0',
            choiceIndex: 0,
            text: 'Use key',
            nextNodeId: 'N:1',
            requirements: [{ order: 0, type: 'HasItemTag', tag: 'Key' }],
            outcomes: [
              { order: 0, type: 'SetWorldFlag', worldFlag: 'Door.Open', intValue: 1 },
              { order: 1, type: 'AdjustPersona', intValue: 2 },
            ],
          },
        ],
      },
      {
        id: 'N:1',
        npcId: 'N',
        nodeIndex: 1,
        speakerName: 'Guide',
        dialogueText: 'Done',
        choices: [],
      },
    ],
  };
}

describe('@ngf/runtime', () => {
  it('exports normalized JSON without editor-only position/ui state', () => {
    const graph = graphFixture();
    graph.nodes[0]!.position = { x: 10, y: 20 };
    graph.nodes[0]!.uiState = { collapsed: true };

    const normalized = exportNormalizedJson(graph);
    expect(normalized.format).toBe('ngf.normalized.graph');
    expect(normalized.nodes[0]).not.toHaveProperty('position');
    expect(normalized.nodes[0]).not.toHaveProperty('uiState');
    expect(normalized.nodes[0]!.choices[0]!.requirements[0]!.type).toBe('HasItemTag');
  });

  it('builds a runtime bundle with node and choice ID tables', () => {
    const bundle = buildRuntimeBundle(graphFixture(), { generatedAt: '2026-01-01T00:00:00.000Z' });
    expect(bundle.format).toBe('ngf.runtime.bundle');
    expect(bundle.tables.nodeIds).toEqual(['N:0', 'N:1']);
    expect(bundle.tables.choiceIds).toEqual(['N:0:c0']);
    expect(bundle.nodes[0]!.choices[0]!.next).toBe(1);
  });

  it('evaluates requirements and applies outcomes for game state', () => {
    const bundle = buildRuntimeBundle(graphFixture());
    const node = getRuntimeNode(bundle, 'N:0')!;
    const blocked = evaluateRuntimeChoice(node.choices[0]!, createRuntimePlayerState());
    expect(blocked.available).toBe(false);

    const state = createRuntimePlayerState({ itemTags: ['Key'] });
    const available = evaluateRuntimeChoice(node.choices[0]!, state);
    expect(available.available).toBe(true);

    const advanced = advanceRuntimeChoice(bundle, state, 'N:0', 'N:0:c0');
    expect(advanced.ok).toBe(true);
    expect(advanced.currentNode?.id).toBe(1);
    expect(advanced.state.worldFlags['Door.Open']).toBe(1);
    expect(advanced.state.persona).toBe(2);
  });

  it('keeps runtime outcome semantics aligned with playtest expectations', () => {
    const state = createRuntimePlayerState({ itemTags: ['Old'], persona: 1 });
    const applied = applyRuntimeOutcomes(state, [
      { order: 0, type: 'TakeItem', tagPayload: 'Key' },
      { order: 1, type: 'SetWorldFlag', worldFlag: 'Door.Open', intValue: 1 },
      { order: 2, type: 'AdjustPersona', intValue: 4 },
    ]);

    expect(applied.state.itemTags).toEqual(['Key', 'Old']);
    expect(applied.state.worldFlags['Door.Open']).toBe(1);
    expect(applied.state.persona).toBe(5);
  });

  it('bundles the sample CSV as a playable runtime artifact', () => {
    const text = readFileSync(SAMPLE, 'utf8');
    const { graph } = importCsv(text);
    const bundle = buildRuntimeBundle(graph, { entryNodeMaxIndex: 5 });
    const entry = resolveRuntimeEntry(bundle, createRuntimePlayerState());

    expect(bundle.nodes.length).toBe(graph.nodes.length);
    expect(bundle.entries.length).toBeGreaterThan(0);
    expect(entry).not.toBeNull();
  });
});
