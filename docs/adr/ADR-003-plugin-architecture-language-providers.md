# ADR-003: Plugin Architecture for Language Providers

## Status

Accepted

## Context

Arborist must support adding new programming languages without modifying the core engine. Each language has distinct characteristics:

- Different AST node types and naming conventions (e.g., `function_declaration` in JavaScript vs. `function_definition` in Python).
- Different semantic concepts (e.g., Python has decorators and list comprehensions; Go has goroutines and defer).
- Different common refactoring operations (e.g., "extract method" differs structurally between class-based and module-based languages).
- Different AST backends may be optimal for different languages (ast-grep for common languages, tree-sitter for niche ones).

Without a plugin architecture, adding a new language would require modifying the core engine, increasing coupling and making third-party language contributions impractical.

## Decision

Define a **`LanguageProvider` interface** that encapsulates all language-specific knowledge. The core engine interacts with languages exclusively through this interface. A **registry** maps language identifiers to their providers.

The `LanguageProvider` interface includes:

1. **`parse(source: string): ParseResult`** — Parse source code into the backend-specific tree representation.
2. **`query(tree, pattern: string): MatchResult[]`** — Find nodes matching a structural pattern.
3. **`getNodeAtPosition(tree, offset: number): Node`** — Locate a node by byte position.
4. **`getSemanticMap(): SemanticMapping`** — Maps abstract concepts (function, class, import, parameter, etc.) to language-specific node types and patterns.
5. **`getEditPatterns(): EditPattern[]`** — Provides built-in patterns for common refactorings (rename, extract, wrap, etc.).

Two concrete backend types implement this interface:

- **`AstGrepProvider`** — Uses `@ast-grep/napi` and its `Lang` enum. Patterns use ast-grep's code-native syntax. Editing leverages `commitEdits()`.
- **`TreeSitterProvider`** — Loads a `.wasm` grammar file via `web-tree-sitter`. Patterns are translated to tree-sitter S-expression queries or use the tree-sitter query syntax directly. Editing uses the byte-range splicing engine from ADR-002.

Providers are registered by language identifier (matching common conventions: `typescript`, `python`, `rust`, `go`, etc.). The registry supports:

- **Auto-detection** from file extensions.
- **Fallback chains** — If an ast-grep provider exists for a language, it is preferred. If not, the tree-sitter provider is used.
- **Runtime registration** — Third-party packages can register providers at runtime.

Provider packages follow the naming convention `@arborist/lang-{language}` for first-party packages and `arborist-lang-{language}` for community packages.

## Consequences

### Positive

- **Decoupled language knowledge.** The core engine has zero knowledge of any specific language. All language-specific behavior lives in providers.
- **Third-party extensibility.** Anyone can publish an `arborist-lang-*` package to add support for a new language. No fork or PR to core required.
- **Backend transparency.** Callers do not know or care whether a provider uses ast-grep or tree-sitter internally. The `LanguageProvider` interface is backend-agnostic.
- **Testable in isolation.** Each provider can be unit-tested independently with language-specific test fixtures.
- **Incremental language support.** A provider can start with just `parse` and `query`, adding semantic mappings and edit patterns over time.

### Negative

- **Interface design risk.** The `LanguageProvider` interface must be expressive enough for all languages and both backends. If the initial design is too narrow, it will need breaking changes. Mitigated by designing the interface based on concrete use cases from at least 3-4 languages before finalizing.
- **Semantic mapping maintenance.** Each language's semantic map must be maintained as the language evolves (e.g., new syntax in ECMAScript yearly releases). This is an ongoing cost per language.
- **Discovery and quality.** Community providers may have inconsistent quality. A registry or compatibility test suite would help but is out of scope for the MVP.

### Neutral

- The MVP ships with providers for TypeScript, JavaScript, Python, and Go. Additional languages are added based on demand.
- The `SemanticMapping` type is intentionally loose in the MVP (a record of concept names to node type strings) and can be formalized later.

## Alternatives Considered

### Option 1: Monolithic Language Support in Core

- **Pros:** Simpler initially. No interface design needed. All languages tested together.
- **Cons:** Adding a language requires modifying core. Third-party contributions require PRs to the main repo. Tight coupling between core engine logic and language specifics. Rejected because it does not scale.

### Option 2: Configuration-Driven Language Definitions (JSON/YAML)

- **Pros:** No code needed per language — just a config file mapping node types to concepts.
- **Cons:** Insufficient for complex operations. Common refactorings often require procedural logic (e.g., "extract function" in Python must handle indentation differently than in JavaScript). Config files cannot express this. Rejected because it is too limiting.

### Option 3: tree-sitter Query Files as the Universal Plugin Format

- **Pros:** Tree-sitter queries are a well-understood format. Could use `.scm` files for patterns.
- **Cons:** Ties the plugin model to tree-sitter's query language, which is less ergonomic than ast-grep patterns. Does not accommodate the dual-backend model. Rejected because it couples the plugin architecture to one backend.
