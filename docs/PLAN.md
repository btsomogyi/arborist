# Arborist: AST-Based Polyglot Code Editor for AI Agents

## Executive Summary

Arborist is a TypeScript/Node.js package that gives AI agents (Claude Code
skills, MCP tools) the ability to perform **targeted, structure-aware edits**
to source code files across multiple programming languages. It wraps
**ast-grep's NAPI bindings** (`@ast-grep/napi`) as its primary engine,
exposing a clean operation-oriented API designed for agent consumption via
both CLI and MCP server interfaces.

---

## 1. Decision Record: Build vs Reuse

### 1.1 Tool Landscape Analysis

| Tool | Type | Languages | Node.js API | Edit Support | Formatting Preservation |
|------|------|-----------|-------------|--------------|------------------------|
| **tree-sitter** (native) | Parser + incremental edit | 100+ via grammars | `tree-sitter` npm (native addon) | `tree.edit()` reshapes tree; no source rewrite | Full (edits are positional) |
| **ast-grep** (`@ast-grep/napi`) | Structural search/replace | 100+ (uses tree-sitter internally) | `@ast-grep/napi` (Rust NAPI) | `SgNode.replace()` + `commitEdits()` | Full (positional edits on original source) |
| **Comby** | Structural match/rewrite | Language-agnostic | CLI only (OCaml binary) | Template-based rewrite | Partial (no AST awareness) |
| **tree-sitter query** | Query language | All tree-sitter langs | Via tree-sitter bindings | Query only (no edit) | N/A |

### 1.2 Decision: ast-grep as Primary Engine

**Choice**: Wrap `@ast-grep/napi` as the core engine.

**Rationale**:

1. **ast-grep already wraps tree-sitter internally**. Using ast-grep gives us
   tree-sitter's parsing plus a high-level search/replace API, avoiding the
   need to build edit-application logic ourselves.

2. **`commitEdits()` solves the hardest problem**. The method accepts an array
   of `Edit` objects (each with `startPos`, `endPos`, `insertedText`) and
   produces a new source string. Edits are positional against the original
   source, so comments, whitespace, and formatting outside the edit ranges are
   preserved byte-for-byte.

3. **Pattern syntax is code-native**. ast-grep patterns use the target
   language's own syntax (e.g., `console.log($ARG)` matches console.log calls
   in JavaScript). This is dramatically more intuitive for AI agents than
   S-expression queries.

4. **Single dependency for parse + query + edit**. No need to coordinate
   between a parser library and a separate edit library.

5. **NAPI bindings = native performance in Node.js**. The Rust core compiles
   to a native addon, so there is no WASM overhead.

**What we do NOT use**:

- **Raw tree-sitter**: Lower-level than needed. We'd have to build the
  pattern-matching and edit-application layers ourselves.
- **Comby**: Not AST-aware. Cannot handle Python (indentation-sensitive).
  No Node.js API (CLI-only OCaml binary). Would require subprocess management.
- **web-tree-sitter**: WASM-based, significantly slower than native bindings
  in Node.js. Only appropriate for browser contexts.

### 1.3 What Arborist Builds on Top of ast-grep

ast-grep provides the engine. Arborist provides the **agent-facing interface**:

| Layer | ast-grep provides | Arborist adds |
|-------|-------------------|---------------|
| Parsing | `parse(lang, source)` | File I/O, language detection, caching |
| Querying | `SgNode.find/findAll` with patterns | Named query library, result serialization |
| Editing | `SgNode.replace()` + `commitEdits()` | Operation model (rename, extract, wrap, etc.) |
| Multi-edit | Array of Edit objects | Conflict detection, ordering, validation |
| Integration | NAPI bindings | CLI tool, MCP server, skill wrapper |
| Languages | Language enum | Provider registry, auto-detection |

---

## 2. Architecture

### 2.1 Language Choice: TypeScript/Node.js

**Decision**: TypeScript, targeting Node.js >= 20.

