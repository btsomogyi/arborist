import type { ParseResult, QueryResult, EditResult, ASTNode } from '../../core/types.js';
import type { LanguageProvider } from '../../core/types.js';

export function formatParseText(result: ParseResult, maxDepth: number = 5): string {
  const lines: string[] = [];
  lines.push(`File: ${result.file}`);
  lines.push(`Language: ${result.language}`);
  lines.push(`Lines: ${result.lineCount}, Chars: ${result.sourceLength}`);
  lines.push('');
  formatNode(result.root, 0, maxDepth, lines);
  return lines.join('\n');
}

function formatNode(node: ASTNode, depth: number, maxDepth: number, lines: string[]): void {
  if (depth >= maxDepth) return;
  const indent = '  '.repeat(depth);
  const text = node.text.length > 60 ? node.text.slice(0, 57) + '...' : node.text;
  const loc = `${node.range.start.line + 1}:${node.range.start.column}`;
  lines.push(`${indent}${node.type} [${loc}] ${JSON.stringify(text)}`);
  for (const child of node.namedChildren) {
    formatNode(child, depth + 1, maxDepth, lines);
  }
}

export function formatQueryText(result: QueryResult): string {
  const lines: string[] = [];
  lines.push(`File: ${result.file}`);
  lines.push(`Language: ${result.language}`);
  lines.push(`Matches: ${result.matchCount}`);
  lines.push('');
  for (const match of result.matches) {
    const loc = `${match.range.start.line + 1}:${match.range.start.column}-${match.range.end.line + 1}:${match.range.end.column}`;
    lines.push(`[${loc}] ${match.nodeType}`);
    const text = match.text.length > 200 ? match.text.slice(0, 197) + '...' : match.text;
    lines.push(`  ${text}`);
    const captureEntries = Object.entries(match.captures);
    if (captureEntries.length > 0) {
      for (const [key, value] of captureEntries) {
        lines.push(`  $${key}: ${value}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function formatEditText(result: EditResult, diff?: string): string {
  const lines: string[] = [];
  lines.push(`File: ${result.file}`);
  lines.push(`Edits: ${result.editCount}`);
  lines.push(`Syntax valid: ${result.syntaxValid}`);
  if (diff) {
    lines.push('');
    lines.push(diff);
  }
  return lines.join('\n');
}

export function formatProvidersText(providers: LanguageProvider[]): string {
  const lines: string[] = [];
  for (const p of providers) {
    lines.push(`${p.displayName} (${p.id})`);
    lines.push(`  Extensions: ${p.extensions.join(', ')}`);
    lines.push(`  Patterns: ${Object.keys(p.patterns).join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
