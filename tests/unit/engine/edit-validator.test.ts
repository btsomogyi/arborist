import { describe, it, expect } from 'vitest';
import { validateEdits, sortEdits, detectOverlaps } from '../../../src/engine/edit-validator.js';
import { EditConflictError } from '../../../src/core/errors.js';
import type { ResolvedEdit } from '../../../src/engine/edit-validator.js';

function makeEdit(startPos: number, endPos: number, insertedText: string = 'x'): ResolvedEdit {
  return { startPos, endPos, insertedText, originalText: 'o' };
}

describe('detectOverlaps', () => {
  it('returns empty for non-overlapping edits', () => {
    const edits = [makeEdit(0, 5), makeEdit(10, 15), makeEdit(20, 25)];
    expect(detectOverlaps(edits)).toEqual([]);
  });

  it('detects overlapping edits', () => {
    const edits = [makeEdit(0, 10), makeEdit(5, 15)];
    const overlaps = detectOverlaps(edits);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].overlapRange.startByte).toBe(5);
    expect(overlaps[0].overlapRange.endByte).toBe(10);
  });

  it('treats adjacent edits (touching) as non-overlapping', () => {
    const edits = [makeEdit(0, 5), makeEdit(5, 10)];
    expect(detectOverlaps(edits)).toEqual([]);
  });

  it('returns empty for single edit', () => {
    expect(detectOverlaps([makeEdit(0, 5)])).toEqual([]);
  });

  it('returns empty for empty array', () => {
    expect(detectOverlaps([])).toEqual([]);
  });

  it('detects nested overlaps', () => {
    const edits = [makeEdit(0, 20), makeEdit(5, 10)];
    const overlaps = detectOverlaps(edits);
    expect(overlaps).toHaveLength(1);
  });
});

describe('sortEdits', () => {
  it('sorts edits by descending endPos', () => {
    const edits = [makeEdit(0, 5), makeEdit(20, 25), makeEdit(10, 15)];
    const sorted = sortEdits(edits);
    expect(sorted[0].endPos).toBe(25);
    expect(sorted[1].endPos).toBe(15);
    expect(sorted[2].endPos).toBe(5);
  });

  it('does not mutate the input array', () => {
    const edits = [makeEdit(10, 15), makeEdit(0, 5)];
    const sorted = sortEdits(edits);
    expect(edits[0].startPos).toBe(10);
    expect(sorted[0].startPos).toBe(10);
  });

  it('handles single edit', () => {
    const sorted = sortEdits([makeEdit(5, 10)]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].startPos).toBe(5);
  });
});

describe('validateEdits', () => {
  it('does not throw for non-overlapping edits', () => {
    const edits = [makeEdit(0, 5), makeEdit(10, 15)];
    expect(() => validateEdits(edits)).not.toThrow();
  });

  it('throws EditConflictError for overlapping edits', () => {
    const edits = [makeEdit(0, 10), makeEdit(5, 15)];
    expect(() => validateEdits(edits)).toThrow(EditConflictError);
  });

  it('does not throw for adjacent edits', () => {
    const edits = [makeEdit(0, 5), makeEdit(5, 10)];
    expect(() => validateEdits(edits)).not.toThrow();
  });

  it('does not throw for single edit', () => {
    expect(() => validateEdits([makeEdit(0, 5)])).not.toThrow();
  });

  it('does not throw for empty array', () => {
    expect(() => validateEdits([])).not.toThrow();
  });
});
