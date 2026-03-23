import type { ParseResult, QueryResult, EditResult, BatchEditResult } from '../../core/types.js';
import type { LanguageProvider } from '../../core/types.js';

export function formatParseJson(result: ParseResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatQueryJson(result: QueryResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatEditJson(result: EditResult, diff?: string): string {
  const output: Record<string, unknown> = {
    file: result.file,
    editCount: result.editCount,
    syntaxValid: result.syntaxValid,
    changes: result.changes,
  };
  if (diff) output.diff = diff;
  return JSON.stringify(output, null, 2);
}

export function formatBatchJson(result: BatchEditResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatProvidersJson(providers: LanguageProvider[]): string {
  return JSON.stringify(providers.map(p => ({
    id: p.id,
    displayName: p.displayName,
    extensions: p.extensions,
    patterns: Object.keys(p.patterns),
  })), null, 2);
}
