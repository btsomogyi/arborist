// --- Position types ---

export interface Position {
  /** 0-based line number */
  line: number;
  /** 0-based column number */
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface ByteRange {
  startByte: number;
  endByte: number;
}

// --- Language provider ---

export interface LanguagePatterns {
  functionDeclaration: string;
  classDeclaration: string;
  variableDeclaration: string;
  importStatement: string;
  exportStatement: string;
  [key: string]: string;
}

export interface NodeTypeMap {
  function: string[];
  class: string[];
  variable: string[];
  import: string[];
  parameter: string[];
  identifier: string[];
  [key: string]: string[];
}

export interface LanguageProvider {
  id: string;
  displayName: string;
  extensions: string[];
  /** Maps to @ast-grep/napi Lang enum value */
  astGrepLang: string;
  patterns: LanguagePatterns;
  nodeTypes: NodeTypeMap;
}

// --- Query model ---

export interface QueryMatch {
  text: string;
  nodeType: string;
  range: Range;
  byteRange: ByteRange;
  captures: Record<string, string>;
  /** Parent node type chain */
  context: string[];
}

export interface QueryResult {
  file: string;
  language: string;
  matches: QueryMatch[];
  matchCount: number;
}

// --- Edit model ---

export type EditOperationKind =
  | 'replace'
  | 'rename'
  | 'insert'
  | 'remove'
  | 'raw';

export interface StructuralReplace {
  kind: 'replace';
  pattern: string;
  replacement: string;
  matchIndex?: number;
  scope?: string;
}

export interface Rename {
  kind: 'rename';
  from: string;
  to: string;
  scope?: string;
}

export interface Insert {
  kind: 'insert';
  anchor: string;
  position: 'before' | 'after' | 'prepend' | 'append';
  content: string;
}

export interface Remove {
  kind: 'remove';
  pattern: string;
  matchIndex?: number;
}

export interface RawEdit {
  kind: 'raw';
  edits: Array<{
    startPos: Position;
    endPos: Position;
    insertedText: string;
  }>;
}

export type EditOperation =
  | StructuralReplace
  | Rename
  | Insert
  | Remove
  | RawEdit;

export interface ArboristEdit {
  file: string;
  operation: EditOperation;
}

// --- Edit result ---

export interface ChangeDescriptor {
  range: Range;
  byteRange: ByteRange;
  originalText: string;
  newText: string;
}

export interface EditResult {
  file: string;
  originalSource: string;
  newSource: string;
  editCount: number;
  changes: ChangeDescriptor[];
  syntaxValid: boolean;
}

// --- Parse result ---

export interface ASTNode {
  type: string;
  text: string;
  range: Range;
  byteRange: ByteRange;
  children: ASTNode[];
  namedChildren: ASTNode[];
  fieldName?: string;
}

export interface ParseResult {
  file: string;
  language: string;
  root: ASTNode;
  sourceLength: number;
  lineCount: number;
}

// --- Batch edit ---

export interface BatchEditResult {
  results: EditResult[];
  totalEdits: number;
  filesModified: number;
  allSucceeded: boolean;
  errors: Array<{ file: string; error: string }>;
}

// --- Options ---

export interface ParseOptions {
  maxDepth?: number;
  language?: string;
}

export interface QueryOptions {
  language?: string;
  maxMatches?: number;
}

export interface EditOptions {
  dryRun?: boolean;
  language?: string;
}