**Rationale**:
- Claude Code skills and MCP servers run in Node.js
- `@ast-grep/napi` provides first-class Node.js bindings via NAPI
- TypeScript gives us type safety for the operation model
- npm distribution is the natural channel for Claude Code tooling
- No performance concern: the hot path (parsing, pattern matching) runs in
  Rust via NAPI; TypeScript handles orchestration only

### 2.2 Package Structure

```
arborist/
  src/
    core/                    # Core abstractions
      types.ts               # Shared type definitions
      errors.ts              # Error hierarchy
      language-registry.ts   # Language provider registry
    engine/                  # ast-grep wrapper layer
      parser.ts              # Parse files, manage trees
      query.ts               # Pattern-based querying
      editor.ts              # Edit construction and application
      edit-validator.ts      # Conflict detection, ordering
    operations/              # High-level edit operations
      rename.ts              # Rename symbol
      extract.ts             # Extract to variable/function
      wrap.ts                # Wrap node in construct
      replace.ts             # Structural find/replace
      insert.ts              # Insert before/after/into
      remove.ts              # Remove node
      move.ts                # Move node to new location
    languages/               # Language provider modules
      typescript.ts          # TypeScript/JavaScript provider
      python.ts              # Python provider
      go.ts                  # Go provider (Phase 2)
      rust.ts                # Rust provider (Phase 3)
      index.ts               # Provider registry initialization
    cli/                     # CLI interface
      index.ts               # CLI entry point
      commands/              # Command implementations
        parse.ts
        query.ts
        edit.ts
        ops.ts               # High-level operations
    mcp/                     # MCP server interface
      server.ts              # MCP server setup
      tools/                 # Tool definitions
        parse-tool.ts
        query-tool.ts
        edit-tool.ts
        ops-tool.ts
    skill/                   # Claude Code skill wrapper
      index.ts               # Skill definition
  tests/
    unit/
      engine/
      operations/
      languages/
    integration/
      cli/
      mcp/
    fixtures/                # Sample source files for testing
      typescript/
      python/
  docs/
    PLAN.md                  # This document
```

### 2.3 Core Data Model

```typescript
// === Language Provider ===

interface LanguageProvider {
  /** Language identifier (e.g., "typescript", "python") */
  id: string;

  /** File extensions this provider handles */
  extensions: string[];

  /** ast-grep language enum value */
  astGrepLang: SgLang;

  /** Language-specific query patterns */
  patterns: LanguagePatterns;

  /** Language-specific node type mappings */
  nodeTypes: NodeTypeMap;
}

interface LanguagePatterns {
  functionDeclaration: string;    // e.g., "function $NAME($$$PARAMS) { $$$BODY }"
  classDeclaration: string;
  variableDeclaration: string;
  importStatement: string;
  exportStatement: string;
  // ... extensible per language
}

interface NodeTypeMap {
  function: string[];        // e.g., ["function_declaration", "arrow_function"]
  class: string[];
  variable: string[];
  import: string[];
  parameter: string[];
  identifier: string[];
  // ... extensible per language
}

// === Edit Model ===

interface ArboristEdit {
  /** Target file path */
  file: string;

  /** The operation to perform */
  operation: EditOperation;
}

type EditOperation =
  | StructuralReplace
  | Rename
  | Extract
  | Wrap
  | Insert
  | Remove
  | Move;

interface StructuralReplace {
  kind: "replace";
  /** ast-grep pattern to match */
  pattern: string;
  /** Replacement template (with $CAPTURES) */
  replacement: string;
  /** Optional: only apply to Nth match */
  matchIndex?: number;
  /** Optional: scope to a containing pattern */
  scope?: string;
}

interface Rename {
  kind: "rename";
  /** Current name */
  from: string;
  /** New name */
  to: string;
  /** Scope: "file" | "function" | pattern */
  scope?: string;
}

interface Extract {
  kind: "extract";
  /** Pattern matching the expression to extract */
  pattern: string;
  /** Name for the extracted variable/function */
  name: string;
  /** "variable" | "function" */
  extractTo: "variable" | "function";
}

interface Wrap {
  kind: "wrap";
  /** Pattern matching the node to wrap */
  pattern: string;
  /** Template for the wrapper (use $MATCH for the original) */
  wrapper: string;
}

interface Insert {
  kind: "insert";
  /** Pattern identifying the anchor node */
  anchor: string;
  /** Position relative to anchor */
  position: "before" | "after" | "prepend" | "append";
  /** Content to insert */
  content: string;
}

interface Remove {
  kind: "remove";
  /** Pattern matching the node to remove */
  pattern: string;
  /** Optional: only remove Nth match */
  matchIndex?: number;
}

interface Move {
  kind: "move";
  /** Pattern matching the node to move */
  pattern: string;
  /** Anchor pattern for the destination */
  destination: string;
  /** Position relative to destination */
  position: "before" | "after";
}

// === Query Model ===

interface ArboristQuery {
  /** Target file path */
  file: string;

  /** ast-grep pattern to search for */
  pattern: string;

  /** Optional: language override (default: auto-detect) */
  language?: string;
}

interface QueryResult {
  file: string;
  matches: MatchInfo[];
}

interface MatchInfo {
  /** The matched source text */
  text: string;

  /** AST node type */
  nodeType: string;

  /** Location in file */
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };

  /** Named captures from the pattern */
  captures: Record<string, string>;

  /** Structural context (parent chain) */
  context: string[];
}
```

