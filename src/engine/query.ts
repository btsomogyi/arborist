import { readFile } from 'node:fs/promises';
import { registry } from '../core/language-registry.js';
import { FileError, ProviderError, QueryError } from '../core/errors.js';
import type { QueryMatch, QueryOptions, QueryResult, Range, ByteRange } from '../core/types.js';
import { parseLangSource } from './parser.js';
import type { SgNode } from './parser.js';
import { resolvePattern } from './go-pattern-fix.js';

export async function queryFile(
  filePath: string,
  pattern: string,
  options?: QueryOptions,
): Promise<QueryResult> {
  let source: string;
  try {
    source = await readFile(filePath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new FileError(`Cannot read file: ${filePath}`, { path: filePath, cause: msg });
  }

  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1);
  }

  const langOverride = options?.language;
  const provider = langOverride
    ? registry.get(langOverride)
    : registry.inferFromFilePath(filePath);

  if (!provider) {
    throw new ProviderError(
      `No language provider for file: ${filePath}`,
      { path: filePath, language: langOverride },
    );
  }

  const matches = querySource(source, provider.id, pattern, options?.maxMatches);

  return {
    file: filePath,
    language: provider.id,
    matches,
    matchCount: matches.length,
  };
}

export function querySource(
  source: string,
  language: string,
  pattern: string,
  maxMatches?: number,
): QueryMatch[] {
  const provider = registry.get(language);
  if (!provider) {
    throw new ProviderError(`Unknown language: ${language}`, { language });
  }

  let sgRoot;
  try {
    sgRoot = parseLangSource(source, provider.astGrepLang);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new QueryError(`Failed to parse source: ${msg}`, { language, cause: msg });
  }

  let nodes: SgNode[];
  try {
    const matcher = resolvePattern(pattern, language);
    nodes = sgRoot.root().findAll(matcher);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new QueryError(
      `Invalid pattern: ${msg}`,
      { pattern, language, cause: msg },
    );
  }

  if (maxMatches !== undefined && maxMatches > 0) {
    nodes = nodes.slice(0, maxMatches);
  }

  return nodes.map((node) => sgNodeToQueryMatch(node));
}

export function sgNodeToQueryMatch(node: SgNode): QueryMatch {
  const range = node.range();
  const astRange: Range = {
    start: { line: range.start.line, column: range.start.column },
    end: { line: range.end.line, column: range.end.column },
  };
  const byteRange: ByteRange = {
    startByte: range.start.index,
    endByte: range.end.index,
  };

  const captures = extractCaptures(node);
  const context = buildContext(node);

  return {
    text: node.text(),
    nodeType: String(node.kind()),
    range: astRange,
    byteRange,
    captures,
    context,
  };
}

function extractCaptures(node: SgNode): Record<string, string> {
  const captures: Record<string, string> = {};

  const commonNames = [
    'NAME', 'VALUE', 'MSG', 'TYPE', 'BODY', 'PARAMS', 'ARGS',
    'BASE', 'EXPR', 'SOURCE', 'NAMES', 'DECL', 'IMPORTS',
    'MODULE', 'VAR', 'ITERABLE', 'CONDITION', 'FROM', 'TO',
    'A', 'B', 'C', 'X', 'Y', 'Z',
    'FUNC', 'CLASS', 'PROP', 'KEY', 'RET', 'ERR',
  ];

  for (const name of commonNames) {
    const single = node.getMatch(name);
    if (single) {
      captures[name] = single.text();
      continue;
    }
    const multi = node.getMultipleMatches(name);
    if (multi.length > 0) {
      captures[name] = multi
        .filter((n) => n.isNamed())
        .map((n) => n.text())
        .join(', ');
    }
  }

  return captures;
}

function buildContext(node: SgNode): string[] {
  const context: string[] = [];
  let current = node.parent();
  while (current) {
    context.push(String(current.kind()));
    current = current.parent();
  }
  return context;
}
