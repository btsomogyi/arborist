import { readFile, writeFile } from 'node:fs/promises';
import { registry } from '../core/language-registry.js';
import { EditError, FileError, ProviderError, ValidationError } from '../core/errors.js';
import type {
  EditOperation,
  EditOptions,
  EditResult,
  ChangeDescriptor,
  Range,
  Position,
} from '../core/types.js';
import { parseLangSource } from './parser.js';
import type { SgNode, SgRoot } from './parser.js';
import { validateEdits, sortEdits } from './edit-validator.js';
import type { ResolvedEdit } from './edit-validator.js';
import { resolvePattern } from './go-pattern-fix.js';

export async function applyEdit(
  filePath: string,
  operation: EditOperation,
  options?: EditOptions,
): Promise<EditResult> {
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

  const result = applyEditToSource(source, provider.id, operation);
  result.file = filePath;

  if (!options?.dryRun && result.editCount > 0) {
    await writeFile(filePath, result.newSource, 'utf-8');
  }

  return result;
}

export function applyEditToSource(
  source: string,
  language: string,
  operation: EditOperation,
): EditResult {
  const provider = registry.get(language);
  if (!provider) {
    throw new ProviderError(`Unknown language: ${language}`, { language });
  }

  const sgRoot = parseLangSource(source, provider.astGrepLang);
  const resolved = resolveOperation(sgRoot, source, operation, language);

  if (resolved.length === 0) {
    return {
      file: '<string>',
      originalSource: source,
      newSource: source,
      editCount: 0,
      changes: [],
      syntaxValid: true,
    };
  }

  validateEdits(resolved);

  const sorted = sortEdits(resolved);

  const commitEdits = sorted.map((e) => ({
    startPos: e.startPos,
    endPos: e.endPos,
    insertedText: e.insertedText,
  }));

  const newSource = sgRoot.root().commitEdits(commitEdits);

  const lineOffsets = buildLineOffsets(source);
  const changes: ChangeDescriptor[] = resolved.map((e) => ({
    range: byteOffsetToRange(e.startPos, e.endPos, lineOffsets),
    byteRange: { startByte: e.startPos, endByte: e.endPos },
    originalText: e.originalText,
    newText: e.insertedText,
  }));

  let syntaxValid = true;
  try {
    const reparsed = parseLangSource(newSource, provider.astGrepLang);
    syntaxValid = !hasErrorNode(reparsed.root());
  } catch {
    syntaxValid = false;
  }

  return {
    file: '<string>',
    originalSource: source,
    newSource,
    editCount: resolved.length,
    changes,
    syntaxValid,
  };
}

export function resolveOperation(
  sgRoot: SgRoot,
  source: string,
  operation: EditOperation,
  language?: string,
): ResolvedEdit[] {
  const root = sgRoot.root();
  const lang = language ?? '';

  switch (operation.kind) {
    case 'replace':
      return resolveReplace(root, source, operation.pattern, operation.replacement, lang, operation.matchIndex, operation.scope);
    case 'rename':
      return resolveRename(root, operation.from, operation.to, lang, operation.scope);
    case 'insert':
      return resolveInsert(root, source, operation.anchor, operation.position, operation.content, lang);
    case 'remove':
      return resolveRemove(root, source, operation.pattern, lang, operation.matchIndex);
    case 'raw':
      return resolveRaw(source, operation.edits);
    default: {
      const _exhaustive: never = operation;
      throw new ValidationError(`Unknown operation kind: ${(_exhaustive as EditOperation).kind}`);
    }
  }
}

function resolveReplace(
  root: SgNode,
  source: string,
  pattern: string,
  replacement: string,
  language: string,
  matchIndex?: number,
  scope?: string,
): ResolvedEdit[] {
  let searchRoot = root;

  if (scope) {
    const scopeMatcher = resolvePattern(scope, language);
    const scopeNode = root.find(scopeMatcher);
    if (!scopeNode) {
      throw new EditError(`Scope pattern not found: ${scope}`, { scope, pattern });
    }
    searchRoot = scopeNode;
  }

  let matches: SgNode[];
  try {
    const matcher = resolvePattern(pattern, language);
    matches = searchRoot.findAll(matcher);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new EditError(`Invalid pattern: ${msg}`, { pattern, cause: msg });
  }

  if (matchIndex !== undefined) {
    if (matchIndex < 0 || matchIndex >= matches.length) return [];
    matches = [matches[matchIndex]];
  }

  return matches.map((node) => {
    const range = node.range();
    const replacementText = substituteCaptures(node, replacement);
    return {
      startPos: range.start.index,
      endPos: range.end.index,
      insertedText: replacementText,
      originalText: source.slice(range.start.index, range.end.index),
    };
  });
}

