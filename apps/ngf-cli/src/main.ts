/**
 * ngf — Narrative Graph Framework CLI
 *
 * Subcommands:
 *   ngf inspect <file.csv>           import + summarize
 *   ngf validate <file.csv> [--entry MAX]
 *   ngf round-trip <file.csv>        import, re-export, diff row counts
 *   ngf export <file.csv> > out.csv  import then export to stdout
 *   ngf normalize <file.csv> [npcId] emit normalized graph JSON
 *   ngf bundle <file.csv> [npcId]    emit runtime JSON bundle
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { exportCsv, importCsv } from '@kibbel/ngf-csv';
import { buildRuntimeBundle, exportNormalizedJson } from '@kibbel/ngf-runtime';
import { validate } from '@kibbel/ngf-validate';

const argv = process.argv.slice(2);
const cmd = argv[0];
const args = argv.slice(1);

function readSource(path: string | undefined): string {
  if (!path) die('missing <file.csv>');
  try {
    return readFileSync(path!, 'utf8');
  } catch (e) {
    die(`cannot read ${path}: ${(e as Error).message}`);
  }
}

function die(msg: string): never {
  process.stderr.write(`ngf: ${msg}\n`);
  process.exit(1);
}

function fmtCount(n: number, label: string): string {
  return `${n} ${label}${n === 1 ? '' : 's'}`;
}

function run(): void {
  switch (cmd) {
    case 'inspect': {
      const text = readSource(args[0]);
      const { graph, issues, inputRows } = importCsv(text);
      const totalChoices = graph.nodes.reduce((s, n) => s + n.choices.length, 0);
      console.log(`source rows:    ${inputRows}`);
      console.log(`nodes:          ${graph.nodes.length}`);
      console.log(`choices:        ${totalChoices}`);
      console.log(`import issues:  ${issues.length}`);
      const npcs = new Map<string, number>();
      for (const n of graph.nodes) npcs.set(n.npcId, (npcs.get(n.npcId) ?? 0) + 1);
      for (const [npc, c] of npcs) console.log(`  npc ${npc}: ${fmtCount(c, 'node')}`);
      break;
    }
    case 'validate': {
      const text = readSource(args[0]);
      const { graph } = importCsv(text);
      const entryArg = args.findIndex((a) => a === '--entry');
      const entryNodeMaxIndex =
        entryArg >= 0 && args[entryArg + 1] !== undefined
          ? Number.parseInt(args[entryArg + 1]!, 10)
          : 5;
      const report = validate(graph, { entryNodeMaxIndex });
      console.log(
        `validation: ${report.errorCount} errors, ${report.warningCount} warnings, ${report.issues.length} total`,
      );
      for (const issue of report.issues) {
        const tag = issue.severity.toUpperCase().padEnd(7);
        const where = issue.choiceId ?? issue.nodeId ?? '';
        console.log(`  ${tag} [${issue.code}] ${where}  ${issue.message}`);
      }
      if (report.errorCount > 0) process.exit(2);
      break;
    }
    case 'round-trip': {
      const text = readSource(args[0]);
      const a = importCsv(text);
      const csv2 = exportCsv(a.graph);
      const b = importCsv(csv2);
      const aRows = exportCsv(a.graph).split('\n').length - 2; // header + trailing newline
      const bRows = csv2.split('\n').length - 2;
      const equal = JSON.stringify(a.graph.nodes) === JSON.stringify(b.graph.nodes);
      console.log(`re-import equal: ${equal}`);
      console.log(`exported rows:   ${aRows}`);
      console.log(`re-exported:     ${bRows}`);
      console.log(`import issues:   ${a.issues.length} -> ${b.issues.length}`);
      if (!equal) process.exit(2);
      break;
    }
    case 'export': {
      const text = readSource(args[0]);
      const { graph } = importCsv(text);
      process.stdout.write(exportCsv(graph));
      break;
    }
    case 'normalize': {
      const text = readSource(args[0]);
      const { graph } = importCsv(text);
      const npcId = args[1]?.startsWith('-') ? undefined : args[1];
      const filtered = npcId
        ? { ...graph, nodes: graph.nodes.filter((n) => n.npcId === npcId) }
        : graph;
      const out = args.findIndex((a) => a === '-o');
      const json = JSON.stringify(exportNormalizedJson(filtered), null, 2);
      if (out >= 0 && args[out + 1]) {
        writeFileSync(args[out + 1]!, json + '\n');
        console.log(`wrote ${args[out + 1]}`);
      } else {
        process.stdout.write(json + '\n');
      }
      break;
    }
    case 'bundle': {
      const text = readSource(args[0]);
      const { graph } = importCsv(text);
      const npcId = args[1]?.startsWith('-') ? undefined : args[1];
      const filtered = npcId
        ? { ...graph, nodes: graph.nodes.filter((n) => n.npcId === npcId) }
        : graph;
      const entryArg = args.findIndex((a) => a === '--entry');
      const entryNodeMaxIndex =
        entryArg >= 0 && args[entryArg + 1] !== undefined
          ? Number.parseInt(args[entryArg + 1]!, 10)
          : undefined;
      const out = args.findIndex((a) => a === '-o');
      const json = JSON.stringify(buildRuntimeBundle(filtered, { entryNodeMaxIndex }), null, 2);
      if (out >= 0 && args[out + 1]) {
        writeFileSync(args[out + 1]!, json + '\n');
        console.log(`wrote ${args[out + 1]}`);
      } else {
        process.stdout.write(json + '\n');
      }
      break;
    }
    case 'help':
    case '--help':
    case undefined:
      console.log(`ngf — Narrative Graph Framework CLI

Usage:
  ngf inspect    <file.csv>
  ngf validate   <file.csv> [--entry <maxIndex>]
  ngf round-trip <file.csv>
  ngf export     <file.csv>
  ngf normalize  <file.csv> [npcId] [-o out.json]
  ngf bundle     <file.csv> [npcId] [--entry <maxIndex>] [-o out.json]
`);
      break;
    default:
      die(`unknown command: ${cmd}`);
  }
}

run();
