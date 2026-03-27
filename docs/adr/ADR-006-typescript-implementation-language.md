# ADR-006: TypeScript as Implementation Language

## Status

Accepted

## Context

Scissorhands needs an implementation language that satisfies several constraints:

1. **Runtime compatibility.** Claude Code skills and MCP servers run in Node.js. The implementation language must target the Node.js runtime.
2. **Binding availability.** `@ast-grep/napi` provides first-class Node.js bindings via NAPI (N-API). `web-tree-sitter` provides a WASM module with a JavaScript API. Both are most naturally consumed from JavaScript or TypeScript.
3. **Type safety.** The operation model (three tiers of edits, language provider interface, semantic mappings) benefits significantly from static types. The API is complex enough that type errors at runtime would be difficult to diagnose.
4. **Distribution.** npm is the expected distribution channel for tools in this ecosystem. The implementation language should produce npm-publishable packages.
5. **Contributor accessibility.** TypeScript is the most widely used typed language in the Node.js ecosystem. Using it lowers the barrier for contributors.

## Decision

Implement Scissorhands in **TypeScript**, targeting **Node.js >= 20**.

Key implementation guidelines:

- **Strict mode.** `tsconfig.json` uses `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true`.
- **ESM modules.** The project uses ES modules (`"type": "module"` in `package.json`). CommonJS interop is handled at the package boundary if needed.
- **Typed interfaces for all public APIs.** The `LanguageProvider` interface, operation types, engine API, and MCP tool schemas are fully typed. No `any` in public signatures.
- **Zod for runtime validation.** TypeScript types are compile-time only. Runtime validation of external inputs (CLI arguments, MCP tool calls, user-provided patterns) uses Zod schemas that mirror the TypeScript types.
- **Performance-sensitive code stays in Rust/C.** TypeScript handles orchestration: parsing arguments, coordinating edits, managing providers, formatting output. The actual parsing and pattern matching runs in Rust (via `@ast-grep/napi`) or C (via `web-tree-sitter` WASM). TypeScript is not on the hot path.

Build tooling:

- **`tsup`** or **`tsc`** for compilation. Output targets ES2022+ (Node.js 20 supports it natively).
- **`vitest`** for testing. Fast, TypeScript-native, ESM-compatible.
- **`eslint`** with `@typescript-eslint` for linting.

## Consequences

### Positive

- **Natural fit for the ecosystem.** Node.js runtime, npm distribution, NAPI/WASM bindings — TypeScript is the path of least resistance.
- **Type safety reduces bugs.** The operation model has many structural invariants (e.g., "a pattern edit must have a match and a replacement"; "byte ranges must not overlap"). TypeScript catches many of these at compile time.
- **Excellent tooling.** IDE support (autocomplete, refactoring, go-to-definition), debugging, and profiling tools are mature for TypeScript.
- **Contributor friendly.** TypeScript is widely known. Contributors do not need to learn a niche language.

### Negative

- **TypeScript is not fast.** For pure computation, TypeScript/V8 is 10-100x slower than Rust or C. However, this is mitigated by the decision to keep the hot path in Rust/C via NAPI/WASM. TypeScript handles orchestration only.
- **Build step required.** TypeScript must be compiled before execution. This adds a build step to the development workflow and CI pipeline. Mitigated by `tsup`'s fast compilation and `vitest`'s ability to run TypeScript directly.
- **ESM/CJS friction.** The Node.js ecosystem is still transitioning from CommonJS to ESM. Some dependencies may require interop workarounds. Mitigated by targeting Node.js 20+, which has mature ESM support.

### Neutral

- The project does not use any TypeScript-specific runtime features (decorators, reflect-metadata, etc.). The TypeScript is "plain" — types, interfaces, generics, and standard library usage. This keeps the code accessible and avoids framework lock-in.

## Alternatives Considered

### Option 1: Rust with NAPI Bindings

- **Pros:** Maximum performance. Single language for both hot path and orchestration. Strong type system.
- **Cons:** Higher barrier for contributors. NAPI binding authoring is more complex than consuming existing NAPI bindings. npm distribution of native addons requires platform-specific prebuild artifacts. The MCP server would need to be implemented in Rust, which has fewer MCP libraries than Node.js. Rejected because the performance benefit does not justify the ecosystem friction.

### Option 2: Plain JavaScript (No TypeScript)

- **Pros:** No build step. Simpler tooling. Runs directly in Node.js.
- **Cons:** No static type checking. The operation model is complex enough that type errors would be a major source of bugs. JSDoc types are an option but provide weaker guarantees than TypeScript's strict mode. Rejected because type safety is important for this project's API complexity.

### Option 3: Go with Node.js FFI

- **Pros:** Good performance. Simple deployment (single binary for CLI).
- **Cons:** No direct access to `@ast-grep/napi` or `web-tree-sitter` bindings. Would need to use tree-sitter's Go bindings (different ecosystem). Cannot produce an npm package naturally. Cannot implement an MCP stdio server as easily. Rejected because it is outside the Node.js ecosystem.
