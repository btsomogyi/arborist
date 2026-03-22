import { readFile, stat } from 'node:fs/promises';
import { parse as astGrepParse, registerDynamicLanguage } from '@ast-grep/napi';
import { ts, tsx, js, jsx } from '@ast-grep/napi';
import python from '@ast-grep/lang-python';
import { registry } from '../core/language-registry.js';
import { FileError, ProviderError } from '../core/errors.js';
import type { ASTNode, ParseOptions, ParseResult, Range, ByteRange } from '../core/types.js';

// Register Python language support on module load
let pythonRegistered = false;
function ensurePythonRegistered(): void {
  if (!pythonRegistered) {
    registerDynamicLanguage({ python });
    pythonRegistered = true;
  }
}

// Built-in language parsers keyed by astGrepLang value
const builtinParsers: Record<string, (source: string) => ReturnType<typeof ts.parse>> = {
  TypeScript: (source) => ts.parse(source),
  Tsx: (source) => tsx.parse(source),
  JavaScript: (source) => js.parse(source),
  Jsx: (source) => jsx.parse(source),
};

// Simple LRU cache for parsed results
interface CacheEntry {
  result: ParseResult;
  mtimeMs: number;
}

const parseCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 50;

function evictOldest(): void {
  if (parseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = parseCache.keys().next().value;
    if (firstKey !== undefined) {
      parseCache.delete(firstKey);
    }
  }
}

export type SgRoot = ReturnType<typeof ts.parse>;
export type SgNode = ReturnType<SgRoot['root']>;

export function parseLangSource(source: string, astGrepLang: string): SgRoot {
  const builtin = builtinParsers[astGrepLang];
  if (builtin) {
    return builtin(source);
  }
  // Dynamic languages (Python, etc.) use the generic parse()
  ensurePythonRegistered();
  return astGrepParse(astGrepLang.toLowerCase(), source);
}

export async function parseFile(
  filePath: string,
  options?: ParseOptions,
): Promise<ParseResult> {
  let source: string;
  try {
    source = await readFile(filePath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new FileError(`Cannot read file: ${filePath}`, { path: filePath, cause: msg });
  }

  // Strip BOM
  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1);
  }

  // Detect language
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

  // Check cache
  let mtimeMs = 0;
  try {
    const s = await stat(filePath);
    mtimeMs = s.mtimeMs;
  } catch {
    // stat failure is non-fatal for parsing
  }

  const cached = parseCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs && mtimeMs > 0) {
    return cached.result;
  }

  const sgRoot = parseLangSource(source, provider.astGrepLang);
  const maxDepth = options?.maxDepth ?? 10;
  const root = sgNodeToASTNode(sgRoot.root(), maxDepth);

  const result: ParseResult = {
    file: filePath,
    language: provider.id,
    root,
    sourceLength: source.length,
    lineCount: source.split('\n').length,
  };

  // Cache the result
  evictOldest();
  parseCache.set(filePath, { result, mtimeMs });

  return result;
}

export function parseString(source: string, language: string): ParseResult {
  const provider = registry.get(language);
  if (!provider) {
    throw new ProviderError(
      `Unknown language: ${language}`,
      { language },
    );
  }

  const sgRoot = parseLangSource(source, provider.astGrepLang);
  const root = sgNodeToASTNode(sgRoot.root(), 10);

  return {
    file: '<string>',
    language: provider.id,
    root,
    sourceLength: source.length,
    lineCount: source.split('\n').length,
  };
}

export function sgNodeToASTNode(node: SgNode, maxDepth: number = 10, currentDepth: number = 0): ASTNode {
  const range = node.range();
  const astRange: Range = {
    start: { line: range.start.line, column: range.start.column },
    end: { line: range.end.line, column: range.end.column },
  };
  const byteRange: ByteRange = {
    startByte: range.start.index,
    endByte: range.end.index,
  };

  let children: ASTNode[] = [];
  let namedChildren: ASTNode[] = [];

  if (currentDepth < maxDepth) {
    const childNodes = node.children();
    children = childNodes.map((c) => sgNodeToASTNode(c, maxDepth, currentDepth + 1));
    namedChildren = childNodes
      .filter((c) => c.isNamed())
      .map((c) => sgNodeToASTNode(c, maxDepth, currentDepth + 1));
  }

  return {
    type: String(node.kind()),
    text: node.text(),
    range: astRange,
    byteRange,
    children,
    namedChildren,
  };
}

export function clearParseCache(): void {
  parseCache.clear();
}
