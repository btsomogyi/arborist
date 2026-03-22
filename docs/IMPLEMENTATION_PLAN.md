# Arborist MVP: Complete Implementation Plan

## Overview

This document is the step-by-step implementation plan for the Arborist MVP -- an
AST-based polyglot code editor for AI agents. It covers project setup, core
engine, language providers, high-level operations, CLI, MCP server, Claude Code
skill creation, test fixtures, and final validation.

**Decisions already made** (see ADR-001, ADR-002, PLAN.md, SYNTHESIS.md):

- Primary backend: `@ast-grep/napi` (Phase 2 adds `web-tree-sitter` fallback)
- Edit model: Byte-range splicing on original source (CST preservation)
- Pattern syntax: Code-native ast-grep patterns (not S-expressions)
- MVP languages: TypeScript (including JS/JSX/TSX) and Python
- MVP operations: parse, query, replace, rename, insert, remove
- Interfaces: CLI + MCP server + Claude Code skill
- Language: TypeScript, Node.js >= 20
- Test framework: vitest
- Build: tsup
- MCP SDK: `@modelcontextprotocol/sdk`
- CLI: commander
- Validation: zod

**Timeline**: 16 working days across 10 phases.

---

## Directory Structure (Target State)

```
arborist/
  src/
    core/
      types.ts
      errors.ts
      language-registry.ts
    engine/
      parser.ts
      query.ts
      editor.ts
      edit-validator.ts
    operations/
      replace.ts
      rename.ts
      insert.ts
      remove.ts
    languages/
      typescript.ts
      python.ts
      index.ts
    cli/
      index.ts
      commands/
        parse.ts
        query.ts
        edit.ts
        apply.ts
        providers.ts
      formatters/
        json.ts
        text.ts
    mcp/
      server.ts
      schemas.ts
      tools/
        parse-tool.ts
        query-tool.ts
        edit-tool.ts
        batch-tool.ts
        list-symbols-tool.ts
        rename-tool.ts
  tests/
    unit/
      core/
        language-registry.test.ts
        errors.test.ts
      engine/
        parser.test.ts
        query.test.ts
        editor.test.ts
        edit-validator.test.ts
      operations/
        replace.test.ts
        rename.test.ts
        insert.test.ts
        remove.test.ts
      languages/
        typescript.test.ts
        python.test.ts
    integration/
      cli/
        parse.test.ts
        query.test.ts
        edit.test.ts
        apply.test.ts
      mcp/
        server.test.ts
        tools.test.ts
    e2e/
      parse-query-edit.test.ts
      batch-edit.test.ts
      dry-run.test.ts
      formatting-preservation.test.ts
    fixtures/
      typescript/
        simple-functions.ts
        classes.ts
        imports-exports.ts
        nested-scopes.ts
        comments-formatting.ts
        jsx-component.tsx
      python/
        simple-functions.py
        classes.py
        imports.py
        decorators.py
        indentation.py
  .claude/
    skills/
      arborist.md
```

---

## Phase 1: Project Foundation (Days 1-2)

### Objective

Set up the TypeScript project with all tooling, dependencies, build scripts,
and directory scaffolding. After this phase, `npm run build`, `npm test`, and
`npm run lint` all execute (even if there is no application code yet).

### Files to Create/Edit

#### 1.1 `package.json`

```json
{
  "name": "arborist",
  "version": "0.1.0",
  "description": "AST-based polyglot code editor for AI agents",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "arborist": "./dist/cli/index.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run clean && npm run build"
  },
  "dependencies": {
    "@ast-grep/napi": "^0.34.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "commander": "^12.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": [
    "ast",
    "code-editor",
    "tree-sitter",
    "ast-grep",
    "refactoring",
    "mcp",
    "ai-agents"
  ],
  "license": "MIT"
}
```

**Gotchas**:
- `@ast-grep/napi` ships platform-specific native binaries. Verify that
  `npm install` pulls the correct binary for the development platform
  (macOS ARM, macOS x64, Linux x64). Run `node -e "require('@ast-grep/napi')"`
  to confirm the native addon loads.
- Pin `@ast-grep/napi` to a minor version range (`^0.34.0`) because the API
  surface is still pre-1.0 and may have breaking changes.
- The `"type": "module"` field is required because we target ES modules. All
  imports must use `.js` extensions in the compiled output (tsup handles this).

#### 1.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Gotchas**:
- `module: "NodeNext"` requires `.js` extensions in import paths within source
  files (e.g., `import { X } from './types.js'`). This is the correct behavior
  for ESM output but is a common stumbling point.
- `exactOptionalPropertyTypes` is intentionally `false` to avoid friction with
  zod schema inference.

#### 1.3 `tsup.config.ts`

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'cli/index': 'src/cli/index.ts',
    'mcp/server': 'src/mcp/server.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
  splitting: false,
  // Do not bundle native addons
  external: ['@ast-grep/napi'],
  banner: {
    // Shebang for CLI entry point
    js: "// @ts-nocheck",
  },
});
```

**Gotchas**:
- `@ast-grep/napi` MUST be in `external` because it is a native NAPI addon
  that cannot be bundled by tsup/esbuild. If bundled, the native `.node` file
  will not be found at runtime.
- The CLI entry point needs a `#!/usr/bin/env node` shebang. tsup's `banner`
  option can add it, but a cleaner approach is to add it in the CLI source file
  itself and ensure the built file has the executable bit set via a postbuild
  script.

#### 1.4 `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/cli/index.ts', 'src/mcp/server.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 10000,
  },
});
```

#### 1.5 `eslint.config.js`

Use the flat config format (ESLint 9+). Configure for TypeScript with strict
rules. Specific rules:
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/explicit-function-return-type`: warn (not error, to avoid
  excessive noise during development)
- `no-console`: warn (the CLI uses console; the library should not)

#### 1.6 `.gitignore`

Add entries for: `node_modules/`, `dist/`, `coverage/`, `.env`, `.env.*`,
`*.tgz`, `.DS_Store`, `.idea/`, `.vscode/` (except `.vscode/settings.json`
if needed).

#### 1.7 Directory scaffolding

Create all directories listed in the target structure above. Each `src/`
subdirectory gets an empty `index.ts` placeholder that re-exports the
module's public API (these will be populated in subsequent phases).

Create `src/index.ts` as the library entry point with a placeholder export:

```typescript
export { version } from './version.js';
```

Create `src/version.ts`:

```typescript
export const version = '0.1.0';
```

### Test Files

- `tests/unit/core/.gitkeep` (placeholder; real tests come in Phase 2)
- `tests/smoke.test.ts` -- A single smoke test that imports the library and
  verifies the version string. This validates the build pipeline end to end.

```typescript
import { describe, it, expect } from 'vitest';
import { version } from '../src/version.js';

describe('smoke test', () => {
  it('exports a version string', () => {
    expect(version).toBe('0.1.0');
  });
});
```

### Success Criteria

1. `npm install` succeeds and `@ast-grep/napi` loads without errors
2. `npm run build` produces output in `dist/`
3. `npm test` runs the smoke test and passes
4. `npm run lint` runs without configuration errors
5. `npm run typecheck` passes
6. The directory structure matches the target layout

### Dependencies on Previous Phases

None. This is the first phase.

---

## Phase 2: Core Types & Domain (Days 2-3)

### Objective

Define all shared TypeScript interfaces, the error hierarchy, and the language
provider registry. These types are the contract that every subsequent module
depends on. Getting them right here prevents cascading changes later.

### Files to Create/Edit

#### 2.1 `src/core/types.ts`

This is the single source of truth for all domain types. Every interface
documented in PLAN.md Section 2.3 goes here, plus additional types discovered
during implementation.

**Key interfaces** (in dependency order):

```typescript
// --- Position types ---
export interface Position {
  line: number;    // 0-based
  column: number;  // 0-based
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
  [key: string]: string;  // extensible per language
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
  astGrepLang: string;  // Maps to @ast-grep/napi Lang enum value
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
  context: string[];  // parent node type chain
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
```

**Gotchas**:
- Positions are 0-based throughout (matching tree-sitter convention). The CLI
  display layer converts to 1-based for human output.
- `LanguageProvider.astGrepLang` is typed as `string` rather than importing
  the ast-grep `Lang` type directly. This keeps the core types free of
  backend-specific imports, supporting the future tree-sitter fallback
  (ADR-001).
- The `EditOperation` union uses a `kind` discriminant for exhaustive
  pattern matching.

#### 2.2 `src/core/errors.ts`

Custom error hierarchy with structured error codes for agent-friendly messages.