function resolveRename(
  root: SgNode,
  from: string,
  to: string,
  language: string,
  scope?: string,
): ResolvedEdit[] {
  let searchRoot = root;

  if (scope) {
    const scopeMatcher = resolvePattern(scope, language);
    const scopeNode = root.find(scopeMatcher);
    if (!scopeNode) {
      throw new EditError(`Scope pattern not found: ${scope}`, { scope, from, to });
    }
    searchRoot = scopeNode;
  }

  const allNodes = searchRoot.findAll(from);

  const identifierKinds = new Set([
    'identifier',
    'property_identifier',
    'type_identifier',
    'shorthand_property_identifier',
    'shorthand_property_identifier_pattern',
  ]);

  const edits: ResolvedEdit[] = [];
  for (const node of allNodes) {
    if (node.text() === from && identifierKinds.has(String(node.kind()))) {
      const range = node.range();
      edits.push({
        startPos: range.start.index,
        endPos: range.end.index,
        insertedText: to,
        originalText: from,
      });
    }
  }

  return edits;
}

function resolveInsert(
  root: SgNode,
  source: string,
  anchor: string,
  position: 'before' | 'after' | 'prepend' | 'append',
  content: string,
  language: string,
): ResolvedEdit[] {
  const anchorMatcher = resolvePattern(anchor, language);
  const anchorNode = root.find(anchorMatcher);
  if (!anchorNode) {
    throw new EditError(`Anchor pattern not found: ${anchor}`, { anchor, position });
  }

  const range = anchorNode.range();
  const indent = detectIndentation(source, range.start.index);
  const indentedContent = applyIndentation(content, indent);

  let insertPos: number;
  let insertText: string;

  switch (position) {
    case 'before': {
      insertPos = range.start.index;
      insertText = indentedContent + '\n';
      break;
    }
    case 'after': {
      insertPos = range.end.index;
      insertText = '\n' + indentedContent;
      break;
    }
    case 'prepend': {
      const children = anchorNode.children();
      if (children.length > 0) {
        const bodyStart = findBodyStart(anchorNode);
        insertPos = bodyStart;
        const innerIndent = indent + detectIndentUnit(source);
        insertText = '\n' + applyIndentation(content, innerIndent);
      } else {
        insertPos = range.start.index;
        insertText = indentedContent + '\n';
      }
      break;
    }
    case 'append': {
      const bodyEnd = findBodyEnd(anchorNode);
      insertPos = bodyEnd;
      const innerIndent = indent + detectIndentUnit(source);
      insertText = applyIndentation(content, innerIndent) + '\n';
      break;
    }
  }

  return [{
    startPos: insertPos,
    endPos: insertPos,
    insertedText: insertText,
    originalText: '',
  }];
}

function resolveRemove(
  root: SgNode,
  source: string,
  pattern: string,
  language: string,
  matchIndex?: number,
): ResolvedEdit[] {
  let matches: SgNode[];
  try {
    const matcher = resolvePattern(pattern, language);
    matches = root.findAll(matcher);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new EditError(`Invalid pattern: ${msg}`, { pattern, cause: msg });
  }

  if (matchIndex !== undefined) {
    if (matchIndex < 0 || matchIndex >= matches.length) return [];
    matches = [matches[matchIndex]];
  }

  return matches.map((node) => {
    const range = node.range();
    let startPos = range.start.index;
    let endPos = range.end.index;

    const lineStart = findLineStart(source, startPos);
    const lineEnd = findLineEnd(source, endPos);
    const beforeOnLine = source.slice(lineStart, startPos);
    const afterOnLine = source.slice(endPos, lineEnd);

    if (beforeOnLine.trim() === '' && afterOnLine.trim() === '') {
      startPos = lineStart;
      endPos = lineEnd < source.length ? lineEnd + 1 : lineEnd;
    }

    return {
      startPos,
      endPos,
      insertedText: '',
      originalText: source.slice(startPos, endPos),
    };
  });
}

