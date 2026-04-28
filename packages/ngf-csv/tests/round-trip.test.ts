import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { exportCsv, exportRows, importCsv } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = resolve(here, '../../../assets/samples/NPC_Dialogue_Jijibo.csv');

describe('CSV round-trip', () => {
  it('imports the Jijibo sample without errors', () => {
    const text = readFileSync(SAMPLE, 'utf8');
    const result = importCsv(text);
    expect(result.issues, JSON.stringify(result.issues, null, 2)).toHaveLength(0);
    expect(result.graph.nodes.length).toBeGreaterThan(5);
  });

  it('groups choice rows by NPCId+NodeIndex+ChoiceIndex', () => {
    const text = readFileSync(SAMPLE, 'utf8');
    const { graph } = importCsv(text);

    // Node Jijibo:1 has choices 0..3, and choice 1 ("스피커 모듈을 가져왔어.")
    // is split across 3 source rows (1 requirement + 3 outcomes).
    const node = graph.nodes.find((n) => n.id === 'Jijibo:1');
    expect(node, 'Jijibo:1 should exist').toBeDefined();
    expect(node!.choices.map((c) => c.choiceIndex).sort()).toEqual([0, 1, 2, 3]);

    const c1 = node!.choices.find((c) => c.choiceIndex === 1)!;
    expect(c1.text).toBe('스피커 모듈을 가져왔어.');
    expect(c1.requirements).toHaveLength(1);
    expect(c1.requirements[0]).toMatchObject({
      order: 0,
      type: 'HasItemTag',
      tag: 'Item.Part.SpeakerModule',
    });
    expect(c1.outcomes.map((o) => o.type)).toEqual([
      'TakeItem',
      'SetWorldFlag',
      'AdjustPersona',
    ]);
  });

  it('round-trips through export and re-import to the same graph', () => {
    const text = readFileSync(SAMPLE, 'utf8');
    const a = importCsv(text);
    const csv2 = exportCsv(a.graph);
    const b = importCsv(csv2);
    expect(b.issues, JSON.stringify(b.issues)).toHaveLength(0);
    expect(b.graph.nodes).toEqual(a.graph.nodes);
  });

  it('exports rowCount = max(req, outcome, 1) per choice', () => {
    const text = readFileSync(SAMPLE, 'utf8');
    const { graph } = importCsv(text);

    const node = graph.nodes.find((n) => n.id === 'Jijibo:1')!;
    const c1 = node.choices.find((c) => c.choiceIndex === 1)!;
    const expectedFan = Math.max(c1.requirements.length, c1.outcomes.length, 1);
    expect(expectedFan).toBe(3);

    const rows = exportRows(graph);
    const c1Rows = rows.filter(
      (r) =>
        r.NPCId === 'Jijibo' &&
        r.NodeIndex === '1' &&
        r.ChoiceIndex === '1',
    );
    expect(c1Rows).toHaveLength(3);
  });

  it('treats -1 NodeIndex references as no-link', () => {
    const text = readFileSync(SAMPLE, 'utf8');
    const { graph } = importCsv(text);
    const exit = graph.nodes
      .find((n) => n.id === 'Jijibo:5')!;
    expect(exit.choices[0]!.nextNodeId).toBeUndefined();
  });
});