### 2.4 Edit Engine Design

The critical design challenge is applying multiple edits to the same file
without conflicts. The edit engine works in three phases:

```
Phase 1: Resolve       Phase 2: Validate       Phase 3: Apply
-----------           ---------------          -----------
Operations    -->     Edit objects      -->    New source
(high-level)          (positional)             (string)

rename("x","y")  =>  [{start,end,"y"},    =>  commitEdits(edits)
                       {start,end,"y"},         => new file content
                       ...]
```

**Conflict detection rules**:
1. Edits must not have overlapping ranges
2. If two edits overlap, the engine rejects the batch (fail-fast)
3. Edits are sorted by position (end-to-start) before application
4. `commitEdits()` handles the positional math internally

**Formatting preservation guarantee**:
- ast-grep's `commitEdits()` operates on byte ranges against the original
  source string. Any bytes outside of edit ranges are preserved exactly.
- Comments and whitespace are only modified if they fall within an edit range.
- Indentation within inserted text is the caller's responsibility; arborist
  will provide indentation detection helpers.

---

## 3. Edit Model: How Agents Specify Edits

### 3.1 Three Tiers of Edit Specification

**Tier 1: Structural Patterns** (primary agent interface)

Agents use ast-grep's pattern syntax, which mirrors the target language:

```json
{
  "file": "src/auth.ts",
  "operation": {
    "kind": "replace",
    "pattern": "console.log($MSG)",
    "replacement": "logger.info($MSG)"
  }
}
```

This is the natural interface for AI agents because:
- Patterns look like the code they match
- `$NAME` captures are intuitive
- `$$$NAME` captures match multiple nodes (variadic)
- No need to learn a separate query language

**Tier 2: High-Level Operations** (convenience layer)

For common refactoring tasks, agents use named operations:

```json
{
  "file": "src/auth.ts",
  "operation": {
    "kind": "rename",
    "from": "isValid",
    "to": "isAuthenticated",
    "scope": "file"
  }
}
```

These decompose into one or more structural pattern edits internally.

**Tier 3: Raw Positional Edits** (escape hatch)

For cases where patterns don't fit, agents can specify raw edits:

```json
{
  "file": "src/auth.ts",
  "operation": {
    "kind": "raw",
    "edits": [
      {
        "startPos": { "line": 10, "column": 0 },
        "endPos": { "line": 10, "column": 15 },
        "insertedText": "// deprecated\n"
      }
    ]
  }
}
```

