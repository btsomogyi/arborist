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

## Supported Languages (MVP)

| Language | Backend | Status |
|----------|---------|--------|
| TypeScript/JavaScript/JSX/TSX | ast-grep | Planned |
| Python | ast-grep | Planned |
| Go | ast-grep | Phase 2 |
| Rust | ast-grep | Phase 2 |
| 170+ others | web-tree-sitter | Phase 2 |

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 0 | Research & design (ecosystem survey, options analysis) | Done |
| 1 | Architecture (ADRs, DDD, system architecture, implementation plan) | Done |
| 2 | Project foundation (package.json, tsconfig, build, directory structure) | Planned |
| 3 | Core types & domain (interfaces, errors, registry) | Planned |
| 4 | Engine layer (parser, query, edit engine, validator) | Planned |
| 5 | Language providers (TypeScript, Python) | Planned |
| 6 | High-level operations (replace, rename, insert, remove) | Planned |
| 7 | CLI interface (parse, query, edit, apply commands) | Planned |
| 8 | MCP server (arborist_parse, arborist_query, arborist_edit, arborist_batch) | Planned |
| 9 | Claude Code skill (skill definition, trigger conditions, examples) | Planned |
| 10 | E2E validation & ship (fixtures, 21 test scenarios, npm publish) | Planned |

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