```typescript
export class ArboristError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ArboristError';
  }
}

export class ParseError extends ArboristError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

export class QueryError extends ArboristError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QUERY_ERROR', details);
    this.name = 'QueryError';
  }
}

export class EditError extends ArboristError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'EDIT_ERROR', details);
    this.name = 'EditError';
  }
}

export class EditConflictError extends EditError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { ...details, code: 'EDIT_CONFLICT' });
    this.name = 'EditConflictError';
  }
}

export class ProviderError extends ArboristError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PROVIDER_ERROR', details);
    this.name = 'ProviderError';
  }
}

export class ValidationError extends ArboristError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class FileError extends ArboristError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FILE_ERROR', details);
    this.name = 'FileError';
  }
}
```

**Gotchas**:
- Every error class has a `code` string property. MCP tool responses and CLI
  output use these codes for programmatic error handling by agents.
- The `details` bag carries structured context (file path, pattern, byte
  range) that helps agents diagnose and retry.

#### 2.3 `src/core/language-registry.ts`

Singleton registry that maps file extensions to language providers.

```typescript
export class LanguageProviderRegistry {
  private providers: Map<string, LanguageProvider> = new Map();
  private extensionMap: Map<string, string> = new Map();

  register(provider: LanguageProvider): void { ... }
  get(languageId: string): LanguageProvider | undefined { ... }
  inferFromExtension(ext: string): LanguageProvider | undefined { ... }
  inferFromFilePath(filePath: string): LanguageProvider | undefined { ... }
  list(): LanguageProvider[] { ... }
  has(languageId: string): boolean { ... }
}
```

**Implementation details**:
- `register()` validates that the provider has a non-empty `id`, at least one
  extension, and no duplicate extension registrations. Throws `ProviderError`
  on conflict.
- `inferFromFilePath()` extracts the extension (handling `.d.ts`, `.test.ts`,
  `.spec.ts`, `.tsx`, `.jsx` correctly) and delegates to `inferFromExtension()`.
- A default singleton instance is exported as `registry`. Modules import this
  shared instance.

### Test Files

#### `tests/unit/core/language-registry.test.ts`

Coverage:
- Register a provider, retrieve by id
- Infer language from `.ts`, `.tsx`, `.py`, `.js`, `.jsx` extensions
- Infer language from full file path (including edge cases like `.d.ts`)
- Reject duplicate extension registration
- `list()` returns all registered providers
- `get()` returns `undefined` for unknown language id
- `inferFromExtension()` returns `undefined` for unknown extension

#### `tests/unit/core/errors.test.ts`

Coverage:
- Each error class sets the correct `name`, `code`, and `message`
- `details` bag is accessible
- Errors are `instanceof` their parent class and `ArboristError`

### Success Criteria

1. All types compile without errors under `strict: true`
2. Language registry unit tests pass (register, get, infer, list, error cases)
3. Error hierarchy tests pass
4. `npm run typecheck` passes
5. No circular imports between core modules

### Dependencies on Previous Phases

- Phase 1 (project structure, build tooling, vitest config)

---

## Phase 3: Engine Layer (Days 3-6)

### Objective

Build the four engine modules that wrap `@ast-grep/napi`: parser, query,
editor, and edit-validator. The editor is the highest-risk component in the
entire project (see PLAN.md Section 7) and must be validated with an
integration test before proceeding.

### Files to Create/Edit

#### 3.1 `src/engine/parser.ts`

**Responsibilities**:
- Read a file from disk (async, utf-8)
- Detect language from file path via the registry
- Call `@ast-grep/napi` `parse(lang, source)` to get an `SgRoot`
- Convert the `SgRoot` to the `ParseResult` / `ASTNode` format
- Cache parsed results by file path + mtime (LRU, configurable max size)
- Support parsing from a string (for testing and in-memory workflows)

**Key function signatures**:
```typescript
export async function parseFile(filePath: string, options?: ParseOptions): Promise<ParseResult>
export function parseString(source: string, language: string): ParseResult
export function sgRootToASTNode(root: SgNode, maxDepth?: number): ASTNode
```

**Gotchas**:
- `@ast-grep/napi` uses a `Lang` enum (`Lang.TypeScript`, `Lang.Python`, etc.).
  The parser must map from our `LanguageProvider.astGrepLang` string to this
  enum. Use a lookup table or dynamic access: `Lang[provider.astGrepLang]`.
- `SgNode.children()` returns all children including trivia (whitespace,
  comments). `SgNode.namedChildren()` returns only named nodes. The
  `sgRootToASTNode` converter must populate both `children` and
  `namedChildren` arrays.
- AST depth can be very large for complex files. The `maxDepth` parameter
  truncates the tree for display purposes. Default: 10.
- File encoding: assume UTF-8. If the file contains a BOM, strip it before
  parsing.

#### 3.2 `src/engine/query.ts`

**Responsibilities**:
- Accept a parsed `SgRoot` (or file path) and a pattern string
- Execute `root.findAll(pattern)` via ast-grep
- Convert each `SgNode` match to a `QueryMatch` object
- Extract captures (`$NAME`, `$$$ARGS`) into the `captures` record
- Build the `context` array (parent chain of node types)

**Key function signatures**:
```typescript
export async function queryFile(
  filePath: string,
  pattern: string,
  options?: QueryOptions
): Promise<QueryResult>

export function querySource(
  source: string,
  language: string,
  pattern: string
): QueryMatch[]

export function sgNodeToQueryMatch(node: SgNode): QueryMatch
```

**Gotchas**:
- `SgNode.getMatch(name)` returns the captured node for single captures
  (`$NAME`). `SgNode.getMultipleMatches(name)` returns an array for variadic
  captures (`$$$ARGS`). The function must try both and serialize appropriately.
- Pattern syntax errors in ast-grep throw synchronously. Wrap in try/catch
  and throw a `QueryError` with the original error message, the pattern, and
  the language.
- Empty result sets are normal, not errors. Return `{ matches: [], matchCount: 0 }`.

#### 3.3 `src/engine/editor.ts` -- THE CRITICAL COMPONENT

**Responsibilities**:
- Accept an `EditOperation` and a parsed `SgRoot` + original source
- Resolve the operation to an array of positional `Edit` objects
  (byte-range + replacement text)
