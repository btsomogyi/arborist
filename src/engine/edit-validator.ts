import { EditConflictError } from '../core/errors.js';
import type { ByteRange } from '../core/types.js';

export interface ResolvedEdit {
  startPos: number;
  endPos: number;
  insertedText: string;
  originalText: string;
}

export interface Overlap {
  editA: ResolvedEdit;
  editB: ResolvedEdit;
  overlapRange: ByteRange;
}

export function validateEdits(edits: ResolvedEdit[]): void {
  const overlaps = detectOverlaps(edits);
  if (overlaps.length > 0) {
    const first = overlaps[0];
    throw new EditConflictError(
      `Overlapping edits detected: [${first.editA.startPos}-${first.editA.endPos}] ` +
      `conflicts with [${first.editB.startPos}-${first.editB.endPos}]`,
      {
        overlapCount: overlaps.length,
        firstOverlap: {
          editA: { start: first.editA.startPos, end: first.editA.endPos },
          editB: { start: first.editB.startPos, end: first.editB.endPos },
        },
      },
    );
  }
}

export function sortEdits(edits: ResolvedEdit[]): ResolvedEdit[] {
  return [...edits].sort((a, b) => b.endPos - a.endPos || b.startPos - a.startPos);
}

export function detectOverlaps(edits: ResolvedEdit[]): Overlap[] {
  if (edits.length < 2) return [];

  const sorted = [...edits].sort((a, b) => a.startPos - b.startPos || a.endPos - b.endPos);
  const overlaps: Overlap[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const editA = sorted[i];
    const editB = sorted[i + 1];

    if (editA.endPos > editB.startPos) {
      overlaps.push({
        editA,
        editB,
        overlapRange: {
          startByte: editB.startPos,
          endByte: Math.min(editA.endPos, editB.endPos),
        },
      });
    }
  }

  return overlaps;
}
