import type { StructuralReplace, EditOptions, EditResult } from '../core/types.js';
import { applyEdit, applyEditToSource } from '../engine/editor.js';
// Side-effect import: ensure language providers are registered
import '../languages/index.js';

/**
 * Perform a structural find-and-replace on a file.
 *
 * This is a thin convenience wrapper around the editor's `applyEdit`.
 * All matching, scoping, capture substitution, and validation logic
 * lives in the editor layer.
 */
export async function structuralReplace(
  filePath: string,
  options: StructuralReplace,
  editOptions?: EditOptions,
): Promise<EditResult> {
  return applyEdit(filePath, options, editOptions);
}

/**
 * Perform a structural find-and-replace on an in-memory source string.
 *
 * Delegates to the editor's `applyEditToSource` — no file I/O involved.
 */
export function structuralReplaceSource(
  source: string,
  language: string,
  options: StructuralReplace,
): EditResult {
  return applyEditToSource(source, language, options);
}