- Delegate to `edit-validator.ts` for conflict detection
- Apply edits via `SgRoot.commitEdits(edits)` (ast-grep's built-in method)
- Re-parse the result to verify syntax validity
- Return an `EditResult`

**Key function signatures**:
```typescript
export async function applyEdit(
  filePath: string,
  operation: EditOperation,
  options?: EditOptions
): Promise<EditResult>

export function applyEditToSource(
  source: string,
  language: string,
  operation: EditOperation
): EditResult

export function resolveOperation(
  root: SgRoot,
  source: string,
  operation: EditOperation
): ResolvedEdit[]

// Internal type for resolved positional edits
interface ResolvedEdit {
  startPos: number;  // byte offset
  endPos: number;    // byte offset
  insertedText: string;
  originalText: string;
}
```

**Implementation details for each operation kind**:

- **`replace`**: Call `root.findAll(pattern)`. For each match (or just the
  Nth if `matchIndex` is specified), get `node.range()` for byte positions.
  Build replacement text by substituting captures into the replacement
  template. If `scope` is provided, first find the scope node, then search
  within it.

- **`rename`**: Find all identifier nodes matching `from` within the file
  (or within a `scope` pattern). Generate a replace edit for each occurrence.
  This is essentially a multi-match replace where pattern = the identifier
  and replacement = the new name.

- **`insert`**: Find the anchor node via `root.find(anchor)`. Based on
  `position`:
  - `before`: insert at `node.range().start.index` (byte start of node)
  - `after`: insert at `node.range().end.index` (byte end of node)
  - `prepend`: insert at byte start of the node's first child
  - `append`: insert at byte end of the node's last child

  For `before` and `prepend`, prepend a newline if the content does not
  start with one. For `after` and `append`, append a newline if needed.
  Detect the indentation of the anchor node and apply it to the inserted
  content.

- **`remove`**: Find the matching node. The edit replaces the node's byte
  range with an empty string. For cleanup: if the removed node was the only
  content on its line, also remove the line (including the trailing newline).

- **`raw`**: Convert `Position` (line/column) to byte offsets using a
  line-offset lookup table built from the source string. Then apply directly.

**Gotchas**:
- ast-grep's `commitEdits()` expects edits as `{ pos: number, endPos: number, insertedText: string }`.
  The `pos` and `endPos` are byte offsets. All edits must reference byte
  positions in the ORIGINAL source (before any edits are applied).
  `commitEdits()` handles the offset adjustment internally.
- Capture substitution in replacement templates: ast-grep patterns use
  `$NAME` for single captures. The replacement template should reference
  the same `$NAME`. ast-grep's `replace()` method on `SgNode` handles this
  natively. Prefer using `node.replace(template)` when possible, then
  collect the resulting edits.
- For rename, the identifier might appear in different syntactic roles
  (variable declaration, function parameter, property access, type
  annotation). All occurrences of the exact string are candidates, but
  they must be identifier nodes (not substrings of longer identifiers).
  Use the pattern `$FROM` where `$FROM` matches the exact identifier, or
  filter `findAll` results by node type being in the `identifier` node
  types for the language.
- Indentation detection: scan the line containing the anchor node to find
  leading whitespace. Apply the same leading whitespace to each line of
  inserted content.

#### 3.4 `src/engine/edit-validator.ts`

**Responsibilities**:
- Detect overlapping byte ranges in a set of resolved edits
- Sort edits in reverse byte order (highest `endPos` first)
- Report conflicts with descriptive error messages

```typescript
export function validateEdits(edits: ResolvedEdit[]): void  // throws EditConflictError
export function sortEdits(edits: ResolvedEdit[]): ResolvedEdit[]
export function detectOverlaps(edits: ResolvedEdit[]): Overlap[]

interface Overlap {
  editA: ResolvedEdit;
  editB: ResolvedEdit;
  overlapRange: ByteRange;
}
```

**Gotchas**:
- Adjacent edits (one ends where another starts) are NOT overlapping. Only
  ranges where `editA.endPos > editB.startPos` (after sorting by startPos)
  constitute a conflict.
- The validator must handle the case where a single operation produces
  multiple edits (e.g., rename produces N edits for N occurrences). These
  edits should never overlap by construction, but validate anyway.

### Test Files

#### `tests/unit/engine/parser.test.ts`

- Parse a TypeScript string, verify root node type is `"program"`
- Parse a Python string, verify root node type is `"module"`
- `sgRootToASTNode` produces correct node types and text
- `maxDepth` truncation works
- Unknown language throws `ProviderError`
- File not found throws `FileError`

#### `tests/unit/engine/query.test.ts`

- Query `console.log($MSG)` in a TS source, get correct matches
- Query `def $NAME($$$PARAMS): $$$BODY` in Python, get correct matches
- Captures are populated correctly (`$MSG`, `$NAME`, `$$$PARAMS`)
- Empty result set for non-matching pattern
- Invalid pattern throws `QueryError`
- Context (parent chain) is populated

#### `tests/unit/engine/editor.test.ts`

- **Replace**: `console.log($MSG)` -> `logger.info($MSG)`, verify
  substitution with capture
- **Replace with scope**: replace only within a specific function
- **Replace with matchIndex**: replace only the 2nd occurrence
- **Rename**: rename `oldName` to `newName`, verify all occurrences
  change
- **Insert before**: insert a comment before a function
- **Insert after**: insert a new function after an existing one
- **Remove**: remove a `console.log` statement, verify line cleanup
- **Raw edit**: replace a specific byte range
- **Formatting preservation**: whitespace and comments outside edit
  ranges are byte-identical before and after
- **Multi-edit on same file**: two non-overlapping replaces succeed
- **Overlapping edits**: throw `EditConflictError`

#### `tests/unit/engine/edit-validator.test.ts`

- Non-overlapping edits pass validation
- Overlapping edits throw `EditConflictError`
- Adjacent edits (touching but not overlapping) pass
- `sortEdits` orders by descending `endPos`
- Single edit always passes

#### `tests/integration/engine-pipeline.test.ts`

**This is the critical integration test that validates the entire approach.**

Scenario: Parse a TypeScript file fixture -> query for `console.log($MSG)` ->
replace with `logger.info($MSG)` -> verify:
1. The replacement text is correct
2. All other content is byte-identical
3. The result re-parses successfully
4. The match count is correct

### Success Criteria

1. All engine unit tests pass
2. The integration test (parse -> query -> edit -> verify) passes
3. Formatting preservation is verified: a file with comments, blank lines,
   mixed indentation, and trailing whitespace produces byte-identical output
   outside the edit ranges
4. `EditConflictError` is thrown for overlapping edits
5. At least one rename test with multiple occurrences passes
6. The edit engine handles both TypeScript and Python source strings

### Dependencies on Previous Phases

- Phase 1 (build tooling)
- Phase 2 (types, errors, language registry)

---

## Phase 4: Language Providers (Days 5-7)

### Objective

Implement the TypeScript and Python language providers with pre-built patterns,
node type mappings, and integration tests using real source fixtures.

### Files to Create/Edit

#### 4.1 `src/languages/typescript.ts`

```typescript
export const typescriptProvider: LanguageProvider = {
  id: 'typescript',
  displayName: 'TypeScript',
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  astGrepLang: 'TypeScript',  // Maps to @ast-grep/napi Lang.TypeScript
  patterns: {
    functionDeclaration: 'function $NAME($$$PARAMS) { $$$BODY }',
    arrowFunction: 'const $NAME = ($$$PARAMS) => $BODY',
    classDeclaration: 'class $NAME { $$$BODY }',
    classWithExtends: 'class $NAME extends $BASE { $$$BODY }',
    variableDeclaration: 'const $NAME = $VALUE',
    letDeclaration: 'let $NAME = $VALUE',
    importStatement: 'import $$$IMPORTS from $SOURCE',
    importDefault: 'import $NAME from $SOURCE',
    importNamed: 'import { $$$NAMES } from $SOURCE',
    exportStatement: 'export $$$DECL',
    exportDefault: 'export default $EXPR',
    interfaceDeclaration: 'interface $NAME { $$$BODY }',
    typeAlias: 'type $NAME = $TYPE',
    methodDefinition: '$NAME($$$PARAMS) { $$$BODY }',
    consoleLog: 'console.log($$$ARGS)',
    asyncFunction: 'async function $NAME($$$PARAMS) { $$$BODY }',
  },
  nodeTypes: {
    function: [
      'function_declaration',
      'arrow_function',
      'method_definition',
      'function_expression',
    ],
    class: ['class_declaration', 'class_expression'],
    variable: [
      'variable_declarator',
      'lexical_declaration',
    ],
    import: ['import_statement', 'import_declaration'],
    export: ['export_statement', 'export_declaration'],
    parameter: ['required_parameter', 'optional_parameter', 'rest_pattern'],
    identifier: ['identifier', 'property_identifier', 'type_identifier'],
    type: [
      'interface_declaration',
      'type_alias_declaration',
    ],
  },
};
```

**Gotchas**:
- TypeScript and JavaScript share the same tree-sitter grammar in ast-grep.
  `Lang.TypeScript` handles `.ts`, `.tsx`, `.js`, and `.jsx`. There is no
  separate `Lang.JavaScript`.
- ast-grep pattern matching is syntax-aware but NOT type-aware. The pattern
  `const $NAME = $VALUE` matches `const x = 5` but NOT `let x = 5`. Agents
  need to know this.
- Arrow functions with expression bodies (`=> expr`) vs block bodies
  (`=> { ... }`) have different AST structures. The pattern
  `const $NAME = ($$$PARAMS) => $BODY` matches expression-body arrows.
  Block-body arrows need `const $NAME = ($$$PARAMS) => { $$$BODY }`.
- `.tsx` files use `Lang.Tsx` in ast-grep, NOT `Lang.TypeScript`. Verify
  whether ast-grep's napi exposes separate enums or handles this internally.
  If separate, register `.tsx` with a `tsx` lang value.

#### 4.2 `src/languages/python.ts`

```typescript
export const pythonProvider: LanguageProvider = {
  id: 'python',
  displayName: 'Python',
  extensions: ['.py', '.pyi'],
  astGrepLang: 'Python',
  patterns: {
    functionDeclaration: 'def $NAME($$$PARAMS):\n    $$$BODY',
    classDeclaration: 'class $NAME:\n    $$$BODY',
    classWithBase: 'class $NAME($$$BASES):\n    $$$BODY',
    variableDeclaration: '$NAME = $VALUE',
    importStatement: 'import $MODULE',
    importFrom: 'from $MODULE import $$$NAMES',
    decorator: '@$NAME',
    decoratorWithArgs: '@$NAME($$$ARGS)',
    asyncFunction: 'async def $NAME($$$PARAMS):\n    $$$BODY',
    methodDefinition: 'def $NAME(self, $$$PARAMS):\n    $$$BODY',
    ifStatement: 'if $CONDITION:\n    $$$BODY',
    forLoop: 'for $VAR in $ITERABLE:\n    $$$BODY',
    withStatement: 'with $EXPR as $NAME:\n    $$$BODY',
    printCall: 'print($$$ARGS)',
  },
  nodeTypes: {
    function: ['function_definition'],
    class: ['class_definition'],
    variable: ['assignment', 'augmented_assignment'],
    import: ['import_statement', 'import_from_statement'],
    parameter: ['identifier', 'default_parameter', 'typed_parameter'],
    identifier: ['identifier'],
    decorator: ['decorator'],
  },
};
```

**Gotchas**:
- Python's significant whitespace is the highest-risk area. ast-grep's
  pattern matching for Python uses the actual Python grammar, so patterns
  must include the colon and indented body. Test carefully with:
  - Functions with different indentation levels (2-space, 4-space, tab)
  - Nested functions
  - Methods inside classes
  - Multi-line function signatures
- The pattern `def $NAME($$$PARAMS):\n    $$$BODY` uses 4-space indentation.
  ast-grep may or may not require exact indentation matching in patterns.
  Test this early. If ast-grep ignores indentation in patterns, the pattern
  can be simplified.
- Decorated functions: the decorator is a sibling node, not a parent of the
  function definition. When removing a function, check whether the agent
  also wants to remove its decorators.

#### 4.3 `src/languages/index.ts`

```typescript
import { registry } from '../core/language-registry.js';
import { typescriptProvider } from './typescript.js';
import { pythonProvider } from './python.js';

export function registerBuiltinProviders(): void {
  registry.register(typescriptProvider);
  registry.register(pythonProvider);
}

// Auto-register on import
registerBuiltinProviders();
```

**Gotchas**:
- This module has a side effect (auto-registration). It must be imported
  before any code that uses the registry. The library entry point
  (`src/index.ts`) should import this module.
- For testing, provide a way to reset the registry (e.g.,
  `registry.clear()`) so tests can register mock providers without
  interference from built-in ones.

### Test Files

#### `tests/unit/languages/typescript.test.ts`

- Provider has correct id, extensions, and ast-grep lang
- All patterns are valid (parse a TypeScript fixture and verify each pattern
  matches at least once in a comprehensive fixture file)
- Node type mappings are complete (no empty arrays)

#### `tests/unit/languages/python.test.ts`

- Provider has correct id, extensions, and ast-grep lang
- All patterns are valid against a Python fixture
- Indentation-sensitive patterns match correctly

#### `tests/integration/language-pipeline.test.ts`

For each language (TypeScript, Python):
1. Parse a fixture file
2. Query for functions -- verify correct count and names
3. Query for classes -- verify correct count and names
4. Query for imports -- verify correct module names
5. Rename a function -- verify all references updated
6. Replace `console.log`/`print` calls -- verify replacement
7. Verify formatting preservation after edits

### Test Fixture Files

Create these files under `tests/fixtures/`:

#### `tests/fixtures/typescript/simple-functions.ts`

A file with 3-5 functions of varying complexity: named function, arrow
function, async function, function with default parameters, exported
function. Include comments and blank lines between functions.

#### `tests/fixtures/typescript/classes.ts`

A file with 2 classes: one with a constructor, methods, and properties;
one extending the first. Include static methods, private fields, and
decorators (if applicable).

#### `tests/fixtures/typescript/imports-exports.ts`

A file exercising all import/export variations: default import, named
import, namespace import, re-export, default export, named export.

#### `tests/fixtures/typescript/nested-scopes.ts`

A file with nested functions, closures, and shadowed variables. Used to
test scoped rename operations.

#### `tests/fixtures/typescript/comments-formatting.ts`

A file with extensive comments (line, block, JSDoc), unusual whitespace
(tabs, trailing spaces, blank lines), and long lines. Used to verify
formatting preservation.

#### `tests/fixtures/typescript/jsx-component.tsx`

A React functional component with JSX. Tests `.tsx` extension handling.

#### `tests/fixtures/python/simple-functions.py`

3-5 functions with different signatures: positional args, keyword args,
default values, *args, **kwargs, type annotations.

#### `tests/fixtures/python/classes.py`

2 classes with methods, `__init__`, class methods, static methods,
properties, and inheritance.

#### `tests/fixtures/python/imports.py`

Various import styles: `import x`, `from x import y`, `from x import *`,
`import x as y`, `from x import (y, z)`.

#### `tests/fixtures/python/decorators.py`

Functions and classes with decorators: `@property`, `@staticmethod`,
`@custom_decorator`, `@decorator_with_args(...)`.

#### `tests/fixtures/python/indentation.py`

Nested structures with mixed indentation scenarios: functions inside
classes, conditionals inside functions, list comprehensions, multi-line
strings.

### Success Criteria

1. Both providers register successfully
2. All language-specific patterns match in their respective fixture files
3. Integration tests for parse -> query -> edit pass for both languages
4. Indentation is preserved in Python edit operations
5. `.tsx` files parse correctly
6. Comment preservation is verified via byte comparison of non-edit regions

### Dependencies on Previous Phases

- Phase 2 (types, language registry)
- Phase 3 (engine: parser, query, editor)

---

## Phase 5: High-Level Operations (Days 7-9)

### Objective

Implement the four MVP operations (replace, rename, insert, remove) as
standalone modules that compose with the engine layer. Each operation
accepts a high-level specification and delegates to the editor.

### Files to Create/Edit

#### 5.1 `src/operations/replace.ts`

**Structural find-and-replace with capture substitution.**

```typescript
export async function structuralReplace(
  filePath: string,
  options: StructuralReplace,
  editOptions?: EditOptions
): Promise<EditResult>
```

**Implementation details**:
- Parses the file, finds all matches for `pattern`
- If `matchIndex` is specified, filters to that single match
- If `scope` is specified, first finds the scope node and searches within it
- For each match, builds a replacement by substituting captures:
  The replacement template `logger.info($MSG)` with capture `$MSG = "hello"`
  becomes `logger.info("hello")`
- Delegates to the editor for application

**Gotchas**:
- Capture names in the replacement template must exactly match capture names
  in the pattern. If the replacement references `$FOO` but the pattern only
  captures `$BAR`, the literal string `$FOO` should appear in the output
  (not silently become empty). Log a warning.
- Variadic captures (`$$$ARGS`) in replacements should expand to the
  comma-separated captured text.

#### 5.2 `src/operations/rename.ts`

**Rename identifier across file scope (or scoped).**

```typescript
export async function renameSymbol(
  filePath: string,
  options: Rename,
  editOptions?: EditOptions
): Promise<EditResult>
```

**Implementation details**:
- Finds all identifier nodes matching `from` in the file
- Filters to only nodes whose node type is in the language's
  `nodeTypes.identifier` list (prevents matching substrings of longer names)
- If `scope` is specified, finds the scope node first and only renames within it
- Generates one `ResolvedEdit` per occurrence
- All edits have the same replacement text (`to`)

**Gotchas**:
- The string "getName" contains "get" and "Name" as substrings. A naive
  text-replace of "get" to "fetch" would produce "fetchName" AND corrupt
  "getName" to "fetchName". The rename operation MUST only target identifier
  nodes, not substrings.
- In TypeScript, the same identifier can appear as a type reference and a
  value reference. Both should be renamed. ast-grep treats them as
  separate nodes but with the same text.
- In Python, `self.name` has `self` and `name` as separate identifiers.
  Renaming `name` should NOT rename `self`.

#### 5.3 `src/operations/insert.ts`

**Insert content before/after/prepend/append relative to an anchor.**

```typescript
export async function insertContent(
  filePath: string,
  options: Insert,
  editOptions?: EditOptions
): Promise<EditResult>
```

**Implementation details**:
- Finds the anchor node via `root.find(anchor)`
- Determines the insertion byte position based on `position`:
  - `before`: byte start of the anchor node, after detecting and preserving
    the newline before it
  - `after`: byte end of the anchor node, inserting a newline before the
    new content
  - `prepend`: first byte inside the anchor node's body (e.g., after the
    opening brace of a function)
  - `append`: last byte inside the anchor node's body (e.g., before the
    closing brace)
