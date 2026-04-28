/** Serialize a string field per RFC 4180. */
export function serializeField(value: string): string {
  if (value === '') return '';
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function serializeCsv(matrix: ReadonlyArray<ReadonlyArray<string>>): string {
  const lines: string[] = [];
  for (const row of matrix) {
    lines.push(row.map(serializeField).join(','));
  }
  // Final newline, no CRLF — keeps git-diffs clean.
  return lines.join('\n') + '\n';
}
