/**
 * Minimal RFC 4180 CSV parser. Handles:
 *   - quoted fields, escaped quotes ("")
 *   - CRLF / LF line endings
 *   - empty trailing fields
 *
 * Not a substitute for a full library, but sufficient for editor-controlled
 * narrative data. Throws on malformed quoting.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < text.length) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      if (field.length !== 0) {
        throw new Error(`unexpected quote at offset ${i}`);
      }
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }

    if (ch === '\r') {
      // swallow optional \n
      if (text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  if (inQuotes) throw new Error('unterminated quoted field');
  // flush trailing
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface RowMap {
  [column: string]: string;
}

export function rowsToObjects(matrix: string[][]): RowMap[] {
  if (matrix.length === 0) return [];
  const header = matrix[0]!;
  const out: RowMap[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r]!;
    // skip blank rows
    if (row.length === 1 && row[0] === '') continue;
    const obj: RowMap = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c]!;
      obj[key] = row[c] ?? '';
    }
    out.push(obj);
  }
  return out;
}