- Detects the indentation level of the anchor and applies it to all lines
  of the inserted content
- Generates a single `ResolvedEdit` with `startPos == endPos` (pure
  insertion, no text removed)

**Gotchas**:
- `prepend` and `append` only make sense for block nodes (functions, classes,
  if-blocks). If the anchor is a leaf node, fall back to `before`/`after`
  with a warning.
- Indentation detection: count leading whitespace characters on the line
  containing the anchor node. For `prepend`/`append`, increase indentation
  by one level (detect the project's indent unit from surrounding code or
  default to 2 spaces for TS, 4 spaces for Python).
- For Python, inserted content indentation is critical. A function body
  at 4-space indentation must have its content at 8-space indentation if
  prepended inside a class method.

#### 5.4 `src/operations/remove.ts`

**Remove matched node(s) with whitespace cleanup.**

```typescript
export async function removeNode(
  filePath: string,
  options: Remove,
  editOptions?: EditOptions
): Promise<EditResult>
```

**Implementation details**:
- Finds all matches for `pattern` (or the Nth match if `matchIndex` is set)
- For each match, determines the byte range to remove
- Whitespace cleanup: if the removed node was the sole content on its line
  (only whitespace before and after), remove the entire line including the
  newline character
- If the removed node is one of multiple statements on a line, remove only
  the node's bytes (do not remove the line)

