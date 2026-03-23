/**
 * Rename-symbol operation — thin wrapper around the editor layer.
 * @module operations/rename
 */

import type { Rename, EditOptions, EditResult } from '../core/types.js';
import { applyEdit, applyEditToSource } from '../engine/editor.js';

// Side-effect import: ensures language providers are registered.
import '../languages/index.js';

/**
 * Rename a symbol in a file on disk.
 */
export async function renameSymbol(
  filePath: string,
  options: Rename,
  editOptions?: EditOptions,
): Promise<EditResult> {
  return applyEdit(filePath, options, editOptions);
}

/**
 * Rename a symbol in an in-memory source string.
 */
export function renameSymbolSource(
  source: string,
  language: string,
  options: Rename,
): EditResult {
  return applyEditToSource(source, language, options);
}
