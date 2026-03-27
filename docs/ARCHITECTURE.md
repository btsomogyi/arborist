# Scissorhands: System Architecture

## 1. System Overview

Scissorhands is an AST-based polyglot code editor designed for AI agent
consumption. It wraps ast-grep's NAPI bindings to provide structure-aware
code editing via CLI and MCP server interfaces. The system enables agents
to perform targeted refactoring operations (rename, replace, insert, remove)
using the target language's own syntax as the pattern language, preserving
all formatting outside of edit ranges.

### 1.1 High-Level Block Diagram

```
+---------------------------------------------------------------------+
|  AI Agent (Claude Code)                                             |
|                                                                     |
|  "rename isValid to isAuthenticated in src/auth.ts"                 |
+------------------------------+--------------------------------------+
                               |
                    (MCP tool call or CLI invocation)
                               |
                               v
+---------------------------------------------------------------------+
|  Integration Layer                                                  |
|                                                                     |
|  +-------------------+  +--------------------+  +-----------------+ |
|  | MCP Server        |  | CLI Adapter        |  | Skill Wrapper   | |
|  | (Phase 2)         |  | (commander)        |  | (.claude/skills)| |
|  | Zod I/O schemas   |  | JSON/text output   |  | When/how hints  | |
|  +--------+----------+  +--------+-----------+  +--------+--------+ |
|           |                      |                        |         |
+-----------+----------------------+------------------------+---------+
            |                      |                        |
            +----------+-----------+------------------------+
                       |
                       v
+---------------------------------------------------------------------+
|  Operations Layer                                                   |
|                                                                     |
|  +---------------------+                                            |
|  | OperationResolver   |  Maps high-level operations to             |
|  |                     |  EditOperation[] with byte ranges          |
|  +----------+----------+                                            |
|             |                                                       |
|  +----------+----------+----------+----------+                      |
|  | Replace  | Rename   | Insert   | Remove   |  (MVP)              |
|  +----------+----------+----------+----------+                      |
|  | Wrap     | Extract  | Move     |             (Phase 2)           |
|  +----------+----------+----------+                                 |
+------------------------------+--------------------------------------+
                               |
                               v
+---------------------------------------------------------------------+
|  Engine Layer                                                       |
|                                                                     |
|  +----------------+  +----------------+  +------------------------+ |
|  | ParserEngine   |  | QueryEngine    |  | EditEngine             | |
|  | parse()        |  | findAll()      |  | resolve selectors      | |
|  | lang detection |  | pattern match  |  | validate non-overlap   | |
|  | tree caching   |  | result serial. |  | sort reverse byte ord  | |
|  +-------+--------+  +-------+--------+  | apply commitEdits()    | |
|          |                    |           | re-parse verify        | |
|          |                    |           +----------+-------------+ |
|          +--------------------+-----------+----------+              |
|                               |                                     |
|                    +----------+----------+                          |
|                    | EditValidator       |                          |
|                    | overlap detection   |                          |
|                    | range bounds check  |                          |
|                    +---------------------+                          |
+------------------------------+--------------------------------------+
                               |
                               v
+---------------------------------------------------------------------+
|  Provider Layer                                                     |
|                                                                     |
|  +---------------------------+                                      |
|  | LanguageProviderRegistry  |  Singleton. Manages lifecycle.       |
|  | register() / get()        |  Discovers @scissorhands/lang-* pkgs.   |
|  | inferFromPath() / list()  |                                     |
|  +----------+----------------+                                      |
|             |                                                       |
|  +----------+----------+------------------+                         |
|  | AstGrepProvider     | TreeSitterProv.  |  (Phase 2)             |
|  | TS, Python (MVP)    | .wasm grammars   |                        |
|  | Go, Rust (Phase 2)  | 170+ languages   |                        |
|  +----------+----------+--------+---------+                         |
+-------------+-------------------+-----------------------------------+
              |                   |
              v                   v
+---------------------------------------------------------------------+
|  Runtime                                                            |
|                                                                     |
|  @ast-grep/napi          web-tree-sitter (Phase 2)                  |
|  (Rust NAPI addon)       (WASM runtime)                             |
|       |                        |                                    |
|       v                        v                                    |
|  tree-sitter (native)    tree-sitter (WASM)                         |
+------------------------------+--------------------------------------+
                               |
                               v
+---------------------------------------------------------------------+
|  Source Files                                                       |
|  src/auth.ts, lib/utils.py, ...                                     |
+---------------------------------------------------------------------+
```

### 1.2 Data Flow: Typical Edit Operation

The following trace shows how a rename operation flows through the system
from agent request to file write.