**Gotchas**:
- Removing an import statement should also remove the trailing newline so
  the file does not have a blank line where the import was.
- Removing the last item in a comma-separated list (e.g., the last parameter
  in a function signature) should also remove the preceding comma and
  whitespace. This is a hard problem in general; for the MVP, remove only
  the matched node's exact bytes and leave comma cleanup as a future
  enhancement. Document this limitation.
- In Python, removing a statement from a block that has only one statement
  would leave an empty block (syntax error). Detect this case and insert
  `pass` as a placeholder, or reject the edit with an error. Prefer the
  error approach for the MVP.

### Test Files

#### `tests/unit/operations/replace.test.ts`

- Simple replace (no captures)
- Replace with single capture (`$MSG`)
- Replace with variadic capture (`$$$ARGS`)
- Replace with `matchIndex` (only Nth match)
- Replace with `scope` (only inside a specific function)
- Replace in Python source
- Verify formatting preservation

#### `tests/unit/operations/rename.test.ts`

- Rename a variable used 3 times -> all 3 occurrences change
- Rename does not change substrings of longer identifiers
- Rename with scope (only inside a function)
- Rename in Python source
- Rename a class name (also changes type references in TS)

#### `tests/unit/operations/insert.test.ts`

- Insert before a function
- Insert after a function
- Prepend inside a function body
- Append inside a class body
- Indentation is correctly applied to inserted content
- Insert in Python with correct indentation
- Insert multi-line content

#### `tests/unit/operations/remove.test.ts`

- Remove a single statement
- Remove a function
- Remove an import statement (verify line cleanup)
- Remove with `matchIndex`
- Remove in Python source
- Verify whitespace cleanup

### Success Criteria

1. All operation unit tests pass
2. Operations compose correctly with the engine layer
3. Formatting preservation is verified for each operation
4. Python indentation is handled correctly in insert and remove
5. Rename does not corrupt adjacent identifiers
6. Edge cases (empty results, invalid patterns) produce clear errors

### Dependencies on Previous Phases

- Phase 3 (engine: parser, query, editor, edit-validator)
- Phase 4 (language providers, fixture files)

---

## Phase 6: CLI Interface (Days 9-11)

### Objective

Build the command-line interface using `commander`. All operations must be
accessible via CLI with JSON and text output formats, dry-run support, and
clear error messages.

### Files to Create/Edit

#### 6.1 `src/cli/index.ts`

CLI entry point. Sets up the commander program with global options and
subcommands.

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { version } from '../version.js';
import { registerParseCommand } from './commands/parse.js';
import { registerQueryCommand } from './commands/query.js';
import { registerEditCommand } from './commands/edit.js';
import { registerApplyCommand } from './commands/apply.js';
import { registerProvidersCommand } from './commands/providers.js';

const program = new Command();

program
  .name('arborist')
  .description('AST-based polyglot code editor for AI agents')
  .version(version)
  .option('--json', 'Output in JSON format')
  .option('--no-color', 'Disable colored output');

registerParseCommand(program);
registerQueryCommand(program);
registerEditCommand(program);
registerApplyCommand(program);
registerProvidersCommand(program);

program.parse();
```

**Gotchas**:
- The shebang `#!/usr/bin/env node` must be the first line of the file.
  Ensure tsup preserves it in the output. If tsup strips it, add a
  postbuild step that prepends it.
- After build, the CLI file needs `chmod +x`. Add this to the build script.

#### 6.2 `src/cli/commands/parse.ts`

```
arborist parse <file> [--depth N] [--json] [--node-types type1,type2]
```

- Parses the file and outputs the AST structure
- `--depth`: Maximum depth to display (default: 5)
- `--json`: JSON output (default: indented text tree)
- `--node-types`: Filter to specific node types
- Errors: file not found, unsupported language

#### 6.3 `src/cli/commands/query.ts`

```
arborist query <file> --pattern <pattern> [--language <lang>] [--json]
```

- Queries the file for matches
- `--pattern` (required): ast-grep pattern to search for
- `--language`: Override auto-detection
- `--json`: JSON output (default: text with location and context)
- Outputs match count, each match's text, location, and captures

#### 6.4 `src/cli/commands/edit.ts`

```
arborist edit <file> --replace --pattern <p> --with <r> [--match-index N] [--scope <s>] [--dry-run]
arborist edit <file> --rename --from <old> --to <new> [--scope <s>] [--dry-run]
arborist edit <file> --insert --anchor <a> --position <pos> --content <c> [--dry-run]
arborist edit <file> --remove --pattern <p> [--match-index N] [--dry-run]
```

- `--dry-run`: Show a unified diff of what would change without writing to disk
- Output: number of edits applied, diff (if dry-run), file path
- On success without dry-run, writes the modified file to disk

**Gotchas**:
- The `--with` flag for `--replace` conflicts with commander's built-in
  option parsing if the replacement text starts with `-`. Use `--` separator
  or quote the value.
- Multi-line content for `--content` (insert) is hard to pass via CLI. Support
  reading from stdin (`--content -`) or from a file (`--content @file.txt`).
- The `--scope` option's pattern may contain spaces and special characters.
  Require quoting.

#### 6.5 `src/cli/commands/apply.ts`

```
arborist apply <edits.json> [--dry-run]
```

- Reads a JSON file containing an array of `ArboristEdit` objects
- Validates the JSON against the zod schema
- Applies all edits atomically (all succeed or none are applied)
- `--dry-run`: show diffs for all files without writing

**JSON format**:
```json
{
  "edits": [
    {
      "file": "src/auth.ts",
      "operation": {
        "kind": "replace",
        "pattern": "console.log($MSG)",
        "replacement": "logger.info($MSG)"
      }
    }
  ]
}
```

#### 6.6 `src/cli/commands/providers.ts`

```
arborist providers list [--json]
```

- Lists all registered language providers with their extensions and
  supported patterns.

#### 6.7 `src/cli/formatters/json.ts` and `src/cli/formatters/text.ts`

Output formatting functions for each data type (ParseResult, QueryResult,
EditResult, diff). The text formatter produces human-readable output with
ANSI colors (if `--no-color` is not set). The JSON formatter produces
machine-readable JSON.

### Test Files

#### `tests/integration/cli/parse.test.ts`

- `arborist parse fixture.ts` produces correct output
- `arborist parse fixture.ts --json` produces valid JSON
- `arborist parse fixture.ts --depth 2` truncates correctly
- `arborist parse nonexistent.ts` exits with error code 1

#### `tests/integration/cli/query.test.ts`

- `arborist query fixture.ts --pattern "function $NAME"` finds functions
- `--json` output is parseable
- Non-matching pattern produces empty results (not an error)
- Missing `--pattern` flag exits with error

#### `tests/integration/cli/edit.test.ts`

- `arborist edit fixture.ts --replace --pattern "old" --with "new" --dry-run`
  outputs a diff and does NOT modify the file
- `arborist edit fixture.ts --rename --from "x" --to "y"` modifies the file
  (use a temp copy of the fixture)
- `--dry-run` flag prevents file writes in all edit modes

#### `tests/integration/cli/apply.test.ts`

- `arborist apply edits.json` applies batch edits
- Invalid JSON produces a clear validation error
- `--dry-run` shows diffs without writing

**Test approach**: CLI integration tests spawn the CLI as a child process
(using Node.js `child_process.execFile`) and assert on stdout, stderr, and
exit code. Use temporary directories with copies of fixture files so tests
do not modify the original fixtures.

### Success Criteria

1. All CLI commands work end-to-end with TypeScript and Python fixtures
2. `--json` output is valid JSON for all commands
3. `--dry-run` never modifies files (verified by comparing file mtime/hash
   before and after)
4. Error cases produce non-zero exit codes and helpful messages
5. `npx arborist --help` shows all commands and options
6. `npx arborist --version` shows the correct version

### Dependencies on Previous Phases

- Phase 3 (engine)
- Phase 4 (language providers)
- Phase 5 (operations)

---

## Phase 7: MCP Server (Days 11-13)

### Objective

Build the MCP server that exposes Arborist's capabilities as tools that Claude
Code (or any MCP client) can invoke. Uses `@modelcontextprotocol/sdk` with
stdio transport.

### Files to Create/Edit

#### 7.1 `src/mcp/server.ts`

Sets up the MCP server with stdio transport, registers all tools, and handles
the request/response lifecycle.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'arborist',
  version: '0.1.0',
});

// Register tools
registerParseTool(server);
registerQueryTool(server);
registerEditTool(server);
registerBatchTool(server);
registerListSymbolsTool(server);
registerRenameTool(server);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Gotchas**:
- The MCP server communicates over stdio (stdin/stdout). No console.log
  in the server code -- it would corrupt the MCP protocol. Use stderr for
  debug logging if needed.