### 3.2 Why Not tree-sitter S-expression Queries?

tree-sitter queries use S-expressions like:
```scheme
(function_declaration
  name: (identifier) @func-name
  parameters: (formal_parameters) @params)
```

These are powerful but:
- Require knowledge of each language's node type names
- Are verbose for simple patterns
- Are harder for AI agents to generate correctly
- Are a different "language" from the code being edited

ast-grep's pattern syntax uses the target language directly, so
`function $NAME($$$PARAMS) { $$$BODY }` matches functions in JavaScript.
The agent doesn't need to know tree-sitter node types.

However, tree-sitter queries are available as a fallback through ast-grep's
rule system for advanced use cases where pattern syntax is insufficient.

---

## 4. Integration Model

### 4.1 CLI Interface

```bash
# Parse and display AST structure
arborist parse src/auth.ts

# Query for pattern matches
arborist query src/auth.ts --pattern "console.log(\$MSG)"

# Apply a structural replace
arborist edit src/auth.ts --replace \
  --pattern "console.log(\$MSG)" \
  --with "logger.info(\$MSG)"

# Apply a high-level operation
arborist edit src/auth.ts --rename --from isValid --to isAuthenticated

# Apply edits from a JSON file
arborist apply edits.json

# Dry-run: show what would change without writing
arborist edit src/auth.ts --replace \
  --pattern "console.log(\$MSG)" \
  --with "logger.info(\$MSG)" \
  --dry-run
```

### 4.2 MCP Server Interface

The MCP server exposes tools that Claude Code can invoke directly:

```typescript
// Tool: arborist_parse
// Parses a file and returns its AST structure
{
  name: "arborist_parse",
  description: "Parse a source file and return its AST structure",
  inputSchema: {
    type: "object",
    properties: {
      file: { type: "string", description: "Path to the source file" },
      depth: { type: "number", description: "Max AST depth to return" },
      nodeTypes: {
        type: "array",
        items: { type: "string" },
        description: "Filter to specific node types"
      }
    },
    required: ["file"]
  }
}

// Tool: arborist_query
// Searches for structural patterns in source files
{
  name: "arborist_query",
  description: "Search for code patterns using structural matching",
  inputSchema: {
    type: "object",
    properties: {
      file: { type: "string" },
      pattern: { type: "string", description: "ast-grep pattern" },
      language: { type: "string", description: "Override language detection" }
    },
    required: ["file", "pattern"]
  }
}

// Tool: arborist_edit
// Applies structural edits to source files
{
  name: "arborist_edit",
  description: "Apply targeted, AST-aware edits to a source file",
  inputSchema: {
    type: "object",
    properties: {
      file: { type: "string" },
      operation: {
        type: "object",
        description: "Edit operation (replace, rename, extract, wrap, insert, remove, move)"
      },
      dryRun: { type: "boolean", description: "Preview changes without writing" }
    },
    required: ["file", "operation"]
  }
}

// Tool: arborist_batch
// Applies multiple edits atomically
{
  name: "arborist_batch",
  description: "Apply multiple edits to one or more files atomically",
  inputSchema: {
    type: "object",
    properties: {
      edits: {
        type: "array",
        items: { type: "object" },
        description: "Array of {file, operation} edit specifications"
      },
      dryRun: { type: "boolean" }
    },
    required: ["edits"]
  }
}
```

### 4.3 Claude Code Skill Wrapper

A Claude Code skill can wrap arborist's MCP tools or import the library
directly:

```typescript
// As a skill using the library directly
import { Arborist } from "arborist";

const arborist = new Arborist();

// Parse
const tree = await arborist.parse("src/auth.ts");

// Query
const matches = await arborist.query("src/auth.ts", "console.log($MSG)");

// Edit
const result = await arborist.edit("src/auth.ts", {
  kind: "replace",
  pattern: "console.log($MSG)",
  replacement: "logger.info($MSG)"
});

// Batch edit
const results = await arborist.batch([
  {
    file: "src/auth.ts",
    operation: { kind: "rename", from: "isValid", to: "isAuthenticated" }
  },
  {
    file: "src/utils.ts",
    operation: { kind: "remove", pattern: "console.log($$$ARGS)" }
  }
]);
```

