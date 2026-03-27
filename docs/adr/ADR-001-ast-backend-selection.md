# ADR-001: AST Backend Selection — Hybrid ast-grep + tree-sitter

## Status

Accepted

## Context

Scissorhands is an AST-based polyglot code editor designed for AI agents. The core requirement is multi-language AST parsing and structural editing with high fidelity. Two mature ecosystems exist for AST manipulation in the Node.js/TypeScript world:

1. **ast-grep** (`@ast-grep/napi`) — A Rust-based tool built on tree-sitter that adds pattern matching, code-native query syntax, and a `commitEdits()` API for transactional edits. Ships as a native NAPI addon with first-class Node.js bindings.

2. **web-tree-sitter** — The official WASM build of tree-sitter. Provides incremental parsing for 170+ languages via loadable `.wasm` grammar files. Lower-level API; editing requires manual byte-range manipulation.

Each has trade-offs. ast-grep offers a significantly better developer experience (pattern-based queries, built-in edit commit semantics, Rust-speed via NAPI) but supports a fixed set of languages defined by its `Lang` enum. web-tree-sitter supports vastly more languages but requires more plumbing for edit operations and runs in WASM rather than native code.

A single-backend approach forces a choice between ergonomics and language coverage.

## Decision

Use a **hybrid backend** strategy:

- **MVP (Phase 1):** `@ast-grep/napi` is the primary and only backend. All core editing operations, pattern matching, and structural queries run through ast-grep. This covers the most common languages (TypeScript, JavaScript, Python, Rust, Go, Java, C, C++, HTML, CSS, and others in the ast-grep Lang enum).

- **Phase 2:** Add `web-tree-sitter` as a fallback backend for languages not supported by ast-grep. A backend-agnostic `LanguageProvider` interface (see ADR-003) isolates the core engine from backend specifics. When a language is requested that ast-grep does not support, the system loads the corresponding tree-sitter `.wasm` grammar and uses the tree-sitter API path.

The `LanguageProvider` interface is defined from the start, even in the MVP, so the tree-sitter backend can be added without modifying the core engine.

## Consequences

### Positive

- **Best-in-class ergonomics for common languages.** ast-grep's `commitEdits()`, code-native pattern syntax, and NAPI performance provide the best possible experience for the majority of use cases.
- **170+ language coverage when needed.** web-tree-sitter ensures no language is excluded. Niche languages (HCL, TOML, Dockerfile, etc.) become available in Phase 2.
- **Incremental delivery.** The MVP ships with ast-grep only, reducing initial scope and complexity. Phase 2 is additive, not a rewrite.
- **Performance where it matters.** ast-grep runs as native Rust via NAPI for hot-path languages. WASM overhead only applies to fallback languages.

### Negative

- **Two backends to maintain.** Each backend has its own API surface, error modes, and upgrade cadence. The `LanguageProvider` abstraction must be expressive enough to accommodate both without leaking backend details.
- **Behavioral parity risk.** Pattern matching semantics may differ subtly between ast-grep patterns and tree-sitter queries. Tests must cover both paths for languages where both backends are available.
- **Dependency weight.** The project carries both a native NAPI addon and WASM grammars. This increases install size and adds platform-specific build considerations for the NAPI component.

### Neutral

- The `LanguageProvider` interface must be designed before the MVP, even though only one implementation exists initially. This is an upfront design cost that pays off in Phase 2.

## Alternatives Considered

### Option 1: ast-grep Only

- **Pros:** Single backend, simpler codebase, best performance, best DX.
- **Cons:** Limited to languages in the ast-grep `Lang` enum. No path to supporting niche languages without upstream changes. Rejected because language coverage is a stated requirement.

### Option 2: web-tree-sitter Only

- **Pros:** Maximum language coverage from day one. Single backend.
- **Cons:** No `commitEdits()` — all edit transaction logic must be built from scratch. Pattern matching requires tree-sitter S-expression queries, which are less agent-friendly than code-native patterns. WASM has higher overhead than native NAPI for hot-path operations. Rejected because it sacrifices too much ergonomics and performance.

### Option 3: Unified tree-sitter via Rust FFI

- **Pros:** Single backend with native performance and full language coverage.
- **Cons:** Requires building and maintaining a custom Rust NAPI bridge to tree-sitter, duplicating much of what ast-grep already provides. High development cost for marginal benefit over the hybrid approach. Rejected due to build complexity and maintenance burden.