function resolveRaw(
  source: string,
  edits: Array<{ startPos: Position; endPos: Position; insertedText: string }>,
): ResolvedEdit[] {
  const lineOffsets = buildLineOffsets(source);

  return edits.map((e) => {
    const startByte = positionToByteOffset(e.startPos, lineOffsets);
    const endByte = positionToByteOffset(e.endPos, lineOffsets);
    return {
      startPos: startByte,
      endPos: endByte,
      insertedText: e.insertedText,
      originalText: source.slice(startByte, endByte),
    };
  });
}

// --- Helpers ---

function substituteCaptures(node: SgNode, template: string): string {
  let result = template;

  // Process variadic captures first ($$$NAME)
  result = result.replace(/\$\$\$([A-Z_][A-Z0-9_]*)/g, (_match, name: string) => {
    const multi = node.getMultipleMatches(name);
    if (multi.length > 0) {
      return multi.map((n) => n.text()).join('');
    }
    return _match;
  });

  // Process single captures ($NAME)
  result = result.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_match, name: string) => {
    const capture = node.getMatch(name);
    if (capture) {
      return capture.text();
    }
    return _match;
  });

  return result;
}

function detectIndentation(source: string, bytePos: number): string {
  const lineStart = findLineStart(source, bytePos);
  const lineContent = source.slice(lineStart, bytePos);
  const match = lineContent.match(/^(\s*)/);
  return match ? match[1] : '';
}

function detectIndentUnit(source: string): string {
  const lines = source.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\s+)\S/);
    if (match) {
      const indent = match[1];
      if (indent.includes('\t')) return '\t';
      return indent.length <= 4 ? indent : '  ';
    }
  }
  return '  ';
}

function applyIndentation(content: string, indent: string): string {
  const lines = content.split('\n');
  return lines.map((line) => (line.trim() ? indent + line : line)).join('\n');
}

function findLineStart(source: string, pos: number): number {
  let i = pos - 1;
  while (i >= 0 && source[i] !== '\n') i--;
  return i + 1;
}

function findLineEnd(source: string, pos: number): number {
  let i = pos;
  while (i < source.length && source[i] !== '\n') i++;
  return i;
}

function findBodyStart(node: SgNode): number {
  const children = node.children();
  for (const child of children) {
    const kind = String(child.kind());
    if (kind === 'statement_block' || kind === 'class_body') {
      return child.range().start.index + 1;
    }
    if (kind === 'block') {
      return child.range().start.index;
    }
  }
  return node.range().start.index;
}

function findBodyEnd(node: SgNode): number {
  const children = node.children();
  for (const child of children) {
    const kind = String(child.kind());
    if (kind === 'statement_block' || kind === 'class_body') {
      return child.range().end.index - 1;
    }
  }
  return node.range().end.index;
}

function buildLineOffsets(source: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

function positionToByteOffset(pos: Position, lineOffsets: number[]): number {
  if (pos.line < 0 || pos.line >= lineOffsets.length) {
    throw new ValidationError(
      `Line ${pos.line} is out of range (0-${lineOffsets.length - 1})`,
      { position: pos },
    );
  }
  return lineOffsets[pos.line] + pos.column;
}

function byteOffsetToRange(startByte: number, endByte: number, lineOffsets: number[]): Range {
  return {
    start: byteOffsetToPosition(startByte, lineOffsets),
    end: byteOffsetToPosition(endByte, lineOffsets),
  };
}

function byteOffsetToPosition(byte: number, lineOffsets: number[]): Position {
  let line = 0;
  for (let i = 1; i < lineOffsets.length; i++) {
    if (lineOffsets[i] > byte) break;
    line = i;
  }
  return { line, column: byte - lineOffsets[line] };
}

function hasErrorNode(node: SgNode): boolean {
  if (String(node.kind()) === 'ERROR') return true;
  for (const child of node.children()) {
    if (hasErrorNode(child)) return true;
  }
  return false;
}