### 4.4 Delivery Sequence

**Phase 1 (MVP)**: Library + CLI
- Publish as npm package
- CLI via `npx arborist` or installed binary

**Phase 2**: MCP Server
- Add MCP server mode: `arborist mcp`
- Register as a Claude Code MCP tool

**Phase 3**: Claude Code Skill
- Package as a Claude Code skill
- Provide skill definition file

---

## 5. MVP Scope

### 5.1 Languages: TypeScript + Python

**TypeScript** (including JavaScript/JSX/TSX):
- Most common language for Claude Code users
- Rich AST with clear node types
- ast-grep has excellent TypeScript support

**Python**:
- Second most popular language for AI/ML codebases
- Tests ast-grep's handling of indentation-sensitive languages
- Different enough from TypeScript to validate the provider abstraction

### 5.2 Operations: Parse + Query + 4 Edit Types

| Operation | Priority | Description |
|-----------|----------|-------------|
| `parse` | P0 | Parse file, return AST structure |
| `query` | P0 | Find nodes matching a structural pattern |
| `replace` | P0 | Structural find-and-replace |
| `rename` | P0 | Rename an identifier across a file |
| `insert` | P1 | Insert code before/after a matched node |
| `remove` | P1 | Remove a matched node |
| `wrap` | P2 | Wrap a matched node in a new construct |
| `extract` | P2 | Extract expression to variable/function |
| `move` | P3 | Move a node to a new location |

MVP includes P0 and P1 operations.

### 5.3 Integration: Library + CLI

MVP ships as:
1. An npm package (`arborist`) importable as a library
2. A CLI tool (`arborist` / `npx arborist`)
3. Dry-run mode for all operations

MCP server is Phase 2.

### 5.4 MVP Non-Goals

- Cross-file analysis (e.g., finding all callers of a renamed function)
- Project-wide refactoring
- Type-aware operations (e.g., rename only variables of type X)
- Custom language grammar loading
- Source map support

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Parse files and query patterns for TypeScript and Python.

| Task | Effort | Risk |
|------|--------|------|
| Project setup (tsconfig, eslint, vitest, build) | 0.5d | Low |
| Core types and error hierarchy | 0.5d | Low |
| Language provider interface + registry | 1d | Low |
| TypeScript language provider | 1d | Medium |
| Python language provider | 1d | Medium |
| Engine: parser (file I/O, language detection, caching) | 1d | Low |
| Engine: query (pattern matching, result serialization) | 1.5d | Medium |
| Unit tests for parse and query | 1.5d | Low |
| CLI: parse and query commands | 1d | Low |

**Deliverable**: `arborist parse` and `arborist query` working for TS + Python.

**Key Risk**: ast-grep pattern syntax varies subtly between languages.
Mitigation: Build a comprehensive test fixture set per language early.

### Phase 2: Edit Engine (Week 3-4)

**Goal**: Apply structural edits with formatting preservation.

| Task | Effort | Risk |
|------|--------|------|
| Engine: editor (Edit construction from operations) | 2d | High |
| Engine: edit-validator (conflict detection) | 1d | Medium |
| Operation: structural replace | 1d | Medium |
| Operation: rename | 1.5d | Medium |
| Operation: insert (before/after) | 1d | Low |
| Operation: remove | 0.5d | Low |
| Indentation detection helper | 1d | Medium |
| Unit tests for all edit operations | 2d | Medium |
| CLI: edit command + dry-run mode | 1d | Low |

**Deliverable**: `arborist edit` working for replace, rename, insert, remove.

**Key Risk**: Multi-edit conflict resolution and indentation preservation in
Python. Mitigation: Fail-fast on overlapping edits; indentation helper infers
from context.

