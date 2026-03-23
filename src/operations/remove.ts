/**
 * Remove-node operation — thin wrapper around the editor layer.
 */

import type { Remove, EditResult, EditOptions } from '../core/types.js';
import { applyEdit, applyEditToSource } from '../engine/editor.js';

// Ensure language providers are registered.
import '../languages/index.js';

export async function removeNode(
  filePath: string,
  options: Remove,
  editOptions?: EditOptions,
): Promise<EditResult> {
  return applyEdit(filePath, options, editOptions);
}

export function removeNodeSource(
  source: string,
  language: string,
  options: Remove,
): EditResult {
  return applyEditToSource(source, language, options);
}
