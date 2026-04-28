import { describe, expect, it } from 'vitest';
import type { NarrativeGraph } from '@kibbel/ngf-core';
import { validate } from '../src/index.js';

function nodeFixture(id: string, opts: Partial<{ choices: any[]; auto: string | undefined }> = {}) {
  const [npcId, idxStr] = id.split(':');
  return {
    id,
    npcId: npcId!,
    nodeIndex: Number(idxStr),
    speakerName: 'Tester',
    dialogueText: 'hello',
    choices: opts.choices ?? [],
    autoNextNodeId: opts.auto,
  };
}

const graph = (nodes: any[]): NarrativeGraph => ({
  workspaceId: 'ws',
  schemaVersionId: 'sv',
  nodes,
});

describe('validate', () => {
  it('flags broken choice edges with fix suggestions', () => {
    const g = graph([
      nodeFixture('N:0', {
        choices: [
          {
            id: 'N:0:c0',
            nodeId: 'N:0',
            choiceIndex: 0,
            text: 'go',
            nextNodeId: 'N:99',
            requirements: [],
            outcomes: [],
          },
        ],
      }),
    ]);
    const report = validate(g);
    const broken = report.issues.find((i) => i.code === 'broken_edge_choice');
    expect(broken).toBeDefined();
    expect(broken!.severity).toBe('error');
    expect(broken!.fixes?.some((f) => f.kind === 'create_node')).toBe(true);
  });

  it('flags broken auto-continue edges', () => {
    const g = graph([nodeFixture('N:0', { auto: 'N:42' })]);
    const report = validate(g);
    expect(
      report.issues.find((i) => i.code === 'broken_edge_auto_continue'),
    ).toBeDefined();
  });

  it('flags duplicate ChoiceIndex on a node', () => {
    const g = graph([
      nodeFixture('N:0', {
        choices: [
          { id: 'N:0:c0', nodeId: 'N:0', choiceIndex: 0, text: 'a', requirements: [], outcomes: [] },
          { id: 'N:0:c0b', nodeId: 'N:0', choiceIndex: 0, text: 'b', requirements: [], outcomes: [] },
        ],
      }),
    ]);
    const report = validate(g);
    expect(report.issues.find((i) => i.code === 'duplicate_choice_index')).toBeDefined();
  });

  it('marks dead-ends as info', () => {
    const g = graph([nodeFixture('N:0')]);
    const report = validate(g);
    const dead = report.issues.find((i) => i.code === 'dead_end_node');
    expect(dead?.severity).toBe('info');
  });

  it('detects unreachable nodes when entry is given', () => {
    const g = graph([
      nodeFixture('N:0', {
        choices: [{ id: 'N:0:c0', nodeId: 'N:0', choiceIndex: 0, text: 'go', nextNodeId: 'N:1', requirements: [], outcomes: [] }],
      }),
      nodeFixture('N:1'),
      nodeFixture('N:7'), // orphan
    ]);
    const report = validate(g, { entryNodeIds: ['N:0'] });
    expect(report.issues.find((i) => i.code === 'unreachable_node' && i.nodeId === 'N:7')).toBeDefined();
    expect(report.issues.find((i) => i.code === 'unreachable_node' && i.nodeId === 'N:1')).toBeUndefined();
  });

  it('flags WorldFlagAtLeast requirement when no outcome sets the flag', () => {
    const g = graph([
      nodeFixture('N:0', {
        choices: [
          {
            id: 'N:0:c0',
            nodeId: 'N:0',
            choiceIndex: 0,
            text: 'gated',
            nextNodeId: undefined,
            requirements: [{ order: 0, type: 'WorldFlagAtLeast', tag: 'Never.Set.Flag', thresholdValue: 1 }],
            outcomes: [],
          },
        ],
      }),
    ]);
    const report = validate(g);
    expect(report.issues.find((i) => i.code === 'flag_required_but_never_set')).toBeDefined();
  });

  it('flags invalid requirement and outcome enum values', () => {
    const g = graph([
      nodeFixture('N:0', {
        choices: [
          {
            id: 'N:0:c0',
            nodeId: 'N:0',
            choiceIndex: 0,
            text: 'bad enums',
            requirements: [{ order: 0, type: 'NotARequirement' }],
            outcomes: [{ order: 0, type: 'NotAnOutcome' }],
          },
        ],
      }),
    ]);
    const report = validate(g);
    expect(report.issues.filter((i) => i.code === 'invalid_enum')).toHaveLength(2);
  });

  it('flags item requirements when no outcome gives the item tag', () => {
    const g = graph([
      nodeFixture('N:0', {
        choices: [
          {
            id: 'N:0:c0',
            nodeId: 'N:0',
            choiceIndex: 0,
            text: 'needs key',
            requirements: [{ order: 0, type: 'HasItemTag', tag: 'Dungeon.Key' }],
            outcomes: [],
          },
        ],
      }),
    ]);
    const report = validate(g);
    expect(report.issues.find((i) => i.code === 'item_required_but_never_given')).toBeDefined();
  });

  it('flags persona thresholds above known positive persona gains', () => {
    const g = graph([
      nodeFixture('N:0', {
        choices: [
          {
            id: 'N:0:c0',
            nodeId: 'N:0',
            choiceIndex: 0,
            text: 'needs persona',
            requirements: [{ order: 0, type: 'PersonaAtLeast', thresholdValue: 5 }],
            outcomes: [{ order: 0, type: 'AdjustPersona', intValue: 2 }],
          },
        ],
      }),
    ]);
    const report = validate(g);
    expect(report.issues.find((i) => i.code === 'persona_threshold_may_be_unreachable')).toBeDefined();
  });
});