- The server must handle errors gracefully and return structured error
  responses rather than crashing. Wrap each tool handler in a try/catch
  that converts `ArboristError` instances to MCP error responses.
- File paths in MCP tool inputs may be relative or absolute. Resolve them
  relative to the working directory (`process.cwd()`).

#### 7.2 `src/mcp/schemas.ts`

Zod schemas for all tool inputs and outputs. These serve as both runtime
validation and documentation.

```typescript
export const parseInputSchema = z.object({
  file: z.string().describe('Path to the source file'),
  depth: z.number().optional().default(10).describe('Max AST depth'),
  nodeTypes: z.array(z.string()).optional().describe('Filter to node types'),
});

export const queryInputSchema = z.object({
  file: z.string().describe('Path to the source file'),
  pattern: z.string().describe('ast-grep structural pattern'),
  language: z.string().optional().describe('Override language detection'),
});

export const editInputSchema = z.object({
  file: z.string().describe('Path to the source file'),
  operation: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('replace'),
      pattern: z.string(),
      replacement: z.string(),
      matchIndex: z.number().optional(),
      scope: z.string().optional(),
    }),
    z.object({
      kind: z.literal('rename'),
      from: z.string(),
      to: z.string(),
      scope: z.string().optional(),
    }),
    z.object({
      kind: z.literal('insert'),
      anchor: z.string(),
      position: z.enum(['before', 'after', 'prepend', 'append']),
      content: z.string(),
    }),
    z.object({
      kind: z.literal('remove'),
      pattern: z.string(),
      matchIndex: z.number().optional(),
    }),
  ]),
  dryRun: z.boolean().optional().default(false),
});

export const batchInputSchema = z.object({
  edits: z.array(z.object({
    file: z.string(),
    operation: editInputSchema.shape.operation,
  })),
  dryRun: z.boolean().optional().default(false),
});

export const listSymbolsInputSchema = z.object({
  file: z.string(),
  symbolTypes: z.array(
    z.enum(['function', 'class', 'variable', 'import', 'export', 'type'])
  ).optional(),
});

export const renameInputSchema = z.object({
  file: z.string(),
  from: z.string(),
  to: z.string(),
  scope: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
});
```

#### 7.3 `src/mcp/tools/parse-tool.ts`

**Tool: `arborist_parse`**

- Input: `{ file, depth?, nodeTypes? }`
- Output: `{ file, language, root (truncated AST), sourceLength, lineCount }`
- Validates input with zod schema
- Returns the AST as a JSON-serializable tree

#### 7.4 `src/mcp/tools/query-tool.ts`

**Tool: `arborist_query`**

- Input: `{ file, pattern, language? }`
- Output: `{ file, language, matches: QueryMatch[], matchCount }`
- Each match includes: text, nodeType, range, captures

#### 7.5 `src/mcp/tools/edit-tool.ts`

**Tool: `arborist_edit`**

- Input: `{ file, operation, dryRun? }`
- Output: `{ file, editCount, changes, syntaxValid, diff? }`
- If `dryRun: true`, returns the diff without writing to disk
- If `dryRun: false` (default), writes the file and returns the result

#### 7.6 `src/mcp/tools/batch-tool.ts`

**Tool: `arborist_batch`**

- Input: `{ edits: ArboristEdit[], dryRun? }`
- Output: `{ results, totalEdits, filesModified, allSucceeded, errors }`
- Atomic: if any edit fails, none are written to disk
- Each edit in the batch is validated independently

#### 7.7 `src/mcp/tools/list-symbols-tool.ts`

**Tool: `arborist_list_symbols`**

- Input: `{ file, symbolTypes? }`
- Output: `{ file, language, symbols: Array<{ name, type, range, signature }> }`
- Uses the language provider's patterns to find functions, classes,
  variables, imports, exports
- This is a convenience tool that wraps multiple queries

#### 7.8 `src/mcp/tools/rename-tool.ts`

**Tool: `arborist_rename`**

- Input: `{ file, from, to, scope?, dryRun? }`
- Output: same as `arborist_edit`
- Convenience wrapper around the rename operation

### Test Files

#### `tests/integration/mcp/server.test.ts`

- Server starts and responds to `tools/list`
- All 6 tools are listed with correct schemas
- Server handles invalid tool names gracefully

#### `tests/integration/mcp/tools.test.ts`

For each tool:
- Valid input produces correct output
- Invalid input produces a structured error response
- File not found produces a clear error
- Dry-run returns diff without modifying files

**Test approach**: Use the MCP SDK's test utilities or create a mock
transport that captures request/response pairs. Do NOT test via actual
stdio (too fragile). Instead, import the server's tool handlers directly
and test them as functions, or use an in-memory transport.

### `.mcp.json` Update

Add the arborist server entry alongside the existing servers:

```json
{
  "mcpServers": {
    "arborist": {
      "command": "node",
      "args": ["./dist/mcp/server.js"],
      "env": {}
    }
  }
}
```

This entry tells Claude Code how to start the arborist MCP server. The
`command` points to the built server file. For development, use
`npx tsx src/mcp/server.ts` instead.

### Success Criteria

1. MCP server starts via `node dist/mcp/server.js` without errors
2. All 6 tools appear in `tools/list` response
3. Each tool handles valid input and produces correct output
4. Each tool handles invalid input with structured errors
5. Dry-run mode works for edit, batch, and rename tools
6. File paths resolve correctly (relative and absolute)
7. The server handles concurrent requests without corruption

### Dependencies on Previous Phases

- Phase 3 (engine)
- Phase 5 (operations)
- Phase 6 (not strictly required, but shares formatters and logic)

---

## Phase 8: Claude Code Skill (Days 13-14)

### Objective

Create the Claude Code skill definition that teaches Claude when and how to
use the arborist MCP tools, including pattern examples and decision criteria
for when arborist is the right tool versus the built-in Edit tool.

### Files to Create/Edit

#### 8.1 `.claude/skills/arborist.md`

```markdown
---
name: arborist
description: AST-based structural code editing for targeted, formatting-preserving changes
tools:
  - arborist_parse
  - arborist_query
  - arborist_edit
  - arborist_batch
  - arborist_list_symbols
  - arborist_rename
triggers:
  - "structural edit"
  - "rename symbol"
  - "find and replace pattern"
  - "AST query"
  - "list functions"
  - "list symbols"
  - "code pattern"
---

# Arborist: Structural Code Editor

Arborist provides AST-aware code editing that preserves formatting,
comments, and whitespace. Use it for targeted structural changes where
precision matters.

## When to Use Arborist vs Built-in Tools

### Use Arborist When:
- Renaming a symbol across a file (changes only identifier nodes, not substrings)
- Replacing a structural pattern (e.g., all `console.log(X)` -> `logger.info(X)`)
- Inserting code at a structurally meaningful location (before/after a function)
- Removing specific code structures (a function, an import, a class method)
- You need to query the AST to understand code structure
- You need batch edits applied atomically
- Formatting preservation is critical

### Use the Built-in Edit Tool When:
- Simple text replacement on a single line
- Adding/removing a single line in a known location
- The change is small and does not require structural awareness
- You already know the exact line numbers

### Use the Built-in Write Tool When:
- Creating a new file from scratch
- Rewriting an entire file

## Pattern Syntax

Arborist uses code-native patterns. Write the pattern in the same language
as the code you are editing.

### TypeScript/JavaScript Examples

| Pattern | Matches |
|---------|---------|
| `console.log($MSG)` | Any single-argument console.log call |
| `console.log($$$ARGS)` | Any console.log call (any number of args) |
| `function $NAME($$$PARAMS) { $$$BODY }` | Named function declarations |
| `const $NAME = ($$$PARAMS) => $BODY` | Arrow functions |
| `import $$$IMPORTS from $SOURCE` | Import statements |
| `class $NAME extends $BASE { $$$BODY }` | Class with extends |

### Python Examples

| Pattern | Matches |
|---------|---------|
| `print($$$ARGS)` | Any print call |
| `def $NAME($$$PARAMS):` | Function definitions |
| `class $NAME:` | Class definitions |
| `from $MODULE import $$$NAMES` | From-import statements |
| `@$DECORATOR` | Decorator applications |

### Capture Variables
- `$NAME` captures a single AST node
- `$$$NAME` captures zero or more nodes (variadic)
- Captures can be reused in replacement templates

## Tool Usage Examples

### Query for functions
```json
{
  "tool": "arborist_query",
  "input": {
    "file": "src/auth.ts",
    "pattern": "function $NAME($$$PARAMS) { $$$BODY }"
  }
}
```

### Rename a symbol
```json
{
  "tool": "arborist_rename",
  "input": {
    "file": "src/auth.ts",
    "from": "isValid",
    "to": "isAuthenticated"
  }
}
```

### Structural replace
```json
{
  "tool": "arborist_edit",
  "input": {
    "file": "src/auth.ts",
    "operation": {
      "kind": "replace",
      "pattern": "console.log($MSG)",
      "replacement": "logger.info($MSG)"
    }
  }
}
```

### Insert a JSDoc comment before a function
```json
{
  "tool": "arborist_edit",
  "input": {
    "file": "src/auth.ts",
    "operation": {
      "kind": "insert",
      "anchor": "function authenticate($$$PARAMS) { $$$BODY }",
      "position": "before",
      "content": "/** Authenticates the user session. */"
    }
  }
}
```

### Remove all console.log calls
```json
{
  "tool": "arborist_edit",
  "input": {
    "file": "src/auth.ts",
    "operation": {
      "kind": "remove",
      "pattern": "console.log($$$ARGS)"
    }
  }
}
```

### Batch edit (atomic)
```json
{
  "tool": "arborist_batch",
  "input": {
    "edits": [
      {
        "file": "src/auth.ts",
        "operation": { "kind": "rename", "from": "isValid", "to": "isAuthenticated" }
      },
      {
        "file": "src/utils.ts",
        "operation": { "kind": "remove", "pattern": "console.log($$$ARGS)" }
      }
    ]
  }
}
```

### List all symbols in a file
```json
{
  "tool": "arborist_list_symbols",
  "input": {
    "file": "src/auth.ts",
    "symbolTypes": ["function", "class"]
  }
}
```

### Dry-run (preview changes)
Add `"dryRun": true` to any edit operation to see a diff without modifying
the file.

## Error Handling

If a pattern does not match anything, the tool returns zero matches (not an
error). If a pattern has a syntax error, the tool returns an error with the
invalid pattern and a suggestion. If edits overlap, the batch is rejected
with an EDIT_CONFLICT error.
```

