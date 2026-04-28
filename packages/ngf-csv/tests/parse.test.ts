import { describe, expect, it } from 'vitest';
import { parseCsv, rowsToObjects } from '../src/parse.js';
import { serializeCsv } from '../src/serialize.js';

describe('CSV parser', () => {
  it('handles quoted fields with commas, quotes, and newlines', () => {
    const text =
      'a,b,c\n' +
      '"hello, world","she said ""hi""","line 1\nline 2"\n';
    const m = parseCsv(text);
    expect(m).toEqual([
      ['a', 'b', 'c'],
      ['hello, world', 'she said "hi"', 'line 1\nline 2'],
    ]);
  });

  it('handles CRLF line endings and BOM', () => {
    const text = '﻿a,b\r\n1,2\r\n3,4\r\n';
    const m = parseCsv(text);
    expect(m).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('round-trips through serializeCsv', () => {
    const matrix = [
      ['a', 'b'],
      ['plain', 'has "quote"'],
      ['has,comma', 'multi\nline'],
    ];
    const text = serializeCsv(matrix);
    expect(parseCsv(text)).toEqual(matrix);
  });

  it('rowsToObjects skips blank rows', () => {
    const m = [
      ['a', 'b'],
      ['1', '2'],
      [''],
      ['3', '4'],
    ];
    expect(rowsToObjects(m)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });
});