```
Agent request (JSON):
  { file: "src/auth.ts",
    operation: { kind: "rename", from: "isValid", to: "isAuthenticated" } }
            |
            v
[1] MCP/CLI Adapter
    - Validates input against Zod schema
    - Resolves file path to absolute
    - Creates typed OperationRequest
            |
            v
[2] OperationResolver
    - Reads file from disk
    - Infers language from file extension via LanguageProviderRegistry
    - Gets LanguageProvider for TypeScript
    - Parses file via ParserEngine (AST cached)
    - Queries for all identifier nodes matching "isValid" via QueryEngine
    - Creates EditOperation[] with byte ranges for each match:
        [ { startPos: 45, endPos: 52, insertedText: "isAuthenticated" },
          { startPos: 120, endPos: 127, insertedText: "isAuthenticated" },
          { startPos: 203, endPos: 210, insertedText: "isAuthenticated" } ]
            |
            v
[3] EditValidator
    - Checks: no byte ranges overlap
    - Checks: all ranges within file bounds (0..fileLength)
    - Checks: optional lint (no edits inside string literals)
    - PASS or FAIL with descriptive error
            |
            v
[4] EditPlanner
    - Sorts edits in reverse byte order (highest startPos first)
    - This ensures earlier edits don't shift positions of later ones
            |
            v
[5] EditEngine
    - Calls ast-grep commitEdits(originalSource, sortedEdits)
    - Receives newSource string
    - Re-parses newSource to verify syntax validity
    - Constructs EditResult:
        { newSource: "...",
          originalSource: "...",
          editCount: 3,
          changes: [ { range, oldText, newText }, ... ],
          syntaxValid: true }
            |
            v
[6] MCP/CLI Adapter
    - If dry-run: returns diff without writing
    - If not dry-run: writes newSource to file
    - Formats output (JSON for MCP, text/JSON for CLI)
    - Returns result to agent
```


## 2. Component Architecture

### 2.1 Core Layer

#### Types Module (`src/core/types.ts`)

**Responsibility**: Defines all shared interfaces and type aliases used
across the system. This is the vocabulary of the domain.

**Public API surface**:
- `LanguageProvider` interface
- `LanguagePatterns` interface
- `NodeTypeMap` interface
- `EditOperation` discriminated union (Replace | Rename | Insert | Remove | Wrap | Extract | Move)
- `ScissorhandsEdit`, `ScissorhandsQuery`, `QueryResult`, `MatchInfo`
- `EditResult`, `ChangeDescriptor`
- `OperationRequest`, `ParseResult`
- `Position` (`{ line, column }`), `Range` (`{ start, end }`), `ByteRange` (`{ startPos, endPos }`)

**Dependencies**: None. This module has zero imports from other scissorhands modules.

**Design constraint**: This module must remain dependency-free. All other
modules import from types; types imports from nothing. This prevents
circular dependencies and keeps the domain vocabulary stable.

---

#### Error Hierarchy (`src/core/errors.ts`)

**Responsibility**: Defines a structured error hierarchy that provides
machine-readable error codes and human-readable messages. Every error
carries enough context for an AI agent to understand what went wrong and
how to fix it.

**Hierarchy**:

```
ScissorhandsError (base)
  |
  +-- ParseError
  |     Code: PARSE_FAILED, FILE_NOT_FOUND, UNSUPPORTED_LANGUAGE
  |     Context: filePath, languageId, parserMessage
  |
  +-- QueryError
  |     Code: INVALID_PATTERN, NO_MATCHES, PATTERN_SYNTAX_ERROR
  |     Context: pattern, languageId, patternHint
  |
  +-- EditError
  |     Code: EDIT_CONFLICT, COMMIT_FAILED, SYNTAX_BROKEN
  |     Context: edits[], conflictDetails, newSource (if syntax broken)
  |
  +-- ProviderError
  |     Code: PROVIDER_NOT_FOUND, PROVIDER_INIT_FAILED, LANG_NOT_SUPPORTED
  |     Context: languageId, availableProviders[]
  |
  +-- ValidationError
        Code: OVERLAP_DETECTED, RANGE_OUT_OF_BOUNDS, INVALID_OPERATION
        Context: edits[], overlapPairs[], fileBounds
```

**Dependencies**: types.ts (for Position, ByteRange types)

**Error handling philosophy**: Fail fast with precise diagnostics. Every
error includes a `suggestion` field with actionable guidance. For example,
`UNSUPPORTED_LANGUAGE` suggests calling `list()` to see available providers.

---

#### LanguageProviderRegistry (`src/core/language-registry.ts`)

**Responsibility**: Manages the lifecycle of language providers. Singleton
instance. Handles provider registration, lookup by language ID, language
inference from file extension, and discovery of external provider packages.

