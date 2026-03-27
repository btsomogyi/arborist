# Arborist

AST-based polyglot source code editor for AI agent metaprogramming.

## Overview

Arborist gives AI agents (Claude Code skills, MCP tools, CLI) the ability to perform **targeted, structure-aware edits** to source code files across multiple programming languages. Instead of rewriting entire files, agents locate specific AST nodes using code-native patterns and apply surgical edits that preserve all surrounding formatting, comments, and whitespace.

**Core engine**: [`@ast-grep/napi`](https://ast-grep.github.io/) (Rust/NAPI, built on tree-sitter) with [`web-tree-sitter`](https://github.com/tree-sitter/tree-sitter) fallback for extended language coverage.

## Key Features

- **Pattern-as-Selector**: Target AST nodes using patterns written in the language itself (e.g., `console.log($MSG)`) — no DSL or S-expressions required
- **Byte-range splicing**: Edits preserve all formatting, comments, and whitespace outside the edit range
- **Three-tier edit model**: Structural patterns (agent-friendly) | Named operations (rename, insert, remove) | Raw positional edits (escape hatch)
- **Extensible language support**: Plugin-based `LanguageProvider` interface — add new languages without modifying core
- **Multiple integration surfaces**: npm library, CLI tool, MCP server (stdio), Claude Code skill

## Supported Languages

| Language | Backend | Status |
|----------|---------|--------|
| TypeScript/JavaScript/JSX/TSX | ast-grep | Implemented |
| Python | ast-grep | Implemented |
| Go | ast-grep | Phase 2 |
| Rust | ast-grep | Phase 2 |
| 170+ others | web-tree-sitter | Phase 2 |

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 0 | Research & design (ecosystem survey, options analysis) | Done |
| 1 | Architecture (ADRs, DDD, system architecture, implementation plan) | Done |
| 2 | Project foundation (package.json, tsconfig, build, directory structure) | Done |
| 3 | Core types & domain (Position, Range, ByteRange, LanguageProvider, QueryMatch, EditOperation, errors, registry) | Done |
| 4 | Engine layer (parser with LRU cache, query engine, edit engine, edit validator with overlap detection) | Done |
| 5 | Language providers (TypeScript/JS/TSX/JSX + Python) | Done |
| 6 | High-level operations (replace, rename, insert, remove) | Done |
| 7 | CLI interface (parse, query, edit, apply, providers commands) | Done |
| 8 | MCP server (arborist_parse, arborist_query, arborist_edit, arborist_batch, arborist_list_symbols, arborist_rename) | Done |
| 9 | Claude Code skill (skill definition, trigger conditions, examples) | Planned |
| 10 | E2E validation & ship (fixtures, 21 test scenarios, npm publish) | In Progress |

## Language Support & Update Cadence

Arborist's language support derives from two upstream ecosystems:

- **ast-grep** (MVP backend): Releases every ~2-4 weeks. Vendors tree-sitter grammars as Rust crate dependencies. Grammar updates flow through when the ast-grep maintainer bumps deps — reactive, not on a fixed schedule. Covers ~22 built-in languages including all major ones (TS, Python, Go, Rust, Java, C/C++, C#, Kotlin, Swift, Ruby, etc.). [Custom language support](https://ast-grep.github.io/advanced/custom-language.html) available via dynamic loading of any tree-sitter grammar.

- **tree-sitter** (Phase 2 fallback): 170+ community-maintained grammars. Individual grammars are updated independently by their maintainers — major languages (Python, TypeScript, Go, Rust) receive updates within days/weeks of language releases. Grammars ship as `.wasm` files loaded at runtime, so arborist can adopt bleeding-edge grammar updates without waiting for ast-grep releases.

**Risk mitigation**: If a new language syntax feature (e.g., Python 3.14 syntax) isn't yet in ast-grep's vendored grammar, the Phase 2 web-tree-sitter fallback can load the latest `.wasm` grammar directly.

## Architecture

```
Agent (Claude Code) --> Skill / MCP / CLI
                            |
                     Operations Layer     (rename, replace, insert, remove)
                            |
                      Engine Layer        (parser, query, edit, validator)
                            |
                    Provider Layer        (LanguageProvider interface)
                       /         \
              ast-grep/napi    web-tree-sitter
               (MVP)             (Phase 2)
                       \         /
                     Source Files
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system design.

## Quick Start

```bash
# Install
npm install arborist

# CLI usage
npx arborist parse src/index.ts --depth 3
npx arborist query src/index.ts -p 'console.log($MSG)'
npx arborist edit src/index.ts --replace -p 'console.log($MSG)' -w 'logger.info($MSG)' --dry-run
npx arborist providers

# MCP server
npx arborist-mcp
```

## Library API

```typescript
import {
  parseFile, parseString,
  queryFile, querySource,
  applyEdit, applyEditToSource,
  structuralReplace, renameSymbol, insertContent, removeNode,
  registerBuiltinProviders, registry,
} from 'arborist';

// Register language providers
registerBuiltinProviders();

// Parse a file
const ast = await parseFile('src/app.ts');

// Query for patterns
const matches = querySource(source, 'typescript', 'console.log($MSG)');

// Structural replace
const result = applyEditToSource(source, 'typescript', {
  kind: 'replace',
  pattern: 'console.log($MSG)',
  replacement: 'logger.info($MSG)',
});

// Rename a symbol
const renamed = applyEditToSource(source, 'typescript', {
  kind: 'rename',
  from: 'oldName',
  to: 'newName',
});

// Insert content
const inserted = applyEditToSource(source, 'typescript', {
  kind: 'insert',
  anchor: 'function myFunc($$$PARAMS) { $$$BODY }',
  position: 'before',
  content: '/** Documentation comment */',
});

// Remove nodes
const cleaned = applyEditToSource(source, 'typescript', {
  kind: 'remove',
  pattern: 'console.log($MSG)',
});
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `arborist parse <file>` | Parse file and display AST structure |
| `arborist query <file> -p <pattern>` | Search for AST pattern matches |
| `arborist edit <file> --replace\|--rename\|--insert\|--remove` | Apply structural edits |
| `arborist apply <json>` | Apply edits from JSON config |
| `arborist providers` | List registered language providers |

## MCP Tools

| Tool | Description |
|------|-------------|
| `arborist_parse` | Parse file and return AST |
| `arborist_query` | Query file for pattern matches |
| `arborist_edit` | Apply a structural edit |
| `arborist_batch` | Apply multiple edits atomically |
| `arborist_list_symbols` | Extract function/class/variable definitions |
| `arborist_rename` | Rename a symbol across a file |

## Benchmarks

The benchmark suite exercises all six MCP tools across TypeScript, Python, Go, and Rust, measuring token savings compared to the traditional Read+Edit approach. The primary metric is the reduction in context-window tokens achieved by using Arborist's pattern-based edits (a single tool call with a structural pattern) versus reading the entire file and issuing multiple edit calls. See [`tests/benchmarks/benchmark.test.ts`](tests/benchmarks/benchmark.test.ts) for the full suite, and [BENCHMARK.md](docs/BENCHMARK.md) for results..

## Development

```bash
npm install          # Install dependencies
npm run build        # Build with tsup
npm test             # Run tests
npm run test:coverage # Run with coverage
npm run lint         # Lint check
npm run typecheck    # Type check
```

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, component design, edit pipeline |
| [`docs/DDD.md`](docs/DDD.md) | Domain-Driven Design: bounded contexts, aggregates, events |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | 10-phase build plan with swarm execution strategy |
| [`docs/PLAN.md`](docs/PLAN.md) | Detailed technical plan with data model and API specs |
| [`docs/SYNTHESIS.md`](docs/SYNTHESIS.md) | Research synthesis and options analysis |
| [`docs/adr/`](docs/adr/) | 7 Architecture Decision Records |

## License

MIT