#### 8.2 `.mcp.json` Update

Merge the arborist MCP server entry into the existing `.mcp.json`:

```json
{
  "mcpServers": {
    "arborist": {
      "command": "node",
      "args": ["./dist/mcp/server.js"],
      "env": {}
    }
  }
}
```

### Test Files

No automated tests for the skill file itself. Validation is manual:

1. Start Claude Code in the arborist project directory
2. Verify the arborist MCP server starts (check `tools/list`)
3. Ask Claude to "list all functions in src/core/language-registry.ts"
   and verify it uses `arborist_list_symbols` or `arborist_query`
4. Ask Claude to "rename `get` to `getProvider` in
   src/core/language-registry.ts" and verify it uses `arborist_rename`
5. Verify the skill triggers on phrases like "structural edit",
   "rename symbol", and "find pattern"

### Success Criteria

1. The skill file is valid YAML frontmatter + markdown
2. The `.mcp.json` entry correctly points to the built server
3. Claude Code loads the skill and MCP server without errors
4. Claude uses arborist tools when appropriate (manual verification)
5. Pattern examples in the skill file are correct and functional

### Dependencies on Previous Phases

- Phase 7 (MCP server)

---

## Phase 9: Test Fixtures & End-to-End Validation (Days 14-15)

### Objective

Create comprehensive test fixtures and end-to-end validation tests that
exercise every operation across both languages. These tests serve as the
acceptance criteria for the MVP.

### Files to Create/Edit

#### 9.1 End-to-End Test Suite: `tests/e2e/parse-query-edit.test.ts`

**Scenario 1: Parse and Query TypeScript**
1. Parse `tests/fixtures/typescript/simple-functions.ts`
2. Query for `function $NAME($$$PARAMS) { $$$BODY }`
3. Verify: match count, function names, parameter captures

**Scenario 2: Parse and Query Python**
1. Parse `tests/fixtures/python/simple-functions.py`
2. Query for `def $NAME($$$PARAMS):`
3. Verify: match count, function names

**Scenario 3: Structural Replace in TypeScript**
1. Read `tests/fixtures/typescript/simple-functions.ts`
2. Replace `console.log($MSG)` with `logger.info($MSG)`
3. Verify: all console.log calls replaced, captures substituted correctly
4. Verify: comments and whitespace outside edits are byte-identical

**Scenario 4: Structural Replace in Python**
1. Read `tests/fixtures/python/simple-functions.py`
2. Replace `print($MSG)` with `logging.info($MSG)`
3. Verify: all print calls replaced
4. Verify: indentation preserved

**Scenario 5: Rename in TypeScript**
1. Copy `tests/fixtures/typescript/nested-scopes.ts` to a temp file
2. Rename `innerVar` to `renamedVar` with scope
3. Verify: only scoped occurrences renamed
4. Verify: other identifiers containing "inner" are untouched

**Scenario 6: Insert in TypeScript**
1. Copy fixture to temp file
2. Insert `/** This is a comment */` before the first function
3. Verify: comment appears before the function
4. Verify: indentation matches

**Scenario 7: Remove in Python**
1. Copy fixture to temp file
2. Remove all `print($$$ARGS)` calls
3. Verify: no print calls remain
4. Verify: line cleanup (no blank lines where prints were)

#### 9.2 `tests/e2e/batch-edit.test.ts`

**Scenario 8: Batch Edit Across Files**
1. Copy two fixture files to temp directory
2. Apply a batch: rename in file 1 + remove in file 2
3. Verify: both files modified correctly
4. Verify: atomic -- if one fails, neither is written

**Scenario 9: Batch Edit Conflict**
1. Create a batch with two overlapping edits on the same file
2. Verify: `EditConflictError` is thrown
3. Verify: no files are modified

#### 9.3 `tests/e2e/dry-run.test.ts`

**Scenario 10: Dry-Run via Library**
1. Apply an edit with `dryRun: true`
2. Verify: the result contains a diff
3. Verify: the file on disk is NOT modified (compare hash before/after)

**Scenario 11: Dry-Run via CLI**
1. Run `arborist edit --dry-run` on a fixture
2. Verify: stdout contains a unified diff
3. Verify: the file is NOT modified

#### 9.4 `tests/e2e/formatting-preservation.test.ts`

**Scenario 12: Whitespace Preservation**
1. Parse `tests/fixtures/typescript/comments-formatting.ts` (a file with
   tabs, trailing spaces, blank lines, multi-line comments, JSDoc)
2. Apply a small edit (rename one variable)
3. Compute byte-by-byte diff between original and result
4. Verify: the ONLY bytes that changed are the renamed identifier
5. All other bytes (including tabs, trailing spaces, blank lines, comments)
   are identical

**Scenario 13: Python Indentation Preservation**
1. Parse `tests/fixtures/python/indentation.py` (nested functions, classes,
   mixed indentation scenarios)
2. Rename a variable inside a nested function
3. Verify: indentation of all lines is unchanged
4. Verify: the file still parses successfully as Python

#### 9.5 `tests/e2e/mcp-tools.test.ts`

**Scenario 14: MCP Parse Tool**
1. Invoke `arborist_parse` via the MCP handler
2. Verify: response has correct structure (file, language, root, lineCount)

**Scenario 15: MCP Query Tool**
1. Invoke `arborist_query` with a pattern
2. Verify: matches are returned with correct structure

**Scenario 16: MCP Edit Tool**
1. Invoke `arborist_edit` with `dryRun: true`
2. Verify: diff is returned, file is not modified

**Scenario 17: MCP Batch Tool**
1. Invoke `arborist_batch` with two edits
2. Verify: both edits applied successfully

**Scenario 18: MCP List Symbols Tool**
1. Invoke `arborist_list_symbols` on a TypeScript fixture
2. Verify: functions, classes, and imports are listed

#### 9.6 `tests/e2e/cli-invocation.test.ts`

**Scenario 19: CLI Parse**
1. Run `arborist parse fixture.ts --json`
2. Verify: valid JSON output, correct structure

**Scenario 20: CLI Query**
1. Run `arborist query fixture.ts --pattern "function $NAME"`
2. Verify: matches listed in stdout

**Scenario 21: CLI Edit (dry-run)**
1. Run `arborist edit fixture.ts --replace --pattern "old" --with "new" --dry-run`
2. Verify: unified diff in stdout, file unchanged

### Success Criteria

1. All 21 end-to-end scenarios pass
2. Formatting preservation is verified at the byte level
3. Python indentation is preserved in all edit scenarios
4. Dry-run never modifies files (verified by hash comparison)
5. Batch edits are atomic (all-or-nothing)
6. MCP tools return correct JSON structures
7. CLI produces correct stdout and exit codes
8. Test coverage on `src/engine/` exceeds 80%
9. Test coverage on `src/operations/` exceeds 80%

### Dependencies on Previous Phases