**Public API surface**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(provider: LanguageProvider) => void` | Registers a provider. Throws if ID already registered. |
| `get` | `(languageId: string) => LanguageProvider` | Returns provider by ID. Throws ProviderError if not found. |
| `inferFromPath` | `(filePath: string) => LanguageProvider` | Matches file extension. Throws if no provider matches. |
| `list` | `() => ProviderInfo[]` | Returns metadata for all registered providers. |
| `has` | `(languageId: string) => boolean` | Check if a provider is registered. |

**Dependencies**: types.ts, errors.ts

**Singleton enforcement**: Module-level instance. Exported as both the
instance (for normal use) and the class (for testing with fresh instances).

**Provider discovery**: On initialization, scans `node_modules` for packages
matching the `@scissorhands/lang-*` naming convention. Each package must export
a `LanguageProvider` at its main entry point. This enables third-party
language support without modifying scissorhands core.

---

### 2.2 Engine Layer

#### ParserEngine (`src/engine/parser.ts`)

**Responsibility**: Wraps `@ast-grep/napi` `parse()`. Handles file I/O,
language detection, and AST caching.

**Public API surface**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `parse` | `(filePath: string, options?: ParseOptions) => ParseResult` | Parse a file from disk. Language auto-detected. |
| `parseSource` | `(source: string, languageId: string) => ParseResult` | Parse a source string with explicit language. |
| `invalidateCache` | `(filePath: string) => void` | Remove a cached tree. |
| `clearCache` | `() => void` | Clear all cached trees. |

**Dependencies**: types.ts, errors.ts, language-registry.ts, `@ast-grep/napi`

**Caching strategy**: Parsed ASTs are cached by absolute file path. Cache
entries are invalidated when:
- `invalidateCache()` is called explicitly
- A file is edited (EditEngine invalidates after write)
- The cache exceeds a configurable size limit (LRU eviction)

**Error handling**: Wraps ast-grep parse errors into `ParseError` with the
original parser message. File system errors (ENOENT, EACCES) are caught
and converted to `ParseError` with appropriate codes.

---

#### QueryEngine (`src/engine/query.ts`)

**Responsibility**: Executes structural pattern queries against parsed ASTs.
Converts between pattern formats. Serializes results into agent-friendly
`MatchInfo` objects.

**Public API surface**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `findAll` | `(root: SgRoot, pattern: string) => MatchInfo[]` | Find all nodes matching pattern. |
| `findFirst` | `(root: SgRoot, pattern: string) => MatchInfo \| null` | Find first match or null. |
| `findInScope` | `(root: SgRoot, pattern: string, scope: string) => MatchInfo[]` | Find matches within a scope pattern. |
| `count` | `(root: SgRoot, pattern: string) => number` | Count matches without full serialization. |

**Dependencies**: types.ts, errors.ts, `@ast-grep/napi`

**Result serialization**: Each `MatchInfo` includes text, nodeType, range
(line/column), named captures, and structural context (parent chain up to
3 levels). This gives agents enough information to understand the match
without re-parsing.

**Error handling**: Invalid patterns produce `QueryError` with
`PATTERN_SYNTAX_ERROR` and a hint about what might be wrong. Empty results
are not errors; they return an empty array.

---

#### EditEngine (`src/engine/editor.ts`)

**Responsibility**: The critical component. Applies validated, sorted edits
to source code via ast-grep's `commitEdits()` and verifies the result.

**Public API surface**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `applyEdits` | `(source: string, edits: RawEdit[], lang: string) => EditResult` | Apply edits and verify result. |
| `dryRun` | `(source: string, edits: RawEdit[], lang: string) => DryRunResult` | Preview edits as a unified diff. |

**Dependencies**: types.ts, errors.ts, parser.ts (for re-parse verification),
`@ast-grep/napi`

**Pipeline** (detailed in Section 4):

```
Input: source string + RawEdit[]
  |
  +--[1] EditValidator.validate(edits, source)     -- fail fast on conflicts
  +--[2] Sort edits in reverse byte order            -- highest startPos first
  +--[3] commitEdits(source, sortedEdits)            -- ast-grep applies edits
  +--[4] Re-parse result                             -- verify syntax validity
  |
