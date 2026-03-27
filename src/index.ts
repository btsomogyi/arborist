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
  ScissorhandsEdit,
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
  ScissorhandsError,
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

// Operations
export { structuralReplace, structuralReplaceSource } from './operations/replace.js';
export { renameSymbol, renameSymbolSource } from './operations/rename.js';
export { insertContent, insertContentSource } from './operations/insert.js';
export { removeNode, removeNodeSource } from './operations/remove.js';

// Languages
export { registerBuiltinProviders } from './languages/index.js';
export { typescriptProvider, tsxProvider } from './languages/typescript.js';
export { pythonProvider } from './languages/python.js';