- All previous phases (1-8)

---

## Phase 10: Polish & Ship (Days 15-16)

### Objective

Final packaging, verification, and cleanup. Ensure the npm package is
publishable, the CLI works via `npx`, the MCP server starts cleanly, and
the skill triggers correctly.

### Tasks

#### 10.1 Package Configuration

Verify `package.json` fields:
- `"main"`: points to `./dist/index.js`
- `"types"`: points to `./dist/index.d.ts`
- `"bin"`: points to `./dist/cli/index.js`
- `"exports"`: correct ESM entry
- `"files"`: includes `dist/` only (not `src/`, `tests/`, `docs/`)
- `"engines"`: `{ "node": ">=20.0.0" }`

Run `npm pack` and inspect the tarball:
- Verify only intended files are included
- Verify the package size is reasonable (< 5 MB excluding native binaries)
- Verify `@ast-grep/napi` is in `dependencies` (not `devDependencies`)

#### 10.2 CLI Verification

```bash
# Build
npm run build

# Verify CLI help
node dist/cli/index.js --help

# Verify CLI version
node dist/cli/index.js --version

# Verify parse command
node dist/cli/index.js parse tests/fixtures/typescript/simple-functions.ts

# Verify query command
node dist/cli/index.js query tests/fixtures/typescript/simple-functions.ts \
  --pattern "function \$NAME(\$\$\$PARAMS) { \$\$\$BODY }"

# Verify edit dry-run
node dist/cli/index.js edit tests/fixtures/typescript/simple-functions.ts \
  --replace --pattern "console.log(\$MSG)" --with "logger.info(\$MSG)" --dry-run
```

#### 10.3 MCP Server Verification

```bash
# Start the server (will wait for stdio input)
node dist/mcp/server.js

# Test with a simple JSON-RPC request via stdin (or use the MCP inspector tool)
```

Verify using the MCP inspector or by piping JSON-RPC messages:
- `initialize` handshake succeeds
- `tools/list` returns all 6 tools
- `tools/call` with `arborist_parse` returns correct output

#### 10.4 Skill Verification

1. Open the arborist project in Claude Code
2. Verify `.mcp.json` is loaded (arborist server appears in MCP list)
3. Verify `.claude/skills/arborist.md` is loaded
4. Test natural language triggers:
   - "Parse src/core/types.ts and show me the functions"
   - "Rename the `get` method to `getProvider` in language-registry.ts"
   - "Replace all console.log calls with logger.info in parser.ts"
5. Verify Claude uses arborist tools (not built-in Edit) for these tasks

#### 10.5 Final Checks

- [ ] `npm run build` succeeds with no warnings
- [ ] `npm test` passes all tests
- [ ] `npm run lint` passes with no errors
- [ ] `npm run typecheck` passes
- [ ] `npm pack` produces a clean tarball
- [ ] No secrets or credentials in any file
- [ ] No test files in the published package
- [ ] `.gitignore` covers all generated files
- [ ] License file is present

### Success Criteria

1. `npm pack` produces a clean, publishable package
2. `npx arborist --help` works from a clean install
3. MCP server starts and responds to tool calls
4. Claude Code skill triggers correctly (manual verification)
5. All automated tests pass
6. No lint or type errors

### Dependencies on Previous Phases

- All previous phases (1-9)

---

## Swarm Execution Strategy

For parallel implementation by a Claude Code agent swarm:

### Agent Assignments

| Agent | Role | Phases | Can Start After |
|-------|------|--------|-----------------|
| **Lead** | Coordination, integration testing, reviews | All | Immediately |
| **Core Engine** | Types, errors, registry, parser, query, editor, validator | 2, 3 | Phase 1 |
| **Language Provider** | TS provider, Python provider, fixture files | 4 | Phase 2 |
| **Operations** | replace, rename, insert, remove | 5 | Phase 3 |
| **CLI** | CLI commands, formatters, CLI integration tests | 6 | Phase 5 |
| **MCP** | MCP server, schemas, tools, MCP integration tests | 7 | Phase 5 |
| **Test** | Fixture files, e2e test suite, formatting tests | 9 | Phase 4 |
| **Skill** | Skill definition, `.mcp.json` update, validation | 8 | Phase 7 |

### Parallelism Opportunities

```
Phase 1 (Lead)
  |
  v
Phase 2 (Core Engine)
  |
  +---> Phase 3 (Core Engine) --+---> Phase 5 (Operations) --+---> Phase 6 (CLI)
  |                              |                              |
  +---> Phase 4 (Language) ------+                              +---> Phase 7 (MCP)
                                 |                              |
                                 +---> Phase 9 (Test, partial)  +---> Phase 8 (Skill)
                                                                |
                                                                v
                                                         Phase 9 (Test, full)
                                                                |
                                                                v
                                                         Phase 10 (Lead)
```

**Maximum parallelism**: After Phase 2 completes, Core Engine (Phase 3) and
Language Provider (Phase 4) can run in parallel. After Phase 3 completes,
Operations (Phase 5) starts. After Phase 5, CLI (Phase 6) and MCP (Phase 7)
can run in parallel. Test fixtures (Phase 9, partial) can start with Phase 4.

### Agent Communication Protocol

- All agents write to the same git repository
- Agents must not modify files owned by other agents without coordination
- The Lead agent resolves merge conflicts
- Shared types (`src/core/types.ts`) are frozen after Phase 2 -- changes
  require Lead approval
- Each agent runs tests for their own code before marking a phase complete
- The Lead runs the full test suite after each phase merge

### Anti-Drift Rules

- Every agent reads `src/core/types.ts` before starting work
- Every agent uses the same `LanguageProvider` interface (no ad-hoc alternatives)
- Every agent writes tests before or alongside implementation (TDD preferred)
- No agent introduces new dependencies without Lead approval
- All file paths use the directory structure defined in Phase 1

---

## Appendix A: Key ast-grep API Reference

### Parsing

```typescript
import { parse, Lang } from '@ast-grep/napi';

const root = parse(Lang.TypeScript, sourceCode);
const rootNode = root.root();
```

### Querying

```typescript
const matches = rootNode.findAll('console.log($MSG)');
for (const match of matches) {
  console.log(match.text());
  console.log(match.range());
  console.log(match.getMatch('MSG')?.text());
}
```

### Editing

```typescript
const edits = matches.map(m => m.replace('logger.info($MSG)'));
const newSource = rootNode.commitEdits(edits);
```

### SgNode Key Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `text()` | `string` | Source text of this node |
| `range()` | `Range` | `{ start: { line, column, index }, end: { line, column, index } }` |
| `kind()` | `string` | Node type (e.g., `"function_declaration"`) |
| `children()` | `SgNode[]` | All child nodes |
| `namedChildren()` | `SgNode[]` | Named child nodes only |
| `parent()` | `SgNode | null` | Parent node |
| `find(pattern)` | `SgNode | null` | First match in subtree |
| `findAll(pattern)` | `SgNode[]` | All matches in subtree |
| `getMatch(name)` | `SgNode | null` | Get single capture by name |
| `getMultipleMatches(name)` | `SgNode[]` | Get variadic capture |
| `replace(template)` | `Edit` | Create an edit that replaces this node |
| `commitEdits(edits)` | `string` | Apply edits and return new source |

---

## Appendix B: Risk Mitigation Checklist

| Risk | Mitigation | Verified By |
|------|------------|-------------|
| `@ast-grep/napi` binary fails to load | Test `node -e "require('@ast-grep/napi')"` in Phase 1 | Phase 1 success criteria |
| Pattern syntax differs between languages | Comprehensive per-language fixture tests in Phase 4 | Phase 4 integration tests |
| Python indentation corrupted by edits | Dedicated indentation preservation test in Phase 9 | Scenario 13 |
| Multi-edit conflicts not detected | Explicit overlap detection tests in Phase 3 | Editor unit tests |
| Rename corrupts non-identifier substrings | Identifier-node-only filtering in rename operation | Rename unit tests |
| MCP server crashes on invalid input | Zod validation on all inputs + error wrapping | MCP integration tests |
| CLI argument parsing breaks with special chars | Integration tests with quoted patterns and special chars | CLI integration tests |
| Skill does not trigger in Claude Code | Manual verification checklist in Phase 10 | Phase 10 step 4 |

---

## Appendix C: File Inventory

Total files to create (approximate):

| Category | Count | Location |
|----------|-------|----------|
| Source files | 25 | `src/` |
| Unit tests | 12 | `tests/unit/` |
| Integration tests | 8 | `tests/integration/` |
| E2E tests | 6 | `tests/e2e/` |
| Fixture files | 11 | `tests/fixtures/` |
| Config files | 6 | Root |
| Skill/MCP config | 2 | `.claude/`, root |
| **Total** | **~70** | |