Output: EditResult { newSource, changes[], syntaxValid, editCount }
```

**Error handling**: If `commitEdits()` produces invalid syntax, the engine
returns the result with `syntaxValid: false` rather than throwing. The
caller (adapter layer) decides whether to proceed. If `commitEdits()` fails
entirely, an `EditError` with code `COMMIT_FAILED` is thrown.

---

#### EditValidator (`src/engine/edit-validator.ts`)

**Responsibility**: Pre-flight validation of edit batches. Detects conflicts
before any edits are applied.

**Public API surface**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `validate` | `(edits: RawEdit[], sourceLength: number) => ValidationResult` | Full validation pass. |
| `checkOverlaps` | `(edits: RawEdit[]) => OverlapPair[]` | Check for overlapping byte ranges. |
| `checkBounds` | `(edits: RawEdit[], sourceLength: number) => OutOfBounds[]` | Check ranges against file bounds. |

**Dependencies**: types.ts, errors.ts

**Overlap detection algorithm**: Sort edits by `startPos`. Walk the sorted
list; if `edit[i].startPos < edit[i-1].endPos`, the pair overlaps. Time
complexity: O(n log n) for the sort, O(n) for the walk.

**Validation rules** (all must pass):
1. No two edits have overlapping byte ranges
2. All `startPos >= 0` and `endPos <= sourceLength`
3. All `startPos <= endPos`
4. No duplicate ranges (same start and end)

---

### 2.3 Operations Layer

#### OperationResolver (`src/operations/resolver.ts`)

**Responsibility**: Decomposes high-level `EditOperation` values into
concrete `RawEdit[]` arrays with byte ranges. Each operation kind is
handled by a dedicated strategy function.

**Public API surface**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `resolve` | `(op: EditOperation, root: SgRoot, source: string) => RawEdit[]` | Decompose operation into raw edits. |

**Dependencies**: types.ts, errors.ts, query.ts (for pattern matching)

**Strategy dispatch**:

```
OperationResolver.resolve(operation, root, source)
  |
  +-- operation.kind === "replace"  -->  resolveReplace(op, root, source)
  +-- operation.kind === "rename"   -->  resolveRename(op, root, source)
  +-- operation.kind === "insert"   -->  resolveInsert(op, root, source)
  +-- operation.kind === "remove"   -->  resolveRemove(op, root, source)
  +-- operation.kind === "wrap"     -->  resolveWrap(op, root, source)   (Phase 2)
  +-- operation.kind === "extract"  -->  resolveExtract(op, root, source) (Phase 2)
  +-- operation.kind === "move"     -->  resolveMove(op, root, source)   (Phase 2)
