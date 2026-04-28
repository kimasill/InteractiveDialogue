import { importCsv } from '@kibbel/ngf-csv';
import type { ImportIssue } from '@kibbel/ngf-csv';
import type { NarrativeGraph } from '@kibbel/ngf-core';

export interface CsvImportOutcome {
  graph: NarrativeGraph;
  issues: ImportIssue[];
  inputRows: number;
  sourceName: string;
}

const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);

export function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv') || CSV_MIME_TYPES.has(file.type);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('The selected file could not be read as text.'));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('The selected file could not be read.'));
    };

    reader.readAsText(file);
  });
}

export async function importCsvFile(file: File, workspaceId = 'local'): Promise<CsvImportOutcome> {
  if (!isCsvFile(file)) {
    throw new Error('Only CSV files can be imported.');
  }

  const text = await readFileAsText(file);
  const { graph, issues, inputRows } = importCsv(text, { workspaceId });

  return {
    graph,
    issues,
    inputRows,
    sourceName: file.name,
  };
}
