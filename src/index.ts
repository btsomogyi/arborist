export { version } from './version.js';

// Core types
export type {
  Position,
  Range,
  ByteRange,
  LanguagePatterns,
  NodeTypeMap,
  LanguageProvider,
  QueryMatch,
  QueryResult,
  EditOperationKind,
  StructuralReplace,
  Rename,
  Insert,
  Remove,
  RawEdit,
  EditOperation,
  ArboristEdit,
  ChangeDescriptor,
  EditResult,
  ASTNode,
  ParseResult,
  BatchEditResult,
  ParseOptions,
  QueryOptions,
  EditOptions,
} from './core/types.js';

// Errors
export {
  ArboristError,
  ParseError,
  QueryError,
  EditError,
  EditConflictError,
  ProviderError,
  ValidationError,
  FileError,
} from './core/errors.js';

// Language registry
export {
  LanguageProviderRegistry,
  registry,
} from './core/language-registry.js';

// Engine
export {
  parseFile,
  parseString,
  sgNodeToASTNode,
  parseLangSource,
  clearParseCache,
} from './engine/parser.js';
export type { SgRoot, SgNode } from './engine/parser.js';

export {
  queryFile,
  querySource,
  sgNodeToQueryMatch,
} from './engine/query.js';

export {
  applyEdit,
  applyEditToSource,
  resolveOperation,
} from './engine/editor.js';

export {
  validateEdits,
  sortEdits,
  detectOverlaps,
} from './engine/edit-validator.js';
export type { ResolvedEdit, Overlap } from './engine/edit-validator.js';