```

Each resolver function uses the QueryEngine to find matching nodes, then
constructs `RawEdit` objects from their byte ranges.

#### Individual Operation Strategies

**Replace** (`src/operations/replace.ts`):
- Finds all nodes matching `pattern`
- Applies capture substitution to `replacement` template
- Optional `matchIndex` to target a specific occurrence
- Optional `scope` pattern to restrict matches to subtrees

**Rename** (`src/operations/rename.ts`):
- Finds all identifier nodes matching `from`
- Optional `scope` to restrict to a function/class/block
- Creates one RawEdit per identifier occurrence

**Insert** (`src/operations/insert.ts`):
- Finds the `anchor` node via pattern match
- Computes insertion byte position based on `position` (before/after/prepend/append)
- Creates a zero-width edit (startPos === endPos) with `insertedText`

**Remove** (`src/operations/remove.ts`):
- Finds nodes matching `pattern`
- Creates edits with empty `insertedText` (deletion)
- Optional `matchIndex` to target specific occurrence

---

### 2.4 Provider Layer

#### AstGrepProvider (`src/languages/*.ts`)

**Responsibility**: Implements the `LanguageProvider` interface using
`@ast-grep/napi`'s built-in `Lang` enum. Each language has its own module
shipping pre-built patterns for common structural queries.

**MVP providers**:

| Provider | File Extensions | ast-grep Lang | Notes |
|----------|----------------|---------------|-------|
| TypeScript | .ts, .tsx, .js, .jsx | `Lang.TypeScript` / `Lang.JavaScript` | JSX/TSX handled via separate lang values |
| Python | .py, .pyi | `Lang.Python` | Indentation-sensitive; extra care in edit engine |

**Phase 2 providers**: Go (.go), Rust (.rs)

**Pre-built patterns**: Each provider ships a `LanguagePatterns` object with
patterns for common constructs (function declarations, class declarations,
imports, etc.). These patterns are used by operations like rename to know
which node types represent identifiers, function names, etc.

#### TreeSitterProvider (Phase 2, `src/languages/tree-sitter-provider.ts`)

**Responsibility**: Fallback provider using `web-tree-sitter` WASM runtime.
Loads `.wasm` grammar files at runtime. Supports any language with a
published tree-sitter grammar.

**Backend selection logic**:

```
inferFromPath("src/auth.ts")
  |
  +-- Check AstGrepProvider registry
  |     Found? --> return AstGrepProvider("typescript")
  |
  +-- Check TreeSitterProvider registry
  |     Has .wasm grammar? --> load grammar, return TreeSitterProvider
  |
  +-- No provider found --> throw ProviderError(LANG_NOT_SUPPORTED)
```

---

### 2.5 Integration Layer

#### CLI Adapter (`src/cli/index.ts`)

**Responsibility**: Provides a `commander`-based CLI that maps commands to
engine operations. Handles argument parsing, output formatting, and exit
codes.

**Commands**:

```
scissorhands parse <file> [--depth N] [--node-types type1,type2]
scissorhands query <file> --pattern <pattern> [--language lang]
scissorhands edit <file> --replace --pattern <p> --with <r> [--dry-run]
scissorhands edit <file> --rename --from <old> --to <new> [--scope <pattern>]
scissorhands edit <file> --insert --anchor <pattern> --position before|after --content <text>
scissorhands edit <file> --remove --pattern <p>
scissorhands apply <edits.json> [--dry-run]
scissorhands providers list
```

**Output formats**: `--format json` (default for piping) or `--format text`
(default for TTY). All errors write to stderr with non-zero exit codes.

**Dependencies**: core, engine, operations (the full stack). Nothing depends
on cli.

#### MCP Server Adapter (`src/mcp/server.ts`)

**Responsibility**: Exposes scissorhands functionality as MCP tools using
`@modelcontextprotocol/sdk`. Handles tool registration, Zod schema
validation, and result formatting.

**Tools**:

| Tool Name | Maps To | Input Schema (Zod) |
|-----------|---------|---------------------|
| `scissorhands_parse` | ParserEngine.parse | `{ file: z.string(), depth?: z.number(), nodeTypes?: z.array(z.string()) }` |
| `scissorhands_query` | QueryEngine.findAll | `{ file: z.string(), pattern: z.string(), language?: z.string() }` |
| `scissorhands_edit` | OperationResolver + EditEngine | `{ file: z.string(), operation: EditOperationSchema, dryRun?: z.boolean() }` |
| `scissorhands_batch` | Multiple OperationResolver + EditEngine | `{ edits: z.array(ScissorhandsEditSchema), dryRun?: z.boolean() }` |

**Dependencies**: core, engine, operations, `@modelcontextprotocol/sdk`, `zod`.
Nothing depends on mcp.

#### Skill Wrapper (`.claude/skills/scissorhands.md`)

**Responsibility**: A Claude Code skill definition that describes when and
how the agent should use scissorhands. Not executable code; rather, a markdown
file that guides Claude's tool selection.

**Contents**: Describes scissorhands's capabilities, provides example
invocations for each operation type, and specifies when scissorhands should be
preferred over raw text editing (structural changes, multi-occurrence
renames, pattern-based replacements).


## 3. Key Design Patterns

### 3.1 Strategy Pattern

Two core uses:

**Language Providers**: The `LanguageProvider` interface defines the
strategy contract. `AstGrepProvider` and `TreeSitterProvider` are concrete
strategies. The registry selects the appropriate strategy based on file
extension or explicit language ID.

```
                  LanguageProvider
                  (interface)
                 /              \
    AstGrepProvider        TreeSitterProvider
    - TypeScript           - Any .wasm grammar
    - Python
    - Go, Rust
```

**Operation Kinds**: Each `EditOperation.kind` dispatches to a dedicated
resolver function. Adding a new operation means adding a new strategy
function and a new case in the discriminated union.

### 3.2 Registry Pattern

`LanguageProviderRegistry` centralizes provider management:
- Single point of registration and lookup
- Language inference from file extension
- External package discovery (`@scissorhands/lang-*`)
- Prevents duplicate registration
- Enumerates available providers for help messages

### 3.3 Adapter Pattern

CLI and MCP are adapters over the identical core engine:

```
                 +--------------------+
                 |   Core Engine      |
                 | (parser, query,    |
                 |  edit, operations) |
                 +----+--------+-----+
                      |        |
              +-------+        +--------+
              |                         |
    +---------v---------+   +-----------v---------+
    | CLI Adapter       |   | MCP Server Adapter  |
    | commander args    |   | Zod schemas         |
    | text/JSON output  |   | MCP tool results    |
    | exit codes        |   | error serialization |
    +-------------------+   +---------------------+
```

Both adapters translate between their external protocol (CLI arguments or
MCP tool calls) and the core engine's typed interface. Neither adapter
contains business logic.

### 3.4 Pipeline Pattern

The edit engine processes edits through a strict pipeline:

```
resolve --> validate --> sort --> apply --> verify
```

Each stage has a single responsibility. The pipeline is fail-fast: a
validation failure aborts before any edits are applied. The verify stage
is advisory (syntax check) rather than a gate.

### 3.5 Anti-Corruption Layer

The integration adapters (CLI, MCP) act as anti-corruption layers that
translate external formats into domain types:

- CLI: Parses `--pattern`, `--with`, `--from`, `--to` flags into typed
  `EditOperation` values
- MCP: Validates JSON input against Zod schemas and constructs typed
  `OperationRequest` values

External concerns (argument parsing, JSON schema validation, output
formatting) never leak into the core engine.


## 4. Edit Pipeline (Detailed Walkthrough)

This section traces a complete edit through every component in the system.

**Input**: An agent sends a rename operation via MCP.

```json
{
  "file": "src/auth.ts",
  "operation": {
    "kind": "rename",
    "from": "isValid",
    "to": "isAuthenticated"
  }
}
```

### Step 1: Input Validation (MCP Adapter)

The MCP adapter validates the input against its Zod schema:

```
scissorhands_edit input:
  file:      z.string()         --> "src/auth.ts"        PASS
  operation: EditOperationSchema --> { kind: "rename" }   PASS
  dryRun:    z.boolean().opt()  --> undefined (default false)
```

Adapter resolves `"src/auth.ts"` to an absolute path and creates a typed
`OperationRequest`.

### Step 2: Language Resolution (LanguageProviderRegistry)

```
inferFromPath("/abs/path/src/auth.ts")
  extension = ".ts"
  match = TypeScriptProvider (extensions: [".ts", ".tsx"])
  return TypeScriptProvider
```

### Step 3: Parsing (ParserEngine)

```
parse("/abs/path/src/auth.ts")
  cache check: MISS (first access)
  source = readFileSync(filePath, "utf-8")
  astGrepLang = TypeScriptProvider.astGrepLang  --> Lang.TypeScript
  root = napi.parse(astGrepLang, source)
  cache store: path -> root
  return { root, source, language: "typescript" }
```

### Step 4: Operation Resolution (OperationResolver)

```
resolveRename({ from: "isValid", to: "isAuthenticated" }, root, source)
  |
  QueryEngine.findAll(root, "isValid")
  --> matches = [
        { text: "isValid", range: { startByte: 45,  endByte: 52  } },
        { text: "isValid", range: { startByte: 120, endByte: 127 } },
        { text: "isValid", range: { startByte: 203, endByte: 210 } }
      ]
  |
  Filter: only identifier nodes (not string contents or comments)
  --> 3 identifiers pass filter
  |
  Create RawEdit[] = [
    { startPos: 45,  endPos: 52,  insertedText: "isAuthenticated" },
    { startPos: 120, endPos: 127, insertedText: "isAuthenticated" },
    { startPos: 203, endPos: 210, insertedText: "isAuthenticated" }
  ]
```

### Step 5: Validation (EditValidator)

```
validate(edits, sourceLength=350)
  |
  checkOverlaps(edits):
    sorted by startPos: [45-52, 120-127, 203-210]
    45-52 vs 120-127:  52 <= 120  --> OK
    120-127 vs 203-210: 127 <= 203 --> OK
    Result: no overlaps
  |
  checkBounds(edits, 350):
    45 >= 0 and 52 <= 350  --> OK
    120 >= 0 and 127 <= 350 --> OK
    203 >= 0 and 210 <= 350 --> OK
    Result: all in bounds
  |
  Result: VALID
```

### Step 6: Sort in Reverse Byte Order (EditPlanner)

```
Before sort: [45-52, 120-127, 203-210]
After sort:  [203-210, 120-127, 45-52]
```

Reverse order ensures that applying earlier edits (by position) does not
shift the byte offsets of later edits, because edits are applied from the
end of the file toward the beginning.

### Step 7: Apply Edits (EditEngine)

```
commitEdits(source, [
  { startPos: 203, endPos: 210, insertedText: "isAuthenticated" },
  { startPos: 120, endPos: 127, insertedText: "isAuthenticated" },
  { startPos: 45,  endPos: 52,  insertedText: "isAuthenticated" }
])
--> newSource (string with all three replacements applied)
```

`commitEdits()` is an ast-grep NAPI function that performs byte-range
replacement on the original source string. All bytes outside the specified
ranges are preserved exactly.

### Step 8: Verification (EditEngine)

```
parseSource(newSource, "typescript")
  |
  Check for syntax errors in the new AST
  --> syntaxValid = true
```

If the re-parsed tree contains syntax errors, `syntaxValid` is set to
`false` but the result is still returned. The adapter decides whether to
write the file.

### Step 9: Result Construction

```
EditResult {
  newSource:      "<file contents with 3 renames applied>",
  originalSource: "<original file contents>",
  editCount:      3,
  changes: [
    { range: {start:{line:3,col:9}, end:{line:3,col:16}},
      oldText: "isValid", newText: "isAuthenticated" },
    { range: {start:{line:8,col:14}, end:{line:8,col:21}},
      oldText: "isValid", newText: "isAuthenticated" },
    { range: {start:{line:15,col:9}, end:{line:15,col:16}},
      oldText: "isValid", newText: "isAuthenticated" }
  ],
  syntaxValid: true
}
```

### Step 10: Output (MCP Adapter)

If dry-run: return unified diff without writing.
If not dry-run: write `newSource` to file, invalidate parser cache, return
result to agent.


## 5. Hybrid Backend Architecture

The `LanguageProvider` interface abstracts over multiple AST backends,
allowing the system to use the best available backend for each language.

### 5.1 Provider Hierarchy

```
LanguageProvider (interface)
|
|   Methods:
|     id: string
|     extensions: string[]
|     astGrepLang: SgLang | null
|     patterns: LanguagePatterns
|     nodeTypes: NodeTypeMap
|
+-- AstGrepProvider (MVP)
|   |
|   |   Uses @ast-grep/napi. Native Rust performance.
|   |   Ships pre-built patterns per language.
|   |
|   +-- TypeScriptProvider
|   |     extensions: [".ts", ".tsx", ".js", ".jsx"]
|   |     Lang: TypeScript | JavaScript | TypeScriptTsx | JavaScriptJsx
|   |
|   +-- PythonProvider
|   |     extensions: [".py", ".pyi"]
|   |     Lang: Python
|   |
|   +-- GoProvider (Phase 2)
|   |     extensions: [".go"]
|   |     Lang: Go
|   |
|   +-- RustProvider (Phase 2)
|         extensions: [".rs"]
|         Lang: Rust
|
+-- TreeSitterProvider (Phase 2)
    |
    |   Uses web-tree-sitter (WASM). Loads .wasm grammar files.
    |   Fallback for languages ast-grep does not support natively.
    |
    +-- Any language with a published tree-sitter grammar
    |     Loaded dynamically from .wasm file
    |
    +-- Examples: Ruby, PHP, C#, Swift, Kotlin, Scala, Haskell, ...
```

### 5.2 Backend Selection Algorithm

```
resolveProvider(filePath: string): LanguageProvider

  extension = path.extname(filePath)        // ".ts"

  // Priority 1: Try ast-grep providers (native, fastest)
  for provider in astGrepProviders:
    if extension in provider.extensions:
      return provider

  // Priority 2: Try tree-sitter providers (WASM, broader coverage)
  for provider in treeSitterProviders:
    if extension in provider.extensions:
      return provider

  // Priority 3: Check for external @scissorhands/lang-* packages
  externalProvider = scanForExternalProvider(extension)
  if externalProvider:
    register(externalProvider)
    return externalProvider

  // No provider found
  throw ProviderError(
    code: LANG_NOT_SUPPORTED,
    message: "No provider for extension '${extension}'",
    suggestion: "Available providers: ${list().join(', ')}"
  )
```

### 5.3 Backend Differences

| Capability | AstGrepProvider | TreeSitterProvider |
|------------|----------------|--------------------|
| Runtime | Rust NAPI (native) | WASM (web-tree-sitter) |
| Performance | Full native speed | 2-5x slower (adequate for agent use) |
| Pattern syntax | Code-native patterns | S-expression queries |
| `commitEdits()` | Built-in | Must implement manually |
| Language count | ~20 built-in | 170+ via .wasm grammars |
| Binary size | Larger (Rust addon) | Smaller per language (.wasm files) |

The `LanguageProvider` interface ensures callers never need to know which
backend is in use. The EditEngine, QueryEngine, and ParserEngine work
identically regardless of provider backend.


## 6. Dependency Graph

This graph shows which modules depend on which. Arrows point from dependent
to dependency. No circular dependencies exist.

```
                        +----------------+
                        |  core/types    |  <--- Everything depends on this
                        +-------+--------+
                                ^
          +---------------------+----------------------+
          |                     |                      |
  +-------+--------+   +-------+--------+   +--------+--------+
  |  core/errors   |   | core/registry  |   |   languages/*   |
  +-------+--------+   +-------+--------+   +--------+--------+
          ^                     ^                      |
          |                     |                      |
          |        +------------+----------+           |
          |        |            |          |           |
  +-------+--------+   +-------+------+   |   (registration via registry)
  | engine/parser  |   | engine/query |   |
  +-------+--------+   +-------+------+   |
          ^                     ^          |
          |                     |          |
  +-------+--------+           |          |
  | engine/editor  +-----------+          |
  +-------+--------+                      |
          ^                               |
          |                               |
  +-------+-----+                         |
  | engine/      |                         |
  | edit-valid.  |                         |
  +-------+------+                         |
          ^                               |
          |                               |
  +-------+---------------------------+   |
  | operations/resolver               |   |
  | operations/replace                |   |
  | operations/rename                 |   |
  | operations/insert                 |   |
  | operations/remove                 |   |
  +-------+---------------------------+   |
          ^                               |
          |                               |
  +-------+---------+   +--------+--------+
  |                  |   |
  |  cli/            |   |  mcp/
  |  (leaf module)   |   |  (leaf module)
  |                  |   |
  +------------------+   +------------------+
```

**Dependency rules**:
1. `core/types` has zero internal dependencies
2. `core/errors` depends only on `core/types`
3. `core/registry` depends on `core/types` and `core/errors`
4. `engine/*` depends on `core/*` and `@ast-grep/napi`
5. `operations/*` depends on `core/*` and `engine/*`
6. `languages/*` depends on `core/types` and registers via `core/registry`
7. `cli/` and `mcp/` are leaf modules: they depend on everything but nothing depends on them
8. No module in `engine/` depends on `operations/`
9. No module in `core/` depends on `engine/` or `operations/`


## 7. Phase 2 Extension Points

The architecture is designed to grow along several axes without modifying
existing components.

### 7.1 Adding a New Language

**What to do**: Implement a `LanguageProvider` and register it.

```
1. Create src/languages/go.ts (or @scissorhands/lang-go package)
2. Implement LanguageProvider interface:
   - id: "go"
   - extensions: [".go"]
   - astGrepLang: Lang.Go
   - patterns: { functionDeclaration: "func $NAME(...) { ... }", ... }
   - nodeTypes: { function: ["function_declaration"], ... }
3. Register in src/languages/index.ts:
   registry.register(new GoProvider())
```

**What does NOT change**: Engine, operations, CLI, MCP. All existing
components work with any provider that implements the interface.

### 7.2 Adding a New Operation

**What to do**: Add a resolver strategy and extend the discriminated union.

```
1. Add new kind to EditOperation union in core/types.ts:
   | Wrap { kind: "wrap", pattern: string, wrapper: string }

2. Create src/operations/wrap.ts:
   export function resolveWrap(op: Wrap, root: SgRoot, source: string): RawEdit[]

3. Add case to OperationResolver.resolve():
   case "wrap": return resolveWrap(op, root, source)

4. Add CLI flag and MCP schema for the new operation
```

**What does NOT change**: Engine (EditEngine, EditValidator, ParserEngine,
QueryEngine). The engine does not know about operation kinds; it only
processes `RawEdit[]` arrays.

### 7.3 Adding a New Integration Surface

**What to do**: Implement an adapter over the core engine.

```
Example: VS Code Extension, Language Server Protocol, REST API

1. Create src/vscode/ (or separate package)
2. Import from core, engine, operations
3. Translate between external protocol and domain types
4. Call the same engine methods that CLI and MCP use
```

**What does NOT change**: Core, engine, operations, languages. The new
adapter is a leaf module with no upstream dependents.

### 7.4 Cross-File Operations (Future)

**Design sketch**: A `FileSet` aggregate that groups related files.

```
FileSet {
  files: Map<string, { source: string, root: SgRoot }>
  |
  addFile(path)      -- parse and add to set
  query(pattern)     -- search across all files in set
  edit(fileEdits[])  -- apply edits to multiple files atomically
}
```

The `OperationResolver` would gain cross-file strategies (e.g., "rename
symbol across all files that import it"). The EditEngine would gain a
`batchApply()` method that applies edits to multiple files with
all-or-nothing semantics.

### 7.5 Project-Wide Refactoring (Future)

**Design sketch**: A `ProjectScope` context that understands module
boundaries, import graphs, and type information.

```
ProjectScope {
  root: string                          -- project root directory
  files: FileSet                        -- all source files
  importGraph: Map<string, string[]>    -- file -> imported files
  exportMap: Map<string, Symbol[]>      -- file -> exported symbols
  |
  findAllReferences(symbol)    -- across the entire project
  renameSymbol(from, to)       -- updates all files
  moveSymbol(from, toFile)     -- updates imports
}
```

This builds on the `FileSet` aggregate and adds project-level analysis.
The core engine and provider interfaces remain unchanged; ProjectScope
orchestrates multiple engine calls.

### 7.6 Extension Point Summary

| Extension | What to implement | What changes | What stays the same |
|-----------|------------------|--------------|---------------------|
| New language | `LanguageProvider` | languages/ | engine, operations, cli, mcp |
| New operation | Resolver strategy | operations/, types | engine, languages, cli, mcp |
| New integration | Adapter module | New leaf module | Everything else |
| Cross-file ops | `FileSet` aggregate | New core type | engine, providers |
| Project refactoring | `ProjectScope` | New orchestration layer | engine, providers, operations |


## Appendix A: Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Language | TypeScript | 5.x | Type safety, Node.js ecosystem |
| Runtime | Node.js | >= 20 | Execution environment |
| AST Engine (MVP) | @ast-grep/napi | latest | Parse, query, edit via Rust NAPI |
| AST Engine (Phase 2) | web-tree-sitter | latest | Fallback for additional languages |
| MCP SDK | @modelcontextprotocol/sdk | latest | MCP server implementation |
| CLI Framework | commander | latest | CLI argument parsing |
| Schema Validation | zod | latest | Input validation for MCP tools |
| Test Framework | vitest | latest | Unit and integration testing |
| Build | tsup or tsc | latest | TypeScript compilation |
| Linting | eslint | latest | Code quality |

## Appendix B: Related Documents

- `docs/PLAN.md` -- Detailed project plan with data model, CLI/MCP specs, and phased timeline
- `docs/SYNTHESIS.md` -- Options analysis comparing ast-grep, tree-sitter, and hybrid approaches
- `docs/adr/ADR-001-ast-backend-selection.md` -- Decision record for ast-grep as primary backend
- `docs/adr/ADR-002-cst-preservation-byte-range-splicing.md` -- Decision record for formatting preservation
- `docs/adr/ADR-003-plugin-architecture-language-providers.md` -- Decision record for provider architecture
- `docs/adr/ADR-004-three-tier-edit-model.md` -- Decision record for the three-tier edit specification model