### Phase 3: Integration (Week 5-6)

**Goal**: MCP server, batch operations, polish.

| Task | Effort | Risk |
|------|--------|------|
| Batch edit API (multi-file, atomic) | 1.5d | Medium |
| MCP server setup (@modelcontextprotocol/sdk) | 1d | Low |
| MCP tools: parse, query, edit, batch | 2d | Medium |
| CLI: apply command (JSON edit files) | 1d | Low |
| Error messages and agent-friendly output | 1d | Low |
| Integration tests (CLI + MCP) | 2d | Medium |
| Package configuration (npm publish) | 0.5d | Low |

**Deliverable**: Full MCP server + CLI, ready for npm publish.

### Phase 4: Extended Operations + Languages (Week 7-8)

**Goal**: Wrap, extract, move operations; Go language provider.

| Task | Effort | Risk |
|------|--------|------|
| Operation: wrap | 1d | Medium |
| Operation: extract (variable) | 1.5d | High |
| Operation: extract (function) | 2d | High |
| Operation: move | 1.5d | High |
| Go language provider | 1d | Medium |
| Claude Code skill wrapper | 1d | Low |
| Documentation and examples | 1d | Low |

**Deliverable**: Full operation set, 3 languages, skill integration.

---

## 7. Critical Path Analysis

```
[Project Setup] ──> [Core Types] ──> [Language Registry] ──> [TS Provider] ──┐
                                                                               │
                                                             [Py Provider] ──┤
                                                                               │
                                     [Parser Engine] ──────────────────────> [Query Engine] ──> [Edit Engine] ──> [Operations] ──> [CLI] ──> [MCP]
```

**The critical path runs through**:
1. Core types (everything depends on these)
2. Parser engine (edit engine depends on this)
3. Edit engine (operations depend on this)
4. Structural replace operation (validates the entire edit pipeline)

**The highest-risk item is the Edit Engine** (Phase 2, "editor.ts"):
- Must correctly translate high-level operations to positional edits
- Must handle multiple edits to the same region
- Must preserve formatting in all cases
- Is the novel value-add over using ast-grep directly

**Mitigation**: Build a "spike" of the edit engine early (during Phase 1) to
validate the approach with a simple replace operation end-to-end before
committing to the full operation set.

---

## 8. Novel Approaches

### 8.1 Pattern-as-Selector Model

Instead of inventing a new selector syntax, arborist uses ast-grep patterns
as the universal targeting mechanism. A pattern like
`function $NAME($$$PARAMS) { $$$BODY }` simultaneously:
- **Identifies** which nodes to operate on
- **Captures** sub-components for use in replacements
- **Documents** what the edit does (the pattern is human-readable)

This means agents don't need to learn XPath-like selectors, S-expressions,
or any new DSL. They write patterns in the language they're editing.

### 8.2 Scoped Edits via Nested Patterns

To scope an edit (e.g., "rename `x` to `y` only inside function `foo`"),
arborist supports a `scope` parameter that nests the edit within a
containing pattern:

```json
{
  "kind": "rename",
  "from": "x",
  "to": "y",
  "scope": "function foo($$$PARAMS) { $$$BODY }"
}
```

The engine first finds nodes matching the scope pattern, then applies the
rename only within those subtrees. This composes naturally: any pattern can
be a scope.

### 8.3 Dry-Run Diff Output

All edit operations support dry-run mode that returns a unified diff:

```diff
--- src/auth.ts (original)
+++ src/auth.ts (modified)
@@ -15,3 +15,3 @@
-  console.log("auth failed");
+  logger.info("auth failed");
```

This lets agents preview and validate edits before applying them, and lets
users audit what an agent plans to do.

### 8.4 Edit Composition

Multiple operations can be composed into a single atomic batch:

