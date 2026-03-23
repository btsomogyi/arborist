import type { Insert, EditOptions, EditResult } from '../core/types.js';
import { applyEdit, applyEditToSource } from '../engine/editor.js';
import '../languages/index.js';

export async function insertContent(
  filePath: string,
  options: Insert,
  editOptions?: EditOptions,
): Promise<EditResult> {
  return applyEdit(filePath, options, editOptions);
}

export function insertContentSource(
  source: string,
  language: string,
  options: Insert,
): EditResult {
  return applyEditToSource(source, language, options);
}