```json
{
  "edits": [
    {
      "file": "src/auth.ts",
      "operation": { "kind": "rename", "from": "isValid", "to": "isAuthenticated" }
    },
    {
      "file": "src/auth.ts",
      "operation": { "kind": "remove", "pattern": "console.log($$$ARGS)" }
    },
    {
      "file": "src/auth.ts",
      "operation": {
        "kind": "insert",
        "anchor": "export function isAuthenticated",
        "position": "before",
        "content": "/** Checks if the current session is authenticated. */"
      }
    }
  ]
}
```

The engine validates the entire batch for conflicts before applying any edits,
providing all-or-nothing semantics.

---

## 9. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| ast-grep NAPI has bugs or missing features | High | Low | Comprehensive test suite; fallback to raw tree-sitter for edge cases |
| Pattern syntax is insufficient for complex edits | Medium | Medium | Expose tree-sitter query as escape hatch; raw positional edits as last resort |
| Python indentation handling is fragile | High | Medium | Indentation context detection; conservative approach (fail rather than corrupt) |
| Multi-edit conflicts are complex to resolve | Medium | Medium | Fail-fast on overlap; require agents to order non-overlapping edits |
| ast-grep NAPI binary compatibility issues across platforms | Medium | Low | CI matrix for Linux/macOS/Windows; prebuild binaries |
| Performance degrades on very large files | Low | Low | Lazy parsing; pattern scope to limit search area |
| Agent-generated patterns have syntax errors | Medium | High | Pattern validation with clear error messages; suggest corrections |

---

## 10. Success Criteria

### MVP (Phase 2 Complete)

- [ ] Parse TypeScript and Python files, return AST structure
- [ ] Query files with structural patterns, return matches with locations
- [ ] Apply structural replace edits with formatting preservation
- [ ] Rename identifiers within file scope
- [ ] Insert code before/after matched nodes
- [ ] Remove matched nodes
- [ ] Dry-run mode for all operations
- [ ] CLI working for all operations
- [ ] All operations preserve comments and whitespace outside edit ranges
- [ ] Test coverage > 80% on engine and operations

### Full Release (Phase 3 Complete)

- [ ] MCP server with parse, query, edit, batch tools
- [ ] Batch edits with conflict detection and atomic application
- [ ] Agent-friendly error messages
- [ ] Published to npm

---

## 11. Open Questions

1. **Should arborist support glob patterns for multi-file operations?**
   Leaning yes for CLI, no for MCP (let the agent iterate over files).

2. **Should we support `.editorconfig` / prettier for formatting inserted code?**
   Leaning no for MVP. Arborist preserves existing formatting; it doesn't
   reformat. Inserted code should be pre-formatted by the agent.

3. **Should we expose ast-grep's rule system (YAML-based)?**
   Leaning no for MVP. Pattern syntax covers the common cases. Rules add
   complexity for marginal benefit in the agent use case.

4. **Should dry-run output be structured (JSON) or human-readable (diff)?**
   Both. JSON for programmatic consumption, diff for display.

---

## Appendix A: Research Sources

- [tree-sitter native Node.js bindings](https://github.com/tree-sitter/node-tree-sitter)
- [web-tree-sitter (WASM)](https://www.npmjs.com/package/web-tree-sitter)
- [@ast-grep/napi npm package](https://www.npmjs.com/package/@ast-grep/napi)
- [ast-grep JavaScript API guide](https://ast-grep.github.io/guide/api-usage/js-api.html)
- [ast-grep API reference](https://ast-grep.github.io/reference/api.html)
- [ast-grep comparison with other tools](https://ast-grep.github.io/advanced/tool-comparison.html)
- [ast-grep rewrite code guide](https://ast-grep.github.io/guide/rewrite-code.html)
- [tree-sitter query syntax](https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html)
- [Comby structural code search](https://comby.dev/)
- [MCP server tree-sitter (wrale)](https://github.com/wrale/mcp-server-tree-sitter)
- [MCP server tree-sitter (nendotools)](https://github.com/nendotools/tree-sitter-mcp)
